/**
 * 🤝 THE DEAL, IN NUMBERS — the two pure rules behind "Every version, their ask beside it" (owner 19 Nov 2026,
 * DECISION_LOG "THE CLIENT PAGE IS ONE CHAT THAT HOLDS EVERYTHING"; drawing S9ScH2Ps v3, screen 7; drawn by
 * `app/_components/chat/cards/deal-sheet.tsx`). 🔒 lib/chat-deal.test.ts
 */
import { counterOutcome, goodUntilWords, type CardLine } from './chat-cards';
import { formatCentavosPhp } from './php';

/**
 * ONE RULE FOR "THEIR ASK", BOTH PLACES (Fable review F6, 19 Nov 2026): the strip's Deal box (server, the client page)
 * and Every version (browser, `deal-sheet.tsx`) read the same `change_asks_read` rows through `dealAskOf`, pick with
 * `theirOpenAsk`, and turn a one-line counter into a total with `theirAskTotalCentavos`. A second, inline picker on the
 * page is what this replaced — it ignored the order, the kind and a hidden amount, and showed a line's price as the total.
 */

/** What the rule reads of an ask (`ChangeAskRow`, `card-calls.ts`). */
export type DealAsk = {
  askedAt: string;
  status: string;
  raisedBy?: 'host' | 'supplier';
  kind?: 'words' | 'counter' | 'plan';
  amountCentavos?: number | null;
  /** A counter on ONE line of the quote (its label); null/absent = a counter on the whole total. */
  scopeLabel?: string | null;
  goodUntil?: string | null;
  moneyHidden?: boolean;
};

/** One row of `change_asks_read`, as the database returns it — only the columns the rule reads. */
export type DealAskDbRow = {
  asked_at: string;
  status: string;
  amount_centavos: number | string | null;
  scope_label: string | null;
  proposed_plan?: unknown;
  good_until: string | null;
  raised_by: 'host' | 'supplier' | null;
  kind?: 'words' | 'counter' | 'plan' | null;
  money_hidden?: boolean | null;
};

/** What an ask is when the row does not say: a price → counter, a plan → plan, else words. */
export function askKindOf(r: Pick<DealAskDbRow, 'kind' | 'amount_centavos' | 'proposed_plan'>): 'words' | 'counter' | 'plan' {
  return r.kind ?? (r.amount_centavos != null ? 'counter' : r.proposed_plan != null ? 'plan' : 'words');
}

export function dealAskOf(r: DealAskDbRow): DealAsk {
  const amt = r.amount_centavos == null ? null : Math.round(Number(r.amount_centavos));
  return {
    askedAt: r.asked_at,
    status: r.status,
    raisedBy: r.raised_by ?? 'host',
    kind: askKindOf(r),
    amountCentavos: amt != null && Number.isFinite(amt) ? amt : null,
    scopeLabel: r.scope_label,
    goodUntil: r.good_until,
    moneyHidden: r.money_hidden === true,
  };
}

/** A quote's stored `line_items` as card lines (the same shape the chat's cards read). */
export function quoteLinesOf(raw: unknown): CardLine[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((l, i) => {
    const r = (l ?? {}) as { label?: unknown; detail?: unknown; amount_centavos?: unknown };
    const amt = r.amount_centavos == null ? null : Math.round(Number(r.amount_centavos));
    return {
      key: `l${i}`,
      label: String(r.label ?? '').trim() || 'Line item',
      detail: r.detail == null ? null : String(r.detail),
      amountCentavos: amt == null || !Number.isFinite(amt) ? null : amt,
    };
  });
}

/**
 * The TOTAL their ask makes of this quote: a counter on the total is its amount; a counter on one line replaces that
 * line (`counterOutcome`, the math Accept runs). Null = no amount, or the line is no longer on the quote.
 */
export function theirAskTotalCentavos(ask: DealAsk, quote: { totalCentavos: number; lines: readonly CardLine[] }): number | null {
  if (ask.amountCentavos == null) return null;
  const o = counterOutcome({
    totalCentavos: quote.totalCentavos,
    lines: quote.lines,
    amountCentavos: ask.amountCentavos,
    scopeLabel: ask.scopeLabel ?? null,
    floorCentavos: null,
    planRows: null,
    paidSeqs: new Set(),
  });
  if (ask.scopeLabel && o.wasCentavos === 0) return null;
  return o.newTotalCentavos;
}

/**
 * THEIR ASK = the hosts' newest OPEN counter that has not expired. Not a plan proposal, not an ask in words, not the
 * supplier's own counter, not one whose amount this reader may not see. Null = nobody is asking.
 */
