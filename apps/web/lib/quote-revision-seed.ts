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
import {
  isResolvedSchedule,
  type AutoBalanceMeta,
  type InstallmentDraft,
} from './proposal-payment-schedule';

/*
 * ── THE SCHEDULE CARRIES FORWARD (2026-09-20 · #5717 follow-up d) ───────────
 * PROVEN, not assumed: the builder's schedule state was initialised to a fixed
 * default — `First payment · 20% · on lock` plus an auto `Final balance · 14
 * days before` — with no reference to `revision`, and the seed read never
 * selected `payment_schedule`. So "Update this quote" silently reset a
 * supplier's own terms (say ₱5,000 on lock, 50% a month out) to 20% / 14 days,
 * and sending it re-priced what the couple owes and when. The seed now carries
 * the stored schedule back into the builder's own draft shape:
 *   • a percent row whose basis points are a whole percent → that percent;
 *   • any other row → FIXED at its pre-credit amount (`raw_centavos`), so a
 *     fractional percent cannot drift by rounding;
 *   • the auto "Final balance" row → the builder's auto-balance label and due.
 * A malformed or absent schedule seeds null, and the builder keeps its default.
 */
export type QuoteRevisionSchedule = {
  manual: InstallmentDraft[];
  autoBalance: AutoBalanceMeta | null;
};

export function seedScheduleFromStored(raw: unknown): QuoteRevisionSchedule | null {
  if (!isResolvedSchedule(raw)) return null;
  const rows = [...raw.installments].sort((a, b) => Number(a.seq) - Number(b.seq));
  const manual: InstallmentDraft[] = [];
  let autoBalance: AutoBalanceMeta | null = null;
  for (const r of rows) {
    const due = r.due === 'before_event' || r.due === 'on_event' ? r.due : 'on_lock';
    const offsetDays = Math.max(0, Math.round(Number(r.offset_days) || 0));
    const label = String(r.label ?? '').trim();
    if (r.is_auto_balance) {
      autoBalance = { label: label || 'Final balance', due, offsetDays };
      continue;
    }
    const bps = r.percent_bps == null ? null : Math.round(Number(r.percent_bps));
    if (r.kind === 'percent' && bps !== null && Number.isFinite(bps) && bps % 100 === 0) {
      manual.push({ label: label || 'Payment', kind: 'percent', amountPhp: null, percent: bps / 100, due, offsetDays });
    } else {
      const raw = Math.max(0, Math.round(Number(r.raw_centavos ?? r.amount_centavos) || 0));
      manual.push({ label: label || 'Payment', kind: 'fixed', amountPhp: raw / 100, percent: null, due, offsetDays });
    }
  }
  if (manual.length === 0) return null;
  return { manual, autoBalance };
}

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
  /** The replaced quote's payment schedule, in the builder's draft shape; null = keep the default. */
  schedule: QuoteRevisionSchedule | null;
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
  payment_schedule?: unknown;
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
    schedule: seedScheduleFromStored(row.payment_schedule),
  };
}
