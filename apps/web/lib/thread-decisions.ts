import { formatPhp } from '@/lib/vendors';
import { THREAD_STAGE_LABEL, type ThreadStage } from '@/lib/vendor-thread-stage';

/**
 * thread-decisions.ts — ONE timeline of everything that was actually decided in
 * a conversation, each entry saying WHERE IT STANDS NOW.
 *
 * ── WHAT THE OWNER ASKED FOR ────────────────────────────────────────────────
 * *"anyway to filter what their current cards are for easier tracking? like
 * meetings, schedules, payments, quotes, adjustments? so it can eliminate other
 * conversation and just show what is the current verdict for those?"*
 *
 * ── 🔑 THE RULE THE WHOLE THING RESTS ON ────────────────────────────────────
 * **EVERY ENTRY SHOWS WHERE IT STANDS NOW, NOT WHAT IT SAID WHEN IT WAS SENT.**
 * A quote sent in July and accepted in August reads "Booked · accepted 1 Sep".
 * A meeting that moved shows the old time struck through and the new one.
 *
 * This is not a nicety. A filter that replays the announcements is a tidy list
 * of stale claims, and it is WORSE than scrolling the conversation — because
 * scrolling shows you the correction three bubbles later, and a list that has
 * been vouched for by a filter does not. Every `now` on this type is derived
 * from the CURRENT row, never from the message that announced it.
 *
 * ── WHY THIS IS A PURE MODULE AND NOT A COMPONENT ───────────────────────────
 * The merge is the hard part: **two of the six kinds are not messages at all.**
 * The guest-count-changed card and the couple's logged-payment card are page
 * sections rendered AROUND the stream, not rows in it, so "the decisions in
 * this conversation" exists in three places and nowhere as a list. Sorting that
 * inside a React component would make the ordering, the attribution and the
 * `now` wording untestable, and would guarantee the couple's copy of this view
 * and the supplier's drift apart. Facts in, entries out. No React, no I/O.
 *
 * ── ⛔ THE STAGE IS NOT DERIVED HERE, AND NEITHER IS THE STANDING SENTENCE ──
 * `resolveThreadStage` is the ONE ladder and `buildSupplierStanding` is the ONE
 * standing sentence (S6, `lib/supplier-standing.ts`). This module consumes the
 * first and does not touch the second: the line above these entries is the same
 * sentence the bench renders, because the owner's *"yes, it is fine to show it
 * twice"* is only safe while there is ONE derivation rendered several times.
 *
 * ── ⚠ AN OFFERED SERVICE IS NOT A DECISION, AND HAS NO KIND HERE ────────────
 * `offered_service_id` renders a real card in the stream (S5), and it was the
 * obvious fifth kind. It is deliberately absent, because **it has no state to
 * be in.** Measured in `lib/offered-service-card.ts`: the card resolves a
 * `vendor_services` row — cover, price, inclusions — and NOTHING anywhere
 * closes, spends, expires or accepts it. There is no column that could ever
 * make its "now" line say something different from the day it was sent.
 *
 * So an offer entry would be the one row on this list that is a replayed
 * announcement by construction — precisely what the view exists to eliminate —
 * and a `taken` flag for it would be a gate with no handle. When an offer
 * gains a state, it gains a kind here; not before.
 *
 * ── ⚠ `change_order_id` IS RETIRED AND HAS NO ENTRY HERE ────────────────────
 * `chat_messages` carries a fifth marker whose card was deleted on purpose in
 * `d3350b8e2` — the bundled amendment is its superset. Nothing in the product
 * can create one (`lib/the-change-marker-is-retired.test.ts` proves it by
 * import count), so there is no `DecisionKind` for it and Decisions must not
 * imply one exists.
 */

/**
 * The six things a conversation can decide. Deliberately NOT open to extension
 * by a string: every kind needs a row in `DECISION_VOICE` below, and adding one
 * should fail the build until someone has decided whether it may wear a pill.
 */
