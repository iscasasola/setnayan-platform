/**
 * booked-rows.ts — WHAT THE BOOKED BODY DRAWS (owner 2026-10-07; corpus
 * `SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md` § PR4; the prototype's Booked
 * mode in `prototypes/suppliers_page_2026-10-07_fable.html`).
 *
 *   Waiting for their yes     the couple asked, the supplier has not answered:
 *                             nothing opens — Nudge · Chat · Withdraw
 *   Booked                    one row each, the ONE next step, and behind a tap
 *                             what they feed across the event and the verbs
 *
 * ── NOTHING HERE IS A NEW STATE ────────────────────────────────────────────
 * This module only RE-SHAPES three answers that already ship:
 *
 *   booked · asked     `teamRows` (`lib/your-team-rows.ts`) — the one place the
 *                      handshake becomes a row. "Waiting for their yes" is its
 *                      `asked` group: couple asks, supplier agrees.
 *   the plan           `computeStepper` (`lib/vendor-service-payment-schedules`)
 *                      over the supplier's own payment plan, frozen at booking
 *                      (`event_vendor_payment_plan`) — the next instalment
 *                      that is still due.
 *   the money          `buildBudgetList` (`lib/budget-page-view.ts`) over the
 *                      one resolver — agreed · paid · owed · the dated payments
 *                      still owed. A budget line item REPLACES a supplier's
 *                      headline there; this module never totals anything.
 *   the words          `cardVerbWords` (`lib/supplier-card-verbs.ts`) — a verb
 *                      says and wears the same thing on a Find card and here.
 *
 * ── A REFUSED MONEY READ IS NOT "NOTHING DUE" ──────────────────────────────
 * `moneyKnown: false` (the supplier group of the ledger did not answer) makes
 * a priced row say that its payments could not be checked. It never says
 * "Paid in full", never names an amount and never offers "Pay" as if something
 * were known to be due.
 *
 * Pure: no React, no I/O, no clock of its own (`now` is a parameter).
 */
import { lockRequestFuseLabel } from './lock-request-state';
import { cardVerbWords, type CardVerbKey } from './supplier-card-verbs';
import { initialsOf, type SupplierRow } from './budget-page-view';
import type { PlanProgress } from './vendor-service-payment-schedules';
import type { TeamRow, TeamRowTone } from './your-team-rows';
import { dateChangeAnswerLine, dateChangeWhen, type DateChangeView } from './date-change';

/** What the page knows about one supplier besides their team row. */
export type BookedFacts = {
  /** `event_vendors.vendor_id`. */
  vendorId: string;
  /** The plan group they are booked in (`PLAN_GROUPS[].id`), when placed. */
  groupId: string | null;
  /** The couple added them themselves — they have no shop on Setnayan. */
  own: boolean;
  /** Their shop on Setnayan (`event_vendors.marketplace_vendor_id`), or null. */
  shopId: string | null;
  /** The agreed price NOW, in pesos. Null = no price recorded. */
  pricePhp: number | null;
  /** Their conversation with the couple, when one exists. */
  threadId: string | null;
  /** Money has already moved on this booking (`bookingMoneyMoved`). */
  moneyMoved: boolean;
  /** Deadline of an outstanding ask (`event_vendors.lock_request_expires_at`). */
  lockRequestExpiresAt: string | null;
};

type VerbTone = ReturnType<typeof cardVerbWords>['tone'];

/** A verb the Booked body draws. The first eight are the Find card's own. */
export type BookedVerbKey =
  | Extract<CardVerbKey, 'set_price' | 'pay' | 'payments' | 'record' | 'chat' | 'workspace' | 'nudge' | 'withdraw'>
  /** After the day — the shipped review door (`teamRowOf`'s `review` action). */
  | 'review'
  /** Take a booking back before any money has moved (`cancelBookingAsHost`). */
  | 'cancel'
  /** Money has moved: the shipped door is the dispute, never a delete. */
  | 'dispute';

export type BookedVerb = {
  key: BookedVerbKey;
  label: string;
  tone: VerbTone;
  main?: boolean;
  quiet?: boolean;
};

