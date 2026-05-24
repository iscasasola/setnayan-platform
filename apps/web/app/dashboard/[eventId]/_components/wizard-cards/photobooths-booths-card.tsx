/**
 * Card 14 Photobooths + Booths · WAVE 2 · multi-pick variant.
 *
 * Owner-locked behavior (CLAUDE.md 2026-05-23 Sixth row + 2026-05-25
 * eleventh row): unlike every other vendor-pick card (Cards 02-13, 18-19,
 * 22-24) which auto-advance the wizard the moment the host locks a vendor,
 * Card 14 stays put. PH cocktail-hour culture mixes 2-4 booth types in a
 * single reception — a wizard that closed after the first lock would
 * force the host to re-open Card 14 several times to add each additional
 * booth, breaking the inline-completion contract.
 *
 * 2026-05-25 (this commit) · owner directive "booths are not showing all
 * booths" — the prior fetch only surfaced `photobooth` + `mobile_bar`
 * canonicals. The Stations & Booths taxonomy (Vendor_Taxonomy_V1_Master.md
 * § Column 3 + § Column 11) has ~30 sub-types across food/beverage,
 * capture, wellness, mystic, and arcade groups. This commit expands the
 * fetch to cover every V1-active booth canonical AND groups results by
 * the actual matched `canonical_service` so the host sees a labeled
 * section per sub-type (Photobooths · Cocktail bars · Coffee stations ·
 * Perfume bars · Sorbetes carts · etc.) rather than two coarse buckets.
 *
 * The event_vendors.category enum stays a 2-value lock (photobooth /
 * mobile_bar) — the canonical sub-type is snapshotted into
 * event_vendors.notes at lock time (BOOTH_SUBTYPE:<canonical>) so the
 * compare drawer + future analytics can read finer grain without a
 * schema migration. See lockBoothToEvent in wizard-actions.ts for the
 * snapshot format.
 *
 * Server component shell · fetches the wide booth canonical_services set
 * in a single query and renders the multi-pick client UI. The single-pick
 * VendorPickCard primitive doesn't apply here because:
 *   1. Locks need to STAY on Card 14 (no auto-advance) → calls lockBoothToEvent
 *      instead of completeVendorPickFromMarketplace.
 *   2. Multiple canonical sub-types coexist on this card → vendor list
 *      groups by sub-type rather than the single-flat "top 5 of one
 *      category" pattern.
 *   3. A live "you've locked N booths" summary needs to render above the
 *      [I have all the booths I need] CTA — single-pick cards don't ship
 *      this footer.
 *
 * Entry point: the WizardHero dispatcher (wizard-hero.tsx) renders this
 * component when resolveWizardFocus returns task.id === 'photobooths_booths'.
 * No other surface mounts this component.
 *
 * 2026-05-24 senior-planner pass: server-side PRE-FILTER recs to within
 * 10 km of the reception venue. Per CLAUDE.md 2026-05-24 sixth-row "Vendor
 * presentation pattern" spec lock, booths are Pattern B "anchored to
 * reception" — vans transport heavy equipment for setup onsite. NULL-safe:
 * vendors with no hq lat/lng are kept (treated as "unknown, don't hide"
 * per the established compat-array convention).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { fetchWizardVendorRecommendations } from '@/lib/wizard-recommendations';
import { fetchReceptionLatLng } from './_reception-lat-lng';
import { haversineKm } from '@/lib/geo';
import type { WizardVendorRec } from '@/lib/wizard-recommendations';
import type { CeremonyType } from '@/lib/auspicious-date';
import {
  PhotoboothsBoothsCardClient,
  type BoothCategory,
  type BoothSubtypeGroup,
} from './photobooths-booths-card-client';

type Props = {
  eventId: string;
  ceremonyType: CeremonyType | null;
  venueSetting: string | null;
  excludeMarketplaceIds: ReadonlyArray<string>;
};

const PHOTOBOOTH_RADIUS_KM = 10;

/**
 * Full V1 booth/station canonical_services list — sourced from
 * `apps/web/lib/taxonomy.ts` rows tagged folder='booths_stations' AND
 * the folder='catering' rows that are booth-shaped (mobile_bar,
 * coffee_booth, perfume_bar via booths_stations folder, etc.).
 *
 * Ordering inside this array sets the DISPLAY ORDER of the per-sub-type
 * sections in the card · most-common Filipino-reception booths first
 * (mobile_bar + photo_booth + coffee_booth), then the long tail of
 * specialty bars + food stations + capture variants + wellness/mystic +
 * arcade. The client component renders sections in this order; sub-types
 * with zero vendors today get hidden so the card stays tight.
 */
