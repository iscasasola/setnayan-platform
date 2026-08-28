import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { getOpenShopServiceTree } from './open-shop-service-tree';
import { getReviewedTradeAliasRows } from './service-trade-aliases-db';
import { getServiceMergeForwards } from './service-merge-forward-db';
import { reviewedAliasesByLiveTrade } from './service-trade-aliases';
import { SIGNUP_SUGGESTION_KIND } from './vendor-signup-coverage-suggest-server';
import { isVendorSignupCoverageSuggestEnabled } from '@/lib/vendor-signup-coverage-suggest-flag';
import {
  matchDetectedServicesToTrades,
  type CoverageSuggestion,
  type SuggestableTrade,
} from './vendor-signup-coverage-suggest';

/**
 * vendor-signup-coverage-suggest-reader.ts — C5, 2026-08-28: turn a finished
 * `signup_suggestion` dossier back into suggestions a shop can see, and
 * resolve them once the shop acts. See `vendor-signup-coverage-suggest-server.ts`
 * for why this is a SEPARATE file (it pulls in `server-only`-tagged reads
 * that a plain `node:test` cannot import).
 */

export type PendingCoverageSuggestion = {
  dossierId: number;
  suggestions: CoverageSuggestion[];
};

/**
 * The one unresolved `signup_suggestion` dossier for this shop, turned into
 * suggested trades — or `null` when there is nothing to show: the flag is
 * off, no dossier exists, the dossier failed or is still running, it was
 * already dismissed/actioned, or none of its `detected_services` phrases
 * matched a live trade the shop does not already cover.
 *
 * Reads with the vendor's OWN session for the candidate taxonomy (the same
 * reads the card maker's search band uses — `getOpenShopServiceTree`,
 * `getReviewedTradeAliasRows`, `getServiceMergeForwards`) and the ADMIN
 * client only for the one admin-RLS table (`vendor_web_dossiers`), scoped to
 * this caller's own `vendorProfileId` — the same "own admin-scoped read"
 * shape this page already uses elsewhere (e.g. `fetchLatestApplication`).
 */
export async function fetchPendingSignupCoverageSuggestion(
  vendorProfileId: string,
  alreadyCoveredKeys: readonly string[],
): Promise<PendingCoverageSuggestion | null> {
  if (!isVendorSignupCoverageSuggestEnabled()) return null;

  const admin = createAdminClient();
  const { data: dossierRow } = await admin
    .from('vendor_web_dossiers')
    .select('id, status, dossier, suggestion_dismissed_at')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('kind', SIGNUP_SUGGESTION_KIND)
    .is('suggestion_dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = dossierRow as
    | {
        id: number;
        status: string;
        dossier: { detected_services?: string[] } | null;
        suggestion_dismissed_at: string | null;
      }
    | null;
  if (!row || row.status !== 'complete' || !row.dossier) return null;
  const detected = Array.isArray(row.dossier.detected_services)
    ? row.dossier.detected_services
    : [];
  if (detected.length === 0) return null;

  const candidates = await buildSuggestableTrades();
  const suggestions = matchDetectedServicesToTrades(
    detected,
    candidates,
    new Set(alreadyCoveredKeys),
  );
  if (suggestions.length === 0) return null;

  return { dossierId: row.id, suggestions };
}

/** Every live, marketplace-visible, non-first-party trade, each carrying its
 *  reviewed aliases — the same candidate shape the card maker's own search
 *  band builds in `app/vendor-dashboard/services/new/page.tsx`. Fails soft to
 *  `[]` on any read error (matches `getOpenShopServiceTree`'s own posture). */
async function buildSuggestableTrades(): Promise<SuggestableTrade[]> {
  const tree = await getOpenShopServiceTree().catch(() => []);
  const liveKeys = new Set<string>(
    tree.flatMap((p) => p.branches.flatMap((b) => b.leaves.map((l) => l.canonicalService))),
  );
  const [aliasRows, mergeForwards] = await Promise.all([
    getReviewedTradeAliasRows().catch(() => []),
    getServiceMergeForwards().catch(() => ({})),
  ]);
  const aliasesByLiveKey = reviewedAliasesByLiveTrade(aliasRows, mergeForwards, liveKeys);

  return tree.flatMap((p) =>
    p.branches.flatMap((b) =>
      b.leaves.map((l) => ({
        key: l.canonicalService,
        label: l.label,
        branch: b.label,
        aliases: aliasesByLiveKey.get(l.canonicalService),
      })),
    ),
  );
}

/** Re-resolves suggestions server-side (never trusts a client-posted list)
 *  and returns only the leaf + its branch id, for the apply action to add
 *  both the leaf and its coarse category — mirrors `/open-shop`'s own
 *  "the server re-resolves; it never trusts the post" rule. */
export async function resolveSuggestedTradeLeaves(
  keys: readonly string[],
): Promise<Array<{ canonicalService: string; tileId: string }>> {
  const tree = await getOpenShopServiceTree().catch(() => []);
  const wanted = new Set(keys);
  const out: Array<{ canonicalService: string; tileId: string }> = [];
  for (const p of tree) {
    for (const b of p.branches) {
      for (const l of b.leaves) {
        if (wanted.has(l.canonicalService)) {
          out.push({ canonicalService: l.canonicalService, tileId: b.tileId });
        }
      }
    }
  }
  return out;
}

/** Mark a signup-suggestion dossier resolved — dismissed outright, or
 *  actioned (the shop added at least one suggestion). Either way it never
 *  resurfaces from the same dossier. Admin client because the vendor has no
 *  RLS access to `vendor_web_dossiers`; scoped by BOTH id and
 *  `vendor_profile_id` so a caller can never resolve another shop's row. */
export async function markSignupSuggestionResolved(
  vendorProfileId: string,
  dossierId: number,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from('vendor_web_dossiers')
    .update({ suggestion_dismissed_at: new Date().toISOString() })
    .eq('id', dossierId)
    .eq('vendor_profile_id', vendorProfileId)
    .eq('kind', SIGNUP_SUGGESTION_KIND);
}
