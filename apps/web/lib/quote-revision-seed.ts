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
import { lineStructureOf } from './quote-line-structure';
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

/**
 * One seeded builder line — the builder's `QuoteSeedLine` shape.
 *
 * 🧭 A LINE WRITTEN SINCE 12 NOV RE-OPENS AS IT WAS PRICED: its `basis`, rate and card ride in the `line_items` JSON
 * (lib/quote-line-structure.ts), so a per-pax line comes back per-pax and keeps following their guest list — before,
 * every revision flattened it to its stored amount with `minPax: 0`, and the supplier's minimum vanished. A line from
 * an older quote (no basis stored) still seeds flat at its stored amount, as the header explains. The per-line minimum
 * is gone: the quote has ONE minimum (`minPax` on the seed, from `merge_snapshot.min_pax`).
 */
export type QuoteRevisionLine = {
  label: string;
  basis: 'flat' | 'per_pax' | 'per_hour';
  free: boolean;
  flatPhp: number;
  ratePhp: number;
  minPax: 0;
  basePhp: number;
  inclHours: number;
  extraPhp: number;
  /** The service card the line came from; null for a typed line or an older quote. */
  cardId: string | null;
};

/**
 * 🏷 THE OFFER THE REPLACED QUOTE CARRIED (owner 12 Nov, "QUOTE MONEY — THREE ANSWERS" (1): *"once the client has added
 * a service at that price, that service's discount stays with it"*). Its named line is NOT folded into the Discount
 * field: the revision re-applies it, re-priced while it still fits and at its stored amount once it no longer does
 * (an offer that has since ended is still this quote's).
 */
export type QuoteRevisionOffer = {
  id: string;
  name: string;
  /** What it took off, in pesos, as stored. */
  offPhp: number;
  /** Its stored caption ("5% off · on Garden buffet only · offer"). */
  detail: string | null;
  /** The gifts that came from it, by name (Complimentary lines). */
  giftLabels: string[];
};

export type QuoteRevisionSeed = {
  /** The quote being replaced — named in the builder's banner. */
  of: { publicId: string; title: string; totalCentavos: number; status: string; sentAt: string | null };
  lines: QuoteRevisionLine[];
  /** Sum of the negative lines that are not an offer, as a positive peso amount for the Discount field. */
  discountPhp: number;
  /** The offer this quote carried (its own named line), or null. */
  offer: QuoteRevisionOffer | null;
  /** OWN-01: the offer the Discount was filled in from (`from_offer_id`), so the revision still names it; or null. */
  discountOfferId: string | null;
  /** The quote's ONE pax minimum (`merge_snapshot.min_pax`); null on a quote written before it. */
  minPax: number | null;
  title: string;
  note: string;
  validUntil: string;
  paymentMethodIds: string[];
  /** The replaced quote's payment schedule, in the builder's draft shape; null = keep the default. */
  schedule: QuoteRevisionSchedule | null;
  /**
   * The supplier's own answer on the quote being replaced — NOT the card's.
   * `null` means that quote expressed no opinion, which is a real answer: the
   * column is nullable by design, so the builder falls through to the cards.
   */
  giftSwitch: boolean | null;
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
  includes_setnayan_gift?: boolean | null;
  merge_snapshot?: unknown;
};

/**
 * EVERY COLUMN `seedQuoteRevision` READS, as one value the page selects with.
 *
 * 🔑 IT IS A CONSTANT SO THAT A UNIT TEST CAN EXECUTE IT. The read lives in a
 * server component, which a test can never import, so a guard over the query
 * itself could only grep. Holding the column list here moves the thing that can
 * be got wrong into a pure module — drop a column and
 * `the-revision-keeps-the-suppliers-answer.test.ts` goes red by RUNNING this,
 * not by reading the page's source.
 *
 * Why that matters here specifically: `includes_setnayan_gift` was written on
 * send and never asked for again, so the supplier's answer was discarded by the
 * QUERY, a layer above the builder. A fix that only touched the component would
 * have shipped green and still lost it.
 *
 * ⚠ ONE literal with `as const`, never a `+` concatenation: supabase-js types the
 * returned row FROM the select string's literal type, and a concatenation infers
 * as plain `string`, which degrades the row to `GenericStringError`.
 */
