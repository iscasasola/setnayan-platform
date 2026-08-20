/**
 * moment-handoff.ts — carrying what a YEAR MOMENT already knows across the
 * Year → create-event → onboarding hop.
 *
 * A row on /dashboard/year is derived from facts the account already holds, so
 * by the time somebody taps "Start planning" on "Your birthday — turning 40" we
 * know two of the answers the wizard is about to ask for: WHEN it falls, and
 * that it is for THEM. Owner, 2026-08-20: "when we create, we already know that
 * it is for me and this is a specific time of event, so these information don't
 * need to be filled."
 *
 * The event TYPE is not carried here — it rides in the URL as `?event_type=`,
 * because it is not personal data and the create page already validates and
 * consumes it (the QR fast-lane uses the same param).
 *
 * ⚠ WHY NOT A QUERY PARAM FOR THE REST: the date is somebody's birthday, which
 * is personal information under RA 10173. A URL lands in browser history, in
 * the Referer header of every subsequent request, and in access logs. So it
 * rides in sessionStorage instead: same tab, same origin, never transmitted —
 * the identical rule and the identical mechanism as `honoree-handoff.ts`, whose
 * TTL and single-read semantics this module deliberately mirrors rather than
 * inventing a second set.
 *
 * Deliberately fragile in the safe direction — READ ONCE, short TTL — so a date
 * can never resurface in an unrelated onboarding an hour later. Every failure
 * mode (no window, private mode, quota, corrupt JSON) degrades to "no carry",
 * i.e. the wizard asks, exactly as it does today.
 */

import { HONOREE_HANDOFF_TTL_MS, isHandoffFresh } from './honoree-handoff';

const KEY = 'setnayan_year_moment_v1';

/** One window for both carries — they cross the same hop, together. */
export const MOMENT_HANDOFF_TTL_MS = HONOREE_HANDOFF_TTL_MS;

export type MomentCarry = {
  /**
   * The day the moment falls on (plain YYYY-MM-DD, Manila civil day) — the
   * suggested CELEBRATION day, not an anchor. A birthday's anchor is the birth
   * date; this is the next time it comes round, which is what the wizard's
   * "when is it?" is actually asking.
   */
  celebrationISO: string | null;
  /**
   * TRUE when the moment is the account holder's own (their birthday off their
   * own profile). The wizard then states the celebrant instead of asking —
   * blank honoree has always meant "the account holder", so there is nothing to
   * prefill, only a question to stop asking.
   */
  forSelf: boolean;
};

/** A plain civil day. Anything else is dropped rather than coerced into a date. */
function isCivilDay(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/**
 * Stash what the tapped moment knows. A carry with NOTHING in it (no usable
 * date and not self-owned) clears instead of storing an empty shell — an empty
 * carry would consume the single read and tell the wizard nothing.
 */
export function stashMoment(carry: MomentCarry): void {
  if (typeof window === 'undefined') return;
  const iso = isCivilDay(carry.celebrationISO) ? carry.celebrationISO : null;
  const forSelf = carry.forSelf === true;
  try {
    if (!iso && !forSelf) {
      window.sessionStorage.removeItem(KEY);
      return;
    }
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({ ...(iso ? { c: iso } : {}), ...(forSelf ? { s: 1 } : {}), t: Date.now() }),
    );
  } catch {
    /* private mode / quota — the wizard simply asks */
  }
}

/**
 * Read AND consume the stash. Returns null when absent, stale, or unreadable —
 * never a partial value, never twice. A malformed date is dropped on its own
 * (the `forSelf` half still crosses), so a bad day never becomes a wrong one.
 */
export function takeMoment(): MomentCarry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as { c?: unknown; s?: unknown; t?: unknown };
    if (!isHandoffFresh(parsed?.t, Date.now())) return null;
    const celebrationISO = isCivilDay(parsed?.c) ? parsed.c : null;
    const forSelf = parsed?.s === 1;
    if (!celebrationISO && !forSelf) return null;
    return { celebrationISO, forSelf };
  } catch {
    return null;
  }
}
