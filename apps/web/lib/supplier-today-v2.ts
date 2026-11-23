/**
 * lib/supplier-today-v2.ts — TODAY v2, "ONE TASK" (pure — no I/O, no clock of its own).
 *
 * Owner, 18 Nov 2026, walking the supplier Today on his phone: *"so many text. so confusing. i just wanted to reply to a
 * review … keep focus on one task … when i log in, ill just finish all that is here and i am good for the day. the app
 * has analyzed everything for me"* — then *"all picks"* on the drawing `Today, one task` v2
 * (artifact F4vQbaCwFtu2iawYd2r6q2, corpus DECISION_LOG 2026-11-18).
 *
 * What this file decides — every word and rule below is one the drawing names, and every signal is one the app already
 * reads (`supplier-today-view.ts` assembles the rest):
 *
 *   · each desk kind's MODE — `quick` (answered on its row, with the shipped in-place forms in `overview-sections.tsx`)
 *     or `screen` (ONE focused screen, `?task=<id>`, never the whole editor). This reverses the 8 Nov "every Today row
 *     jumps" rule for the quick kinds only;
 *   · the BADGE each task moves, or "Your page" (only links the code already makes — a kind that moves no badge in the
 *     code carries no tag, never a made-up one);
 *   · the ORDER: quick tasks first, then the desk's own order (oldest first, a date change's deadline on top);
 *   · what COUNTS toward "done for today": only real to-dos. Recommended tasks and grow moves never count (pick 2);
 *   · the five-stage GROW PLAN, whose two cut-offs are the owner's numbers on Admin › Settings — blank means off, so
 *     those stages are skipped, never guessed (pick 1);
 *   · the "What's trending" lines from the demand radar and the card badges — counts only, a quiet market says nothing.
 *
 * 🔒 apps/web/lib/supplier-today-v2.test.ts
 */
import { shortDay, type TodayNeed, type TodayRowIcon } from '@/lib/supplier-today';
import { RENEW_PAPERS_HREF } from '@/lib/papers-renewal';
import type { DemandRadar } from '@/lib/demand-radar';
import type { WhatsNewCard } from '@/lib/vendor-overview';
import { formatCount } from '@/lib/format-number';
import { feeDueStage } from '@/lib/booking-fee-disclosure';
import { myQrHref } from '@/lib/supplier-qr-codes';

/* ─── MODES ───────────────────────────────────────────────────────────────────────────────────────────────────── */

export type TodayTaskMode = 'quick' | 'screen';

/**
 * The drawing's part 2 table, kind by kind. `quick`: one tap or one short box, answered on the row. `screen`: money
 * terms, a calendar, a chat or more than one field — one focused screen, then back.
 */
export const TODAY_TASK_MODE: Readonly<Record<WhatsNewCard['kind'], TodayTaskMode>> = {
  review: 'quick',
  lock: 'quick',
  date_change: 'quick',
  mark_complete: 'quick',
  meeting: 'quick',
  inquiry: 'screen',
  message: 'screen',
  lock_request: 'screen',
  delete_request: 'screen',
  quote_draft: 'screen',
  contract_draft: 'screen',
  lock_request_lapsed: 'screen',
  dispute: 'screen',
};

/** The kinds whose focused screen goes on to the NEXT of their kind after an answer (the drawing's "After: next …"). */
export const QUEUEABLE_KINDS: ReadonlySet<WhatsNewCard['kind']> = new Set(['inquiry', 'message', 'quote_draft', 'contract_draft']);

/* ─── THE BADGE A TASK MOVES ──────────────────────────────────────────────────────────────────────────────────── */

export type TodayBadgeTag = { word: string; page: boolean };

const PAGE: TodayBadgeTag = { word: 'Your page', page: true };
const badge = (word: string): TodayBadgeTag => ({ word, page: false });

/**
 * "→ Completed bookings · 2 to go" — the drawing's part 3. `toGo` is the Completed bookings tile's own short goal
 * ("2 to go"), handed in from `shelfBadge('completed_bookings', …)`; unread → the badge name alone.
 */
export function todayBadgeTag(kind: WhatsNewCard['kind'], completedToGo: string | null): TodayBadgeTag | null {
  switch (kind) {
    case 'review':
      return PAGE;
    case 'lock':
      return badge('Hot Booking');
    case 'inquiry':
    case 'message':
      return badge('Quick Responder · reply within 1 hour');
    case 'mark_complete':
      return badge(completedToGo ? `Completed bookings · ${completedToGo}` : 'Completed bookings');
    case 'date_change':
    case 'lock_request':
      return badge('Completed bookings');
    // A meeting time, a quote or contract draft, a cancel request, a lapsed ask and a dispute move no badge in the
    // code — no tag, never a made-up one (drawing part 3 ⓘ).
    default:
      return null;
  }
}