export type DecisionKind =
  /** A `vendor_proposals` row announced by a message carrying `proposal_id`. */
  | 'quote'
  /** An `event_appointments` row announced by `appointment_id`. */
  | 'meeting'
  /** A `proposal_amendments` row announced by `amendment_id`. */
  | 'adjustment'
  /** An `event_vendor_payments` row — A PAGE SECTION, not a message. */
  | 'payment'
  /** A live-pax surcharge proposal — A PAGE SECTION, not a message. */
  | 'guest_count';

/**
 * What a kind is allowed to say. One table, exhaustive by type — the same shape
 * as `STAGE_VOICE` in `supplier-standing.ts`, and for the same reason.
 */
type DecisionVoice = {
  /**
   * ⛔ MAY THIS KIND'S `now` LINE WEAR A COLOURED STAGE PILL?
   *
   * Only the five ladder words may ever appear as a pill, and only on a card
   * that ACTUALLY MOVED THE STAGE. A quote does: sending it makes the thread
   * Quoted, accepting it makes it Booked. **Nothing else on this list does.**
   * A meeting, a payment, an adjustment and a guest-count change all happen
   * INSIDE a rung without moving it, so they carry a dated sentence instead.
   *
   * 🔑 This is a capability, not a convention: `pill()` refuses to attach a
   * stage to a kind whose voice says it cannot wear one, so a future kind
   * cannot grow a pill by having a plausible-looking status. "Needs you" is
   * never a pill either — it is an outline and a count, never a sixth word.
   */
  canWearStagePill: boolean;
  /**
   * The kind's own word, at the head of the entry — PER READER.
   *
   * ⚠ A label is a sentence with a subject in it, and the subject turns around
   * with the reader exactly the way "waiting on you" does. Rendering this view
   * on the couple's phone (2026-09-10) showed their own payment headed
   * **"Payment logged by the couple"** — true on the supplier's screen, and on
   * the couple's a stranger describing them in the third person. The `now`
   * lines were already viewer-aware; the labels were one static string each.
   */
  label: Record<DecisionViewer, string>;
};

export const DECISION_VOICE: Record<DecisionKind, DecisionVoice> = {
  quote: { canWearStagePill: true, label: { couple: 'Quote', vendor: 'Quote' } },
  meeting: { canWearStagePill: false, label: { couple: 'Meeting', vendor: 'Meeting' } },
  adjustment: {
    canWearStagePill: false,
    label: { couple: 'Adjustment', vendor: 'Adjustment' },
  },
  payment: {
    canWearStagePill: false,
    label: { couple: 'Payment you logged', vendor: 'Payment logged by the couple' },
  },
  guest_count: {
    canWearStagePill: false,
    label: { couple: 'Guest count changed', vendor: 'Guest count changed' },
  },
};

/** Who is reading. The same entries, but "waiting on you" points one way. */
export type DecisionViewer = 'couple' | 'vendor';

/**
 * WHERE ONE DECISION STANDS NOW. Built from the live row only.
 */
export type DecisionNow = {
  /**
   * The rung this entry moved the thread to, or null. Non-null ONLY where
   * `DECISION_VOICE[kind].canWearStagePill` is true — enforced in code, not by
   * the caller remembering.
   */
  stage: ThreadStage | null;
  /** The dated sentence: "accepted by Hiraya · 1 Sep". Never empty. */
  text: string;
  /** This entry is waiting on the person reading it right now. */
  needsYou: boolean;
  /**
   * What this entry USED to say, struck through beside the new value — the
   * meeting that moved. Null when nothing was superseded.
   */
  wasText: string | null;
};

