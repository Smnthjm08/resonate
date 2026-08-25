import type { EventType } from "./events";

// client -> server
export type ClientMessage =
  | {
      type: EventType.GAME_JOIN;
      gameId: string;
    }
  | {
      type: EventType.GAME_LEAVE;
      gameId: string;
    }
  | {
      type: EventType.GAME_MOVE;
      gameId: string;
      data: {
        from: string;
        to: string;
        promotion?: string;
      };
    }
  | {
      type: EventType.GAME_PAUSE;
      gameId: string;
    }
  | {
      type: EventType.GAME_RESUME;
      gameId: string;
    };

// server -> client
export type ServerMessage =
  | {
      type: EventType.GAME_JOIN;
      gameId: string;
      data?: {
        userId: string;
      };
    }
  | {
      type: EventType.GAME_LEAVE;
      gameId: string;
      data?: {
        userId?: string;
      };
    }
  | {
      type: EventType.GAME_STATE;
      gameId: string;
      data: {
        fen: string;
        whiteId: string | null;
        blackId: string | null;
        whiteTimeMs: number;
        blackTimeMs: number;
        status: string;
        turn: "white" | "black";
      };
    }
  | {
      type: EventType.GAME_MOVE;
      gameId: string;
      data: {
        from: string;
        to: string;
        promotion?: string;
        san: string;
        fen: string;
      };
    }
  | {
      type: EventType.GAME_PAUSE;
      gameId: string;
      data?: {
        status: string;
      };
    }
  | {
      type: EventType.GAME_RESUME;
      gameId: string;
      data?: {
        status: string;
      };
    }
  | {
      type: EventType.GAME_ERROR;
      data: {
        message: string;
      };
    }
  | {
      type: EventType.CONNECTED;
    };
