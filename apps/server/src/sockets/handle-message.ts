import { EventType, getActiveTurn, getOutcome, tryMove } from "@repo/game-core";
import { type Game, GameResult, GameStatus, prisma } from "@repo/db";
import type { RawData, WebSocket } from "ws";
import { gameSocketManager } from "./game-socket";
import { sendMessage } from "./send";
import { clientMessageSchema } from "./schema";
import { reconcileTurnClock } from "./clock";
import { scheduleClockExpiry } from "./clock-expiry";
import { clockTimerStore } from "./clock-timer-store";
import { drawOfferStore } from "./draw-offer-store";
import { finishGame } from "./finish-game";
import { gameEngineCache } from "./game-engine-cache";

/**
 * Resolves the socket's authenticated user and the game it is acting on. Every
 * handler but `game:join` starts with exactly this pair of lookups; `null` back
 * means the client has already been told why, and the handler should return.
 */
async function loadGameForSocket(
  socket: WebSocket,
  gameId: string,
): Promise<{ userId: string; game: Game } | null> {
  const userId = gameSocketManager.getUserId(socket);

  if (!userId) {
    sendMessage(socket, {
      type: EventType.GAME_ERROR,
      data: { message: "Unauthorized socket session" },
    });
    return null;
  }

  const game = await prisma.game.findUnique({ where: { id: gameId } });

  if (!game) {
    sendMessage(socket, {
      type: EventType.GAME_ERROR,
      data: { message: "Game not found" },
    });
    return null;
  }

  return { userId, game };
}

/**
 * A game a player can still resign or agree a draw in. Unlike a move, neither
 * needs the clock to be running, so a paused game qualifies.
 */
function isInProgress(status: GameStatus): boolean {
  return status === GameStatus.ACTIVE || status === GameStatus.PAUSED;
}

