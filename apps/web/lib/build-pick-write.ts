/**
 * Build-pick write cores — the only mutators of `event_build_picks` for the
 * per-pick add / pin / remove flows. (The deliberate WHOLE-build resets —
 * `applyBuildToWorking` and `clearBuildPicks` — stay open-coded in the action
 * file: they are explicit, user-confirmed clears, not silent sibling deletes.)
 * Extracted out of the `'use server'` action file so the multi-pick data-loss
 * guard is unit-testable with a fake client
 * (`build-pick-write.test.ts`) — the server actions in `build-pick-actions.ts`
 * are thin wrappers that add auth + revalidation.
 *
 * Why this exists: a multi-pick category (Look / Booths / Prints) holds several
 * vendor picks. Any delete that isn't scoped to a single `vendor_id` would wipe
 * the couple's OTHER picks in that category. These cores funnel every such write
 * through `replacesSiblingsOnPin`, and `removeBuildPickRow` REQUIRES a vendorId,
 * so there is no longer an API path that can silently clear a whole category.
 */
import type { createClient } from '@/lib/supabase/server';
import { replacesSiblingsOnPin } from '@/lib/build-pick-rules';

/** The Supabase server client (typed against the generated DB schema). */
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * `event_build_picks` PK = (event_id, plan_group_id, vendor_id) since migration
 * 20261020000000. The upsert MUST conflict on all three columns — a 2-column
 * onConflict would collapse a multi-pick category back to one row.
 */
export const BUILD_PICK_ON_CONFLICT = 'event_id,plan_group_id,vendor_id';

/**
 * Pin one vendor into a build category, applying the multi-pick guard.
 *   • single-pick → clear the category's OTHER picks first (replace), then upsert
 *   • multi-pick  → NEVER clear siblings — just upsert this one vendor
 * Returns an error message, or null on success.
 */
export async function pinBuildPickRow(
  supabase: SupabaseServerClient,
  input: {
    eventId: string;
    planGroupId: string;
    vendorId: string;
    pickedBy: string;
    now: string;
  },
): Promise<string | null> {
  if (replacesSiblingsOnPin(input.planGroupId)) {
    const { error: delErr } = await supabase
      .from('event_build_picks')
      .delete()
      .eq('event_id', input.eventId)
      .eq('plan_group_id', input.planGroupId)
      .neq('vendor_id', input.vendorId);
    if (delErr) return delErr.message;
  }

  const { error } = await supabase.from('event_build_picks').upsert(
    {
      event_id: input.eventId,
      plan_group_id: input.planGroupId,
      vendor_id: input.vendorId,
      picked_by: input.pickedBy,
      updated_at: input.now,
    },
    { onConflict: BUILD_PICK_ON_CONFLICT },
  );
  return error ? error.message : null;
}

/**
 * Take exactly ONE vendor's pick off the build. `vendorId` is REQUIRED on
 * purpose: there is deliberately no "omit the vendor to clear the whole
 * category" path, because that silently destroyed a couple's other picks in
 * multi-pick categories. Whole-build reset is a separate, explicit action
 * (`clearBuildPicks`). Returns an error message, or null on success.
 */
export async function removeBuildPickRow(
  supabase: SupabaseServerClient,
  input: { eventId: string; planGroupId: string; vendorId: string },
): Promise<string | null> {
  const { error } = await supabase
    .from('event_build_picks')
    .delete()
    .eq('event_id', input.eventId)
    .eq('plan_group_id', input.planGroupId)
    .eq('vendor_id', input.vendorId);
  return error ? error.message : null;
}
