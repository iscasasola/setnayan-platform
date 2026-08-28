/**
 * service-trade-aliases-db.ts — the server read for `canonical_service_aliases`.
 *
 * Split from the pure `service-trade-aliases.ts` for the same reason
 * `service-merge-forward-db.ts` is split from `service-merge-forward.ts`:
 * the resolver must be unit-testable without pulling in `next/headers`.
 *
 * 🔒 FAILS SILENT, DELIBERATELY, AND AS ITS OWN QUERY. An error or a missing
 * migration returns an empty list — no aliases — which is exactly the state
 * this feature was in before it existed. A supplier must never see the
 * maker break because a synonym table hiccuped.
 *
 * ⚠ RE-FILTERS `reviewed_at IS NOT NULL` IN THE QUERY even though the RLS
 * policy already restricts an ordinary session read to reviewed rows —
 * belt-and-braces, the same posture `recallPhrase` takes re-validating a
 * stored href it could otherwise trust. If this is ever read with the admin
 * client (which bypasses RLS), the explicit filter is the only thing
 * standing between an unreviewed row and a supplier.
 */
import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalisePhrase, type TradeAliasRow } from './service-trade-aliases';

/**
 * Every REVIEWED alias row. Cached per request. Returns `[]` on any error
 * or on a database that has not run the migration yet.
 */
export const getReviewedTradeAliasRows = cache(async (): Promise<TradeAliasRow[]> => {
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .from('canonical_service_aliases')
      .select('phrase,canonical_service,reviewed_at')
      .not('reviewed_at', 'is', null);
    if (error || !data) return [];
    return data as TradeAliasRow[];
  } catch {
    return [];
  }
});

/**
 * Record a phrase a supplier typed, that the search band genuinely missed,
 * paired with the live trade they went on to pick and save — the COLLECT
 * half of C3 (2026-08-28). See `lib/collected-trade-phrase.ts` for what
 * "genuinely missed" means and why only that case is ever passed here.
 *
 * 🔒 THE CALLER'S CLAIM IS NOT TRUSTED — RE-VALIDATE BEFORE CALLING THIS.
 * This function does not itself check that `canonicalService` is a live
 * coverage leaf; `commitVendorService` (the only caller) re-derives that
 * server-side from the taxonomy the save just enforced, never from anything
 * the browser posted. A caller that skips that check would let an
 * authenticated account queue an arbitrary (phrase → trade) pairing for
 * review — bounded by the review gate below, but still not this function's
 * job to guard against.
 *
 * 🔒 ADMIN CLIENT, DELIBERATELY. `canonical_service_aliases`'s write policy
 * is `is_admin()` — an ordinary vendor session cannot insert here at all,
 * by design (the same posture `save_vendor_service` takes: the SESSION
 * proves who the caller is server-side; the WRITE happens with elevated
 * privilege once that is settled).
 *
 * 🔒 LANDS UNREVIEWED, ALWAYS. Never sets `reviewed_at` — a collected row
 * sits in the exact same admin queue C2's mined rows do
 * (`/admin/taxonomy/aliases`) and answers nobody until a person approves
 * it. This is what makes "collect first, then recommend" (owner,
 * 2026-08-28) true of this table regardless of which column wrote a row:
 * COLLECTING is never the same act as SERVING.
 *
 * 🔒 `ON CONFLICT (phrase) DO NOTHING`. The table is `UNIQUE (phrase)`. If
 * the phrase already has a row — mined, collected, or already reviewed and
 * pointing somewhere else — this never overwrites it. A disagreeing signal
 * from one supplier's pick is not grounds to silently move an existing
 * (possibly already-approved) answer; an admin looking at the live list
 * still sees the earlier row.
 *
 * 🔒 FAILS SILENT, ALWAYS. A supplier's card must never fail to save, or
 * even show an error, because this best-effort memory write hiccuped —
 * mirrors every other fire-and-forget write in this action
 * (`hashAndScanVendorImages`).
 */
export async function recordCollectedTradePhrase(
  rawPhrase: string,
  canonicalService: string,
): Promise<void> {
  const phrase = normalisePhrase(rawPhrase).slice(0, 80);
  if (phrase.length < 2) return;
  if (!canonicalService) return;
  try {
    const admin = createAdminClient();
    await admin.from('canonical_service_aliases').upsert(
      { phrase, canonical_service: canonicalService, source: 'collected' },
      { onConflict: 'phrase', ignoreDuplicates: true },
    );
  } catch {
    /* best-effort — see docblock */
  }
}
