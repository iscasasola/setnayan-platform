import 'server-only';

import { getCoverageTaxonomy, type CoverageParent } from '@/lib/vendor-coverages';
import {
  isFirstPartyService,
  type PickerBranch,
  type PickerLeaf,
  type PickerParent,
} from '@/lib/open-shop-service-vocab';

export * from '@/lib/open-shop-service-vocab';

/**
 * The parent → branch → leaf tree the /open-shop picker offers, and the resolver
 * that turns a posted leaf back into something storable.
 *
 * Owner 2026-08-09: *"primary service must branch from parent category until it
 * reaches leaf category."*
 *
 * ── 🔴 WHY THIS IS NOT JUST `getCoverageTaxonomy()` ──────────────────────────
 * NINE FIRST-PARTY SETNAYAN SKUs ARE ORDINARY MARKETPLACE-VISIBLE LEAVES IN THAT
 * TREE, sitting beside the real trades — verified in production 2026-08-09:
 *
 *   setnayan_papic · setnayan_ai_edited_highlight · setnayan_save_the_date_mp4
 *     → Documentary › Photo & Video   (next to `photography`)
 *   setnayan_panood        → Documentary › Livestream
 *   setnayan_patiktok      → Booths     › Photo Booth
 *   setnayan_concierge     → Planning   › Coordinator / Planner
 *   setnayan_pakanta · setnayan_pailaw · setnayan_custom_monogram
 *     → Design › Digital Services
 *
 * `vendor_market_stats` computes `is_setnayan_service` by array-membership of
 * `vendor_profiles.services` against exactly those keys (migration
 * `20270331400000`), and `/explore` excludes any row where it is true. So a
 * vendor who drills into Photo & Video, taps "Setnayan · Papic", finishes
 * onboarding and gets verified would **never appear in the marketplace** — no
 * error, no log, nothing to notice. The same silent-refusal family as the
 * phantom column, the phantom enum value and the phantom RPC argument.
 *
 * ⚠ IT WOULD BE A REGRESSION INTRODUCED BY THE PICKER, NOT A PRE-EXISTING BUG.
 * Today's flat `<select>` is built from `SERVICE_GROUPS`, whose members are
 * coarse categories only — it CANNOT express a first-party key. Opening the raw
 * tree is what would make the mistake reachable. So the filter ships WITH the
 * picker, in the same change, and is pinned by
 * `open-shop-service-tree.test.ts`.
 */

/**
 * The tree the vendor drills. Same source and pruning as the coverage editor's
 * (retired / marketplace-hidden nodes already dropped upstream), minus the
 * first-party SKUs, with branches and parents that end up empty pruned again —
 * an empty branch is a dead tap.
 */
export async function getOpenShopServiceTree(): Promise<PickerParent[]> {
  let tree: CoverageParent[] = [];
  try {
    tree = await getCoverageTaxonomy();
  } catch {
    // Fail-soft: the wizard falls back to its flat select rather than blocking
    // a vendor from opening a shop because one read hiccuped.
    return [];
  }

  const out: PickerParent[] = [];
  for (const parent of tree) {
    const branches: PickerBranch[] = [];
    for (const branch of parent.branches) {
      const leaves: PickerLeaf[] = branch.leaves
        .filter((l) => !isFirstPartyService(l.canonicalService))
        .map((l) => ({
          canonicalService: l.canonicalService,
          label: l.label,
          tileId: branch.tileId,
          allowedEventTypes: l.allowedEventTypes,
        }));
      if (leaves.length === 0) continue;
      branches.push({ tileId: branch.tileId, label: branch.label, leaves });
    }
    if (branches.length === 0) continue;
    out.push({ folderId: parent.folderId, label: parent.label, branches });
  }
  return out;
}

/**
 * Resolve a posted leaf key against the SAME tree the picker offered.
 *
 * 🔑 THE SERVER RE-RESOLVES; IT NEVER TRUSTS THE POST. The form also carries a
 * hidden tile id for the client's convenience, and a hand-rolled POST could send
 * a first-party key, a retired leaf, or a leaf paired with someone else's branch.
 * Looking the key up in the filtered tree makes all three impossible: an
 * unresolvable leaf is simply rejected, and the tile used for the category
 * lookup is the one the TREE says, not the one the form said.
 */
export async function resolvePickedLeaf(
  canonicalService: string,
): Promise<PickerLeaf | null> {
  if (!canonicalService) return null;
  const tree = await getOpenShopServiceTree();
  for (const parent of tree) {
    for (const branch of parent.branches) {
      const hit = branch.leaves.find((l) => l.canonicalService === canonicalService);
      if (hit) return hit;
    }
  }
  return null;
}
