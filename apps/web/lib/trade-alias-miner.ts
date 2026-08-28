/**
 * trade-alias-miner.ts — WORDS WE ALREADY WROTE, NOT WORDS A MODEL GUESSES.
 *
 * 🛑 CORRECTED 2026-08-28, OWNER: *"when we do not have data yet, do not
 * recommend. collect first."* then *"initially, we already have a target
 * service for each category. that is our initial data."* — the alias list
 * no longer asks Claude for synonyms (`scripts/seed-trade-aliases.ts` used
 * to). It MINES them, deterministically, from
 * `canonical_service_schemas.category_specific_attributes` — the enum /
 * multi_select option VALUES every category's own attribute schema already
 * carries. No model call, no network, no key required.
 *
 * WHY OPTIONS AND NOT LABELS. `photo_booth.booth_types.options` reads
 * `["traditional_photo_booth","360_booth","gif_booth","polaroid_instax",
 * "selfie_magic_mirror","patiktok_tiktok_booth"]` — each one a real trade
 * synonym once de-slugged. A field's `label` ("Sound engineer included") is
 * a QUESTION, not a search word; mining labels too would flood the table
 * with sentence fragments nobody types. Measured against production
 * 2026-08-28: 829 attribute fields exist, but only 252 of them carry an
 * `options` array at all — those 252 fields hold exactly 1,539 option
 * values (1,248 distinct) across 153 of the 276 categories. 107 categories
 * have no attributes at all yet (`category_specific_attributes = '{}'`) —
 * mining is uneven by construction; that is the real shape of the data
 * today, not a defect in this file.
 *
 * NOT EVERY OPTION VALUE IS A USABLE WORD — TWO FILTERS, BOTH COUNTED:
 *
 *   1. GENERIC_DESCRIPTORS — a fixed, named stoplist of size / degree /
 *      boolean-ish adjectives that describe almost anything and identify
 *      no trade at all: `footprint_size` on `photo_booth` alone yields
 *      "mini", "small", "medium", "large" — as a search word any of those
 *      would sit on dozens of unrelated categories' option lists too and
 *      turn the search box into noise. This is a STATED list, not a
 *      per-word judgement call, so it is auditable and cheap to extend.
 *
 *   2. OVER-SHARED WORDS — a word appearing as an option under MANY
 *      unrelated categories is describing the SHAPE of a question, not one
 *      trade: "english" / "tagalog" appear as language options on 15
 *      categories each (officiants, emcees, singers, card designers…),
 *      "both" appears on 10 (a yes/both toggle, not a trade). Measured:
 *      the real distribution has a clean gap between 5 and 10 categories —
 *      1,063 of 1,248 distinct words appear under exactly ONE category,
 *      and only 5 distinct words sit at 6 or more. `MAX_SHARED_CATEGORIES`
 *      is set at that gap. This does NOT catch a word that is
 *      legitimately shared by a small, related CLUSTER of trades —
 *      "silk" / "jusi" / "pina" each sit on exactly the 4 barong/
 *      filipiniana categories, correctly kept: distinctive to a family,
 *      not generic across the whole taxonomy.
 *
 * Both filters are pure and counted — `mineTradeAliases` returns exactly
 * how many words each one dropped, so the offline script can print it and
 * the PR can say honestly how the number was reached.
 */

export type AttributeFieldLike = {
  options?: readonly string[];
};

/** One category's raw schema slice — only the part this file reads. */
export type SchemaRow = {
  canonical_service: string;
  category_specific_attributes: Record<string, AttributeFieldLike> | null;
};

/**
 * Generic size / degree / boolean-ish descriptors — not a trade word in any
 * vertical. Stated once, here, so a reviewer can see exactly what this
 * drops without reading the frequency math. Deliberately short: this is
 * the "ship the mechanism" cut, not a hand-tuned exhaustive list — extend
 * it if a real mined word turns out to need it.
 */
export const GENERIC_DESCRIPTORS: ReadonlySet<string> = new Set([
  'small', 'medium', 'large', 'mini', 'tiny', 'big', 'grand',
  'standard', 'basic', 'plain', 'simple', 'classic', 'modern', 'custom',
  'both', 'mixed', 'other', 'none', 'yes', 'no',
  'low', 'high', 'short', 'long', 'wide', 'narrow',
  'regular', 'default', 'various', 'multiple', 'single', 'several',
  'deluxe', 'premium', 'economy', 'budget',
  'full', 'half', 'partial', 'light', 'heavy',
  'soft', 'hard', 'warm', 'cool', 'cold', 'hot', 'mild',
  'open', 'closed', 'indoor', 'outdoor',
]);

