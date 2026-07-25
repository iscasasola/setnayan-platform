
/**
 * apps/web/lib/live-studio-window.ts
 *
 * ⭐ THE BROADCAST WINDOW — "ONE EVENT-DAY, EXTENDABLE, NEVER INTERRUPTED"
 * (owner-locked 2026-07-25 · Live_Studio_Unified_Spec_2026-07-25.md § 4f ②.)
 *
 * ── WHAT THIS IS ───────────────────────────────────────────────────────────────
 * ₱2,999 buys ONE EVENT-DAY of MULTI-CAMERA broadcasting. This module is the one
 * place that decides whether an event-day is currently running, when it ends, and
 * what happens when it lapses. It restores the per-day shape Cast (₱2,500/day) and
 * Roam (₱3,500/day) always had, which § 4d shipped by omission — more generous than
 * the owner intended.
 *
 * ── WHAT IT DOES *NOT* GATE, AND WHY THAT IS THE WHOLE DESIGN ──────────────────
 * It does NOT gate going live. The live /pricing page promises "Single-camera
 * livestream" FREE, and § 4f ① retires the full-screen watermark precisely so that
 * promise stops being hollow. A host whose event-day lapses therefore does not lose
 * their broadcast — they fall back to exactly the free tier: one camera, the
 * "POWERED BY SETNAYAN" bar, guests still watching. What lapses is the MULTI-CAM
 * unlock, nothing else.
 *
 * So "enforced at the NEXT go-live" means: the next go-live carries one camera, not
 * that the Go live button refuses. Blocking the button would break a published free
 * promise in order to sell an upgrade — selling against ourselves.
 *
 * ── 🔒 THE RULE THAT OUTRANKS THE PAYWALL ──────────────────────────────────────
 * A WEDDING CANNOT BE RE-RUN. If the window lapses while a broadcast is STILL
 * RUNNING, multi-cam KEEPS RUNNING (`expired-broadcasting`). Cutting a paying
 * couple's ceremony down to one camera because a timer expired is strictly worse
 * than letting one broadcast run long. Carried forward verbatim from the
 * 2026-07-21 model, whose single best rule this was.
 *
 * ── THE ANCHOR ─────────────────────────────────────────────────────────────────
 * FIRST GO-LIVE, not a calendar day: no timezone ambiguity, and buying early costs
 * the couple nothing (the clock does not start until they actually press live).
 * Persisted on the EXISTING write-once `panood_control_state.first_live_at`
 * (migration 20270829098323, immutable by DB trigger) — reused, not re-invented, so
 * there is exactly one "when did this event first go live" fact in the database.
 *
 * ── EXTENSION = ANOTHER ₱2,999, ON THE EXISTING RAIL ───────────────────────────
 * One price, no discount ladder (owner: "I just want 1 price"). An extra day is an
 * extra `orders` row for the SAME `LIVE_STUDIO` SKU, bought through the SAME inline
 * checkout drawer → GCash/BDO QR → /admin/payments. No new payment path, no new
 * table, no new state machine.
 *
 * THAT IS ALSO THE IDEMPOTENCY STORY, and it is why the count lives in `orders`:
 * a day exists only when an order reaches `paid`/`fulfilled`, and
 * `orders_insert_status_guard` / `orders_update_status_guard` (migration
 * 20270920010000) forbid a non-admin writer from putting an order into either
 * state. A replayed submit therefore creates another UNPAID order — visible to the
 * admin, worth zero days — and can never conjure a free extension. There is no
 * request in the system whose replay adds time.
 *
 * ── FAIL DIRECTIONS, CHOSEN DELIBERATELY ───────────────────────────────────────
 *   • Entitlement unknown → NOT owned → single camera. Fail CLOSED: a database
 *     blip must never give away a ₱2,999 multi-cam broadcast.
 *   • Owned but the anchor is unreadable → treat as `awaiting-go-live` → multi-cam
 *     ON. Fail OPEN, on purpose and only here: this branch is reachable only by a
 *     host who has ALREADY PAID, and punishing them for a data glitch on a day that
 *     cannot be redone is the worse error by a wide margin.
 *
 * PURE where it can be: the decision takes `now` as an argument and never reads a
 * clock, because the operator's laptop clock is hostile and this is decided
 * server-side. The async readers take a SupabaseClient as a parameter (the
 * lib/panood-control.ts convention) so this module imports nothing server-only and
 * stays runnable under `tsx --test`.
 */

