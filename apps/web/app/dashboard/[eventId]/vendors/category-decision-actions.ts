'use server';

/**
 * Category-decision actions (Explore Replan slice A ·
 * Explore_Replan_BUILD_SPEC_2026-07-27.md §3 PR-A).
 *
 * First real writers of `event_category_decisions` (migration 20270110320013 —
 * couple-own RLS, unique (event_id, plan_group_id)). Backs the post-lock
 * "done with this service, or add another?" toast and the "✓ Covered — reopen"
 * collapse on the bench:
 *   · "✓ I'm done"      → upsert decision='complete'
 *   · "Reopen"          → delete the row (state falls back to derivation)
 *
 * `finalizeVendor` writes the hard-single auto-complete server-side itself;
 * these actions are the couple-tapped paths. RLS enforces event membership —
 * no additional auth beyond the signed-in check.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isExploreReplanEnabled } from '@/lib/explore-replan-flag';
import { REMOVE_BLOCKED_LOCKED } from '@/lib/explore-info-copy';
import { categoriesForTile, LOCKED_VENDOR_STATUSES } from '@/lib/shortlist-taxonomy';

export type CategoryDecisionResult = { ok: true } | { ok: false; error: string };

export async function markCategoryComplete(input: {
  eventId: string;
  planGroupId: string;
}): Promise<CategoryDecisionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const { error } = await supabase
    .from('event_category_decisions')
    .upsert(
      {
        event_id: input.eventId,
        plan_group_id: input.planGroupId,
        decision: 'complete',
        decided_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,plan_group_id' },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true };
}

export async function clearCategoryDecision(input: {
  eventId: string;
  planGroupId: string;
}): Promise<CategoryDecisionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const { error } = await supabase
    .from('event_category_decisions')
    .delete()
    .eq('event_id', input.eventId)
    .eq('plan_group_id', input.planGroupId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true };
}

/* ── Adaptive category set (Explore Replan slice C · spec §3 PR-C) ──────────
   Tile-grain decisions. Migration 20271016100000 added the nullable `tile`
   column + a partial UNIQUE (event_id, tile), so a couple can say "I don't need
   a Photo Booth" without that answer also speaking for every sibling category
   inside the same plan group.

   Both actions are inert while the flag is OFF — the UI that calls them does
   not render, and refusing here as well means a stale client can never write a
   row production would then have to interpret. */

/**
 * "Not needed? Remove" — record a tile-level exclusion.
 *
 * HARD GUARD (spec §3 PR-C): refuse outright when the tile's categories hold a
 * LOCKED vendor. Removing a category must never make a booking invisible; the
 * couple unlocks first. The guard asks about EVERY `VendorCategory` that rolls
 * up to the tile (`categoriesForTile`), not the tile's single storage
 * representative — a booking filed under `officiant` sits on the
 * `ceremony_venue` tile and must block it.
 *
 * A tile with no known categories (finer than the 45-value enum) cannot be
 * PROVEN empty, so it is treated as unprovable-but-harmless: there is no
 * `event_vendors` row that could be hidden, because no vendor can be stored
 * under a category that does not exist. The exclusion proceeds.
 */
export async function excludeTileFromPlan(input: {
  eventId: string;
  tile: string;
}): Promise<CategoryDecisionResult> {
  if (!isExploreReplanEnabled()) return { ok: false, error: 'Not available.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const categories = categoriesForTile(input.tile);
  if (categories.length > 0) {
    // Column-explicit read, RLS-scoped to the couple's own event.
    const { data: locked, error: lockedErr } = await supabase
      .from('event_vendors')
      .select('vendor_id')
      .eq('event_id', input.eventId)
      .in('category', categories)
      .in('status', LOCKED_VENDOR_STATUSES)
      .limit(1);
    // Fail CLOSED: if we cannot prove the category is unlocked, do not remove it.
    if (lockedErr) return { ok: false, error: 'Could not check this category — try again.' };
    if ((locked ?? []).length > 0) return { ok: false, error: REMOVE_BLOCKED_LOCKED };
  }

  const { error } = await supabase.from('event_category_decisions').upsert(
    {
      event_id: input.eventId,
      tile: input.tile,
      decision: 'excluded',
      decided_at: new Date().toISOString(),
    },
    { onConflict: 'event_id,tile' },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true };
}

/**
 * "＋ Add to your event" — clear a tile-level exclusion so the category returns
 * to the bench. Deleting the row (rather than writing an 'included' decision)
 * keeps absence as the default and matches slice A's Reopen.
 */
export async function restoreTileToPlan(input: {
  eventId: string;
  tile: string;
}): Promise<CategoryDecisionResult> {
  if (!isExploreReplanEnabled()) return { ok: false, error: 'Not available.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const { error } = await supabase
    .from('event_category_decisions')
    .delete()
    .eq('event_id', input.eventId)
    .eq('tile', input.tile);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true };
}
