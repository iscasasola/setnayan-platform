import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { createAdminClient } from '@/lib/supabase/admin';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { computeVerifiedMedian, type MedianSample } from '@/lib/verified-median';
import { paxBucketFor, PAX_BUCKET_ALL } from '@/lib/price-position';
import { resolveRegion } from '@/lib/region-source';
import { fetchInclusionsByService } from '@/lib/vendor-services';
import {
  scorePlausibility,
  FLAG_THRESHOLD,
  type PlausibilityInputs,
} from '@/lib/plausibility-scoring';

/**
 * Price-Under-Declaration Plausibility detector — SERVER-ONLY I/O orchestration
 * around the pure scorer in lib/plausibility-scoring.ts. Flags a couple-confirmed
 * LOCK (`event_vendors` row) whose declared price is implausibly low. NO LLM,
 * ₱0/run.
 *
 * WHERE IT RUNS: server-side, from an admin "Rescan prices" action at
 * /admin/integrity-watch → the "Prices" tab (gated on
 * NEXT_PUBLIC_PLAUSIBILITY_SCANNER_ENABLED). NO cron — the linked-lock set is
 * small during the founder-only pilot, so an on-demand admin sweep is the right
 * cadence (mirrors the ghost-listing detector). Best-effort + fail-soft.
 *
 * SECOND LAYER: couple-confirmation stays the load-bearing anchor. A flag NEVER
 * penalizes the vendor, adjusts the price, or touches the lock — detect-and-
 * review only. An admin dismisses / confirms at /admin/integrity-watch.
 *
 * REUSE (no duplication):
 *   · Tier 3 self-consistency → computeVerifiedMedian (lib/verified-median.ts).
 *   · Tier 2 category median → market_price_bands (via resolveRegion +
 *     paxBucketFor from lib/price-position.ts).
 *   · Tier 1 inclusion floor → vendor_service_inclusions.worth_php (via
 *     fetchInclusionsByService from lib/vendor-services.ts).
 *
 * PRIVACY (RA 10173): the `detail` JSONB carries only the lock's OWN price + this
 * vendor's OWN aggregate reference figures + per-tier severities. NO couple
 * identity, NO peer per-row prices.
 *
 * TRUST BOUNDARY: all reads/writes use the SERVICE-ROLE admin client (bypasses
 * RLS). The real guard is that ONLY the admin rescan action constructs it.
 */

type LockRow = {
  /** event_vendors.vendor_id — the lock id (subject_event_vendor_id). */
  vendor_id: string;
  linked_vendor_profile_id: string;
  category: string;
  total_cost_php: number | string | null;
};

type ProfileMeta = {
  regionSlug: string | null;
  paxBucket: string;
};

/**
 * Scan every couple-confirmed, LINKED, non-excluded lock and upsert a
 * price_underdeclaration flag for each whose combined plausibility score crosses
 * FLAG_THRESHOLD. On-demand admin action (no cron). Idempotent: deduped on
 * subject_event_vendor_id (partial unique index); re-running refreshes an OPEN
 * flag's score in place, never re-opens a resolved one, and CLEARS an open flag
 * whose lock now scores plausible. Best-effort + fail-soft.
 */
