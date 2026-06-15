'use server';

/**
 * searchCategoryVendors — backend for the in-place Category Search overlay
 * (the full-page sheet that replaces the marketplace JUMP from the Vendors
 * tab + event-Home vendor buttons). Results are HARD-SCOPED to one plan
 * group's canonical services so the couple can never drift to another
 * category.
 *
 * Result order (owner-locked 2026-05-31):
 *   1. Favorites          — cross-event personal favorites (V1.x; no backing
 *                           table yet, so this tier is empty for now and the
 *                           list starts at Boosted — graceful).
 *   2. Boosted services   — vendors with an active ad (ad_rank > 0), in
 *                           ad_rank order.
 *   3. Top 10 reviews     — of the rest, the 10 highest by review_count then
 *                           avg rating.
 *   4. The rest           — ordered by distance from the reception venue →
 *                           ceremony venue → target location → wherever the
 *                           couple is (we use the event's stored coords; when
 *                           there are none we keep the review order).
 *
 * Reuses the canonical per-category ranked query (fetchWizardVendorRecommendations)
 * + hybrid-anonymity name resolution (resolveVendorDisplayName) so a Free /
 * Verified vendor's real name stays hidden until first reply.
 */

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEMO_MODE_COOKIE_NAME, isAdminProfile } from '@/lib/demo-mode';
import { fetchDemoVendorIds } from '@/lib/demo-vendors';
import { resolveVendorDisplayName, isVendorNameRevealed } from '@/lib/vendors';
import { isTrueNameTier, tierCaps, asVendorTier } from '@/lib/vendor-tier-caps';
import { fetchWizardVendorRecommendations } from '@/lib/wizard-recommendations';
import { getTaxonomy } from '@/lib/taxonomy-db';
import {
  buildCoupleFaithSet,
  passesEventTypeFilter,
  passesFaithFilter,
} from '@/lib/taxonomy-filters';
import { computeCompatScore } from '@/lib/compat-score';
import { isSetnayanAiActive } from '@/lib/setnayan-ai';
import {
  monthsToWedding,
  lastMinuteZone,
  isLastMinuteSearchable,
  categoryEmptyForGenericSearch,
  type LastMinuteZone,
} from '@/lib/last-minute';
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import {
  canonicalServicesForTile,
  canonicalServicesForFolder,
} from '@/lib/vendor-counts';

export type CategoryVendorResult = {
  vendorProfileId: string;
  name: string;
  /** TRUE when `name` is still the hybrid-anonymity placeholder (Free /
   *  Verified vendor that hasn't replied yet — name_revealed_at IS NULL,
   *  not venue-exempt, not paid-tier). The overlay surfaces a "Real name
   *  shown after they reply" subline so couples don't read the
   *  taxonomy-and-city placeholder as a fake listing
   *  ([[project_setnayan_vendor_hybrid_anonymity]]). */
  nameAnonymized: boolean;
  city: string | null;
  logoUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  /** km from the event's reception/ceremony/target coords; null when unknown. */
  distanceKm: number | null;
  verified: boolean;
  boosted: boolean;
  /** Compatibility score (0–100) + tier · lib/compat-score · the §2 GATE+SCORE
   *  soft layer (Customer_Vendor_Marketplace_Architecture_2026-06-04 §2).
   *  DISPLAY-only in this PR — the result ORDER stays the owner-locked
   *  2026-05-31 tier ladder (Favorites → Boosted → top-reviews → nearest).
   *  Re-ranking the non-boosted tier by score is a separate, sign-off-gated
   *  change. */
  /** null when Setnayan Assist is OFF (Manual mode) — the pill is hidden. */
  compatScore: number | null;
  compatTier: 'strong' | 'good' | 'fair' | null;
  /** Last-minute mechanic (Setnayan AI §4). True when this vendor's matched
   *  service is in its last-minute window (END ≤ R ≤ leaf START) AND visible
   *  to this couple → render the "Last-minute" badge. AI-only by nature
   *  (last-minute vendors are hidden in generic search). */
  lastMinuteAvailable: boolean;
  /** The vendor's optional last-minute surcharge % (0–100) when in the window;
   *  null = flat (the badge shows without a price note). */
  lastMinuteSurchargePct: number | null;
  /** Already in this event's picks → render "✓ Added", not an Add button. */
  alreadyAdded: boolean;
  /** Service-radius coverage (vendor-tier-caps · serviceRadiusKm vs the
   *  reception anchor). TRUE = the vendor's tier radius reaches this reception
   *  ("✓ Serves your area"); FALSE = out of range ("travel fee likely"). Always
   *  TRUE when distance is unknown / the vendor is unscoped (fail-open). */
  withinRadius: boolean;
  /** The vendor's tier service radius in km (20 verified · 50 pro). null =
   *  unscoped (Free 0) or nationwide (Enterprise ∞) — no finite range to show. */
  serviceRadiusKm: number | null;
};