const BOOTH_CANONICALS: ReadonlyArray<string> = [
  // Big three — present in 80%+ of PH receptions
  'mobile_bar',
  'photo_booth',
  'coffee_booth',
  // Cocktail-hour bar variants
  'mocktail_bar',
  'tea_bar',
  'whiskey_cigar_bar',
  'mocktail_booth_mini',
  // Capture variants
  'gif_booth',
  'polaroid_booth',
  'booth_360',
  'selfie_magic_mirror',
  'vr_ar_station',
  // Food stations + carts
  'live_cooking_station',
  'mini_lechon_station',
  'halo_halo_station',
  'ice_cream_cart',
  'sorbetes_cart',
  'crepe_pancake_station',
  'dessert_station',
  'cotton_candy_cart',
  'donut_wall_display',
  'food_cart_generic',
  // Wellness / scent / beauty
  'perfume_bar',
  'henna_tattoo_booth',
  'massage_chair_station',
  'mini_nail_bar',
  'hair_touchup_station',
  'aromatherapy_station',
  // Mystic
  'tarot_astrology',
  'palmistry_reader',
  // Setnayan first-party
  'setnayan_patiktok',
  // Arcade
  'arcade_retro_games',
];

/**
 * Display labels for the per-sub-type section headers · grouped from
 * Vendor_Taxonomy_V1_Master.md § Column 3 + § Column 11. Falls back to
 * a sentence-cased version of the canonical key when not listed (defensive
 * against future canonical additions).
 */
const BOOTH_SUBTYPE_LABEL: Record<string, string> = {
  mobile_bar: 'Cocktail bars',
  photo_booth: 'Photobooths',
  coffee_booth: 'Coffee stations',
  mocktail_bar: 'Mocktail bars',
  tea_bar: 'Tea bars',
  whiskey_cigar_bar: 'Whiskey & cigar bars',
  mocktail_booth_mini: 'Mini mocktail booths',
  gif_booth: 'GIF booths',
  polaroid_booth: 'Polaroid booths',
  booth_360: '360° booths',
  selfie_magic_mirror: 'Magic-mirror selfie booths',
  vr_ar_station: 'VR / AR stations',
  live_cooking_station: 'Live cooking stations',
  mini_lechon_station: 'Mini lechon stations',
  halo_halo_station: 'Halo-halo stations',
  ice_cream_cart: 'Ice-cream carts',
  sorbetes_cart: 'Sorbetes carts',
  crepe_pancake_station: 'Crepe / pancake stations',
  dessert_station: 'Dessert stations',
  cotton_candy_cart: 'Cotton-candy carts',
  donut_wall_display: 'Donut walls',
  food_cart_generic: 'Food carts',
  perfume_bar: 'Perfume bars',
  henna_tattoo_booth: 'Henna / tattoo booths',
  massage_chair_station: 'Massage-chair stations',
  mini_nail_bar: 'Mini nail bars',
  hair_touchup_station: 'Hair-touchup stations',
  aromatherapy_station: 'Aromatherapy stations',
  tarot_astrology: 'Tarot & astrology booths',
  palmistry_reader: 'Palmistry readers',
  setnayan_patiktok: 'Patiktok booths',
  arcade_retro_games: 'Arcade / retro-game booths',
};

