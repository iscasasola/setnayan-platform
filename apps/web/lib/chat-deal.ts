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
  return (
    [...asks]
      .filter((a) => a.status === 'open' && (a.raisedBy ?? 'host') === 'host' && (a.kind ?? 'counter') === 'counter' && a.amountCentavos != null && !a.moneyHidden)
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
