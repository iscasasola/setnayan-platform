/**
 * CUSTOMERS › MONEY — what the segment says, decided in one pure place (S-PR4; corpus
 * `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 2 "Merge into Customers › Money: Received · To come in · one
 * meter; 'Next in ▾' rows (one per instalment, Pay/check pills); 'Setnayan' group = booking-fee bills + 'This year'
 * fold (months). Legacy payouts → inside 'This year' only if any exist", frames 05 · 30).
 *
 * 🔑 IT RESHAPES, IT NEVER READS. The rows are the shipped `vendor_payday_installments()` read
 * (`readVendorPaydayInstallments`, paged to the server's count) and the shipped ledger view (`earningsView`). This
 * module only decides what the page prints from them, so a test can run every case — the page is a server component
 * a guard can only grep.
 *
 * ⚠ AN UNREAD FIGURE IS `null`, NEVER 0. A payday read that did not reach the end gives `totals: null` and no rows —
 * the page says "couldn't load" in the figures' own place (frame 15), never "₱0 to come in", which reads as a shop
 * nobody owes. The same for the year: an unread ledger is `year: null`.
 */
import { buildPaydayTimeline, type PaydayInstallment, type PaydayInstallmentRow } from '@/lib/vendor-cashflow';
import type { EarningsView } from '@/lib/vendor-earnings-view';
import { monthDay } from '@/lib/format-date';
import { formatPhp } from '@/lib/php';

/** A row's state tone — the same four words as the shared `Badge` (kind 11). */
export type MoneyBadgeTone = 'ok' | 'wait' | 'no' | 'quiet';

/** "Next in ▾" — the one dropdown's three windows (frame 05: This month · Next month · All). */
export const MONEY_WINDOWS = ['month', 'next', 'all'] as const;
export type MoneyWindow = (typeof MONEY_WINDOWS)[number];

export const MONEY_WINDOW_LABEL: Readonly<Record<MoneyWindow, string>> = {
  month: 'This month',
  next: 'Next month',
  all: 'All',
};

/** The window a URL names (`?next=`). Unknown or missing → This month. */
export function moneyWindowOf(raw: string | string[] | undefined): MoneyWindow {
  const v = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
  return (MONEY_WINDOWS as readonly string[]).includes(v ?? '') ? (v as MoneyWindow) : 'month';
}

/** Received · To come in · the meter (frame 05's top block). */
export type MoneyTotals = {
  /** Instalments the shop has confirmed — money in. */
  receivedPhp: number;
  /** Every resolvable instalment not yet confirmed. */
  toComePhp: number;
  /** Received + to come in — the meter's whole. */
  bookedPhp: number;
  /** Received of booked, 0–100, whole. Null when nothing is booked (no meter to draw). */
  pct: number | null;
  /** Instalments whose amount never resolved (a % of a total that was not set) — said, never summed as 0. */
  unresolved: number;
  /** Past their date and not confirmed. */
  overdue: number;
  /** Booked events behind the figures. */
  bookings: number;
};

/** One "Next in" row — an instalment still to come in. */
export type MoneyRow = {
  key: string;
  eventId: string;
  /** The customer, as the booking names them. */
  title: string;
  /** "Balance · due Oct 3" / "Deposit · no date yet". */
  line: string;
  /** Null ⇒ the amount never resolved; the row prints a dash, never ₱0. */
  amountPhp: number | null;
  badge: { tone: MoneyBadgeTone; word: string } | null;
};

/** One booked customer, for the Log a payment sheet. */
export type MoneyCustomer = {
  eventId: string;
  name: string;
  /** "₱42,000 due Oct 3" / "Paid in full". */
  line: string;
  /** Anything still to come in — those are listed first. */
  open: boolean;
};

export type MoneyPicture = {
  totals: MoneyTotals | null;
  /** Rows in the picked window, overdue first. Empty when unread. */
  rows: MoneyRow[];
  /** How many instalments are still to come in at all (any window) — the "All" row's honesty. */
  openCount: number;
  customers: MoneyCustomer[];
};

const DAY_MS = 86_400_000;

