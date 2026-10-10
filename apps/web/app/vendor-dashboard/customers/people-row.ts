/**
 * people-row.ts — WHAT ONE ROW OF Customers › People SAYS, decided in one pure
 * step (supplier redesign S-PR2; corpus
 * `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 2 "Customers" + § 3;
 * prototype `prototypes/supplier_dashboard_2026-10-08_fable.html` frame 03).
 *
 *   avatar · name · event line · stage pill · ONE line (the next step)
 *
 * The lane is NOT decided here — `lib/vendor-customer-pipeline.ts` owns who is
 * waiting, talking, booked. This file only chooses the pill's word and the one
 * line under it, from facts the page has already read.
 *
 * 🔴 A FACT THAT COULD NOT BE READ SAYS NOTHING. `quoted: null` (the quote read
 * failed) draws "Talking" with no line — never "send a quote" to a shop whose
 * quote is already out. `moneyRead: false` (payday did not reach the server's
 * count) draws no money line — never "no plan yet" over a plan we did not see.
 *
 * 📌 THE CLOSED LINES LIVE HERE NOW. Today's "Nothing to answer" list held a
 * booking ask whose window closed, a flagged delay, and a proposed meeting
 * whose time passed. That list is gone (owner answer 3, 2026-10-10: remove it
 * in the PR that shows those facts on People); each is the row's own line here,
 * decided by the SAME predicates the desk uses (`lockAskPhase`, the
 * `booking_handovers.status = 'disputed'` read, `meetingAskPhase`) — never a
 * second definition.
 *
 * PURE: no I/O, no clock of its own (`nowMs` is passed in), safe in a test.
 */
import { lockAskPhase } from '@/lib/answers-desk';
import { monthDay } from '@/lib/format-date';
import { lockRequestFuseLabel, lockRequestHoursLeft } from '@/lib/lock-request-state';
import { formatPhp } from '@/lib/php';
import type { PaydayInstallmentRow } from '@/lib/vendor-cashflow';
import type { CustomerLane, PipelineCustomer } from '@/lib/vendor-customer-pipeline';
import type { EventMoneyPosition } from '@/lib/vendor-customers';
import { waitingAge } from '@/lib/waiting-age';

/** `ask` = they asked you (the brand tint) · `warn` = on you · `ok` = booked · `quiet` = nothing owed. */
export type PeoplePillTone = 'ask' | 'warn' | 'ok' | 'quiet';

/** The next instalment still to come in for one event. */
export type NextDue = { amountPhp: number | null; dueDate: string | null };

export type PeopleFacts = {
  /** A quote is out with this couple (sent / viewed). `null` = that read failed. */
  quoted: boolean | null;
  /** The event's money position, or null when it has no plan rows. */
  money: EventMoneyPosition | null;
  /** False when the payday read did not reach the server's count — say nothing about money. */
  moneyRead: boolean;
  nextDue: NextDue | null;
  /** The couple flagged something this shop handed over as late (`booking_handovers`). */
  delayFlagged: boolean;
  /** A time the couple proposed has been and gone with no answer. */
  meetingPassed: boolean;
  /**
   * The deadline of a booking ask that ALREADY READS `expired` — the sweep
   * (`lib/lock-request-expiry.ts`) has flipped it — and is still inside the week
   * the desk keeps a closed line (`lockAskPhase(…) === 'lapsed'`). Once swept,
   * the row is no longer a `booking_ask` at all (it falls back to its thread's
   * lane), so the fact has to be handed in or it is shown nowhere. Null
   * otherwise. An ask still `pending` past its deadline needs nothing here: the
   * row itself carries the deadline.
   */
  askClosedAt: string | null;
};

export const NO_FACTS: PeopleFacts = {
  quoted: null,
  money: null,
  moneyRead: false,
  nextDue: null,
  delayFlagged: false,
  meetingPassed: false,
  askClosedAt: null,
};

export type PeopleRowView = {
  pill: { label: string; tone: PeoplePillTone };
  /** The one line under the pill, or null when there is nothing true to say. */
  line: string | null;
  lineTone: 'warn' | 'ok' | null;
  /**
   * Where the row goes: the conversation (an ask, or a flag to answer in your
   * own words) or the customer's card. The roster turns this into the href.
   */
  opens: 'thread' | 'card';
  /** A closed line is on this row — the marker a test and a screenshot can find. */
  closed: 'window' | 'delay' | 'meeting' | null;
};

/** The pill's word for a lane with nothing more specific to say. */
const LANE_PILL: Record<CustomerLane, { label: string; tone: PeoplePillTone }> = {
  waiting: { label: 'Asked', tone: 'ask' },
  holding: { label: 'Holding', tone: 'warn' },
  talking: { label: 'Talking', tone: 'quiet' },
  booked: { label: 'Booked', tone: 'ok' },
  finished: { label: 'Done', tone: 'quiet' },
};

/**
 * The earliest instalment still to come in, per event. Rows with no due date
 * sort last (a known date is the thing a shop can plan on). Confirmed rows are
 * never "next".
 */
