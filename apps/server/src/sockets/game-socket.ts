// server/src/sockets/game-socket.ts
import type WebSocket from "ws";

export class GameSocketManager {
  private readonly rooms = new Map<string, Set<WebSocket>>();

  private readonly socketToGame = new Map<WebSocket, string>();

  // joinRoom(gameId: string, socket: WebSocket) {
  //   let room = this.rooms.get(gameId);

  //   if (!room) {
  //     room = new Set<WebSocket>();
  //     this.rooms.set(gameId, room);
  //   }

  //   room.add(socket);
  //   this.socketToGame.set(socket, gameId);
  // }

  joinRoom(gameId: string, socket: WebSocket) {
    const currentGameId = this.socketToGame.get(socket);

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
    this.socketToGame.set(socket, gameId);

    console.log(this.rooms);
  }

  leaveRoom(gameId: string, socket: WebSocket) {
    const room = this.rooms.get(gameId);

    if (!room) return;

    room.delete(socket);
    this.socketToGame.delete(socket);

    if (room.size === 0) {
      this.rooms.delete(gameId);
    }
  }

  // leaveAllRooms(socket: WebSocket) {
  //   const gameId = this.socketToGame.get(socket);

  //   if (!gameId) return;

  //   this.leaveRoom(gameId, socket);

  //   this.socketToGame.delete(socket);
  // }

  leaveAllRooms(socket: WebSocket) {
    const gameId = this.socketToGame.get(socket);

    if (!gameId) return;

    this.leaveRoom(gameId, socket);
  }
}

export const gameSocketManager = new GameSocketManager();
