import { EventType, WHITE } from "@repo/game-core";
import { GameStatus, prisma } from "@repo/db";
import type { RawData, WebSocket } from "ws";
import { gameSocketManager } from "./game-socket";
import { sendMessage } from "./send";
import { clientMessageSchema } from "./schema";

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
      const user = await prisma.user.findUnique({
        where: { id: message.data.userId },
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
          OR: [
            { whiteId: message.data.userId },
            { blackId: message.data.userId },
          ],
        },
      });

      if (otherActiveGame) {
        sendMessage(socket, {
          type: EventType.GAME_ERROR,
          data: { message: "You are already in another active game" },
        });
        return;
      }

      gameSocketManager.joinRoom(message.gameId, message.data.userId, socket);

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
          data: { userId: message.data.userId },
        },
        socket
      );
      break;
    }

    case EventType.GAME_LEAVE:
      gameSocketManager.leaveRoom(message.gameId, socket);
      break;
  }
}
