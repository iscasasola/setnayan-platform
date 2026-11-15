/**
 * 👥💸 A QUOTE FOLLOWS THE GUEST LIST — the pure mirror of `public.quote_follow_guest_count` (migration
 * 20271339826198; Piece 1 · PR-2; DECISION_LOG 2026-11-12). Owner, verbatim: *"our quotation maker will follow their pax
 * at auto. but they will set the minimum count for their pax. it only goes up as their guests go up."*
 *
 *   · billed = max(the per-service count, the quote's Bill-at-least `merge_snapshot.min_pax`, the pax it was SENT at)
 *   · each per-head line → max(its SENT amount, rate × billed); flat lines never move — never below the minimum or
 *     below what was sent
 *   · a rise lands on the AUTO Final-balance row; every other row, and every paid row, is untouched (a paid auto row
 *     → a new auto row takes the rise)
 *   · a BOOKED deal follows like a `changes_locked` quote (Piece 2, owner 2026-11-12): it rises, never falls — its fee
 *     top-up is held until the event day (20271340632149); a supplier's `changes_locked` quote STILL rises.
 *
 * 📉 THE FALL-BACK (migration 20271340566104; DECISION_LOG 2026-11-12 "WHEN A GUEST IS REMOVED, THE PRICE FALLS BACK —
 * UNLESS THE SUPPLIER LOCKED IT"). Owner: *"if the price is paid, then it stays … it really depends if the supplier
 * already locked the price."*
 *   · an UNLOCKED quote follows the list down as well as up, to the floors above;
 *   · a `changes_locked` quote never falls — floored at the pax it bills now and each line's current amount;
 *   · a drop comes off the unpaid auto Final-balance row(s) only; paid rows never change; it is capped at what is still
 *     unsettled (never under what is paid) — when the full drop would pass it, the quote falls only as far as whole
 *     guests fit. Never a refund, never a credit.

 * ⛔ NEVER A GUESSED RATE. A line follows only when it carries its OWN `basis: 'per_pax'` + `rate_centavos` (written by
 * the quote maker, Piece 1 · PR-1). A quote without them is never repriced.
 *
 * PURE — no I/O. `tests/db/a-quote-follows-the-guest-list.db.test.ts` runs the SQL and this on the same quotes and
 * asserts they agree to the centavo.
 */
import { formatCount } from './format-number';
import { formatCentavosPhp } from './php';

/** The line keys the quote maker writes and the repricer reads (the shared contract with PR-1). */
export const PER_PAX_BASIS = 'per_pax';

export type FollowLine = {
  label?: string;
  detail?: string | null;
  amount_centavos: number | null;
  basis?: string | null;
  rate_centavos?: number | null;
  pax?: number;
  /** 📉 What this line was SENT at — written the first time the repricer moves it; its floor while unlocked. */
  sent_amount_centavos?: number;
  sent_detail?: string | null;
  [k: string]: unknown;
};

export type FollowInstallment = {
  seq: number;
  amount_centavos: number;
  raw_centavos?: number;
  is_auto_balance?: boolean;
  [k: string]: unknown;
};

export type FollowSchedule = {
  base_centavos?: number;
  total_centavos?: number;
  installments?: FollowInstallment[];
  [k: string]: unknown;
};

export type FollowQuote = {
  lines: readonly FollowLine[];
  totalCentavos: number;
  schedule: FollowSchedule | null;
  minPax: number | null;
  billedPax: number | null;
  booked: boolean;
  /** 📉 `vendor_proposals.changes_locked` — a locked quote rises but never falls. */
  locked?: boolean;
  /** 📉 `merge_snapshot.sent_billed_pax` — the pax it was first sent at (absent until the repricer first moves it). */
  sentBilledPax?: number | null;
};

type Moved = {
  billedPax: number;
  /** Signed: + a rise, − a drop. */
  deltaCentavos: number;
  totalCentavos: number;
  lines: FollowLine[];
  schedule: FollowSchedule | null;
  /** The chat line the database posts. */
  line: string;
};

export type FollowResult =
  | { rose: false; fell: false; billedPax: number }
  | (Moved & { rose: true; fell: false })
  | (Moved & { rose: false; fell: true });

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Does this line carry its own per-head rate? (SQL `quote_follows_guest_list`, per line.) */
export function followsLine(l: FollowLine): boolean {
  return l.basis === PER_PAX_BASIS && isNum(l.rate_centavos) && l.rate_centavos > 0 && isNum(l.amount_centavos);
}

/** Does the quote follow the guest list at all? (SQL `quote_follows_guest_list`.) */
export function quoteFollowsGuestList(lines: readonly FollowLine[] | null | undefined): boolean {
  return Array.isArray(lines) && lines.some(followsLine);
}

/** "Quote rose to 150 pax · +₱32,500" — exactly the SQL `quote_rise_words`. */
export function quoteRiseWords(pax: number, deltaCentavos: number): string {
  return `Quote rose to ${formatCount(pax)} pax · +${formatCentavosPhp(deltaCentavos)}`;
}

/** "Quote fell to 160 pax · −₱800" — exactly the SQL `quote_fall_words` (migration 20271340566104). */
export function quoteFallWords(pax: number, dropCentavos: number): string {
  return `Quote fell to ${formatCount(pax)} pax · −${formatCentavosPhp(dropCentavos)}`;
}

/**
 * Each per-head line followed to `billed` — SQL `quote_follow_lines`. Unlocked (`canFall`): max(its SENT amount,
 * rate × billed), so it falls back but never under what was sent. Locked: max(its amount, rate × billed) — up only.
 * A line that moves remembers its sent amount and words (`sent_amount_centavos` · `sent_detail`) the first time.
 */
