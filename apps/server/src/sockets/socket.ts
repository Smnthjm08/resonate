import type { WebSocketServer } from "ws";
import type WebSocket from "ws";
import { gameSocketManager } from "./game-socket";
import { handleMessage } from "./handle-message";
import { sendMessage } from "./send";
import { EventType } from "@repo/game-core";

export function registerSocket(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket) => {
    sendMessage(ws, { type: EventType.CONNECTED });

    ws.on("message", (rawMessage) => {
      handleMessage(ws, rawMessage).catch((error) => {
        console.error("Error handling message", error);
        sendMessage(ws, {
          type: EventType.GAME_ERROR,
          message: "Internal error",
        });
      });
    });

    ws.on("close", () => {
      console.log("Client disconnected");
      gameSocketManager.leaveAllRooms(ws);
    });

    ws.on("error", console.error);
  });
}
