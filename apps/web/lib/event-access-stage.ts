/**
 * THE BOOKING FEE UNLOCKS THE EVENT — the one pure rule, with no database and
 * no `server-only`, so it can be executed by a test instead of described.
 *
 * ── THE OWNER'S RULING (verbatim, 2026-09-20) ───────────────────────────────
 * "when they pay the booking fee, that is when we unlock the rest of the
 *  controls for that event.
 *   1. the access to full details and actual updates of the event
 *   2. the request to access features
 *   3. their papic service for that event
 *   4. the event hub access
 *   5. the portfolio for that event
 *   6. the being part of the story for that event
 *   7. and whatever functions should only work after the booking fee has been
 *      made."
 *
 * and, the same day, narrowing what "before" means:
 *
 * "initially, they get information they only need to create a quotation for
 *  free. but the rest of access only begins after the booking fee."
 *
 * ── THREE STAGES PER (SHOP × EVENT) ─────────────────────────────────────────
 *   1 · `quoting`        — everything a supplier needs to PRICE the job and
 *                          nothing else: event type, date, the AREA, guest
 *                          count, the service asked for, the couple's
 *                          preferences, the budget band.
 *   2 · `booked_fee_due` — the shop said yes and the fee is not settled. The
 *                          same FIELDS as stage 1, plus three surfaces that
 *                          are ALWAYS open (see `ALWAYS_OPEN_SURFACES`).
 *   3 · `unlocked`       — the fee is settled (PAID **or** WAIVED). Everything.
 *
 * 🔑 "SETTLED" IS PAID **OR** WAIVED. A free-5 booking mints a
 * `booking_fee_charges` row with `status = 'waived_free5'` and NO order — the
 * supplier owes nothing and must unlock exactly like a supplier who paid.
 * Reading "settled" as `status = 'paid'` alone would lock every supplier's
 * first five bookings out of their own weddings, which is the opposite of the
 * ruling. `waived_import` (a booking the supplier brought themselves) is the
 * same: nothing owed, nothing withheld.
 *
 * ── PER EVENT VENDOR, NEVER PER SHOP ────────────────────────────────────────
 * `booking_fee_charges` is keyed on (vendor_profile_id, event_id) through its
 * ledger. An unsettled fee on event A says NOTHING about event B, and this
 * module never sees a shop-wide input — only one event's charge at a time.
 *
 * ── FAIL OPEN, ALWAYS ───────────────────────────────────────────────────────
 * 🚨 A read that FAILED is not a fee that is owed. `{ kind: 'unreadable' }`
 * unlocks, and the caller logs it. The whole class this repo keeps paying for
 * is a failure that renders identically to a real state; locking a supplier
 * out of a wedding they are shooting tomorrow because one SELECT was refused
 * would be that class with money on top.
 * For the same reason the LOCK is an allowlist, not a denylist: only the three
 * statuses that provably mean "money is owed" (`pending` · `failed` ·
 * `expired`) lock. A status nobody has seen before unlocks.
 *
 * ── WHAT THIS MODULE IS NOT ─────────────────────────────────────────────────
 * ⛔ It never decides WHETHER a shop is booked. That answer is
 * `admitRoomBookings` in `lib/vendor-room-access-rule.ts` and it is unchanged —
 * its three arms (schedule pool · lock agreed · claimed Locked QR) still say
 * who is booked. This is a FOURTH question asked of an already-booked shop,
 * and it is deliberately NOT folded into that function because
 * `fetchVendorRoomEvents` also answers COUPLE-side and GUEST-side questions
 * (`lib/guest-song-request.ts` asks it whether the band is booked before a
 * guest may request a song). Folding a supplier's unpaid bill into "is this
 * band booked" would punish the couple for their supplier's debt — the one
 * thing the ruling must never do.
 * ⛔ It never decides WHEN a charge opens, or how much it is. That is
 * `booking_fee_open_lock_charge` + `collectBookingFeeAtLock`, untouched.
 */

/** The flag. OFF by default: with it off, every stage resolves to `unlocked`. */
export function isFeeUnlocksEventEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_FEE_UNLOCKS_EVENT;
  return v === 'true' || v === '1' || v === 'TRUE';
}

