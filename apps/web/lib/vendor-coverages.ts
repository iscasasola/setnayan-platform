import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Vendor coverage read layer (Vendor Services rework 2026-07-02).
 *
 * A coverage is a first-class row in `vendor_coverages` — a taxonomy leaf
 * (`canonical_service`, the ~201 grain) a vendor serves + the event types they
 * cater for it. The pick list (parent → branch → leaf) is read straight from
 * the admin-managed taxonomy tables so admin edits flow through with no deploy
 * ([[feedback_setnayan_categories_db_not_hardcoded]]).
 */

/** A vendor's declared coverage row. */
export type VendorCoverageRow = {
  id: number;
  public_id: string;
  canonical_service: string;
  event_types: string[];
  created_at: string;
};

export async function fetchVendorCoverages(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorCoverageRow[]> {
  const { data, error } = await supabase
    .from('vendor_coverages')
    .select('id,public_id,canonical_service,event_types,created_at')
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`fetchVendorCoverages failed: ${error.message}`);
  return (data ?? []) as VendorCoverageRow[];
}

// ── Coverage taxonomy tree (parent → branch → leaf) ─────────────────────────

export type CoverageLeaf = {
  canonicalService: string;
  label: string;
  /** Allowed event types (event_type_vocab keys); null = universal (all events). */
  allowedEventTypes: string[] | null;
};
export type CoverageBranch = { tileId: string; label: string; leaves: CoverageLeaf[] };
export type CoverageParent = { folderId: string; label: string; branches: CoverageBranch[] };

type CategoryRow = {
  id: string;
  parent_id: string | null;
  tier: number;
  label_en: string;
  sort_order: number;
  status: string | null;
  marketplace_hidden: boolean | null;
  applicable_event_types: string[] | null;
};
type CanonRow = {
  canonical_service: string;
  folder_id: string;
  tile_id: string | null;
  marketplace_hidden: boolean | null;
  applicable_event_types: string[] | null;
};
type SchemaRow = { canonical_service: string; display_name_en: string | null };

function humanize(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The live coverage pick list — parent (tier-1 folder) → branch (tier-2 tile)
 * → leaf (canonical_service). Leaves come from canonical_service_taxonomy
 * (placement) + canonical_service_schemas (display name). A leaf's allowed
 * event types = its own applicable_event_types override, else the tile's, else
 * null (universal). Retired / marketplace-hidden nodes are dropped; empty
 * branches/parents are pruned. Cached per request.
 */
export const getCoverageTaxonomy = cache(async (): Promise<CoverageParent[]> => {
  const supabase = await createClient();
  const [catsRes, canonRes, schemaRes] = await Promise.all([
    supabase
      .from('service_categories')
      .select('id,parent_id,tier,label_en,sort_order,status,marketplace_hidden,applicable_event_types')
      .order('sort_order', { ascending: true }),
    supabase
      .from('canonical_service_taxonomy')
      .select('canonical_service,folder_id,tile_id,marketplace_hidden,applicable_event_types'),
    supabase.from('canonical_service_schemas').select('canonical_service,display_name_en'),
  ]);
  const cats = (catsRes.data ?? []) as CategoryRow[];
  const canon = (canonRes.data ?? []) as CanonRow[];
  const schemas = (schemaRes.data ?? []) as SchemaRow[];
  if (!cats.length) return [];

  const isActive = (c: { status: string | null; marketplace_hidden: boolean | null }) =>
    c.status !== 'retired' && c.marketplace_hidden !== true;

  const parents = cats.filter((c) => c.tier === 1 && isActive(c));
  const tiles = cats.filter((c) => c.tier === 2 && isActive(c));
  const tileById = new Map(tiles.map((t) => [t.id, t]));
  const displayName = new Map(schemas.map((s) => [s.canonical_service, s.display_name_en ?? '']));

  const leavesByTile = new Map<string, CoverageLeaf[]>();
  for (const cs of canon) {
    if (cs.marketplace_hidden === true || !cs.tile_id) continue;
    const tile = tileById.get(cs.tile_id);
    if (!tile) continue; // parent tile retired/hidden → drop leaf
    const label = (displayName.get(cs.canonical_service) || '').trim() || humanize(cs.canonical_service);
    const allowedEventTypes =
      cs.applicable_event_types && cs.applicable_event_types.length
        ? cs.applicable_event_types
        : tile.applicable_event_types && tile.applicable_event_types.length
          ? tile.applicable_event_types
          : null;
    const arr = leavesByTile.get(cs.tile_id) ?? [];
    arr.push({ canonicalService: cs.canonical_service, label, allowedEventTypes });
    leavesByTile.set(cs.tile_id, arr);
  }
  for (const arr of leavesByTile.values()) arr.sort((a, b) => a.label.localeCompare(b.label));

  const out: CoverageParent[] = [];
  for (const p of parents) {
    const branches: CoverageBranch[] = [];
    for (const t of tiles.filter((x) => x.parent_id === p.id)) {
      const leaves = leavesByTile.get(t.id) ?? [];
      if (!leaves.length) continue;
      branches.push({ tileId: t.id, label: t.label_en, leaves });
    }
    if (!branches.length) continue;
    out.push({ folderId: p.id, label: p.label_en, branches });
  }
  return out;
});

/** Flat lookup of a canonical_service → its labels + parent/branch path. */
export type CoverageLabels = {
  leafLabel: (canonicalService: string) => string;
  pathLabel: (canonicalService: string) => string; // "Parent › Branch › Leaf"
  allowedEventTypes: (canonicalService: string) => string[] | null;
};

export async function resolveCoverageLabels(): Promise<CoverageLabels> {
  const tree = await getCoverageTaxonomy();
  const byLeaf = new Map<
    string,
    { leaf: string; branch: string; parent: string; allowed: string[] | null }
  >();
  for (const p of tree)
    for (const b of p.branches)
      for (const l of b.leaves)
        byLeaf.set(l.canonicalService, {
          leaf: l.label,
          branch: b.label,
          parent: p.label,
          allowed: l.allowedEventTypes,
        });
  return {
    leafLabel: (cs) => byLeaf.get(cs)?.leaf ?? humanize(cs),
    pathLabel: (cs) => {
      const e = byLeaf.get(cs);
      return e ? `${e.parent} › ${e.branch} › ${e.leaf}` : humanize(cs);
    },
    allowedEventTypes: (cs) => byLeaf.get(cs)?.allowed ?? null,
  };
}
