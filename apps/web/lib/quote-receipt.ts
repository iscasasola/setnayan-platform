/**
 * 🧾 THE QUOTE, AS A RECEIPT IN THE CHAT — its arithmetic and what it sends (Unichat part C, owner 20 Nov 2026:
 * "build it now, I am happy with the design"; drawing `build-sessions/UNICHAT-LIVE-2026-11-19.html`, the quote tool).
 *
 * The chat's mini quote editor holds the quote maker's REAL parts — lines, crew meal, transport, discount, the payment
 * schedule — and prices them through the maker's own pure resolvers. Nothing is priced a second way here:
 *   · crew meal and transport → `crewChargeCentavos` / `crewCreditCentavos` / `transportChargeCentavos`
 *     (`lib/package-line-pricing.ts`, the functions `proposal-maker.tsx` calls);
 *   · Subtotal → offer → Discount → Total → credit → `quoteMoney` (`lib/quote-money.ts`, the maker's one order);
 *   · the schedule → `DEFAULT_QUOTE_PLAN` and the negotiation presets, resolved by `resolveSchedule`;
 *   · the lines it writes are the maker's own stored shape and words ("Crew meal", "Transportation", "Discount",
 *     "Crew meal — couple provides") — held to `proposal-maker.tsx` by `lib/quote-receipt.test.ts`.
 *
 * NO NUMBER IS INVENTED: a new line opens empty, a crew charge opens with no crew and no rate, a discount is typed.
 * What the receipt cannot edit faithfully (an offer's own line, a gift from an offer, a stored crew-meal credit) is
 * KEPT, verbatim, and sent back exactly as stored.
 *
 * PURE: no I/O, no clock. 🔒 lib/quote-receipt.test.ts
 */
import { crewChargeCentavos, crewCreditCentavos, transportChargeCentavos, type CrewMealMode, type TransportMode } from './package-line-pricing';
import { quoteMoney, type QuoteMoney } from './quote-money';
import { formatCentavos, type ProposalLineItem } from './vendor-proposals';
import { lineStructureOf } from './quote-line-structure';
import { QUOTED_AFTER_SITE_CHECK, quoteLinePriceWords } from './quote-line-price-words';
import { DEFAULT_QUOTE_PLAN, type AutoBalanceMeta, type InstallmentDraft } from './proposal-payment-schedule';
import { NEGOTIATE_PLAN_PRESETS, negotiatePresetDraft } from './chat-cards';

/** The stored words the quote maker writes — one spelling, read back on a revision. */
export const RECEIPT_WORDS = {
  crewMeal: 'Crew meal',
  crewCredit: 'Crew meal — couple provides',
  crewCreditDetail: 'Credit applied to final payment',
  transport: 'Transportation',
  transportFlat: 'Flat fee',
  discount: 'Discount',
  /** A free line's caption — the ONE rule's word (`quoteLinePriceWords`), never typed a second time. */
  free: quoteLinePriceWords({ amount_centavos: null }),
  adjustment: 'Adjustment',
} as const;

export type ReceiptLine = {
  key: string;
  label: string;
  /** Price EACH, in pesos (centavos kept). */
  pricePhp: number;
  qty: number;
  free: boolean;
  /** The service card the line came from — its availability tag is read from it. */
  cardId: string | null;
  /** The stored line this one was opened from; sent back untouched while the supplier changes nothing on it. */
  src: ProposalLineItem | null;
};

export type ReceiptCrew = { mode: CrewMealMode; size: number; perHeadPhp: number };
export type ReceiptTransport = { mode: TransportMode; flatPhp: number };

export type ReceiptDraft = {
  lines: ReceiptLine[];
  crew: ReceiptCrew;
  transport: ReceiptTransport;
  discountPhp: number;
  discountWhy: string;
  /** The stored discount line, sent back as it was while the amount and the reason are untouched. */
  discountSrc: ProposalLineItem | null;
  /** Stored lines the receipt does not edit — an offer's line, an offer's gifts, a crew-meal credit. Sent back verbatim. */
  kept: ProposalLineItem[];
};