/** The three words the Find card does not have. */
const OWN_WORDS: Record<'review' | 'cancel' | 'dispute', { label: string; tone: VerbTone }> = {
  review: { label: 'Review', tone: 'brand' },
  cancel: { label: 'Cancel booking', tone: 'danger' },
  // The shipped door's own words (`DisputeLinkButton`).
  dispute: { label: 'Request refund / dispute', tone: 'warn' },
};

const verb = (key: BookedVerbKey, opts: { main?: boolean; quiet?: boolean } = {}): BookedVerb => ({
  key,
  ...(key === 'review' || key === 'cancel' || key === 'dispute' ? OWN_WORDS[key] : cardVerbWords(key)),
  ...(opts.main ? { main: true } : {}),
  ...(opts.quiet ? { quiet: true } : {}),
});

/** The sentence after "Next:" — or the paid-in-full line that replaces it. */
export type BookedNext =
  /** No price recorded: the buffer cannot count them. */
  | { kind: 'set_price' }
  /**
   * A payment is still owed — the next instalment of the supplier's plan, or a
   * dated line on the ledger. `amountPhp` / `dueDate` are `null` when the plan
   * itself has not resolved one (a share of a total nobody has set, a date
   * hanging on an event day not yet picked) — never guessed.
   */
  | {
      kind: 'due';
      label: string;
      amountPhp: number | null;
      dueDate: string | null;
    }
  /** Everything agreed has been paid. */
  | { kind: 'paid_in_full'; paidPhp: number }
  /** A sentence that already ships (`teamRowOf`), or the refused-read line. */
  | { kind: 'said'; text: string; needsYou: boolean };

export type BookedRow = {
  vendorId: string;
  name: string;
  initials: string;
  logoUrl: string | null;
  /** The category's label ("Reception"). Null when it has none. */
  service: string | null;
  groupId: string | null;
  own: boolean;
  pill: { text: string; tone: TeamRowTone };
  next: BookedNext;
  /** A price is recorded for them. */
  priced: boolean;
  /**
   * What the ledger holds for them — agreed · paid · still owed, in pesos.
   * `null` = unknown: the supplier read was refused, or the ledger has no
   * agreed line for them (a booked supplier with no price). Never 0 for either.
   */
  money: { agreedPhp: number; paidPhp: number; owedPhp: number } | null;
  /** "Used across your event" — where this booking feeds the rest of the app. */
  feeds: readonly string[];
  /** The room-size line — only a venue's row has one (`roomLineFor`). */
  room: RoomLine | null;
  /** The couple asked their suppliers to move the date, and this is theirs. */
  dateAsk: DateAsk | null;
  verbs: BookedVerb[];
  threadId: string | null;
};

export type WaitingRow = {
  vendorId: string;
  name: string;
  initials: string;
  logoUrl: string | null;
  service: string | null;
  /** The price they were asked at, in pesos. Null = none recorded. */
  pricePhp: number | null;
  /** "3 days left to answer" — the DB's own deadline, or null when it has none. */
  fuse: string | null;
  verbs: BookedVerb[];
  threadId: string | null;
};

export type BookedView = {
  waiting: WaitingRow[];
  booked: BookedRow[];
  /** Booked suppliers with no price recorded. */
  unpriced: number;
};

/** The pill, the sub line and the line under a waiting row — the prototype's words. */
export const WAITING_HEADING = 'Waiting for their yes';
export const WAITING_PILL = 'Waiting for their yes';
export const WAITING_UNTIL = 'no payments · no shared details · not on their calendar';
/** The ⓘ beside the heading. A waived fee is a completed handshake too. */
export const WAITING_INFO =
  'Booking is a handshake: you ask, they agree. Until the supplier says yes on Setnayan there is no payment record, no shared details and nothing on their calendar. Their yes opens everything for your event.';
export const BOOKED_EMPTY = 'Nothing booked yet — book from Find or from your build.';
export const NEXT_SET_PRICE = 'set the price so your buffer can count';
/** The supplier group of the ledger did not answer. Never "nothing due". */
export const NEXT_MONEY_UNREAD = 'we couldn’t check your payments';

/**
 * WHERE A BOOKING FEEDS THE REST OF THE EVENT — a static map by plan group
 * (owner 2026-10-07: *"once they have locked vendors. this data can be used
 * across the event."*). The prototype's `FEEDS`, keyed by the shipped plan
 * group ids. A group with no entry feeds the Schedule, as drawn.
 */