export function followLines(lines: readonly FollowLine[], billed: number, canFall: boolean): { lines: FollowLine[]; delta: number } {
  let delta = 0;
  const next = lines.map((l) => {
    if (!followsLine(l)) return l;
    const amt = l.amount_centavos!;
    const sent = isNum(l.sent_amount_centavos) ? l.sent_amount_centavos : amt;
    const rate = Math.round(l.rate_centavos!);
    const want = rate * billed;
    const target = canFall ? Math.max(sent, want) : Math.max(amt, want);
    if (target === amt) return l;
    delta += target - amt;
    const sentDetail = l.sent_detail !== undefined ? l.sent_detail : l.detail !== undefined ? l.detail : null;
    return {
      ...l,
      amount_centavos: target,
      pax: billed,
      sent_amount_centavos: sent,
      sent_detail: sentDetail,
      detail: target === want ? `${formatCount(billed)} pax × ${formatCentavosPhp(rate)}` : (sentDetail as string | null),
    };
  });
  return { lines: next, delta };
}

/**
 * The repriced quote, or neither `rose` nor `fell` — the pure mirror of `quote_follow_guest_count`.
 * `paidSeqs` = plan rows with a payment against them; `paidCentavos` = everything paid on the booking.
 */
export function followGuestCount(
  q: FollowQuote,
  count: number,
  paidSeqs: readonly number[] = [],
  paidCentavos = 0,
): FollowResult {
  const floorInt = (n: number | null | undefined) => (isNum(n) ? Math.max(0, Math.floor(n)) : 0);
  // ⟵ PIECE 2: a booked deal is repriced like a locked quote — rises, never falls.
  const locked = q.locked === true || q.booked;
  const prior = floorInt(q.billedPax);
  const sentPax = isNum(q.sentBilledPax) ? floorInt(q.sentBilledPax) : prior;
  let billed = Math.max(Math.max(0, Math.floor(count)), floorInt(q.minPax), locked ? prior : sentPax);
  const still = { rose: false as const, fell: false as const, billedPax: billed };
  if (!quoteFollowsGuestList(q.lines)) return still;

  let { lines, delta } = followLines(q.lines, billed, !locked);
  if (delta === 0) return still;

  const paid = new Set(paidSeqs);
  const inst = q.schedule?.installments;
  const hasPlan = Array.isArray(inst) && inst.length > 0;

  if (delta < 0) {
    // 📉 What is still to be settled: never below what is paid; with a plan, only the unpaid auto rows.
    let cap = Math.max(0, q.totalCentavos - Math.round(paidCentavos));
    if (hasPlan) {
      const autoLeft = inst!
        .filter((i) => i.is_auto_balance === true && !paid.has(i.seq))
        .reduce((s, i) => s + Math.max(0, i.amount_centavos ?? 0), 0);
      cap = Math.min(cap, autoLeft);
    }
    while (-delta > cap && billed < Math.max(prior, billed)) {
      billed += 1;
      ({ lines, delta } = followLines(q.lines, billed, true));
    }
    if (delta >= 0 || -delta > cap) return { rose: false, fell: false, billedPax: billed };
  }

  let schedule = q.schedule;
  if (schedule && hasPlan) {
    let next: FollowInstallment[];
    if (delta > 0) {
      const auto = inst!.filter((i) => i.is_auto_balance === true && !paid.has(i.seq)).sort((a, b) => b.seq - a.seq)[0];
      next = auto
        ? inst!.map((i) =>
            i.seq === auto.seq
              ? { ...i, amount_centavos: (i.amount_centavos ?? 0) + delta, raw_centavos: (i.raw_centavos ?? 0) + delta }
              : i,
          )
        : [
            ...inst!,
            {
              seq: Math.max(-1, ...inst!.map((i) => i.seq)) + 1,
              label: 'Final balance',
              kind: 'auto',
              amount_centavos: delta,
              raw_centavos: delta,
              percent_bps: null,
              due: 'before_event',
              offset_days: 14,
              is_downpayment: false,
              is_auto_balance: true,
              credit_applied_centavos: 0,
            },
          ];
    } else {
      // The drop comes off the unpaid auto rows, latest (by position) first; a row reaching ₱0 leaves the plan.
      let left = -delta;
      next = [];
      for (let k = inst!.length - 1; k >= 0; k--) {
        const i = inst![k]!;
        if (left > 0 && i.is_auto_balance === true && !paid.has(i.seq)) {
          const amt = Math.max(0, i.amount_centavos ?? 0);
          const take = Math.min(left, amt);
          left -= take;
          if (amt - take === 0) continue;
          next.unshift({ ...i, amount_centavos: amt - take, raw_centavos: Math.max(0, (i.raw_centavos ?? 0) - take) });
        } else {
          next.unshift(i);
        }
      }
    }
    schedule = {
      ...schedule,
      installments: next,
      base_centavos: (schedule.base_centavos ?? q.totalCentavos) + delta,
      total_centavos: (schedule.total_centavos ?? q.totalCentavos) + delta,
    };
  }
  const moved = { billedPax: billed, deltaCentavos: delta, totalCentavos: q.totalCentavos + delta, lines, schedule };
  return delta > 0
    ? { ...moved, rose: true, fell: false, line: quoteRiseWords(billed, delta) }
    : { ...moved, rose: false, fell: true, line: quoteFallWords(billed, -delta) };
}
