/**
 * onboarding-refinements.ts — the DB-backed read-through for the onboarding
 * "what kind of X?" refinement catalogue (owner 2026-06-08, items 8 + 9).
 *
 * Reads onboarding_refinements + onboarding_refinement_options (migration
 * 20260926000000) and reconstructs the SAME RefineLeaf[] shape the
 * app/onboarding/wedding/_data/refinements.ts module exposes, so the onboarding
 * renders DB-sourced refinements that update the moment an admin edits them — no
 * deploy. SAFETY: any error / empty result FALLS BACK to the TS module (the seed
 * source), so behaviour is preserved even if the tables are unseeded. React
 * `cache()` dedupes the read per request (mirrors lib/taxonomy-db).
 */
import { cache } from 'react';

import { createClient } from './supabase/server';
import { REFINEMENTS_DATA, type RefineLeaf, type RefineOption } from '@/app/onboarding/wedding/_data/refinements';

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

export const getOnboardingRefinements = cache(async (): Promise<RefineLeaf[]> => {
  try {
    const supabase = await createClient();
    const [leavesRes, optionsRes] = await Promise.all([
      supabase
        .from('onboarding_refinements')
        .select('leaf_key,label_en,description_en,main_photo,is_dynamic_ceremony,sort_order')
        .eq('status', 'active')
        .order('sort_order', { ascending: true }),
      supabase
        .from('onboarding_refinement_options')
        .select('leaf_key,option_key,emoji,label_en,photo,sort_order')
        .eq('status', 'active')
        .order('sort_order', { ascending: true }),
    ]);
    const leaves = leavesRes.data as LeafRow[] | null;
    if (leavesRes.error || optionsRes.error || !leaves || leaves.length === 0) {
      return REFINEMENTS_DATA; // unseeded / read error → behaviour-preserving fallback
    }
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
      for (const leaf of byLeaf.values()) {
        const m = urlByRef.get(leaf.mainPhoto);
        if (m) leaf.mainPhoto = m;
        for (const o of leaf.options) {
          if (o.photo) {
            const u = urlByRef.get(o.photo);
            if (u) o.photo = u;
          }
        }
      }
    }
    return [...byLeaf.values()];
  } catch {
    return REFINEMENTS_DATA;
  }
});