/** The recommended rows' tags (drawing part 3, "Recommended tasks: each has a real signal"). */
export const RECOMMENDED_TAG: Readonly<Record<string, TodayBadgeTag | null>> = {
  renewal: badge('Setnayan Verified'),
  'door-setup': badge('Setnayan Verified'),
  'door-payout': badge('Hot Booking'),
  'door-findable': PAGE,
  'door-credit': null,
  'door-gift': null,
};

/* ─── WHAT IS A REAL TO-DO ────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The shipped `needs` keys that are NOT a customer's ask — the shop's own gaps. v2 moves them under "Also for your
 * badges and your page", out of the count (pick 2: a shop Setnayan has not listed could otherwise never finish its day).
 */
export function isRecommendedKey(key: string): boolean {
  return key === 'renewal' || key.startsWith('door-');
}

/* ─── URGENCY (Today v3 part 1 — owner 19 Nov, "Yes, all your picks"; drawing V3 · 3) ────────────────────────────────
 *
 * ONE LIST, MOST URGENT FIRST: red, then amber, then the rest. A level always wears a WORD — colour is never the only
 * sign. Only deadlines the code ALREADY has decide a level (the drawing's table): a date change's `dueAt`, a booking
 * fee's `dueOn`. Everything else is normal. The windows that need a number nobody has set yet ("soon" for an inquiry or
 * a booking ask · an event beyond tomorrow) are admin settings of a later part — nothing here guesses them.
 * A dispute keeps its red line but wears no level (the drawing's small call).
 */
export type TodayUrgency = { level: 'red' | 'amber'; word: 'Overdue' | 'Today' | 'Soon' };

/**
 * A desk card's level, from its own deadline. `null` = normal.
 * v3 part 5: a booking ask (`lock_request`) wears amber "Soon" when its window (`expiresAt`, enforced by the guard
 * trigger) closes within the owner's `soonAskHours` (Admin › Settings). Not set → never coloured.
 */
export function taskUrgency(card: WhatsNewCard | null, now: number, soonAskHours: number | null = null): TodayUrgency | null {
  // ⚖ DECISION_LOG 2026-11-20 "SEVEN CONTROLLER PICKS" item 3: an UNANSWERED inquiry turns amber once it has waited the
  // owner's hours (Admin › Settings, ruled 24). It has only its arrival time, so that is what is counted from.
  if (card?.kind === 'inquiry') {
    if (soonAskHours === null) return null;
    const waited = now - new Date(card.createdAt).getTime();
    return Number.isFinite(waited) && waited >= soonAskHours * 3_600_000 ? { level: 'amber', word: 'Soon' } : null;
  }
  if (card?.kind === 'lock_request') {
    if (soonAskHours === null || !card.expiresAt) return null;
    const left = new Date(card.expiresAt).getTime() - now;
    return Number.isFinite(left) && left > 0 && left <= soonAskHours * 3_600_000 ? { level: 'amber', word: 'Soon' } : null;
  }
  if (!card || card.kind !== 'date_change') return null;
  const ms = new Date(card.dueAt).getTime() - now;
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return { level: 'red', word: 'Overdue' };
  if (ms < 24 * 3_600_000) return { level: 'red', word: 'Today' };
  return { level: 'amber', word: 'Soon' };
}

const URGENCY_RANK = { red: 0, amber: 1 } as const;
const rankOf = (u: TodayUrgency | null) => (u ? URGENCY_RANK[u.level] : 2);

/** Red, then amber, then the rest — each level keeping the order its rows arrived in (stable). */
export function orderByUrgency<T extends { urgency: TodayUrgency | null }>(rows: readonly T[]): T[] {
  return rows.map((r, i) => [r, i] as const).sort((a, b) => rankOf(a[0].urgency) - rankOf(b[0].urgency) || a[1] - b[1]).map((x) => x[0]);
}

/** ONE bill's level (`feeDueStage`): past due → red Overdue · its last day → red Today · not yet due → amber Soon. */
export function feeUrgency(dueOn: string | null, todayIso: string): TodayUrgency {
  const stage = feeDueStage(dueOn, todayIso);
  if (stage === 'overdue') return { level: 'red', word: 'Overdue' };
  if (stage === 'last_day') return { level: 'red', word: 'Today' };
  return { level: 'amber', word: 'Soon' };
}

/**
 * A fee bill's closed-row line, under its level word (drawing V3 · 3: "Overdue · since Sat 14 Nov"). The amount and
 * how to pay are in its open card (`feeRowCopy` detail) — the closed row never says "overdue" twice.
 */
export function feeRowLine(bill: { dueOn: string | null }, todayIso: string, detail: string): string {
  const stage = feeDueStage(bill.dueOn, todayIso);
  const when = bill.dueOn ? shortDay(bill.dueOn) : null;
  if (stage === 'overdue') return when ? `since ${when}` : detail;
  if (stage === 'last_day') return detail.replace(/ · due today$/, '');
  return when ? `due ${when}` : detail;
}

