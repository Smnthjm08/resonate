import type { ServerMessage } from "@repo/game-core";
import type WebSocket from "ws";

export function sendMessage(ws: WebSocket, message: ServerMessage) {
  ws.send(JSON.stringify(message));
}
