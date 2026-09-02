
/**
 * apps/web/lib/live-studio-window.ts
 *
 * ⭐ THE BROADCAST WINDOW — "ONE EVENT-DAY, EXTENDABLE, NEVER INTERRUPTED"
 * (owner-locked 2026-07-25 · Live_Studio_Unified_Spec_2026-07-25.md § 4f ②.)
 *
 * ── WHAT THIS IS ───────────────────────────────────────────────────────────────
 * ₱3,000 buys ONE EVENT-DAY of MULTI-CAMERA broadcasting. This module is the one
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
 * ── EXTENSION = ANOTHER ₱3,000, ON THE EXISTING RAIL ───────────────────────────
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
 *     blip must never give away a ₱3,000 multi-cam broadcast.
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

/* ══════════════════════════════════════════════════════════════════════════════
   ⭐ GRANT KINDS — WHICH FREE UNLOCKS ARE METERED (owner-locked 2026-07-26)
   ══════════════════════════════════════════════════════════════════════════════

   Wave 7 shipped ONE rule for every non-purchase unlock: owned with zero day-orders
   → `unmetered`, unlimited broadcast days, forever. The owner reviewed that and split
   it, because the four routes are not the same promise:

     • FOUNDER — a row in `founder_seats` (owner-granted, cap 10). The seat IS
       "permanent free access to all services". Metering it would contradict the
       grant itself.                                                     → UNMETERED
     • COMP — an admin deliberately gifted this SKU to this account. Someone made a
       decision and can revoke it.                                       → UNMETERED
     • INTERNAL — a §10a staff/team account. `is_internal` exists so showcase and
       demo events RENDER fully; it was never a promise of unlimited broadcast days,
       and staff accounts are numerous and self-assignable in a way founder seats are
       not. Staff get the same one-event-day clock a paying customer gets.  → METERED
     • PROMO — a marketing free-window giveaway of the SKU. The giveaway is ONE
       event-day, exactly what ₱3,000 buys; a promo that quietly conferred unlimited
       days would be a different, much larger offer than the one advertised. → METERED

   ⚠ ORDER MATTERS AND IT IS NOT ALPHABETICAL. A founder account is very likely ALSO
   `is_internal` (the owner's own account is both). Founder is therefore resolved
   FIRST — see `resolveLiveStudioGrantKind` in lib/live-studio-window-server.ts — so
   the internal rule can never demote a founder, and the founder rule can never
   promote a plain staff account.

   ⚠ FAIL-CLOSED. This is money. Only kinds explicitly listed below are unmetered;
   everything else — 'unknown', a route nobody has named yet, a resolver that errored,
   an omitted field — is METERED. A new grant route added later is metered until
   someone deliberately adds it here, which is the safe direction: the failure mode is
   "a grant holder is asked to add a day", not "a ₱3,000 product is given away". */

/** How a zero-day-order event came to own Live Studio. Resolved server-side. */
export type GrantKind =
  /** Row in `founder_seats` — permanent free access to every service. */
  | 'founder'
  /** Admin-issued comp grant covering LIVE_STUDIO (all_services or scoped). */
  | 'comp'
  /** §10a internal/staff-hosted event (`is_internal`). */
  | 'internal'
  /** A live admin promo free-window covering LIVE_STUDIO. */
  | 'promo'
  /** Owned, but through no route this module recognises. Always metered. */
  | 'unknown';

/**
 * The ALLOWLIST — the only grant kinds that broadcast without a clock.
 * Everything absent from this set is metered. See the block comment above.
 */
export const UNMETERED_GRANT_KINDS: ReadonlySet<GrantKind> = new Set<GrantKind>([
  'founder',
  'comp',
]);

/**
 * Does this grant broadcast unmetered? Fail-closed by construction: null, undefined
 * and any unrecognised value answer `false` (= metered), so a caller that forgets to
 * resolve the kind gets the paying-customer clock rather than a free product.
 */
export function grantIsUnmetered(kind: GrantKind | null | undefined): boolean {
  return kind != null && UNMETERED_GRANT_KINDS.has(kind);
}

