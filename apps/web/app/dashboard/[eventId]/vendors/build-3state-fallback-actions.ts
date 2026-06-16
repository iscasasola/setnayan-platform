'use server';

/**
 * Build 3-State Solver — marketplace FALLBACK suggestions (Phase 3d-B ·
 * Build_3State_Solver_2026-06-16.md).
 *
 * When an Auto row can't be filled from the couple's own quoted inquiries
 * (nothing fits budget / no quote for that category — `runBuild3State` returns
 * the group in `unfilled`), the couple can ask Setnayan to look WIDER: this
 * action falls back to a marketplace search on the requirement and returns
 * SUGGESTIONS the couple taps to add to the shortlist. It NEVER auto-adds or
 * auto-charges — it's a richer, build-scoped wrapper over the proven
 * `searchCategoryVendors` (the same engine that backs the Category Search
 * overlay + `generateFlaggedVendors`).
 *
 * ── FLAG-DARK ───────────────────────────────────────────────────────────────
 * Re-checks `isBuild3StateEnabled()` and refuses when OFF (default). The 3-state
 * Build surface is the only caller, and it only mounts behind the flag, so this
 * is unreachable in production today. Behavior with the flag OFF is unchanged.
 *
 * ── ORDERING ────────────────────────────────────────────────────────────────
 * Results are ordered by a HIDDEN compatibility % — `searchCategoryVendors`
 * already computes `compatScore` per result (reception-anchored distance +
 * reviews + verification + boost, AI-richer when Setnayan AI is on, coarser /
 * null when off). We re-sort by it and STRIP it from the payload so the number
 * is sort-only and never rendered. Without AI the score is null for every
 * result → the sort is a stable no-op and we keep the engine's own tier order
 * (the fallback still works, just coarser).
 *
 * Top 10 by default with an "expand by 5" affordance (the client requests a
 * higher `limit`). No schema change.
 */

import { createClient } from '@/lib/supabase/server';
import { isBuild3StateEnabled } from '@/lib/build-3state';
import { searchCategoryVendors } from './_actions/category-search';

/** One fallback suggestion the couple can tap to add to the shortlist. The
 *  hidden compatibility % that ORDERED these is intentionally absent — it sorts,
 *  it never shows. */
export type BuildFallbackSuggestion = {
  vendorProfileId: string;
  name: string;
  nameAnonymized: boolean;
  city: string | null;
  logoUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  distanceKm: number | null;
  verified: boolean;
  boosted: boolean;
  /** Already in this event's picks → the client renders "✓ Added", not Add. */
  alreadyAdded: boolean;
  withinRadius: boolean;
};

export type BuildFallbackResult =
  | {
      ok: true;
      groupId: string;
      suggestions: BuildFallbackSuggestion[];
      /** Total in-scope matches before the top-N slice → drives "expand by 5"
       *  (more remain iff total > returned). */
      total: number;
      /** Mirror of the search's reception-coords flag (the client hides the
       *  distance chip when false). */
      hasReceptionCoords: boolean;
    }
  | { ok: false; error: string };

const DEFAULT_TOP = 10; // the first page; the client's "show 5 more" raises `limit`.
const MAX_TOP = 50; // hard ceiling so a runaway expander can't over-fetch.

/**
 * Find marketplace fallback suggestions for ONE unfilled Auto category.
 *
 * @param eventId  the couple's event
 * @param groupId  the plan group whose Auto row couldn't be filled from quotes
 * @param limit    how many suggestions to return (default 10; the client raises
 *                 it by EXPAND_STEP per "show 5 more" tap). Clamped to MAX_TOP.
 *
 * Suggestions are SORTED by the hidden compat % (descending) then the engine's
 * own order, and the % is stripped before returning. These are tap-to-add
 * suggestions — this action performs NO write (no auto-add, no charge).
 */
export async function findBuildFallbackSuggestions(input: {
  eventId: string;
  groupId: string;
  limit?: number;
}): Promise<BuildFallbackResult> {
  if (!isBuild3StateEnabled()) return { ok: false, error: 'The 3-state Build is not available.' };

  const eventId = String(input.eventId ?? '').trim();
  const groupId = String(input.groupId ?? '').trim();
  if (!eventId || !groupId) return { ok: false, error: 'Missing event or category.' };

  // Auth gate (searchCategoryVendors is itself RLS-bounded, but bail early on
  // an anonymous caller so we never run the search needlessly).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const want = Math.min(
    MAX_TOP,
    Math.max(DEFAULT_TOP, typeof input.limit === 'number' ? Math.floor(input.limit) : DEFAULT_TOP),
  );

  // Reuse the PROVEN category search — hard-scoped to this group's canonical
  // services (the couple can never drift to another category), AI-gated,
  // last-minute-aware, hybrid-anonymity-resolved. It already attaches a
  // compatScore per result (null when Setnayan AI is off).
  let search: Awaited<ReturnType<typeof searchCategoryVendors>>;
  try {
    search = await searchCategoryVendors({ eventId, groupId });
  } catch {
    // Fail-soft: a search blowup must not break the Build flow — return an
    // empty suggestion set, not an error toast.
    return {
      ok: true,
      groupId,
      suggestions: [],
      total: 0,
      hasReceptionCoords: false,
    };
  }

  // Hidden-compat sort: highest first. A null score (AI off, or an unscored
  // vendor) sorts last; ties keep the engine's tier order via a stable sort
  // (index tie-break). The score is NEVER copied into the returned shape.
  const indexed = search.results.map((r, i) => ({ r, i }));
  indexed.sort((a, b) => {
    const sa = a.r.compatScore ?? -1;
    const sb = b.r.compatScore ?? -1;
    if (sb !== sa) return sb - sa;
    return a.i - b.i; // stable: preserve the engine's owner-locked tier ladder.
  });

  const suggestions: BuildFallbackSuggestion[] = indexed.slice(0, want).map(({ r }) => ({
    vendorProfileId: r.vendorProfileId,
    name: r.name,
    nameAnonymized: r.nameAnonymized,
    city: r.city,
    logoUrl: r.logoUrl,
    rating: r.rating,
    reviewCount: r.reviewCount,
    distanceKm: r.distanceKm,
    verified: r.verified,
    boosted: r.boosted,
    alreadyAdded: r.alreadyAdded,
    withinRadius: r.withinRadius,
  }));

  return {
    ok: true,
    groupId,
    suggestions,
    total: search.results.length,
    hasReceptionCoords: search.hasReceptionCoords,
  };
}