export async function scanForUnderDeclaredLocks(): Promise<{
  locksScanned: number;
  flagsUpserted: number;
}> {
  try {
    const admin = createAdminClient();

    // ── 1 · The scan universe: qualifying locks (same gate as the verified
    //        median reader — confirmed, linked, positive, non-excluded). ──────
    const { data: lockRaw } = await admin
      .from('event_vendors')
      .select('vendor_id, linked_vendor_profile_id, category, total_cost_php')
      .not('linked_vendor_profile_id', 'is', null)
      .eq('excluded_from_market_median', false)
      .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[])
      .not('total_cost_php', 'is', null)
      .gt('total_cost_php', 0);
    const locks = ((lockRaw ?? []) as LockRow[])
      .map((l) => ({
        vendorId: l.vendor_id,
        profileId: l.linked_vendor_profile_id,
        category: l.category,
        pricePhp: Number(l.total_cost_php),
      }))
      .filter((l) => Number.isFinite(l.pricePhp) && l.pricePhp > 0 && !!l.profileId);
    if (locks.length === 0) return { locksScanned: 0, flagsUpserted: 0 };

    const profileIds = [...new Set(locks.map((l) => l.profileId))];

    // ── 2 · Per-vendor region + pax bucket (Tier 2 band key). ────────────────
    const profileMeta = new Map<string, ProfileMeta>();
    const { data: vpRaw } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, hq_region, capacity_max')
      .in('vendor_profile_id', profileIds);
    for (const vp of (vpRaw ?? []) as {
      vendor_profile_id: string;
      hq_region: string | null;
      capacity_max: number | null;
    }[]) {
      const region = resolveRegion(vp.hq_region);
      profileMeta.set(vp.vendor_profile_id, {
        regionSlug: region?.slug ?? null,
        paxBucket: vp.capacity_max != null ? paxBucketFor(vp.capacity_max) : PAX_BUCKET_ALL,
      });
    }

    // ── 3 · Tier 1 · matched active listing per (profile, category) → its
    //        inclusion worth (Σ worth_php over stated-worth inclusions). ───────
    const { data: svcRaw } = await admin
      .from('vendor_services')
      .select('vendor_service_id, vendor_profile_id, category, is_active, created_at')
      .in('vendor_profile_id', profileIds)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    // (profile → listings, oldest first so "first active" is stable).
    const svcByProfile = new Map<string, { id: string; category: string }[]>();
    for (const s of (svcRaw ?? []) as {
      vendor_service_id: string;
      vendor_profile_id: string;
      category: string;
    }[]) {
      const list = svcByProfile.get(s.vendor_profile_id) ?? [];
      list.push({ id: s.vendor_service_id, category: s.category });
      svcByProfile.set(s.vendor_profile_id, list);
    }
    // Chosen listing per (profile, category): category match beats first-active.
    const chosenListing = new Map<string, string>(); // `${profile}::${category}` → serviceId
    for (const l of locks) {
      const key = `${l.profileId}::${l.category}`;
      if (chosenListing.has(key)) continue;
      const list = svcByProfile.get(l.profileId) ?? [];
      const svc = list.find((s) => s.category === l.category) ?? list[0] ?? null;
      if (svc) chosenListing.set(key, svc.id);
    }
    const chosenServiceIds = [...new Set([...chosenListing.values()])];
    const inclusionsByService = await fetchInclusionsByService(admin, chosenServiceIds);
    const inclusionWorthByKey = new Map<string, number>(); // `${profile}::${category}` → Σ worth
    for (const [key, serviceId] of chosenListing.entries()) {
      const rows = inclusionsByService.get(serviceId) ?? [];
      const worth = rows.reduce(
        (sum, r) => sum + (r.worth_php != null && r.worth_php > 0 ? r.worth_php : 0),
        0,
      );
      if (worth > 0) inclusionWorthByKey.set(key, worth);
    }

    // ── 4 · Tier 2 · market_price_bands low for each needed (category, region,
    //        bucket). One read of the needed categories, indexed in JS. ────────
    const neededCategories = [...new Set(locks.map((l) => l.category))];
    const neededRegions = [
      ...new Set([...profileMeta.values()].map((m) => m.regionSlug).filter((r): r is string => !!r)),
    ];
    const bandLowByKey = new Map<string, number>(); // `${category}::${region}::${bucket}` → low
    if (neededCategories.length > 0 && neededRegions.length > 0) {
      const { data: bandRaw } = await admin
        .from('market_price_bands')
        .select('category, region_slug, pax_bucket, low_php')
        .in('category', neededCategories)
        .in('region_slug', neededRegions);
      for (const b of (bandRaw ?? []) as {
        category: string;
        region_slug: string;
        pax_bucket: string;
        low_php: number;
      }[]) {
        bandLowByKey.set(`${b.category}::${b.region_slug}::${b.pax_bucket}`, Number(b.low_php));
      }
    }

    // ── 5 · Tier 3 · same-vendor, same-category price groups (subject excluded
    //        per-lock so a genuinely-low lock can't drag down its own ref). ────
    const groupByKey = new Map<string, { lockId: string; pricePhp: number }[]>();
    for (const l of locks) {
      const key = `${l.profileId}::${l.category}`;
      const g = groupByKey.get(key) ?? [];
      g.push({ lockId: l.vendorId, pricePhp: l.pricePhp });
      groupByKey.set(key, g);
    }

    // ── 6 · Score + upsert every lock. ───────────────────────────────────────
    let flagsUpserted = 0;
    for (const l of locks) {
      const key = `${l.profileId}::${l.category}`;
      const meta = profileMeta.get(l.profileId);

      // Tier 3 reference: median of this vendor's OTHER same-category locks.
      const others: MedianSample[] = (groupByKey.get(key) ?? [])
        .filter((g) => g.lockId !== l.vendorId)
        .map((g) => ({ pricePhp: g.pricePhp }));
      const median = computeVerifiedMedian(others);
      const ownMedianPhp = median.status === 'established' ? median.medianPhp : null;

      // Tier 2 reference: the band low for this category×region×bucket.
      const bandLowPhp =
        meta?.regionSlug != null
          ? bandLowByKey.get(`${l.category}::${meta.regionSlug}::${meta.paxBucket}`) ??
            bandLowByKey.get(`${l.category}::${meta.regionSlug}::${PAX_BUCKET_ALL}`) ??
            null
          : null;

      // Tier 1 reference: summed inclusion worth for this (profile, category).
      const inclusionWorthPhp = inclusionWorthByKey.get(key) ?? null;

      const inputs: PlausibilityInputs = {
        lockPricePhp: l.pricePhp,
        inclusionWorthPhp,
        bandLowPhp,
        ownMedianPhp,
      };
      const { score, flagged, reason, detail } = scorePlausibility(inputs);

      // Existing flag for this lock?
      const { data: existing } = await admin
        .from('integrity_flags')
        .select('id, status')
        .eq('subject_event_vendor_id', l.vendorId)
        .eq('kind', 'price_underdeclaration')
        .maybeSingle();

      if (!flagged) {
        // Recovered below threshold — auto-clear a still-OPEN flag so the queue
        // doesn't carry a stale one. Never touch a resolved flag.
        if (existing && (existing as { status: string }).status === 'open') {
          await admin
            .from('integrity_flags')
            .update({
              status: 'dismissed',
              resolution_notes:
                'Auto-cleared on rescan — lock no longer scores as an implausible under-declaration.',
              reviewed_at: new Date().toISOString(),
            })
            .eq('id', (existing as { id: number }).id);
        }
        continue;
      }

      if (existing) {
        if ((existing as { status: string }).status !== 'open') continue;
        await admin
          .from('integrity_flags')
          .update({ score, reason, detail })
          .eq('id', (existing as { id: number }).id);
        continue;
      }

      await admin.from('integrity_flags').insert({
        kind: 'price_underdeclaration',
        subject_vendor_id: l.profileId,
        subject_review_id: null,
        subject_event_vendor_id: l.vendorId,
        score,
        reason,
        detail,
      });
      flagsUpserted += 1;
    }

    return { locksScanned: locks.length, flagsUpserted };
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: 'plausibility-scanner' } });
    return { locksScanned: 0, flagsUpserted: 0 };
  }
}

// Re-export the pure scorer surface for one-module imports.
export {
  scorePlausibility,
  FLAG_THRESHOLD,
  PLAUSIBILITY_REASON_LABEL,
} from '@/lib/plausibility-scoring';
export type {
  PlausibilityDetail,
  PlausibilityScore,
  PlausibilityTierKey,
} from '@/lib/plausibility-scoring';