const toCentavos = (php: number): number => Math.round((Number(php) || 0) * 100);
const amountOf = (li: ProposalLineItem): number | null =>
  li?.amount_centavos == null || !Number.isFinite(Number(li.amount_centavos)) ? null : Math.round(Number(li.amount_centavos));

let seq = 0;
/** A key for a line the supplier adds (stable for the life of the editor; never stored). */
export const receiptKey = (): string => `r${(seq += 1)}`;

/** A new line: EMPTY — the supplier names it and prices it. */
export function newReceiptLine(): ReceiptLine {
  return { key: receiptKey(), label: '', pricePhp: 0, qty: 1, free: false, cardId: null, src: null };
}

/** What one line comes to (a free line is ₱0 and is stored with no amount — "Complimentary"). */
export function receiptLineCentavos(l: ReceiptLine): number {
  return l.free ? 0 : toCentavos(l.pricePhp) * Math.max(1, Math.round(l.qty) || 1);
}

/** "₱1,500 × 4" — the caption a line with a quantity carries, and the one a revision reads the quantity back from. */
function qtyDetail(l: ReceiptLine): string | null {
  const q = Math.max(1, Math.round(l.qty) || 1);
  return q > 1 ? `${formatCentavos(toCentavos(l.pricePhp))} × ${q}` : null;
}
const QTY_DETAIL = /^₱[\d,]+(?:\.\d{1,2})? × (\d{1,4})$/;

/** A new quote's draft: one line per picked card at its own "from" price (a card with none opens at ₱0, to be typed). */
export function receiptFromCards(cards: readonly { id: string; name: string; fromCentavos: number | null }[]): ReceiptDraft {
  return {
    lines: cards.map((c) => ({ key: receiptKey(), label: c.name.trim(), pricePhp: Math.max(0, c.fromCentavos ?? 0) / 100, qty: 1, free: false, cardId: c.id, src: null })),
    crew: { mode: 'included', size: 0, perHeadPhp: 0 },
    transport: { mode: 'included', flatPhp: 0 },
    discountPhp: 0,
    discountWhy: '',
    discountSrc: null,
    kept: [],
  };
}

/**
 * A sent quote's stored lines, opened as a receipt. Crew and transport charges were written as ordinary priced lines,
 * so they open as lines and the crew / transport rows start "Included" (nothing is counted twice — the quote maker's
 * own rule, `lib/quote-revision-seed.ts`). Negative lines fold into the ONE Discount; "Transportation · Quoted after
 * site check" reopens the transport row in that mode; an offer's lines and a stored credit are KEPT.
 */
export function receiptFromStored(raw: unknown): ReceiptDraft {
  const items: ProposalLineItem[] = Array.isArray(raw) ? (raw as ProposalLineItem[]) : [];
  const d = receiptFromCards([]);
  let discountC = 0;
  const discounts: ProposalLineItem[] = [];
  for (const li of items) {
    const label = String(li?.label ?? '').trim();
    if (!label) continue;
    const amount = amountOf(li);
    const s = lineStructureOf(li);
    if (amount == null && String(li?.detail ?? '').trim() === QUOTED_AFTER_SITE_CHECK) {
      d.transport = { mode: 'distance', flatPhp: 0 };
      continue;
    }
    if (s.offer_id || (amount != null && amount < 0 && label === RECEIPT_WORDS.crewCredit)) {
      d.kept.push(li);
      continue;
    }
    if (amount != null && amount < 0) {
      discountC += -amount;
      discounts.push(li);
      continue;
    }
    const m = amount != null && amount > 0 ? QTY_DETAIL.exec(String(li?.detail ?? '').trim()) : null;
    const qty = m ? Math.max(1, Number(m[1])) : 1;
    const each = amount != null && qty > 1 && amount % qty === 0 ? amount / qty : (amount ?? 0);
    d.lines.push({ key: receiptKey(), label, pricePhp: each / 100, qty: each === amount ? 1 : qty, free: amount == null, cardId: s.card_id ?? null, src: li });
  }
  d.discountPhp = discountC / 100;
  d.discountWhy = String(discounts[0]?.detail ?? '').trim();
  d.discountSrc = discounts.length === 1 ? discounts[0]! : null;
  return d;
}

