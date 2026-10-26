/**
 * lib/inspiration-parts-seed.ts — TODAY'S INSPIRATION PARTS, READ OFF THE CONSTS, AS TABLE ROWS
 * (PLAN `prototypes/admin_inspiration_groups_2026-10-25/PLAN.md` § 1, owner-approved 2026-10-26).
 *
 * `public.inspiration_parts` + `public.inspiration_part_categories` (migration
 * `20271287668170_inspiration_parts_on_the_taxonomy.sql`) are seeded from exactly this function, by
 * `scripts/gen-inspiration-parts-seed.ts`. `tests/db/inspiration-parts-seed-equals-the-consts.db.test.ts`
 * re-reads the consts on its own and holds the replayed rows equal to them, so the table and the consts
 * cannot differ while the consts exist.
 *
 * THE RULES (each a reading of a const, nothing invented):
 *   · one row per key of `MOODBOARD_SLOT_KEYS` — photos keep their keys, verbatim;
 *   · `label_en` = the name a supplier reads today (`libraryPartLabel`: the couple's part name where the
 *     couple's Studio draws the part, else the shelf name). `palette` has no shelf name (it is nobody's
 *     portfolio), so it is called "Palette";
 *   · `home_category_id` = the FIRST tile of `MOODBOARD_SLOT_TRADES[key]` — that map's own docblock: "the
 *     first tile a shop matches is the one printed on the credit"; the remaining tiles, in order, are the
 *     "also from" rows;
 *   · `palette` → `kind = 'system'`, no home, hidden; `flowers` (the legacy every-flower board,
 *     `LEGACY_PALETTE_BOARDS`, never offered for a new photo) → hidden, home `florist`;
 *   · order = `libraryPhotoParts()` (the couple's Palette parts, then the Attire boards), then the older
 *     shelves in `MOODBOARD_SLOT_KEYS` order (the supplier's "More boards"), then `palette` last.
 *
 * Server-side: it reaches the slot → trade map, which reaches the taxonomy.
 */
import { MOODBOARD_SLOT_KEYS, type MoodboardSlotKey } from './moodboard-slots';
import { MOODBOARD_SLOT_TRADES } from './moodboard-gallery';
import { libraryPartLabel } from './moodboard-gallery-upload';
import { LEGACY_PALETTE_BOARDS, libraryPhotoParts } from './inspiration-slots';

export type InspirationPartSeedRow = {
  slotKey: MoodboardSlotKey;
  label: string;
  kind: 'part' | 'system';
  homeCategoryId: string | null;
  alsoCategoryIds: string[];
  sortOrder: number;
  hidden: boolean;
};

/** The one key with no supplying trade — a colour reference is nobody's portfolio. */
export const SYSTEM_PART_KEYS: readonly MoodboardSlotKey[] = ['palette'];
const SYSTEM_PART_LABEL: Readonly<Record<string, string>> = { palette: 'Palette' };

export function inspirationPartsSeed(): InspirationPartSeedRow[] {
  const order: MoodboardSlotKey[] = [];
  for (const p of libraryPhotoParts()) if (!order.includes(p.key)) order.push(p.key);
  for (const k of MOODBOARD_SLOT_KEYS) if (!order.includes(k) && !SYSTEM_PART_KEYS.includes(k)) order.push(k);
  for (const k of SYSTEM_PART_KEYS) order.push(k);
  if (order.length !== MOODBOARD_SLOT_KEYS.length) throw new Error('inspiration parts seed: the order lost or doubled a key');

  return order.map((slotKey, i) => {
    const system = SYSTEM_PART_KEYS.includes(slotKey);
    const [home, ...also] = MOODBOARD_SLOT_TRADES[slotKey];
    const label = system ? SYSTEM_PART_LABEL[slotKey] : libraryPartLabel(slotKey);
    if (!label) throw new Error(`inspiration parts seed: ${slotKey} has no name`);
    if (!system && !home) throw new Error(`inspiration parts seed: ${slotKey} has no supplying trade`);
    return {
      slotKey,
      label,
      kind: system ? 'system' : 'part',
      homeCategoryId: system ? null : (home ?? null),
      alsoCategoryIds: system ? [] : [...also],
      sortOrder: (i + 1) * 10,
      hidden: system || LEGACY_PALETTE_BOARDS.includes(slotKey),
    };
  });
}
