/**
 * faith-vocab-db.ts — DB-backed read-through for the marketplace faith vocab.
 *
 * `faith_vocab` (migration 20261109000000 · public-read, admin-write) is the
 * taxonomy authority for faith keys: TITLE-CASE `faith_key` ('Catholic',
 * 'Muslim', 'INC', …) + `label_en`, with an active/retired `status` lifecycle.
 * `lib/faith-registry.ts` mirrors it app-side for presentation. Validation
 * (e.g. vendor_coverages.faiths, per the migration-20270502342558 column
 * comment "app-validated against faith_vocab") should read the TABLE so
 * admin-added faiths flow through with zero deploys.
 *
 * SAFETY: falls back to the static FAITH_REGISTRY faithCol set on any read
 * error / empty result, so a DB hiccup degrades to yesterday's behavior — the
 * same fail-soft contract as lib/event-types-db.ts.
 *
 * Cached per request via React `cache()`. Server-only (the Supabase client
 * reads cookies).
 */
import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import { FAITH_REGISTRY } from '@/lib/faith-registry';

const FALLBACK_KEYS: readonly string[] = FAITH_REGISTRY.map((f) => f.faithCol);

/**
 * The ACTIVE faith keys (TITLE-CASE `faith_key`) — the validation set for any
 * faiths[] submission. Falls back to the FAITH_REGISTRY faithCol set.
 */
export const getActiveFaithKeys = cache(async (): Promise<ReadonlySet<string>> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('faith_vocab')
      .select('faith_key')
      .eq('status', 'active');
    if (error || !data || data.length === 0) return new Set(FALLBACK_KEYS);
    return new Set((data as { faith_key: string }[]).map((r) => r.faith_key));
  } catch {
    return new Set(FALLBACK_KEYS);
  }
});
