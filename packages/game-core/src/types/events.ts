// server & client event types
export enum EventType {
  CONNECTED = "connected",
  GAME_JOIN = "game:join",
  GAME_LEAVE = "game:leave",
  GAME_STATE = "game:state",
  GAME_MOVE = "game:move",
  GAME_PAUSE = "game:pause",
  GAME_RESUME = "game:resume",
  GAME_RESIGN = "game:resign",
  GAME_DRAW_OFFER = "game:draw:offer",
  GAME_DRAW_ACCEPT = "game:draw:accept",
  GAME_DRAW_DECLINE = "game:draw:decline",
  GAME_ERROR = "game:error",
}