/**
 * The business permit's level — from the SAME rule that already tints its line (`permitNeed`: `danger` when it lapsed,
 * `warn` at 7 days or fewer; drawing V3 · 3 "a permit with 7 days or fewer" · "a business permit that expired"). A
 * permit further out than 7 days has no level: it stays under "Also for your badges and your page".
 */
export function permitUrgency(need: Pick<TodayNeed, 'key' | 'lineTone'>): TodayUrgency | null {
  if (need.key !== 'renewal') return null;
  if (need.lineTone === 'danger') return { level: 'red', word: 'Overdue' };
  if (need.lineTone === 'warn') return { level: 'amber', word: 'Soon' };
  return null;
}

/** A booked event's level — the day the Next card already knows (`run_day` · `tomorrow`): today red, tomorrow amber. */
export function eventUrgency(inDays: number): TodayUrgency | null {
  if (!Number.isFinite(inDays)) return null;
  if (inDays <= 0) return { level: 'red', word: 'Today' };
  if (inDays === 1) return { level: 'amber', word: 'Soon' };
  return null;
}

/**
 * 📅 "This week: N events" (DECISION_LOG 2026-11-20 "SEVEN CONTROLLER PICKS" item 3): the booked events beyond tomorrow
 * and within the owner's days (Admin › Settings, ruled 7) are ONE line that opens the calendar — never a row each, never
 * counted. Today's and tomorrow's events are rows of their own (`eventUrgency`). Not set → no line.
 */
export function thisWeekLine(events: ReadonlyArray<{ inDays: number }>, soonEventDays: number | null): { label: string; count: number } | null {
  if (soonEventDays === null || !Number.isFinite(soonEventDays)) return null;
  const n = events.filter((e) => Number.isFinite(e.inDays) && e.inDays >= 2 && e.inDays <= soonEventDays).length;
  return n > 0 ? { count: n, label: `This week: ${formatCount(n)} ${n === 1 ? 'event' : 'events'}` } : null;
}

export const THIS_WEEK_HREF = '/vendor-dashboard/calendar';

/** A booked event on today's list (the page's `upcoming`, `lib/vendor-overview.ts`). */
export type TodayEventDay = { id: string; eventName: string; date: string; inDays: number; place: string | null; href: string };

/** The event row's words (drawing V3 · 3: "Santos wedding is tomorrow" · "Soon · Sat 12 Dec · see the day"). */
export function eventRowWords(e: TodayEventDay): { label: string; line: string } {
  const today = e.inDays <= 0;
  return {
    label: `${e.eventName} is ${today ? 'today' : 'tomorrow'}`,
    line: [today ? e.place : shortDay(e.date), today ? 'run the day' : 'see the day'].filter(Boolean).join(' · '),
  };
}

export type TodayTaskRow = TodayNeed & {
  mode: TodayTaskMode;
  /** v3: the row's level in the one list (null = normal). */
  urgency: TodayUrgency | null;
  tag: TodayBadgeTag | null;
  /** The desk card behind the row (null for the "couldn't load" row). */
  card: WhatsNewCard | null;
};

export type TodaySplit = {
  quick: TodayTaskRow[];
  screen: TodayTaskRow[];
  /** v3: EVERY task in ONE list, most urgent first (no Quick / Longer groups). `quick` + `screen` are the same rows. */
  list: TodayTaskRow[];
  /**
   * ⏭ v3 part 2 — the tasks put off with "Do it tomorrow" (`lib/today-put-off.ts`): listed under "Tomorrow", NOT in
   * `list`, not counted today. A red row is never here — an urgent task ignores its record and stays on Today.
   */
  tomorrow: TodayTaskRow[];
  /** v3 part 2 — the put-off keys this split was made with, so the one list holds off a bill, the permit or an event too. */
  putOff?: ReadonlySet<string> | null;
  /** "Some answers couldn’t load" — never a task, never counted. */
  unread: TodayNeed | null;
  /**
   * v3: the business permit when it wears a level (expired, or 7 days or fewer — `permitUrgency`). It is then a task in
   * the one list and counted (drawing V3 · 3); further out it stays a recommended row. Null otherwise.
   */
  permit: (TodayNeed & { urgency: TodayUrgency }) | null;
  recommended: Array<TodayNeed & { tag: TodayBadgeTag | null }>;
};

/**
 * The shipped `needs` (already in the desk's order) → v2's groups. Quick first, then the rest, each keeping the order
 * it arrived in (pick 3: quick tasks first, then oldest). A row set aside with "Not now" / "Got it" today is left out.
 */