export const QUOTE_REVISION_SELECT =
  'public_id, title, total_centavos, status, sent_at, rendered_body, valid_until, line_items, payment_method_ids, payment_schedule, includes_setnayan_gift, merge_snapshot' as const;

const peso = (centavos: number) => Math.round(centavos) / 100;

export function seedQuoteRevision(row: QuoteRevisionSource): QuoteRevisionSeed {
  const raw: ProposalLineItem[] = Array.isArray(row.line_items)
    ? (row.line_items as ProposalLineItem[])
    : [];

  const lines: QuoteRevisionLine[] = [];
  let discountCentavos = 0;
  let discountOfferId: string | null = null;
  let offer: QuoteRevisionOffer | null = null;
  const offerGifts: { id: string; label: string }[] = [];
  for (const li of raw) {
    const label = String(li?.label ?? '').trim();
    if (!label) continue;
    const amount =
      li?.amount_centavos == null || !Number.isFinite(Number(li.amount_centavos))
        ? null
        : Math.round(Number(li.amount_centavos));
    const s = lineStructureOf(li);
    if (amount != null && amount < 0) {
      if (s.offer_id && !offer) {
        // The offer's own named line — kept as the offer, never folded into the Discount.
        offer = { id: s.offer_id, name: label, offPhp: peso(-amount), detail: li?.detail ?? null, giftLabels: [] };
        continue;
      }
      // Folded into the Discount field — see the header for why.
      discountCentavos += -amount;
      if (s.from_offer_id && !discountOfferId) discountOfferId = s.from_offer_id;
      continue;
    }
    if (amount == null && s.offer_id) {
      // A gift from the offer: it comes back with the offer, not as a line of its own.
      offerGifts.push({ id: s.offer_id, label });
      continue;
    }
    const rate = s.rate_centavos != null ? peso(s.rate_centavos) : 0;
    const basis = amount != null && rate > 0 && (s.basis === 'per_pax' || s.basis === 'per_hour') ? s.basis : 'flat';
    lines.push({
      label,
      basis,
      free: amount == null,
      flatPhp: amount == null ? 0 : peso(amount),
      ratePhp: basis === 'per_pax' ? rate : 0,
      minPax: 0,
      basePhp: basis === 'per_hour' ? rate : 0,
      inclHours: basis === 'per_hour' ? Math.max(0, s.incl_hours ?? 0) : 0,
      extraPhp: basis === 'per_hour' ? peso(s.extra_hour_centavos ?? 0) : 0,
      cardId: s.card_id ?? null,
    });
  }
  // A gift-only offer has no named line of its own — its gifts still say which offer this quote carried.
  if (!offer && offerGifts.length > 0) offer = { id: offerGifts[0]!.id, name: 'Your offer', offPhp: 0, detail: null, giftLabels: [] };
  if (offer) {
    const id = offer.id;
    offer.giftLabels = offerGifts.filter((g) => g.id === id).map((g) => g.label);
  }
  // A gift from some OTHER offer than the one this quote carries seeds as an ordinary complimentary line.
  for (const g of offerGifts) {
    if (offer && g.id === offer.id) continue;
    lines.push({ label: g.label, basis: 'flat', free: true, flatPhp: 0, ratePhp: 0, minPax: 0, basePhp: 0, inclHours: 0, extraPhp: 0, cardId: null });
  }
  const snap = (row.merge_snapshot ?? {}) as { min_pax?: unknown };
  const minRaw = Math.round(Number(snap.min_pax));
  const minPax = snap.min_pax != null && Number.isFinite(minRaw) && minRaw > 0 ? minRaw : null;

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
    offer,
    discountOfferId,
    minPax,
    title: row.title ?? '',
    note: row.rendered_body ?? '',
    // ⏳ An EXPIRED quote seeds everything but its date: its Valid until is the past, and a send must be after today
    // (the picker opens on 7 · 14 · 30 days with none chosen — FINAL RULINGS 2026-11-09).
    validUntil: row.status !== 'expired' && /^\d{4}-\d{2}-\d{2}$/.test(row.valid_until ?? '') ? (row.valid_until as string) : '',
    paymentMethodIds: ids,
    schedule: seedScheduleFromStored(row.payment_schedule),
    giftSwitch: row.includes_setnayan_gift ?? null,
  };
}
