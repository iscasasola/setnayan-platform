// lib/vendor-autoreply/types.ts
//
// Normalized input contract for the deterministic Auto-Reply engine (Phase 2).
// The engine is PURE — no DB, no time, no LLM. Phase 3's adapter builds these
// snapshots from vendor_services / vendor_packages / vendor_coverages /
// vendor_reviews + the Event Brief (buildEventBrief), pre-filtering expired
// discounts and computing availability, then calls decideReply().
//
// Data-isolation lock (§2A): a snapshot is assembled from ONE vendor's own rows
// and ONE couple's own event — the engine never sees another vendor's or
// another couple's data.

export type Intent =
  | 'price'
  | 'availability'
  | 'inclusions'
  | 'capability'
  | 'coverage'
  | 'lead_time'
  | 'discount'
  | 'social_proof'
  | 'customization'
  | 'booking'
  | 'unknown';

export type PricingBasis = 'fixed' | 'per_pax' | 'per_hour';

export type StoreDiscount = {
  type: string; // vendor_service_discounts.discount_type
  rate: number;
  unit: 'pct' | 'php';
};

export type StoreService = {
  serviceId: string;
  category: string;
  title: string | null;
  startingPricePhp: number | null;
  pricingBasis: PricingBasis;
  perPaxPricePhp: number | null;
  minPax: number | null;
  basePax: number | null;
  hourBasePhp: number | null;
  minHours: number | null;
  extraHourPhp: number | null;
  addedPaxPricePhp: number | null;
  crewSize: number | null;
  crewMealIncluded: boolean;
  transportIncluded: boolean;
  transportFlatFeePhp: number | null;
  recommendedLeadTimeMonths: number | null;
  lastMinuteEndMonths: number | null;
  lastMinuteSurchargePct: number | null;
  dailyCapacity: number | null;
  inclusions: ReadonlyArray<{ label: string; worthPhp: number | null }>;
  discounts: ReadonlyArray<StoreDiscount>; // adapter passes only currently-active ones
  addons: ReadonlyArray<{ label: string; fromPricePhp: number | null }>;
};

export type StorePackage = {
  packageId: string;
  name: string;
  description: string | null;
  totalPriceCentavos: number; // packages store centavos (services store PHP)
  items: ReadonlyArray<{ description: string; included: boolean }>;
};

export type StoreCoverage = {
  canonicalService: string;
  eventTypes: ReadonlyArray<string>;
  faiths: ReadonlyArray<string>;
  label?: string | null; // human label if the adapter resolved one
};

export type StoreReviewPreview = {
  ratingOverall: number;
  body: string | null;
  createdAt: string;
};

export type VendorStoreSnapshot = {
  businessName: string;
  services: ReadonlyArray<StoreService>;
  packages: ReadonlyArray<StorePackage>;
  coverages: ReadonlyArray<StoreCoverage>;
  reviews: ReadonlyArray<StoreReviewPreview>;
  avgRating: number | null;
  reviewCount: number | null;
};

// The inquiring couple's own event (subset of buildEventBrief output) — scoped
// per thread; never a standing store of couples (§2A / §7C).
export type EventBriefLite = {
  primaryDate: string | null; // ISO date (YYYY-MM-DD)
  candidateDates: ReadonlyArray<string>;
  pax: number | null;
  budgetPerHeadPhp: number | null;
  region: string | null;
};

// Runtime signals the pure engine can't derive from the store — the Phase-3
// adapter computes these (e.g. availability from the calendar / daily_capacity).
// CONTRACT: dateAvailable MUST be keyed to event.primaryDate — the exact date
// the availability reply prints. The adapter must not pass a truthy value when
// the couple asked about a different candidate date; route to handoff instead.
export type EngineSignals = {
  dateAvailable?: boolean | null;
};

export type EngineInput = {
  inquiryText: string;
  store: VendorStoreSnapshot;
  event?: EventBriefLite | null;
  signals?: EngineSignals | null;
};

export type EngineAction = 'reply' | 'clarify' | 'handoff';

export type EngineDecision = {
  action: EngineAction;
  intent: Intent;
  confidence: number; // 0..1
  replyText: string | null; // present for 'reply' / 'clarify'; null for 'handoff'
  handoffReason?: string; // why it routed to a human (surfaced on the inbox flag)
};