export type CategorySearchResult = {
  results: CategoryVendorResult[];
  total: number;
  /** Null when the event has no stored coords (distance tier falls back to
   *  review order + the overlay hides distance chips). */
  hasReceptionCoords: boolean;
};

const EMPTY: CategorySearchResult = {
  results: [],
  total: 0,
  hasReceptionCoords: false,
};

/** Forward group → canonical services. Tightest-first: a leaf's single
 *  canonical hint, else its tile's canonical set, else the whole parent
 *  folder (guarantees a non-empty scope for parent-level groups). Mirrors
 *  the marketplace [Search] deep-link's scoping sources. */
function canonicalsForGroup(groupId: string): string[] {
  const g = PLAN_GROUPS.find((x) => x.id === groupId);
  if (!g) return [];
  if (g.subcategoryHint) return [g.subcategoryHint];
  if (g.catalogTile) return canonicalServicesForTile(g.catalogTile);
  return canonicalServicesForFolder(g.catalogFolder);
}

/** Haversine great-circle distance in km. */
function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export async function searchCategoryVendors(input: {
  eventId: string;
  groupId: string;
  query?: string;
  verifiedOnly?: boolean;
  maxKm?: number | null;
  /** "Show vendors farther away" expander: when TRUE, return ONLY the
   *  out-of-range vendors (the in-range set is already on screen from the
   *  default fetch), each tagged withinRadius=false + sorted nearest-first. */
  includeFarther?: boolean;
}): Promise<CategorySearchResult> {
  const eventId = String(input.eventId ?? '').trim();
  const groupId = String(input.groupId ?? '').trim();
  if (!eventId || !groupId) return EMPTY;

  const groupCanonicals = canonicalsForGroup(groupId);
  if (groupCanonicals.length === 0) return EMPTY;

  // Auth + membership gate in one RLS-bounded read: events RLS restricts to
  // members, so a non-member gets `ev === null` and we bail. This also gives
  // us the reception coords + compat context for the query.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY;

  const { data: ev } = await supabase
    .from('events')
    .select(
      'venue_latitude, venue_longitude, ceremony_type, secondary_ceremony_type, venue_setting, event_type, estimated_pax, planning_mode, setnayan_ai_active, event_date',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (!ev) return EMPTY; // not a member of this event

  // Outer-gate scoping (2026-06-11) — the SAME shared predicates the /vendors
  // marketplace uses (lib/taxonomy-filters), so the two couple surfaces can
  // never disagree: drop canonicals whose tile doesn't serve this event's
  // type (NULL = universal, fail-open) and faith-tagged canonicals that don't
  // match the couple's rite(s) (union of primary + secondary; untagged always
  // pass; non-wedding events never faith-narrow). Unmapped canonicals are
  // admitted (admit-unknown — never empty a result by metadata gap).
  const tax = await getTaxonomy();
  const faithSet = buildCoupleFaithSet({
    eventType: (ev.event_type as string | null) ?? null,
    ceremonyType: (ev.ceremony_type as string | null) ?? null,
    secondaryCeremonyType: (ev.secondary_ceremony_type as string | null) ?? null,
  });
  const canonicals = groupCanonicals.filter((c) => {
    const meta = tax.map[c];
    if (!meta) return true;
    if (!passesFaithFilter(meta.faith ?? null, faithSet)) return false;
    const tileId = meta.tile ?? null;
    return passesEventTypeFilter(
      tileId ? (tax.tileEventTypes[tileId] ?? null) : null,
      (ev.event_type as string | null) ?? null,
    );
  });
  if (canonicals.length === 0) return EMPTY;

  // Setnayan AI OFF (Manual mode) → GENERIC search: drop the per-candidate
  // "% match" pill AND the reception-proximity sort, so the order falls back to
  // boosted → reviews → rating. The one governing gate lives in lib/setnayan-ai
  // so every surface agrees (owner 2026-06-08: "govern now, monetize next").
  const aiActive = isSetnayanAiActive(
    ev as { planning_mode?: string | null; setnayan_ai_active?: boolean | null },
  );
  const assistOff = !aiActive;

  const lat = (ev.venue_latitude as number | null) ?? null;
  const lng = (ev.venue_longitude as number | null) ?? null;
  const hasCoords = lat !== null && lng !== null;

  // ── Last-minute config (Setnayan AI §4) ──────────────────────────────────
  // Platform-set per-leaf START lives in planning_deadlines (kind=
  // 'last_minute_start'): a category default (scope='category', ref_key =
  // groupId) + optional per-leaf overrides (scope='leaf', ref_key = canonical).
  // No rows → dormant: every zone resolves to 'normal', nothing is filtered or
  // badged. The vendor's per-service END/surcharge is read later from
  // vendor_services.
  const monthsRemaining = monthsToWedding(
    (ev.event_date as string | null) ?? null,
  );
  const admin = createAdminClient();
  const leafStartByCanonical = new Map<string, number>();
  let groupStartMonths: number | null = null;
  {
    const { data: lmRows } = await admin
      .from('planning_deadlines')
      .select('ref_key, scope, offset_value, offset_unit')
      .eq('kind', 'last_minute_start')
      .eq('is_active', true)
      .in('ref_key', [groupId, ...canonicals]);
    for (const row of lmRows ?? []) {
      const r = row as {
        ref_key: string;
        scope: string;
        offset_value: number;
        offset_unit: string;
      };
      // Normalize to months (START is authored in months, but keep weeks/days
      // safe in case an admin picks another unit).
      const months =
        r.offset_unit === 'week'
          ? r.offset_value / 4.345
          : r.offset_unit === 'day'
            ? r.offset_value / 30.4375
            : r.offset_value;
      if (r.scope === 'category' && r.ref_key === groupId) {
        groupStartMonths = months;
      } else if (r.scope === 'leaf') {
        leafStartByCanonical.set(r.ref_key, months);
      }
    }
  }

  // Dormant when no START row exists for this group/leaves — then we skip the
  // vendor_services read entirely, so production is unaffected (and safe even
  // before this PR's migration lands: the new columns are only ever touched
  // once an admin configures a START). Activates with the follow-up admin editor.
  const lastMinuteConfigured =
    groupStartMonths !== null || leafStartByCanonical.size > 0;

  // Edge #2 — AI-off-empty rule. When AI is off and the WHOLE group is already
  // in (or past) its last-minute zone, the standard search shows NOTHING. The
  // group is fully last-minute only when every in-scope leaf has a configured
  // START and R ≤ the smallest of them; if any leaf is dormant (no START) the
  // category isn't fully last-minute → never empty (the per-vendor filter below
  // still hides any individual last-minute vendors when AI is off).
  const effectiveStarts = canonicals.map(
    (c) => leafStartByCanonical.get(c) ?? groupStartMonths,
  );
  const groupEffectiveStart = effectiveStarts.some((s) => s == null)
    ? null
    : Math.min(...(effectiveStarts as number[]));
  if (
    categoryEmptyForGenericSearch({
      aiActive,
      monthsRemaining,
      groupStartMonths: groupEffectiveStart,
    })
  ) {
    return { ...EMPTY, hasReceptionCoords: hasCoords };
  }

  // Vendors already in this event's picks (RLS-bounded to the user's events)
  // → render "✓ Added" instead of an Add button.
  const { data: pickRows } = await supabase
    .from('event_vendors')
    .select('marketplace_vendor_id')
    .eq('event_id', eventId)
    .not('marketplace_vendor_id', 'is', null);
  const addedIds = new Set<string>(
    (pickRows ?? [])
      .map((r) => (r as { marketplace_vendor_id: string | null }).marketplace_vendor_id)
      .filter((v): v is string => typeof v === 'string'),
  );

  // Ranked category query (boosted → review_count → rating) + live search.
  // (`admin` is created above for the last-minute config read.)

  // Demo-vendor exclusion — mirror the public `/explore` browse: real couples
  // never see `is_demo = TRUE` vendors; only an admin in demo mode (admin
  // profile + the demo cookie) does. Cheap fast-path: skip the admin lookup
  // unless the demo cookie is present.
  const cookieStore = await cookies();
  const hasDemoCookie =
    cookieStore.get(DEMO_MODE_COOKIE_NAME)?.value === '1';
  let inDemoMode = false;
  if (hasDemoCookie) {
    const { data: viewerProfile } = await supabase
      .from('users')
      .select('account_type, is_internal, is_team_member')
      .eq('user_id', user.id)
      .maybeSingle();
    inDemoMode = isAdminProfile(viewerProfile);
  }
  const excludeVendorIds: ReadonlyArray<string> = inDemoMode
    ? []
    : await fetchDemoVendorIds(admin);

  const recs = await fetchWizardVendorRecommendations(admin, {
    canonicalServices: canonicals,
    excludeVendorIds,
    ceremonyType: (ev.ceremony_type as string | null) ?? null,
    // Mixed/interfaith weddings: admit vendors fit for the secondary rite too
    // (additive — never excludes). CLAUDE.md 2026-06-01 + 2026-06-02.
    secondaryCeremonyType: (ev.secondary_ceremony_type as string | null) ?? null,
    venueSetting: (ev.venue_setting as string | null) ?? null,
    // Leaf-match parity with onboarding (2026-06-04): event-type + pax. Region
    // is intentionally NOT forced here — the dashboard already scopes location
    // via the reception coords + the grid's client-side region picker; a
    // server-side region filter would fight that picker. Venue_type is
    // onboarding-only (the dashboard stores just the coarse venue_setting).
    eventType: (ev.event_type as string | null) ?? null,
    pax: (ev.estimated_pax as number | null) ?? null,
    // Phase C service-radius gate (vendor-tier-caps · serviceRadiusKm). The
    // dashboard Services surface is the ONLY caller that passes anchor coords,
    // so the radius cut applies here but NOT on /vendors browse / onboarding.
    // Verified vendors drop beyond 20km of the event, Pro beyond 50km;
    // Enterprise (∞) + Free (0 = unscoped) + unknown tier are admitted.
    // Null coords (event has no venue lat/lng) → radius scope off (fail-open).
    anchorLat: lat,
    anchorLng: lng,
    // Expander: stop excluding out-of-range vendors so the action can return
    // the farther set. Over-fetch a bit wider so the far group is well-stocked.
    includeOutOfRadius: input.includeFarther === true,
    searchQuery: input.query,
    limit: input.includeFarther === true ? 100 : 60,
  });
  if (recs.length === 0) return { ...EMPTY, hasReceptionCoords: hasCoords };

  // Resolve hybrid-anonymity display names: a Free / Verified vendor's real
  // name is hidden until first reply, so we need screen_name + name_revealed_at
  // (+ services for the venue-exemption) — the rec view doesn't carry them.
  const ids = recs.map((r) => r.vendor_profile_id);
  const { data: profRows } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, screen_name, name_revealed_at, services, tier_state')
    .in('vendor_profile_id', ids);
  const profById = new Map<
    string,
    {
      screen_name: string | null;
      name_revealed_at: string | null;
      services: string[] | null;
      tier_state: string | null;
    }
  >();
  for (const p of profRows ?? []) {
    const row = p as {
      vendor_profile_id: string;
      screen_name: string | null;
      name_revealed_at: string | null;
      services: string[] | null;
      tier_state: string | null;
    };
    profById.set(row.vendor_profile_id, {
      screen_name: row.screen_name,
      name_revealed_at: row.name_revealed_at,
      services: row.services,
      tier_state: row.tier_state,
    });
  }

  // Per-vendor last-minute zone (§4): combine the platform leaf START with the
  // vendor's own per-service END + surcharge from vendor_services. Pick each
  // vendor's MOST-AVAILABLE in-scope service (normal ≻ last_minute ≻ expired)
  // so a vendor still 'normal' on one of its services stays searchable. Dormant
  // (START unset) → 'normal' for everyone (no filter, no badge).
  const lmByVendor = new Map<
    string,
    { zone: LastMinuteZone; surchargePct: number | null }
  >();
  if (lastMinuteConfigured) {
    const { data: svcRows } = await admin
      .from('vendor_services')
      .select(
        'vendor_profile_id, category, last_minute_end_months, last_minute_surcharge_pct',
      )
      .in('vendor_profile_id', ids)
      .in('category', canonicals);
    const svcByVendor = new Map<
      string,
      Array<{ category: string; end: number | null; pct: number | null }>
    >();
    for (const s of svcRows ?? []) {
      const row = s as {
        vendor_profile_id: string;
        category: string;
        last_minute_end_months: number | null;
        last_minute_surcharge_pct: number | null;
      };
      const list = svcByVendor.get(row.vendor_profile_id) ?? [];
      list.push({
        category: row.category,
        end: row.last_minute_end_months,
        pct: row.last_minute_surcharge_pct,
      });
      svcByVendor.set(row.vendor_profile_id, list);
    }
    const ZONE_RANK: Record<LastMinuteZone, number> = {
      normal: 0,
      last_minute: 1,
      expired: 2,
    };
    for (const id of ids) {
      // Matched via vendor_profiles.services but no in-scope vendor_services row
      // → one synthetic service (group START, END=0 = until the night before).
      const svcs = svcByVendor.get(id) ?? [{ category: '', end: null, pct: null }];
      let best: { zone: LastMinuteZone; surchargePct: number | null } | null = null;
      for (const c of svcs) {
        const start =
          c.category && leafStartByCanonical.has(c.category)
            ? leafStartByCanonical.get(c.category)!
            : groupStartMonths;
        const zone = lastMinuteZone({
          monthsRemaining,
          startMonths: start,
          endMonths: c.end,
        });
        const pick = { zone, surchargePct: zone === 'last_minute' ? c.pct : null };
        if (!best || ZONE_RANK[zone] < ZONE_RANK[best.zone]) best = pick;
      }
      lmByVendor.set(id, best ?? { zone: 'normal', surchargePct: null });
    }
  }

  // Shape every rec, then partition into the locked tier ladder.
  type Shaped = CategoryVendorResult & {
    _adRank: number;
    _reviews: number;
    _rating: number;
    /** Survives the last-minute filter (expired → never · last_minute → AI only). */
    _searchable: boolean;
  };
  const shaped: Shaped[] = recs.map((r) => {
    const prof = profById.get(r.vendor_profile_id);
    const name = resolveVendorDisplayName({
      business_name: r.business_name ?? null,
      screen_name: prof?.screen_name ?? null,
      name_revealed_at: prof?.name_revealed_at ?? null,
      services: prof?.services ?? null,
      // Phase C: Pro/Enterprise reveal real business_name day-1.
      isPaidTier: isTrueNameTier(prof?.tier_state ?? null),
      primary_canonical_service: prof?.services?.[0] ?? null,
      location_city: r.location_city ?? null,
    });
    // Same gate `resolveVendorDisplayName` used: TRUE here means the
    // resolved `name` above is the placeholder, not the real business_name.
    const nameAnonymized = !isVendorNameRevealed({
      name_revealed_at: prof?.name_revealed_at ?? null,
      isPaidTier: isTrueNameTier(prof?.tier_state ?? null),
      services: prof?.services ?? null,
    });
    const vLat = (r.hq_latitude as number | null) ?? null;
    const vLng = (r.hq_longitude as number | null) ?? null;
    const dKm =
      hasCoords && vLat !== null && vLng !== null
        ? Math.round(distanceKm(lat as number, lng as number, vLat, vLng) * 10) / 10
        : null;
    // Service-radius coverage — same fail-open as the recs radiusOk gate
    // (vendor-tier-caps): unknown/Free tier → 0 (unscoped → within), Enterprise
    // → ∞ (within), Verified 20 / Pro 50 → within iff distance ≤ radius.
    const radiusKm = tierCaps(asVendorTier(prof?.tier_state ?? null)).serviceRadiusKm;
    const withinRadius =
      dKm === null || !Number.isFinite(radiusKm) || radiusKm <= 0 || dKm <= radiusKm;
    const serviceRadiusKm =
      Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : null;
    const adRank = (r.ad_rank as number | null) ?? 0;
    const compat = assistOff
      ? null
      : computeCompatScore({
          distanceKm: dKm,
          avgRating: r.avg_rating_overall ?? null,
          reviewCount: r.review_count ?? null,
          verified: r.public_visibility === 'verified',
          boosted: adRank > 0,
        });
    const compatScore: number | null = compat ? compat.score : null;
    const compatTier: 'strong' | 'good' | 'fair' | null = compat ? compat.tier : null;
    const lm = lmByVendor.get(r.vendor_profile_id) ?? {
      zone: 'normal' as LastMinuteZone,
      surchargePct: null,
    };
    const searchable = isLastMinuteSearchable(lm.zone, aiActive);
    return {
      vendorProfileId: r.vendor_profile_id,
      name,
      nameAnonymized,
      city: r.location_city ?? null,
      logoUrl: r.logo_url ?? null,
      rating: r.avg_rating_overall ?? null,
      reviewCount: r.review_count ?? null,
      distanceKm: dKm,
      verified: r.public_visibility === 'verified',
      boosted: adRank > 0,
      compatScore,
      compatTier,
      lastMinuteAvailable: lm.zone === 'last_minute' && searchable,
      lastMinuteSurchargePct: lm.zone === 'last_minute' ? lm.surchargePct : null,
      alreadyAdded: addedIds.has(r.vendor_profile_id),
      withinRadius,
      serviceRadiusKm,
      _adRank: adRank,
      _reviews: r.review_count ?? 0,
      _rating: r.avg_rating_overall ?? 0,
      _searchable: searchable,
    };
  });

  // Last-minute filter (§4): drop expired vendors for everyone, and last-minute
  // vendors when Setnayan AI is off — applied before tiering so counts + tiers
  // stay coherent. Dormant categories leave every vendor _searchable=true.
  const searchableShaped = shaped.filter((s) => s._searchable);

  // Tier 1 favorites: empty until the cross-event favorites table ships (V1.x).
  // Tier 2 boosted: ad_rank desc.
  const boosted = searchableShaped
    .filter((s) => s.boosted)
    .sort((a, b) => b._adRank - a._adRank);
  const rest0 = searchableShaped.filter((s) => !s.boosted);
  // Tier 3 top-10 by review_count then rating.
  const byReview = [...rest0].sort(
    (a, b) => b._reviews - a._reviews || b._rating - a._rating,
  );
  const top10 = byReview.slice(0, 10);
  const top10Ids = new Set(top10.map((s) => s.vendorProfileId));
  // Tier 4 the rest, nearest-first when we have coords, else keep review order.
  const tail = rest0.filter((s) => !top10Ids.has(s.vendorProfileId));
  tail.sort((a, b) => {
    // Reception-proximity sort is a Setnayan AI feature — gate on `aiActive`.
    // AI off → keep review/rating order (generic), the same fallback used when
    // the event has no reception coords.
    if (hasCoords && aiActive) {
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
    }
    return b._reviews - a._reviews || b._rating - a._rating;
  });

  let ordered = [...boosted, ...top10, ...tail];

  // Show-farther expander: the default fetch already shows the in-range set, so
  // return ONLY the out-of-range vendors here (nearest-first), tagged for the
  // "farther away" section. The default fetch (includeFarther=false) keeps the
  // full in-range ladder above — all withinRadius=true (the recs gate filtered
  // the far ones out), so the partition is a no-op there.
  if (input.includeFarther) {
    ordered = ordered
      .filter((s) => !s.withinRadius)
      .sort(
        (a, b) =>
          (a.distanceKm ?? Number.POSITIVE_INFINITY) -
          (b.distanceKm ?? Number.POSITIVE_INFINITY),
      );
  }

  // Client filters (applied here so the count + tiers stay coherent).
  if (input.verifiedOnly) ordered = ordered.filter((s) => s.verified);
  if (typeof input.maxKm === 'number' && hasCoords) {
    ordered = ordered.filter(
      (s) => s.distanceKm !== null && s.distanceKm <= (input.maxKm as number),
    );
  }

  const results: CategoryVendorResult[] = ordered.map((s) => ({
    vendorProfileId: s.vendorProfileId,
    name: s.name,
    nameAnonymized: s.nameAnonymized,
    city: s.city,
    logoUrl: s.logoUrl,
    rating: s.rating,
    reviewCount: s.reviewCount,
    distanceKm: s.distanceKm,
    verified: s.verified,
    boosted: s.boosted,
    compatScore: s.compatScore,
    compatTier: s.compatTier,
    lastMinuteAvailable: s.lastMinuteAvailable,
    lastMinuteSurchargePct: s.lastMinuteSurchargePct,
    alreadyAdded: s.alreadyAdded,
    withinRadius: s.withinRadius,
    serviceRadiusKm: s.serviceRadiusKm,
  }));

  return { results, total: results.length, hasReceptionCoords: hasCoords };
}