/**
 * ⚠ THIS HALF IS DELIBERATELY IMPORT-FREE. Same posture as lib/panood-watermark.ts and
 * lib/live-studio-overlays.ts: the decision layer has ZERO runtime imports, so a `'use client'`
 * component (the controller's broadcast-window strip, which has to TICK through a ceremony to
 * catch the 1-hour and 12-hour crossings) can import it without dragging lib/entitlements.ts —
 * and its DB readers — into the browser bundle.
 *
 * The server readers live in lib/live-studio-window-server.ts, matching the repo's existing
 * `*-server.ts` split (coordinator-broadcasts-server, setnayan-ai-server).
 */

/** Hours of MULTI-CAM broadcasting granted by ONE purchased event-day. */
export const LIVE_STUDIO_DAY_HOURS = 24;

/** Warn the host — and offer another day — this many minutes before the window closes. */
export const WINDOW_WARN_MINUTES = 60;

/**
 * ⚠ YOUTUBE ARCHIVES ONLY THE FIRST 12 HOURS OF A STREAM (verified 2026-07-25 ·
 * § 4f ③). YouTube does NOT cap stream DURATION — 24/7 is allowed — but a stream
 * that runs past 12 hours may leave NO REPLAY AT ALL. For an unrepeatable wedding
 * feeding the Alaala handover, silently losing the recording is the sharp edge,
 * sharper than any paywall. (The owner's recalled "6 hours" is not the limit.)
 *
 * This is a WARNING, never a cutoff. Setnayan does not carry the video — the host's
 * own encoder streams to the host's own YouTube — so there is nothing here to stop
 * even if stopping were the right answer, and it is not.
 */
export const YOUTUBE_ARCHIVE_HOURS = 12;

/** Start warning about the archive limit this many hours in — two hours of runway. */
export const ARCHIVE_WARN_AT_HOURS = 10;

const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE = 60_000;

export type WindowReason =
  /** No paid unlock (and no grant). The free tier — one camera, always available. */
  | 'not-owned'
  /**
   * Owned through a route that was never denominated in DAYS — an admin comp grant,
   * a §10a internal event, a founder seat, or a live promo free-window. There are no
   * day-orders to count, so there is no clock: metering a grant nobody sold by the
   * day would be inventing a limit out of thin air.
   */
  | 'unmetered'
  /** Days bought, never gone live. The clock has not started — buying early is free. */
  | 'awaiting-go-live'
  /** Inside the window. The normal paid state. */
  | 'open'
  /** 🔒 Lapsed but STILL ON AIR — we never interrupt. Multi-cam stays on. */
  | 'expired-broadcasting'
  /** Lapsed and off air. The next go-live carries one camera until they add a day. */
  | 'expired';

export type WindowDecision = {
  /** May this event broadcast MORE THAN ONE camera right now? The one output. */
  multiCam: boolean;
  reason: WindowReason;
  /** Event-days actually purchased (paid/fulfilled orders). 0 for free and for grants. */
  days: number;
  /** When the current window closes (ISO), or null when no clock is running. */
  expiresAt: string | null;
  /** Whole minutes left; null when not applicable. Negative is clamped to 0. */
  minutesRemaining: number | null;
  /** ≤ WINDOW_WARN_MINUTES left — warn the host and offer another day. */
  endingSoon: boolean;
  /** True only in `expired-broadcasting`: multi-cam survives ONLY by the never-interrupt rule. */
  runningLong: boolean;
};

export type WindowInput = {
  /** Server-resolved LIVE_STUDIO entitlement (any route: order, bundle, grant, promo). */
  owned: boolean;
  /** How many event-DAYS were purchased. See `fetchBroadcastDayStarts`. */
  dayStarts: readonly (string | Date)[];
  /** First press-live for this event, or null if never. */
  firstLiveAt: string | Date | null;
  /** Is a broadcast on air right now? Drives the never-interrupt rule. */
  isLive: boolean;
  /**
   * When the CURRENT broadcast started. This is what BOUNDS the never-interrupt
   * rule, and the bound is the difference between honouring an owner lock and
   * shipping a free multi-cam broadcast.
   *
   * The rule protects a broadcast ALREADY IN PROGRESS when the window lapsed. It
   * does not protect a broadcast STARTED AFTER it lapsed — that is a NEW go-live,
   * which is precisely where the owner said to enforce ("at the NEXT go-live"). With
   * `isLive` alone, a host could let their day expire, press Go live again, and be
   * handed unlimited multi-cam for as long as they never pressed stop.
   *
   * Null while a broadcast IS live degrades to PROTECTED, not to a cutoff: an
   * unreadable start time must never be the reason a ceremony loses its cameras.
   */
  broadcastStartedAt?: string | Date | null;
  /** Server time. Always injected — the client clock is not trusted. */
  now: Date;
  /** Override for tests. Defaults to the locked 24 hours. */
  dayHours?: number;
};