/**
 * A word appearing as an option on this many DIFFERENT categories or more
 * is describing the shape of a question (a language picker, a yes/both
 * toggle), not one trade. Measured gap in the real data: 1,063 of 1,248
 * distinct words sit at exactly 1 category; nothing sits at 6, 7, 8 or 9;
 * only 5 words sit at 6+ ("cebuano" at 6, "both"/"modern minimalist" at
 * 10, "english"/"tagalog" at 15). This constant IS that measured gap.
 */
export const MAX_SHARED_CATEGORIES = 6;

/** De-slug an option value: `360_booth` -> `360 booth`. */
export function humanizeOption(raw: string): string {
  return raw.replace(/_/g, ' ').trim().replace(/\s+/g, ' ');
}

/**
 * Every raw (humanized, deduped-within-category) option word per category,
 * from `category_specific_attributes`. Only fields carrying an `options`
 * array contribute anything — boolean / int / text / multi_select_open
 * fields have none, which is correct: their LABEL is a question, not a
 * word, and is deliberately not mined (see module docblock).
 */
export function rawOptionWordsByCategory(
  rows: readonly SchemaRow[],
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const row of rows) {
    const attrs = row.category_specific_attributes;
    if (!attrs) continue;
    const seen = new Set<string>();
    const words: string[] = [];
    for (const field of Object.values(attrs)) {
      if (!field || !Array.isArray(field.options)) continue;
      for (const opt of field.options) {
        if (typeof opt !== 'string') continue;
        const word = humanizeOption(opt).toLowerCase();
        if (!word || seen.has(word)) continue;
        seen.add(word);
        words.push(word);
      }
    }
    if (words.length) out.set(row.canonical_service, words);
  }
  return out;
}

/** How many DISTINCT categories each word appears under. */
export function categoryFrequency(byCategory: ReadonlyMap<string, string[]>): Map<string, number> {
  const freq = new Map<string, number>();
  for (const words of byCategory.values()) {
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return freq;
}

export type MineResult = {
  /** canonical_service -> the words that survived both filters. */
  kept: Map<string, string[]>;
  /** How many words each filter removed — printed by the script, not silent. */
  droppedGeneric: number;
  droppedOverShared: number;
  /** Every dropped word with why, for a `--dry-run` or a spot-check. */
  dropped: Array<{ canonicalService: string; word: string; reason: 'generic' | 'over_shared' }>;
};

/**
 * The whole pipeline: raw option words -> distinctiveness filters -> the
 * final per-category alias set, with every drop counted and reasoned.
 * Pure — no DB, no network, so this is unit-testable with a tiny fixture
 * and is exactly what `scripts/seed-trade-aliases.ts` runs against a real
 * read of `canonical_service_schemas`.
 */
export function mineTradeAliases(
  rows: readonly SchemaRow[],
  opts: { maxSharedCategories?: number; stoplist?: ReadonlySet<string> } = {},
): MineResult {
  const maxShared = opts.maxSharedCategories ?? MAX_SHARED_CATEGORIES;
  const stoplist = opts.stoplist ?? GENERIC_DESCRIPTORS;

  const byCategory = rawOptionWordsByCategory(rows);
  const freq = categoryFrequency(byCategory);

  const kept = new Map<string, string[]>();
  const dropped: MineResult['dropped'] = [];
  let droppedGeneric = 0;
  let droppedOverShared = 0;

  for (const [cs, words] of byCategory) {
    const survivors: string[] = [];
    for (const w of words) {
      if (stoplist.has(w)) {
        droppedGeneric += 1;
        dropped.push({ canonicalService: cs, word: w, reason: 'generic' });
        continue;
      }
      if ((freq.get(w) ?? 0) >= maxShared) {
        droppedOverShared += 1;
        dropped.push({ canonicalService: cs, word: w, reason: 'over_shared' });
        continue;
      }
      survivors.push(w);
    }
    if (survivors.length) kept.set(cs, survivors);
  }

  return { kept, droppedGeneric, droppedOverShared, dropped };
}
