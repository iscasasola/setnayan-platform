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
