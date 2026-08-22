import type { IncomingMessage } from "http";
import type { WebSocketServer } from "ws";
import type WebSocket from "ws";
import { gameSocketManager } from "./game-socket";
import { handleMessage } from "./handle-message";
import { sendMessage } from "./send";
import { EventType } from "@repo/game-core";
import { verifyToken } from "../utils/jwt";

export function registerSocket(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const token = url.searchParams.get("token");

    if (!token) {
      sendMessage(ws, {
        type: EventType.GAME_ERROR,
        data: { message: "Missing authorization token" },
      });
      ws.close(4001, "Unauthorized");
      return;
    }

    const payload = verifyToken(token);

    if (!payload?.userId) {
      sendMessage(ws, {
        type: EventType.GAME_ERROR,
        data: { message: "Invalid or expired authorization token" },
      });
      ws.close(4001, "Unauthorized");
      return;
    }

    gameSocketManager.setAuthenticatedUser(ws, payload.userId);
    sendMessage(ws, { type: EventType.CONNECTED });

    ws.on("message", (rawMessage) => {
      handleMessage(ws, rawMessage).catch((error) => {
        console.error("Error handling message", error);
        sendMessage(ws, {
          type: EventType.GAME_ERROR,
          data: { message: "Internal error" },
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
