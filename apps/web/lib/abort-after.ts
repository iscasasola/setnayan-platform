/**
 * abort-after.ts — a browser request that gives up.
 *
 * `fetch` has no time limit of its own: on a phone whose signal has gone, or
 * against a server that never answers, it stays pending for as long as the
 * browser will hold the socket — minutes — and the screen says "Looking…" the
 * whole time. `abortAfter` arms a limit on the request's own AbortController
 * and remembers WHY it aborted, because the two aborts mean opposite things:
 *
 *   · the caller aborted it (a newer search replaced this one) → say nothing;
 *   · the limit ran out → it FAILED, and the screen must say so.
 *
 * Both reach the caller as the same `AbortError`; `ranOut()` tells them apart.
 *
 * (Not `AbortSignal.timeout()` + `AbortSignal.any()`: `any` is missing on
 * iPhones before iOS 17.4, and a guest's phone at a venue is exactly where
 * this runs. A timer on the controller the caller already has needs nothing.)
 *
 * Always `clear()` in a `finally` — after the body is read, not just after the
 * headers arrive: a response whose body stalls is the same hang.
 *
 * 🛡 lib/abort-after.test.ts
 */
export type AbortAfterDeps = {
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
};

export function abortAfter(ctrl: AbortController, limitMs: number, deps: AbortAfterDeps = {}) {
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  let ranOut = false;
  const id = setTimer(() => {
    ranOut = true;
    ctrl.abort();
  }, limitMs);
  return {
    /** True when THIS limit aborted the request (not the caller). */
    ranOut: () => ranOut,
    clear: () => clearTimer(id),
  };
}
