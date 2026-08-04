/**
 * 🚫 RETIRED 2026-07-25 — the full-screen SETNAYAN overlay is NO LONGER DRAWN
 *    (owner-locked · Live_Studio_Unified_Spec_2026-07-25.md § 4f ①, reversing the
 *    2026-07-21 lock this module was written under).
 *
 * OWNER'S REASON, in their words: *"yes we have a free single camera."* A free host really does
 * broadcast one camera — the live /pricing page promises "Single-camera livestream" free — so a
 * full-screen mark sitting over it makes that published promise hollow. **The free tier's branding
 * is now the "POWERED BY SETNAYAN" LOWER THIRD** (Wave 2 · lib/live-studio-overlays.ts →
 * resolveOverlays), which is derived from the entitlement and never stored, so there is no setting
 * a free host can flip and no request to replay.
 *
 * ── HOW IT IS RETIRED, AND WHY THE MODULE IS STILL HERE ─────────────────────────────────────
 * `decideWatermark` returns `overlay: false` for `retired`, ahead of every other branch. Because
 * every surface reads THIS one decision (see the note on `decideWatermark`), that single branch
 * retires all three render sites at once: the legacy control room's program monitor, its source
 * thumbnails, and the OBS pop-out (which receives `overlay` over the program bridge). Nothing in
 * the render tree had to change.
 *
 * The module is NOT deleted, and that is deliberate. Two live things import it:
 *   • lib/entitlements.ts reads `PANOOD_PAID_SKUS` for Wave 6's grandfather alias
 *     (LIVE_STUDIO ← PANOOD_SYSTEM · PANOOD_SYSTEM_MOBILE), and
 *   • lib/panood-program-bridge.ts types its frame on `WatermarkReason`.
 * Ripping the module out would drag the Cast-buyer grandfather clause into a watermark change.
 *
 * ── WHY `retired` IS AN INPUT AND NOT A HARDCODED `return false` ────────────────────────────
 * Callers pass `liveStudioRoamEnabled()`. Flag OFF, the legacy Cast control room is LIVE AND
 * SELLING `PANOOD_SYSTEM` (₱2,500) and this overlay is its ONLY paywall — retiring it
 * unconditionally would hand every free host an unwatermarked multi-camera broadcast the moment it
 * shipped, weeks before the replacement paywall (Wave 5's program-source reduction,
 * lib/live-studio-publish.ts → decideProgramAir) is even reachable. That is the same reasoning
 * § 4e gives for not retiring the SKU while the new product is dark. Flag ON, Wave 6 already
 * redirects that room away, so this branch is the STATED decision standing behind what would
 * otherwise be an accident of routing — and it survives the redirect being changed, the legacy
 * code being deleted piecemeal, or a future publisher re-wiring `watermark.overlay`.
 *
 * ── WHAT REPLACED THE 24-HOUR WINDOW ───────────────────────────────────────────────────────
 * lib/live-studio-window.ts. Same best rule (never interrupt a running broadcast), same anchor
 * (`panood_control_state.first_live_at`, reused not re-invented), but it gates MULTI-CAM rather
 * than an overlay, it is EXTENDABLE (another ₱2,999 = another event-day), and it bounds the
 * never-interrupt grace to the broadcast that was already running. `PANOOD_WINDOW_HOURS` below is
 * the retired 24h constant and is superseded by `LIVE_STUDIO_DAY_HOURS` there.
 *
 * ═══ Everything below this line is the ORIGINAL 2026-07-21 model, kept because the flag-off path
 *     still runs it verbatim. ═══
 *
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
  /**
   * 🚫 THE OVERLAY IS RETIRED for this request (owner 2026-07-25 · § 4f ①). Terminal and
   * unconditional: no other input is consulted, and the only decision it can produce is
   * `overlay: false`. Free-tier branding is the "POWERED BY SETNAYAN" lower third instead.
   */
  | 'retired'
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
  /**
   * 🚫 RETIRE the full-screen overlay for this request (owner 2026-07-25 · § 4f ①).
   *
   * Callers pass `liveStudioRoamEnabled()`. Defaults to `false` so every existing caller and test
   * keeps the 2026-07-21 behaviour untouched, and the retirement is opt-in per surface rather than
   * a silent global flip — see the module header for why that matters while the legacy Cast room
   * is still selling.
   */
  retired?: boolean;
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

  // 🚫 RETIRED (owner 2026-07-25 · § 4f ①). FIRST branch, ahead of everything: the overlay is not
  // a thing this product draws any more, so no other input can bring it back — not `paid: false`,
  // not an expired window, not a missing anchor. Since every video surface reads this one
  // decision, this is the whole retirement. Free-tier branding is the "POWERED BY SETNAYAN" lower
  // third (lib/live-studio-overlays.ts), resolved from the entitlement on the surface that
  // actually reaches air.
  //
  // No window is reported either: `expiresAt`/`minutesRemaining` are null because the 24-hour
  // window this module owned is superseded by lib/live-studio-window.ts. Returning a stale
  // countdown here would give a caller something plausible-looking to read.
  if (input.retired) {
    return { overlay: false, reason: 'retired', expiresAt: null, minutesRemaining: null };
  }

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
  // 🚫 RETIRED with the overlay it belonged to. This gate existed ONLY to stop a free host
  // starting a broadcast the overlay would have ruined; with the overlay retired there is nothing
  // for it to protect, and leaving it armed would be an invisible refusal to go live with no
  // paywall behind it. The broadcast-day rule that replaces it gates MULTI-CAM, never go-live
  // (lib/live-studio-window.ts) — because the /pricing page promises a free single-camera stream.
  if (input.retired) return true;

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
  // Required, not decorative: control-room.tsx indexes this Record by the resolved reason, so a
  // missing key is a runtime `undefined.badge`. It renders only if a caller shows the badge strip
  // on a retired decision — the copy says nothing about an overlay, because there isn't one.
  retired: {
    badge: 'Live Studio',
    detail:
      'A free broadcast carries the “Powered by Setnayan” bar. Unlock Live Studio to put all your cameras on air with your own monogram and lower third.',
  },
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
