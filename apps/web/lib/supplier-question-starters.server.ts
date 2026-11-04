import 'server-only';

import { getTaxonomy } from '@/lib/taxonomy-db';
import { startersForTiles, type StarterQuestion } from '@/lib/emcee-questions';

/**
 * ❓ A SHOP'S STARTING QUESTIONS, BY ITS TRADE (owner 2026-11-04, "Yes, every supplier").
 *
 * The shop's `services` are canonical service keys; the TILE each one sits under comes from the LIVE taxonomy
 * (`getTaxonomy()` — Admin › Categories is the one source, owner 2026-10-26 "foundation of all suppliers"). No copy of
 * the taxonomy lives here: an admin who moves a service to another tile moves its starting questions with it.
 * Which set a tile starts from is `STARTERS_BY_TILE` (`lib/emcee-questions.ts`); a tile not named there gets the
 * generic set.
 */
export async function startersForShopServices(
  services: readonly string[] | null | undefined,
): Promise<StarterQuestion[]> {
  const tax = await getTaxonomy();
  const tiles = (services ?? []).map((s) => tax.map[s]?.tile ?? null);
  return startersForTiles(tiles);
}
