/**
 * date-change.ts — A CLASHING DATE GOES TO THE SUPPLIER IN CONFLICT, WHO DECIDES
 * (pure: no I/O; the server half is `lib/date-change.server.ts`).
 *
 * Owner 2026-10-01, DECISION_LOG: "AMENDS THE ROW ABOVE — A CLASHING DATE GOES
 * TO THE SUPPLIER IN CONFLICT…" + "THE CLASHING-DATE FLOW — APPROVED WITH THE
 * CONTROLLER'S THREE SAFEGUARDS"; 2026-10-02 "Q7 + Q8" (a date every booked
 * supplier CAN do applies at Apply with a plain notice — no decision).
 *
 *   · The couple's clashing pick → ONE request naming the conflicting booked
 *     suppliers (`event_date_change_requests` + `_answers`). The event keeps
 *     its date; guests see nothing; the couple can withdraw anytime.
 *   · Each conflicting supplier: **Move to <date>** · **Unlock my service**.
 *   · After 3 days unanswered the couple chooses: keep waiting · drop that
 *     supplier · cancel the change.
 *   · Every supplier answered → the new date enters the draft and applies
 *     through Apply (the Maker rule) — `dateMoveClearance` is the one rule.
 *
 * 💸 AVAILABILITY ONLY — never budget (owner 2026-10-01, "BUDGET IS FOR
 * TRACKING, NEVER FOR LIMITING"): nothing here reads a price, a plan total or a
 * budget, and no supplier is asked, dropped or released for money.
 */
import { formatEventDateWithPrecision, type EventDatePrecision } from './events';
import { formatCount } from './format-number';

/** Days a supplier has to answer before the couple may choose (safeguard 2). */
export const DATE_CHANGE_DUE_DAYS = 3;

export type DateChangeAnswer = 'asked' | 'moved' | 'unlocked' | 'dropped';

/** The couple's choices on Home — the one action field `hubDraftAction` reads. */
export const DATE_CHANGE_ACTIONS = ['ask', 'withdraw', 'wait', 'drop'] as const;
export type DateChangeAction = (typeof DATE_CHANGE_ACTIONS)[number];
export function isDateChangeAction(v: unknown): v is DateChangeAction {
  return typeof v === 'string' && (DATE_CHANGE_ACTIONS as readonly string[]).includes(v);
}

/** The supplier's two buttons. */
export const SUPPLIER_DATE_ANSWERS = ['moved', 'unlocked'] as const;
export type SupplierDateAnswer = (typeof SUPPLIER_DATE_ANSWERS)[number];
export function isSupplierDateAnswer(v: unknown): v is SupplierDateAnswer {
  return typeof v === 'string' && (SUPPLIER_DATE_ANSWERS as readonly string[]).includes(v);
}

/**
 * 🗓 MAY A NEW DATE GO LIVE? THE ONE RULE (Apply asks it; so does the db test).
 *
 *   `clashing` — the booked rows whose calendar the new date clashes with
 *                (`clashesForMatrix`, the shipped availability read);
 *   `moved`    — the rows whose supplier answered Move for exactly this date.
 *
 * Cleared when every clashing booked supplier has moved. A date nobody clashes
 * with is cleared with no answer at all (Q8). An unlocked or dropped supplier is
 * no longer booked, so it is not in `clashing` to begin with.
 */
export function dateMoveClearance(input: {
  clashing: readonly string[];
  moved: readonly string[];
}): { cleared: boolean; waitingOn: string[] } {
  const moved = new Set(input.moved);
  const waitingOn = [...new Set(input.clashing)].filter((id) => !moved.has(id));
  return { cleared: waitingOn.length === 0, waitingOn };
}

/** One answer row, as the reads hand it over. */
export type DateChangeAnswerRow = {
  event_vendor_id: string;
  vendor_profile_id: string;
  answer: DateChangeAnswer;
  due_at: string;
  answered_at: string | null;
  money_flag_id: string | null;
};

/** One conflicting SUPPLIER (a package's anchor + cascade rows are one). */
export type DateChangeSupplier = {
  vendorProfileId: string;
  /** Every booked row of theirs in the request; the first is the one to act on. */
  eventVendorIds: string[];
  name: string;
  answer: DateChangeAnswer;
  dueAt: string;
  /** Unanswered past the 3 days — the couple may choose now. */
  overdue: boolean;
  /** Money was logged against the booking and went to the manual path. */
  moneyToSettle: boolean;
};

export type DateChangeView = {
  requestId: string;
  proposedDate: string;
  proposedPrecision: EventDatePrecision;
  fromDate: string | null;
  fromPrecision: EventDatePrecision;
  askedAt: string;
  suppliers: DateChangeSupplier[];
  answered: number;
  total: number;
  /** No supplier is still deciding — the date can go to Apply. */
  ready: boolean;
};

const ANSWER_RANK: Record<DateChangeAnswer, number> = { asked: 0, dropped: 1, unlocked: 2, moved: 3 };

