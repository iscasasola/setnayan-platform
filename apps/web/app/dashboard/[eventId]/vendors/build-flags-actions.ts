'use server';

/**
 * Budget "Build" — per-category FLAG actions (Lock vs Flag · plan §12).
 * Backs `budget_category_flags` (migration 20261006000000). A flag = "fill this
 * category for me." This file is just the marker (request); the generation that
 * writes to event_vendors is PR-2. Couple-own RLS enforces ownership.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type FlagActionResult = { ok: true } | { ok: false; error: string };

export async function flagCategory(input: {
  eventId: string;
  planGroupId: string;
}): Promise<FlagActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  // ON CONFLICT DO NOTHING (re-flagging an already-flagged category is a no-op) —
  // needs only the INSERT policy, no UPDATE policy.
  const { error } = await supabase.from('budget_category_flags').upsert(
    { event_id: input.eventId, plan_group_id: input.planGroupId, flagged_by: user.id },
    { onConflict: 'event_id,plan_group_id', ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true };
}

export async function unflagCategory(input: {
  eventId: string;
  planGroupId: string;
}): Promise<FlagActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const { error } = await supabase
    .from('budget_category_flags')
    .delete()
    .eq('event_id', input.eventId)
    .eq('plan_group_id', input.planGroupId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true };
}
