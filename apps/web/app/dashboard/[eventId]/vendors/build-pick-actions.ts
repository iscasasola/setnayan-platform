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
 * Replace the working build with a saved plan's vendor picks — the Plans panel's
 * **Load** (formerly Compare's "Modify"/"Lock"). Clears the event's existing
 * build picks, then upserts each (planGroupId → vendorId) one at a time,
 * best-effort: a vendor that has since left the shortlist (event_vendors row
 * gone) FK-rejects, so we skip that single pick and keep going. Couple-own RLS +
 * the FK enforce ownership.
 *
 * LOCKED-CATEGORY GUARD (Explore_Replan_BUILD_SPEC_2026-07-27 §2 #10 / §8.2 —
 * "locked vendors are untouched"). Locks live in `event_vendors.status`, NOT in
 * `event_build_picks`, so this action could never delete one. What it COULD do
 * before this guard is re-open a settled category — insert a stale candidate
 * into a group the couple has since LOCKED, so a pinned row sprouted a rival.
 * `lockedPlanGroupIds` closes that: those groups are excluded from BOTH the wipe
 * and the insert, so a Load leaves every locked category exactly as it was.
 * Optional + defaults to today's behaviour, so pre-PR-F callers are unaffected;
 * the caller filters too (`planPicksToApply`) — this is the server-side backstop.
 */
export async function applyBuildToWorking(input: {
  eventId: string;
  picks: { planGroupId: string; vendorId: string }[];
  lockedPlanGroupIds?: string[];
}): Promise<BuildPickResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const lockedGroups = new Set(input.lockedPlanGroupIds ?? []);

  // Wipe the current working build first so a partial apply still reflects the
  // chosen plan (no leftover picks from the previous build) — minus any LOCKED
  // category, which a plan may not vary.
  if (lockedGroups.size === 0) {
    const { error: clearError } = await supabase
      .from('event_build_picks')
      .delete()
      .eq('event_id', input.eventId);
    if (clearError) return { ok: false, error: clearError.message };
  } else {
    // Read-then-targeted-delete rather than a NOT-IN filter: plan_group_ids are
    // free-form slugs, and an explicit .in() list can't mis-quote its way into
    // deleting the wrong rows.
    const { data: existing, error: readError } = await supabase
      .from('event_build_picks')
      .select('plan_group_id')
      .eq('event_id', input.eventId);
    if (readError) return { ok: false, error: readError.message };
    const clearable = [
      ...new Set(
        ((existing ?? []) as Array<{ plan_group_id: string }>)
          .map((r) => r.plan_group_id)
          .filter((g) => !lockedGroups.has(g)),
      ),
    ];
    if (clearable.length > 0) {
      const { error: clearError } = await supabase
        .from('event_build_picks')
        .delete()
        .eq('event_id', input.eventId)
        .in('plan_group_id', clearable);
      if (clearError) return { ok: false, error: clearError.message };
    }
  }

  let applied = 0;
  const insertable = input.picks.filter((p) => !lockedGroups.has(p.planGroupId));
  for (const p of insertable) {
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

  if (insertable.length === 0 || applied > 0) return { ok: true };
  return {
    ok: false,
    error:
      'None of this plan’s vendors are still on your shortlist. Re-save the plan and try again.',
  };
}

/** "Clear candidates" — reset the build by clearing every build pick for the
 *  event. Does NOT touch the shortlist (event_vendors) or any locked/finalized
 *  vendor; build picks are a separate, reversible layer, so locked vendors (they
 *  are contracts) and in-progress handshakes survive untouched and are cancelled
 *  individually. Surfaced on the Plans panel by
 *  Explore_Replan_BUILD_SPEC_2026-07-27 §8.3. */
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
