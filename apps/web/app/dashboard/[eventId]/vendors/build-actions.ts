'use server';

/**
 * Budget "Build" — save/delete A/B/C build snapshots (Services takeover · Compare).
 * Spec: `Budget_Build_Services_Takeover_2026-06-08.md`. Backs the `budget_builds`
 * table (migration 20260926000000). RLS enforces couple-own + created_by = uid;
 * these actions just shape + write. Consumed only behind BUDGET_BUILD_ENABLED.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type BuildBasket = 'lean' | 'fits' | 'stretch';
export type BuildSlot = 'A' | 'B' | 'C';

export type BuildSnapshotLeaf = {
  canonicalService: string;
  label: string;
  amountPhp: number;
  rangeLowPhp: number;
  rangeHighPhp: number;
};

export type BuildSnapshot = {
  budgetPhp: number | null;
  basket: BuildBasket;
  totalPhp: number;
  leaves: BuildSnapshotLeaf[];
};

/** Row shape the Compare tab reads back (server-fetched, passed as a prop). */
export type SavedBuild = {
  build_id: string;
  label: BuildSlot;
  title: string | null;
  budget_php: number | null;
  basket: BuildBasket;
  total_php: number | null;
};

export type BuildActionResult = { ok: true } | { ok: false; error: string };

export async function saveBudgetBuild(input: {
  eventId: string;
  label: BuildSlot;
  title?: string | null;
  snapshot: BuildSnapshot;
}): Promise<BuildActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in to save a build.' };

  const { error } = await supabase.from('budget_builds').upsert(
    {
      event_id: input.eventId,
      created_by: user.id,
      label: input.label,
      title: input.title ?? `Build ${input.label}`,
      budget_php: input.snapshot.budgetPhp,
      basket: input.snapshot.basket,
      total_php: input.snapshot.totalPhp,
      snapshot: input.snapshot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id,label' },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true };
}

export async function deleteBudgetBuild(input: {
  eventId: string;
  buildId: string;
}): Promise<BuildActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const { error } = await supabase.from('budget_builds').delete().eq('build_id', input.buildId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true };
}