const FEEDS: Readonly<Record<string, readonly string[]>> = {
  reception_venue: ['Event Hub · venue & city', 'Seat plan · room size', 'Schedule'],
  ceremony_venue: ['Event Hub · ceremony', 'Schedule'],
  catering: ['Guests · headcount', 'Budget'],
  photography: ['Papic & Stories', 'Schedule'],
  coordinator: ['Schedule · they write their part', 'Chats'],
  stylist: ['Mood board', 'Seat plan · table sizes'],
  live_band: ['Schedule · program'],
  host_mc: ['Schedule · program'],
  hair_makeup: ['Schedule · call time'],
  cake: ['Schedule'],
  bridal_car: ['Schedule · travel'],
  guest_shuttle: ['Guests · pick-up'],
  invitations_stationery: ['Guests · invites'],
  photobooth: ['Papic'],
  lights_sound: ['Schedule'],
};
const FEEDS_DEFAULT: readonly string[] = ['Schedule'];

export function feedsFor(groupId: string | null): readonly string[] {
  return (groupId && FEEDS[groupId]) || FEEDS_DEFAULT;
}

/**
 * The verbs of a booked row, main first: the step's verb · Your record (theirs
 * to keep) · Chat · Workspace · the way out.
 */
function bookedVerbs(args: {
  main: BookedVerb;
  own: boolean;
  priced: boolean;
  thread: boolean;
  moneyMoved: boolean;
}): BookedVerb[] {
  const out: BookedVerb[] = [args.main];
  if (args.own && args.priced) out.push(verb('record'));
  if (args.thread) out.push(verb('chat'));
  out.push(verb('workspace'));
  // Hard delete only before a payment; after one the shipped door is the dispute.
  out.push(verb(args.moneyMoved ? 'dispute' : 'cancel'));
  return out;
}

function bookedRowOf(
  team: TeamRow,
  f: BookedFacts,
  money: SupplierRow | null,
  moneyKnown: boolean,
  plan: PlanProgress | null,
  extra: { rooms: ReadonlyMap<string, RoomSizeAnswer> | null | undefined; dateChange: DateChangeView | null; now: Date | undefined },
): BookedRow {
  const thread = f.threadId !== null;
  // A budget line item stands in place of the headline, so an agreed figure on
  // the ledger is a price too — the couple itemised instead of typing a total.
  const priced = f.pricePhp != null || (money !== null && money.agreedPhp > 0);
  const base = {
    vendorId: team.vendorId,
    name: team.name,
    // The Budget page's own two letters for a supplier ("Seda Vertis North" →
    // SV) — one circle for one supplier on both screens, as the prototype draws it.
    initials: initialsOf(team.name),
    logoUrl: team.logoUrl,
    service: team.service,
    groupId: f.groupId,
    own: f.own,
    pill: team.pill,
    priced,
    money: money ? { agreedPhp: money.agreedPhp, paidPhp: money.paidPhp, owedPhp: money.owedPhp } : null,
    feeds: feedsFor(f.groupId),
    room: roomLineFor(f, extra.rooms),
    dateAsk: dateAskFor(extra.dateChange, team.vendorId, extra.now),
    threadId: f.threadId,
  };
  const withVerbs = (next: BookedNext, main: BookedVerb): BookedRow => ({
    ...base,
    next,
    // A payment on the ledger is money moved too, whichever screen recorded it.
    verbs: bookedVerbs({
      main,
      own: f.own,
      priced,
      thread,
      moneyMoved: f.moneyMoved || (money !== null && money.paidPhp > 0),
    }),
  });
  const said = (text: string, needsYou: boolean): BookedNext => ({ kind: 'said', text, needsYou });

  // After the day — the review window, exactly as `teamRowOf` decided it.
  if (team.action?.kind === 'review') return withVerbs(said(team.next, true), verb('review', { main: true }));
  if (!priced) return withVerbs({ kind: 'set_price' }, verb('set_price', { main: true }));

  // The shipped first-payment step (`depositStepOf`, through `teamRowOf`).
  const step = team.action?.kind ?? null;
  // "Payment not received" — the supplier said it never arrived. Send it again.
  if (step === 'pay' && team.pill.tone === 'warn') return withVerbs(said(team.next, true), verb('pay', { main: true }));

  // Their plan's next instalment still due. (One waiting on their confirmation
  // is their turn, not the couple's — the next DUE one is the couple's step.)
  //
  // 🛑 NOT THE PENCILLED-IN 50/50. When the supplier sent no plan Setnayan seeds
  // an ESTIMATED split (`is_default_seeded`), and a booking that locked through
  // a quote carries its real schedule in the accepted quote instead
  // (`paymentScheduleSource`, lib/accepted-quote-terms.ts) — so an estimated
  // instalment here could name an amount nobody agreed. It is skipped: the row
  // then says the shipped sentence and the payment door states the amount.
  const instalment = plan && plan.isDefaultSeeded !== true ? (plan.steps?.find((s) => s.state === 'due') ?? null) : null;
  if (instalment) {
    return withVerbs(
      { kind: 'due', label: instalment.label, amountPhp: instalment.amount_php, dueDate: instalment.due_date },
      verb('pay', { main: true }),
    );
  }
  // The ledger did not answer: nothing more about their payments is known.
  if (!moneyKnown) return withVerbs(said(NEXT_MONEY_UNREAD, false), verb('payments', { main: true, quiet: true }));

  const due = money?.dues[0] ?? null;
  if (due) {
    return withVerbs(
      { kind: 'due', label: due.label, amountPhp: due.amountPhp, dueDate: due.dueDate },
      verb('pay', { main: true }),
    );
  }
  if (step === 'pay') return withVerbs(said(team.next, true), verb('pay', { main: true }));
  // A refused deposit read, or a payment waiting on the supplier's confirmation.
  if (step === 'check' || team.next !== NOTHING_ALL_SET) {
    return withVerbs(said(team.next, false), verb('payments', { main: true, quiet: true }));
  }
  // Money is owed with no date on it: the payment door is the next step.
  if (money !== null && money.owedPhp > 0) return withVerbs(said(team.next, false), verb('pay', { main: true }));
  if (money !== null && money.agreedPhp > 0) {
    return withVerbs({ kind: 'paid_in_full', paidPhp: money.paidPhp }, verb('payments', { main: true, quiet: true }));
  }
  return withVerbs(said(team.next, false), verb('payments', { main: true, quiet: true }));
}