export function nextDueByEvent(rows: readonly PaydayInstallmentRow[]): Map<string, NextDue> {
  const out = new Map<string, NextDue & { seq: number }>();
  for (const r of rows) {
    if (r.confirmed) continue;
    const cur = out.get(r.event_id);
    const earlier =
      !cur ||
      (r.due_date !== null && (cur.dueDate === null || r.due_date < cur.dueDate)) ||
      (r.due_date === cur.dueDate && r.seq < cur.seq);
    if (earlier) out.set(r.event_id, { amountPhp: r.amount_php, dueDate: r.due_date, seq: r.seq });
  }
  return new Map([...out].map(([k, v]) => [k, { amountPhp: v.amountPhp, dueDate: v.dueDate }]));
}

/** "₱42,000 due Oct 3" · "paid in full" · "no plan yet" — or null when money was not read. */
export function moneyLine(f: PeopleFacts): { text: string; tone: 'ok' | null } | null {
  if (!f.moneyRead) return null;
  const m = f.money;
  if (!m || m.allUnresolved || m.installmentCount === 0) return { text: 'no plan yet', tone: null };
  if (m.fullyPaid) return { text: 'paid in full', tone: 'ok' };
  if (m.balancePhp > 0) {
    const due = f.nextDue?.dueDate ? monthDay(f.nextDue.dueDate) : null;
    if (f.nextDue && f.nextDue.amountPhp !== null && due) {
      return { text: `${formatPhp(f.nextDue.amountPhp)} due ${due}`, tone: null };
    }
    return { text: `${formatPhp(m.balancePhp)} to come in`, tone: null };
  }
  return { text: 'settled', tone: 'ok' };
}

/** "Oct 3" for the day a booking ask's window closed, read in Manila like the desk card. */
function closedDay(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const at = new Date(expiresAt);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }).format(at);
}

export function peopleRowView(r: PipelineCustomer, f: PeopleFacts, nowMs: number): PeopleRowView {
  // ── The three closed lines first: each replaces what the lane would say. ──
  const unswept = r.waitingKind === 'booking_ask' && lockAskPhase(r.expiresAt, nowMs) !== 'answerable';
  if (unswept || f.askClosedAt) {
    const day = closedDay(unswept ? r.expiresAt : f.askClosedAt);
    return {
      pill: { label: 'Closed', tone: 'quiet' },
      line: day ? `booking window closed ${day}` : 'booking window closed',
      lineTone: null,
      opens: 'card',
      closed: 'window',
    };
  }
  if (f.delayFlagged) {
    return {
      pill: LANE_PILL[r.lane],
      line: 'delay flagged',
      lineTone: 'warn',
      // "Read what they said and answer them in your own words" — the conversation.
      opens: r.threadId ? 'thread' : 'card',
      closed: 'delay',
    };
  }
  if (f.meetingPassed) {
    return { pill: LANE_PILL[r.lane], line: 'meeting time passed', lineTone: 'warn', opens: 'card', closed: 'meeting' };
  }

  if (r.lane === 'waiting' && r.waitingKind === 'inquiry') {
    const age = r.waitingSince ? waitingAge(r.waitingSince, nowMs) : null;
    return { pill: LANE_PILL.waiting, line: age?.label ?? null, lineTone: age?.overdue ? 'warn' : null, opens: 'thread', closed: null };
  }
  if (r.lane === 'waiting' && r.waitingKind === 'booking_ask') {
    // The 48-hour window: said in the shared words once it is inside its last day.
    const hours = lockRequestHoursLeft(r.expiresAt, new Date(nowMs));
    const fuse = hours !== null && hours < 24 ? lockRequestFuseLabel(r.expiresAt, new Date(nowMs)) : null;
    return { pill: { label: 'Booking', tone: 'warn' }, line: fuse ?? 'asked to book', lineTone: fuse ? 'warn' : null, opens: 'card', closed: null };
  }
  if (r.lane === 'holding') {
    return {
      pill: LANE_PILL.holding,
      line: r.quietDays === null ? null : `quiet ${r.quietDays} days`,
      lineTone: null,
      opens: 'card',
      closed: null,
    };
  }
  if (r.lane === 'talking') {
    if (f.quoted === null) return { pill: LANE_PILL.talking, line: null, lineTone: null, opens: 'card', closed: null };
    return f.quoted
      ? { pill: { label: 'Quoted', tone: 'quiet' }, line: 'quote pending', lineTone: null, opens: 'card', closed: null }
      : { pill: LANE_PILL.talking, line: 'send a quote', lineTone: null, opens: 'card', closed: null };
  }
  // booked · finished — the money, when it was read.
  const money = moneyLine(f);
  return { pill: LANE_PILL[r.lane], line: money?.text ?? null, lineTone: money?.tone ?? null, opens: 'card', closed: null };
}

/** "Wedding · Mar 13, 2027 · Tagaytay" — the type, the date, the place; a missing part is left out, never invented. */
export function eventLine(parts: { type: string | null; date: string | null; place: string | null }): string {
  const date = parts.date
    ? new Date(`${parts.date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Date not set';
  return [parts.type, date, parts.place].filter((p): p is string => Boolean(p && p.trim())).join(' · ');
}