/** The four overlapping signals a zero-day-order event can carry at once. */
export type GrantSignals = {
  /** Row in `founder_seats` for a host of this event. */
  founder: boolean;
  /** Active admin comp grant covering LIVE_STUDIO for a host of this event. */
  comp: boolean;
  /** §10a `is_internal` host. */
  internal: boolean;
  /** A live promo free-window covering LIVE_STUDIO right now. */
  promo: boolean;
};

/**
 * PRECEDENCE — the owner's 2026-07-26 ruling, written as code.
 *
 * PURE and separate from the reads on purpose: the signals OVERLAP (the owner's own
 * account is a founder seat AND `is_internal`; a promo window is global, so it is
 * live for founder and staff accounts alike), and "which one wins" is the entire
 * correctness question. Keeping it here means all sixteen combinations are testable
 * without a database, and the server reader (resolveLiveStudioGrantKind) shrinks to
 * "gather four booleans".
 *
 *   1. founder   UNMETERED — owner-granted seat = all services, free, permanently.
 *   2. comp      UNMETERED — an admin deliberately gave this away.
 *   3. internal  METERED   — staff/showcase account; `is_internal` was never a
 *                            promise of unlimited broadcast days.
 *   4. promo     METERED   — a marketing giveaway of ONE event-day.
 *   5. unknown   METERED   — owned via a route nobody named. Fail-closed.
 *
 * What is LOAD-BEARING is that the unmetered pair is tested BEFORE the metered pair:
 * a founder who is also internal must read 'founder', or the one account the owner
 * said must never be metered gets metered. (Within each pair the order is arbitrary —
 * both members reach the same metering answer.)
 */
export function classifyGrant(signals: GrantSignals): GrantKind {
  if (signals.founder) return 'founder';
  if (signals.comp) return 'comp';
  if (signals.internal) return 'internal';
  if (signals.promo) return 'promo';
  return 'unknown';
}

