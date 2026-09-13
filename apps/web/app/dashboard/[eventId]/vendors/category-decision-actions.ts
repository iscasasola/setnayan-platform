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
import {
  archiveStamp,
  threadsToArchive,
  threadsToRestore,
} from '@/lib/category-archive';

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

  // ONE stamp, written twice: to the decision row, and to every thread this
  // removal archives. `restoreTileToPlan` matches on it to bring back exactly
  // these conversations and no others.
  const stamp = archiveStamp();

  // 🔑 THE DECISION ROW IS WRITTEN FIRST, DELIBERATELY. If threads were
  // archived before it and the upsert then failed, those conversations would
  // carry a stamp no decision row holds — invisible to the couple and
  // unreachable by any restore. Excluding first means the worst case is a
  // category removed with its threads still active, which the couple can see
  // and undo. Never reorder these two.
  const { error } = await supabase.from('event_category_decisions').upsert(
    {
      event_id: input.eventId,
      tile: input.tile,
      decision: 'excluded',
      decided_at: stamp,
    },
    { onConflict: 'event_id,tile' },
  );
  if (error) return { ok: false, error: error.message };

  await archiveCategoryThreads(supabase, input.eventId, categories, stamp);

  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  revalidatePath(`/dashboard/${input.eventId}/messages`);
  return { ok: true };
}

/**
 * Archive (never delete) the couple's conversations with the vendors in a
 * category being removed — owner 2026-09-06: *"yes archive the conversations
 * too."*
 *
 * Reuses the mechanism `withdrawInquiry` established 2026-07-24: stamp
 * `chat_threads.archived_at`. The conversation is the dispute/evidence record
 * and the source of the couple-confirmed booking amount, and the vendor is its
 * other party — there is no DELETE policy on `chat_threads` at all.
 *
 * FAIL-SOFT BY DESIGN: the category removal is the action the couple asked
 * for; a failed archive must not undo it. A thread left active is visible and
 * fixable. RLS scopes every statement to the couple's own event.
 *
 * The caller has already proven the category holds no LOCKED vendor
 * (`REMOVE_BLOCKED_LOCKED`, fail-closed), so a booked supplier's thread can
 * never reach this function.
 */
async function archiveCategoryThreads(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  categories: ReadonlyArray<string>,
  stamp: string,
): Promise<void> {
  if (categories.length === 0) return;

  const { data: vendorRows, error: vErr } = await supabase
    .from('event_vendors')
    .select('marketplace_vendor_id')
    .eq('event_id', eventId)
    .in('category', categories as string[]);
  if (vErr || !vendorRows?.length) return;

  const profileIds = vendorRows
    .map((v) => v.marketplace_vendor_id)
    .filter((id): id is string => !!id);
  if (profileIds.length === 0) return;

  const { data: threads, error: tErr } = await supabase
    .from('chat_threads')
    .select('thread_id, vendor_profile_id, archived_at')
    .eq('event_id', eventId)
    .in('vendor_profile_id', profileIds);
  if (tErr || !threads?.length) return;

  const targets = threadsToArchive({ vendors: vendorRows, threads });
  if (targets.length === 0) return;

  await supabase
    .from('chat_threads')
    .update({ archived_at: stamp })
    .eq('event_id', eventId)
    .in('thread_id', targets);
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

  // Read the stamp BEFORE deleting the row — it is the only link back to the
  // conversations this exclusion archived, and deleting the row destroys it.
  const { data: decision } = await supabase
    .from('event_category_decisions')
    .select('decided_at')
    .eq('event_id', input.eventId)
    .eq('tile', input.tile)
    .maybeSingle();
  const stamp = (decision?.decided_at as string | undefined) ?? null;

  const { error } = await supabase
    .from('event_category_decisions')
    .delete()
    .eq('event_id', input.eventId)
    .eq('tile', input.tile);
  if (error) return { ok: false, error: error.message };

  // Un-archive ONLY the threads carrying this exclusion's stamp. A thread the
  // couple withdrew themselves has a different timestamp and stays archived —
  // restoring a category must never overturn a decision they made on purpose.
  if (stamp) {
    const categories = categoriesForTile(input.tile);
    if (categories.length > 0) {
      const { data: vendorRows } = await supabase
        .from('event_vendors')
        .select('marketplace_vendor_id')
        .eq('event_id', input.eventId)
        .in('category', categories as string[]);
      const profileIds = (vendorRows ?? [])
        .map((v) => v.marketplace_vendor_id)
        .filter((id): id is string => !!id);
      if (profileIds.length > 0) {
        const { data: threads } = await supabase
          .from('chat_threads')
          .select('thread_id, vendor_profile_id, archived_at')
          .eq('event_id', input.eventId)
          .in('vendor_profile_id', profileIds);
        const targets = threadsToRestore({ threads: threads ?? [], stamp });
        if (targets.length > 0) {
          await supabase
            .from('chat_threads')
            .update({ archived_at: null })
            .eq('event_id', input.eventId)
            .in('thread_id', targets);
        }
      }
    }
  }

  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  revalidatePath(`/dashboard/${input.eventId}/messages`);
  return { ok: true };
}