export function theirOpenAsk<A extends DealAsk>(asks: readonly A[], today: string): A | null {
  return openCounterBy(asks, today, 'host');
}

/**
 * One side's newest OPEN counter that has not expired and whose amount this reader may see — the hosts' ("their ask")
 * or the supplier's own ("you countered"). The counter editor reads both (Unichat part C, 20 Nov 2026).
 */
export function openCounterBy<A extends DealAsk>(asks: readonly A[], today: string, by: 'host' | 'supplier', alsoCountered = false): A | null {
  // `alsoCountered`: a counter the other side answered WITH a counter is still that side's latest word on the price
  // (the range's far end) — a declined or accepted one never is.
  return (
    [...asks]
      .filter((a) => (a.status === 'open' || (alsoCountered && a.status === 'countered')) && (a.raisedBy ?? 'host') === by && (a.kind ?? 'counter') === 'counter' && a.amountCentavos != null && !a.moneyHidden)
      .filter((a) => !goodUntilWords(a.goodUntil ?? null, today).expired)
      .sort((a, b) => b.askedAt.localeCompare(a.askedAt))[0] ?? null
  );
}

/** "You are ₱5,000 apart" + "11%" — their total at or above yours is no gap at all (null). */
export function gapWords(yourTotalCentavos: number, theirTotalCentavos: number): { amount: string; percent: string } | null {
  const gap = yourTotalCentavos - theirTotalCentavos;
  if (yourTotalCentavos <= 0 || gap <= 0) return null;
  return { amount: formatCentavosPhp(gap), percent: `${Math.round((gap / yourTotalCentavos) * 100)}%` };
}

// ── 🤝 Unichat part C (20 Nov 2026 — drawing UNICHAT-LIVE-2026-11-19, the counter and plan editors) ──────────────────
// Every number below ALREADY EXISTS in the deal: the quote, each side's latest counter, the supplier's own lowest.
// Nothing here invents a price. 🔒 lib/chat-deal.test.ts

const whole = (n: number | null | undefined): number | null => (n == null || !Number.isFinite(n) ? null : Math.round(n));

/**
 * THE SUGGESTED COUNTER (owner 20 Nov 2026): halfway between THEIR ASK and YOUR QUOTE, rounded to a whole peso, and
 * never below your lowest. No lowest saved (or it is not this reader's to know) → just halfway.
 * Null = nothing to suggest: nobody is asking, their ask is at or above your price, or your own price already sits
 * under your lowest (then no figure between the two is at or above it — the editor offers "keep" and the lowest).
 */
export function suggestedCounterCentavos(input: { theirAskCentavos: number | null; yourQuoteCentavos: number; lowestCentavos?: number | null }): number | null {
  const ask = whole(input.theirAskCentavos);
  const yours = whole(input.yourQuoteCentavos) ?? 0;
  if (ask == null || ask <= 0 || yours <= 0 || ask >= yours) return null;
  const half = Math.round((ask + yours) / 2 / 100) * 100;
  const lowest = whole(input.lowestCentavos);
  if (lowest == null || lowest <= 0) return half;
  if (lowest > yours) return null;
  return Math.max(half, lowest);
}

export type CounterChip = { centavos: number; words: string[]; lowest?: boolean };
export type CounterContext = {
  /** Up to three label · amount pairs: the quote, the latest counter, the ask. */
  figures: { label: string; centavos: number }[];
  /** "₱5,000 (11%)" apart — null when nobody is asking under the price. */
  gap: { amount: string; percent: string } | null;
  /** The range's two ends (their ask · the standing price); null = no range to draw. */
  lo: number | null;
  hi: number;
  /** The suggested counter (`suggestedCounterCentavos`), or null. */
  suggested: number | null;
  /** One-press amounts. Same amount twice is ONE chip with both words. */
  chips: CounterChip[];
  /** Where the supplier's lowest sits on the range, 0–100 — null for the hosts, ALWAYS. */
  lowestAt: number | null;
};

/** Where a price sits between the two ends, 0–100 (clamped). */
export function rangePercent(valueCentavos: number, lo: number, hi: number): number {
  if (!(hi > lo)) return 0;
  return Math.max(0, Math.min(100, ((valueCentavos - lo) / (hi - lo)) * 100));
}

/**
 * WHAT THE COUNTER EDITOR SHOWS ABOVE THE PRICE — their ask · your quote · the gap, a range, the chips.
 * `hostAskCentavos` = the hosts' newest open counter on the TOTAL; `supplierCounterCentavos` = the supplier's newest
 * open counter on the total. 🔒 The lowest is the supplier's alone: for `viewer: 'couple'` it is dropped HERE, so no
 * caller can leak it into a chip, a mark or the suggestion.
 */
