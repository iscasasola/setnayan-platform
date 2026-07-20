/**
 * Live Studio — the SETNAYAN overlay decision (owner-locked 2026-07-21).
 *
 * THE MODEL, in the owner's words: "while not paid, we will run setnayan logo on all screens"
 * and "pressing live. until then, we only promote setnayan."
 *
 * So the free tier is FULLY FUNCTIONAL — every camera pairs, multiview works, switching and
 * split work — but a full-screen SETNAYAN mark sits over every video surface. It is legible
 * enough to prove the rig works and useless as an actual broadcast. That is the whole product
 * idea: a couple will not gamble an unrepeatable wedding on software they have not seen work,
 * so they prove their entire rig FIRST and pay once they are happy. The overlay is the paywall.
 *
 * ONE INSTANT DOES BOTH THINGS:
 *
 *     press LIVE (on a paid event)  ──▶  overlay clears  AND  the 24-hour window opens
 *
 * Before that instant — paid or not — the overlay is on. There is no third state. Buying early
 * therefore costs a couple nothing: the clock does not start until they actually go live.
 *
 * ── The one rule that outranks the paywall ──────────────────────────────────────────────────
 * A wedding cannot be re-run. If the 24-hour window lapses while a broadcast is STILL RUNNING,
 * the overlay does NOT come back. Slamming a logo over a paying couple's ceremony because a
 * timer expired is the worst thing this feature could do, and it is strictly worse than letting
 * one broadcast run long. The window is enforced at the NEXT press-live, not mid-air. See
 * `expired-broadcasting` below.
 *
 * This module is PURE and server-time-driven. `now` is always passed in — never read a clock
 * here — because the operator's laptop clock is hostile and this decision is made server-side.
 */

/** Both device tiers unlock the same overlay-free broadcast. */
export const PANOOD_PAID_SKUS = ['PANOOD_SYSTEM', 'PANOOD_SYSTEM_MOBILE'] as const;

/** Hours of overlay-free broadcast granted by one unlock, measured from the FIRST press-live. */
export const PANOOD_WINDOW_HOURS = 24;

export type WatermarkReason =
  /** No paid unlock on this event. The free rig-verification tier — connect, test, see it work. */
  | 'unpaid'
  /** Paid, but they have not pressed live yet. "Until then, we only promote setnayan." */
  | 'awaiting-go-live'
  /** Paid and inside the 24h window. The only overlay-free state. */
  | 'window-open'
  /** Window lapsed but a broadcast is STILL RUNNING — we never interrupt it. Overlay stays off. */
  | 'expired-broadcasting'
  /** Window lapsed and nothing is on air. Back to overlay until they unlock again. */
  | 'expired';

export type WatermarkDecision = {
  /** True = draw the full-screen SETNAYAN overlay on every video surface. */
  overlay: boolean;
  reason: WatermarkReason;
  /** When the current window closes (ISO), or null when no window has opened. */
  expiresAt: string | null;
  /** Whole minutes left in the window; null when not applicable. Drives the "ending soon" nudge. */
  minutesRemaining: number | null;
};

export type WatermarkInput = {
  /** Does the event hold a paid Live Studio unlock (either device tier)? Server-resolved. */
  paid: boolean;
  /**
   * Timestamp of the FIRST press-live for this event, or null if never pressed. Anchored to the
   * first press so toggling live off and on again can never move, restart or extend the window.
   */
  firstLiveAt: string | Date | null;
  /** Is a broadcast on air right now (the persisted control-plane is_live flag)? */
  isLive: boolean;
  /** Server time. Always injected — the client clock is not trusted. */
  now: Date;
  /** Override for tests / a future tier. Defaults to the locked 24 hours. */
  windowHours?: number;
};

const MS_PER_HOUR = 3_600_000;

function toDate(v: string | Date | null): Date | null {
  if (v === null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The single source of truth for whether the SETNAYAN overlay is drawn.
 *
 * Every surface — control-room program monitor, source thumbnails, split composite, the OBS
 * pop-out, the camera operator's own view, venue screens — reads THIS decision, so no surface
 * can drift into being an unwatermarked hole in the paywall.
 *
 * FAILS CLOSED by construction: every path that is not an affirmative overlay-free state
 * returns `overlay: true`. An entitlement lookup that errors should pass `paid: false`, which
 * lands on 'unpaid' — the correct and safe default, and identical to what the couple already
 * sees before they buy, so a transient failure never changes what is on screen mid-setup.
 */
export function decideWatermark(input: WatermarkInput): WatermarkDecision {
  const { paid, isLive, now } = input;
  const windowHours = input.windowHours ?? PANOOD_WINDOW_HOURS;

  if (!paid) {
    return { overlay: true, reason: 'unpaid', expiresAt: null, minutesRemaining: null };
  }

  const firstLiveAt = toDate(input.firstLiveAt);
  if (!firstLiveAt) {
    // Paid but never gone live. The clock has not started — buying early is free.
    return { overlay: true, reason: 'awaiting-go-live', expiresAt: null, minutesRemaining: null };
  }

  const expires = new Date(firstLiveAt.getTime() + windowHours * MS_PER_HOUR);
  const expiresAt = expires.toISOString();
  const msLeft = expires.getTime() - now.getTime();

  if (msLeft > 0) {
    return {
      overlay: false,
      reason: 'window-open',
      expiresAt,
      minutesRemaining: Math.floor(msLeft / 60_000),
    };
  }

  // Window lapsed. If they are STILL ON AIR, let the broadcast finish clean — see the header.
  if (isLive) {
    return { overlay: false, reason: 'expired-broadcasting', expiresAt, minutesRemaining: 0 };
  }

  return { overlay: true, reason: 'expired', expiresAt, minutesRemaining: 0 };
}

/**
 * May this event start a NEW broadcast? This is where an expired window actually bites — at the
 * next press-live, never mid-air.
 */
export function canStartBroadcast(input: WatermarkInput): boolean {
  const d = decideWatermark({ ...input, isLive: false });
  return d.reason === 'window-open' || d.reason === 'awaiting-go-live';
}

/** Warn the operator before the window closes rather than surprising them. */
export const WINDOW_ENDING_SOON_MINUTES = 60;

export function isWindowEndingSoon(d: WatermarkDecision): boolean {
  return (
    d.reason === 'window-open' &&
    d.minutesRemaining !== null &&
    d.minutesRemaining <= WINDOW_ENDING_SOON_MINUTES
  );
}

/** Operator-facing copy. Kept beside the decision so states and wording cannot drift apart. */
export const WATERMARK_COPY: Record<WatermarkReason, { badge: string; detail: string }> = {
  unpaid: {
    badge: 'Preview',
    detail:
      'Connect every camera and test your whole setup free. Unlock Live Studio to broadcast without the Setnayan overlay.',
  },
  'awaiting-go-live': {
    badge: 'Ready',
    detail:
      'Unlocked. The overlay clears and your 24 hours begin the moment you press Go live — not before, so there is no rush.',
  },
  'window-open': { badge: 'Live window open', detail: 'Broadcasting without the overlay.' },
  'expired-broadcasting': {
    badge: 'Running long',
    detail:
      'Your 24 hours are up, but we will not interrupt a broadcast in progress. Finish the event — the overlay returns only after you stop.',
  },
  expired: {
    badge: 'Window closed',
    detail: 'Your 24-hour broadcast window has ended. Unlock again to broadcast without the overlay.',
  },
};
