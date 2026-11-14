import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { LIVE_SHOP_GATE } from '@/lib/live-shops';
import { ReadRefused } from '@/lib/remembered-read-core';
import { rememberPublicRead } from '@/lib/remembered-read';
import { HOME_SHELF_TAGS } from '@/lib/home-shelf-tags';
import { shopColumns } from '@/lib/home-public-reads-core';

/**
 * similar-shops.server.ts — the ONE read behind "More <kind of work> near <area>" at the end of a shop's page (owner
 * 2026-11-14, DECISION_LOG "A SHOP PAGE ENDS WITH ITS PARTNERS, THEN SIMILAR SHOPS NEARBY"). The rule that picks four
 * from these rows is pure and lives in `lib/similar-shops.ts`.
 *
 * ── ONE REQUEST, REMEMBERED (owner: fewest requests per task; prod is the Supabase free plan) ─────────────────────
 * One `vendor_profiles` select: public (`LIVE_SHOP_GATE`, the gate Discover's shelf and search read), the same kind of
 * work (`services` contains it — the marketplace's own `?category=` match), and the same demo-ness as the shop being
 * viewed (a demo shop shows demo shops only; a real shop never shows a demo one). The rows depend on nothing but
 * (kind of work, demo), so they are remembered across every shop of that kind and every visitor — the home shelf's
 * own store and freshness (`rememberPublicRead`, cleared with the shop shelf when a listing changes). Which of them is
 * "this shop", "a Trusted-by shop" or "nearby" is decided per page, in code, over the remembered rows.
 *
 * No index or migration: the shop shelf already filters this table by the same gate; `services` contains is the
 * marketplace's category filter.
 *
 * ⚠ A REFUSED READ IS NEVER REMEMBERED and never reads as "no similar shops": it throws `ReadRefused`, the caller logs
 * it and draws no row — the row has no empty message to tell a lie with.
 */

/** The card's columns plus the two pins "then the nearest" orders by. */
const SIMILAR_COLUMNS = `${shopColumns()}, hq_latitude, hq_longitude`;

/**
 * How many same-kind shops one read brings back to choose four from. A bound, not a ranking: at today's scale a kind
 * of work holds far fewer public shops than this, so every candidate is seen. Newest first past the bound.
 */
export const SIMILAR_CANDIDATE_CAP = 60;

export type SimilarShopRow = Record<string, unknown>;

async function readSimilarShopRows(service: string, demo: boolean): Promise<SimilarShopRow[]> {
  const { data, error } = await createAdminClient()
    .from('vendor_profiles')
    .select(SIMILAR_COLUMNS)
    .match({ ...LIVE_SHOP_GATE, is_demo: demo })
    .contains('services', [service])
    .order('created_at', { ascending: false })
    .limit(SIMILAR_CANDIDATE_CAP);
  if (error) throw new ReadRefused('similarShops', error);
  return (data ?? []) as unknown as SimilarShopRow[];
}

/** (kind of work, demo) → the public shops of that kind. Throws `ReadRefused` when the database did not answer. */
export const rememberedSimilarShopRows = rememberPublicRead(readSimilarShopRows, {
  key: 'shop-end:similar-shops-v1',
  tags: [HOME_SHELF_TAGS.shops],
});
