/**
 * taxonomy-folder-counts.ts — how many services live in a folder, ONCE.
 *
 * ─── WHY THIS FILE EXISTS ────────────────────────────────────────────────
 * This number was computed privately inside `app/explore/page.tsx` and shown
 * to a customer in the search panel ("in Photo & video · 12 services"). The
 * front door shows the SAME number beside the SAME folder in its rail. Two
 * copies of one count is exactly the shape this project has been bitten by
 * before — two hand-typed things that agree until the day they don't, with
 * nothing able to tell you which one is wrong.
 *
 * So the count is derived here, from `TAXONOMY_MAP`, and both surfaces import
 * it. Adding a service to the taxonomy moves both numbers or neither.
 *
 * 🔑 THE FILTER IS THE DEFINITION, and it is not obvious:
 *   • `marketplaceHidden` — officiants / paperwork. The key stays in the map
 *     so admin + lookup resolve it, but the marketplace never renders it, so
 *     counting it would promise a customer a service they cannot browse.
 *   • `setnayan` — our OWN first-party SKUs (Papic, Live Studio …). They are
 *     rendered as options, never as a supplier you can hire, and counting them
 *     would inflate a folder with things no shop provides.
 *
 * Both exclusions were already in the shipped explore computation; this file
 * is a move, not a new rule. Verified 2026-08-13 against the 15 counts in
 * `FRONT_DOOR_AND_SEAM_FINAL_2026-08-12.md` § 1 — all 15 match exactly
 * (236 countable services of 276 taxonomy entries), and
 * `taxonomy-folder-counts.test.ts` pins that so a taxonomy edit that silently
 * changes what a customer is promised has to be looked at.
 */
import {
  TAXONOMY_MAP,
  type WeddingFolder,
  WEDDING_FOLDER_ORDER,
} from './taxonomy';

/**
 * Services a customer can actually browse, per folder. Derived at module load
 * from the shipped taxonomy — never hand-typed.
 */
export const FOLDER_SERVICE_COUNT: Record<string, number> = Object.values(
  TAXONOMY_MAP,
).reduce<Record<string, number>>((acc, meta) => {
  if (meta.marketplaceHidden || meta.setnayan) return acc;
  acc[meta.folder] = (acc[meta.folder] ?? 0) + 1;
  return acc;
}, {});

/** Count for one folder. 0 for a folder with nothing countable in it. */
export function folderServiceCount(folder: WeddingFolder): number {
  return FOLDER_SERVICE_COUNT[folder] ?? 0;
}

/**
 * The five folders the front door shows before "Show more".
 *
 * ⚠ THIS IS DELIBERATELY NOT THE FIVE BIGGEST, and the reasoning is the
 * design's, not a preference (`FRONT_DOOR_AND_SEAM_FINAL_2026-08-12.md` § 1):
 * the service count says how finely we chopped a folder up, not how much
 * anyone wants it. Booths has 42 entries because there are 42 kinds of cart;
 * catering has 7 because catering is one thing and everybody buys it. Ranking
 * by count would put photo booths above the food and the church.
 *
 * So these five are ranked by what a couple books first and spends most on —
 * the place, the food, the photos, what everyone wears, and who runs the
 * night. Booths sitting immediately under "Show more" is correct: it is the
 * fun, late, optional spend.
 */
export const FRONT_DOOR_VISIBLE_FOLDERS: ReadonlyArray<WeddingFolder> = [
  'venue',
  'feast',
  'documentary',
  'look',
  'program',
];

/** Everything else, in the taxonomy's own order — revealed by "Show more". */
export const FRONT_DOOR_MORE_FOLDERS: ReadonlyArray<WeddingFolder> =
  WEDDING_FOLDER_ORDER.filter((f) => !FRONT_DOOR_VISIBLE_FOLDERS.includes(f));