/** `teamRowOf`'s own closing sentence — read, never re-typed in a component. */
const NOTHING_ALL_SET = 'nothing — all set';

function waitingRowOf(team: TeamRow, f: BookedFacts, now: Date | undefined): WaitingRow {
  const thread = f.threadId !== null;
  return {
    vendorId: team.vendorId,
    name: team.name,
    initials: initialsOf(team.name),
    logoUrl: team.logoUrl,
    service: team.service,
    pricePhp: f.pricePhp,
    fuse: lockRequestFuseLabel(f.lockRequestExpiresAt, now),
    // Nothing opens until they agree: chase, talk, or take it back.
    verbs: [...(thread ? [verb('nudge'), verb('chat')] : []), verb('withdraw')],
    threadId: f.threadId,
  };
}

/**
 * The Booked body, from the page's own rows.
 *
 * `rows` is `teamRows(...)` — every group; only `asked` and `booked` are drawn
 * here (a supplier the couple is still deciding on lives in Find). `money` is
 * `buildBudgetList(...).suppliers`: `null` = the read was refused. `plans` is
 * each booked supplier's payment plan with its payments folded in; `null` =
 * that read was refused, and the rows then say only what the ledger knows.
 */
export function bookedView(args: {
  rows: readonly TeamRow[];
  facts: readonly BookedFacts[];
  money: readonly SupplierRow[] | null;
  plans?: ReadonlyMap<string, PlanProgress> | null;
  /**
   * `readBookedRoomSizes` — each booked venue's stated room size. `null` = that
   * read was refused; `undefined` = nobody asked (no room line is drawn).
   */
  rooms?: ReadonlyMap<string, RoomSizeAnswer> | null;
  /** The event's OPEN date-change request (`readOpenDateChange`), when there is one. */
  dateChange?: DateChangeView | null;
  now?: Date;
}): BookedView {
  const factsById = new Map(args.facts.map((f) => [f.vendorId, f]));
  const moneyById = new Map((args.money ?? []).map((m) => [m.vendorId, m]));
  const moneyKnown = args.money !== null;
  const fallback = (vendorId: string): BookedFacts => ({
    vendorId,
    groupId: null,
    own: false,
    shopId: null,
    pricePhp: null,
    threadId: null,
    moneyMoved: false,
    lockRequestExpiresAt: null,
  });
  const waiting: WaitingRow[] = [];
  const booked: BookedRow[] = [];
  for (const r of args.rows) {
    const f = factsById.get(r.vendorId) ?? fallback(r.vendorId);
    if (r.group === 'asked') waiting.push(waitingRowOf(r, f, args.now));
    else if (r.group === 'booked') {
      booked.push(
        bookedRowOf(r, f, moneyById.get(r.vendorId) ?? null, moneyKnown, args.plans?.get(r.vendorId) ?? null, {
          rooms: args.rooms,
          dateChange: args.dateChange ?? null,
          now: args.now,
        }),
      );
    }
  }
  return { waiting, booked, unpriced: booked.filter((b) => !b.priced).length };
}

