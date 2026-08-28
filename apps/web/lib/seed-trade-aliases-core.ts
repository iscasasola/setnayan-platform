/**
 * seed-trade-aliases-core.ts — the testable half of `scripts/seed-trade-
 * aliases.ts`, split out so it lands under `lib/**`.
 *
 * ⚠ WHY THIS SPLIT EXISTS AT ALL. `test:unit` globs ONLY `lib/**` and
 * `app/**` — a test file dropped under `scripts/` never runs in CI and
 * silently proves nothing (the exact "put the guard where the glob can
 * see it" trap this repo has already paid for once). `fetchLiveTrades`
 * and `fetchSchemaAttributeRows` (both DB read shapes) live here so
 * `seed-trade-aliases-core.test.ts` actually executes; the script itself
 * stays a thin CLI wrapper (argv, the write). The actual WORD-MINING logic
 * — which options survive, which get dropped and why — is pure and lives
 * in `lib/trade-alias-miner.ts`, tested on its own.
 *
 * 🛑 CORRECTED 2026-08-28 — this module used to also carry `parseProposals`,
 * for parsing a MODEL's JSON reply. That path is gone: the alias list is
 * mined from our own data now, not asked of Claude (owner: "when we do not
 * have data yet, do not recommend. collect first."). Removed rather than
 * left unused — dead code nobody calls is debt, not a feature kept in
 * reserve. If a later "proposed" source is ever built, it is a fresh
 * design against the `source` column's own reserved value, not a
 * resurrection of this file's old shape.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SchemaRow as MinerSchemaRow } from './trade-alias-miner';

// ── Live trades, read directly (no Next request context in a CLI script —
// this cannot import lib/vendor-coverages.ts, which needs next/headers via
// createClient('@/lib/supabase/server')). Mirrors getCoverageTaxonomy()'s
// own query shape exactly, so "what counts as a live trade" cannot drift
// between the page and this script. ─────────────────────────────────────
type CategoryRow = {
  id: string;
  parent_id: string | null;
  tier: number;
  label_en: string;
  status: string | null;
  marketplace_hidden: boolean | null;
};
type CanonRow = {
  canonical_service: string;
  folder_id: string;
  tile_id: string | null;
  marketplace_hidden: boolean | null;
};
type DisplayNameRow = { canonical_service: string; display_name_en: string | null };

export type LiveTrade = {
  key: string;
  label: string;
  branchLabel: string;
  folderLabel: string;
};

export function humanize(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function fetchLiveTrades(admin: SupabaseClient): Promise<LiveTrade[]> {
  const [catsRes, canonRes, schemaRes] = await Promise.all([
    admin.from('service_categories').select('id,parent_id,tier,label_en,status,marketplace_hidden'),
    admin.from('canonical_service_taxonomy').select('canonical_service,folder_id,tile_id,marketplace_hidden'),
    admin.from('canonical_service_schemas').select('canonical_service,display_name_en'),
  ]);
  const cats = (catsRes.data ?? []) as CategoryRow[];
  const canon = (canonRes.data ?? []) as CanonRow[];
  const schemas = (schemaRes.data ?? []) as DisplayNameRow[];
  const isActive = (c: { status: string | null; marketplace_hidden: boolean | null }) =>
    c.status !== 'retired' && c.marketplace_hidden !== true;
  const catById = new Map(cats.map((c) => [c.id, c]));
  const displayName = new Map(schemas.map((s) => [s.canonical_service, s.display_name_en ?? '']));

  const out: LiveTrade[] = [];
  for (const cs of canon) {
    if (cs.marketplace_hidden === true || !cs.tile_id) continue;
    const tile = catById.get(cs.tile_id);
    if (!tile || tile.tier !== 2 || !isActive(tile)) continue;
    const folder = tile.parent_id ? catById.get(tile.parent_id) : null;
    if (!folder || folder.tier !== 1 || !isActive(folder)) continue;
    const label = (displayName.get(cs.canonical_service) || '').trim() || humanize(cs.canonical_service);
    out.push({ key: cs.canonical_service, label, branchLabel: tile.label_en, folderLabel: folder.label_en });
  }
  out.sort((a, b) => a.key.localeCompare(b.key));
  return out;
}

/**
 * Every category's own attribute schema — the raw material
 * `lib/trade-alias-miner.ts` mines. A minimal, separate query (not folded
 * into `fetchLiveTrades`'s existing `canonical_service_schemas` select)
 * because that query only ever asked for `display_name_en`; naming an
 * additional column there would be a second thing to keep in sync with
 * what THIS function actually needs.
 */
export async function fetchSchemaAttributeRows(admin: SupabaseClient): Promise<MinerSchemaRow[]> {
  const { data } = await admin.from('canonical_service_schemas').select('canonical_service,category_specific_attributes');
  return (data ?? []) as MinerSchemaRow[];
}
