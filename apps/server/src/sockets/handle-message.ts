import { EventType } from "@repo/game-core";
import type { RawData, WebSocket } from "ws";
import { gameSocketManager } from "./game-socket";
import { sendMessage } from "./send";
import { clientMessageSchema } from "./schema";



export function handleMessage(socket: WebSocket, raw: RawData) {
  let payload: unknown;

  try {
    payload = JSON.parse(raw.toString());
  } catch {
    sendMessage(socket, {
      type: EventType.GAME_ERROR,
      message: "Invalid JSON",
    });
    return;
  }

  const result = clientMessageSchema.safeParse(payload);

  if (!result.success) {
    sendMessage(socket, {
      type: EventType.GAME_ERROR,
      message: `Invalid message: ${result.error.issues[0]?.message ?? "unrecognised event"}`,
    });
    return;
  }

  const message = result.data;


  switch (message.type) {
    case EventType.GAME_JOIN:
      gameSocketManager.joinRoom(message.gameId, socket);
      break;

    case EventType.GAME_LEAVE:
      gameSocketManager.leaveRoom(message.gameId, socket);
      break;
  }
}
