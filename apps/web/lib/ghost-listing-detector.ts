import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  scoreGhostListing,
  normalizeIdentity,
  GHOST_LISTING_FLAG_THRESHOLD,
} from '@/lib/ghost-listing-scoring';

/**
 * Ghost-listing detector — SERVER-ONLY I/O orchestration around the pure scorer
 * in lib/ghost-listing-scoring.ts. Flags a marketplace vendor_profiles row that
 * is a placeholder, abandoned, or a duplicate business identity. NO LLM.
 *
 * WHERE IT RUNS: server-side, from an admin "Rescan listings" action at
 * /admin/integrity-watch (NO polling cron — the marketplace vendor set is small
 * + near-static during the founder-only pilot, so an on-demand admin sweep is
 * the right cadence). Best-effort + fail-soft.
 *
 * A flag lands in `integrity_flags` (kind='ghost_listing') ONLY when the score
 * >= GHOST_LISTING_FLAG_THRESHOLD. Detect-and-review only — NEVER auto-hides the
 * listing; an admin adjudicates + explicitly hides at /admin/integrity-watch.
 *
 * SCOPE: only PUBLISHED, NON-DEMO vendors are scanned (a demo/seeded listing is
 * expected to look sparse; an unpublished draft isn't a live ghost). The
 * duplicate-identity candidate pool is likewise non-demo only.
 *
 * PRIVACY (RA 10173): the `detail` JSONB carries only NON-PII booleans + counts
 * + component scores. NO emails, names, or message bodies.
 *
 * TRUST BOUNDARY (honest): all reads/writes use the SERVICE-ROLE admin client,
 * which BYPASSES RLS. The real guard is that ONLY the admin rescan action ever
 * constructs it.
 */

// Re-export the pure scorer surface for one-module imports.
export {
  scoreGhostListing,
  normalizeIdentity,
  GHOST_LISTING_FLAG_THRESHOLD,
  GHOST_LISTING_REASON_LABEL,
} from '@/lib/ghost-listing-scoring';
export type {
  GhostListingDetail,
  GhostListingScore,
} from '@/lib/ghost-listing-scoring';

type VendorRow = {
  vendor_profile_id: string;
  business_name: string | null;
  contact_email: string | null;
  logo_url: string | null;
  updated_at: string;
};

/**
 * Scan every PUBLISHED, NON-DEMO marketplace listing and upsert a ghost_listing
 * flag for each that scores >= threshold. On-demand admin action (no cron).
 * Idempotent: deduped on subject_vendor_id (partial unique index); re-running
 * refreshes an OPEN flag's score in place, never re-opens a resolved one, and
 * CLEARS an open flag whose listing has since recovered. Best-effort + fail-soft.
 */
export async function scanForGhostListings(): Promise<{
  vendorsScanned: number;
  flagsUpserted: number;
}> {
  try {
    const admin = createAdminClient();

    const { data: vendorsRaw } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name, contact_email, logo_url, updated_at')
      .eq('is_published', true)
      .eq('is_demo', false);
    const vendors = (vendorsRaw ?? []) as VendorRow[];
    if (vendors.length === 0) return { vendorsScanned: 0, flagsUpserted: 0 };

    const vendorIds = vendors.map((v) => v.vendor_profile_id);

    // Active service counts, per vendor (one query, tallied in JS).
    const { data: servicesRaw } = await admin
      .from('vendor_services')
      .select('vendor_profile_id')
      .eq('is_active', true)
      .in('vendor_profile_id', vendorIds);
    const activeServices = new Map<string, number>();
    for (const s of (servicesRaw ?? []) as { vendor_profile_id: string }[]) {
      activeServices.set(
        s.vendor_profile_id,
        (activeServices.get(s.vendor_profile_id) ?? 0) + 1,
      );
    }

    // Chat message tallies per vendor — inbound (couple/coordinator) vs vendor
    // replies. One scan of the small message set, tallied in JS.
    const { data: msgsRaw } = await admin
      .from('chat_messages')
      .select('vendor_profile_id, sender_role')
      .in('vendor_profile_id', vendorIds);
    const inbound = new Map<string, number>();
    const vendorReplies = new Map<string, number>();
    for (const m of (msgsRaw ?? []) as {
      vendor_profile_id: string;
      sender_role: string;
    }[]) {
      if (m.sender_role === 'vendor') {
        vendorReplies.set(
          m.vendor_profile_id,
          (vendorReplies.get(m.vendor_profile_id) ?? 0) + 1,
        );
      } else if (m.sender_role === 'couple' || m.sender_role === 'coordinator') {
        inbound.set(
          m.vendor_profile_id,
          (inbound.get(m.vendor_profile_id) ?? 0) + 1,
        );
      }
    }

    // Duplicate-identity index — normalized business_name + contact_email →
    // distinct vendor ids sharing it.
    const nameOwners = new Map<string, Set<string>>();
    const emailOwners = new Map<string, Set<string>>();
    const addOwner = (
      index: Map<string, Set<string>>,
      key: string,
      vendorId: string,
    ) => {
      let set = index.get(key);
      if (!set) {
        set = new Set<string>();
        index.set(key, set);
      }
      set.add(vendorId);
    };
    for (const v of vendors) {
      const name = normalizeIdentity(v.business_name);
      if (name) addOwner(nameOwners, name, v.vendor_profile_id);
      const email = normalizeIdentity(v.contact_email);
      if (email) addOwner(emailOwners, email, v.vendor_profile_id);
    }

    const now = Date.now();
    let flagsUpserted = 0;

    for (const v of vendors) {
      const name = normalizeIdentity(v.business_name);
      const email = normalizeIdentity(v.contact_email);
      const dupPeers = new Set<string>();
      if (name) for (const id of nameOwners.get(name) ?? []) dupPeers.add(id);
      if (email) for (const id of emailOwners.get(email) ?? []) dupPeers.add(id);
      dupPeers.delete(v.vendor_profile_id);

      const dormantDays = Math.max(
        0,
        Math.floor((now - new Date(v.updated_at).getTime()) / 86_400_000),
      );

      const { score, reason, detail } = scoreGhostListing({
        hasLogo: !!(v.logo_url && v.logo_url.trim().length > 0),
        activeServiceCount: activeServices.get(v.vendor_profile_id) ?? 0,
        inboundMessageCount: inbound.get(v.vendor_profile_id) ?? 0,
        vendorReplyCount: vendorReplies.get(v.vendor_profile_id) ?? 0,
        dormantDays,
        duplicateOfCount: dupPeers.size,
      });

      // Existing flag for this vendor?
      const { data: existing } = await admin
        .from('integrity_flags')
        .select('id, status')
        .eq('subject_vendor_id', v.vendor_profile_id)
        .eq('kind', 'ghost_listing')
        .maybeSingle();

      if (score < GHOST_LISTING_FLAG_THRESHOLD) {
        // Recovered below threshold — auto-clear a still-OPEN flag so the queue
        // doesn't carry a stale ghost. Never touch a resolved flag.
        if (existing && (existing as { status: string }).status === 'open') {
          await admin
            .from('integrity_flags')
            .update({
              status: 'dismissed',
              resolution_notes:
                'Auto-cleared on rescan — listing no longer scores as a ghost.',
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
        kind: 'ghost_listing',
        subject_vendor_id: v.vendor_profile_id,
        subject_review_id: null,
        score,
        reason,
        detail,
      });
      flagsUpserted += 1;
    }

    return { vendorsScanned: vendors.length, flagsUpserted };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { feature: 'ghost-listing-detector' },
    });
    return { vendorsScanned: 0, flagsUpserted: 0 };
  }
}