export type ReceiptMoney = QuoteMoney & {
  /** What is SENT: the stored line items, whose sum the server re-adds into the quote's total. */
  lineItems: ProposalLineItem[];
  /** The crew-meal credit (a kept one plus this draft's own "couple provides") — rides the schedule. */
  creditCentavos: number;
  /** What the kept offer line takes off. */
  offerCentavos: number;
};

/** The receipt's money and the lines it sends — the quote maker's own order and the quote maker's own stored shape. */
export function receiptMoney(d: ReceiptDraft): ReceiptMoney {
  const crewRow = { crew_meal_mode: d.crew.mode, crew_size: d.crew.size > 0 ? Math.round(d.crew.size) : 0, crew_per_head_centavos: toCentavos(d.crew.perHeadPhp) };
  const charge = crewChargeCentavos(crewRow);
  const ownCredit = crewCreditCentavos(crewRow);
  const trans = transportChargeCentavos({ transport_mode: d.transport.mode, transport_flat_centavos: toCentavos(d.transport.flatPhp) });
  const keptCredit = d.kept.reduce((s, li) => (!lineStructureOf(li).offer_id && (amountOf(li) ?? 0) < 0 ? s - amountOf(li)! : s), 0);
  const keptOffer = d.kept.reduce((s, li) => (lineStructureOf(li).offer_id && (amountOf(li) ?? 0) < 0 ? s - amountOf(li)! : s), 0);
  const lines = d.lines.filter((l) => l.label.trim() || l.free || receiptLineCentavos(l) > 0);
  const money = quoteMoney({
    linesCentavos: lines.reduce((s, l) => s + receiptLineCentavos(l), 0),
    chargesCentavos: charge + trans,
    offerCentavos: keptOffer,
    discountCentavos: toCentavos(d.discountPhp),
    creditCentavos: keptCredit + ownCredit,
  });

  const li: ProposalLineItem[] = [];
  for (const l of lines) {
    const amount = l.free ? null : receiptLineCentavos(l);
    const label = l.label.trim() || 'Line item';
    // Untouched: the stored line goes back exactly as it was (its basis, its rate, its caption).
    if (l.src && String(l.src.label ?? '').trim() === label && amountOf(l.src) === amount) {
      li.push(l.src);
      continue;
    }
    li.push({
      label,
      detail: l.free ? RECEIPT_WORDS.free : qtyDetail(l),
      amount_centavos: amount,
      ...(l.cardId ? { card_id: l.cardId } : {}),
      ...(l.free ? {} : { basis: 'flat' as const }),
    });
  }
  // An offer's gifts and its own named line come BEFORE the typed discount (owner 12 Nov: offer first).
  for (const k of d.kept) if (lineStructureOf(k).offer_id && amountOf(k) == null) li.push(k);
  if (d.crew.mode === 'charge' && charge > 0) {
    li.push({ label: RECEIPT_WORDS.crewMeal, detail: `${Math.round(d.crew.size)} crew × ${formatCentavos(toCentavos(d.crew.perHeadPhp))}/head`, amount_centavos: charge });
  }
  if (d.transport.mode === 'flat' && trans > 0) li.push({ label: RECEIPT_WORDS.transport, detail: RECEIPT_WORDS.transportFlat, amount_centavos: trans });
  else if (d.transport.mode === 'distance') li.push({ label: RECEIPT_WORDS.transport, detail: QUOTED_AFTER_SITE_CHECK, amount_centavos: null });
  for (const k of d.kept) if (lineStructureOf(k).offer_id && amountOf(k) != null) li.push(k);
  if (money.discount > 0) {
    const why = d.discountWhy.trim() || null;
    const same = d.discountSrc && amountOf(d.discountSrc) === -money.discount && (String(d.discountSrc.detail ?? '').trim() || null) === why;
    li.push(same ? d.discountSrc! : { label: RECEIPT_WORDS.discount, detail: why, amount_centavos: -money.discount });
  }
  for (const k of d.kept) if (!lineStructureOf(k).offer_id) li.push(k);
  if (d.crew.mode === 'offset' && ownCredit > 0) li.push({ label: RECEIPT_WORDS.crewCredit, detail: RECEIPT_WORDS.crewCreditDetail, amount_centavos: -ownCredit });
  return { ...money, lineItems: li, creditCentavos: keptCredit + ownCredit, offerCentavos: keptOffer };
}

