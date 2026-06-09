'use server';

/**
 * Budget "Build" — per-category FLAG actions (Lock vs Flag · plan §12).
 * Backs `budget_category_flags` (migration 20261006000000). A flag = "fill this
 * category for me." This file is just the marker (request); the generation that
 * writes to event_vendors is PR-2. Couple-own RLS enforces ownership.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isSetnayanAiActive } from '@/lib/setnayan-ai';
import { searchCategoryVendors } from './_actions/category-search';
import { attachMarketplaceVendorToCategory } from './actions';

export type FlagActionResult = { ok: true } | { ok: false; error: string };
export type GenerateResult =
  | { ok: true; added: number; skipped: number }
  | { ok: false; error: string };

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

/**
 * GENERATE vendors for the couple's FLAGGED categories (Lock vs Flag · plan §12, PR-2).
 * Setnayan-AI path only (server-verified gate). For each flagged category: take the top
 * ranked, not-yet-added match (`searchCategoryVendors`) and attach it to the Shortlist via
 * the PROVEN `attachMarketplaceVendorToCategory` — which validates the category (rejects
 * invalid → we skip, never mis-categorize), dedups ('already_attached'), and stamps source.
 * Non-destructive: writes only event_vendors 'considering' (the bench), couple-removable.
 */
export async function generateFlaggedVendors(input: {
  eventId: string;
}): Promise<GenerateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  // Server-verify the paid gate (never trust the client).
  const { data: ev } = await supabase
    .from('events')
    .select('planning_mode, setnayan_ai_active')
    .eq('event_id', input.eventId)
    .maybeSingle();
  const aiOn = isSetnayanAiActive(
    (ev ?? null) as { planning_mode?: string | null; setnayan_ai_active?: boolean | null } | null,
  );
  if (!aiOn) {
    return { ok: false, error: 'Turn on Setnayan AI to auto-fill flagged categories.' };
  }

  const { data: flagRows } = await supabase
    .from('budget_category_flags')
    .select('plan_group_id')
    .eq('event_id', input.eventId);
  const groups = ((flagRows ?? []) as Array<{ plan_group_id: string }>).map((r) => r.plan_group_id);

  let added = 0;
  let skipped = 0;
  for (const groupId of groups) {
    try {
      const search = await searchCategoryVendors({ eventId: input.eventId, groupId });
      const top = search.results.find((v) => !v.alreadyAdded);
      if (!top) {
        skipped += 1;
        continue;
      }
      const fd = new FormData();
      fd.set('event_id', input.eventId);
      fd.set('marketplace_vendor_id', top.vendorProfileId);
      // Pass the group as the category — the add-action validates it (isValidCategory)
      // and rejects anything not a real leaf, so we can never mis-categorize.
      fd.set('category', groupId);
      const res = await attachMarketplaceVendorToCategory(fd);
      if (res.status === 'ok' || res.status === 'already_attached') added += 1;
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  }

  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true, added, skipped };
}