export function splitTodayNeeds(args: {
  needs: readonly TodayNeed[];
  cards: readonly WhatsNewCard[];
  completedToGo: string | null;
  aside: ReadonlySet<string>;
  /** v3: the clock the deadlines are read against. Absent → no row wears a level (the list keeps the desk's order). */
  now?: number;
  /** v3 part 2: the keys put off until a later day ("Do it tomorrow"). Absent/unread → nothing is held off. */
  putOff?: ReadonlySet<string>;
  /** v3 part 5: the owner's "Soon" window for a booking ask, in hours (null = not set). */
  soonAskHours?: number | null;
}): TodaySplit {
  const byId = new Map(args.cards.map((c) => [c.id, c] as const));
  const out: TodaySplit = { quick: [], screen: [], list: [], tomorrow: [], putOff: args.putOff ?? null, unread: null, permit: null, recommended: [] };
  const arrived: TodayTaskRow[] = [];
  for (const n of args.needs) {
    if (args.aside.has(n.key)) continue;
    if (n.key === 'unread') {
      out.unread = n;
      continue;
    }
    const permitLevel = args.now === undefined ? null : permitUrgency(n);
    if (permitLevel) {
      out.permit = { ...n, urgency: permitLevel };
      continue;
    }
    if (isRecommendedKey(n.key)) {
      out.recommended.push({ ...n, tag: RECOMMENDED_TAG[n.key] ?? null });
      continue;
    }
    const card = byId.get(n.key) ?? null;
    const mode = card ? TODAY_TASK_MODE[card.kind] : 'screen';
    const row: TodayTaskRow = { ...n, mode, urgency: args.now === undefined ? null : taskUrgency(card, args.now, args.soonAskHours ?? null), tag: card ? todayBadgeTag(card.kind, args.completedToGo) : null, card };
    // ⏭ Put off to tomorrow — unless it is red now: an urgent task is never hidden (ruled 19 Nov "yes. except urgent").
    if (args.putOff?.has(n.key) && row.urgency?.level !== 'red') {
      out.tomorrow.push(row);
      continue;
    }
    (mode === 'quick' ? out.quick : out.screen).push(row);
    arrived.push(row);
  }
  out.list = orderByUrgency(arrived);
  return out;
}

/**
 * 📋 THE ONE LIST, WHOLE (drawing V3 · 3): the desk's tasks, EACH fee bill, the permit when it wears a level and each
 * booked event today or tomorrow — every one its own row with its own level, red first, then amber, then the rest.
 * Inside a level the order is as it arrived: the desk's, then the bills, the permit, the events.
 */
export type TodayListEntry<B> =
  | { type: 'task'; key: string; urgency: TodayUrgency | null; row: TodayTaskRow }
  | { type: 'bill'; key: string; urgency: TodayUrgency; bill: B }
  | { type: 'permit'; key: string; urgency: TodayUrgency; need: TodayNeed }
  | { type: 'event'; key: string; urgency: TodayUrgency; event: TodayEventDay };

export function todayOneList<B extends { orderId: string; dueOn: string | null }>(args: {
  split: Pick<TodaySplit, 'list' | 'permit'> & { putOff?: ReadonlySet<string> | null };
  bills: readonly B[];
  events: readonly TodayEventDay[];
  todayIso: string;
}): Array<TodayListEntry<B>> {
  // ⏭ v3 part 2: a bill, the permit or an event put off with "Do it tomorrow" is not in the list (a red one always is).
  return holdOffEntries(allTodayEntries(args), args.split.putOff ?? null).now;
}

/** What "Tomorrow" lists beside the put-off tasks: the bills, the permit and the events held off (`holdOffEntries`). */
export function todayHeldOff<B extends { orderId: string; dueOn: string | null }>(args: Parameters<typeof todayOneList<B>>[0]): Array<{ key: string; label: string; icon: TodayRowIcon }> {
  return holdOffEntries(allTodayEntries(args), args.split.putOff ?? null).later;
}

function allTodayEntries<B extends { orderId: string; dueOn: string | null }>(args: Parameters<typeof todayOneList<B>>[0]): Array<TodayListEntry<B>> {
  const entries: Array<TodayListEntry<B>> = [
    ...args.split.list.map((row) => ({ type: 'task' as const, key: row.key, urgency: row.urgency, row })),
    ...args.bills.map((bill) => ({ type: 'bill' as const, key: `fee-${bill.orderId}`, urgency: feeUrgency(bill.dueOn, args.todayIso), bill })),
    ...(args.split.permit ? [{ type: 'permit' as const, key: args.split.permit.key, urgency: args.split.permit.urgency, need: args.split.permit }] : []),
    ...args.events.flatMap((event) => {
      const urgency = eventUrgency(event.inDays);
      return urgency ? [{ type: 'event' as const, key: `event-${event.id}`, urgency, event }] : [];
    }),
  ];
  return orderByUrgency(entries);
}

/**
 * ⏭ v3 part 2, on the one list: a fee bill, the permit and a booked event can go to tomorrow too (drawing V3 · 2's
 * table: "Do it tomorrow · red: can't") — each held off by its own record, a RED one never. Tasks are already held off
 * in `splitTodayNeeds`; this does the rest. `later` is what the "Tomorrow" block lists.
 */
