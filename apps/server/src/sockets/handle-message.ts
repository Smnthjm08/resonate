import { EventType, WHITE, getOutcome, tryMove } from "@repo/game-core";
import { GameResult, GameStatus, prisma } from "@repo/db";
import type { RawData, WebSocket } from "ws";
import { gameSocketManager } from "./game-socket";
import { sendMessage } from "./send";
import { clientMessageSchema } from "./schema";
import { gameEngineCache } from "./game-engine-cache";

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

      const activeTurn: "white" | "black" =
        game.fen.split(" ")[1] === WHITE ? "white" : "black";

      sendMessage(socket, {
        type: EventType.GAME_STATE,
        gameId: message.gameId,
        data: {
          fen: game.fen,
          whiteId: game.whiteId,
          blackId: game.blackId,
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

      const activeTurn: "white" | "black" =
        game.fen.split(" ")[1] === WHITE ? "white" : "black";

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

      const nextTurn: "white" | "black" =
        moveResult.fen.split(" ")[1] === WHITE ? "white" : "black";

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
          status: outcome.isGameOver ? GameStatus.FINISHED : game.status,
          turn: nextTurn,
        },
      });

      break;
    }
  }
}