/**
 * What the fee read found for ONE (shop × event).
 *
 * `none` and `unreadable` are deliberately DIFFERENT values. Both unlock, but
 * they are not the same fact and a caller that cannot tell them apart cannot
 * log the one that matters.
 */
export type BookingFeeChargeFacts =
  | { kind: 'none' }
  | { kind: 'unreadable' }
  | {
      kind: 'charge';
      status: string;
      /** What the supplier owes, in pesos. 0 for a waived charge. */
      amountPhp: number;
      /** `booking_fee_charges.expires_at` — the due date, or null. */
      dueAt: string | null;
      /** The `orders` row that bills it, when one exists (waived charges have none). */
      orderId: string | null;
    };

/**
 * The only three statuses that LOCK. Everything else — including a status this
 * code has never seen — unlocks. See "fail open" in the header.
 *
 * `pending`  = billed, not yet paid.
 * `failed`   = a payment attempt that did not clear; still owed.
 * `expired`  = the window closed unpaid; still owed.
 */
export const FEE_UNSETTLED_STATUSES: ReadonlySet<string> = new Set([
  'pending',
  'failed',
  'expired',
]);

/**
 * The statuses that mean nothing is owed. Kept as an exported set so a test can
 * assert `waived_free5` is in it — the single most load-bearing member, because
 * it is EVERY supplier's first five bookings.
 */
export const FEE_SETTLED_STATUSES: ReadonlySet<string> = new Set([
  'paid',
  'waived_free5',
  'waived_import',
]);

export type EventAccessReason =
  | 'flag_off'
  | 'settled'
  | 'no_charge'
  | 'fee_unreadable'
  | 'fee_due';

export type EventAccessDecision = {
  unlocked: boolean;
  reason: EventAccessReason;
  /** Present only when `unlocked === false` — what the locked screen must say. */
  owed: { amountPhp: number; dueAt: string | null; orderId: string | null } | null;
};

/**
 * THE RULE. Given one event's fee charge, is the rest of that event unlocked
 * for this shop?
 *
 * `enforced` is the flag, passed in rather than read here so a test can execute
 * both sides of it without touching `process.env`. It defaults to the live flag
 * for callers that just want the answer.
 */
export function eventAccessUnlocked(args: {
  charge: BookingFeeChargeFacts;
  enforced?: boolean;
}): EventAccessDecision {
  const enforced = args.enforced ?? isFeeUnlocksEventEnabled();
  // Flag off ⇒ byte-identical to today. Nothing below this line runs.
  if (!enforced) return { unlocked: true, reason: 'flag_off', owed: null };

  const charge = args.charge;
  // 🚨 A refused read unlocks. See the header.
  if (charge.kind === 'unreadable') {
    return { unlocked: true, reason: 'fee_unreadable', owed: null };
  }
  if (charge.kind === 'none') return { unlocked: true, reason: 'no_charge', owed: null };
  if (!FEE_UNSETTLED_STATUSES.has(charge.status)) {
    return { unlocked: true, reason: 'settled', owed: null };
  }
  return {
    unlocked: false,
    reason: 'fee_due',
    owed: { amountPhp: charge.amountPhp, dueAt: charge.dueAt, orderId: charge.orderId },
  };
}

export type EventAccessStage = 'quoting' | 'booked_fee_due' | 'unlocked';

/**
 * The stage this (shop × event) is at.
 *
 * `booked` is TODAY'S answer, unchanged — `admitRoomBookings`' three arms, or
 * the brief's `stage === 'booked'`. This function only adds the fee question on
 * top of it.
 */
