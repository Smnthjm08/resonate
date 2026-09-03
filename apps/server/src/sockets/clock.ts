import { GameStatus } from "@repo/db";
import { getActiveTurn } from "@repo/game-core";

export type ClockGame = {
  fen: string;
  whiteId: string | null;
  blackId: string | null;
  whiteTimeMs: number;
  blackTimeMs: number;
  status: GameStatus;
  lastMoveAt: Date | null;
};

/** Milliseconds until the player on move flags, or null if no clock is running. */
export function remainingMs(game: ClockGame): number | null {
  if (game.status !== GameStatus.ACTIVE || !game.lastMoveAt) return null;

  const bankedMs =
    getActiveTurn(game.fen) === "white" ? game.whiteTimeMs : game.blackTimeMs;
  const elapsedMs = Math.max(
    0,
    Date.now() - new Date(game.lastMoveAt).getTime(),
  );

  return Math.max(0, bankedMs - elapsedMs);
}

export function reconcileTurnClock(game: ClockGame) {
  if (game.status !== GameStatus.ACTIVE || !game.lastMoveAt) {
    return {
      whiteTimeMs: game.whiteTimeMs,
      blackTimeMs: game.blackTimeMs,
      lastMoveAt: game.lastMoveAt,
      timedOut: false,
      winnerId: null,
    };
  }

  const activeTurn = getActiveTurn(game.fen);
  const elapsedMs = Math.max(
    0,
    Date.now() - new Date(game.lastMoveAt).getTime(),
  );

  if (elapsedMs <= 0) {
    return {
      whiteTimeMs: game.whiteTimeMs,
      blackTimeMs: game.blackTimeMs,
      lastMoveAt: game.lastMoveAt,
      timedOut: false,
      winnerId: null,
    };
  }

  if (activeTurn === "white") {
    const whiteTimeMs = Math.max(0, game.whiteTimeMs - elapsedMs);

    if (whiteTimeMs === 0) {
      return {
        whiteTimeMs: 0,
        blackTimeMs: game.blackTimeMs,
        lastMoveAt: new Date(),
        timedOut: true,
        winnerId: game.blackId,
      };
    }

    return {
      whiteTimeMs,
      blackTimeMs: game.blackTimeMs,
      lastMoveAt: new Date(),
      timedOut: false,
      winnerId: null,
    };
  }

  const blackTimeMs = Math.max(0, game.blackTimeMs - elapsedMs);

  if (blackTimeMs === 0) {
    return {
      whiteTimeMs: game.whiteTimeMs,
      blackTimeMs: 0,
      lastMoveAt: new Date(),
      timedOut: true,
      winnerId: game.whiteId,
    };
  }

  return {
    whiteTimeMs: game.whiteTimeMs,
    blackTimeMs,
    lastMoveAt: new Date(),
    timedOut: false,
    winnerId: null,
  };
}