/** Rows → one entry per supplier (an 'asked' row anywhere keeps them asked). */
export function summarizeDateChange(input: {
  requestId: string;
  proposedDate: string;
  proposedPrecision: EventDatePrecision;
  fromDate: string | null;
  fromPrecision?: EventDatePrecision;
  askedAt: string;
  rows: readonly DateChangeAnswerRow[];
  names: ReadonlyMap<string, string>;
  now: number;
}): DateChangeView {
  const bySupplier = new Map<string, DateChangeAnswerRow[]>();
  for (const r of input.rows) {
    const list = bySupplier.get(r.vendor_profile_id);
    if (list) list.push(r);
    else bySupplier.set(r.vendor_profile_id, [r]);
  }
  const suppliers: DateChangeSupplier[] = [];
  for (const [vendorProfileId, rows] of bySupplier) {
    const answer = rows.reduce<DateChangeAnswer>((a, r) => (ANSWER_RANK[r.answer] < ANSWER_RANK[a] ? r.answer : a), 'moved');
    const dueAt = rows.map((r) => r.due_at).sort()[0] ?? rows[0]!.due_at;
    suppliers.push({
      vendorProfileId,
      eventVendorIds: rows.map((r) => r.event_vendor_id),
      name: input.names.get(rows[0]!.event_vendor_id) ?? 'A booked supplier',
      answer,
      dueAt,
      overdue: answer === 'asked' && new Date(dueAt).getTime() <= input.now,
      moneyToSettle: rows.some((r) => r.money_flag_id !== null),
    });
  }
  suppliers.sort((a, b) => a.name.localeCompare(b.name));
  const answered = suppliers.filter((s) => s.answer !== 'asked').length;
  return {
    requestId: input.requestId,
    proposedDate: input.proposedDate,
    proposedPrecision: input.proposedPrecision,
    fromDate: input.fromDate,
    fromPrecision: input.fromPrecision ?? 'day',
    askedAt: input.askedAt,
    suppliers,
    answered,
    total: suppliers.length,
    ready: suppliers.length > 0 && answered === suppliers.length,
  };
}

/** "Saturday, July 6, 2030" · "July 2030" — what every line calls the date. */
export function dateChangeWhen(date: string, precision: EventDatePrecision): string {
  return formatEventDateWithPrecision(date, precision) || date;
}

/** Home's line (owner wording): "Date change: 1 of 2 suppliers answered". */
export function dateChangeHomeLine(view: Pick<DateChangeView, 'answered' | 'total'>): string {
  return `Date change: ${formatCount(view.answered)} of ${formatCount(view.total)} supplier${view.total === 1 ? '' : 's'} answered`;
}

/** What one supplier's answer reads as on the couple's Home. */
export function dateChangeAnswerLine(s: DateChangeSupplier, now: number): string {
  switch (s.answer) {
    case 'moved':
      return 'Can move to the new date';
    case 'unlocked':
      return s.moneyToSettle
        ? 'Unlocked their service — the payment is settled by your booking’s cancellation terms'
        : 'Unlocked their service';
    case 'dropped':
      return s.moneyToSettle
        ? 'You released them — the payment is settled by your booking’s cancellation terms'
        : 'You released them';
    case 'asked': {
      if (s.overdue) return 'No answer after 3 days';
      const hours = Math.max(1, Math.ceil((new Date(s.dueAt).getTime() - now) / 3_600_000));
      return hours >= 24 ? `Deciding · ${Math.ceil(hours / 24)} day${hours > 24 ? 's' : ''} left` : `Deciding · ${hours} h left`;
    }
  }
}

/** The plain Q8 notice (owner): "The date moved to <date>". */
export function dateMovedNotice(date: string, precision: EventDatePrecision): string {
  return `The date moved to ${dateChangeWhen(date, precision)}`;
}

/** Why the couple's ask was not made, in words. */
export function dateChangeRefusalText(reason: string | undefined): string {
  switch (reason) {
    case 'already_open':
      return 'You already asked your suppliers about another date. Withdraw that request on Home first.';
    case 'not_booked':
      return 'One of those suppliers is no longer booked. Pick the date again.';
    case 'nobody_to_ask':
    case 'fits':
      return 'This date works with every booked supplier — it saves to your draft as it is.';
    case 'not_couple':
      return 'Only the couple can ask a booked supplier to move.';
    case 'not_due':
      return 'They still have time to answer.';
    case 'not_open':
      return 'That request is already closed.';
    default:
      return 'That did not go through. Nothing changed — please try again.';
  }
}

/**
 * What the supplier's Today page says after a press (`?date_answer=`). Success
 * is not silent here: Unlock releases a booking, so the page says what that
 * means for the money.
 */
export const DATE_ANSWER_NOTICE: Record<string, string> = {
  moved: 'Done — you told them you can move. Your held day moves with the date when they apply it.',
  unlocked:
    'Done — your service is unlocked and the booking released. Any payment is settled by the cancellation terms on the booking; Setnayan support has the case if money was logged.',
  already: 'That was already answered, or the couple withdrew it — nothing changed.',
  not_yours: 'That request belongs to another shop — nothing changed.',
  failed: 'That did not go through. Nothing changed — please try again.',
};