export function counterContext(input: {
  viewer: 'vendor' | 'couple';
  quoteTotalCentavos: number;
  hostAskCentavos: number | null;
  supplierCounterCentavos: number | null;
  lowestCentavos: number | null;
}): CounterContext {
  const sup = input.viewer === 'vendor';
  const quote = whole(input.quoteTotalCentavos) ?? 0;
  const ask = whole(input.hostAskCentavos);
  const supC = whole(input.supplierCounterCentavos);
  const lowest = sup ? whole(input.lowestCentavos) : null;
  const hi = supC != null && supC > 0 ? supC : quote;
  const lo = ask != null && ask > 0 && ask < hi ? ask : null;
  const suggested = suggestedCounterCentavos({ theirAskCentavos: lo, yourQuoteCentavos: hi, lowestCentavos: lowest });
  const figures: CounterContext['figures'] = [{ label: sup ? 'Your quote' : 'Their quote', centavos: quote }];
  if (supC != null && supC > 0) figures.push({ label: sup ? 'You countered' : 'They countered', centavos: supC });
  if (ask != null && ask > 0) figures.push({ label: sup ? 'They ask' : 'You asked', centavos: ask });
  const raw: CounterChip[] = [];
  if (suggested != null) raw.push({ centavos: suggested, words: [lo != null && suggested === Math.round((lo + hi) / 2 / 100) * 100 ? 'halfway' : 'suggested'] });
  if (lowest != null && lowest > 0) raw.push({ centavos: lowest, words: ['your lowest'], lowest: true });
  if (hi > 0) raw.push({ centavos: hi, words: [sup ? 'keep' : supC != null && supC > 0 ? 'their counter' : 'their quote'] });
  const chips: CounterChip[] = [];
  for (const c of raw) {
    const same = chips.find((x) => x.centavos === c.centavos);
    if (same) {
      same.words.push(...c.words);
      same.lowest = same.lowest || c.lowest;
    } else chips.push({ ...c, words: [...c.words] });
  }
  return {
    figures: figures.slice(-3),
    gap: lo != null ? gapWords(hi, lo) : null,
    lo,
    hi,
    suggested,
    chips,
    lowestAt: lo != null && lowest != null && lowest >= lo && lowest <= hi ? rangePercent(lowest, lo, hi) : null,
  };
}

// ── The payment plan must balance ─────────────────────────────────────────────

/** A custom plan against the quote: what is placed, what is left, and the one line the editor prints. */
export function planBalance(amountsCentavos: readonly number[], totalCentavos: number): { placed: number; left: number; balanced: boolean; words: string } {
  const total = Math.max(0, Math.round(totalCentavos));
  const placed = amountsCentavos.reduce((s, a) => s + Math.max(0, Math.round(a) || 0), 0);
  const left = total - placed;
  const balanced = left === 0 && amountsCentavos.length > 0 && amountsCentavos.every((a) => Math.round(a) >= 0);
  const words =
    left === 0
      ? `Placed ${formatCentavosPhp(placed)} of ${formatCentavosPhp(total)} ✓`
      : left > 0
        ? `${formatCentavosPhp(left)} still to place`
        : `${formatCentavosPhp(-left)} over the quote`;
  return { placed, left, balanced, words };
}

/** "Fill the rest": row `index` takes whatever the others leave of the total (never below ₱0). */
export function fillTheRest(amountsCentavos: readonly number[], index: number, totalCentavos: number): number[] {
  const others = amountsCentavos.reduce((s, a, i) => (i === index ? s : s + Math.max(0, Math.round(a) || 0)), 0);
  return amountsCentavos.map((a, i) => (i === index ? Math.max(0, Math.round(totalCentavos) - others) : Math.max(0, Math.round(a) || 0)));
}

/**
 * "Book it" is capped by what is free: the count a host may book of a by-the-piece line. `free` null = not read —
 * then there is no cap to state and the count stays what the quote asked (never a guessed "all free").
 */
export function bookItCap(askedQty: number, free: number | null): { qty: number; max: number | null; short: boolean } {
  const asked = Math.max(1, Math.round(askedQty) || 1);
  if (free == null || !Number.isFinite(free)) return { qty: asked, max: null, short: false };
  const max = Math.max(0, Math.round(free));
  return { qty: Math.min(asked, max), max, short: asked > max };
}
