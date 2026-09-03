/**
 * Keyed timers. Deliberately knows nothing about games or the database — that
 * is what lets `finishGame` cancel a timer without importing the schedulers,
 * which would be a cycle.
 */
export class TimerStore {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  schedule(key: string, delayMs: number, onExpire: () => void): void {
    this.cancel(key);

    const timer = setTimeout(() => {
      this.timers.delete(key);
      onExpire();
    }, delayMs);

    // A pending timer must not keep the process alive on its own.
    timer.unref?.();
    this.timers.set(key, timer);
  }

  cancel(key: string): void {
    const timer = this.timers.get(key);

    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}

/** Flag-fall per game, keyed by game id. */
export const clockTimerStore = new TimerStore();

/** Abandonment grace per disconnected player, keyed by `gameId:userId`. */
export const abandonTimerStore = new TimerStore();