export function holdOffEntries<B>(entries: ReadonlyArray<TodayListEntry<B>>, putOff: ReadonlySet<string> | null): {
  now: Array<TodayListEntry<B>>;
  later: Array<{ key: string; label: string; icon: TodayRowIcon }>;
} {
  const now: Array<TodayListEntry<B>> = [];
  const later: Array<{ key: string; label: string; icon: TodayRowIcon }> = [];
  for (const e of entries) {
    if (e.type === 'task' || !putOff?.has(e.key) || e.urgency.level === 'red') {
      now.push(e);
      continue;
    }
    if (e.type === 'bill') later.push({ key: e.key, label: 'Booking fee', icon: 'peso' });
    else if (e.type === 'permit') later.push({ key: e.key, label: e.need.label, icon: e.need.icon });
    else later.push({ key: e.key, label: eventRowWords(e.event).label, icon: 'calendar' });
  }
  return { now, later };
}

/* ─── DONE TODAY ──────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * What this shop finished today, read off the columns that already stamp each answer (no table of its own — Rule 0
 * rule 3): `vendor_reviews.vendor_reply_at`, `event_vendors.deposit_acknowledged_at` · `service_marked_complete_at` ·
 * `lock_agreed_at` · `lock_declined_at`, `event_date_change_answers.answered_at`. Null = it could not be read.
 */
export type DoneTodayCounts = {
  replies: number;
  /** Payment asks answered — confirmed OR said "it never arrived" (both leave the list). */
  payments: number;
  delivered: number;
  bookings: number;
  dates: number;
  /** Inquiries answered — accepted or declined (`chat_threads.accepted_at` / `declined_at`). */
  inquiries: number;
  /** A couple's meeting time answered (`event_appointments` left `proposed`). */
  meetings: number;
  /** Cancel requests answered (`event_vendors.delete_answered_at`). */
  cancels: number;
};

export type DoneTodayRow = { key: string; label: string; line: string };

/** Today's own set-asides (the cookie `today-aside.ts` keeps): "Got it" on a lapsed ask counts; "Not now" does not. */
export function doneTodayRows(done: DoneTodayCounts | null, gotIt: number): DoneTodayRow[] {
  const rows: DoneTodayRow[] = [];
  const many = (n: number, one: string, more: string) => (n === 1 ? one : `${formatCount(n)} ${more}`);
  if (done) {
    if (done.replies) rows.push({ key: 'done-replies', label: 'Reply to a review', line: many(done.replies, 'Reply posted', 'replies posted') });
    if (done.payments) rows.push({ key: 'done-payments', label: 'Confirm a payment', line: many(done.payments, 'You answered', 'payments answered') });
    if (done.dates) rows.push({ key: 'done-dates', label: 'Date change request', line: many(done.dates, 'You answered', 'date changes answered') });
    if (done.delivered) rows.push({ key: 'done-delivered', label: 'Mark it done', line: many(done.delivered, 'You delivered', 'events delivered') });
    if (done.bookings) rows.push({ key: 'done-bookings', label: 'Agree to this booking', line: many(done.bookings, 'You answered', 'booking asks answered') });
    if (done.inquiries) rows.push({ key: 'done-inquiries', label: 'Answer an inquiry', line: many(done.inquiries, 'You answered', 'inquiries answered') });
    if (done.meetings) rows.push({ key: 'done-meetings', label: 'Meeting time', line: many(done.meetings, 'You answered', 'meeting times answered') });
    if (done.cancels) rows.push({ key: 'done-cancels', label: 'Cancel request', line: many(done.cancels, 'You answered', 'cancel requests answered') });
  }
  if (gotIt) rows.push({ key: 'done-gotit', label: 'Ask lapsed', line: many(gotIt, 'Got it', 'cleared') });
  return rows;
}

/**
 * How many were finished today. `null` = the counts could NOT be read — never 0: "0 done" would be a claim that the
 * supplier did nothing, and "N of M done" would then be built on a guess. The caller says so instead (`DONE_UNREAD_LINE`).
 */
export function doneTodayTotal(done: DoneTodayCounts | null, gotIt: number): number | null {
  if (!done) return null;
  return done.replies + done.payments + done.dates + done.delivered + done.bookings + done.inquiries + done.meetings + done.cancels + gotIt;
}

/** The honest notes for a read that was refused — drawn in place of the thing they could not count. */
export const DONE_UNREAD_LINE = 'Couldn’t load what you finished today';
export const BILLS_UNREAD_LINE = 'Couldn’t load your booking fees just now';
export const EVENTS_UNREAD_LINE = 'Couldn’t load your bookings just now';

