/**
 * faith-vocab.ts — the ONE shared faith-vocabulary module (Taxonomy Studio PR 6).
 *
 * Purpose: a single import surface for "the list of faiths, with labels" that is
 * DB-first (reads `faith_vocab`, respecting `status`) with a hardcoded Title-Case
 * fallback const — the house DB-first + fallback pattern (mirrors
 * lib/event-types-db.ts + lib/faith-vocab-db.ts). It also re-exports the derived
 * faith types so consumers stop re-deriving them from scattered sources.
 *
 * ⚠ FAITH LANDMINE (owner-locked): `faith_vocab.faith_key` is TITLE-CASE
 * ('Catholic', 'Muslim', 'INC', 'Civil') and the marketplace `[Faith:]` filter
 * compares with strict, case-sensitive `===`. NEVER lowercase, re-case, or
 * "normalize" a faith key anywhere — lowercasing silently hides every tagged
 * service. Storage + comparisons stay Title-Case; only display formatting differs.
 *
 * Division of labor (unchanged — this module does NOT collapse them):
 *   - `faith_vocab` (DB)                 = the taxonomy authority for faith keys.
 *   - `wedding_type_launch_status` (DB)  = which faiths are LIVE for couples.
 *   - `lib/faith-registry.ts`            = the couple-facing presentation registry
 *                                          (per-faith copy, hero photos, ceremony
 *                                          `key`↔`faithCol` map). Still the source
 *                                          for the rich onboarding chips.
 *   - `lib/taxonomy.ts` `WEDDING_FAITH_KEYS` = the compile-time Title-Case tuple.
 *
 * This module is the read-through for anything that just needs "faith_key +
 * label_en, active only". Server-only (the Supabase client reads cookies); cached
 * per request via React `cache()`.
 */
import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import { WEDDING_FAITH_KEYS, type WeddingFaithKey } from '@/lib/taxonomy';
import { FAITH_REGISTRY } from '@/lib/faith-registry';

// Re-export the derived types so a consumer needs exactly one import for both the
// list and the type (the "one shared module" contract). These stay anchored to
// their canonical definitions — this module never re-declares them.
export { WEDDING_FAITH_KEYS };
export type { WeddingFaithKey };
/** Every faith key EXCEPT `Civil` — civil couples get no faith pill. Mirrors the
 *  /explore FaithKey. */
export type FaithKey = Exclude<WeddingFaithKey, 'Civil'>;

export type FaithVocabItem = {
  /** TITLE-CASE `faith_key` — the storage + comparison key. Never lowercase it. */
  key: string;
  /** Display label (may differ from the key, e.g. 'INC' → 'Iglesia ni Cristo'). */
  label: string;
};

/**
 * The offline fallback: the Title-Case tuple paired with the faith-registry
 * label (or the key itself for `Civil`, which the registry doesn't row). Used
 * ONLY when the DB read errors or returns empty — same fail-soft contract as
 * lib/faith-vocab-db.ts, so a DB hiccup degrades to yesterday's list.
 */
const FALLBACK_ITEMS: readonly FaithVocabItem[] = WEDDING_FAITH_KEYS.map((key) => {
  const entry = FAITH_REGISTRY.find((f) => f.faithCol === key);
  return { key, label: entry?.label ?? key };
});

/** Just the Title-Case keys of the fallback list — the validation-set fallback. */
const FALLBACK_KEYS: readonly string[] = FALLBACK_ITEMS.map((i) => i.key);

/**
 * The ACTIVE faith vocabulary (Title-Case key + label), sort-ordered — the DB-
 * first list for admin faith scoping pickers and any server surface that shows
 * "pick a faith". Falls back to FALLBACK_ITEMS on any read error / empty result.
 */
export const getFaithVocab = cache(async (): Promise<FaithVocabItem[]> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('faith_vocab')
      .select('faith_key, label_en')
      .eq('status', 'active')
      .order('sort_order', { ascending: true });
    if (error || !data || data.length === 0) return [...FALLBACK_ITEMS];
    return (data as { faith_key: string; label_en: string }[]).map((r) => ({
      key: r.faith_key,
      label: r.label_en,
    }));
  } catch {
    return [...FALLBACK_ITEMS];
  }
});

/**
 * The ACTIVE faith keys (TITLE-CASE `faith_key`) as a Set — the validation set
 * for any faiths[] submission (e.g. vendor_coverages.faiths). Derived from the
 * same DB-first read as getFaithVocab; falls back to FALLBACK_KEYS. This is the
 * consolidated home of what lib/faith-vocab-db.ts's getActiveFaithKeys returned
 * (that module now re-exports this).
 */
export const getActiveFaithKeys = cache(async (): Promise<ReadonlySet<string>> => {
  const items = await getFaithVocab();
  if (items.length === 0) return new Set(FALLBACK_KEYS);
  return new Set(items.map((i) => i.key));
});
