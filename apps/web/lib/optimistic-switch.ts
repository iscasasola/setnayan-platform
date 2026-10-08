/**
 * 🔀 A SWITCH FLIPS FIRST, SAVES BEHIND (owner 2026-10-08, on the coordinator
 * switch: *"took 4 seconds to allow it to turn on. why so long?"*).
 *
 * The one order every switch on Event Details follows:
 *   1. `show(next)` — synchronously, before anything is awaited, so the switch
 *      moves on the tap itself (≤100 ms, the app's rule for a pick);
 *   2. `save()` — behind it;
 *   3. a refusal (`{ ok: false }` or a throw) puts the old position back with
 *      `show(!next)` and hands the reason to `fail`, to be shown in place.
 *
 * Pure (no React): the components call it, and the guard drives it with a save
 * that has not resolved yet to prove step 1 happens before step 2 ends.
 */
export type SaveResult = { ok: true } | { ok: false; error: string };

export async function flipOptimistic({
  next,
  show,
  save,
  fail,
  fallback = 'We couldn’t save that just now. Try again.',
}: {
  next: boolean;
  show: (on: boolean) => void;
  save: () => Promise<SaveResult | void>;
  fail: (reason: string) => void;
  fallback?: string;
}): Promise<boolean> {
  show(next);
  try {
    const res = await save();
    if (res && res.ok === false) {
      show(!next);
      fail(res.error || fallback);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[switch] save rejected', err);
    show(!next);
    fail(fallback);
    return false;
  }
}
