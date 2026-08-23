/**
 * STORED CARD ROWS → THE EDITORS' DRAFT SHAPES.
 *
 * Pure module — no env, no I/O, no React. Runs under `tsx --test`.
 *
 * The list editors (`InclusionsEditor` · `DiscountsEditor` · `PriceBracketsEditor`)
 * all take an `initial` array of string-typed drafts, because their inputs are
 * uncontrolled `defaultValue`s and an uncontrolled input's value IS a string.
 * Three converters turn the stored numeric rows into those drafts.
 *
 * ── WHY THEY MOVED HERE ─────────────────────────────────────────────────────
 * They were private to `services-manager.tsx`, which seeds the EDIT form. The
 * maker now seeds itself from an existing card too ("start from one of your
 * cards"), and a second copy of these would be two spellings of "what the vendor
 * already authored" — the shape that drifts. One home, both callers.
 *
 * ⚠ Every rule here is a ROUND-TRIP rule: a value that fails to convert is a
 * value the vendor silently loses. `min_lead_months` is the worked example — the
 * early-booking ladder rung was dropped by an earlier edit form until it was
 * carried explicitly, and the vendor's tier vanished on re-save with nothing
 * said.
 */
import type {
  VendorServiceDiscount,
  VendorServiceInclusion,
  VendorServicePriceBracket,
} from './vendor-services';
import type {
  BracketDraft,
  DiscountDraft,
  InclusionDraft,
} from '@/app/vendor-dashboard/services/_components/service-list-editors';

export function discountsToDrafts(rows: VendorServiceDiscount[]): DiscountDraft[] {
  return rows.map((d) => ({
    discount_type: d.discount_type,
    rate: String(d.rate),
    unit: d.unit,
    // Early-booking ladder rung (migration 20271017996549) — round-trips so a
    // re-edit doesn't silently erase the tier the vendor already authored.
    min_lead_months: d.min_lead_months != null ? String(d.min_lead_months) : '',
    expires_at: d.expires_at ? d.expires_at.slice(0, 10) : '',
    conditions_md: d.conditions_md ?? '',
  }));
}

export function inclusionsToDrafts(rows: VendorServiceInclusion[]): InclusionDraft[] {
  return rows.map((n) => ({
    label: n.label,
    worth: n.worth_php != null ? String(n.worth_php) : '',
  }));
}

export function bracketsToDrafts(rows: VendorServicePriceBracket[]): BracketDraft[] {
  return rows.map((b) => ({
    min_pax: b.min_pax != null ? String(b.min_pax) : '',
    max_pax: b.max_pax != null ? String(b.max_pax) : '',
    price: String(b.price_php),
  }));
}
