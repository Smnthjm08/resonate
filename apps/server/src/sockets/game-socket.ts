import type { ServerMessage } from "@repo/game-core";
import type WebSocket from "ws";
import { sendMessage } from "./send";

type Session = { userId: string; gameId: string };

export class GameSocketManager {
  private readonly rooms = new Map<string, Set<WebSocket>>();
  private readonly sessions = new Map<WebSocket, Session>();

  getUserId(socket: WebSocket): string | undefined {
    return this.sessions.get(socket)?.userId;
  }

  joinRoom(gameId: string, userId: string, socket: WebSocket) {
    const currentGameId = this.sessions.get(socket)?.gameId;

    if (currentGameId) {
      if (currentGameId === gameId) {
        return;
      }

      this.leaveRoom(currentGameId, socket);
    }

    let room = this.rooms.get(gameId);

    if (!room) {
      room = new Set<WebSocket>();
      this.rooms.set(gameId, room);
    }

    room.add(socket);
    this.sessions.set(socket, { userId, gameId });
  }

  leaveRoom(gameId: string, socket: WebSocket) {
    const room = this.rooms.get(gameId);

    if (!room || !room.has(socket)) return;

    room.delete(socket);
    this.sessions.delete(socket);

    if (room.size === 0) {
      this.rooms.delete(gameId);
    }
  }

  leaveAllRooms(socket: WebSocket) {
    const gameId = this.sessions.get(socket)?.gameId;

    if (!gameId) return;

    this.leaveRoom(gameId, socket);
  }

  broadcast(
    gameId: string,
    message: ServerMessage,
    excludeSocket?: WebSocket
  ) {
    const room = this.rooms.get(gameId);

    if (!room) return;

    for (const clientSocket of room) {
      if (
        clientSocket !== excludeSocket &&
        clientSocket.readyState === 1 /* OPEN */
      ) {
        sendMessage(clientSocket, message);
      }
    }
  }
}

export const gameSocketManager = new GameSocketManager();