export function resolveEventAccessStage(args: {
  booked: boolean;
  charge: BookingFeeChargeFacts;
  enforced?: boolean;
}): { stage: EventAccessStage; access: EventAccessDecision } {
  const enforced = args.enforced ?? isFeeUnlocksEventEnabled();
  const access = eventAccessUnlocked({ charge: args.charge, enforced });
  // Flag off ⇒ 'unlocked' for everyone, so `redactBriefForStage` is a no-op and
  // behaviour is byte-identical to today. This is the ONLY place that decides
  // it; no caller re-reads the flag to second-guess the stage.
  if (!enforced) return { stage: 'unlocked', access };
  if (!access.unlocked) return { stage: 'booked_fee_due', access };
  // Unlocked while enforced: settled, no charge, or unreadable. A shop that is
  // not booked at all is still only quoting — nothing is owed yet, and nothing
  // beyond a quote is theirs yet either.
  return { stage: args.booked ? 'unlocked' : 'quoting', access };
}

// ───────────────────────────────────────────────────────────────────────────
// THE FIELD POLICY — which brief fields each stage may see
// ───────────────────────────────────────────────────────────────────────────

/**
 * ⚖ OWNER-OPEN #1 — the budget band while quoting.
 *
 * RECOMMENDATION: `true` (shown). A supplier who cannot see the band quotes
 * blind, which is how a ₱40,000 couple gets a ₱120,000 quote and neither side
 * hears from the other again. The band is already a ₱5,000-quantized RANGE
 * behind the couple's own `share_budget_band` opt-in — the exact figure is
 * never recoverable from it — so showing it discloses a preference, not a
 * number.
 *
 * FLIP THIS ONE LINE to `false` to hold it back to stage 3.
 */
export const SHOW_BUDGET_BAND_WHILE_QUOTING = true;

/**
 * ⚖ OWNER-OPEN #2 — the venue while quoting.
 *
 * RECOMMENDATION: `'area_only'`. A supplier prices travel, call time and crew
 * from the AREA (`events.region`), which they keep at every stage. The exact
 * venue name and street address are what a supplier would need to contact the
 * venue directly and take the booking off-platform — the one disclosure that
 * costs us the booking fee the ruling exists to collect.
 *
 * FLIP THIS ONE LINE to `'full'` to hand the exact venue over while quoting.
 */
export const VENUE_WHILE_QUOTING: 'area_only' | 'full' = 'area_only';

/**
 * The three surfaces that stay open at EVERY stage, owner-framed: a locked
 * supplier must always be able to TALK and to PAY.
 *
 *   • the conversation with the couple            — /vendor-dashboard/messages/*
 *   • that booking's own money page               — the Quote & Payments tab
 *   • the booking-fee payment screen              — /vendor-dashboard/booking-fees/*
 *
 * Exported as strings so a guard can assert each one is never wrapped in the
 * gate, rather than a reviewer having to remember.
 */
export const ALWAYS_OPEN_SURFACES = {
  conversation: '/vendor-dashboard/messages',
  bookingMoney: 'tab=quote',
  feePayment: '/vendor-dashboard/booking-fees',
} as const;

/**
 * The brief keys stage 3 alone may see. Every one of them is an operating
 * detail — where to be, when, for how many plates, in which seat — not a
 * pricing input.
 */
export const STAGE_THREE_ONLY_BRIEF_FIELDS = [
  'venue', // event.venue_name + event.venue_address (see VENUE_WHILE_QUOTING)
  'dietary',
  'timeline',
  'seat_plan',
  'monogram',
] as const;

export type WithheldBriefField = (typeof STAGE_THREE_ONLY_BRIEF_FIELDS)[number];

/** The subset of the brief this module touches. Structural, so every caller fits. */
export type RedactableBrief = {
  event?: {
    venue_name?: string | null;
    venue_address?: string | null;
    [k: string]: unknown;
  } | null;
  dietary?: unknown;
  timeline?: unknown;
  seat_plan?: unknown;
  monogram?: unknown;
  budget_band?: unknown;
  [k: string]: unknown;
};

/**
 * Narrow a brief to what its stage may see, and SAY WHAT WAS TAKEN.
 *
 * 🔑 `withheld` IS NOT OPTIONAL DECORATION. Every redaction here is
 * shape-preserving — an empty timeline, a null dietary, a zeroed seat plan —
 * because the render must not crash. That means a withheld field looks EXACTLY
 * like a wedding with nothing planned yet, which is the failure this repo keeps
 * paying for. The caller MUST render `withheld` (see `EventLockedByFee`); a
 * screen that redacts silently is a screen that lies.
 */
