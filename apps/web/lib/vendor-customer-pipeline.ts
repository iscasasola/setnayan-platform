/**
 * vendor-customer-pipeline.ts — THE FOUR STATES A CUSTOMER CAN BE IN, derived
 * once, purely, from the columns this product actually ships.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * The shop's Customers roster knew two states: `booked` (a live pool
 * reservation) and `in_conversation` (an ACCEPTED chat thread). Everything else
 * was invisible on the page whose entire job is "who are my customers":
 *   · a couple who ASKED and has not been accepted — the roster skipped every
 *     thread whose `inquiry_status` was not `accepted`;
 *   · a couple who pressed Lock and is waiting on the shop's YES — the roster
 *     never read `event_vendors` at all;
 *   · a celebration already delivered, sitting among the live ones.
 * Its `STATUS_PILL` map even carried `locked`, `whitelist` and `waitlist`
 * labels that NO ROW COULD EVER HOLD — the assembly loop only ever wrote
 * `booked` or `in_conversation`. Three of five pills were unreachable.
 *
 * ── THE SPEC'S VOCABULARY IS NOT THE SHIPPED MACHINE ───────────────────────
 * The 2026-06-02 lock describes `requested → accepted → lock_requested →
 * confirmed` on a 48-hour clock. NONE of those four words exists in the
 * database. Read out of production by the object (2026-08-28),
 * `event_vendors.lock_request_state` is TEXT, its CHECK admits exactly
 * `pending · agreed · declined · cancelled · expired`, and the window it is
 * enforced on is the MATERIALIZED `lock_request_expires_at` (~7 days), not 48
 * hours. Building the screen from the spec would have typechecked, demoed
 * perfectly, and been wrong about which couples are booked.
 *
 * THE MAP, WRITTEN DOWN ONCE SO NOBODY RE-DERIVES IT:
 *
 *   spec word        as-built source                        lane here
 *   ───────────────  ────────────────────────────────────   ──────────
 *   requested        chat_threads.inquiry_status='pending'   waiting
 *   lock_requested   lockRequestStateOf(...) === 'requested' waiting
 *   accepted         chat_threads.inquiry_status='accepted'  talking
 *   confirmed        lockRequestStateOf(...) === 'locked'    booked
 *   (none)           status IN ('delivered','complete')      finished
 *
 * 🔑 TWO SPEC RUNGS COLLAPSE INTO ONE LANE, DELIBERATELY. "Is 14 February
 * still open?" and "will you take this booking?" are the same thing to a shop
 * owner: somebody is waiting on an answer. The drawing says so in terms — one
 * list, every kind of question, oldest first. They stay distinguishable on the
 * row (`kind`), so nothing is lost; only the sorting is shared.
 *
 * 🔑 `finished` IS NOT A FIFTH PIPELINE RUNG — it is where the fourth one ends.
 * A delivered celebration is still a confirmed booking; separating it stops a
 * wedding that happened last year sitting in the same list as next week's.
 *
 * ── THE FLAG, SAID OUT LOUD ────────────────────────────────────────────────
 * `lockRequestStateOf` takes the handshake flag as a PARAMETER and, with it
 * false, answers only `locked` or `none`. So while
 * `NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED` is unflipped the `booking_ask` KIND can
 * never appear. ⚠ THAT IS NOT "the page renders two of four lanes": the
 * enquiry half of `waiting`, `talking`, `booked` and `finished` all read
 * columns the flag does not touch, so all four lanes work with the flag off —
 * one of the two things that can put somebody in `waiting` is simply
 * unreachable. Nothing here re-decides the flag; it is threaded in, exactly as
 * `flag-chokepoint-scan.test.ts` requires of every consumer of that core.
 *
 * ── WHAT IS DELIBERATELY ABSENT ────────────────────────────────────────────
 * ⛔ NO `waitlist` LANE. A shop can be waitlisted against, but picking somebody
 * off that waitlist DOES NOTHING TODAY AND STILL REPORTS SUCCESS (recorded in
 * `WHATS_NEXT_The_Three_Dead_Answers_2026-08-27.md`, unbuilt at the time of
 * writing). A chip that files people into a lane whose only action is a lie is
 * a fake door. The couple-facing waitlist queue still surfaces on the month
 * calendar as a per-day chip, where it says a true thing.
 * ⛔ NO `holding` LANE ("you said yes, they have not booked"). `agreed`-but-
 * unconfirmed is mapped to `cancelled` by the shared core, on purpose and with
 * its reasons written down there. Re-deciding it here would be a second
 * mapping — which is how two screens start disagreeing about who is booked.
 * It is an owner question, raised in the PR, not a silent build.
 *
 * PURE + dependency-light so it is trivially unit-testable and safe to import
 * from a server component. No Supabase, no `server-only`, no `Date.now()` that
 * the caller cannot control.
 */

import { lockRequestStateOf, type LockRequestRow } from '@/lib/lock-request-state';

/** The four lanes the roster opens on, in the order they are shown. */
export type CustomerLane = 'waiting' | 'talking' | 'booked' | 'finished';

