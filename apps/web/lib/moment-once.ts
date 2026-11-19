/**
 * moment-once.ts — A RARE MOMENT PLAYS ONCE (MOTION_STANDARD_2026-11-18 § 4 #23: Celebrate "never twice per visit";
 * § 9 the signature moments: "once per visit", "once a day").
 *
 * ONE gate for every rare motion — Celebrate today, and the hook the signature moments (The Tie, Reply arrives, Day
 * turns …) take: ask `playsOnce(moment, key)` BEFORE drawing; `true` means "play it now, and I have remembered it".
 *
 *   · `'visit'` (the default) — once per browser visit: `sessionStorage`, plus a module set so a private window (no
 *     storage) still plays once per page load;
 *   · `'ever'` — once on this device: `localStorage` (a paid order's page opened again tomorrow stays still).
 *
 * It never throws and never blocks: with no storage at all the answer is still once per load.
 */
export type MomentScope = 'visit' | 'ever';

/** The moments that exist. `tie` is the booking's own signature moment — Celebrate never plays for a booking. */
export const MOMENTS = ['payment', 'badge', 'tour', 'tie', 'foil', 'go-live', 'reply', 'day-turns', 'capiz'] as const;
export type Moment = (typeof MOMENTS)[number];

/** The moments Celebrate may play for (#23: "Payment received, a badge earned. A booking uses The Tie."). */
export const CELEBRATE_MOMENTS = ['payment', 'badge', 'tour'] as const satisfies readonly Moment[];
export type CelebrateMoment = (typeof CELEBRATE_MOMENTS)[number];

const PREFIX = 'setnayan.moment.';
const played = new Set<string>();

export const momentKey = (moment: Moment, key: string): string => `${PREFIX}${moment}.${key}`;

function store(scope: MomentScope): Storage | null {
  try {
    return typeof window === 'undefined' ? null : scope === 'ever' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Has this moment already played (in this scope)? Reads only. */
export function hasPlayed(moment: Moment, key: string, scope: MomentScope = 'visit'): boolean {
  const k = momentKey(moment, key);
  if (played.has(k)) return true;
  try {
    return store(scope)?.getItem(k) != null;
  } catch {
    return false;
  }
}

/** `true` the FIRST time it is asked for this moment — and remembers it, so the second ask is `false`. */
export function playsOnce(moment: Moment, key: string, scope: MomentScope = 'visit'): boolean {
  if (typeof window === 'undefined') return false;
  if (hasPlayed(moment, key, scope)) return false;
  const k = momentKey(moment, key);
  played.add(k);
  try {
    store(scope)?.setItem(k, '1');
  } catch {
    /* no storage: the module set still holds it for this load */
  }
  return true;
}

/** Tests only: forget what this load has played. */
export function forgetMomentsForTest(): void {
  played.clear();
}
