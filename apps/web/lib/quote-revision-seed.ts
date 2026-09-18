/**
 * SEEDING THE QUOTE BUILDER FROM THE QUOTE IT REPLACES (S5 · 2026-09-18).
 *
 * "Update this quote" opens the in-thread Proposal Maker with the LIVE quote's
 * content already in it, so the supplier edits what they sent rather than
 * retyping it. Sending then posts a NEW proposal that supersedes the old one
 * (owner, option a) — this file only shapes the seed; it writes nothing.
 *
 * ── WHY THE SHAPE CHANGES ON THE WAY IN ─────────────────────────────────────
 * A sent quote stores RESOLVED line items — `{label, detail, amount_centavos}`
 * — while the builder edits PRICING lines (flat / per-pax / per-hour with a
 * rate). The basis that produced a stored amount is gone, so every seeded line
 * is a flat line at its stored amount. A `null` amount was a freebie
 * ("Complimentary"); it seeds as one.
 *
 * ⚠ NEGATIVE LINES CANNOT ROUND-TRIP AS LINES. `resolvePackageLine` clamps a
 * fixed line at zero, so a stored "Discount · −₱15,000" seeded as a flat line
 * would silently become ₱0 and the revised quote would be ₱15,000 dearer than
 * the one it replaces — the exact silent re-pricing the builder's header exists
 * to prevent. Negative lines are folded into the builder's single Discount
 * field instead, which the builder re-emits as a negative line on send.
 *
 * Crew and transport charges were already emitted as ordinary priced lines on
 * the way OUT ("Crew meal", "Transportation"), so they seed as ordinary flat
 * lines; the builder's crew/transport modes stay 'included' so nothing is
 * counted twice.
 */
import type { ProposalLineItem } from './vendor-proposals';

/** One seeded builder line — the builder's `QuoteSeedLine` shape, flat only. */
export type QuoteRevisionLine = {
  label: string;
  basis: 'flat';
  free: boolean;
  flatPhp: number;
  ratePhp: 0;
  minPax: 0;
  basePhp: 0;
  inclHours: 0;
  extraPhp: 0;
};

export type QuoteRevisionSeed = {
  /** The quote being replaced — named in the builder's banner. */
  of: { publicId: string; title: string; totalCentavos: number; status: string; sentAt: string | null };
  lines: QuoteRevisionLine[];
  /** Sum of the negative lines, as a positive peso amount for the Discount field. */
  discountPhp: number;
  title: string;
  note: string;
  validUntil: string;
  paymentMethodIds: string[];
};

export type QuoteRevisionSource = {
  public_id: string;
  title: string | null;
  total_centavos: number | null;
  status: string;
  sent_at: string | null;
  rendered_body: string | null;
  valid_until: string | null;
  line_items: unknown;
  payment_method_ids: unknown;
};

const peso = (centavos: number) => Math.round(centavos) / 100;

export function seedQuoteRevision(row: QuoteRevisionSource): QuoteRevisionSeed {
  const raw: ProposalLineItem[] = Array.isArray(row.line_items)
    ? (row.line_items as ProposalLineItem[])
    : [];

  const lines: QuoteRevisionLine[] = [];
  let discountCentavos = 0;
  for (const li of raw) {
    const label = String(li?.label ?? '').trim();
    if (!label) continue;
    const amount =
      li?.amount_centavos == null || !Number.isFinite(Number(li.amount_centavos))
        ? null
        : Math.round(Number(li.amount_centavos));
    if (amount != null && amount < 0) {
      // Folded into the Discount field — see the header for why.
      discountCentavos += -amount;
      continue;
    }
    lines.push({
      label,
      basis: 'flat',
      free: amount == null,
      flatPhp: amount == null ? 0 : peso(amount),
      ratePhp: 0,
      minPax: 0,
      basePhp: 0,
      inclHours: 0,
      extraPhp: 0,
    });
  }

  const ids = Array.isArray(row.payment_method_ids)
    ? (row.payment_method_ids as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];

  return {
    of: {
      publicId: row.public_id,
      title: row.title ?? 'Quote',
      totalCentavos: Number(row.total_centavos) || 0,
      status: row.status,
      sentAt: row.sent_at,
    },
    lines,
    discountPhp: peso(discountCentavos),
    title: row.title ?? '',
    note: row.rendered_body ?? '',
    validUntil: /^\d{4}-\d{2}-\d{2}$/.test(row.valid_until ?? '') ? (row.valid_until as string) : '',
    paymentMethodIds: ids,
  };
}
