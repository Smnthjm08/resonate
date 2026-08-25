import { EventType, WHITE, getOutcome, tryMove } from "@repo/game-core";
import { GameResult, GameStatus, prisma } from "@repo/db";
import type { RawData, WebSocket } from "ws";
import { gameSocketManager } from "./game-socket";
import { sendMessage } from "./send";
import { clientMessageSchema } from "./schema";
import { gameEngineCache } from "./game-engine-cache";

function getActiveTurn(fen: string): "white" | "black" {
  return fen.split(" ")[1] === WHITE ? "white" : "black";
}

function reconcileTurnClock(game: {
  fen: string;
  whiteId: string | null;
  blackId: string | null;
  whiteTimeMs: number;
  blackTimeMs: number;
  status: GameStatus;
  lastMoveAt: Date | null;
}) {
  if (game.status !== GameStatus.ACTIVE || !game.lastMoveAt) {
    return {
      whiteTimeMs: game.whiteTimeMs,
      blackTimeMs: game.blackTimeMs,
      lastMoveAt: game.lastMoveAt,
      timedOut: false,
      winnerId: null,
    };
  }

  const activeTurn = getActiveTurn(game.fen);
  const elapsedMs = Math.max(0, Date.now() - new Date(game.lastMoveAt).getTime());

  if (elapsedMs <= 0) {
    return {
      whiteTimeMs: game.whiteTimeMs,
      blackTimeMs: game.blackTimeMs,
      lastMoveAt: game.lastMoveAt,
      timedOut: false,
      winnerId: null,
    };
  }

  if (activeTurn === "white") {
    const whiteTimeMs = Math.max(0, game.whiteTimeMs - elapsedMs);

    if (whiteTimeMs === 0) {
      return {
        whiteTimeMs: 0,
        blackTimeMs: game.blackTimeMs,
        lastMoveAt: new Date(),
        timedOut: true,
        winnerId: game.blackId,
      };
    }

    return {
      whiteTimeMs,
      blackTimeMs: game.blackTimeMs,
      lastMoveAt: new Date(),
      timedOut: false,
      winnerId: null,
    };
  }

  const blackTimeMs = Math.max(0, game.blackTimeMs - elapsedMs);

  if (blackTimeMs === 0) {
    return {
      whiteTimeMs: game.whiteTimeMs,
      blackTimeMs: 0,
      lastMoveAt: new Date(),
      timedOut: true,
      winnerId: game.whiteId,
    };
  }

  return {
    whiteTimeMs: game.whiteTimeMs,
    blackTimeMs,
    lastMoveAt: new Date(),
    timedOut: false,
    winnerId: null,
  };
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

      sendMessage(socket, {
        type: EventType.GAME_STATE,
        gameId: message.gameId,
        data: {
          fen: game.fen,
          whiteId: game.whiteId,
          blackId: game.blackId,
          whiteTimeMs: game.whiteTimeMs,
          blackTimeMs: game.blackTimeMs,
          status: game.status,
          turn: activeTurn,
        },
      });

      gameSocketManager.broadcast(
        message.gameId,
        {
          type: EventType.GAME_JOIN,
          gameId: message.gameId,
          data: { userId },
        },
        socket
      );
      break;
    }

    case EventType.GAME_LEAVE:
      gameSocketManager.leaveRoom(message.gameId, socket);
      break;

    case EventType.GAME_MOVE: {
      const userId = gameSocketManager.getUserId(socket);

      if (!userId) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Unauthorized socket session" },
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
        const timedOutGame = await prisma.game.update({
          where: { id: message.gameId },
          data: {
            status: GameStatus.FINISHED,
            result: GameResult.TIMEOUT,
            winnerId: clockState.winnerId,
            whiteTimeMs: clockState.whiteTimeMs,
            blackTimeMs: clockState.blackTimeMs,
            lastMoveAt: clockState.lastMoveAt,
          },
        });

        gameEngineCache.evict(message.gameId);

        gameSocketManager.broadcast(message.gameId, {
          type: EventType.GAME_STATE,
          gameId: message.gameId,
          data: {
            fen: timedOutGame.fen,
            whiteId: timedOutGame.whiteId,
            blackId: timedOutGame.blackId,
            whiteTimeMs: timedOutGame.whiteTimeMs,
            blackTimeMs: timedOutGame.blackTimeMs,
            status: timedOutGame.status,
            turn: getActiveTurn(timedOutGame.fen),
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
              lastMoveAt: new Date(),
              ...(outcome.isGameOver
                ? {
                    status: GameStatus.FINISHED,
                    result: outcome.result
                      ? GameResult[outcome.result]
                      : null,
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

      if (outcome.isGameOver) {
        gameEngineCache.evict(message.gameId);
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

      gameSocketManager.broadcast(message.gameId, {
        type: EventType.GAME_STATE,
        gameId: message.gameId,
        data: {
          fen: moveResult.fen,
          whiteId: game.whiteId,
          blackId: game.blackId,
          whiteTimeMs: activeClock.whiteTimeMs,
          blackTimeMs: activeClock.blackTimeMs,
          status: outcome.isGameOver ? GameStatus.FINISHED : game.status,
          turn: nextTurn,
        },
      });

      break;
    }

    case EventType.GAME_PAUSE: {
      const userId = gameSocketManager.getUserId(socket);

      if (!userId) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Unauthorized socket session" },
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
            message: "Only the player whose clock is running may pause the game",
          },
        });
        return;
      }

      const clockState = reconcileTurnClock(game);

      if (clockState.timedOut) {
        const timedOutGame = await prisma.game.update({
          where: { id: message.gameId },
          data: {
            status: GameStatus.FINISHED,
            result: GameResult.TIMEOUT,
            winnerId: clockState.winnerId,
            whiteTimeMs: clockState.whiteTimeMs,
            blackTimeMs: clockState.blackTimeMs,
            lastMoveAt: clockState.lastMoveAt,
          },
        });

        gameEngineCache.evict(message.gameId);

        gameSocketManager.broadcast(message.gameId, {
          type: EventType.GAME_STATE,
          gameId: message.gameId,
          data: {
            fen: timedOutGame.fen,
            whiteId: timedOutGame.whiteId,
            blackId: timedOutGame.blackId,
            whiteTimeMs: timedOutGame.whiteTimeMs,
            blackTimeMs: timedOutGame.blackTimeMs,
            status: timedOutGame.status,
            turn: getActiveTurn(timedOutGame.fen),
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

      gameSocketManager.broadcast(message.gameId, {
        type: EventType.GAME_STATE,
        gameId: message.gameId,
        data: {
          fen: updatedGame.fen,
          whiteId: updatedGame.whiteId,
          blackId: updatedGame.blackId,
          whiteTimeMs: updatedGame.whiteTimeMs,
          blackTimeMs: updatedGame.blackTimeMs,
          status: updatedGame.status,
          turn: getActiveTurn(updatedGame.fen),
        },
      });
      break;
    }

    case EventType.GAME_RESUME: {
      const userId = gameSocketManager.getUserId(socket);

      if (!userId) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "Unauthorized socket session" },
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

      gameSocketManager.broadcast(message.gameId, {
        type: EventType.GAME_STATE,
        gameId: message.gameId,
        data: {
          fen: resumedGame.fen,
          whiteId: resumedGame.whiteId,
          blackId: resumedGame.blackId,
          whiteTimeMs: resumedGame.whiteTimeMs,
          blackTimeMs: resumedGame.blackTimeMs,
          status: resumedGame.status,
          turn: activeTurn,
        },
      });
      break;
    }
  }
}
