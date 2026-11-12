/**
 * 👥💸 A QUOTE FOLLOWS THE GUEST LIST — the pure mirror of `public.quote_follow_guest_count` (migration
 * 20271339826198; Piece 1 · PR-2; DECISION_LOG 2026-11-12). Owner, verbatim: *"our quotation maker will follow their pax
 * at auto. but they will set the minimum count for their pax. it only goes up as their guests go up."*
 *
 *   · billed = max(the per-service count, the quote's Bill-at-least `merge_snapshot.min_pax`, the billed pax it carries)
 *   · each per-head line → max(its amount, rate × billed); flat lines never move — so the total NEVER drops, and is
 *     never below the minimum or below what was sent
 *   · the rise lands on the AUTO Final-balance row; every other row, and every paid row, is untouched (a paid auto row
 *     → a new auto row takes the rise)
 *   · a booked deal is not repriced here (Piece 2); a supplier's `changes_locked` quote STILL rises.
 *
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
};

export type FollowResult =
  | { rose: false; billedPax: number }
  | {
      rose: true;
      billedPax: number;
      deltaCentavos: number;
      totalCentavos: number;
      lines: FollowLine[];
      schedule: FollowSchedule | null;
      /** The chat line the database posts. */
      line: string;
    };

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

/** The repriced quote, or `rose: false`. Upward only. */
export function followGuestCount(q: FollowQuote, count: number, paidSeqs: readonly number[] = []): FollowResult {
  const floorInt = (n: number | null) => (isNum(n) ? Math.max(0, Math.floor(n)) : 0);
  const billed = Math.max(Math.max(0, Math.floor(count)), floorInt(q.minPax), floorInt(q.billedPax));
  if (q.booked || !quoteFollowsGuestList(q.lines)) return { rose: false, billedPax: billed };

  let delta = 0;
  const lines = q.lines.map((l) => {
    if (!followsLine(l)) return l;
    const rate = Math.round(l.rate_centavos!);
    const want = rate * billed;
    if (want <= l.amount_centavos!) return l;
    delta += want - l.amount_centavos!;
    return { ...l, amount_centavos: want, pax: billed, detail: `${formatCount(billed)} pax × ${formatCentavosPhp(rate)}` };
  });
  if (delta <= 0) return { rose: false, billedPax: billed };

  let schedule = q.schedule;
  const inst = schedule?.installments;
  if (schedule && Array.isArray(inst) && inst.length > 0) {
    const paid = new Set(paidSeqs);
    const auto = inst
      .filter((i) => i.is_auto_balance === true && !paid.has(i.seq))
      .sort((a, b) => b.seq - a.seq)[0];
    const next: FollowInstallment[] = auto
      ? inst.map((i) =>
          i.seq === auto.seq
            ? { ...i, amount_centavos: (i.amount_centavos ?? 0) + delta, raw_centavos: (i.raw_centavos ?? 0) + delta }
            : i,
        )
      : [
          ...inst,
          {
            seq: Math.max(-1, ...inst.map((i) => i.seq)) + 1,
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
    schedule = {
      ...schedule,
      installments: next,
      base_centavos: (schedule.base_centavos ?? q.totalCentavos) + delta,
      total_centavos: (schedule.total_centavos ?? q.totalCentavos) + delta,
    };
  }
  return {
    rose: true,
    billedPax: billed,
    deltaCentavos: delta,
    totalCentavos: q.totalCentavos + delta,
    lines,
    schedule,
    line: quoteRiseWords(billed, delta),
  };
}
