import type { SupabaseClient } from '@supabase/supabase-js';

export type VendorCategory =
  | 'venue'
  | 'religious_venue'
  | 'catering'
  | 'photographer'
  | 'videographer'
  | 'florist'
  | 'cake_maker'
  | 'host_emcee'
  | 'band_dj'
  | 'string_quartet'
  | 'choir'
  | 'officiant'
  | 'planner_coordinator'
  | 'makeup_artist'
  | 'hair_stylist'
  | 'gown_designer'
  | 'suit_designer'
  | 'rings'
  | 'invitations_stationery'
  | 'transportation'
  | 'lights_and_sound'
  | 'led_screens'
  | 'photobooth'
  | 'mobile_bar'
  | 'church_fees'
  | 'reception_decor'
  | 'security'
  | 'gifts_and_giveaways'
  | 'accommodation'
  | 'misc';

export type VendorStatus =
  | 'considering'
  | 'shortlisted'
  | 'contracted'
  | 'deposit_paid'
  | 'delivered'
  | 'complete';

export const VENDOR_CATEGORIES: ReadonlyArray<VendorCategory> = [
  'venue',
  'religious_venue',
  'catering',
  'photographer',
  'videographer',
  'florist',
  'cake_maker',
  'host_emcee',
  'band_dj',
  'string_quartet',
  'choir',
  'officiant',
  'planner_coordinator',
  'makeup_artist',
  'hair_stylist',
  'gown_designer',
  'suit_designer',
  'rings',
  'invitations_stationery',
  'transportation',
  'lights_and_sound',
  'led_screens',
  'photobooth',
  'mobile_bar',
  'church_fees',
  'reception_decor',
  'security',
  'gifts_and_giveaways',
  'accommodation',
  'misc',
];

export const VENDOR_CATEGORY_LABEL: Record<VendorCategory, string> = {
  venue: 'Venue',
  religious_venue: 'Religious Ceremony Venue',
  catering: 'Catering',
  photographer: 'Photographer',
  videographer: 'Videographer',
  florist: 'Florist',
  cake_maker: 'Cake maker',
  host_emcee: 'Host / Emcee',
  band_dj: 'Band / DJ',
  string_quartet: 'String quartet',
  choir: 'Choir',
  officiant: 'Officiant',
  planner_coordinator: 'Planner / Coordinator',
  makeup_artist: 'Makeup artist',
  hair_stylist: 'Hair stylist',
  gown_designer: 'Gown designer',
  suit_designer: 'Suit designer',
  rings: 'Rings',
  invitations_stationery: 'Invitations & stationery',
  transportation: 'Transportation',
  lights_and_sound: 'Lights & sound',
  led_screens: 'LED screens',
  photobooth: 'Photobooth',
  mobile_bar: 'Mobile bar',
  church_fees: 'Church fees',
  reception_decor: 'Reception decor',
  security: 'Security',
  gifts_and_giveaways: 'Gifts & giveaways',
  accommodation: 'Accommodation',
  misc: 'Miscellaneous',
};

export const VENDOR_STATUSES: ReadonlyArray<VendorStatus> = [
  'considering',
  'shortlisted',
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
];

export const VENDOR_STATUS_LABEL: Record<VendorStatus, string> = {
  considering: 'Considering',
  shortlisted: 'Shortlisted',
  contracted: 'Contracted',
  deposit_paid: 'Deposit paid',
  delivered: 'Delivered',
  complete: 'Complete',
};

export const VENDOR_STATUS_TONE: Record<VendorStatus, string> = {
  considering: 'bg-ink/5 text-ink/70',
  shortlisted: 'bg-amber-100 text-amber-900',
  contracted: 'bg-sky-100 text-sky-800',
  deposit_paid: 'bg-violet-100 text-violet-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  complete: 'bg-emerald-200 text-emerald-900',
};

