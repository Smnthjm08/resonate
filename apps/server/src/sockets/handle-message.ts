// server/src/sockets/handle-message
import { EventType } from "@repo/game-core";
import type { RawData, WebSocket } from "ws";
import { gameSocketManager } from "./game-socket";

interface messageType {
  event: EventType;
  gameId: string;
}

export function handleMessage(socket: WebSocket, raw: RawData) {
  try {
    const message: messageType = JSON.parse(raw.toString());

    if (!Object.values(EventType).includes(message.event)) {
      return;
    }

    switch (message.event) {
      case EventType.GAME_JOIN:
        gameSocketManager.joinRoom(message.gameId, socket);
        break;

      case EventType.GAME_LEAVE:
        gameSocketManager.leaveRoom(message.gameId, socket);
        break;

      default:
        console.log("unknown event:", message.event);
        break;
    }
  } catch (error) {
    console.log("error parsing message", error);
    return;
  }
}