export const CUSTOMER_LANES: readonly CustomerLane[] = [
  'waiting',
  'talking',
  'booked',
  'finished',
] as const;

/** Which of the two unanswered questions put this person in `waiting`. */
export type WaitingKind =
  /** They asked the shop something and nobody has accepted the enquiry. */
  | 'inquiry'
  /** They pressed Lock; the shop has not said yes or no. */
  | 'booking_ask';

/**
 * The statuses that mean the work is DONE. Mirrors `lib/vendors.ts`; kept as a
 * local literal set because this module must stay importable from a client
 * bundle and `vendors.ts` drags a large surface with it.
 *
 * ⚠ `complete` here is the BOOKING's status column, which is not the same fact
 * as `completion_status` (the supplier's own claim that a job is finished —
 * owner-locked 2026-08-21 as *not* a release). This lane reads the status the
 * booking machine writes, never the claim.
 */
const FINISHED_STATUSES = new Set(['delivered', 'complete']);

/** A chat thread, reduced to the three facts this derivation needs. */
export type PipelineThread = {
  threadId: string;
  /** `chat_threads.inquiry_status` — pending / accepted / declined / … */
  inquiryStatus: string | null;
  /** ISO timestamp the couple asked. */
  createdAt: string | null;
  /**
   * `isInquiryRevealed(thread)` — resolved by the caller so this module stays
   * free of the chat layer. False means the couple's identity is still masked.
   */
  revealed: boolean;
};

/** An `event_vendors` row, reduced to the facts this derivation needs. */
export type PipelineBooking = LockRequestRow & {
  eventVendorId: string;
  /** `lock_requested_at` — when the couple pressed Lock. */
  requestedAt: string | null;
  /** The MATERIALIZED deadline, never one recomputed here. */
  expiresAt: string | null;
};

export type PipelineInput = {
  eventId: string;
  thread: PipelineThread | null;
  booking: PipelineBooking | null;
  /**
   * The event's own name. Supplied for every event the caller could resolve;
   * whether it is USED is decided below, never by the caller.
   */
  eventName: string | null;
  /** Neutral, non-identifying placeholder ("A couple planning a wedding in …"). */
  descriptor: string;
  eventDate: string | null;
  /** Venue name — an identity-bearing fact, gated exactly like the name. */
  place: string | null;
  /**
   * A LIVE, UNRELEASED reservation in this shop's own schedule pool
   * (`vendor_schedule_pool_bookings`, `released_at IS NULL`).
   *
   * 🔴 IT IS HERE TO STOP A REGRESSION, and the regression is a person
   * disappearing. The roster this replaced derived "booked" from pool bookings
   * ALONE and never read `event_vendors`; deriving it from `event_vendors`
   * alone is strictly better about WHICH state a booking is in and strictly
   * worse about EXISTENCE — a pool reservation whose `event_vendors` row is
   * archived, or was never stamped with `marketplace_vendor_id`, would have
   * silently left the shop's customer list. A held date is a booking whatever
   * else is missing, so this floors the lane rather than deciding it.
   */
  poolBooked?: boolean;
};

export type PipelineCustomer = {
  eventId: string;
  lane: CustomerLane;
  /** Only set on `waiting`. */
  waitingKind: WaitingKind | null;
  /**
   * ISO timestamp of the unanswered question, for the oldest-first order.
   * Null outside `waiting`.
   */
  waitingSince: string | null;
  /** The lock ask's materialized deadline, for the fuse. Null unless a booking_ask. */
  expiresAt: string | null;
  /**
   * What the row is called. THE COUPLE'S OWN NAME ONLY WHERE IDENTITY IS
   * ALREADY THEIRS TO SEE — see `identityRevealed` below. Otherwise the neutral
   * descriptor, which carries no name, no title, no venue and no contact.
   */
  title: string;
  /** True only where the shop is entitled to the couple's identity. */
  identityRevealed: boolean;
  eventDate: string | null;
  /** Venue. Null wherever `identityRevealed` is false — a venue names a couple. */
  place: string | null;
  threadId: string | null;
  eventVendorId: string | null;
};

/**
 * THE ONE DERIVATION.
 *
 * Order of decision matters and is the opposite of the obvious one: a REAL
 * BOOKING is resolved first, because a confirmed row can carry a stale
 * `pending` marker (the printed Locked-QR path promotes to `deposit_paid`
 * without touching a single `lock_*` column) and a shop already paid must not
 * be filed under "waiting for your answer". `lockRequestStateOf` encodes that
 * precedence; this function must not re-litigate it.
 *
 * @param handshakeEnabled the `NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED` value,
 *   passed in by an already-gated caller. Never read here.
 * @returns null when the person is not a customer at all — a shortlisted shop
 *   nobody has contacted, a declined or withdrawn enquiry, a booking ask that
 *   has already been answered no. Filing those under any lane would put people
 *   in a list called "my customers" who never were.
 */
