/**
 * seed-trade-aliases-core.ts — the testable half of `scripts/seed-trade-
 * aliases.ts`, split out so it lands under `lib/**`.
 *
 * ⚠ WHY THIS SPLIT EXISTS AT ALL. `test:unit` globs ONLY `lib/**` and
 * `app/**` — a test file dropped under `scripts/` never runs in CI and
 * silently proves nothing (the exact "put the guard where the glob can
 * see it" trap this repo has already paid for once). `fetchLiveTrades`
 * (a DB read shape) and `parseProposals` (pure parsing) live here so
 * `seed-trade-aliases-core.test.ts` actually executes; the script itself
 * stays a thin CLI wrapper (argv, the Anthropic call, the write).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Live trades, read directly (no Next request context in a CLI script —
// this cannot import lib/vendor-coverages.ts, which needs next/headers via
// createClient('@/lib/supabase/server')). Mirrors getCoverageTaxonomy()'s
// own query shape exactly, so "what counts as a live trade" cannot drift
// between the page and this script. ─────────────────────────────────────
type CategoryRow = {
  id: string;
  parent_id: string | null;
  tier: number;
  label_en: string;
  status: string | null;
  marketplace_hidden: boolean | null;
};
type CanonRow = {
  canonical_service: string;
  folder_id: string;
  tile_id: string | null;
  marketplace_hidden: boolean | null;
};
type SchemaRow = { canonical_service: string; display_name_en: string | null };

export type LiveTrade = {
  key: string;
  label: string;
  branchLabel: string;
  folderLabel: string;
};

export function humanize(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function fetchLiveTrades(admin: SupabaseClient): Promise<LiveTrade[]> {
  const [catsRes, canonRes, schemaRes] = await Promise.all([
    admin.from('service_categories').select('id,parent_id,tier,label_en,status,marketplace_hidden'),
    admin.from('canonical_service_taxonomy').select('canonical_service,folder_id,tile_id,marketplace_hidden'),
    admin.from('canonical_service_schemas').select('canonical_service,display_name_en'),
  ]);
  const cats = (catsRes.data ?? []) as CategoryRow[];
  const canon = (canonRes.data ?? []) as CanonRow[];
  const schemas = (schemaRes.data ?? []) as SchemaRow[];
  const isActive = (c: { status: string | null; marketplace_hidden: boolean | null }) =>
    c.status !== 'retired' && c.marketplace_hidden !== true;
  const catById = new Map(cats.map((c) => [c.id, c]));
  const displayName = new Map(schemas.map((s) => [s.canonical_service, s.display_name_en ?? '']));

  const out: LiveTrade[] = [];
  for (const cs of canon) {
    if (cs.marketplace_hidden === true || !cs.tile_id) continue;
    const tile = catById.get(cs.tile_id);
    if (!tile || tile.tier !== 2 || !isActive(tile)) continue;
    const folder = tile.parent_id ? catById.get(tile.parent_id) : null;
    if (!folder || folder.tier !== 1 || !isActive(folder)) continue;
    const label = (displayName.get(cs.canonical_service) || '').trim() || humanize(cs.canonical_service);
    out.push({ key: cs.canonical_service, label, branchLabel: tile.label_en, folderLabel: folder.label_en });
  }
  out.sort((a, b) => a.key.localeCompare(b.key));
  return out;
}

// ── The model's reply, parsed and validated. Never trusted to have named a
// real trade — a fabricated key is silently dropped, the same posture
// `askTheModel` in ask-the-admin.ts takes with an out-of-range choice. ──
export type Proposal = { key: string; aliases: string[] };

export function parseProposals(text: string, batch: readonly LiveTrade[]): Proposal[] {
  const validKeys = new Set(batch.map((t) => t.key));
  let parsed: unknown;
  try {
    const match = text.match(/\[[\s\S]*\]/);
    parsed = JSON.parse(match ? match[0] : text);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: Proposal[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue;
    const key = (row as Record<string, unknown>).key;
    const aliases = (row as Record<string, unknown>).aliases;
    if (typeof key !== 'string' || !validKeys.has(key)) continue;
    if (!Array.isArray(aliases)) continue;
    const clean = aliases
      .filter((a): a is string => typeof a === 'string')
      .map((a) => a.trim())
      .filter((a) => a.length >= 2 && a.length <= 80);
    if (clean.length) out.push({ key, aliases: clean });
  }
  return out;
}
