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

export type BuildPickResult = { ok: true } | { ok: false; error: string };

/**
 * Pin a shortlisted vendor as the build pick for its category. Upserts on
 * (event_id, plan_group_id) → swapping the pinned vendor (the prototype's
 * "Replace" / "Add both": both stay shortlisted; only the single build-pick
 * pointer moves). The vendor must already be on the couple's shortlist
 * (event_vendors); RLS + the FK enforce ownership + existence.
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

  const { error } = await supabase.from('event_build_picks').upsert(
    {
      event_id: input.eventId,
      plan_group_id: input.planGroupId,
      vendor_id: input.vendorId,
      picked_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id,plan_group_id' },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true };
}

/** Take a category's pick back off the build (does not touch the shortlist). */
export async function removeBuildPick(input: {
  eventId: string;
  planGroupId: string;
}): Promise<BuildPickResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const { error } = await supabase
    .from('event_build_picks')
    .delete()
    .eq('event_id', input.eventId)
    .eq('plan_group_id', input.planGroupId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true };
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