/**
 * SAME PARTS, NEW TOTAL (the drawing's `fitQuote`): the supplier agrees a price in the chat and the receipt opens AT it
 * — the difference goes into the Discount (with the reason), or, when the agreed price is higher, into one
 * "Adjustment" line. `targetCentavos` is what they will PAY (after any credit).
 */
export function fitReceiptToTarget(d: ReceiptDraft, targetCentavos: number, why: string): ReceiptDraft {
  const open = receiptMoney({ ...d, discountPhp: 0, discountSrc: null });
  const diff = open.net - Math.max(0, Math.round(targetCentavos));
  if (diff >= 0) {
    const same = toCentavos(d.discountPhp) === diff;
    return { ...d, discountPhp: diff / 100, discountWhy: same ? d.discountWhy : why, discountSrc: same ? d.discountSrc : null };
  }
  return {
    ...d,
    discountPhp: 0,
    discountWhy: '',
    discountSrc: null,
    lines: [...d.lines, { key: receiptKey(), label: RECEIPT_WORDS.adjustment, pricePhp: -diff / 100, qty: 1, free: false, cardId: null, src: null }],
  };
}

/** Null = it may be sent; else the one sentence the receipt shows. (The Valid until has its own shipped refusal.) */
export function receiptRefusal(d: ReceiptDraft, m: ReceiptMoney): string | null {
  const real = d.lines.filter((l) => l.label.trim() || l.free || receiptLineCentavos(l) > 0);
  if (real.length === 0) return 'Add at least one line.';
  if (real.some((l) => !l.label.trim())) return 'Name every line.';
  if (d.crew.mode !== 'included' && !(d.crew.size > 0 && d.crew.perHeadPhp > 0)) return 'Crew meal: type how many crew and how much per head.';
  if (d.transport.mode === 'flat' && !(d.transport.flatPhp > 0)) return 'Transport: type the fee.';
  if (toCentavos(d.discountPhp) > m.afterOffer) return 'The discount is more than the quote.';
  if (!(m.net > 0)) return 'The total is ₱0 — price a line.';
  return null;
}

// ── The schedule ─────────────────────────────────────────────────────────────

export type ReceiptPlan = { manual: InstallmentDraft[]; autoBalance: AutoBalanceMeta };
/** `plan: null` = the quote carries no payment plan (a quote sent without one keeps none until the supplier picks). */
export type ReceiptPlanChoice = { key: string; label: string; plan: ReceiptPlan | null };

/**
 * "How they pay" — the plans the receipt offers. A revision keeps its own plan first; then the quote maker's default
 * plan and the negotiation's presets, each label composed from the plan's own numbers. Once a payment is confirmed
 * only the kept plan is offered: a paid payment never changes.
 */
export function receiptPlanChoices(stored: ReceiptPlan | null, hasPaid: boolean, revision = false): ReceiptPlanChoice[] {
  const keep: ReceiptPlanChoice[] = stored
    ? [{ key: 'keep', label: 'Keep the current plan', plan: stored }]
    : revision
      ? [{ key: 'none', label: 'No payment plan yet', plan: null }]
      : [];
  if (stored && hasPaid) return keep;
  const first = DEFAULT_QUOTE_PLAN.manual[0]!;
  const start: ReceiptPlanChoice = {
    key: 'default',
    label: `${first.percent}% to book · rest ${DEFAULT_QUOTE_PLAN.autoBalance.offsetDays} days before`,
    plan: { manual: DEFAULT_QUOTE_PLAN.manual.map((r) => ({ ...r })), autoBalance: { ...DEFAULT_QUOTE_PLAN.autoBalance } },
  };
  const rest = NEGOTIATE_PLAN_PRESETS.filter((p) => p.percent !== first.percent).map((p) => ({ key: p.key, label: p.label, plan: negotiatePresetDraft(p) }));
  return [...keep, start, ...rest];
}
