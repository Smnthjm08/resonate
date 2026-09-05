/**
 * Serializes work on one game. Like `timer-store.ts` this deliberately knows
 * nothing about games or the database — it is a promise chain per key.
 *
 * Everything that mutates a game does read → decide → write across several
 * awaits, and the event loop is free to interleave another message at every
 * one of them. Without this, two `game:move` messages can both read the same
 * position, both pass the turn check and both commit.
 *
 * In-process only: a second server process would not be behind the same chain,
 * which is why the move transaction also guards on the FEN it read.
 */
const chains = new Map<string, Promise<unknown>>();

export function withGameLock<T>(
  gameId: string,
  task: () => Promise<T>,
): Promise<T> {
  const previous = chains.get(gameId) ?? Promise.resolve();

  // `task` runs whether the predecessor settled or threw — one handler failing
  // must not wedge the game.
  const run = previous.then(task, task);

  // The stored link swallows rejections so the next waiter is not rejected with
  // someone else's error; `run` keeps the real outcome for the caller.
  const chain = run.then(
    () => {},
    () => {},
  );

  chains.set(gameId, chain);

  void chain.then(() => {
    if (chains.get(gameId) === chain) chains.delete(gameId);
  });

  return run;
}
