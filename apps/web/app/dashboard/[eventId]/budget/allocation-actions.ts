'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Budget Planner — couple snapshot save (the Layer-1 behavioral capture).
 *
 * The client runs the pure engine and holds the full per-leaf state, so this
 * action takes a typed object (not FormData). One snapshot_id groups every leaf
 * saved together. RLS on budget_allocation_decisions enforces couple-own-only +
 * recorded_by = auth.uid(); this action just shapes + inserts the rows.
 *
 * Design: Budget_Planner_Allocation_Engine_2026-06-05.md §6.
 */

export type SnapshotLeaf = {
  canonicalService: string;
  recommendedAmountPhp: number | null;
  finalAmountPhp: number | null;
  recommendedShareBp: number | null;
  finalShareBp: number | null;
  wasPinned: boolean;
  /** 1 = first leaf the couple touched (the priority signal). */
  pinOrder: number | null;
};

export type SaveSnapshotResult = { ok: true; count: number } | { ok: false; error: string };

export async function saveAllocationSnapshot(input: {
  eventId: string;
  totalBudgetPhp: number | null;
  region: string | null;
  pax: number | null;
  leaves: SnapshotLeaf[];
}): Promise<SaveSnapshotResult> {
  if (!input.leaves || input.leaves.length === 0) {
    return { ok: false, error: 'Nothing to save yet.' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in to save your plan.' };

  const snapshotId = crypto.randomUUID();
  const rows = input.leaves.map((l) => ({
    snapshot_id: snapshotId,
    event_id: input.eventId,
    recorded_by: user.id,
    canonical_service: l.canonicalService,
    recommended_amount_php: l.recommendedAmountPhp,
    final_amount_php: l.finalAmountPhp,
    recommended_share_bp: l.recommendedShareBp,
    final_share_bp: l.finalShareBp,
    was_pinned: l.wasPinned,
    pin_order: l.pinOrder,
    total_budget_php: input.totalBudgetPhp,
    region: input.region,
    pax: input.pax,
    event_type: 'wedding',
  }));

  const { error } = await supabase.from('budget_allocation_decisions').insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/${input.eventId}/budget`);
  return { ok: true, count: rows.length };
}
