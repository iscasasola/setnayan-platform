/**
 * lib/quote-money.ts — 💸 THE QUOTE MAKER'S MONEY ORDER AND ITS SMALL RULES, as pure functions the maker
 * (`app/_components/proposal-maker.tsx`) calls and a guard can execute.
 *
 * Owner rulings (DECISION_LOG 2026-11-12):
 *   · "Three quote rulings" (3): *"offer first then typed discount"* — Subtotal − the applied offer (its own named
 *     line) − the supplier's typed Discount = Total. The discount is taken from what is left after the offer, never
 *     below ₱0. (Shipped before: Discount, then the offer.)
 *   · Pax: *"our quotation maker will follow their pax at auto. but they will set the minimum count for their pax. it
 *     only goes up as their guests go up."* — billed = max(their live count, the ONE quote-level minimum).
 *   · Valid until: required to send (9 Nov, "no lifetime quotation"; the server already refuses a blank one) — the
 *     maker dims Send until it is set and shakes the row on an early press.
 *   · "START FROM" GROUPS ITS CHOICES UNDER HEADINGS — SERVICE CARDS · BUNDLES · SAVED QUOTES, then Blank last; the
 *     "Bundle ·" / "Saved ·" prefixes go; an "Updating “X”" revision row stays first.
 *   · Quote service lines: one open at a time, the first open, one expand-all icon (`lineFold`).
 *
 * Every figure here comes in from the caller (data). No price is typed in this file.
 * PURE: no I/O, no React. 🔒 lib/quote-money.test.ts
 */

/* ── Pax ─────────────────────────────────────────────────────────────────── */

/** The guests the quote bills: their live count, never below the supplier's minimum. */
export function billedPax(livePax: number, minPax: number): number {
  const live = Number.isFinite(livePax) ? Math.max(0, Math.round(livePax)) : 0;
  const min = Number.isFinite(minPax) ? Math.max(0, Math.round(minPax)) : 0;
  return Math.max(live, min);
}

/** The ONE minimum a seed brings: the highest per-guest minimum among its per-pax lines; null when none states one. */
export function seedMinPax(lines: readonly { basis: string; minPax: number }[]): number | null {
  const mins = lines.filter((l) => l.basis === 'per_pax' && l.minPax > 0).map((l) => Math.round(l.minPax));
  return mins.length > 0 ? Math.max(...mins) : null;
}

/* ── The money order ─────────────────────────────────────────────────────── */

export type QuoteMoneyInput = {
  /** What the lines come to (centavos). */
  linesCentavos: number;
  /** Crew meal + travel charges (centavos). */
  chargesCentavos: number;
  /** The applied offer, off its own cards' lines (centavos, ≥ 0). */
  offerCentavos: number;
  /** The supplier's typed discount (centavos, ≥ 0). */
  discountCentavos: number;
  /** The crew-meal credit, off the Final balance only (centavos, ≥ 0). */
  creditCentavos: number;
};

export type QuoteMoney = {
  subtotal: number;
  /** What the offer actually takes (never more than the subtotal). */
  offer: number;
  /** Subtotal − offer. */
  afterOffer: number;
  /** What the typed discount actually takes — off what is left AFTER the offer. */
  discount: number;
  /** The quote total (what the plan splits). */
  total: number;
  /** Total − the crew-meal credit. */
  net: number;
};

const c = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);

/** Subtotal → offer → Discount → Total → (credit) → Net. Offer FIRST, then the typed discount (owner 12 Nov). */
export function quoteMoney(input: QuoteMoneyInput): QuoteMoney {
  const subtotal = c(input.linesCentavos) + c(input.chargesCentavos);
  const offer = Math.min(c(input.offerCentavos), subtotal);
  const afterOffer = subtotal - offer;
  const discount = Math.min(c(input.discountCentavos), afterOffer);
  const total = afterOffer - discount;
  const net = Math.max(0, total - c(input.creditCentavos));
  return { subtotal, offer, afterOffer, discount, total, net };
}

/* ── Send ────────────────────────────────────────────────────────────────── */

/** Send is ready only with a Valid until; until then it is dimmed and the row says why. */
export function sendGate(validUntil: string): { ready: boolean; caption: string } {
  const ready = /^\d{4}-\d{2}-\d{2}$/.test(validUntil.trim());
  return { ready, caption: ready ? 'The couple can accept it until then' : 'Required to send' };
}

/* ── Start from ──────────────────────────────────────────────────────────── */

export type StartOption = { key: string; label: string; group?: string };

export const START_GROUPS = { cards: 'Service cards', bundles: 'Bundles', saved: 'Saved quotes' } as const;

/** Start from's choices under their headings: Updating first · SERVICE CARDS · BUNDLES · SAVED QUOTES · Blank last. */
export function startFromOptions(input: {
  revisionTitle: string | null;
  cards: readonly { id: string; label: string }[];
  bundles: readonly { id: string; name: string }[];
  saved: readonly { id: string; name: string }[];
}): StartOption[] {
  return [
    ...(input.revisionTitle != null ? [{ key: 'revision', label: `Updating “${input.revisionTitle}”` }] : []),
    ...input.cards.map((c) => ({ key: `card:${c.id}`, label: c.label, group: START_GROUPS.cards })),
    ...input.bundles.map((b) => ({ key: `bundle:${b.id}`, label: b.name, group: START_GROUPS.bundles })),
    ...input.saved.map((t) => ({ key: `tpl:${t.id}`, label: t.name, group: START_GROUPS.saved })),
    { key: 'blank', label: 'Blank' },
  ];
}

/* ── Lines: one open at a time, the first open, expand all ──────────────── */

/** `one` with key undefined = the opening state (the first line open); null = every line folded. */
export type LineFold = { mode: 'one'; key?: string | null } | { mode: 'all' };

export const FIRST_OPEN: LineFold = { mode: 'one' };

export function lineIsOpen(fold: LineFold, key: string, firstKey: string | null): boolean {
  if (fold.mode === 'all') return true;
  return fold.key === undefined ? key === firstKey : fold.key === key;
}

/** A tap on a line: opens it and folds the open one; a tap on the open line folds it. */
export function tapLine(fold: LineFold, key: string, firstKey: string | null): LineFold {
  return lineIsOpen(fold, key, firstKey) && fold.mode === 'one' ? { mode: 'one', key: null } : { mode: 'one', key };
}

/** The heading's icon: open every line, or fold every line. */
export function toggleAll(fold: LineFold): LineFold {
  return fold.mode === 'all' ? { mode: 'one', key: null } : { mode: 'all' };
}

/* ── Plan presets that clash with an offer's first payment ──────────────── */

/**
 * Every preset's first payment is a PERCENT, so every one clashes with an applied offer that sets the first payment — the offer
 * already says what reserves the date. The reason is the offer's own words ("₱5,000 to reserve").
 */
export function presetClash(offerFirst: { words: string } | null): string | null {
  if (!offerFirst) return null;
  return `Your offer sets ${offerFirst.words.replace(/^First payment /, '')}`;
}
