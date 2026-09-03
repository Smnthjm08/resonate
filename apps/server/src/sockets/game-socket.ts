import { EventType, type GameRole, type ServerMessage } from "@repo/game-core";
import type WebSocket from "ws";
import { sendMessage } from "./send";

type Session = { userId: string; gameId: string };
type GameStateData = Omit<
  Extract<ServerMessage, { type: EventType.GAME_STATE }>["data"],
  "role"
>;

function getRole(
  userId: string,
  whiteId: string | null,
  blackId: string | null,
): GameRole {
  if (userId === whiteId) return "white";
  if (userId === blackId) return "black";
  return "spectator";
}

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

  getSession(socket: WebSocket): Session | undefined {
    return this.sessions.get(socket);
  }

  isUserInRoom(gameId: string, userId: string): boolean {
    const socket = this.userSockets.get(userId);

    if (!socket) return false;

    return this.sessions.get(socket)?.gameId === gameId;
  }

  setAuthenticatedUser(socket: WebSocket, userId: string) {
    const existingSocket = this.userSockets.get(userId);

    if (existingSocket && existingSocket !== socket) {
      this.leaveAllRooms(existingSocket);
      try {
        existingSocket.close(4000, "Replaced by new connection");
      } catch {
        // Ignore if already closed
      }
    }

    const currentSession = this.sessions.get(socket);
    this.sessions.set(socket, {
      userId,
      gameId: currentSession?.gameId ?? "",
    });
    this.userSockets.set(userId, socket);
  }

  joinRoom(gameId: string, socket: WebSocket) {
    const session = this.sessions.get(socket);

    if (!session?.userId) {
      throw new Error("Socket must be authenticated before joining a room");
    }

    const userId = session.userId;
    const currentGameId = session.gameId;

    if (currentGameId && currentGameId !== gameId && currentGameId !== "") {
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
    const session = this.sessions.get(socket);
    const room = this.rooms.get(gameId);

    if (!room || !room.has(socket)) return;

    room.delete(socket);

    if (session) {
      this.sessions.set(socket, { userId: session.userId, gameId: "" });
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
    const session = this.sessions.get(socket);

    if (session?.gameId) {
      this.leaveRoom(session.gameId, socket);
    }

    if (session?.userId && this.userSockets.get(session.userId) === socket) {
      this.userSockets.delete(session.userId);
    }

    this.sessions.delete(socket);
  }

  broadcast(gameId: string, message: ServerMessage, excludeSocket?: WebSocket) {
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

  sendGameState(socket: WebSocket, gameId: string, data: GameStateData) {
    const session = this.sessions.get(socket);

    if (!session || session.gameId !== gameId) return;

    sendMessage(socket, {
      type: EventType.GAME_STATE,
      gameId,
      data: {
        ...data,
        role: getRole(session.userId, data.whiteId, data.blackId),
      },
    });
  }

  broadcastGameState(gameId: string, data: GameStateData) {
    const room = this.rooms.get(gameId);

    if (!room) return;

    for (const socket of room) {
      if (socket.readyState === 1 /* OPEN */) {
        this.sendGameState(socket, gameId, data);
      }
    }
  }
}

export const gameSocketManager = new GameSocketManager();
