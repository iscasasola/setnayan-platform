import { VENDOR_CATEGORIES } from '@/lib/vendors';
import { vendorCategoryForLeaf } from '@/lib/vendor-packages';
import type { CoarseCategorySource } from '@/lib/vendor-branch-category';

/**
 * 🔢 HOW MANY CATEGORIES A SHOP RUNS — counted the way sign-up counts them (walk 13 Nov 2026, F-W1-03).
 *
 * Sign-up's meter (`lib/open-shop-more-services.ts`, `servicesPerCategory`) counts the TIER-2 CATEGORY of each picked
 * service — the picker branch, the leaf's `tile`. `vendor_profiles.services[]` is not a list of categories: opening a
 * shop writes the COARSE key AND the picked leaf for the main service (`app/open-shop/actions.ts`, "BOTH the coarse
 * category and the specific leaf go in"), so one pick is two entries. Today's "Services covered" row printed
 * `services.length` — "2 categories" for the one category sign-up had just said.
 *
 * So: every leaf counts its tile once; a bare coarse key counts only when no leaf on the list already files under it
 * (a shop opened through the flat fallback select holds the coarse key alone). Pure — no database.
 */
const COARSE: ReadonlySet<string> = new Set(VENDOR_CATEGORIES);

export function shopCategoryCount(
  services: readonly string[],
  tax: CoarseCategorySource & { map: Readonly<Record<string, { tile?: string | null } | undefined>> },
): number {
  const tiles = new Set<string>();
  const coarseOfLeaves = new Set<string>();
  const bareCoarse = new Set<string>();
  for (const raw of services) {
    const s = raw?.trim();
    if (!s) continue;
    if (COARSE.has(s)) {
      bareCoarse.add(s);
      continue;
    }
    const tile = tax.map[s]?.tile ?? null;
    tiles.add(tile ?? s);
    coarseOfLeaves.add(vendorCategoryForLeaf(s, tile, tax));
  }
  let extra = 0;
  for (const c of bareCoarse) if (!coarseOfLeaves.has(c)) extra += 1;
  return tiles.size + extra;
}
