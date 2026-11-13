/**
 * 💸 BOOKING-FEE TOP-UP — SIX RULES (owner, DECISION_LOG 2026-11-12 "BOOKING-FEE TOP-UP — SIX RULES"; prototype
 * specs `Build_Booking_Fee_Hold_2026-11-12/booking-fee-hold.html`).
 *
 * When a booked quote rises, the supplier's booking fee grows by a TOP-UP — the `amendment_delta` charge the shipped
 * re-derive (`booking_fee_rederive_lock_fee`) already mints. Nothing here makes or prices that charge. This module is
 * the ONE place that says WHEN it is owed and what each surface says about it:
 *
 *   1 · DUE on the event day ("Due today"); gated only from the DAY AFTER.
 *   2 · may be settled EARLY — before the event day the pay door reads "Settle early".
 *   3 · a FREE first booking stays free at any amended total (SQL `free_noop`, untouched — pinned by
 *       tests/db/a-top-up-is-held-until-the-event-day.db.test.ts).
 *   4 · before the event day it is HELD, not owed: no page gate, no carry-over onto a new booking until overdue.
 *   5 · who is told: the shipped chat line + Today's `booking_fee_overdue` blocker. NO email.
 *   6 · a quote that later drops changes no paid amount and shows no credit.
 *
 * PURE: no `server-only`, no database, no clock of its own (every function takes `todayPh`), so a test executes every
 * state. The SQL twin of `topUpIsHeld` is `public.booking_fee_top_up_is_held` (migration 20271340632149).
 */
import { feePesos, formatDueDate } from '@/lib/booking-fee-disclosure';

/** The charge kind the re-derive mints for a rise — the top-up. */
export const TOP_UP_CHARGE_KIND = 'amendment_delta';

/** The statuses that still owe money on a top-up (the shipped `FEE_UNSETTLED_STATUSES` minus the void `expired`). */
const TOP_UP_OWING: ReadonlySet<string> = new Set(['pending', 'failed']);

/** Where a top-up stands on `todayPh` (Manila `YYYY-MM-DD`): before its day · on it · after it. */
export type TopUpStage = 'held' | 'due_today' | 'overdue';

