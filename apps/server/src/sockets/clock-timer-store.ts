/**
 * Pending flag-fall timers, one per game. Deliberately knows nothing about
 * games or the database: `clock-expiry.ts` owns that, and keeping this module
 * dependency-free is what lets `finishGame` cancel a timer without importing
 * the scheduler back.
 */
export class ClockTimerStore {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  schedule(gameId: string, delayMs: number, onExpire: () => void): void {
    this.cancel(gameId);

    const timer = setTimeout(() => {
      this.timers.delete(gameId);
      onExpire();
    }, delayMs);

    // A pending flag must not keep the process alive on its own.
    timer.unref?.();
    this.timers.set(gameId, timer);
  }

  cancel(gameId: string): void {
    const timer = this.timers.get(gameId);

    if (timer) {
      clearTimeout(timer);
      this.timers.delete(gameId);
    }
  }
}

export const clockTimerStore = new ClockTimerStore();