/**
 * WHAT THE READER CAN DO ABOUT AN ENTRY, RIGHT HERE.
 *
 * Owner, 2026-09-10: *"the vendor and customer will either approve the request
 * of the other one."* So an entry that is waiting on the reader carries the
 * reply to it, and the reader answers without leaving the view.
 *
 * ── 🔑 THE INVARIANT: A REPLY EXISTS IF AND ONLY IF `now.needsYou` ──────────
 * The side being ASKED gets the buttons; the side that ASKED gets none, and
 * reads "waiting on them" instead. That is the whole of the owner's sentence,
 * and it is enforced by deriving both from the same branch below rather than
 * by two rules that happen to agree today. A test asserts it over every kind,
 * every status and both readers.
 *
 * ── EVERY REPLY IS AN ACTION THAT ALREADY EXISTS ────────────────────────────
 * Nothing here is new behaviour. Each variant names the server action the
 * existing card in the stream already posts to, with the same fields:
 *
 *   meeting      → `respondAppointment`        (confirm | decline)
 *   adjustment   → `respondAmendmentFromChat`  (accept  | decline)
 *   payment      → `confirmVendorPayment`      (supplier only)
 *   guest_count  → `acceptPaxSurcharge` / `declinePaxSurcharge` (supplier only)
 *   quote        → a LINK to `/proposals/<public id>`, not an action
 *
 * Every one of those actions re-checks, server-side, that the caller is the
 * party allowed to answer — so a button shown to the wrong reader would still
 * be refused. The invariant above is about not SHOWING it, not about security.
 *
 * ⚖ WHY A QUOTE GETS A LINK AND NOT AN "ACCEPT" BUTTON. Accepting a quote books
 * the supplier. The product has no inline accept anywhere — the chat's own
 * quote card says "Review & accept" and opens the full proposal — because the
 * couple should see what they are agreeing to before they agree to it. A
 * one-tap booking on a summary line, beside three smaller approvals, would be
 * the easiest button on the screen to press by accident.
 *
 * ⚠ AND THERE IS NO "NOT RECEIVED" FOR A PAYMENT. The design drew one. The
 * product has only `confirmVendorPayment`; nothing records a dispute. A button
 * with no action behind it would be worse than none, so the supplier gets
 * "Confirm received" and the payment otherwise keeps waiting, as it does today.
 */
export type DecisionReply =
  /** `label` feeds the other side's notification ("Meeting declined: Tasting"). */
  | { kind: 'meeting'; appointmentId: string; label: string }
  | { kind: 'adjustment'; amendmentId: string }
  | { kind: 'payment'; paymentId: string }
  | { kind: 'guest_count'; eventVendorId: string; surchargePhp: number | null }
  | { kind: 'quote_review'; publicId: string };

