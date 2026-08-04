// lib/vendor-autoreply/adapter.ts
//
// Adapter (Phase 3): maps the vendor's OWN loaded DB rows + the couple's Event
// Brief into the pure engine's normalized contract. Kept pure so it is unit-
// testable; the Phase-3 hook loads the rows (service-role, vendor-scoped) and
// calls toStoreSnapshot() / toEventBriefLite(), then decideReply().
//
// Isolation (§2A): the caller passes ONE vendor's rows + ONE couple's brief —
// this function never reaches across vendors or couples.

import type { EventBrief } from '../event-brief';
import type { ServiceAddonRow } from '../vendor-service-addons';
import type { VendorCoverageRow } from '../vendor-coverages';
import type { VendorPackageWithItems } from '../vendor-packages';
import type {
  VendorServiceDiscount,
  VendorServiceInclusion,
  VendorServiceRow,
} from '../vendor-services';
import type {
  EventBriefLite,
  StoreDiscount,
  StoreService,
  VendorStoreSnapshot,
} from './types';

type ReviewPreview = { rating_overall: number; body: string | null; created_at: string };

export type SnapshotSources = {
  businessName: string;
  services: readonly VendorServiceRow[];
  inclusionsByService: ReadonlyMap<string, readonly VendorServiceInclusion[]>;
  discountsByService: ReadonlyMap<string, readonly VendorServiceDiscount[]>;
  addonsByService: ReadonlyMap<string, readonly ServiceAddonRow[]>;
  packages: readonly VendorPackageWithItems[];
  coverages: readonly VendorCoverageRow[];
  coverageLabels?: ReadonlyMap<string, string>; // canonical_service -> resolved human label
  reviews: readonly ReviewPreview[];
  avgRating: number | null;
  reviewCount: number | null;
};

function activeDiscounts(
  ds: readonly VendorServiceDiscount[] | undefined,
  now: number,
): StoreDiscount[] {
  if (!ds) return [];
  return ds
    .filter((d) => !d.expires_at || Date.parse(d.expires_at) > now)
    .map((d) => ({
      type: d.discount_type,
      rate: d.rate,
      unit: d.unit,
      minLeadMonths: d.min_lead_months,
    }));
}

function toStoreService(row: VendorServiceRow, src: SnapshotSources, now: number): StoreService {
  return {
    serviceId: row.vendor_service_id,
    category: row.category,
    title: row.title,
    startingPricePhp: row.starting_price_php,
    pricingBasis: row.pricing_basis,
    perPaxPricePhp: row.per_pax_price_php,
    minPax: row.min_pax,
    basePax: row.base_pax,
    hourBasePhp: row.hour_base_php,
    minHours: row.min_hours,
    extraHourPhp: row.extra_hour_php,
    addedPaxPricePhp: row.added_pax_price_php,
    crewSize: row.crew_size,
    crewMealIncluded: row.crew_meal_included,
    transportIncluded: row.transport_included,
    transportFlatFeePhp: row.transport_flat_fee_php,
    recommendedLeadTimeMonths: row.recommended_lead_time_months,
    lastMinuteEndMonths: row.last_minute_end_months,
    lastMinuteSurchargePct: row.last_minute_surcharge_pct,
    dailyCapacity: row.daily_capacity,
    inclusions: (src.inclusionsByService.get(row.vendor_service_id) ?? []).map((i) => ({
      label: i.label,
      worthPhp: i.worth_php,
    })),
    discounts: activeDiscounts(src.discountsByService.get(row.vendor_service_id), now),
    addons: (src.addonsByService.get(row.vendor_service_id) ?? []).map((a) => ({
      label: a.label,
      fromPricePhp: a.from_price_php,
    })),
  };
}

export function toStoreSnapshot(src: SnapshotSources, now: number = Date.now()): VendorStoreSnapshot {
  return {
    businessName: src.businessName,
    services: src.services.filter((s) => s.is_active).map((s) => toStoreService(s, src, now)),
    packages: src.packages
      .filter((p) => p.is_active)
      .map((p) => ({
        packageId: p.package_id,
        name: p.package_name,
        description: p.description,
        totalPriceCentavos: p.total_price_centavos,
        items: p.items.map((i) => ({
          description: i.service_description,
          included: i.is_default_included,
        })),
      })),
    coverages: src.coverages.map((c) => ({
      canonicalService: c.canonical_service,
      eventTypes: c.event_types,
      faiths: c.faiths,
      label: src.coverageLabels?.get(c.canonical_service) ?? null,
    })),
    reviews: src.reviews.map((r) => ({
      ratingOverall: r.rating_overall,
      body: r.body,
      createdAt: r.created_at,
    })),
    avgRating: src.avgRating,
    reviewCount: src.reviewCount,
  };
}

/**
 * Narrow the full Event Brief to the vendor-facing lite contract.
 *
 * `consent.shareBudgetBand` is a REQUIRED argument, not an option with a
 * default: a caller that forgets it is a TypeScript error rather than a silent
 * opt-in. That is the whole safety property — see `EventBriefLite.budgetBand`
 * for what this replaced and why (per-head × pax reconstructed the couple's
 * exact budget past an opt-in that was default-FALSE).
 *
 * Nothing derived from `budget.perHeadCentavos` or `budget.amountCentavos` may
 * be returned from here. A guard test asserts that by reading this source.
 */
export function toEventBriefLite(
  brief: EventBrief,
  consent: { shareBudgetBand: boolean },
): EventBriefLite {
  return {
    primaryDate: brief.constraints.date.primary,
    candidateDates: brief.constraints.date.candidates,
    pax: brief.constraints.pax,
    // Coarse band, gated on the host's opt-in. No figure, either way.
    budgetBand: consent.shareBudgetBand ? brief.constraints.budget.band : null,
    region: brief.constraints.location.region,
  };
}
