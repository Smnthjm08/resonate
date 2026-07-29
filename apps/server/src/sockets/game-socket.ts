// server/src/sockets/game-socket.ts
import type WebSocket from "ws";

export class GameSocketManager {
  private readonly rooms = new Map<string, Set<WebSocket>>();

  joinRoom(gameId: string, socket: WebSocket) {
    let room = this.rooms.get(gameId);

    if (!room) {
      room = new Set<WebSocket>();
      this.rooms.set(gameId, room);
    }

    room.add(socket);
  }

  leaveRoom(gameId: string, socket: WebSocket) {
    const room = this.rooms.get(gameId);

    if (!room) return;

    room.delete(socket);

    if (room.size === 0) {
      this.rooms.delete(gameId);
    }
  }
}

export const gameSocketManager = new GameSocketManager();