export type DecisionEntry = {
  /** Stable within a thread: `${kind}:${id}`. React key and test handle. */
  key: string;
  kind: DecisionKind;
  /** The kind's word for THIS reader — see `DecisionVoice.label`. */
  kindLabel: string;
  /** When it entered the conversation — THE SORT KEY. Oldest to newest. */
  atMs: number;
  /** The entry's own headline, e.g. "Garden Buffet · 150 guests". */
  title: string;
  /** "sent 22 Aug" — when it was announced, kept small beside the title. */
  sentLabel: string;
  now: DecisionNow;
  /** Non-null exactly when `now.needsYou` — see `DecisionReply`. */
  reply: DecisionReply | null;
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Dates
 *
 * ⚠ EVERY formatter here names `Asia/Manila` EXPLICITLY.
 * `a-date-is-not-decided-by-the-machine.test.ts` fails any `DateTimeFormat`
 * that names a day without a zone, because the server's day is not the
 * couple's. A quote accepted at 08:00 Manila on 1 Sep is 00:00 UTC on 1 Sep and
 * 20:00 on 31 Aug in New York — three different answers to "when".
 *
 * ⚠ AND THE LOCALE IS `en-GB`, NOT `en-PH`. `en-PH` resolves to real CLDR data
 * that orders a short date "Sep 1"; the design, and every sibling surface,
 * writes "1 Sep". `a-supplier-overview-*` already carries an assertion that
 * en-PH is not used to format a date anywhere it had leaked in.
 * ────────────────────────────────────────────────────────────────────────── */
const MNL = 'Asia/Manila';

/**
 * ⚠ THE STRING IS ASSEMBLED FROM PARTS, NOT TAKEN FROM A LOCALE PATTERN.
 *
 * Measured on this checkout (Node 22 / ICU 77): `en-PH` gives "Sep 1" — wrong
 * order; `en-GB` gives "1 Sept" — wrong abbreviation. Neither is a bug in ICU,
 * they are just CLDR data, and CLDR data changes between Node releases. The
 * design writes "1 Sep", so the order is chosen here and only the month
 * abbreviation is borrowed — from `en-US`, whose short month has been the
 * three-letter form for the life of the data.
 *
 * Building a date string by hand is the existing house answer to this; see the
 * en-PH assertion in the supplier-overview tests.
 */
const PARTS_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: MNL,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

type WhenParts = { weekday: string; day: string; month: string; time: string };

function partsOf(ms: number): WhenParts {
  const p = PARTS_FMT.formatToParts(new Date(ms));
  const get = (t: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === t)?.value ?? '';
  const hour = get('hour');
  const minute = get('minute');
  // `dayPeriod` is "AM"/"PM" on en-US; lower-cased so a card reads "11:00 am".
  const period = get('dayPeriod').toLowerCase();
  return {
    weekday: get('weekday'),
    day: get('day'),
    month: get('month'),
    time: hour ? `${hour}:${minute}${period ? ` ${period}` : ''}` : '',
  };
}

/** "1 Sep". Null in, null out — a missing date must not print "Invalid Date". */
export function dayLabel(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  const { day, month } = partsOf(ms);
  return `${day} ${month}`;
}

/** "Sun 27 Sep · 11:00 am" — a meeting needs its weekday and its time. */
export function whenLabel(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  const { weekday, day, month, time } = partsOf(ms);
  return `${weekday} ${day} ${month}${time ? ` · ${time}` : ''}`;
}

/** Whole days, floored, never negative — the same shape S6 uses. */
function daysSince(fromMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - fromMs) / 86_400_000));
}