export type EventVendorRow = {
  vendor_id: string;
  public_id: string;
  event_id: string;
  category: VendorCategory;
  vendor_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  status: VendorStatus;
  total_cost_php: number | null;
  // 3-line cost (CLAUDE.md 2026-05-31): couple-facing total = total_cost_php
  // (Service) + transport_php (Transport) + food_allowance_php (Food). Both
  // nullable → treated as ₱0 until the couple enters them in the workspace.
  transport_php: number | null;
  food_allowance_php: number | null;
  deposit_paid_php: number | null;
  notes: string | null;
  created_at: string;
  /**
   * FK to vendor_profiles. NULL = off-platform (couple-encoded only).
   * Populated atomically when a couple-invite is claimed or a Connect
   * happens; the same transaction also inserts a vendor_follows row
   * per 0019 § Booking-implies-follow auto-insert.
   */
  marketplace_vendor_id: string | null;
  /**
   * FK to event_vendor_packages (migration 20260604110000_vendor_packages.sql).
   * Populated by the cascade-lock flow when a host locks a vendor's
   * bundled package. NULL on normal (non-package) event_vendors rows.
   * Optional — surfaced as undefined by clients that don't SELECT it.
   */
  event_vendor_package_id?: string | null;
};

export async function fetchEventVendors(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventVendorRow[]> {
  const { data, error } = await supabase
    .from('event_vendors')
    .select(
      'vendor_id,public_id,event_id,category,vendor_name,contact_email,contact_phone,status,total_cost_php,transport_php,food_allowance_php,deposit_paid_php,notes,created_at,marketplace_vendor_id',
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`fetchEventVendors failed: ${error.message}`);
  return (data ?? []) as EventVendorRow[];
}

export function computeVendorStats(vendors: EventVendorRow[]) {
  let totalCost = 0;
  let depositPaid = 0;
  const byStatus: Partial<Record<VendorStatus, number>> = {};
  for (const v of vendors) {
    totalCost += Number(v.total_cost_php ?? 0);
    depositPaid += Number(v.deposit_paid_php ?? 0);
    byStatus[v.status] = (byStatus[v.status] ?? 0) + 1;
  }
  return {
    count: vendors.length,
    totalCost,
    depositPaid,
    remaining: Math.max(0, totalCost - depositPaid),
    byStatus,
  };
}

export function formatPhp(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `₱${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Display-layer grouping of the 28 canonical categories into 6 phases of a
 * wedding. Used by the vendor-profile services checklist and the couple-side
 * "Add a vendor" dropdown so the long flat list reads in sensible chunks.
 *
 * Not in the DB — purely presentational. If grouping ever needs to drive
 * queries (e.g. filtering, analytics), promote to a `service_group` column.
 */
export type ServiceGroupKey =
  | 'reception'
  | 'ceremony'
  | 'attire'
  | 'media'
  | 'logistics'
  | 'other';

export const SERVICE_GROUPS: ReadonlyArray<{
  key: ServiceGroupKey;
  label: string;
  members: ReadonlyArray<VendorCategory>;
}> = [
  {
    key: 'reception',
    label: 'Reception',
    members: ['venue', 'catering', 'cake_maker', 'mobile_bar', 'reception_decor'],
  },
  {
    key: 'ceremony',
    label: 'Ceremony',
    members: ['religious_venue', 'officiant', 'church_fees', 'choir', 'string_quartet'],
  },
  {
    key: 'attire',
    label: 'Couple & attire',
    members: ['gown_designer', 'suit_designer', 'makeup_artist', 'hair_stylist', 'rings'],
  },
  {
    key: 'media',
    label: 'Media & entertainment',
    members: [
      'photographer',
      'videographer',
      'photobooth',
      'band_dj',
      'host_emcee',
      'lights_and_sound',
      'led_screens',
    ],
  },
  {
    key: 'logistics',
    label: 'Logistics',
    members: [
      'transportation',
      'security',
      'florist',
      'invitations_stationery',
      'planner_coordinator',
      'accommodation',
    ],
  },
  {
    key: 'other',
    label: 'Other',
    members: ['gifts_and_giveaways', 'misc'],
  },
];

const CATEGORY_TO_GROUP: Record<VendorCategory, ServiceGroupKey> = (() => {
  const m = {} as Record<VendorCategory, ServiceGroupKey>;
  for (const g of SERVICE_GROUPS) {
    for (const member of g.members) {
      m[member] = g.key;
    }
  }
  return m;
})();

export function serviceGroupOf(category: VendorCategory): ServiceGroupKey {
  return CATEGORY_TO_GROUP[category];
}

const CATEGORY_SET: ReadonlySet<string> = new Set(VENDOR_CATEGORIES);

/**
 * Vendor profiles store services as `text[]` where canonical entries use the
 * enum key (e.g. "photographer") and custom entries store the raw label
 * (e.g. "Vintage car rental"). This resolves either to a human-readable
 * label so display sites don't have to branch.
 */
export function displayServiceLabel(service: string): string {
  if (CATEGORY_SET.has(service)) {
    return VENDOR_CATEGORY_LABEL[service as VendorCategory];
  }
  return service;
}

export function isCanonicalService(service: string): boolean {
  return CATEGORY_SET.has(service);
}

/**
 * Hybrid-anonymity display name resolver — V2.1 brief amendment #2
 * (locked 2026-05-30 per CLAUDE.md "🔒 V2.1 BRIEF AMENDMENT #2 LOCKED"
 * row § 1(d) + § 7(f), and the canonical
 * `[[project_setnayan_vendor_hybrid_anonymity]]` memory rule).
 *
 * Rule (verbatim from canonical sources):
 *   - Free + Verified vendors: business name HIDDEN in marketplace
 *     cards + microsite + browse + wizard vendor-pick cards UNTIL they
 *     send their FIRST chat reply to any customer.
 *   - On first reply, `vendor_profiles.name_revealed_at` stamps with
 *     NOW() (DB trigger `reveal_vendor_name_on_chat` shipped in PR
 *     #662 / migration 20260530010000) and the name reveals GLOBALLY
 *     — for ALL customers, ALL browse, ALL future threads, ALL
 *     surfaces. NOT per-customer. NOT per-thread.
 *   - Pro + Enterprise vendors: full name visibility from day 1. The
 *     hybrid mechanic does NOT apply to them.
 *   - Once revealed, name cannot be re-hidden (vendor downgrade Pro
 *     → Free does NOT re-anonymize · once public, stays public).
 *
 * Placeholder format (verbatim from memory rule):
 *   - `<taxonomy label>` when no `location_city` is set.
 *   - `<taxonomy label> · <city>` when city present.
 *   - Taxonomy label resolves from the vendor's primary canonical
 *     service via `displayServiceLabel`. Falls back to a generic
 *     "Wedding Vendor" string when no primary service is available
 *     (extremely rare — only profiles with `services = []` hit this).
 *
 * NOT real `business_name`. NOT a generic "Verified Vendor" label.
 * NOT a Bark-style numeric ID (CLAUDE.md tenth 2026-05-28 row
 * explicitly retired the lead-broker `<taxonomy> #<id>` framing).
 *
 * Derivation contract (per migration header pragmatic note in
 * 20260530010000):
 *   - The canonical reveal trigger fires UNCONDITIONALLY on first
 *     vendor reply (gated only by `name_revealed_at IS NULL`) because
 *     the `tier_state` column the brief named was never shipped — the
 *     7th 2026-05-28 row lead-broker pivot introduced the design but
 *     the tenth 2026-05-28 row v2.1 brief lock retired it.
 *   - This helper therefore takes an explicit `isPaidTier` flag the
 *     caller derives from whatever subscription source it has
 *     available (Pro/Enterprise subscription state in app-layer · the
 *     marketplace surfaces have no subscription join today so they
 *     pass `false`; the canonical hybrid contract still holds because
 *     the placeholder only renders while `name_revealed_at IS NULL`
 *     AND `isPaidTier === false`).
 *
 * Cross-references:
 *   - CLAUDE.md 2026-05-30 row · canonical spec.
 *   - project_setnayan_vendor_hybrid_anonymity memory rule.
 *   - Iteration 0006 Vendors Management (canonical column home).
 *   - Iteration 0019 Communications (DB trigger lives on
 *     chat_messages INSERT · vendor sender_role gate).
 *   - Iteration 0022 Vendor Dashboard (vendor-side banner explaining
 *     the mechanic + Open chat inbox CTA).
 */
export type VendorAnonymityInput = {
  /**
   * Real business_name from vendor_profiles. Surfaced when the name
   * is revealed; replaced by the taxonomy + city placeholder while
   * hidden.
   */
  business_name: string | null;
  /**
   * Timestamp stamped by `reveal_vendor_name_on_chat` trigger on
   * first vendor chat reply. NULL = name hidden (Free + Verified
   * pre-first-reply). Non-NULL = name revealed globally.
   */
  name_revealed_at: string | null;
  /**
   * TRUE when vendor's subscription tier is Pro or Enterprise — these
   * tiers retain full name visibility from day 1 per the canonical
   * rule. FALSE for Free + Verified (the hybrid-anonymity mechanic
   * applies). Defaults to FALSE if the caller has no subscription
   * data to source from; the placeholder still renders the safe
   * value when name_revealed_at is also NULL.
   */
  isPaidTier?: boolean;
  /**
   * vendor.services[0] — the primary canonical_service used to derive
   * the taxonomy half of the placeholder. NULL when the vendor has no
   * services on file (falls through to a generic 'Wedding Vendor'
   * label so the placeholder still reads as a real category).
   */
  primary_canonical_service: string | null;
  /**
   * vendor_profiles.location_city — appended after the taxonomy
   * label when present, separated by " · ". When NULL, only the
   * taxonomy label renders.
   */
  location_city: string | null;
  /**
   * vendor_profiles.services full array. Used to apply the **venue
   * exception** per CLAUDE.md 2026-05-30 refinement row: Ceremony +
   * Reception Venues (services overlap with ['religious_venue',
   * 'venue']) ALWAYS show real business_name regardless of tier or
   * reveal timestamp. Physical-place + GMB-listed venues anonymizing
   * breaks search + makes admin-seeded famous venues (Conrad · Shangri-
   * La · Cebu Marriott · etc. from migration `20260529000000`)
   * pointless. NULL or omitted = no venue check (legacy callers).
   */
  services?: ReadonlyArray<string> | null;
  /**
   * vendor_profiles.screen_name — Bark-format stored anonymized name
   * per CLAUDE.md 2026-05-30 refinement row (e.g. "Manila Wedding
   * Photographer #4218"). Generated at signup by
   * `generate_screen_name_for_vendor()` function (migration
   * `20260714000000`) + persists forever once stamped. When present,
   * surfaces use this instead of the legacy computed taxonomy-and-city
   * placeholder, giving a stable identifier with monotonic ID per
   * (city, canonical_service) namespace. NULL or omitted = fall through
   * to the legacy computed placeholder for backward compat with
   * vendors that pre-date the screen_name backfill OR have empty
   * services arrays.
   */
  screen_name?: string | null;
};

/**
 * Venue canonical_services that ALWAYS show real business_name regardless
 * of tier or reveal timestamp. Per CLAUDE.md 2026-05-30 refinement row
 * "the only vendors that will have no screen names are the Ceremony and
 * Reception Venues. We will let them keep their names." Reasoning:
 * physical-place + GMB-listed venues anonymizing breaks search · couples
 * search "Manila Cathedral" or "Conrad Manila" by name · admin-seeded
 * famous venues from migration `20260529000000_venue_directory_seed.sql`
 * (Cebu Marriott · Shangri-La · Solaire · Sofitel · etc.) are pointless
 * to surface as anonymized taxonomy stubs. Multi-service vendors with
 * venue + catering bundle stay venue (real name) since the venue role
 * is canonical.
 */
const VENUE_EXEMPT_SERVICES: ReadonlyArray<string> = ['religious_venue', 'venue'];

/**
 * TRUE when vendor's services array overlaps with the venue exemption
 * list. Internal helper for `isVendorNameRevealed` — exposed as a
 * standalone export so callers can branch on the exception independently
 * (e.g., admin moderation UIs that want to highlight venue rows).
 */
export function isVendorVenueExempt(
  services: ReadonlyArray<string> | null | undefined,
): boolean {
  if (!services || services.length === 0) return false;
  for (const s of services) {
    if (VENUE_EXEMPT_SERVICES.includes(s)) return true;
  }
  return false;
}

/**
 * Derived value: TRUE when the vendor's name should render
 * unredacted across all surfaces. FALSE when surfaces should render
 * the anonymized placeholder (taxonomy + city OR stored screen_name).
 *
 * Single source of truth so /v/[slug], /vendors, the wizard grid
 * card, and the vendor-dashboard banner all branch identically.
 *
 * Order of checks (any one wins):
 *   1. Venue exception — services overlap with religious_venue / venue
 *      (per CLAUDE.md 2026-05-30 refinement row).
 *   2. Paid tier flag — Pro / Enterprise day-1 reveal.
 *   3. Reveal timestamp — first vendor chat reply stamped name_revealed_at.
 */
export function isVendorNameRevealed(
  input: Pick<VendorAnonymityInput, 'name_revealed_at' | 'isPaidTier' | 'services'>,
): boolean {
  if (isVendorVenueExempt(input.services)) return true;
  if (input.isPaidTier) return true;
  return input.name_revealed_at !== null;
}

/**
 * Resolves the display name surfaces should render for a vendor at
 * this moment in time. Returns the real `business_name` when the
 * hybrid-anonymity gate allows it, OR a taxonomy + city placeholder
 * while the name is hidden.
 *
 * Surfaces call this helper instead of reading `vendor.business_name`
 * directly so the hybrid mechanic stays DRY across the marketplace
 * card · the vendor microsite hero + JSON-LD name field · the wizard
 * vendor-pick grid card · and any future surface that joins through
 * vendor_profiles.
 *
 * The empty-string `business_name` fallback ('Vendor') matches the
 * legacy fallback the VendorCard hero used pre-2026-05-30; we keep
 * the literal so this swap is a zero-behavior-change refactor on the
 * already-revealed path.
 */
export function resolveVendorDisplayName(input: VendorAnonymityInput): string {
  if (isVendorNameRevealed(input)) {
    return input.business_name && input.business_name.length > 0
      ? input.business_name
      : 'Vendor';
  }
  // Prefer the stored screen_name (Bark format with monotonic ID per
  // (city, canonical_service) namespace per CLAUDE.md 2026-05-30
  // refinement row · e.g., "Manila Wedding Photographer #4218") when
  // available. Migration `20260714000000` generates this at signup +
  // backfills existing Free/Verified non-venue rows. Falls through to
  // the legacy taxonomy-and-city computed placeholder for null or empty
  // screen_name (pre-backfill rows OR vendors signed up before the
  // migration shipped).
  if (input.screen_name && input.screen_name.length > 0) {
    return input.screen_name;
  }
  const taxonomyLabel = input.primary_canonical_service
    ? displayServiceLabel(input.primary_canonical_service)
    : 'Wedding Vendor';
  return input.location_city
    ? `${taxonomyLabel} · ${input.location_city}`
    : taxonomyLabel;
}