/**
 * The cover's words. `left` = real to-dos still listed (quick + screen + unpaid fee bills); null = the desk could not be
 * read in full, and then NOTHING claims done (the shipped rule: an unread list is never "done").
 *
 * 🔑 "DONE" NEEDS EVERY PART READ. `billsUnread` = the booking-fee bills could not be read: a supplier may owe a fee we
 * cannot see, so the list is never "done" — the tasks we DID read still count. `doneCount` null = today's finished
 * count could not be read: no "N of M done" and no pips are drawn off a guess.
 */
export function todayProgress(
  left: number | null,
  doneCount: number | null,
  opts: { billsUnread?: boolean } = {},
): {
  tasks: string | null;
  progress: string | null;
  allDone: boolean;
  /** The pips under the words; null = not drawn (something was unread). */
  pips: { done: number; total: number } | null;
} {
  if (left === null) return { tasks: null, progress: null, allDone: false, pips: null };
  return {
    tasks: left > 0 ? `${formatCount(left)} task${left === 1 ? '' : 's'} today` : null,
    progress: doneCount !== null && doneCount > 0 && left > 0 ? `${formatCount(doneCount)} of ${formatCount(left + doneCount)} done` : null,
    allDone: left === 0 && !opts.billsUnread,
    pips: doneCount === null || opts.billsUnread ? null : { done: doneCount, total: left + doneCount },
  };
}

/* ─── THE GROW PLAN ───────────────────────────────────────────────────────────────────────────────────────────── */

export type GrowMove = { key: string; label: string; line: string; tag: TodayBadgeTag | null; href: string; button: string; icon: TodayRowIcon };

export type GrowStage = {
  n: 1 | 2 | 3 | 4 | 5;
  title: string;
  /** The one line under the title — the signal, in counts ("312 looked · 14 asked in 28 days"). */
  why: string | null;
  moves: GrowMove[];
};

export const GROW_STAGE_TITLES = ['Get set up', 'Get found', 'Get inquiries', 'Win bookings', 'Earn badges and keep them'] as const;

export const SHARE_PAGE_HREF = '/vendor-dashboard/shop/promote#share';
export const PAGE_QR_HREF = myQrHref('page');
export const REVIEW_QR_HREF = myQrHref('reviews');

export type GrowInput = {
  /** A new shop's six steps are drawn on top of Today — stage 1 is already there, so no grow card. */
  setupDrawn: boolean;
  verified: boolean;
  findable: boolean;
  findableHref: string | null;
  /** The first service card with no cover photo (`coverIsSet` false), or null. */
  noCover: { serviceId: string; title: string } | null;
  /** The service cards could not be read — "no card without a cover" is then UNKNOWN, never "every card has one". */
  coversUnread?: boolean;
  views: number | null;
  inquiries28: number | null;
  bookedThisMonth: number | null;
  /** The owner's two lines (Admin › Settings); null = not set → that stage is OFF. */
  cutoffs: { fewInquiries: number | null; fewBookings: number | null };
  hasQuoteDraft: boolean;
  payoutNone: boolean;
  hasMarkComplete: boolean;
  permitDue: boolean;
  completedToGo: string | null;
};

const move = (m: GrowMove) => m;

/**
 * The first stage the shop has not met, and its 1–3 next moves (drawing "Grow your business: five stages, one at a
 * time"). Which stage a shop is in is not stored — it is worked out from the signals each time. A stage whose line is
 * blank is skipped (pick 1), and so is one whose signal could not be read: an unread count decides nothing.
 */