/** "4 days" / "1 day" / "today". Used only for things that are WAITING. */
function waitingLabel(fromMs: number, nowMs: number): string {
  const d = daysSince(fromMs, nowMs);
  if (d <= 0) return 'today';
  return `${d} ${d === 1 ? 'day' : 'days'}`;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * The six sources
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * A `vendor_proposals` row as the thread sees it.
 *
 * `status` is the SHIPPED vocabulary, measured from migration
 * `20261208006000_vendor_proposals.sql`:
 * `draft · sent · viewed · accepted · declined · expired`.
 */
export type QuoteFact = {
  proposalId: string;
  /** `vendor_proposals.public_id` — the `/proposals/<id>` the couple reviews at. */
  publicId: string;
  /** When the announcing message landed. */
  announcedAtMs: number;
  title: string;
  totalPhp: number | null;
  status: string;
  /** When the CURRENT status was reached, if known. Drives "accepted 1 Sep". */
  decidedAtMs: number | null;
};

/**
 * An `event_appointments` row.
 *
 * `status`: `proposed · confirmed · done · cancelled` (migration
 * `20270713200000_event_appointments.sql`).
 *
 * 🔑 `previousScheduledAtMs` IS THE WHOLE REASON A MOVED MEETING CAN BE SHOWN.
 * `respondAppointment`'s `propose_new` branch OVERWRITES `scheduled_at` in
 * place and posts no message, so before this column the old time was destroyed
 * the instant someone proposed a new one — and "shows the old time struck
 * through" was undrawable from the database, however the design drew it.
 */
export type MeetingFact = {
  appointmentId: string;
  announcedAtMs: number;
  title: string;
  scheduledAtMs: number | null;
  previousScheduledAtMs: number | null;
  status: string;
  /** Who proposed the time that is on the row NOW. */
  initiatedBy: 'couple' | 'vendor' | null;
};

/**
 * A `proposal_amendments` row.
 * `status`: `proposed · accepted · declined · withdrawn`.
 */
export type AdjustmentFact = {
  amendmentId: string;
  announcedAtMs: number;
  title: string;
  /** The delta in pesos, signed. Null when the amendment carries no money. */
  deltaPhp: number | null;
  status: string;
  decidedAtMs: number | null;
  /** Who raised it — an amendment waits on the OTHER party. */
  raisedBy: 'couple' | 'vendor' | null;
};

/**
 * An `event_vendor_payments` row — the couple says they sent money.
 *
 * ⚠ NOT `fetchPendingVendorPayments`. That helper filters
 * `.is('vendor_confirmed_at', null)`, so a payment the supplier already
 * confirmed VANISHES from it. Feeding this list from that helper would make
 * Decisions silently incomplete in exactly the direction that matters — the
 * money that IS settled would be missing from the record of what was settled.
 */
export type PaymentFact = {
  paymentId: string;
  /** When the couple logged it. */
  loggedAtMs: number;
  amountPhp: number;
  method: string | null;
  label: string | null;
  /** Non-null once the supplier confirmed it reached them. */
  confirmedAtMs: number | null;
  /** Total on the live quote, for "₱50,000 of ₱187,500". Null when unknown. */
  ofTotalPhp: number | null;
};

/** The couple's live headcount has moved away from the quoted one. */
export type GuestCountFact = {
  /** One per thread; the id is the event's, so the key stays stable. */
  id: string;
  changedAtMs: number;
  livePax: number;
  quotedPax: number;
  /** What re-pricing would add, in pesos. Null when it cannot be computed. */
  surchargePhp: number | null;
};

/*
 * ⚠ THERE IS NO `settled` FLAG, DELIBERATELY. `fetchVendorPaxProposals`
 * returns a row ONLY while a surcharge is still owed — once the supplier
 * applies it or the count stops moving, the proposal is simply absent. So a
 * settled guest-count change cannot be fed here, and a `settled: true` branch
 * would be a gate with no handle. Absence IS the settled state.
 */

export type ThreadDecisionFacts = {
  viewer: DecisionViewer;
  nowMs: number;
  quotes: readonly QuoteFact[];
  meetings: readonly MeetingFact[];
  adjustments: readonly AdjustmentFact[];
  payments: readonly PaymentFact[];
  guestCounts: readonly GuestCountFact[];
};

/* ─────────────────────────────────────────────────────────────────────────────
 * The NOW line, per kind
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * THE ONE GATE A STAGE PILL PASSES THROUGH.
 *
 * Callers below hand in the rung they believe the entry moved the thread to;
 * this drops it on the floor unless the kind's voice permits a pill. That is
 * what makes "only a card that actually moved the stage wears one" true by
 * construction rather than by five call sites each remembering.
 */
function pill(kind: DecisionKind, stage: ThreadStage | null): ThreadStage | null {
  if (!DECISION_VOICE[kind].canWearStagePill) return null;
  return stage;
}

function quoteNow(q: QuoteFact, f: ThreadDecisionFacts): DecisionNow {
  const on = dayLabel(q.decidedAtMs);
  const suffix = on ? ` · ${on}` : '';

  switch (q.status) {
    case 'accepted':
      // The one entry that books a thread. The amount rides along because this
      // line is the answer to "what did we agree to pay".
      return {
        stage: pill('quote', 'booked'),
        text: `Accepted${suffix}`,
        needsYou: false,
        wasText: null,
      };
    case 'declined':
      return { stage: null, text: `Declined${suffix}`, needsYou: false, wasText: null };
    case 'expired':
      return { stage: null, text: `Expired${suffix}`, needsYou: false, wasText: null };
    case 'draft':
      // A draft was never sent, so it decided nothing and asks nobody.
      return { stage: null, text: 'Not sent', needsYou: false, wasText: null };
    case 'sent':
    case 'viewed':
    default: {
      // Out with the couple and unanswered. The supplier is waiting; the couple
      // is being waited on. Same row, two true sentences.
      const waited = waitingLabel(q.announcedAtMs, f.nowMs);
      return {
        stage: pill('quote', 'quoted'),
        text:
          f.viewer === 'couple'
            ? `Waiting on you · ${waited}`
            : `Waiting on them · ${waited}`,
        needsYou: f.viewer === 'couple',
        wasText: null,
      };
    }
  }
}

function meetingNow(m: MeetingFact, f: ThreadDecisionFacts): DecisionNow {
  const now = whenLabel(m.scheduledAtMs);
  const was = whenLabel(m.previousScheduledAtMs);
  // Only a genuinely different instant is a move. A row touched without its
  // time changing must not print a strike-through of the same time.
  const moved =
    was != null && m.previousScheduledAtMs !== m.scheduledAtMs ? was : null;

  switch (m.status) {
    case 'confirmed':
      return {
        stage: null,
        text: now ? `${moved ? 'Moved to ' : ''}${now} · confirmed` : 'Confirmed',
        needsYou: false,
        wasText: moved,
      };
    case 'done':
      return {
        stage: null,
        text: now ? `Happened · ${now}` : 'Happened',
        needsYou: false,
        wasText: moved,
      };
    case 'cancelled':
      return { stage: null, text: 'Cancelled', needsYou: false, wasText: moved };
    case 'proposed':
    default: {
      // Single-winner: whoever proposed the time on the row now is waiting for
      // the other side. `initiatedBy` is flipped to the responder by
      // `propose_new`, so this stays correct across any number of counters.
      //
      // ⚖ A ROW WITH NO RECORDED PROPOSER CAN BE ANSWERED BY EITHER SIDE —
      // because that is what the SERVER allows, and the server is the
      // authority. `respondAppointment` refuses only when
      // `initiated_by === actorRole`; with `initiated_by` NULL that is never
      // true, so both parties may confirm and the first answer wins. The
      // chat's own card agrees (`canAct = status === 'proposed' && !isProposer`).
      //
      // This read `initiatedBy != null && …` until 2026-09-10 and so offered
      // the reply to NEITHER side — one door said "answer it", the other said
      // nothing. The column is nullable (every current writer sets it; older
      // or externally-written rows need not). Contrast `raisedBy` on an
      // adjustment, which is NOT NULL, so its guard below never bites.
      const waitingOnViewer = m.initiatedBy !== f.viewer;
      const head = now ? `${moved ? 'New time ' : ''}${now}` : 'Time proposed';
      return {
        stage: null,
        text: waitingOnViewer ? `${head} · needs your yes` : `${head} · waiting on them`,
        needsYou: waitingOnViewer,
        wasText: moved,
      };
    }
  }
}

function adjustmentNow(a: AdjustmentFact, f: ThreadDecisionFacts): DecisionNow {
  const on = dayLabel(a.decidedAtMs);
  const suffix = on ? ` · ${on}` : '';
  switch (a.status) {
    case 'accepted':
      return { stage: null, text: `Applied${suffix}`, needsYou: false, wasText: null };
    case 'declined':
      return { stage: null, text: `Declined${suffix}`, needsYou: false, wasText: null };
    case 'withdrawn':
      return { stage: null, text: `Withdrawn${suffix}`, needsYou: false, wasText: null };
    case 'proposed':
    default: {
      const waitingOnViewer = a.raisedBy != null && a.raisedBy !== f.viewer;
      const waited = waitingLabel(a.announcedAtMs, f.nowMs);
      return {
        stage: null,
        text: waitingOnViewer
          ? `Needs your answer · ${waited}`
          : `Waiting on them · ${waited}`,
        needsYou: waitingOnViewer,
        wasText: null,
      };
    }
  }
}

function paymentNow(p: PaymentFact, f: ThreadDecisionFacts): DecisionNow {
  const of =
    p.ofTotalPhp != null ? ` · ${formatPhp(p.amountPhp)} of ${formatPhp(p.ofTotalPhp)}` : '';
  if (p.confirmedAtMs != null) {
    const on = dayLabel(p.confirmedAtMs);
    return {
      stage: null,
      text: `Confirmed received${on ? ` · ${on}` : ''}${of}`,
      needsYou: false,
      wasText: null,
    };
  }
  // Logged by the couple, not yet confirmed by the supplier. It is the
  // SUPPLIER's to answer — on the couple's screen this is not a to-do.
  const waited = waitingLabel(p.loggedAtMs, f.nowMs);
  return {
    stage: null,
    text:
      f.viewer === 'vendor'
        ? `Waiting for you to confirm · ${waited}`
        : `Waiting for them to confirm · ${waited}`,
    needsYou: f.viewer === 'vendor',
    wasText: null,
  };
}

function guestCountNow(g: GuestCountFact, f: ThreadDecisionFacts): DecisionNow {
  // The quote still reads the old number — that is the standing fact, and it is
  // the supplier who re-prices.
  const stillReads = `the quote still reads ${g.quotedPax} guests`;
  return {
    stage: null,
    text:
      f.viewer === 'vendor'
        ? `Waiting for you · ${stillReads}`
        : `Waiting for them · ${stillReads}`,
    needsYou: f.viewer === 'vendor',
    // ⚠ NO STRIKE-THROUGH. A struck value means "no longer true", and the
    // quoted count IS still true — the line beside it says so, and it stays
    // true until the supplier answers. #5372 struck "150 guests" here while
    // printing "the quote still reads 150 guests" in the same line; rendering
    // the supplier's phone (2026-09-10) is what showed it. The title already
    // carries both numbers ("Now planning for 170 — you quoted 150").
    wasText: null,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * The merge
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * THREE SOURCES, ONE TIMELINE, OLDEST TO NEWEST.
 *
 * Messages carry four of the six kinds; the other two are page sections that
 * never enter the stream. They are interleaved here by date so the couple reads
 * the conversation's decisions in the order they happened — a payment logged on
 * 5 Sep sits between the quote accepted on 1 Sep and the headcount change on
 * 8 Sep, which is the only order in which the list explains itself.
 *
 * Ties break by kind then key so the order is TOTAL: two rows written in the
 * same millisecond must not swap places between two renders of the same page.
 */
export function buildThreadDecisions(facts: ThreadDecisionFacts): DecisionEntry[] {
  const entries: DecisionEntry[] = [];

  for (const q of facts.quotes) {
    entries.push({
      key: `quote:${q.proposalId}`,
      kind: 'quote',
      kindLabel: DECISION_VOICE.quote.label[facts.viewer],
      atMs: q.announcedAtMs,
      title: q.totalPhp != null ? `${q.title} · ${formatPhp(q.totalPhp)}` : q.title,
      sentLabel: sentLabel(q.announcedAtMs),
      ...withReply(quoteNow(q, facts), { kind: 'quote_review', publicId: q.publicId }),
    });
  }

  for (const m of facts.meetings) {
    entries.push({
      key: `meeting:${m.appointmentId}`,
      kind: 'meeting',
      kindLabel: DECISION_VOICE.meeting.label[facts.viewer],
      atMs: m.announcedAtMs,
      title: m.title,
      sentLabel: sentLabel(m.announcedAtMs),
      ...withReply(meetingNow(m, facts), {
        kind: 'meeting',
        appointmentId: m.appointmentId,
        label: m.title,
      }),
    });
  }

  for (const a of facts.adjustments) {
    entries.push({
      key: `adjustment:${a.amendmentId}`,
      kind: 'adjustment',
      kindLabel: DECISION_VOICE.adjustment.label[facts.viewer],
      atMs: a.announcedAtMs,
      title:
        a.deltaPhp != null
          ? `${a.title} · ${a.deltaPhp >= 0 ? '+' : '−'}${formatPhp(Math.abs(a.deltaPhp))}`
          : a.title,
      sentLabel: sentLabel(a.announcedAtMs),
      ...withReply(adjustmentNow(a, facts), { kind: 'adjustment', amendmentId: a.amendmentId }),
    });
  }

  for (const p of facts.payments) {
    const parts = [formatPhp(p.amountPhp), p.method, p.label].filter(Boolean);
    entries.push({
      key: `payment:${p.paymentId}`,
      kind: 'payment',
      kindLabel: DECISION_VOICE.payment.label[facts.viewer],
      atMs: p.loggedAtMs,
      title: parts.join(' · '),
      sentLabel: sentLabel(p.loggedAtMs),
      ...withReply(paymentNow(p, facts), { kind: 'payment', paymentId: p.paymentId }),
    });
  }

  for (const g of facts.guestCounts) {
    const delta =
      g.surchargePhp != null && g.surchargePhp !== 0
        ? ` · ${g.surchargePhp > 0 ? '+' : '−'}${formatPhp(Math.abs(g.surchargePhp))}`
        : '';
    entries.push({
      key: `guest_count:${g.id}`,
      kind: 'guest_count',
      kindLabel: DECISION_VOICE.guest_count.label[facts.viewer],
      atMs: g.changedAtMs,
      // "you quoted" is the supplier's own number; read by the couple it is
      // theirs, so the subject turns around like every other label here.
      title: `Now planning for ${g.livePax} — ${facts.viewer === 'vendor' ? 'you' : 'they'} quoted ${g.quotedPax}${delta}`,
      sentLabel: sentLabel(g.changedAtMs),
      ...withReply(guestCountNow(g, facts), {
        kind: 'guest_count',
        eventVendorId: g.id,
        surchargePhp: g.surchargePhp,
      }),
    });
  }

  return entries.sort(
    (a, b) => a.atMs - b.atMs || a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key),
  );
}

/**
 * 🔑 THE ONE PLACE A REPLY IS ATTACHED — and the reason the invariant cannot
 * drift. The reply is offered precisely when the `now` line says the entry is
 * waiting on this reader, because it reads the same boolean the `now` line was
 * built with. There is no second rule about who may answer.
 */
function withReply(now: DecisionNow, reply: DecisionReply): Pick<DecisionEntry, 'now' | 'reply'> {
  return { now, reply: now.needsYou ? reply : null };
}

/** "sent 22 Aug", or just the date when there is none. */
function sentLabel(ms: number): string {
  const d = dayLabel(ms);
  return d ? `sent ${d}` : '';
}

/**
 * How many of these are waiting on the person reading. Drives the count on the
 * Decisions button and the "N need you" beside the standing sentence.
 *
 * ⚖ IT IS A COUNT AND AN OUTLINE, NEVER A SIXTH LADDER WORD. "Needs you" is
 * not a stage: a thread with two things outstanding is still Booked.
 */
export function decisionsNeedingYou(entries: readonly DecisionEntry[]): number {
  return entries.filter((e) => e.now.needsYou).length;
}

/** The pill's word, from the ladder's own table. Null when there is no pill. */
export function decisionStageWord(entry: DecisionEntry): string | null {
  return entry.now.stage == null ? null : THREAD_STAGE_LABEL[entry.now.stage];
}

/**
 * The empty state's sentence. A conversation with nothing decided yet must say
 * so in words that promise what WILL collect here — an empty panel with a
 * heading reads as a view that failed to load.
 */
export const DECISIONS_EMPTY =
  'Nothing decided yet. Every quote, meeting, payment and change will collect here.';
