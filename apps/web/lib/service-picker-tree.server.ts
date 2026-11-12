import 'server-only';

import { getOpenShopServiceTree } from '@/lib/open-shop-service-tree';
import { reviewedAliasesByLiveTrade } from '@/lib/service-trade-aliases';
import { getReviewedTradeAliasRows } from '@/lib/service-trade-aliases-db';
import { getServiceMergeForwards } from '@/lib/service-merge-forward-db';
import { getTaxonomy } from '@/lib/taxonomy-db';
import { displayUrlForCatalogueArt } from '@/lib/uploads';
import type { PickerParentView } from '@/app/_components/service-picker';

/**
 * THE ADD-A-SERVICE PICKER'S TREE — read ONCE, for every door that draws the picker (ruling 5820, owner Nov 2026: ONE
 * Add-a-service picker). `/open-shop` built this inline; the dashboard's "Add a service" now draws the same picker, so
 * the read moved here unchanged and both pages call it — two pages can never offer two different trees.
 *
 *   · the parent → category → service tree, first-party Setnayan SKUs stripped (`getOpenShopServiceTree`);
 *   · 🔤 each service's reviewed aliases — the SAME words Explore and the card maker search by
 *     (`reviewedAliasesByLiveTrade`, merge-forwards applied);
 *   · 🖼 each category's photo (`service_categories.sample_photo_r2_key`, resolved the way Explore resolves it) and its
 *     ⓘ (`hint_en`, Admin › Categories "ⓘ text"), through the taxonomy snapshot.
 *
 * Fail-soft at every read, exactly as it was on the page: no tree = `[]` (the wizard falls back to its flat select), no
 * aliases = plain search, no photo = the plain tile, no hint = no ⓘ. Never a blocked page.
 */
export async function getServicePickerTree(): Promise<PickerParentView[]> {
  const bareTree = await getOpenShopServiceTree().catch(() => []);
  const [aliasRows, mergeForwards, tax] = await Promise.all([
    getReviewedTradeAliasRows().catch(() => []),
    getServiceMergeForwards().catch(() => ({})),
    getTaxonomy().catch(() => null),
  ]);
  const aliasesByLeaf = reviewedAliasesByLiveTrade(
    aliasRows,
    mergeForwards,
    new Set(bareTree.flatMap((p) => p.branches.flatMap((b) => b.leaves.map((l) => l.canonicalService)))),
  );
  const photoOf = new Map<string, string | null>(
    await Promise.all(
      bareTree.flatMap((p) => p.branches).map(async (b) => {
        const ref = tax?.categoryPhotos[b.tileId] ?? null;
        const url = ref ? await displayUrlForCatalogueArt(ref).catch(() => null) : null;
        return [b.tileId, url] as const;
      }),
    ),
  );
  return bareTree.map((p) => ({
    ...p,
    branches: p.branches.map((b) => ({
      ...b,
      photoUrl: photoOf.get(b.tileId) ?? null,
      hint: tax?.categoryHints?.[b.tileId] ?? null,
      leaves: b.leaves.map((l) => ({ ...l, aliases: aliasesByLeaf.get(l.canonicalService) })),
    })),
  }));
}