/** `YYYY-MM-DD` or a timestamp → its `YYYY-MM-DD` (the same `slice(0, 10)` every due-date reader uses). */
function ymd(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/**
 * The stage of a top-up due on `dueOn`. Compared as STRINGS (never `new Date('2027-03-14')`, which is the 13th in
 * Manila). An unknown due day is `overdue` — the shipped behaviour (it decided as an ordinary unpaid fee), never a
 * guessed "held".
 */
export function topUpStage(dueOn: string | null | undefined, todayPh: string): TopUpStage {
  const due = ymd(dueOn);
  if (!due) return 'overdue';
  if (due > todayPh) return 'held';
  if (due === todayPh) return 'due_today';
  return 'overdue';
}

/**
 * RULE 1 + 4 · is this charge a top-up that is HELD — owed from the day after its due day, and not before?
 * The twin of SQL `booking_fee_top_up_is_held`: kind `amendment_delta`, still owing, due day ≥ today.
 */
export function topUpIsHeld(
  charge: { kind?: string | null; status?: string | null; dueAt?: string | null },
  todayPh: string,
): boolean {
  if (charge.kind !== TOP_UP_CHARGE_KIND) return false;
  if (!TOP_UP_OWING.has(charge.status ?? '')) return false;
  if (!ymd(charge.dueAt)) return false;
  return topUpStage(charge.dueAt, todayPh) !== 'overdue';
}

/** One top-up bill, as a carry-over reads it. */
export type TopUpBill = { orderId: string; amountPhp: number; dueOn: string | null; topUp?: boolean };

/**
 * RULE 4 · THE CARRY-OVER. The top-ups that stop a NEW booking's yes: only the OVERDUE ones. A held top-up (before
 * or on the event day) carries nothing over. Oldest-due first, so the sheet names the one that has waited longest.
 */
export function overdueTopUps<T extends TopUpBill>(bills: readonly T[], todayPh: string): T[] {
  return bills
    .filter((b) => b.topUp === true && Number.isFinite(b.amountPhp) && b.amountPhp > 0)
    .filter((b) => topUpStage(b.dueOn, todayPh) === 'overdue')
    .sort((a, b) => (a.dueOn ?? '').localeCompare(b.dueOn ?? ''));
}

/** What the overdue top-ups add up to, to the centavo. */
export function topUpOwedPhp(bills: readonly TopUpBill[]): number {
  return Math.round(bills.reduce((s, b) => s + (b.amountPhp > 0 ? b.amountPhp : 0), 0) * 100) / 100;
}

/**
 * EVERY WORD THE TOP-UP SAYS, in one place (the prototype's copy, verbatim where it gives one). Amounts go through
 * `feePesos` — to the centavo, never rounded.
 */
export const TOP_UP_WORDS = {
  /** The bill row before the event day (prototype: "Booking fee grows by ₱X · held until 14 Mar"). */
  grows: (amountPhp: number, dueOn: string | null) =>
    `Booking fee grows by ${feePesos(amountPhp)}${dueOn ? ` · held until ${formatDueDate(dueOn)}` : ''}`,
  heldDetail:
    'Your quote rose, so your Setnayan booking fee grows by this top-up. It is due on the event day — nothing closes before then, and you may settle it early.',
  dueTodayHeadline: (amountPhp: number) => `Booking fee top-up · Due today — ${feePesos(amountPhp)}`,
  dueTodayDetail:
    'Today is the event day, so the top-up is due today. Nothing closes today; settle it before tomorrow to keep this event open.',
  overdueHeadline: (amountPhp: number) => `Booking fee top-up overdue — ${feePesos(amountPhp)}`,
  /** The stage badge (prototype `STAGE_BADGE`). */
  badge: { held: 'Held', due_today: 'Due today', overdue: 'Overdue' } as const satisfies Record<TopUpStage, string>,
  /** RULE 2 · the pay door before the event day. */
  settleEarly: 'Settle early',
  settle: 'Settle',
  /** After the event day, unsettled: every page but Chat and Report. */
  pageGated: (amountPhp: number) => `Settle ${feePesos(amountPhp)} booking fee to open this`,
  /** The (+) sheet's every tool, and the words-only message box. */
  toolGated: (amountPhp: number) => `Settle ${feePesos(amountPhp)} booking fee to use this`,
  /** Portfolio tiles and the review from that event. */
  unlisted: 'Unlisted and uncounted until the top-up is settled',
  /** The booking ask's Accept while a top-up elsewhere is overdue. */
  settleToAccept: (amountPhp: number) => `Settle ${feePesos(amountPhp)} to accept`,
} as const;

/** The pay door's label for one top-up: "Settle early" before the event day (rule 2), "Settle" from it. */
export function topUpPayLabel(dueOn: string | null | undefined, todayPh: string): string {
  return topUpStage(dueOn, todayPh) === 'held' ? TOP_UP_WORDS.settleEarly : TOP_UP_WORDS.settle;
}

/**
 * RULE 5 · WHO THE FEE SWEEP MAY EMAIL — an ALLOW-list, never a deny-list (audit hold, 13 Nov).
 *
 * The sweep used to read the top-ups and email everything NOT in that set — so a refused read (an empty set) emailed
 * every due order, top-ups included, exactly what rule 5 forbids. Now an order is emailed only when its own charge was
 * READ and is not a top-up:
 *   · `charges === null` (the read failed) → nobody;
 *   · an empty read → nobody;
 *   · an order whose charge is missing from the read, or names no charge → not emailed.
 */
export function feeOrdersToEmail<T extends { chargeId: string | null }>(
  orders: readonly T[],
  charges: ReadonlyArray<{ charge_id: string; kind: string | null }> | null,
): T[] {
  if (charges === null || charges.length === 0) return [];
  const ordinary = new Set(
    charges.filter((c) => typeof c.kind === 'string' && c.kind !== TOP_UP_CHARGE_KIND).map((c) => c.charge_id),
  );
  return orders.filter((o) => o.chargeId !== null && ordinary.has(o.chargeId));
}

/**
 * WORDS ONLY — ON A NEW INQUIRY, NEVER ON A BOOKED CLIENT (audit hold, 13 Nov; prototype "New inquiry · text only",
 * "Text replies only until you settle ₱X booking fee … booked clients are unaffected").
 *
 * The shop's OVERDUE top-ups — from ANY of its events — narrow the message box to words on a thread where the shop is
 * NOT booked. A booked thread (the couple who owes the top-up included) keeps files. `booked === null` (the booked read
 * failed) or `charges === null` (the top-up read failed) narrows nothing — the chat is one of the always-open three,
 * and a refused read must not read as "this client is unbooked". Returns the pesos owed, or null.
 */
export function wordsOnlyTopUpPhp(input: {
  booked: boolean | null;
  charges: ReadonlyArray<{ amount_charged_centavos: number | string | null; expires_at: string | null }> | null;
  todayPh: string;
}): number | null {
  if (input.booked !== false || input.charges === null) return null;
  const centavos = input.charges
    .filter((r) => topUpStage(r.expires_at, input.todayPh) === 'overdue')
    .reduce((sum, r) => sum + Math.max(0, Number(r.amount_charged_centavos ?? 0) || 0), 0);
  return centavos > 0 ? centavos / 100 : null;
}
