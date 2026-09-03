import { GameResult, GameStatus, prisma } from "@repo/db";
import { type ClockGame, reconcileTurnClock, remainingMs } from "./clock";
import { clockTimerStore } from "./clock-timer-store";
import { finishGame } from "./finish-game";

type SchedulableGame = ClockGame & { id: string };

/**
 * Arms the flag-fall for whoever is on move. Call whenever a game starts, a
 * move lands, or a paused game resumes; `finishGame` and `game:pause` cancel.
 */
export function scheduleClockExpiry(game: SchedulableGame): void {
  const remaining = remainingMs(game);

  if (remaining === null) {
    clockTimerStore.cancel(game.id);
    return;
  }

  clockTimerStore.schedule(game.id, remaining, () => {
    void expireClock(game.id).catch((error) => {
      console.error(`Error expiring clock for game ${game.id}`, error);
    });
  });
}

/**
 * Re-reads the game before ending it: the timer was armed against a position
 * that may since have been moved in, paused, or finished some other way.
 */
async function expireClock(gameId: string): Promise<void> {
  const game = await prisma.game.findUnique({ where: { id: gameId } });

  if (!game || game.status !== GameStatus.ACTIVE) return;

  const clockState = reconcileTurnClock(game);

  if (!clockState.timedOut) {
    scheduleClockExpiry(game);
    return;
  }

  await finishGame({
    gameId,
    result: GameResult.TIMEOUT,
    winnerId: clockState.winnerId,
    clock: {
      whiteTimeMs: clockState.whiteTimeMs,
      blackTimeMs: clockState.blackTimeMs,
      lastMoveAt: clockState.lastMoveAt,
    },
  });
}

/**
 * Timers live in memory, so a restart drops every pending flag. Finishes the
 * games that expired while the process was down and re-arms the rest.
 */
export async function sweepExpiredGames(): Promise<void> {
  const games = await prisma.game.findMany({
    where: { status: GameStatus.ACTIVE, lastMoveAt: { not: null } },
  });

  for (const game of games) {
    const clockState = reconcileTurnClock(game);

    if (clockState.timedOut) {
      await finishGame({
        gameId: game.id,
        result: GameResult.TIMEOUT,
        winnerId: clockState.winnerId,
        clock: {
          whiteTimeMs: clockState.whiteTimeMs,
          blackTimeMs: clockState.blackTimeMs,
          lastMoveAt: clockState.lastMoveAt,
        },
      });
      continue;
    }

    scheduleClockExpiry(game);
  }

  if (games.length > 0) {
    console.log(`Clock sweep: reconciled ${games.length} active game(s)`);
  }
}