function toDate(v: string | Date | null | undefined): Date | null {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Where the window ends, given the anchor and when each purchased day was bought.
 *
 * A "hotel nights" fold: days stack contiguously from the anchor, and a day bought
 * while NO window is open starts at its own purchase instead of retro-expiring.
 *
 *     cursor = firstLiveAt
 *     for each day (oldest purchase first):
 *       cursor = max(cursor, boughtAt) + 24h
 *
 * WHY max(). Two cases have to work and a plain `anchor + days × 24h` only gets one:
 *   • Bought BEFORE going live (the normal case, including the original purchase and
 *     an extension bought during the show): `boughtAt < cursor`, so the day stacks
 *     contiguously and buying early costs the couple nothing. ✓
 *   • Bought long AFTER the window lapsed (a second celebration on the same event
 *     record): plain arithmetic would hand them a day that expired weeks ago — they
 *     would pay ₱2,999 for nothing. max() starts it at the purchase instead. ✓
 *
 * `boughtAt` is `orders.created_at`, not the approval time: it is stable, it never
 * moves, and it is EARLIER — which can only make a day stack contiguously rather
 * than start late. The generous read of an ambiguous timestamp.
 */
export function foldWindowEnd(
  firstLiveAt: Date,
  dayStarts: readonly (string | Date)[],
  dayHours: number,
): Date {
  const starts = dayStarts
    .map(toDate)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  let cursor = firstLiveAt.getTime();
  for (const bought of starts) {
    cursor = Math.max(cursor, bought.getTime()) + dayHours * MS_PER_HOUR;
  }
  return new Date(cursor);
}

/**
 * THE decision — may this event broadcast multi-cam right now, and how long for?
 *
 * Pure and total: every branch returns a nameable state, so no surface has to guess
 * what a missing field meant.
 */
export function decideBroadcastWindow(input: WindowInput): WindowDecision {
  const { owned, isLive, now } = input;
  const dayHours = input.dayHours ?? LIVE_STUDIO_DAY_HOURS;
  const days = input.dayStarts.filter((d) => toDate(d) !== null).length;

  const closed = (reason: WindowReason, expiresAt: string | null): WindowDecision => ({
    multiCam: false,
    reason,
    days,
    expiresAt,
    minutesRemaining: expiresAt ? 0 : null,
    endingSoon: false,
    runningLong: false,
  });

  // FAIL CLOSED. No unlock resolved (including any lookup that errored into false)
  // → the free tier, which is a real working product, not a punishment.
  if (!owned) return closed('not-owned', null);

  // Owned with zero day-orders = a grant, not a purchase (comp / internal / founder
  // seat / promo window). Nothing was sold by the day, so nothing is metered by it.
  if (days === 0) {
    return {
      multiCam: true,
      reason: 'unmetered',
      days: 0,
      expiresAt: null,
      minutesRemaining: null,
      endingSoon: false,
      runningLong: false,
    };
  }

  const firstLiveAt = toDate(input.firstLiveAt);
  if (!firstLiveAt) {
    // Paid, never pressed live. The clock has not started — and an UNREADABLE anchor
    // lands here too, which is the deliberate fail-OPEN for a host who already paid.
    return {
      multiCam: true,
      reason: 'awaiting-go-live',
      days,
      expiresAt: null,
      minutesRemaining: null,
      endingSoon: false,
      runningLong: false,
    };
  }

  const expires = foldWindowEnd(firstLiveAt, input.dayStarts, dayHours);
  const expiresAt = expires.toISOString();
  const msLeft = expires.getTime() - now.getTime();

  if (msLeft > 0) {
    const minutesRemaining = Math.floor(msLeft / MS_PER_MINUTE);
    return {
      multiCam: true,
      reason: 'open',
      days,
      expiresAt,
      minutesRemaining,
      endingSoon: minutesRemaining <= WINDOW_WARN_MINUTES,
      runningLong: false,
    };
  }

  // 🔒 Lapsed. If a broadcast that STARTED INSIDE the window is still on air, it
  // finishes clean — see the header and `broadcastStartedAt`. A broadcast that
  // started AFTER the window closed is a new go-live and gets no protection.
  if (isLive) {
    const startedAt = toDate(input.broadcastStartedAt);
    const startedInsideWindow = !startedAt || startedAt.getTime() < expires.getTime();
    if (startedInsideWindow) {
      return {
        multiCam: true,
        reason: 'expired-broadcasting',
        days,
        expiresAt,
        minutesRemaining: 0,
        endingSoon: false,
        runningLong: true,
      };
    }
  }

  // Lapsed, off air. Back to the free tier — one camera, still broadcasting.
  return closed('expired', expiresAt);
}

/* ══════════════════════════════════════════════════════════════════════════════
   THE SAME DECISION, FOR A SURFACE THAT HAS TO TICK
   ══════════════════════════════════════════════════════════════════════════════ */

export type WindowPhase =
  /** No clock is running (free tier, unmetered grant, or not yet live). Say nothing. */
  | 'none'
  /** Plenty of time left. Say nothing. */
  | 'open'
  /** ≤ WINDOW_WARN_MINUTES left — warn, and offer another day. */
  | 'ending-soon'
  /** 🔒 Past the end but STILL ON AIR — reassure, never interrupt. */
  | 'running-long'
  /** Past the end and off air — the next go-live is the free single camera. */
  | 'ended';

/**
 * The window's phase from the END TIMESTAMP alone.
 *
 * Exists so the controller's strip can re-evaluate on a timer through a ceremony
 * nobody is going to refresh: the 1-hour warning and the "we will not cut you off"
 * reassurance are both TIME CROSSINGS, and a warning that waits for the next
 * navigation is not a warning.
 *
 * ⚠ DISPLAY ONLY. It reads a clock the browser owns, so it may never gate anything;
 * `decideBroadcastWindow` (server, injected `now`) is the entitlement. The two agree
 * by construction — same threshold, same never-interrupt branch — and a unit test
 * holds them to it.
 */
export function windowPhaseAt(
  expiresAt: string | null,
  now: Date,
  isLive: boolean,
  warnMinutes: number = WINDOW_WARN_MINUTES,
): WindowPhase {
  const expires = toDate(expiresAt);
  if (!expires) return 'none';
  const msLeft = expires.getTime() - now.getTime();
  if (msLeft > 0) {
    return Math.floor(msLeft / MS_PER_MINUTE) <= warnMinutes ? 'ending-soon' : 'open';
  }
  return isLive ? 'running-long' : 'ended';
}

/* ══════════════════════════════════════════════════════════════════════════════
   THE 12-HOUR ARCHIVE GUARDRAIL (§ 4f ③) — a warning, never a cutoff
   ══════════════════════════════════════════════════════════════════════════════ */

export type ArchiveGuard = {
  /** Whole hours this broadcast has been running. Null when nothing is on air. */
  hoursElapsed: number | null;
  /** Whole hours of recordable time left before the 12-hour archive cap. Clamped at 0. */
  hoursToCap: number | null;
  /** Approaching the cap — tell the host while they can still act on it. */
  warn: boolean;
  /** Past 12 hours: everything from here may not appear in the replay at all. */
  exceeded: boolean;
};

const NO_ARCHIVE_GUARD: ArchiveGuard = {
  hoursElapsed: null,
  hoursToCap: null,
  warn: false,
  exceeded: false,
};

/**
 * How close is this broadcast to YouTube's 12-hour ARCHIVE limit?
 *
 * Measured from THIS broadcast's start, not from the window anchor: the cap is
 * per-stream, so a host who ended one broadcast and started another gets a fresh 12
 * hours — and telling them otherwise would push them to stop a stream they did not
 * need to stop.
 */
export function decideArchiveGuard(input: {
  /** When the CURRENT broadcast started (went_live_at ?? scheduled_start_at). */
  startedAt: string | Date | null;
  isLive: boolean;
  now: Date;
  capHours?: number;
  warnAtHours?: number;
}): ArchiveGuard {
  if (!input.isLive) return NO_ARCHIVE_GUARD;
  const startedAt = toDate(input.startedAt);
  if (!startedAt) return NO_ARCHIVE_GUARD;

  const capHours = input.capHours ?? YOUTUBE_ARCHIVE_HOURS;
  const warnAtHours = input.warnAtHours ?? ARCHIVE_WARN_AT_HOURS;

  const elapsedMs = input.now.getTime() - startedAt.getTime();
  // A start stamped in the future (clock skew between YouTube and us) is not a
  // 0-hour broadcast running backwards — it is "just started".
  const hoursElapsed = Math.max(0, Math.floor(elapsedMs / MS_PER_HOUR));

  return {
    hoursElapsed,
    hoursToCap: Math.max(0, capHours - hoursElapsed),
    warn: hoursElapsed >= warnAtHours,
    exceeded: hoursElapsed >= capHours,
  };
}

/* ══════════════════════════════════════════════════════════════════════════════
   HOST-FACING COPY
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * The extension CTA's label, shared by the drawer's `displayName` (which becomes the
 * order description the admin reconciles against) and its trigger button, so the
 * thing the host clicked and the thing /admin/payments shows are the same words.
 *
 * ⚠ NO `WINDOW_COPY` MAP HERE. A per-reason copy table was drafted and deleted: the
 * controller's strip is the only surface that speaks these states and it needs the
 * sentences inline (each carries its own purchase control and its own emphasis). A
 * second, unread copy of every string — under a comment claiming the two "cannot
 * drift" — is exactly how they drift.
 */
export const ADD_A_DAY_LABEL = 'Add another day';
