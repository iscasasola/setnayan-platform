import type { SupabaseClient } from '@supabase/supabase-js';
import { VENDOR_CATEGORIES } from '@/lib/vendors';
import { buildLeafIndex } from '@/lib/service-card-kind';
import { parentsOfKind } from '@/lib/vendor-category-parents';
import type { CoverageParent } from '@/lib/vendor-coverages';

/**
 * vendor-coverage-write.ts — THE ONE BODY that adds a coverage ("what you do") and keeps Explore in step.
 *
 * Two doors call it:
 *   · `createCoverage` (services/coverage-actions.ts) — the Coverage panel's form, which redirects;
 *   · `addCoverageForCard` (same file) — the maker's 🏷 question (owner 2026-10-14, DECISION_LOG "A CARD IN A NEW
 *     CATEGORY ASKS ONCE, THEN ADDS IT TO THE SUPPLIER'S LISTING"): "Add <kind> to what you do? Couples will find
 *     you there." → Yes. It answers in place, so the card being made is never thrown away.
 *
 * 🔑 IT IS ITS OWN CALL, NEVER A SIDE EFFECT OF SAVING A CARD. `commitVendorService` does not write
 * `vendor_coverages` or `vendor_profiles.services` — the supplier is asked, and only a Yes reaches this file
 * (guarded by tests/db/a-card-asks-before-it-adds-what-you-do.db.test.ts).
 *
 * Plain functions over an injected client and an injected taxonomy tree, so the db test calls the REAL write against
 * the replayed schema rather than re-stating it.
 */

/**
 * Coverage is the SOURCE that drives Explore (owner-locked 2026-07-02). On every coverage write, recompute the vendor
 * profile from its coverages:
 *   • event_types = union across coverages (never empty → ['wedding']); drives the Explore ?event_type= filter;
 *   • services[] = the vendor's coarse profile categories PRESERVED + the covered canonical_service keys. Explore
 *     matches canonical keys directly, so writing coverage canonicals here makes coverage drive category/tile
 *     discovery with no Explore change. Coarse entries (VENDOR_CATEGORIES) are preserved; only the canonical portion
 *     is recomputed, so removing a coverage correctly drops its leaf from discovery.
 *
 * Moved here verbatim from services/coverage-actions.ts (2026-10-14) so both doors run the same sync.
 */
export async function syncProfileFromCoverages(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<void> {
  const { data: covs } = await supabase
    .from('vendor_coverages')
    .select('canonical_service,event_types')
    .eq('vendor_profile_id', vendorProfileId);
  const coverages = (covs ?? []) as {
    canonical_service: string;
    event_types: string[] | null;
  }[];

  const evUnion = new Set<string>();
  for (const c of coverages) for (const e of c.event_types ?? []) evUnion.add(e);
  const event_types = evUnion.size > 0 ? Array.from(evUnion) : ['wedding'];

  const coarse = new Set<string>(VENDOR_CATEGORIES);
  const { data: prof } = await supabase
    .from('vendor_profiles')
    .select('services')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const preservedCoarse = (
    (prof as { services: string[] | null } | null)?.services ?? []
  ).filter((s) => coarse.has(s));
  const coveredCanon = coverages.map((c) => c.canonical_service);
  const services = Array.from(new Set([...preservedCoarse, ...coveredCanon]));

  const { error: syncError } = await supabase
    .from('vendor_profiles')
    .update({ event_types, services })
    .eq('vendor_profile_id', vendorProfileId);
  // The coverage row is already written; a failed profile sync only delays where couples find the shop until the
  // next coverage change re-syncs it — logged, never thrown over the supplier's save.
  if (syncError) console.error('[supabase-error] lib/vendor-coverage-write.ts · from:vendor_profiles.update', syncError);
}

export type InsertCoverageResult =
  | { status: 'added'; coverageId: number | null }
  | { status: 'already' }
  | { status: 'error'; message: string };

/**
 * Insert one coverage row and re-sync the profile. `23505` (the shop already covers that leaf) is its own answer,
 * never an error the supplier has to read.
 */
export async function insertCoverage(
  supabase: SupabaseClient,
  vendorProfileId: string,
  row: { canonicalService: string; eventTypes: string[]; faiths: string[] },
): Promise<InsertCoverageResult> {
  const { data, error } = await supabase
    .from('vendor_coverages')
    .insert({
      vendor_profile_id: vendorProfileId,
      canonical_service: row.canonicalService,
      event_types: row.eventTypes,
      faiths: row.faiths,
    })
    .select('id')
    .maybeSingle();
  if (error) {
    if (error.code === '23505') return { status: 'already' };
    return { status: 'error', message: error.message };
  }
  await syncProfileFromCoverages(supabase, vendorProfileId);
  const id = (data as { id?: number | string | null } | null)?.id;
  return { status: 'added', coverageId: id == null ? null : Number(id) };
}

export type AddCoverageForCardResult =
  | { status: 'added'; coverageId: number | null }
  | { status: 'already' }
  /** The plan's family cap would be passed — the card still saves; the supplier is shown the plan option. */
  | { status: 'over_cap'; cap: number; why: string }
  | { status: 'error'; message: string };

/**
 * 🏷 Yes → add the leaf to "what you do", WITHIN THE PLAN'S FAMILY CAP.
 *
 * The cap counts the same families `commitVendorService` and the kind sheet count — the shop's cards' families ∪ its
 * coverages' families (`parentsOfKind` + the tree's folders) — so a leaf in a family the shop already works in is
 * always allowed, and a leaf that would open one family too many is refused with the plan sentence. `Infinity`
 * (Enterprise · founder) never refuses.
 */
export async function addCoverageForCardKind(
  supabase: SupabaseClient,
  vendorProfileId: string,
  input: {
    leaf: string;
    tree: readonly CoverageParent[];
    parentCategories: number;
    eventTypes: string[];
  },
): Promise<AddCoverageForCardResult> {
  const leaves = buildLeafIndex(input.tree as CoverageParent[]);
  const family = leaves.folder.get(input.leaf) ?? null;

  if (input.parentCategories !== Infinity && family) {
    const [{ data: cardRows, error: cardErr }, { data: covRows, error: covErr }] = await Promise.all([
      supabase.from('vendor_services').select('category').eq('vendor_profile_id', vendorProfileId),
      supabase.from('vendor_coverages').select('canonical_service').eq('vendor_profile_id', vendorProfileId),
    ]);
    // ⚠ An unreadable shop is not an empty one — a count read off nothing would let any family through.
    if (cardErr || covErr) {
      return { status: 'error', message: 'We could not check your plan just now, so nothing was added. Try again.' };
    }
    const families = new Set<string>();
    for (const r of (cardRows ?? []) as { category: string }[])
      for (const f of parentsOfKind(r.category, leaves)) families.add(f);
    for (const r of (covRows ?? []) as { canonical_service: string }[]) {
      const f = leaves.folder.get(r.canonical_service);
      if (f) families.add(f);
    }
    if (!families.has(family) && families.size + 1 > input.parentCategories) {
      return {
        status: 'over_cap',
        cap: input.parentCategories,
        why:
          input.parentCategories === 1
            ? 'Your plan covers one kind of business.'
            : `Your plan covers ${input.parentCategories} kinds of business.`,
      };
    }
  }

  return insertCoverage(supabase, vendorProfileId, {
    canonicalService: input.leaf,
    eventTypes: input.eventTypes,
    faiths: [],
  });
}
