/**
 * invitation-retry.ts — WHEN THE GUEST'S ERROR SCREEN TRIES AGAIN BY ITSELF
 * (2026-10-13, guest-load fix). Pure: no React, no window — the boundary
 * (`app/[slug]/error.tsx`) hands it a store and the clock.
 *
 * 🧯 WHY. The free database stalls for 2–5 s about 33 times a day. A guest
 * page caught in one gives up at its read deadline (`lib/read-limit.ts`) and
 * the guest sees "This invitation didn't load". The stall is usually over a
 * couple of seconds later, so the boundary asks the server for the page ONE
 * more time on its own, AUTO_RETRY_DELAY_MS after it appears — while it says
 * "Still opening your invitation…", never a dead end.
 *
 * ⛔ ONCE PER PAGE PER AUTO_RETRY_WINDOW_MS. A page that fails again stays on
 * the honest error with its "Try again" button; it never refreshes itself in a
 * loop (each failed render mounts the boundary afresh, so the count lives in
 * sessionStorage — and in a module variable when storage throws, so a private
 * window still stops).
 */
export const AUTO_RETRY_DELAY_MS = 2_500;
export const AUTO_RETRY_WINDOW_MS = 60_000;

const KEY_PREFIX = 'setnayan.invite-retry:';

/** A sessionStorage-shaped store. Any of its calls may throw. */
export type RetryStore = Pick<Storage, 'getItem' | 'setItem'>;

const memory = new Map<string, number>();

function lastAutoRetry(store: RetryStore | null, page: string): number | null {
  let stored: number | null = null;
  try {
    const raw = store?.getItem(KEY_PREFIX + page);
    const at = raw ? Number(raw) : NaN;
    stored = Number.isFinite(at) ? at : null;
  } catch {
    /* storage refused — the module memory below still counts */
  }
  const remembered = memory.get(page) ?? null;
  if (stored === null) return remembered;
  if (remembered === null) return stored;
  return Math.max(stored, remembered);
}

/**
 * May this page retry by itself now? If yes, the retry is RECORDED before the
 * answer is returned, so a second boundary for the same page within the window
 * is told no.
 */
export function claimAutoRetry(store: RetryStore | null, page: string, now: number): boolean {
  const last = lastAutoRetry(store, page);
  if (last !== null && now - last < AUTO_RETRY_WINDOW_MS && now >= last) return false;
  memory.set(page, now);
  try {
    store?.setItem(KEY_PREFIX + page, String(now));
  } catch {
    /* memory already holds it */
  }
  return true;
}

/** TEST ONLY — forget the module memory (a fresh tab). */
export function forgetAutoRetriesForTest(): void {
  memory.clear();
}
