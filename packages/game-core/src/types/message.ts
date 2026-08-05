import type { EventType } from "./events";

// client -> server
export type ClientMessage =
  | {
      type: EventType.GAME_JOIN;
      gameId: string;
      userId: string;
    }
  | {
      type: EventType.GAME_LEAVE;
      gameId: string;
    };

// server -> client
export type ServerMessage =
  | {
      type: EventType.GAME_JOIN;
      gameId: string;
    }
  | {
      type: EventType.GAME_LEAVE;
      gameId: string;
    }
  | {
      type: EventType.GAME_ERROR;
      message: string;
    }
  | {
      type: EventType.CONNECTED;
    };