/**
 * Canonical → coarse event_vendors.category enum value. Booths card
 * snapshots the fine-grain canonical into event_vendors.notes (see
 * lockBoothToEvent) but the category enum stays 2-valued for V1.
 *
 * Rule of thumb: food/beverage consumables map to `mobile_bar`; every
 * other booth (capture · wellness · mystic · arcade · Setnayan first-
 * party) maps to `photobooth`. The mapping is a compatibility shim ·
 * future iteration can widen the enum.
 */
export function boothCanonicalToCategory(canonical: string): BoothCategory {
  const consumables = new Set([
    'mobile_bar',
    'coffee_booth',
    'mocktail_bar',
    'tea_bar',
    'whiskey_cigar_bar',
    'mocktail_booth_mini',
    'live_cooking_station',
    'mini_lechon_station',
    'halo_halo_station',
    'ice_cream_cart',
    'sorbetes_cart',
    'crepe_pancake_station',
    'dessert_station',
    'cotton_candy_cart',
    'donut_wall_display',
    'food_cart_generic',
  ]);
  return consumables.has(canonical) ? 'mobile_bar' : 'photobooth';
}

/**
 * NULL-safe distance filter — vendors with no hq lat/lng are kept
 * (no data ≠ far away). When the host hasn't locked a reception venue
 * yet (no reception lat/lng), filter is a no-op (everyone passes).
 */
function filterWithinRadius(
  recs: ReadonlyArray<WizardVendorRec>,
  receptionLat: number | null,
  receptionLng: number | null,
  radiusKm: number,
): WizardVendorRec[] {
  if (receptionLat == null || receptionLng == null) return [...recs];
  return recs.filter((r) => {
    if (r.hq_latitude == null || r.hq_longitude == null) return true;
    const km = haversineKm(
      receptionLat,
      receptionLng,
      r.hq_latitude,
      r.hq_longitude,
    );
    return km <= radiusKm;
  });
}

/**
 * Render-ready booth subtype label · sentence-cased fallback for
 * canonicals not in BOOTH_SUBTYPE_LABEL (defensive against taxonomy
 * additions landing in DB before this map is updated).
 */