function daysUntil(todayIso: string, dueIso: string): number {
  return Math.round((Date.parse(`${dueIso}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / DAY_MS);
}

/** 'YYYY-MM' of the month after `todayIso`'s. */
function nextMonthKey(todayIso: string): string {
  const y = Number(todayIso.slice(0, 4));
  const m = Number(todayIso.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** Is this unconfirmed instalment inside the window? Overdue ones always count as This month — they are owed now. */
export function inWindow(inst: Pick<PaydayInstallment, 'due_date' | 'overdue'>, window: MoneyWindow, todayIso: string): boolean {
  if (window === 'all') return true;
  if (!inst.due_date) return false;
  const month = inst.due_date.slice(0, 7);
  if (window === 'month') return inst.overdue || month === todayIso.slice(0, 7);
  return month === nextMonthKey(todayIso);
}

/** The state a row shows — a word on a soft fill (kind 11), never colour alone, never pressed. */
export function moneyBadge(inst: Pick<PaydayInstallment, 'due_date' | 'overdue'>, todayIso: string): MoneyRow['badge'] {
  if (inst.overdue) return { tone: 'no', word: 'Overdue' };
  if (!inst.due_date) return { tone: 'quiet', word: 'No date' };
  const d = daysUntil(todayIso, inst.due_date);
  if (d === 0) return { tone: 'wait', word: 'Due today' };
  if (d > 0 && d <= 7) return { tone: 'wait', word: 'Due soon' };
  return null;
}

function rowLine(inst: PaydayInstallment): string {
  const label = inst.label?.trim() || `Payment ${inst.seq}`;
  if (!inst.due_date) return `${label} · no date yet`;
  return `${label} · due ${monthDay(inst.due_date) ?? inst.due_date}`;
}

/**
 * Everything the Money segment prints from the payday read.
 *
 * @param payday  the read, or `null` when it was refused / stopped short (`complete: false`)
 * @param window  the "Next in ▾" pick
 * @param todayIso Manila `YYYY-MM-DD`
 */
export function moneyPicture(
  payday: readonly PaydayInstallmentRow[] | null,
  window: MoneyWindow,
  todayIso: string,
): MoneyPicture {
  if (payday === null) return { totals: null, rows: [], openCount: 0, customers: [] };
  const timeline = buildPaydayTimeline([...payday], todayIso);
  const t = timeline.totals;
  const bookedPhp = t.expectedPhp;
  const totals: MoneyTotals = {
    receivedPhp: t.confirmedPhp,
    toComePhp: t.owedPhp,
    bookedPhp,
    pct: bookedPhp > 0 ? Math.round((t.confirmedPhp / bookedPhp) * 100) : null,
    unresolved: t.unresolvedCount,
    overdue: t.overdueCount,
    bookings: t.eventCount,
  };

  // Every instalment, in the timeline's own order (overdue → dated → undated).
  const all = timeline.months.flatMap((m) => m.installments);
  const open = all.filter((i) => !i.confirmed);
  const overdueFirst = [...open.filter((i) => i.overdue), ...open.filter((i) => !i.overdue)];
  const rows: MoneyRow[] = overdueFirst
    .filter((i) => inWindow(i, window, todayIso))
    .map((i) => ({
      key: i.key,
      eventId: i.event_id,
      title: i.event_name?.trim() || 'A booking',
      line: rowLine(i),
      amountPhp: i.amount_php,
      badge: moneyBadge(i, todayIso),
    }));

  // The Log a payment sheet: one row per booked customer — those still owing first, each with what comes next.
  const byEvent = new Map<string, PaydayInstallment[]>();
  for (const i of all) {
    const list = byEvent.get(i.event_id);
    if (list) list.push(i);
    else byEvent.set(i.event_id, [i]);
  }
  const customers: MoneyCustomer[] = [...byEvent.entries()].map(([eventId, list]) => {
    const next = overdueFirst.find((i) => i.event_id === eventId) ?? null;
    const name = list[0]?.event_name?.trim() || 'A booking';
    const line = next
      ? `${next.amount_php === null ? 'Amount not set ·' : formatPhp(next.amount_php)} ${next.overdue ? 'overdue' : next.due_date ? `due ${monthDay(next.due_date) ?? next.due_date}` : 'no date yet'}`
      : 'Paid in full';
    return { eventId, name, line, open: next !== null };
  });
  customers.sort((a, b) => (a.open === b.open ? a.name.localeCompare(b.name) : a.open ? -1 : 1));

  return { totals, rows, openCount: open.length, customers };
}

/** The "This year" fold — the ledger's months of this calendar year that carry money, newest first. */
export type MoneyYear = {
  receivedPhp: number;
  payments: number;
  months: { ym: string; label: string; php: number; payments: number }[];
};

/** Null ⇒ the ledger was not read: the fold says so, never "₱0 this year". */
export function moneyYear(view: Pick<EarningsView, 'measured' | 'ytdPhp' | 'months'>, todayIso: string): MoneyYear | null {
  if (!view.measured || view.ytdPhp === null) return null;
  const year = todayIso.slice(0, 4);
  const months = view.months
    .filter((m) => m.ym.startsWith(`${year}-`) && m.total_php > 0)
    .map((m) => ({ ym: m.ym, label: m.label.replace(/\s\d{4}$/, ''), php: m.total_php, payments: m.order_count }))
    .reverse();
  return { receivedPhp: view.ytdPhp, payments: months.reduce((n, m) => n + m.payments, 0), months };
}
