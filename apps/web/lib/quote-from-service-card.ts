/**
 * quote-from-service-card.ts — ONE SERVICE CARD (or several) BECOMES THE QUOTE
 * BEING WRITTEN: its lines, its crew and travel, its discount, its payment
 * schedule and terms. PURE — no database, no `server-only`, no clock of its own.
 *
 * ── THE DEFECT THIS CLOSES (owner, 2026-09-22) ─────────────────────────────
 * *"The quotation maker in the vendor chatbox … can load 1 or multiple service
 * cards combined."* It could not. The builder's only seed was
 * `loadPackageLinesForQuote` → `vendor_packages`, and production holds ZERO
 * packages and ZERO proposal templates (`select count(*) from vendor_packages`
 * → 0, 2026-09-22), so the "Start from a package" picker never rendered for a
 * real shop and every quote was typed from a blank line. The thing suppliers
 * DO author — the service card — carried everything a line needs and none of
 * it reached the quote.
 *
 * ── WHAT A CARD CARRIES, AND WHERE EACH PART LANDS ─────────────────────────
 *   · price by basis (fixed / per_pax / per_hour) ……… the card's priced line
 *   · price brackets by pax ……………………………………… the fixed line picks the bracket for the count
 *   · base_pax + added_pax_price_php / added_pax_block … an "Added guests" line above the base
 *   · inclusions ………………………………………………………… ₱0 "Complimentary" lines (the freebie move)
 *   · add-ons the supplier ticked ………………………………… priced lines
 *   · discounts (early booking judged on the EVENT DATE) … the Discount field, WITH ITS REASON
 *   · crew_meal_required / crew_meal_included / crew_size … the crew control's opening state
 *   · transport_included / transport_flat_fee_php ………… the transport control's opening state
 *   · payment schedule + the seq-0 reservation terms ……… the self-balancing schedule
 *   · last-minute surcharge inside its window ………………… a surcharge line, named
 *   · recommended lead time ……………………………………… a warning, never a block
 *
 * ⚖ OWNER, 2026-09-22, verbatim: *"apply the discount"* — the card's discount is
 * APPLIED to the quote (not merely suggested), labelled with its reason, and
 * the supplier may still edit it. `pickBestDiscount` decides WHICH one and
 * whether this couple qualifies (an early-booking rung only survives when the
 * event date is far enough out) — this file does not re-derive that rule.
 *
 * 🔑 NO MONEY IS COMPUTED HERE THAT IS NOT ALREADY COMPUTED SOMEWHERE ELSE.
 * Lines are handed to the builder in the SAME `QuoteSeedLine` shape the package
 * seed uses, so `resolvePackageLine` prices them; the schedule is handed over
 * as `InstallmentDraft`s so `resolveSchedule` balances it; the discount is
 * `pickBestDiscount`'s own `savingsPhp`; the added-guest surcharge is
 * `computeAddedPaxSurcharge`. A second resolver here would agree on the day it
 * was written and drift at the first pricing change.
 *
 * ⚠ THE CREW MEAL'S PER-HEAD PRICE IS NOT ON THE CARD. The card says whether a
 * crew meal is required and whether it is included; it does not price one. So
 * `crew.perHeadPhp` is `null` here — the builder keeps whatever it already
 * shows — rather than a number this file would have had to invent (owner,
 * 2026-08-31: "don't guess").
 *
 * ⚠ DAILY CAPACITY IS NOT DECIDED HERE. Whether the card still has a booking
 * left on the date needs the bookings table; a pure module cannot know. The
 * caller reads it and the screen says so. Nothing here pretends to.
 */

import { computeAddedPaxSurcharge } from '@/lib/added-pax-surcharge';
import type { InstallmentDraft, AutoBalanceMeta } from '@/lib/proposal-payment-schedule';
import { pickBestDiscount, type BestDiscount } from '@/lib/vendor-service-public';
import type {
  VendorServiceDiscount,
  VendorServiceInclusion,
  VendorServicePriceBracket,
  VendorServiceRow,
} from '@/lib/vendor-services';

/* ── The seed shape the builder already consumes ─────────────────────────── */

/**
 * One seeded line for the Proposal Maker — the SAME shape the package seed
 * (`loadPackageLinesForQuote`) hands over, so the builder needs no second
 * import path. Peso-facing, like the editor's inputs.
 */
