import { EventType } from "@repo/game-core";
import type { WebSocketServer } from "ws";
import type WebSocket from "ws";
import { gameSocketManager } from "./game-socket";

export function registerSocket(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket) => {
    ws.send(JSON.stringify({ type: "connected" }));

    ws.on("message", (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString());

        switch (message.type) {
          case EventType.GAME_JOIN:
            gameSocketManager.joinRoom(message.gameId, ws);

            ws.send(
              JSON.stringify({
                type: EventType.GAME_JOIN,
                success: true,
              }),
            );
            break;

          default:
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Unknown event type",
              }),
            );
        }

        // ws.send(JSON.stringify(message));
      } catch (error) {
        console.log("Error parsing json", error);
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Invalid JSON",
          }),
        );
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected");
      gameSocketManager.leaveAllRooms(ws);
    });

    ws.on("error", console.error);
  });
}
