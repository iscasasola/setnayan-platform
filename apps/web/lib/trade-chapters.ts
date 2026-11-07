/**
 * trade-chapters.ts — 📖 A TRADE STARTS ON ITS USUAL CHAPTERS (owner 2026-11-04; approved prototype "Event chapters —
 * 4 Nov 2026", frame 5: *"prefilled from the trade's default parts (Admin › Categories: caterer = Cocktail +
 * Reception). The host confirms."*).
 *
 * The fact lives on the category — `service_categories.default_chapters` (migration 20271307273159), edited on
 * Admin › Categories beside One per event — and is read the way `one-per-event.ts` reads its switch: a booking's
 * coarse `event_vendors.category` belongs to the tier-2 categories FILED under it (`coarse_category`).
 *
 * It is only a PREFILL of "Which chapters will they serve?": nothing here writes. The chapters a supplier is on stay
 * `responsible_vendor_ids`, written by `set_supplier_where` (lib/supplier-where.ts) when the host confirms.
 *
 * Reads honest: `{ ok: false }` when refused — the sheet then starts empty, never a guessed set.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_CHAPTER_LABELS, type DefaultChapterKey } from '@/lib/schedule';
import type { WhereChapter } from '@/lib/supplier-where';
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';

export const DEFAULT_CHAPTER_KEYS: readonly DefaultChapterKey[] = ['prep', 'ceremony', 'cocktail_reception', 'after_party'];

export function isDefaultChapterKey(v: unknown): v is DefaultChapterKey {
  return typeof v === 'string' && (DEFAULT_CHAPTER_KEYS as readonly string[]).includes(v);
}

export type TradeChaptersRow = { coarse_category: string | null; default_chapters: readonly string[] | null };
export type TradeChaptersRead = { ok: true; byCategory: ReadonlyMap<string, readonly DefaultChapterKey[]> } | { ok: false };

/** Coarse category → the default chapters of every tier-2 category filed under it (their union, in chapter order). */
export function tradeChaptersFrom(rows: readonly TradeChaptersRow[]): ReadonlyMap<string, readonly DefaultChapterKey[]> {
  const sets = new Map<string, Set<DefaultChapterKey>>();
  for (const r of rows) {
    if (!r.coarse_category) continue;
    const keys = (r.default_chapters ?? []).filter(isDefaultChapterKey);
    if (keys.length === 0) continue;
    const s = sets.get(r.coarse_category) ?? new Set<DefaultChapterKey>();
    for (const k of keys) s.add(k);
    sets.set(r.coarse_category, s);
  }
  return new Map([...sets].map(([k, s]) => [k, DEFAULT_CHAPTER_KEYS.filter((x) => s.has(x))]));
}

export async function readTradeChapters(sb: SupabaseClient): Promise<TradeChaptersRead> {
  const { data, error } = await sb
    .from('service_categories')
    .select('coarse_category, default_chapters')
    .eq('tier', 2)
    .eq('status', 'active');
  if (error || !data) {
    console.error('[supabase-error] lib/trade-chapters.ts · from:service_categories.select', error);
    return { ok: false };
  }
  return { ok: true, byCategory: tradeChaptersFrom(data as TradeChaptersRow[]) };
}

/** Which default chapter a chapter of the event IS: by its kind (`block_type`), else by its default name. */
export function defaultKeyOf(c: Pick<WhereChapter, 'name' | 'kind'>): DefaultChapterKey | null {
  switch (c.kind) {
    case 'pre_ceremony':
      return 'prep';
    case 'ceremony':
      return 'ceremony';
    case 'reception':
    case 'cocktails':
      return 'cocktail_reception';
    case 'after_party':
      return 'after_party';
  }
  const byName = (Object.entries(DEFAULT_CHAPTER_LABELS) as [DefaultChapterKey, string][]).find(([, label]) => label === c.name);
  if (byName) return byName[0];
  return c.name === 'Reception' ? 'cocktail_reception' : null;
}

/** The event's chapters a trade starts on — those whose default kind is in its list. Empty = no suggestion. */
export function suggestedChapters(chapters: readonly WhereChapter[], keys: readonly DefaultChapterKey[] | undefined): string[] {
  if (!keys || keys.length === 0) return [];
  return chapters.filter((c) => {
    const k = defaultKeyOf(c);
    return k !== null && keys.includes(k);
  }).map((c) => c.blockId);
}

/** A plan group's default chapters — the union over its supplier kinds (`PLAN_GROUPS[].categories`, coarse). */
export function keysForGroup(
  groupId: string | null | undefined,
  byCategory: ReadonlyMap<string, readonly DefaultChapterKey[]> | null | undefined,
): DefaultChapterKey[] {
  if (!groupId || !byCategory) return [];
  const group = PLAN_GROUPS.find((g) => g.id === groupId);
  if (!group) return [];
  const keys = new Set<DefaultChapterKey>();
  for (const c of group.categories) for (const k of byCategory.get(c) ?? []) keys.add(k);
  return DEFAULT_CHAPTER_KEYS.filter((k) => keys.has(k));
}