export type QuoteSeedLine = {
  label: string;
  basis: 'flat' | 'per_pax' | 'per_hour';
  free: boolean;
  flatPhp: number;
  ratePhp: number;
  minPax: number;
  basePhp: number;
  inclHours: number;
  extraPhp: number;
};

export type QuoteSeedCrew = {
  mode: 'included' | 'charge' | 'offset';
  /** `crew_size` when the card states one; null keeps the builder's value. */
  size: number | null;
  /** NOT on the card — always null. The builder keeps its own figure. */
  perHeadPhp: null;
};

export type QuoteSeedTransport = {
  mode: 'included' | 'flat' | 'distance';
  flatPhp: number;
};

/** The card's discount, as applied to the quote — with the reason the supplier reads. */
export type QuoteSeedDiscount = {
  /** Pesos off, `pickBestDiscount`'s own `savingsPhp`. */
  php: number;
  /** "Booked 6+ months ahead · −10%" / "₱2,000 off · bundle" — `BestDiscount.label`. */
  reason: string;
  type: BestDiscount['type'];
};

export type QuoteSeedSchedule = {
  manual: InstallmentDraft[];
  autoBalance: AutoBalanceMeta | null;
  /** The seq-0 reservation terms, joined for the terms line. Null when none stated. */
  terms: string | null;
};

export type QuoteSeedWarning =
  /** The event is nearer than the card's `recommended_lead_time_months`. */
  | { kind: 'lead_time'; recommendedMonths: number; monthsAway: number }
  /** Inside the card's last-minute window: the surcharge line was added. */
  | { kind: 'last_minute'; pct: number; endMonths: number };

export type ServiceCardQuoteSeed = {
  lines: QuoteSeedLine[];
  crew: QuoteSeedCrew | null;
  transport: QuoteSeedTransport | null;
  discount: QuoteSeedDiscount | null;
  schedule: QuoteSeedSchedule | null;
  warnings: QuoteSeedWarning[];
  /** The cards' names joined — the auto-title the builder offers. */
  title: string;
};

/* ── Inputs ──────────────────────────────────────────────────────────────── */

/** The card columns this file reads. A subset of `VendorServiceRow`. */
export type ServiceCardForQuote = Pick<
  VendorServiceRow,
  | 'vendor_service_id'
  | 'pricing_basis'
  | 'starting_price_php'
  | 'per_pax_price_php'
  | 'min_pax'
  | 'hour_base_php'
  | 'min_hours'
  | 'extra_hour_php'
  | 'base_pax'
  | 'added_pax_price_php'
  | 'crew_size'
  | 'crew_meal_required'
  | 'crew_meal_included'
  | 'transport_included'
  | 'transport_flat_fee_php'
  | 'recommended_lead_time_months'
  | 'last_minute_end_months'
  | 'last_minute_surcharge_pct'
> & {
  /** `added_pax_block` is not on `VendorServiceRow`; 1 when absent. */
  added_pax_block?: number | null;
};

export type ServiceCardAddon = { id: number; label: string; from_price_php: number | null };

/** One row of `vendor_service_payment_schedules`, the columns the seed reads. */
export type ServiceCardScheduleRow = {
  seq: number;
  label: string;
  amount_kind: 'percent' | 'fixed';
  percent_bps: number | null;
  amount_centavos: number | null;
  due_anchor: 'on_lock' | 'before_event' | null;
  due_offset_days: number | null;
  cancellation_terms: string | null;
  downpayment_non_refundable: boolean;
  refund_window_days: number | null;
  no_show_forfeit: boolean;
};

export type CardForQuoteInput = {
  card: ServiceCardForQuote;
  /**
   * The name the line and the title carry — resolved by the CALLER through
   * `cardKindLabeller` (a card's kind may be the shop's own coverage word).
   * ⚠ Never `title ?? 'Untitled service'`: both live cards have a NULL title.
   */
  label: string;
  inclusions: readonly VendorServiceInclusion[];
  brackets: readonly VendorServicePriceBracket[];
  discounts: readonly VendorServiceDiscount[];
  addons: readonly ServiceCardAddon[];
  /** Add-on ids the supplier ticked. Untouched add-ons stay off the quote. */
  chosenAddonIds: readonly number[];
  schedule: readonly ServiceCardScheduleRow[];
};