export function growStage(i: GrowInput): GrowStage | null {
  if (i.setupDrawn) return null;
  if (!i.verified) {
    return {
      n: 1,
      title: GROW_STAGE_TITLES[0],
      why: 'While Setnayan checks your shop',
      moves: [
        move({ key: 'g-docs', label: 'Send your documents', line: 'Setnayan checks them', tag: badge('Setnayan Verified'), href: RENEW_PAPERS_HREF, button: 'Send', icon: 'file' }),
        move({ key: 'g-qr', label: 'Download your QR', line: 'Put it on your photos, posts and cards', tag: PAGE, href: PAGE_QR_HREF, button: 'Open QR', icon: 'scan' }),
      ],
    };
  }
  if (!i.findable || i.noCover) {
    const moves: GrowMove[] = [];
    if (!i.findable && i.findableHref) moves.push(move({ key: 'g-find', label: 'Couples can’t find you yet', line: 'Ask us to list your shop', tag: PAGE, href: i.findableHref, button: 'Ask us', icon: 'shop' }));
    if (i.noCover) moves.push(move({ key: 'g-cover', label: 'Add a cover photo', line: 'Couples see your initials, not a photo', tag: PAGE, href: `/vendor-dashboard/services/${i.noCover.serviceId}`, button: 'Add photo', icon: 'image' }));
    if (moves.length) return { n: 2, title: GROW_STAGE_TITLES[1], why: null, moves };
  }
  // 🔑 Stage 2 could not be judged (the cards were unread): the shop is NOT moved on to stage 3+ on a guess.
  if (i.coversUnread) return null;
  const looked = i.views != null && i.inquiries28 != null ? `${formatCount(i.views)} looked · ${formatCount(i.inquiries28)} asked in 28 days` : null;
  if (i.cutoffs.fewInquiries !== null && i.inquiries28 !== null && i.inquiries28 < i.cutoffs.fewInquiries) {
    return {
      n: 3,
      title: GROW_STAGE_TITLES[2],
      why: looked,
      moves: [
        move({ key: 'g-share', label: 'Share your page', line: 'Send the link where couples already follow you', tag: PAGE, href: SHARE_PAGE_HREF, button: 'Share', icon: 'people' }),
        move({ key: 'g-print', label: 'Print your QR', line: 'They scan and open your Setnayan page', tag: badge('Trending Now'), href: PAGE_QR_HREF, button: 'Open QR', icon: 'scan' }),
      ],
    };
  }
  if (i.cutoffs.fewBookings !== null && i.bookedThisMonth !== null && i.bookedThisMonth < i.cutoffs.fewBookings) {
    const moves: GrowMove[] = [
      move({ key: 'g-reply', label: 'Reply within 1 hour', line: 'Every inquiry, 7am to 7pm', tag: badge('Quick Responder'), href: '/vendor-dashboard/customers', button: 'Open', icon: 'chat' }),
    ];
    if (i.hasQuoteDraft) moves.push(move({ key: 'g-quote', label: 'Send your quote', line: 'You wrote it and never sent it', tag: null, href: '/vendor-dashboard/customers?seg=money&open=proposals', button: 'Open', icon: 'file' }));
    if (i.payoutNone) moves.push(move({ key: 'g-pay', label: 'Where couples pay you', line: 'Add GCash or a bank', tag: badge('Hot Booking'), href: '/vendor-dashboard/profile#pay', button: 'Add', icon: 'peso' }));
    return { n: 4, title: GROW_STAGE_TITLES[3], why: `${formatCount(i.bookedThisMonth)} booked this month`, moves: moves.slice(0, 3) };
  }
  const moves: GrowMove[] = [];
  if (i.hasMarkComplete) moves.push(move({ key: 'g-done', label: 'I delivered this service', line: 'After each event', tag: badge(i.completedToGo ? `Completed bookings · ${i.completedToGo}` : 'Completed bookings'), href: '#today-quick', button: 'Open', icon: 'check' }));
  moves.push(move({ key: 'g-review-qr', label: 'Show the review QR on the day', line: 'Guests scan and rate what they saw', tag: PAGE, href: REVIEW_QR_HREF, button: 'Open QR', icon: 'star' }));
  if (i.permitDue) moves.push(move({ key: 'g-permit', label: 'Renew your permit', line: 'Keep your Verified badge', tag: badge('Setnayan Verified'), href: RENEW_PAPERS_HREF, button: 'Upload', icon: 'file' }));
  return { n: 5, title: GROW_STAGE_TITLES[4], why: null, moves: moves.slice(0, 3) };
}

/* ─── WHAT'S TRENDING ─────────────────────────────────────────────────────────────────────────────────────────── */

export type TrendLine = { key: string; emoji: string; label: string; line: string; button: string; href: string; tag?: TodayBadgeTag | null };

const MONTH_NAME = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });

/**
 * Two or three short lines (drawing part 4). The hottest month (highest `MonthHeat.total`), the first look (already
 * sorted by total), and a card holding Trending Now. The radar only surfaces a bucket that cleared its minimum, so a
 * quiet market gives no line — and with none, the strip is hidden. No percentages: the radar holds totals only.
 * An unread radar gives no line either (it is never "nothing is trending").
 */
export function trendingLines(radar: DemandRadar | null, trendingCard: { title: string } | null): TrendLine[] {
  const out: TrendLine[] = [];
  const hot = radar?.hasData ? [...radar.months].sort((a, b) => b.total - a.total)[0] : undefined;
  if (hot && hot.total > 0) {
    const d = new Date(`${hot.month.slice(0, 10)}T00:00:00Z`);
    const name = Number.isNaN(d.getTime()) ? hot.label : MONTH_NAME.format(d);
    out.push({ key: 't-month', emoji: '🔥', label: `Uy, ${name} is hot`, line: 'The month couples near you plan for most', button: 'See the month', href: '/vendor-dashboard/customers?seg=dates' });
  }
  const look = radar?.hasData ? radar.looks[0] : undefined;
  if (look && look.total > 0) {
    out.push({ key: 't-look', emoji: '🎞', label: `${look.label} is the look right now`, line: 'The style couples near you pick most', button: 'See looks', href: '/vendor-dashboard/shop#analytics' });
  }
  if (trendingCard) {
    out.push({ key: 't-card', emoji: '📈', label: `Your ${trendingCard.title} is Trending`, line: 'Share it while it’s hot', button: 'Share it', href: SHARE_PAGE_HREF, tag: badge('Trending Now badge') });
  }
  return out;
}

