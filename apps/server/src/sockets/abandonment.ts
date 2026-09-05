import { GameResult, GameStatus, prisma } from "@repo/db";
import { abandonTimerStore } from "./timer-store";
import { finishGame } from "./finish-game";
import { gameSocketManager } from "./game-socket";
import { withGameLock } from "./game-lock";

/**
 * How long a disconnected player has to come back before they forfeit. Fixed
 * rather than adaptive: the opponent's claim to the win depends on this
 * deadline, so it has to be the same every time and countable down in a UI.
 */
export const ABANDON_GRACE_MS = 60_000;

const key = (gameId: string, userId: string) => `${gameId}:${userId}`;

export function scheduleAbandonment(gameId: string, userId: string): void {
  abandonTimerStore.schedule(key(gameId, userId), ABANDON_GRACE_MS, () => {
    void abandonGame(gameId, userId).catch((error) => {
      console.error(`Error abandoning game ${gameId} for ${userId}`, error);
    });
  });
}

export function cancelAbandonment(gameId: string, userId: string): void {
  abandonTimerStore.cancel(key(gameId, userId));
}

/** Cancels the grace timers of both players, whoever they are. */
export function cancelGameAbandonment(game: {
  id: string;
  whiteId: string | null;
  blackId: string | null;
}): void {
  if (game.whiteId) cancelAbandonment(game.id, game.whiteId);
  if (game.blackId) cancelAbandonment(game.id, game.blackId);
}

/**
 * Re-checks everything before forfeiting: the grace period is long enough for
 * the game to have finished, or the player to have come back, since the socket
 * dropped.
 */
async function abandonGame(gameId: string, userId: string): Promise<void> {
  await withGameLock(gameId, async () => {
    const game = await prisma.game.findUnique({ where: { id: gameId } });

    if (!game) return;

    const isPlayer = userId === game.whiteId || userId === game.blackId;
    const inProgress =
      game.status === GameStatus.ACTIVE || game.status === GameStatus.PAUSED;

    if (!isPlayer || !inProgress) return;

    if (gameSocketManager.isUserInRoom(gameId, userId)) return;

    await finishGame({
      gameId,
      result: GameResult.ABANDONED,
      winnerId: userId === game.whiteId ? game.blackId : game.whiteId,
    });
  });
}
