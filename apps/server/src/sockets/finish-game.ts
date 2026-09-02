import { GameResult, GameStatus, prisma } from "@repo/db";
import { getActiveTurn } from "@repo/game-core";
import { drawOfferStore } from "./draw-offer-store";
import { gameEngineCache } from "./game-engine-cache";
import { gameSocketManager } from "./game-socket";

type FinishGameParams = {
  gameId: string;
  result: GameResult;
  /** Null for every drawn result. */
  winnerId: string | null;
  /**
   * Reconciled clock to persist alongside the result. Omit to leave the stored
   * times untouched — appropriate when the game ended on something other than
   * the clock and the times were already written.
   */
  clock?: {
    whiteTimeMs: number;
    blackTimeMs: number;
    lastMoveAt: Date | null;
  };
};

/**
 * The single way a game is ended from outside the move handler: persist the
 * terminal state, drop the now-dead in-memory state, and broadcast the result
 * to the room.
 *
 * Timeout, resignation and draw-by-agreement all land here; server-side clock
 * expiry and abandonment on disconnect are meant to as well.
 *
 * The move handler is deliberately *not* a caller — a checkmating move has to
 * write the move row and the terminal state in one transaction.
 */
export async function finishGame({
  gameId,
  result,
  winnerId,
  clock,
}: FinishGameParams) {
  const game = await prisma.game.update({
    where: { id: gameId },
    data: {
      status: GameStatus.FINISHED,
      result,
      winnerId,
      ...clock,
    },
  });

  gameEngineCache.evict(gameId);
  drawOfferStore.clear(gameId);

  gameSocketManager.broadcastGameState(gameId, {
    fen: game.fen,
    whiteId: game.whiteId,
    blackId: game.blackId,
    whiteTimeMs: game.whiteTimeMs,
    blackTimeMs: game.blackTimeMs,
    status: game.status,
    turn: getActiveTurn(game.fen),
    result: game.result,
    winnerId: game.winnerId,
  });

  return game;
}