/* ─── THE NEXT BADGE CARD ─────────────────────────────────────────────────────────────────────────────────────── */

/** "Next badge: Bronze at 5 bookings" + "2 to go" — split off the tile's own `nextShort` ("Bronze at 5 bookings · 2 to go"). */
export function nextBadgeWords(nextShort: string | null): { title: string; toGo: string } | null {
  const m = /^(.+) · (.+ to go)$/.exec(nextShort ?? '');
  return m ? { title: `Next badge: ${m[1]}`, toGo: m[2]! } : null;
}

/**
 * 🌱🖼 + ▦ THE SHOP'S OWN ROOM TO GROW, AS TASKS (owner 18 Nov 2026, on Today: *"so we want tasks on inspiration
 * library · or if you have a plan and there is more service cards to do. then you can create cards? so we want to
 * deplete their cards. or maximize their potential."*).
 *
 * Two rows in the "Also for your page" list — never counted toward done (pick 2), each clearable with "Not now":
 *   · the inspiration library, for a shop whose trades supply a part (the shipped `moodboardLibraryAccessForProfile`
 *     gate) — the shipped door's row (`INSPIRATION_LIBRARY_ROW`), now with the count of approved photos;
 *   · the cards the plan still lets the shop TURN ON — "You can turn on 2 more service cards" (owner 19 Nov: *"we
 *     already agreed they can add as many … so we can motivate them to upgrade"* — making a card is unlimited, the plan
 *     counts the LIVE ones, `lib/live-cards-cap.ts`). Counted exactly as the live gate counts them (`liveCardsCapRefusal`:
 *     `serviceCardsTotal` vs the live cards, branch copies left out), and only when every number was read — an unread
 *     number decides nothing: no row (never a guessed "you have room"). With every live spot used AND a card waiting
 *     hidden, the row is the 🔒 Problem → Solution: the plan's own sentence, and the door to the plans.
 */
export const LIBRARY_TASK_KEY = 'grow-library';
export const CARDS_TASK_KEY = 'grow-cards';
export const NEW_CARD_HREF = '/vendor-dashboard/services/new';

export type RoomRow = { key: string; label: string; line: string; href: string; button: string; icon: TodayRowIcon };

/** Where a hidden card is turned on (Shop › Services) and where the plans are. */
export const CARDS_TURN_ON_HREF = '/vendor-dashboard/shop#services';
export const PLANS_HREF = '/vendor-dashboard/subscription';
export const CARDS_LOCK_KEY = 'grow-cards-lock';

export function roomToGrowRows(i: {
  library: { open: boolean; photos: number | null; href: string; label: string };
  /** `allowed` = the plan's live total (Infinity = no limit) · `live` / `hidden` = this shop's cards, branch copies out. */
  cards: { allowed: number | null; live: number | null; hidden: number | null };
}): RoomRow[] {
  const out: RoomRow[] = [];
  const { allowed, live, hidden } = i.cards;
  const cards = (n: number) => `${formatCount(n)} more service ${n === 1 ? 'card' : 'cards'}`;
  if (allowed !== null && live !== null && hidden !== null && Number.isFinite(allowed)) {
    const left = allowed - live;
    if (left > 0) {
      // Room to turn one on: a hidden card first (one tap away); with none hidden, the way is to make one.
      out.push({
        key: CARDS_TASK_KEY,
        label: `You can turn on ${cards(left)}`,
        line: hidden > 0 ? `${formatCount(hidden)} hidden · your plan shows ${formatCount(allowed)} live` : `Your plan shows ${formatCount(allowed)} live · ${formatCount(live)} on now`,
        href: hidden > 0 ? CARDS_TURN_ON_HREF : NEW_CARD_HREF,
        button: hidden > 0 ? 'Turn on' : 'Make a card',
        icon: 'shop',
      });
    } else if (hidden > 0) {
      // 🔒 Every live spot is used and a card waits hidden: the Problem, then the Solution — never a dead row.
      out.push({
        key: CARDS_LOCK_KEY,
        label: `🔒 Your plan shows ${formatCount(allowed)} service ${allowed === 1 ? 'card' : 'cards'} live`,
        line: `${formatCount(hidden)} hidden · hide one, or upgrade to show more`,
        href: PLANS_HREF,
        button: 'See plans',
        icon: 'shop',
      });
    }
  }
  if (i.library.open) {
    const p = i.library.photos;
    out.push({
      key: LIBRARY_TASK_KEY,
      label: i.library.label,
      line: p === null ? 'Your photos help couples find you' : p === 0 ? 'None yet · couples find you through them' : `${p} in the library · add more so couples find you`,
      href: i.library.href,
      button: 'Add photos',
      icon: 'image',
    });
  }
  return out;
}