export type QuoteFromCardsInput = {
  cards: readonly CardForQuoteInput[];
  /** The count the builder is pricing against (the live count by default). */
  pax: number;
  hours: number;
  /** `events.event_date` (YYYY-MM-DD) or null — decides the early-booking rung and the windows. */
  eventDate: string | null;
  /** The render's one clock — injected, never `Date.now()` in here. */
  now: Date;
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Whole months between `now` and the event date; null when there is no date. */
export function monthsUntil(eventDate: string | null, now: Date): number | null {
  if (!eventDate) return null;
  const d = new Date(`${eventDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - now.getTime();
  return ms / (1000 * 60 * 60 * 24 * 30.4375);
}

/** The bracket that holds `pax`, or null. Brackets are inclusive on both ends; `max_pax` null = open. */
export function bracketFor(
  brackets: readonly VendorServicePriceBracket[],
  pax: number,
): VendorServicePriceBracket | null {
  for (const b of brackets) {
    const lo = b.min_pax ?? 0;
    const hi = b.max_pax ?? Number.POSITIVE_INFINITY;
    if (pax >= lo && pax <= hi) return b;
  }
  return null;
}

function priceLine(card: ServiceCardForQuote, label: string, brackets: readonly VendorServicePriceBracket[], pax: number): QuoteSeedLine {
  const basis = card.pricing_basis === 'per_pax' || card.pricing_basis === 'per_hour' ? card.pricing_basis : 'flat';
  const bracket = basis === 'flat' ? bracketFor(brackets, pax) : null;
  return {
    label,
    basis,
    free: false,
    flatPhp: bracket ? num(bracket.price_php) : num(card.starting_price_php),
    ratePhp: num(card.per_pax_price_php),
    minPax: num(card.min_pax),
    basePhp: num(card.hour_base_php),
    inclHours: num(card.min_hours),
    extraPhp: num(card.extra_hour_php),
  };
}

/** The peso figure a discount is measured against — the same anchor the card advertises. */
export function discountAnchorPhp(card: ServiceCardForQuote, brackets: readonly VendorServicePriceBracket[], pax: number): number | null {
  if (card.pricing_basis === 'per_pax') {
    const rate = num(card.per_pax_price_php);
    return rate > 0 ? rate * Math.max(pax, num(card.min_pax)) : null;
  }
  if (card.pricing_basis === 'per_hour') {
    const base = num(card.hour_base_php);
    return base > 0 ? base : null;
  }
  const bracket = bracketFor(brackets, pax);
  const flat = bracket ? num(bracket.price_php) : num(card.starting_price_php);
  return flat > 0 ? flat : null;
}

/** The seq-0 reservation policy as one readable line, or null when nothing is stated. */
export function termsLine(rows: readonly ServiceCardScheduleRow[]): string | null {
  const dp = rows.find((r) => r.seq === 0) ?? rows[0];
  if (!dp) return null;
  const parts: string[] = [];
  if (dp.cancellation_terms?.trim()) parts.push(dp.cancellation_terms.trim());
  if (dp.downpayment_non_refundable) parts.push(`${dp.label || 'Downpayment'} non-refundable`);
  if (dp.refund_window_days != null && dp.refund_window_days > 0) parts.push(`refund window ${dp.refund_window_days} days`);
  if (dp.no_show_forfeit) parts.push('no-show forfeits the downpayment');
  return parts.length ? parts.join(' · ') : null;
}

/**
 * The card's schedule rows → the builder's drafts. Every stored row is a MANUAL
 * installment (the auto "Final balance" is the resolver's, never a stored row);
 * the auto balance is left to the builder's default so the schedule still pays
 * to ₱0 when the card's rows do not sum to 100 %.
 */
export function scheduleFromCard(rows: readonly ServiceCardScheduleRow[]): QuoteSeedSchedule | null {
  const sorted = [...rows].sort((a, b) => num(a.seq) - num(b.seq));
  const manual: InstallmentDraft[] = [];
  for (const r of sorted) {
    const due = r.due_anchor === 'before_event' ? 'before_event' : 'on_lock';
    const offsetDays = Math.max(0, Math.round(num(r.due_offset_days)));
    const label = (r.label ?? '').trim() || (r.seq === 0 ? 'Downpayment' : `Payment ${r.seq}`);
    if (r.amount_kind === 'percent' && r.percent_bps != null && num(r.percent_bps) > 0) {
      manual.push({ label, kind: 'percent', amountPhp: null, percent: num(r.percent_bps) / 100, due, offsetDays });
    } else if (r.amount_centavos != null && num(r.amount_centavos) > 0) {
      manual.push({ label, kind: 'fixed', amountPhp: Math.round(num(r.amount_centavos)) / 100, percent: null, due, offsetDays });
    }
  }
  if (manual.length === 0) return null;
  return { manual, autoBalance: null, terms: termsLine(rows) };
}

/* ── The seed ────────────────────────────────────────────────────────────── */

/**
 * Everything the loaded card(s) put on the quote. Several cards COMBINE: every
 * card contributes its priced line, its freebies and its ticked add-ons; the
 * crew / transport / discount / schedule come from the cards in order (the
 * first card that states a thing wins — one quote has one schedule).
 */
export function quoteFromServiceCards(input: QuoteFromCardsInput): ServiceCardQuoteSeed {
  const pax = Math.max(0, Math.round(num(input.pax)));
  const lines: QuoteSeedLine[] = [];
  const warnings: QuoteSeedWarning[] = [];
  let crew: QuoteSeedCrew | null = null;
  let transport: QuoteSeedTransport | null = null;
  let discount: QuoteSeedDiscount | null = null;
  let schedule: QuoteSeedSchedule | null = null;
  const monthsAway = monthsUntil(input.eventDate, input.now);

  for (const c of input.cards) {
    const card = c.card;
    const label = c.label.trim() || 'Service';

    // 1 · the price, as the card sells it (bracket for the count when it has one)
    const base = priceLine(card, label, c.brackets, pax);
    lines.push(base);

    // 2 · guests above the base the price covers (the card's own added-pax rule)
    const surcharge = computeAddedPaxSurcharge({
      livePax: pax,
      quoteBasePax: card.base_pax ?? null,
      ratePhp: card.added_pax_price_php ?? null,
      block: card.added_pax_block ?? 1,
    });
    if (surcharge > 0 && card.base_pax != null) {
      lines.push({ ...base, label: `Added guests · ${pax - card.base_pax} over ${card.base_pax}`, basis: 'flat', flatPhp: surcharge });
    }

    // 3 · last-minute surcharge, only inside the card's own window
    if (
      monthsAway != null &&
      card.last_minute_end_months != null &&
      card.last_minute_surcharge_pct != null &&
      num(card.last_minute_surcharge_pct) > 0 &&
      monthsAway <= num(card.last_minute_end_months)
    ) {
      const pct = num(card.last_minute_surcharge_pct);
      const anchor = discountAnchorPhp(card, c.brackets, pax) ?? 0;
      lines.push({ ...base, label: `Last-minute surcharge · ${pct}%`, basis: 'flat', flatPhp: Math.round((anchor * pct) / 100) });
      warnings.push({ kind: 'last_minute', pct, endMonths: num(card.last_minute_end_months) });
    }

    // 4 · what the card includes, as freebies
    for (const inc of [...c.inclusions].sort((a, b) => num(a.sort_order) - num(b.sort_order))) {
      lines.push({ ...base, label: inc.label, basis: 'flat', free: true, flatPhp: 0 });
    }

    // 5 · the add-ons the supplier ticked
    for (const a of c.addons) {
      if (!c.chosenAddonIds.includes(a.id)) continue;
      lines.push({ ...base, label: a.label, basis: 'flat', free: false, flatPhp: num(a.from_price_php) });
    }

    // 6 · crew and travel: the card's flags open the controls in the right state
    if (!crew) {
      crew = card.crew_meal_included
        ? { mode: 'included', size: card.crew_size ?? null, perHeadPhp: null }
        : card.crew_meal_required
          ? { mode: 'charge', size: card.crew_size ?? null, perHeadPhp: null }
          : null;
    }
    if (!transport) {
      transport = card.transport_included
        ? { mode: 'included', flatPhp: 0 }
        : num(card.transport_flat_fee_php) > 0
          ? { mode: 'flat', flatPhp: num(card.transport_flat_fee_php) }
          : { mode: 'distance', flatPhp: 0 };
    }

    // 7 · the discount this couple qualifies for, applied with its reason
    if (!discount) {
      const best = pickBestDiscount(c.discounts, discountAnchorPhp(card, c.brackets, pax), {
        eventDate: input.eventDate,
        now: input.now,
      });
      // 'up-to' means no event date — the card ADVERTISES a ladder nobody has
      // qualified for; applying it would promise a rung the date may not earn.
      if (best && best.savingsPhp > 0 && best.leadTier !== 'up-to') {
        discount = { php: best.savingsPhp, reason: best.label, type: best.type };
      }
    }

    // 8 · the card's payment schedule and reservation terms
    if (!schedule) schedule = scheduleFromCard(c.schedule);

    // 9 · lead time — a warning, never a block
    if (monthsAway != null && card.recommended_lead_time_months != null && monthsAway < num(card.recommended_lead_time_months)) {
      warnings.push({ kind: 'lead_time', recommendedMonths: num(card.recommended_lead_time_months), monthsAway });
    }
  }

  return {
    lines,
    crew,
    transport,
    discount,
    schedule,
    warnings,
    title: input.cards.map((c) => c.label.trim()).filter(Boolean).join(' + '),
  };
}

/* ── The builder's side: what a seed changes in the draft, and what it leaves ── */

/** The builder's editable pieces a card seed may touch. Peso-facing, like the inputs. */
export type QuoteDraftForSeed = {
  crew: { mode: 'included' | 'charge' | 'offset'; size: number; perHeadPhp: number };
  transport: { mode: 'included' | 'flat' | 'distance'; flatPhp: number };
  discountPhp: number;
  /** The couple has booked a crew-meal service — the builder's `offset` case. */
  coupleProvidesCrewMeal: boolean;
};

export type QuoteDraftAfterSeed = {
  lines: QuoteSeedLine[];
  crew: QuoteDraftForSeed['crew'];
  transport: QuoteDraftForSeed['transport'];
  discountPhp: number;
  /** The reason beside the Discount field, and the detail on the couple's Discount line. Null = typed by hand. */
  discountReason: string | null;
  schedule: InstallmentDraft[] | null;
  terms: string | null;
  title: string;
};

/**
 * APPLY A CARD SEED TO THE DRAFT — the one place that decides what the card
 * overrides and what the supplier keeps. Pure, so the builder cannot get it
 * wrong in JSX and a test can execute every branch.
 *
 *   · lines           — REPLACED by the seed (the same contract the package seed has had since
 *                       2026-07-13: "seeds the line items — you can still edit each one")
 *   · crew            — the MODE comes from the card; the size only when the card states one;
 *                       the per-head price is NEVER the card's (it has none) — the draft's stays.
 *                       ⚖ A couple who booked a crew-meal service keeps `offset`, whatever the
 *                       card says: their booking is the newer fact.
 *   · transport       — from the card when it says anything; the flat fee only when it states one.
 *   · discount        — the card's, WITH its reason (owner 2026-09-22: "apply the discount");
 *                       a card with no applicable discount leaves the field as it was and the
 *                       reason empty — a hand-typed figure is never silently zeroed.
 *   · schedule/terms  — the card's rows when it has any; else the draft keeps its own.
 */
export function applyCardSeedToDraft(seed: ServiceCardQuoteSeed, draft: QuoteDraftForSeed): QuoteDraftAfterSeed {
  const crew = seed.crew
    ? {
        mode: draft.coupleProvidesCrewMeal ? ('offset' as const) : seed.crew.mode,
        size: seed.crew.size ?? draft.crew.size,
        perHeadPhp: draft.crew.perHeadPhp,
      }
    : draft.crew;
  const transport = seed.transport
    ? { mode: seed.transport.mode, flatPhp: seed.transport.mode === 'flat' ? seed.transport.flatPhp : draft.transport.flatPhp }
    : draft.transport;
  return {
    lines: seed.lines,
    crew,
    transport,
    discountPhp: seed.discount ? seed.discount.php : draft.discountPhp,
    discountReason: seed.discount ? seed.discount.reason : null,
    schedule: seed.schedule ? seed.schedule.manual : null,
    terms: seed.schedule?.terms ?? null,
    title: seed.title,
  };
}
