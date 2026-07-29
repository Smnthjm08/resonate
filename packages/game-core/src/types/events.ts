// packages/game-core/src/types/event.ts
export enum EventType {
  GAME_JOIN = "game:join",
  GAME_LEAVE = "game:leave",

  GAME_PAUSE = "game:pause",
  GAME_RESUME = "game:resume",

  GAME_MOVE = "game:move",
  GAME_STATE = "game:state",

  GAME_ERROR = "game:error",
}