export function redactBriefForStage<T extends RedactableBrief>(
  brief: T,
  stage: EventAccessStage,
): { brief: T; withheld: WithheldBriefField[] } {
  if (stage === 'unlocked') return { brief, withheld: [] };

  const withheld: WithheldBriefField[] = [];
  const out: RedactableBrief = { ...brief };

  if (VENUE_WHILE_QUOTING === 'area_only') {
    const ev = (brief.event ?? null) as RedactableBrief['event'];
    if (ev && (ev.venue_name != null || ev.venue_address != null)) withheld.push('venue');
    // `region` and `ceremony_type` survive — the AREA is a stage-1 field.
    out.event = ev ? { ...ev, venue_name: null, venue_address: null } : ev;
  }

  if (out.dietary != null) withheld.push('dietary');
  out.dietary = null;

  if (Array.isArray(out.timeline) && out.timeline.length > 0) withheld.push('timeline');
  out.timeline = [];

  const seat = out.seat_plan as { table_count?: number; assigned_guests?: number } | null;
  if (seat && ((seat.table_count ?? 0) > 0 || (seat.assigned_guests ?? 0) > 0)) {
    withheld.push('seat_plan');
  }
  out.seat_plan = { published: false, published_at: null, table_count: 0, assigned_guests: 0 };

  const mono = out.monogram as Record<string, unknown> | null;
  if (mono && Object.values(mono).some((v) => v != null && v !== '')) withheld.push('monogram');
  out.monogram = {
    text: null,
    color: null,
    font_key: null,
    frame_key: null,
    custom_svg: null,
  };

  if (!SHOW_BUDGET_BAND_WHILE_QUOTING) out.budget_band = null;

  return { brief: out as T, withheld };
}

/**
 * The mount marker for the locked panel. A STRING, not a line number, so the
 * mount guard counts occurrences of something greppable that cannot drift.
 */
export const VENDOR_FEE_LOCK_TESTID = 'vendor-fee-lock';

/** What each withheld field is CALLED on screen. One place, so two screens agree. */
export const WITHHELD_FIELD_LABEL: Record<WithheldBriefField, string> = {
  venue: 'the exact venue and address',
  dietary: 'meal counts',
  timeline: 'the day-of timeline',
  seat_plan: 'the seat plan',
  monogram: 'the couple’s monogram',
};

const PHP = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * The words on a locked screen. Never a blank page, never a 404, never a silent
 * empty state — the amount, the due date, and the way to pay it.
 */
export function feeLockCopy(args: {
  stage: EventAccessStage;
  owed: EventAccessDecision['owed'];
  withheld: readonly WithheldBriefField[];
}): { headline: string; detail: string; cta: string | null } {
  const list = args.withheld.map((f) => WITHHELD_FIELD_LABEL[f]);
  const listed =
    list.length === 0
      ? 'the rest of this event'
      : list.length === 1
        ? list[0]!
        : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]!}`;

  if (args.stage === 'quoting') {
    return {
      headline: 'Quote first — the rest opens when the booking fee is settled',
      detail: `You have everything you need to price this job. ${
        listed.charAt(0).toUpperCase() + listed.slice(1)
      } opens once this booking is confirmed and the Setnayan booking fee is settled.`,
      cta: null,
    };
  }

  const amount = args.owed ? `₱${PHP.format(args.owed.amountPhp)}` : 'your booking fee';
  const due = args.owed?.dueAt ? ` Due ${formatDue(args.owed.dueAt)}.` : '';
  return {
    headline: `Pay ${amount} to unlock this event`,
    detail: `${
      listed.charAt(0).toUpperCase() + listed.slice(1)
    } — and this event’s day-of tools — open the moment your Setnayan booking fee is settled.${due} You can still message the couple and see this booking’s money at any time.`,
    cta: 'Pay the booking fee',
  };
}

/** `YYYY-MM-DD` or an ISO timestamp → "5 October 2026", in Manila. */
function formatDue(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(d);
}
