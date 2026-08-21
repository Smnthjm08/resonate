import { EventType, type ServerMessage } from "@repo/game-core";
import type WebSocket from "ws";
import { sendMessage } from "./send";

type Session = { userId: string; gameId: string };

export class GameSocketManager {
  private readonly rooms = new Map<string, Set<WebSocket>>();
  private readonly sessions = new Map<WebSocket, Session>();
  private readonly userSockets = new Map<string, WebSocket>();

  getUserId(socket: WebSocket): string | undefined {
    return this.sessions.get(socket)?.userId;
  }

  getSocketByUserId(userId: string): WebSocket | undefined {
    return this.userSockets.get(userId);
  }

  joinRoom(gameId: string, userId: string, socket: WebSocket) {
    const existingSocket = this.userSockets.get(userId);

    if (existingSocket && existingSocket !== socket) {
      this.leaveAllRooms(existingSocket);
    }

    const currentGameId = this.sessions.get(socket)?.gameId;

    if (currentGameId && currentGameId !== gameId) {
      this.leaveRoom(currentGameId, socket);
    }

    let room = this.rooms.get(gameId);

    if (!room) {
      room = new Set<WebSocket>();
      this.rooms.set(gameId, room);
    }

    room.add(socket);
    this.sessions.set(socket, { userId, gameId });
    this.userSockets.set(userId, socket);
  }

  leaveRoom(gameId: string, socket: WebSocket) {
    const session = this.sessions.get(socket);
    const room = this.rooms.get(gameId);

    if (!room || !room.has(socket)) return;

    room.delete(socket);
    this.sessions.delete(socket);

    if (session?.userId && this.userSockets.get(session.userId) === socket) {
      this.userSockets.delete(session.userId);
    }

    if (room.size === 0) {
      this.rooms.delete(gameId);
    } else if (session?.userId) {
      this.broadcast(gameId, {
        type: EventType.GAME_LEAVE,
        gameId,
        data: { userId: session.userId },
      });
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
