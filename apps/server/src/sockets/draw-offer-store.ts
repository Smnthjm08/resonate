/**
 * Pending draw offers, keyed by game id, holding the id of the player who
 * offered. In-memory like the room and engine state next to it: an offer that
 * does not survive a restart costs a player one click, so it is not worth a
 * column on `Game`.
 *
 * At most one offer can stand per game — an offer is cleared when it is
 * accepted or declined, when either side moves, and when the game ends.
 */
export class DrawOfferStore {
  private readonly offers = new Map<string, string>();

  /** The user id of the player with a pending offer, if any. */
  get(gameId: string): string | undefined {
    return this.offers.get(gameId);
  }

  set(gameId: string, userId: string): void {
    this.offers.set(gameId, userId);
  }

  clear(gameId: string): void {
    this.offers.delete(gameId);
  }
}

export const drawOfferStore = new DrawOfferStore();
