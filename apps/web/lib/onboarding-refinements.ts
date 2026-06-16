/**
 * onboarding-refinements.ts — DB-backed read-through for the onboarding
 * "what kind of X?" refinement catalogue (owner 2026-06-08, items 8 + 9).
 *
 * Reads onboarding_refinements + onboarding_refinement_options (migration
 * 20260926000000) and reconstructs the SAME RefineLeaf[] shape the
 * app/onboarding/wedding/_data/refinements.ts module exposes, so the onboarding
 * renders DB-sourced refinements that update the moment an admin edits them — no
 * deploy. SAFETY: any error / empty result FALLS BACK to the TS module (the seed
 * source), so behaviour is preserved even if the tables are unseeded. React
 * `cache()` dedupes the read per request (mirrors lib/taxonomy-db).
 *
 * getOnboardingTiles (Phase 1 — taxonomy-drives-onboarding, 2026-06-17):
 * fetches all tier-2 service_categories tiles scoped to an event type so the
 * onboarding PICK step automatically gains new vendor categories the moment admin
 * adds them to the taxonomy — no deploy, no manual PICK_GROUPS edit required.
 * Returns [] on any error → shell falls back to static PICK_GROUPS_FALLBACK.
 */
import { cache } from 'react';

import { createClient } from './supabase/server';
import { REFINEMENTS_DATA, type RefineLeaf, type RefineOption } from '@/app/onboarding/wedding/_data/refinements';

/** One tile from the service_categories taxonomy — the unit the onboarding
 *  PICK step ("What would you love?") displays in its picker grid. */
export type OnboardingPickChip = { cat: string; label: string; folder: string };

type LeafRow = {
  leaf_key: string;
  label_en: string;
  description_en: string | null;
  main_photo: string | null;
  is_dynamic_ceremony: boolean | null;
  sort_order: number;
};
type OptionRow = {
  leaf_key: string;
  option_key: string;
  emoji: string | null;
  label_en: string;
  photo: string | null;
  sort_order: number;
};
type TileRow = {
  id: string;
  label_en: string;
  parent_id: string | null;
  applicable_event_types: string[] | null;
};

/**
 * Fetch all active tier-2 taxonomy tiles for a given event type.
 *
 * applicable_event_types null/[] = universal (always included). Non-empty =
 * scoped; only tiles that list `eventType` are returned. Falls back to [] on
 * any read error so the caller degrades to the static PICK_GROUPS_FALLBACK
 * without breaking the onboarding.
 */
export const getOnboardingTiles = cache(async (eventType: string = 'wedding'): Promise<OnboardingPickChip[]> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('service_categories')
      .select('id,label_en,parent_id,applicable_event_types')
      .eq('tier', 2)
      .eq('status', 'active')
      .order('sort_order', { ascending: true });
    if (error || !data || data.length === 0) return [];
    return (data as TileRow[])
      .filter((t) => {
        const types = t.applicable_event_types;
        return !types || types.length === 0 || types.includes(eventType);
      })
      .map((t) => ({ cat: t.id, label: t.label_en, folder: t.parent_id ?? '' }));
  } catch {
    return [];
  }
});

export const getOnboardingRefinements = cache(async (eventType: string = 'wedding'): Promise<RefineLeaf[]> => {
  try {
    const supabase = await createClient();
    const [leavesRes, optionsRes] = await Promise.all([
      supabase
        .from('onboarding_refinements')
        .select('leaf_key,label_en,description_en,main_photo,is_dynamic_ceremony,sort_order,service_categories!tile_id(applicable_event_types)')
        .eq('status', 'active')
        .order('sort_order', { ascending: true }),
      supabase
        .from('onboarding_refinement_options')
        .select('leaf_key,option_key,emoji,label_en,photo,sort_order')
        .eq('status', 'active')
        .order('sort_order', { ascending: true }),
    ]);
    type LeafWithJoin = LeafRow & { service_categories: { applicable_event_types: string[] | null } | null };
    const rawLeaves = leavesRes.data as LeafWithJoin[] | null;
    if (leavesRes.error || optionsRes.error || !rawLeaves || rawLeaves.length === 0) {
      return REFINEMENTS_DATA;
    }
    // Filter by event type via the tile_id → service_categories join.
    // null/[] = universal; non-empty = must include eventType.
    const leaves = rawLeaves.filter((l) => {
      const types = l.service_categories?.applicable_event_types;
      return !types || types.length === 0 || types.includes(eventType);
    });
    if (leaves.length === 0) return REFINEMENTS_DATA;

    const byLeaf = new Map<string, RefineLeaf>();
    for (const l of leaves) {
      byLeaf.set(l.leaf_key, {
        key: l.leaf_key,
        label: l.label_en,
        description: l.description_en ?? '',
        mainPhoto: l.main_photo ?? '',
        dynamic: l.is_dynamic_ceremony ? 'ceremony' : undefined,
        options: [],
      });
    }
    for (const o of (optionsRes.data as OptionRow[] | null) ?? []) {
      const leaf = byLeaf.get(o.leaf_key);
      if (!leaf) continue;
      const opt: RefineOption = { emoji: o.emoji ?? '', label: o.label_en, key: o.option_key, photo: o.photo };
      leaf.options.push(opt);
    }
    // Admin-uploaded photos are stored as `r2://…` refs (the seeded ones are
    // /public paths, used verbatim). Resolve ONLY the r2 refs to display URLs —
    // gathered + presigned in parallel so a no-r2 catalogue costs zero awaits.
    const r2refs = new Set<string>();
    for (const leaf of byLeaf.values()) {
      if (leaf.mainPhoto.startsWith('r2://')) r2refs.add(leaf.mainPhoto);
      for (const o of leaf.options) if (o.photo && o.photo.startsWith('r2://')) r2refs.add(o.photo);
    }
    if (r2refs.size > 0) {
      const { displayUrlForStoredAsset } = await import('./uploads');
      const pairs = await Promise.all(
        [...r2refs].map(async (ref) => [ref, await displayUrlForStoredAsset(ref).catch(() => null)] as const),
      );
      const urlByRef = new Map(pairs);
      // Substitute ONLY r2:// refs (never the /public paths). A failed presign →
      // empty/null, NOT the raw r2:// ref, so the card falls back to the emoji
      // glyph instead of rendering a broken `url(r2://…)` (review 2026-06-09).
      for (const leaf of byLeaf.values()) {
        if (leaf.mainPhoto.startsWith('r2://')) leaf.mainPhoto = urlByRef.get(leaf.mainPhoto) || '';
        for (const o of leaf.options) {
          if (o.photo && o.photo.startsWith('r2://')) o.photo = urlByRef.get(o.photo) || null;
        }
      }
    }
    return [...byLeaf.values()];
  } catch {
    return REFINEMENTS_DATA;
  }
});