export function readableBoothSubtype(canonical: string): string {
  const mapped = BOOTH_SUBTYPE_LABEL[canonical];
  if (mapped) return mapped;
  return canonical
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function PhotoboothsBoothsCard({
  eventId,
  ceremonyType,
  venueSetting,
  excludeMarketplaceIds,
}: Props) {
  const admin = createAdminClient();
  const { receptionLat, receptionLng } = await fetchReceptionLatLng(
    admin,
    eventId,
  );

  // Single wide fetch · the recommendation helper accepts an array of
  // canonical_services and matches any-of via the existing overlap
  // semantics. Limit pushed to 200 because we partition into ~30 sub-
  // type sections; each section caps to its own top-10 client-side.
  // Distance filter applied next pass.
  const recsRaw = await fetchWizardVendorRecommendations(admin, {
    canonicalServices: BOOTH_CANONICALS,
    ceremonyType,
    venueSetting,
    excludeVendorIds: excludeMarketplaceIds,
    limit: 200,
  });

  const recsWithin = filterWithinRadius(
    recsRaw,
    receptionLat,
    receptionLng,
    PHOTOBOOTH_RADIUS_KM,
  );

  // Match each vendor back to its booth canonical sub-types. The base
  // fetcher loses the per-row matched canonical when it returns
  // WizardVendorRec[] · we re-query vendor_services in a single batched
  // IN-lookup so we know which sub-type each vendor surfaces under. A
  // single vendor can offer multiple sub-types (e.g. cocktail bar + coffee
  // station) — they appear in each matching section.
  const vendorIds = recsWithin.map((r) => r.vendor_profile_id);
  type ServiceRow = {
    vendor_profile_id: string;
    canonical_service: string | null;
    is_active: boolean | null;
  };
  let serviceRows: ServiceRow[] = [];
  if (vendorIds.length > 0) {
    const { data: sRows } = await admin
      .from('vendor_services')
      .select('vendor_profile_id, canonical_service, is_active')
      .in('vendor_profile_id', vendorIds)
      .in('canonical_service', BOOTH_CANONICALS as readonly string[]);
    serviceRows = ((sRows ?? []) as ServiceRow[]).filter(
      (r) => r.is_active !== false && r.canonical_service !== null,
    );
  }

  // Build canonical → Set<vendor_profile_id> for fast membership tests
  // when grouping. We bucket once into a per-canonical array of WizardVendorRec.
  const vendorById = new Map<string, WizardVendorRec>();
  for (const rec of recsWithin) vendorById.set(rec.vendor_profile_id, rec);

  const recsByCanonical = new Map<string, WizardVendorRec[]>();
  for (const sr of serviceRows) {
    const canonical = sr.canonical_service;
    if (!canonical) continue;
    const vendor = vendorById.get(sr.vendor_profile_id);
    if (!vendor) continue;
    const bucket = recsByCanonical.get(canonical) ?? [];
    if (!bucket.some((v) => v.vendor_profile_id === vendor.vendor_profile_id)) {
      bucket.push(vendor);
    }
    recsByCanonical.set(canonical, bucket);
  }

  // Build the ordered per-sub-type groups. We honor BOOTH_CANONICALS' order
  // so the most common sub-types appear first. Sections with zero vendors
  // get hidden client-side (we still pass them with empty arrays so the
  // custom-booth form's category picker can offer every sub-type).
  const groups: BoothSubtypeGroup[] = BOOTH_CANONICALS.map((canonical) => ({
    canonical,
    label: readableBoothSubtype(canonical),
    category: boothCanonicalToCategory(canonical),
    recs: (recsByCanonical.get(canonical) ?? []).slice(0, 10),
  }));

  // Already-locked booths for this event — surfaces in the picked-list
  // section above the CTA. RLS gates so a stranger can't fetch other
  // hosts' picks. We use the user-context client (createClient) for the
  // RLS path; createAdminClient is only used for the recs fetch (public
  // marketplace data).
  //
  // 2026-05-25 · we now SELECT `notes` so we can extract the
  // BOOTH_SUBTYPE:<canonical> snapshot for finer-grain picked-list
  // grouping. The notes column is free-text — we tolerate missing /
  // unparseable values and fall back to the coarse category enum.
  const supabase = await createClient();
  const { data: pickedRaw } = await supabase
    .from('event_vendors')
    .select(
      'vendor_id, vendor_name, category, marketplace_vendor_id, notes, created_at',
    )
    .eq('event_id', eventId)
    .in('category', ['photobooth', 'mobile_bar'])
    .order('created_at', { ascending: true });

  const picked = (pickedRaw ?? []).map((row) => {
    const r = row as {
      vendor_id: string;
      vendor_name: string;
      category: 'photobooth' | 'mobile_bar';
      marketplace_vendor_id?: string | null;
      notes?: string | null;
    };
    return {
      vendor_id: r.vendor_id,
      vendor_name: r.vendor_name,
      category: r.category,
      marketplace_vendor_id: r.marketplace_vendor_id ?? null,
      booth_subtype: extractBoothSubtypeFromNotes(r.notes ?? null),
    };
  });

  return (
    <PhotoboothsBoothsCardClient
      eventId={eventId}
      subtypeGroups={groups}
      pickedBooths={picked}
    />
  );
}

/**
 * Extracts the canonical sub-type token from a free-text `notes` string
 * formatted by lockBoothToEvent as `BOOTH_SUBTYPE:<canonical>` (possibly
 * followed by other notes joined with " · "). Returns null when no token
 * is present so the picked-list grouping falls back to coarse category.
 */
function extractBoothSubtypeFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/BOOTH_SUBTYPE:([a-z0-9_]+)/i);
  return match && match[1] ? match[1].toLowerCase() : null;
}

export { BOOTH_CANONICALS };