export type WindowReason =
  /** No paid unlock (and no grant). The free tier — one camera, always available. */
  | 'not-owned'
  /**
   * Owned through a grant that is NOT denominated in days AND is on the unmetered
   * allowlist — a founder seat or an admin comp grant. There are no day-orders to
   * count and none are implied, so there is no clock.
   *
   * ⚠ An INTERNAL or PROMO grant does NOT land here (owner-locked 2026-07-26). It
   * gets exactly one event-day, metered from first go-live, and therefore reports
   * the ordinary `awaiting-go-live` / `open` / `expired` reasons like any purchase.
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
  /**
   * Event-days the window is actually running on — purchased days, or the single
   * day a METERED grant (internal / promo) confers. Distinct from `days` so the
   * "how much did they pay for" fact stays honest while the clock is correct.
   * 0 whenever no clock is running (free tier, unmetered grant).
   */
  meteredDays: number;
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
  /**
   * HOW this event owns Live Studio when it holds ZERO day-orders — the founder /
   * comp / internal / promo split (owner-locked 2026-07-26). Read only on that
   * branch; irrelevant once a day has been bought, because a purchase is metered
   * regardless of who the buyer is.
   *
   * OPTIONAL, and omitting it is SAFE: `grantIsUnmetered(undefined)` is false, so a
   * caller that does not resolve the kind gets the metered one-event-day window, not
   * a free unlimited one.
   */
  grantKind?: GrantKind | null;
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
 *     would pay ₱3,000 for nothing. max() starts it at the purchase instead. ✓
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

  // A METERED grant (internal / promo / unknown) is worth exactly ONE event-day —
  // the same thing ₱3,000 buys. `days` keeps meaning "days actually purchased"; this
  // is what the clock runs on.
  const grantedDay = days === 0;
  const meteredDays = grantedDay ? 1 : days;

  const closed = (reason: WindowReason, expiresAt: string | null): WindowDecision => ({
    multiCam: false,
    reason,
    days,
    meteredDays: expiresAt ? meteredDays : 0,
    expiresAt,
    minutesRemaining: expiresAt ? 0 : null,
    endingSoon: false,
    runningLong: false,
  });

  // FAIL CLOSED. No unlock resolved (including any lookup that errored into false)
  // → the free tier, which is a real working product, not a punishment.
  if (!owned) return closed('not-owned', null);

  // Owned with zero day-orders = a GRANT, not a purchase. WHICH grant decides whether
  // it is metered (owner-locked 2026-07-26 — see the GRANT KINDS block above).
  // Founder + comp broadcast without a clock; internal + promo + anything
  // unrecognised fall through to the ordinary one-event-day window below.
  if (grantedDay && grantIsUnmetered(input.grantKind)) {
    return {
      multiCam: true,
      reason: 'unmetered',
      days: 0,
      meteredDays: 0,
      expiresAt: null,
      minutesRemaining: null,
      endingSoon: false,
      runningLong: false,
    };
  }

  const firstLiveAt = toDate(input.firstLiveAt);
  if (!firstLiveAt) {
    // Paid (or granted a metered day), never pressed live. The clock has not started
    // — and an UNREADABLE anchor lands here too, the deliberate fail-OPEN for a host
    // who already paid.
    return {
      multiCam: true,
      reason: 'awaiting-go-live',
      days,
      meteredDays,
      expiresAt: null,
      minutesRemaining: null,
      endingSoon: false,
      runningLong: false,
    };
  }

  // A metered GRANT has no purchase timestamp to fold, so its single day starts at
  // the anchor itself: foldWindowEnd(firstLiveAt, [firstLiveAt]) = firstLiveAt + 24h.
  // Exactly one event-day from first go-live — the paying customer's clock.
  const effectiveDayStarts = grantedDay ? [firstLiveAt] : input.dayStarts;
  const expires = foldWindowEnd(firstLiveAt, effectiveDayStarts, dayHours);
  const expiresAt = expires.toISOString();
  const msLeft = expires.getTime() - now.getTime();

  if (msLeft > 0) {
    const minutesRemaining = Math.floor(msLeft / MS_PER_MINUTE);
    return {
      multiCam: true,
      reason: 'open',
      days,
      meteredDays,
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
        meteredDays,
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
   THE UNANCHORED DAY (owner-ruled 2026-09-02) — "your broadcast day starts when
   you first go live" was told to a couple deciding whether to spend ₱3,000, weeks
   before they pay, and never again to the person about to press the button that
   actually starts the clock. This closes that gap on the controller itself.
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * Is the event's calendar day the SAME UTC day as `now`? Crude date-only
 * comparison, same shape as `app/[slug]/_lib/site-nav.ts`'s `eventDayIsBehindUs`
 * — good enough to tell "the wedding day itself" from every other day, which is
 * all this needs.
 */
function isEventDayNow(eventDate: string | Date | null | undefined, now: Date): boolean {
  const raw = eventDate instanceof Date ? eventDate.toISOString() : (eventDate ?? '').toString();
  const day = raw.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return day === now.toISOString().slice(0, 10);
}

/**
 * Should the controller warn that this event OWNS Live Studio but has never
 * anchored its broadcast day?
 *
 * `reason === 'awaiting-go-live'` is exactly that state: paid (or granted a
 * metered day), `firstLiveAt` never set, so `decideBroadcastWindow` has already
 * confirmed multi-cam is live-able but the clock has not started. Every other
 * reason either has no anchor to warn about (`not-owned`, `unmetered` — no clock
 * ever runs) or has already anchored (`open`/`ending-soon`/`expired*`).
 *
 * SILENT ON THE EVENT DAY ITSELF (owner ruling): the warning is for a press
 * weeks early, when spending the day on a rehearsal is the mistake to prevent.
 * On the day, the host is about to anchor the day ON PURPOSE, and the warning
 * would be noise at the worst possible moment.
 *
 * PURE, takes `now` — same shape as `decideArchiveGuard` right above it, so the
 * client strip that ticks through a show can hold this to the same one testable
 * answer whether a test hands in a mock clock or the real render does.
 */
export function shouldWarnWindowNotStarted(input: {
  reason: WindowReason;
  eventDate: string | Date | null | undefined;
  now: Date;
}): boolean {
  if (input.reason !== 'awaiting-go-live') return false;
  return !isEventDayNow(input.eventDate, input.now);
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