export async function handleMessage(socket: WebSocket, raw: RawData) {
  let payload: unknown;

  try {
    payload = JSON.parse(raw.toString());
  } catch {
    sendMessage(socket, {
      type: EventType.GAME_ERROR,
      data: { message: "Invalid JSON" },
    });
    return;
  }

  const result = clientMessageSchema.safeParse(payload);

  if (!result.success) {
    sendMessage(socket, {
      type: EventType.GAME_ERROR,
      data: {
        message: `Invalid message: ${result.error.issues[0]?.message ?? "unrecognised event"}`,
      },
    });
    return;
  }

  const message = result.data;

  switch (message.type) {
    case EventType.GAME_JOIN: {
      const userId = gameSocketManager.getUserId(socket);

      if (!userId) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Unauthorized socket session" },
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Unknown user" },
        });
        return;
      }

      const game = await prisma.game.findUnique({
        where: { id: message.gameId },
      });

      if (!game) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Game not found" },
        });
        return;
      }

      const otherActiveGame = await prisma.game.findFirst({
        where: {
          status: GameStatus.ACTIVE,
          id: { not: message.gameId },
          OR: [{ whiteId: userId }, { blackId: userId }],
        },
      });

      if (otherActiveGame) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "You are already in another active game" },
        });
        return;
      }

      gameSocketManager.joinRoom(message.gameId, socket);

      const activeTurn = getActiveTurn(game.fen);

      gameSocketManager.sendGameState(socket, message.gameId, {
        fen: game.fen,
        whiteId: game.whiteId,
        blackId: game.blackId,
        whiteTimeMs: game.whiteTimeMs,
        blackTimeMs: game.blackTimeMs,
        status: game.status,
        turn: activeTurn,
        result: game.result,
        winnerId: game.winnerId,
      });

      gameSocketManager.broadcast(
        message.gameId,
        {
          type: EventType.GAME_JOIN,
          gameId: message.gameId,
          data: { userId },
        },
        socket,
      );
      break;
    }

    case EventType.GAME_LEAVE:
      gameSocketManager.leaveRoom(message.gameId, socket);
      break;

    case EventType.GAME_MOVE: {
      const context = await loadGameForSocket(socket, message.gameId);

      if (!context) return;

      const { userId, game } = context;

      if (game.status !== GameStatus.ACTIVE) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Game is not active" },
        });
        return;
      }

      if (userId !== game.whiteId && userId !== game.blackId) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Spectators cannot make moves" },
        });
        return;
      }

      const activeTurn = getActiveTurn(game.fen);

      if (
        (activeTurn === "white" && userId !== game.whiteId) ||
        (activeTurn === "black" && userId !== game.blackId)
      ) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Not your turn" },
        });
        return;
      }

      const clockState = reconcileTurnClock(game);

      if (clockState.timedOut) {
        await finishGame({
          gameId: message.gameId,
          result: GameResult.TIMEOUT,
          winnerId: clockState.winnerId,
          clock: {
            whiteTimeMs: clockState.whiteTimeMs,
            blackTimeMs: clockState.blackTimeMs,
            lastMoveAt: clockState.lastMoveAt,
          },
        });

        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Time expired" },
        });
        return;
      }

      const activeClock = {
        whiteTimeMs:
          activeTurn === "white" ? clockState.whiteTimeMs : game.whiteTimeMs,
        blackTimeMs:
          activeTurn === "black" ? clockState.blackTimeMs : game.blackTimeMs,
      };

      const engine = gameEngineCache.getOrHydrate(message.gameId, game.fen);
      const moveResult = tryMove(engine, message.data);

      if (!moveResult) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Illegal move" },
        });
        return;
      }

      // `tryMove` has already mutated the cached engine. From here until the
      // transaction commits, the cache is ahead of the DB — every failure path
      // below must evict so the next read rehydrates from persisted state.
      const outcome = getOutcome(engine);

      const winnerId = outcome.isGameOver
        ? outcome.winner === "white"
          ? game.whiteId
          : outcome.winner === "black"
            ? game.blackId
            : null
        : null;

      const movedAt = new Date();

      try {
        await prisma.$transaction(async (tx) => {
          // Derived inside the transaction: a count read outside it can be
          // stale, and `@@unique([gameId, moveNumber])` turns that into a
          // constraint violation rather than a silently wrong move number.
          const lastMove = await tx.move.findFirst({
            where: { gameId: message.gameId },
            orderBy: { moveNumber: "desc" },
            select: { moveNumber: true },
          });

          await tx.move.create({
            data: {
              gameId: message.gameId,
              moveNumber: (lastMove?.moveNumber ?? 0) + 1,
              san: moveResult.san,
              fen: moveResult.fen,
              from: moveResult.from,
              to: moveResult.to,
              promotion: moveResult.promotion ?? null,
            },
          });

          await tx.game.update({
            where: { id: message.gameId },
            data: {
              fen: moveResult.fen,
              whiteTimeMs: activeClock.whiteTimeMs,
              blackTimeMs: activeClock.blackTimeMs,
              lastMoveAt: movedAt,
              ...(outcome.isGameOver
                ? {
                    status: GameStatus.FINISHED,
                    result: outcome.result ? GameResult[outcome.result] : null,
                    winnerId,
                  }
                : {}),
            },
          });
        });
      } catch (error) {
        gameEngineCache.evict(message.gameId);

        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: {
            message: `Failed to save move: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        });
        return;
      }

      // A move supersedes any offer that was standing when it was played.
      drawOfferStore.clear(message.gameId);

      if (outcome.isGameOver) {
        gameEngineCache.evict(message.gameId);
        clockTimerStore.cancel(message.gameId);
      } else {
        scheduleClockExpiry({
          id: message.gameId,
          fen: moveResult.fen,
          whiteId: game.whiteId,
          blackId: game.blackId,
          whiteTimeMs: activeClock.whiteTimeMs,
          blackTimeMs: activeClock.blackTimeMs,
          status: GameStatus.ACTIVE,
          lastMoveAt: movedAt,
        });
      }

      const nextTurn = getActiveTurn(moveResult.fen);

      gameSocketManager.broadcast(message.gameId, {
        type: EventType.GAME_MOVE,
        gameId: message.gameId,
        data: {
          from: moveResult.from,
          to: moveResult.to,
          promotion: moveResult.promotion,
          san: moveResult.san,
          fen: moveResult.fen,
        },
      });

      gameSocketManager.broadcastGameState(message.gameId, {
        fen: moveResult.fen,
        whiteId: game.whiteId,
        blackId: game.blackId,
        whiteTimeMs: activeClock.whiteTimeMs,
        blackTimeMs: activeClock.blackTimeMs,
        status: outcome.isGameOver ? GameStatus.FINISHED : game.status,
        turn: nextTurn,
        result: outcome.isGameOver ? outcome.result : null,
        winnerId,
      });

      break;
    }

    case EventType.GAME_PAUSE: {
      const context = await loadGameForSocket(socket, message.gameId);

      if (!context) return;

      const { userId, game } = context;

      if (game.status !== GameStatus.ACTIVE) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Game is not active" },
        });
        return;
      }

      if (userId !== game.whiteId && userId !== game.blackId) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Only players can pause the game" },
        });
        return;
      }

      const activeTurn = getActiveTurn(game.fen);
      const pausingPlayerId =
        activeTurn === "white" ? game.whiteId : game.blackId;

      if (userId !== pausingPlayerId) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: {
            message:
              "Only the player whose clock is running may pause the game",
          },
        });
        return;
      }

      const clockState = reconcileTurnClock(game);

      if (clockState.timedOut) {
        await finishGame({
          gameId: message.gameId,
          result: GameResult.TIMEOUT,
          winnerId: clockState.winnerId,
          clock: {
            whiteTimeMs: clockState.whiteTimeMs,
            blackTimeMs: clockState.blackTimeMs,
            lastMoveAt: clockState.lastMoveAt,
          },
        });

        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Time expired" },
        });
        return;
      }

      const updatedGame = await prisma.game.update({
        where: { id: message.gameId },
        data: {
          whiteTimeMs: clockState.whiteTimeMs,
          blackTimeMs: clockState.blackTimeMs,
          status: GameStatus.PAUSED,
          lastMoveAt: null,
        },
      });

      clockTimerStore.cancel(message.gameId);

      gameSocketManager.broadcastGameState(message.gameId, {
        fen: updatedGame.fen,
        whiteId: updatedGame.whiteId,
        blackId: updatedGame.blackId,
        whiteTimeMs: updatedGame.whiteTimeMs,
        blackTimeMs: updatedGame.blackTimeMs,
        status: updatedGame.status,
        turn: getActiveTurn(updatedGame.fen),
        result: updatedGame.result,
        winnerId: updatedGame.winnerId,
      });
      break;
    }

    case EventType.GAME_RESUME: {
      const context = await loadGameForSocket(socket, message.gameId);

      if (!context) return;

      const { userId, game } = context;

      if (game.status !== GameStatus.PAUSED) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Game is not paused" },
        });
        return;
      }

      if (userId !== game.whiteId && userId !== game.blackId) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Only players can resume the game" },
        });
        return;
      }

      const activeTurn = getActiveTurn(game.fen);
      const resumingPlayerId =
        activeTurn === "white" ? game.blackId : game.whiteId;

      if (userId !== resumingPlayerId) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: {
            message: "Only the opponent may resume the game after a pause",
          },
        });
        return;
      }

      const resumedGame = await prisma.game.update({
        where: { id: message.gameId },
        data: {
          status: GameStatus.ACTIVE,
          lastMoveAt: new Date(),
        },
      });

      scheduleClockExpiry(resumedGame);

      gameSocketManager.broadcastGameState(message.gameId, {
        fen: resumedGame.fen,
        whiteId: resumedGame.whiteId,
        blackId: resumedGame.blackId,
        whiteTimeMs: resumedGame.whiteTimeMs,
        blackTimeMs: resumedGame.blackTimeMs,
        status: resumedGame.status,
        turn: activeTurn,
        result: resumedGame.result,
        winnerId: resumedGame.winnerId,
      });
      break;
    }

    case EventType.GAME_RESIGN: {
      const context = await loadGameForSocket(socket, message.gameId);

      if (!context) return;

      const { userId, game } = context;

      if (!isInProgress(game.status)) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Game is not in progress" },
        });
        return;
      }

      if (userId !== game.whiteId && userId !== game.blackId) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Spectators cannot resign" },
        });
        return;
      }

      // The clock is deliberately left as of the last move: a resignation is a
      // resignation whether or not the resigning player was also about to flag.
      gameSocketManager.broadcast(message.gameId, {
        type: EventType.GAME_RESIGN,
        gameId: message.gameId,
        data: { userId },
      });

      await finishGame({
        gameId: message.gameId,
        result: GameResult.RESIGNATION,
        winnerId: userId === game.whiteId ? game.blackId : game.whiteId,
      });
      break;
    }

    case EventType.GAME_DRAW_OFFER: {
      const context = await loadGameForSocket(socket, message.gameId);

      if (!context) return;

      const { userId, game } = context;

      if (!isInProgress(game.status)) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Game is not in progress" },
        });
        return;
      }

      if (userId !== game.whiteId && userId !== game.blackId) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Spectators cannot offer a draw" },
        });
        return;
      }

      const offeredBy = drawOfferStore.get(message.gameId);

      if (offeredBy === userId) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "You already have a draw offer pending" },
        });
        return;
      }

      if (offeredBy) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: {
            message:
              "Your opponent has already offered a draw — accept or decline it",
          },
        });
        return;
      }

      drawOfferStore.set(message.gameId, userId);

      gameSocketManager.broadcast(message.gameId, {
        type: EventType.GAME_DRAW_OFFER,
        gameId: message.gameId,
        data: { userId },
      });
      break;
    }

    case EventType.GAME_DRAW_ACCEPT: {
      const context = await loadGameForSocket(socket, message.gameId);

      if (!context) return;

      const { userId, game } = context;

      if (!isInProgress(game.status)) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Game is not in progress" },
        });
        return;
      }

      if (userId !== game.whiteId && userId !== game.blackId) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Spectators cannot accept a draw" },
        });
        return;
      }

      const offeredBy = drawOfferStore.get(message.gameId);

      if (!offeredBy) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "There is no draw offer to accept" },
        });
        return;
      }

      if (offeredBy === userId) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "You cannot accept your own draw offer" },
        });
        return;
      }

      gameSocketManager.broadcast(message.gameId, {
        type: EventType.GAME_DRAW_ACCEPT,
        gameId: message.gameId,
        data: { userId },
      });

      await finishGame({
        gameId: message.gameId,
        result: GameResult.DRAW_AGREED,
        winnerId: null,
      });
      break;
    }

    case EventType.GAME_DRAW_DECLINE: {
      const context = await loadGameForSocket(socket, message.gameId);

      if (!context) return;

      const { userId, game } = context;

      if (userId !== game.whiteId && userId !== game.blackId) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Spectators cannot decline a draw" },
        });
        return;
      }

      const offeredBy = drawOfferStore.get(message.gameId);

      if (!offeredBy) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "There is no draw offer to decline" },
        });
        return;
      }

      // An offer stands until the opponent answers it or plays a move; the
      // player who made it cannot take it back.
      if (offeredBy === userId) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "You cannot decline your own draw offer" },
        });
        return;
      }

      drawOfferStore.clear(message.gameId);

      gameSocketManager.broadcast(message.gameId, {
        type: EventType.GAME_DRAW_DECLINE,
        gameId: message.gameId,
        data: { userId },
      });
      break;
    }
  }
}