export function customerLaneOf(
  input: PipelineInput,
  handshakeEnabled: boolean,
): PipelineCustomer | null {
  const { thread, booking } = input;
  const lockState = booking
    ? lockRequestStateOf(
        { status: booking.status, lock_request_state: booking.lock_request_state },
        handshakeEnabled,
      )
    : 'none';

  let lane: CustomerLane | null = null;
  let waitingKind: WaitingKind | null = null;
  let waitingSince: string | null = null;
  let expiresAt: string | null = null;

  if (lockState === 'locked') {
    lane =
      booking?.status && FINISHED_STATUSES.has(booking.status) ? 'finished' : 'booked';
  } else if (lockState === 'requested') {
    // The bigger of the two unanswered questions wins the row. A couple with an
    // un-accepted enquiry AND a live booking ask is one person waiting, not two
    // rows — and what they are waiting for is the yes.
    lane = 'waiting';
    waitingKind = 'booking_ask';
    waitingSince = booking?.requestedAt ?? null;
    expiresAt = booking?.expiresAt ?? null;
  } else if (thread?.inquiryStatus === 'pending') {
    lane = 'waiting';
    waitingKind = 'inquiry';
    waitingSince = thread.createdAt;
  } else if (thread?.inquiryStatus === 'accepted') {
    lane = 'talking';
  }

  /*
    THE POOL-RESERVATION FLOOR. A live hold cannot make somebody LESS than a
    customer, so it lifts `null` and `talking` to `booked`.

    ⛔ IT DOES NOT OUTRANK `waiting`. A held date beside an unanswered booking
    ask is a contradiction (the handshake bypasses the slot acquire precisely so
    an ask holds nothing), and of the two facts the one the shop must act on is
    the question. Nor does it touch `finished`: a delivered celebration whose
    reservation was never released is finished, not live.
  */
  if (input.poolBooked && (lane === null || lane === 'talking')) lane = 'booked';

  if (lane === null) return null;

  /*
    IDENTITY IS GATED BY THE LANE, NOT BY THE THREAD ALONE.

    `waiting` NEVER carries a name — and that includes a booking ask, which is
    the non-obvious half. Anonymisation-until-accept covers the enquiry; the
    booking ask is covered by the same boundary PR-H drew for
    `get_vendor_event_brief`, whose `'requested'` rung is given NO payload of
    its own precisely so an asked-but-unanswered supplier learns nothing they
    could still walk away from. The shipped Answers-Desk card agrees: it says
    "A couple wants to book you", a date, and an age — no name, no venue.

    `talking` reaches here only via an ACCEPTED thread, and `booked`/`finished`
    mean the shop is party to the celebration. Both are entitled to the name.
  */
  const identityRevealed =
    lane === 'booked' || lane === 'finished' || (lane === 'talking' && !!thread?.revealed);

  return {
    eventId: input.eventId,
    lane,
    waitingKind,
    waitingSince,
    expiresAt,
    title: identityRevealed ? (input.eventName?.trim() || input.descriptor) : input.descriptor,
    identityRevealed,
    eventDate: input.eventDate,
    place: identityRevealed ? input.place : null,
    threadId: thread?.threadId ?? null,
    eventVendorId: booking?.eventVendorId ?? null,
  };
}

/**
 * The order the roster renders in.
 *
 * `waiting` is OLDEST FIRST — the person who has waited longest is the one the
 * shop owes an answer to, and a queue sorted any other way rewards ignoring
 * somebody. A row with no timestamp sorts to the TOP, not the bottom: an
 * unanswered question whose clock we cannot read is still unanswered, and
 * failing toward "show it sooner" is the direction that cannot hide a person.
 *
 * Every other lane is soonest-event-first with undated last — unchanged from
 * what the roster already did, because a booked list is a diary.
 */
export function comparePipelineCustomers(
  a: PipelineCustomer,
  b: PipelineCustomer,
): number {
  if (a.lane === 'waiting' && b.lane === 'waiting') {
    if (a.waitingSince && b.waitingSince) return a.waitingSince.localeCompare(b.waitingSince);
    if (a.waitingSince) return 1;
    if (b.waitingSince) return -1;
    return a.title.localeCompare(b.title);
  }
  if (a.eventDate && b.eventDate) return a.eventDate.localeCompare(b.eventDate);
  if (a.eventDate) return -1;
  if (b.eventDate) return 1;
  return a.title.localeCompare(b.title);
}

/** Rows per lane, each internally ordered by {@link comparePipelineCustomers}. */
export function groupByLane(
  rows: PipelineCustomer[],
): Record<CustomerLane, PipelineCustomer[]> {
  const out: Record<CustomerLane, PipelineCustomer[]> = {
    waiting: [],
    talking: [],
    booked: [],
    finished: [],
  };
  for (const r of rows) out[r.lane].push(r);
  for (const lane of CUSTOMER_LANES) out[lane].sort(comparePipelineCustomers);
  return out;
}

/**
 * How long somebody has been waiting, in whole days, floored at 0.
 * Null when there is no readable timestamp — the row still renders, without an
 * age, rather than claiming a number nobody measured.
 */
export function waitingDays(since: string | null, now: number): number | null {
  if (!since) return null;
  const t = Date.parse(since);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}
