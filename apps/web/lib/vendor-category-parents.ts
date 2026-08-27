import type { SupabaseClient } from '@supabase/supabase-js';

import { tilesForVendorCategory } from '@/lib/vendor-category-taxonomy';
import { getCoverageTaxonomy } from '@/lib/vendor-coverages';
import { TILE_PARENT } from '@/lib/taxonomy';
import type { VendorCategory } from '@/lib/vendors';

/**
 * vendor-category-parents.ts — WHICH KINDS OF SERVICE THIS SHOP MAY ACTUALLY LIST.
 *
 * 🔴 WHY THIS MOVED OUT OF THE SAVE ACTION (owner 2026-08-28). He looked at the
 * ~34 kinds the maker offers and asked: *"so many categories? should the choices
 * be only for the service we actually cover and not all?"*
 *
 * Measured on his own shop before answering, and it is worse than clutter. The
 * save has always enforced two caps — how many cards fit in one kind, and how
 * many FAMILIES of kinds a plan covers — and it enforces them **after the card
 * is authored**, as a redirect carrying an error string. So a supplier picked a
 * kind their plan cannot hold, wrote the card, uploaded the photo, pressed
 * Publish, and was bounced to another page with their work gone and a sentence
 * about upgrading. **Most of the choices on that screen were refusals waiting to
 * happen.**
 *
 * 🔑 SO THE RULE IS ANSWERED IN ONE PLACE AND ASKED TWICE. The chooser now asks
 * the SAME functions the save uses, before a minute of work is spent, instead of
 * a second copy of the rule drawn from memory — two copies of a permission rule
 * always drift, and the copy on the screen would have been the optimistic one.
 *
 * ⚖ NARROWED, NEVER HIDDEN. A shop legitimately grows (a photographer adding a
 * photo booth), so nothing is removed from the list: what they cover leads, what
 * their plan still allows follows, and what would need a bigger plan is shown
 * greyed with the reason. A chooser that silently dropped kinds would read as
 * "Setnayan does not do that".
 */

/**
 * The tier-1 FAMILY (or families) a kind of service files under.
 *
 * Routes through the vendor→canonical bridge (NOT TAXONOMY_MAP, which is keyed
 * by v11 canonicals the legacy VendorCategory enum doesn't match). Exempt kinds
 * (officiant / church fees / security / miscellaneous) return [] and never count
 * against the cap — so they are always offerable.
 */
export function parentsOfCategory(category: VendorCategory): string[] {
  return tilesForVendorCategory(category)
    .map((tile) => TILE_PARENT[tile] as string)
    .filter(Boolean);
}

/**
 * The tier-1 families already claimed by the shop's COVERAGES, resolved
 * canonical_service → folder via the live taxonomy tree.
 *
 * Coverage is the source of truth for what a vendor offers (owner-locked
 * 2026-07-02, "coverage drives Explore"), so the family cap counts coverage
 * families alongside the legacy `vendor_services.category` ones — otherwise a
 * coverage-first vendor rides past the cap, or a card under an already-covered
 * family is wrongly blocked. FAIL-SOFT: any read error returns [] → the count
 * degrades to services-only rather than blocking an honest save.
 */
export async function coverageParents(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<string[]> {
  try {
    const [{ data: covs }, tree] = await Promise.all([
      supabase
        .from('vendor_coverages')
        .select('canonical_service')
        .eq('vendor_profile_id', vendorProfileId),
      getCoverageTaxonomy(),
    ]);
    const covered = new Set(
      ((covs ?? []) as { canonical_service: string }[]).map((r) => r.canonical_service),
    );
    if (covered.size === 0) return [];
    const parents = new Set<string>();
    for (const p of tree)
      for (const b of p.branches)
        for (const l of b.leaves)
          if (covered.has(l.canonicalService)) parents.add(p.folderId);
    return Array.from(parents);
  } catch {
    return []; // fail-soft → legacy services-only counting
  }
}

/** What the chooser needs to know about one kind of service. */
export type CategoryStanding =
  /** Inside a family this shop already works in — offer it first. */
  | { standing: 'covered' }
  /** New family, and the plan still has room for it. */
  | { standing: 'open' }
  /** The plan has no room for another family, or this kind is full. */
  | { standing: 'locked'; why: string };

/**
 * Would a card in this kind be accepted, asked BEFORE the work rather than
 * after it? The two refusals mirror `commitVendorService` exactly — one full
 * kind, one family beyond the plan — and the wording is the vendor-facing half
 * of the same sentence the save would have redirected with.
 *
 * ⚠ FAILS OPEN BY CONSTRUCTION. `Infinity` caps and an empty parent list both
 * land on 'open'/'covered'; a shop whose coverage could not be read simply sees
 * everything offered and meets the save's own gate as before. Never the reverse:
 * a read failure must not delete a kind a supplier is entitled to sell.
 */
export function standingForCategory(
  category: VendorCategory,
  ctx: {
    /** Families already claimed by this shop's cards ∪ coverages. */
    existingParents: ReadonlySet<string>;
    /** How many cards this shop already has in each kind. */
    cardsByCategory: Readonly<Record<string, number>>;
    parentCategories: number;
    servicesPerLeaf: number;
  },
): CategoryStanding {
  const inKind = ctx.cardsByCategory[category] ?? 0;
  if (ctx.servicesPerLeaf !== Infinity && inKind >= ctx.servicesPerLeaf) {
    return {
      standing: 'locked',
      why: `You already have ${inKind} here — your plan allows ${ctx.servicesPerLeaf}.`,
    };
  }
  const parents = parentsOfCategory(category);
  // No family at all (officiant, church fees, security, miscellaneous) — never
  // counted, so never refused.
  if (parents.length === 0) return { standing: 'open' };
  const alreadyIn = parents.some((p) => ctx.existingParents.has(p));
  if (alreadyIn) return { standing: 'covered' };
  if (ctx.parentCategories === Infinity) return { standing: 'open' };
  const wouldBe = new Set(ctx.existingParents);
  parents.forEach((p) => wouldBe.add(p));
  if (wouldBe.size > ctx.parentCategories) {
    return {
      standing: 'locked',
      why:
        ctx.parentCategories === 1
          ? 'Your plan covers one kind of business. Upgrade to list under another.'
          : `Your plan covers ${ctx.parentCategories} kinds of business. Upgrade to list under another.`,
    };
  }
  return { standing: 'open' };
}
