'use server';

/**
 * Plan Builder "Build pick" actions (Shortlist "Add to build" + Build "Pin").
 * Backs `event_build_picks` (migration 20261018000000): the couple's chosen
 * vendor PER CATEGORY in their working build — one pick per (event, plan_group),
 * reversible, money-free, conflict-free. Distinct from the hardened
 * `finalizeVendor` lock (which stays the Build/Lock flow). Couple-own RLS.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { pinBuildPickRow, removeBuildPickRow } from '@/lib/build-pick-write';

export type BuildPickResult = { ok: true } | { ok: false; error: string };

/**
 * Pin a shortlisted vendor as a build pick for its category.
 *
 * SINGLE-pick category (most folders): one pick per (event, plan_group) — adding
 * a second vendor REPLACES the first (delete the category's existing picks, then
 * insert). MULTI-pick category (Look / Booths / Prints · isMultiPickGroup): the
 * category keeps several picks — just INSERT this vendor (idempotent on the
 * (event, group, vendor) PK), leaving the others in place. The vendor must
 * already be on the couple's shortlist (event_vendors); RLS + the FK enforce
 * ownership + existence.
 */
export async function setBuildPick(input: {
  eventId: string;
  planGroupId: string;
  vendorId: string;
}): Promise<BuildPickResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  // The multi-pick data-loss guard lives in pinBuildPickRow (the single,
  // unit-tested source of truth): single-pick categories replace the prior
  // pick; multi-pick categories (Look / Booths / Prints) keep every pick.
  const errMsg = await pinBuildPickRow(supabase, {
    eventId: input.eventId,
    planGroupId: input.planGroupId,
    vendorId: input.vendorId,
    pickedBy: user.id,
    now: new Date().toISOString(),
  });
  if (errMsg) return { ok: false, error: errMsg };
  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true };
}

/**
 * Take ONE vendor's pick back off the build (does not touch the shortlist).
 * `vendorId` is REQUIRED: a multi-pick category (Look / Booths / Prints) holds
 * several picks, so a vendorless clear would silently destroy the couple's other
 * picks. Whole-build reset is the separate, explicit `clearBuildPicks` action.
 */
export async function removeBuildPick(input: {
  eventId: string;
  planGroupId: string;
  vendorId: string;
}): Promise<BuildPickResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const errMsg = await removeBuildPickRow(supabase, {
    eventId: input.eventId,
    planGroupId: input.planGroupId,
    vendorId: input.vendorId,
  });
  if (errMsg) return { ok: false, error: errMsg };
  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true };
}

/**
 * Replace the entire working build with a saved plan's vendor picks (Compare
 * "Modify"/"Lock"). Clears every existing build pick for the event, then upserts
 * each (planGroupId → vendorId) one at a time, best-effort: a vendor that has
 * since left the shortlist (event_vendors row gone) FK-rejects, so we skip that
 * single pick and keep going. Couple-own RLS + the FK enforce ownership.
 */
export async function applyBuildToWorking(input: {
  eventId: string;
  picks: { planGroupId: string; vendorId: string }[];
}): Promise<BuildPickResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  // Wipe the current working build first so a partial apply still reflects the
  // chosen plan (no leftover picks from the previous build).
  const { error: clearError } = await supabase
    .from('event_build_picks')
    .delete()
    .eq('event_id', input.eventId);
  if (clearError) return { ok: false, error: clearError.message };

  let applied = 0;
  for (const p of input.picks) {
    const { error } = await supabase.from('event_build_picks').upsert(
      {
        event_id: input.eventId,
        plan_group_id: p.planGroupId,
        vendor_id: p.vendorId,
        picked_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,plan_group_id,vendor_id' },
    );
    // A vendor removed from the shortlist since the build was saved FK-rejects;
    // skip it and keep applying the rest.
    if (!error) applied += 1;
  }

  revalidatePath(`/dashboard/${input.eventId}/vendors`);

  if (input.picks.length === 0 || applied > 0) return { ok: true };
  return {
    ok: false,
    error:
      'None of this plan’s vendors are still on your shortlist. Re-save the plan and try again.',
  };
}

/** Reset the build — clear every build pick for the event. Does NOT touch the
 *  shortlist (event_vendors) or any locked/finalized vendor; build picks are a
 *  separate, reversible layer. */
export async function clearBuildPicks(input: { eventId: string }): Promise<BuildPickResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const { error } = await supabase
    .from('event_build_picks')
    .delete()
    .eq('event_id', input.eventId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true };
}
