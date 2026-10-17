/**
 * settleBurst — run `fn` ONCE after a burst of pokes has gone quiet.
 *
 * A live listener that re-asks the database on every event turns a burst of
 * events (a supplier pasting three replies, a bot answering) into a burst of
 * identical queries. Poking this instead asks once, `quietMs` after the last
 * event — the answer is the same, because it is asked after everything in the
 * burst has landed; only the repeats are gone.
 *
 * `cancel()` drops a pending run (call it from the effect's cleanup).
 */
export function settleBurst(
  fn: () => void,
  quietMs: number,
): { poke: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    poke() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, quietMs);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