// ═══════════════════════════════════════════════════════════════════════════
// THE ROOM SIZE — only a venue has one
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Owner 2026-10-07: *"ceremony and reception and accomodation has size"* — no
 * other category gets a size line. The shipped plan group ids.
 */
export const ROOM_SIZE_GROUPS: ReadonlySet<string> = new Set(['reception_venue', 'ceremony_venue', 'accommodation']);
/** The one group whose size the seat plan starts from (`lib/venue-room-size.ts`). */
const SEAT_PLAN_GROUP = 'reception_venue';

/** What one supplier's shop answered: a size, or that it holds none. */
export type RoomSizeAnswer = { widthM: number; lengthM: number } | 'not_sent';

export type RoomLine =
  | { kind: 'sent'; widthM: number; lengthM: number; seatPlan: boolean }
  /** `canAsk`: they are on Setnayan and there is a conversation to ask in. */
  | { kind: 'not_sent'; canAsk: boolean }
  /** The read was refused, or their shop did not answer. Never "not sent". */
  | { kind: 'unread' };

/** The one line "Ask them" posts in the couple's conversation with the venue. */
export const ROOM_SIZE_ASK = 'Could you send the room size (width × length)? Our seat plan needs it.';

export function roomLineFor(
  f: Pick<BookedFacts, 'vendorId' | 'groupId' | 'shopId' | 'threadId'>,
  rooms: ReadonlyMap<string, RoomSizeAnswer> | null | undefined,
): RoomLine | null {
  if (rooms === undefined || !f.groupId || !ROOM_SIZE_GROUPS.has(f.groupId)) return null;
  // A venue the couple added themselves has no shop to state a size on.
  if (f.shopId === null) return { kind: 'not_sent', canAsk: false };
  if (rooms === null) return { kind: 'unread' };
  const answer = rooms.get(f.vendorId);
  if (answer === undefined) return { kind: 'unread' };
  if (answer === 'not_sent') return { kind: 'not_sent', canAsk: f.threadId !== null };
  return { kind: 'sent', widthM: answer.widthM, lengthM: answer.lengthM, seatPlan: f.groupId === SEAT_PLAN_GROUP };
}

// ═══════════════════════════════════════════════════════════════════════════
// A PENDING DATE CHANGE — also said on the supplier's own row
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Owner 2026-10-10 (ruling 10): a pending date change also shows on the
 * Suppliers page. The request, its answers and its words are the shipped ones
 * (`lib/date-change.ts`, the Home doorway's own sentences) — this only finds
 * the supplier the row is about.
 */
export type DateAsk = {
  /** "Saturday, July 6, 2030" — the date the couple asked to move to. */
  when: string;
  /** "Deciding · 2 days left" · "Can move to the new date" · … */
  line: string;
  /** They have not answered yet. */
  waiting: boolean;
};

export function dateAskFor(view: DateChangeView | null, vendorId: string, now: Date | undefined): DateAsk | null {
  if (!view) return null;
  const s = view.suppliers.find((x) => x.eventVendorIds.includes(vendorId));
  if (!s) return null;
  return {
    when: dateChangeWhen(view.proposedDate, view.proposedPrecision),
    line: dateChangeAnswerLine(s, (now ?? new Date()).getTime()),
    waiting: s.answer === 'asked',
  };
}
