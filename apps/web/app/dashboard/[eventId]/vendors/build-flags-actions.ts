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
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';

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

// ── Budget-aware COMPUTE: assemble the build FROM THE SHORTLIST ──────────────
// Owner 2026-06-09: the Build "Compute" auto-fills each FLAGGED category with
// ONE shortlisted service that fits the PINNED budget — "auto generate 1
// possible combination … following the rules of what are pinned". The build
// REFERENCES the shortlist (owner: "it only references the list from the
// shortlist") — so this never searches the marketplace; it picks from what the
// couple already shortlisted. When a flagged category has no shortlisted option
// that fits, it's returned in `noCompatible` so the UI can offer
// "[Find Compatible] / [Remove Flag]" (Find Compatible is the marketplace
// escape hatch — the existing generateFlaggedVendors / category search).
//
// Budget math: remaining = pinned budget − (locked picks + already-pinned build
// picks). Locked + pinned categories are NOT recomputed (the owner's "already
// locked … will not be counted to the budget to build but will show there"). No
// budget set → no budget constraint (fill each flagged category with its best
// shortlisted option). Greedy cheapest-first so the most categories get filled.
export type ComputeResult =
  | {
      ok: true;
      filled: number;
      noCompatible: { groupId: string; label: string }[];
    }
  | { ok: false; error: string };

const COMPUTE_LOCKED = new Set([
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
]);

export async function computeBuildFromShortlist(input: {
  eventId: string;
}): Promise<ComputeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  // RLS scopes every read to the couple's own event (membership = readability).
  const [evRes, vendorsRes, flagsRes, picksRes] = await Promise.all([
    supabase
      .from('events')
      .select('estimated_budget_centavos')
      .eq('event_id', input.eventId)
      .maybeSingle(),
    supabase
      .from('event_vendors')
      .select('vendor_id, category, status, total_cost_php, transport_php, food_allowance_php')
      .eq('event_id', input.eventId),
    supabase
      .from('budget_category_flags')
      .select('plan_group_id')
      .eq('event_id', input.eventId),
    supabase
      .from('event_build_picks')
      .select('plan_group_id, vendor_id')
      .eq('event_id', input.eventId),
  ]);

  if (!evRes.data) return { ok: false, error: 'Could not load this event.' };

  type VRow = {
    vendor_id: string;
    category: string | null;
    status: string | null;
    total_cost_php: number | string | null;
    transport_php: number | string | null;
    food_allowance_php: number | string | null;
  };
  const vendors = (vendorsRes.data ?? []) as VRow[];
  const flaggedGroups = ((flagsRes.data ?? []) as Array<{ plan_group_id: string }>).map(
    (r) => r.plan_group_id,
  );
  const buildPicks = (picksRes.data ?? []) as Array<{ plan_group_id: string; vendor_id: string }>;

  const num = (v: number | string | null): number => {
    const n = typeof v === 'string' ? Number(v) : (v ?? 0);
    return Number.isFinite(n) ? (n as number) : 0;
  };
  const rolled = (r: VRow) =>
    num(r.total_cost_php) + num(r.transport_php) + num(r.food_allowance_php);
  const costByVendor = new Map<string, number>();
  const catByVendor = new Map<string, string | null>();
  const statusByVendor = new Map<string, string | null>();
  for (const r of vendors) {
    costByVendor.set(r.vendor_id, rolled(r));
    catByVendor.set(r.vendor_id, r.category);
    statusByVendor.set(r.vendor_id, r.status);
  }

  // Committed = locked picks + already-pinned build picks (counted once). These
  // are shown on the build but never recomputed — they reserve budget.
  const pinnedGroupIds = new Set(buildPicks.map((p) => p.plan_group_id));
  const pinnedVendorIds = new Set(buildPicks.map((p) => p.vendor_id));
  const counted = new Set<string>();
  let committed = 0;
  for (const r of vendors) {
    if (r.status && COMPUTE_LOCKED.has(r.status)) {
      committed += rolled(r);
      counted.add(r.vendor_id);
    }
  }
  for (const vid of pinnedVendorIds) {
    if (!counted.has(vid)) {
      committed += costByVendor.get(vid) ?? 0;
      counted.add(vid);
    }
  }

  const budgetPhp =
    evRes.data.estimated_budget_centavos != null
      ? Math.round((evRes.data.estimated_budget_centavos as number) / 100)
      : null;
  let remaining = budgetPhp != null ? budgetPhp - committed : null;

  // Candidate shortlist rows per category enum (status not locked, not already a
  // pinned build pick, not already chosen this run).
  const usedVendors = new Set<string>(pinnedVendorIds);
  const noCompatible: { groupId: string; label: string }[] = [];
  const toUpsert: Array<{ plan_group_id: string; vendor_id: string }> = [];

  // Only fill FLAGGED categories that aren't already pinned.
  for (const groupId of flaggedGroups) {
    if (pinnedGroupIds.has(groupId)) continue;
    const group = PLAN_GROUPS.find((g) => g.id === groupId);
    if (!group) continue;
    const cats = new Set<string>(group.categories as ReadonlyArray<string>);

    const candidates = vendors
      .filter(
        (r) =>
          r.category != null &&
          cats.has(r.category) &&
          // Rule (owner 2026-06-09): only services the vendor has RESPONDED with a
          // price for are build-eligible — a price-less inquiry can't be computed
          // into the build. total_cost_php is the vendor's responded package price.
          r.total_cost_php != null &&
          !(r.status && COMPUTE_LOCKED.has(r.status)) &&
          !usedVendors.has(r.vendor_id),
      )
      .map((r) => ({ vendorId: r.vendor_id, cost: rolled(r) }))
      // Cheapest-first → maximize the number of categories we can fill in budget.
      .sort((a, b) => a.cost - b.cost);

    const pick =
      remaining != null
        ? candidates.find((c) => c.cost <= (remaining as number))
        : candidates[0];

    if (!pick) {
      noCompatible.push({ groupId, label: group.label });
      continue;
    }
    toUpsert.push({ plan_group_id: groupId, vendor_id: pick.vendorId });
    usedVendors.add(pick.vendorId);
    if (remaining != null) remaining -= pick.cost;
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase.from('event_build_picks').upsert(
      toUpsert.map((p) => ({
        event_id: input.eventId,
        plan_group_id: p.plan_group_id,
        vendor_id: p.vendor_id,
        picked_by: user.id,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'event_id,plan_group_id' },
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true, filled: toUpsert.length, noCompatible };
}
