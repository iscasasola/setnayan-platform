'use server';

/**
 * Build 3-State Solver — server actions (Phase 3d-A · Build_3State_Solver_2026-06-16.md).
 *
 * Backs `event_category_build_state` (migration 20261230000000 — ALREADY in prod):
 * one per-(event, plan_group_id) row holding the tri-state control
 * (Locked / Auto / Excluded) + the Locked taxonomy pick (`pinned_vendor_id`).
 * Couple-own RLS (the migration's policies scope every read/write to the
 * couple's own event + stamp `set_by = auth.uid()`).
 *
 * ── FLAG-DARK ───────────────────────────────────────────────────────────────
 * Every action re-checks `isBuild3StateEnabled()` and refuses when the flag is
 * OFF (default). The legacy Flag/Compute path (build-flags-actions.ts) is the
 * live Build until the flag is flipped, so these actions are unreachable today.
 *
 * Resolved picks STILL write to the existing `event_build_picks` table so the
 * Compare + Lock tabs are unchanged. No schema change here.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  isBuild3StateEnabled,
  isBuildState,
  isDimensionKey,
  resolveBuildPicks,
  type BuildState,
  type BuildStateMap,
  type QuotedVendor,
} from '@/lib/build-3state';
import { isMultiPickGroup, PLAN_GROUPS } from '@/lib/wedding-plan-groups';

export type Build3StateResult = { ok: true } | { ok: false; error: string };
export type RunBuildResult =
  | { ok: true; filled: number; cleared: number; unfilled: { groupId: string; label: string }[] }
  | { ok: false; error: string };

const FLAG_OFF_ERROR = 'The 3-state Build is not available.';

// Statuses that mean a vendor is already committed/locked — never recomputed,
// mirrors COMPUTE_LOCKED in build-flags-actions.ts.
const COMMITTED_STATUSES = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);

/**
 * Read the couple's 3-state control rows for an event into a
 * `Map<plan_group_id, { state, pinnedVendorId }>`. Rows absent from the table
 * are implicitly Excluded (the default), so the map only carries explicit
 * states. Fails soft → empty map (every row reads as Excluded) on any error.
 */
export async function getCategoryBuildStates(eventId: string): Promise<BuildStateMap> {
  const out: BuildStateMap = new Map();
  if (!isBuild3StateEnabled()) return out;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('event_category_build_state')
    .select('plan_group_id, state, pinned_vendor_id')
    .eq('event_id', eventId);
  if (error || !data) return out;
  for (const r of data as Array<{
    plan_group_id: string;
    state: string;
    pinned_vendor_id: string | null;
  }>) {
    if (!isBuildState(r.state)) continue;
    out.set(r.plan_group_id, {
      state: r.state,
      pinnedVendorId: r.pinned_vendor_id ?? null,
    });
  }
  return out;
}

/**
 * Set (upsert) one row's state. Locked taxonomy rows carry a `pinnedVendorId`
 * (one of the category's quoted inquiries); Auto/Excluded + dimension rows pass
 * null. `set_by` is stamped server-side from the auth uid (required by the
 * INSERT WITH CHECK policy). Upsert onConflict matches the PK (event, group).
 */
export async function setCategoryBuildState(input: {
  eventId: string;
  planGroupId: string;
  state: BuildState;
  pinnedVendorId?: string | null;
}): Promise<Build3StateResult> {
  if (!isBuild3StateEnabled()) return { ok: false, error: FLAG_OFF_ERROR };
  if (!isBuildState(input.state)) return { ok: false, error: 'Unknown state.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  // A Locked TAXONOMY row REQUIRES a concrete pick (§4). Dimension rows lock a
  // value on `events` (handled by the anchor editors) and never carry a vendor.
  let pinnedVendorId: string | null = input.pinnedVendorId ?? null;
  if (isDimensionKey(input.planGroupId)) {
    pinnedVendorId = null;
  } else if (input.state === 'locked' && !pinnedVendorId) {
    return { ok: false, error: 'Choose a quoted vendor to lock this category.' };
  }
  if (input.state !== 'locked') pinnedVendorId = null;

  const { error } = await supabase.from('event_category_build_state').upsert(
    {
      event_id: input.eventId,
      plan_group_id: input.planGroupId,
      state: input.state,
      pinned_vendor_id: pinnedVendorId,
      set_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id,plan_group_id' },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true };
}

/**
 * [Reset] — delete every state row for the event → all rows read as Excluded
 * (the implicit default). Does NOT touch `event_build_picks`, the shortlist, or
 * locked vendors; the next [Build] reconciles picks from the (now-empty) states.
 */
export async function resetBuildStates(input: { eventId: string }): Promise<Build3StateResult> {
  if (!isBuild3StateEnabled()) return { ok: false, error: FLAG_OFF_ERROR };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const { error } = await supabase
    .from('event_category_build_state')
    .delete()
    .eq('event_id', input.eventId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return { ok: true };
}

/**
 * [Build] — resolve the 3-state map against the couple's quoted inquiries +
 * budget, then reconcile `event_build_picks`:
 *   • LOCKED taxonomy rows → write the pinned vendor.
 *   • AUTO rows → OFF solver: cheapest quoted vendor that fits the remaining
 *     budget (multi-pick groups may take several), reusing the shipped logic via
 *     the pure `resolveBuildPicks`.
 *   • EXCLUDED rows → ensure no build pick remains for them.
 *
 * The resolution is the pure, unit-tested `resolveBuildPicks`; this action is
 * just the DB read + write around it. Honors `isMultiPickGroup` so a multi-pick
 * group's other picks are never clobbered (the live data-loss guard).
 */
export async function runBuild3State(input: { eventId: string }): Promise<RunBuildResult> {
  if (!isBuild3StateEnabled()) return { ok: false, error: FLAG_OFF_ERROR };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  // RLS scopes every read to the couple's own event.
  const [evRes, vendorsRes, stateRes] = await Promise.all([
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
      .from('event_category_build_state')
      .select('plan_group_id, state, pinned_vendor_id')
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

  const num = (v: number | string | null): number => {
    const n = typeof v === 'string' ? Number(v) : (v ?? 0);
    return Number.isFinite(n) ? (n as number) : 0;
  };
  const rolled = (r: VRow) =>
    num(r.total_cost_php) + num(r.transport_php) + num(r.food_allowance_php);

  // Map each VendorCategory enum → its PlanGroupId (so quoted vendors bucket the
  // same way the row sourcing does). Entry-point groups have empty categories,
  // so a vendor resolves to the single primary group that owns its category.
  const groupByCategory = new Map<string, string>();
  for (const g of PLAN_GROUPS) {
    for (const c of g.categories) groupByCategory.set(c, g.id);
  }

  // Quoted-inquiry gate (§3): only vendors with a quote (total_cost_php != null)
  // that aren't already committed/locked are build-eligible.
  const quoted: QuotedVendor[] = [];
  for (const r of vendors) {
    if (r.total_cost_php == null) continue;
    if (r.status && COMMITTED_STATUSES.has(r.status)) continue;
    if (r.category == null) continue;
    const groupId = groupByCategory.get(r.category);
    if (!groupId) continue;
    quoted.push({ vendorId: r.vendor_id, planGroupId: groupId, costPhp: rolled(r) });
  }

  const states: BuildStateMap = new Map();
  for (const r of (stateRes.data ?? []) as Array<{
    plan_group_id: string;
    state: string;
    pinned_vendor_id: string | null;
  }>) {
    if (!isBuildState(r.state)) continue;
    states.set(r.plan_group_id, { state: r.state, pinnedVendorId: r.pinned_vendor_id ?? null });
  }

  const budgetPhp =
    evRes.data.estimated_budget_centavos != null
      ? Math.round((evRes.data.estimated_budget_centavos as number) / 100)
      : null;

  const { picks, clearGroupIds, unfilledAuto } = resolveBuildPicks({
    states,
    quoted,
    budgetPhp,
  });

  // ── Write phase. Clear excluded groups, replace single-pick groups, insert. ──
  // EXCLUDED groups: remove every build pick.
  for (const groupId of clearGroupIds) {
    const { error } = await supabase
      .from('event_build_picks')
      .delete()
      .eq('event_id', input.eventId)
      .eq('plan_group_id', groupId);
    if (error) return { ok: false, error: error.message };
  }

  // For SINGLE-pick groups we resolve, clear the group's OTHER picks first so the
  // resolved vendor becomes THE pick (the PK is (event, group, vendor), so an
  // upsert alone would not displace a different vendor). Multi-pick groups keep
  // every resolved pick (and we never clobber the couple's existing ones — the
  // live data-loss guard from build-pick-actions.ts).
  const resolvedVendorsByGroup = new Map<string, Set<string>>();
  for (const p of picks) {
    const s = resolvedVendorsByGroup.get(p.planGroupId);
    if (s) s.add(p.vendorId);
    else resolvedVendorsByGroup.set(p.planGroupId, new Set([p.vendorId]));
  }
  for (const [groupId, vendorSet] of resolvedVendorsByGroup) {
    if (isMultiPickGroup(groupId)) continue; // multi-pick: leave others in place.
    // Single-pick groups resolve to exactly ONE vendor (resolveBuildPicks breaks
    // after the first fit), so clear the group's OTHER picks with `.neq` —
    // identical to the shipped single-pick replacement in build-pick-actions.ts.
    const keep = [...vendorSet][0]!;
    const { error } = await supabase
      .from('event_build_picks')
      .delete()
      .eq('event_id', input.eventId)
      .eq('plan_group_id', groupId)
      .neq('vendor_id', keep);
    if (error) return { ok: false, error: error.message };
  }

  if (picks.length > 0) {
    // onConflict matches the 3-col PK (event, group, vendor) per migration
    // 20261020000000 — identical to build-pick-actions.ts.
    const { error } = await supabase.from('event_build_picks').upsert(
      picks.map((p) => ({
        event_id: input.eventId,
        plan_group_id: p.planGroupId,
        vendor_id: p.vendorId,
        picked_by: user.id,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'event_id,plan_group_id,vendor_id' },
    );
    if (error) return { ok: false, error: error.message };
  }

  // Resolve unfilled-Auto group ids to labels for the UI prompt.
  const labelByGroup = new Map(PLAN_GROUPS.map((g) => [g.id as string, g.label]));
  const unfilled = unfilledAuto.map((groupId) => ({
    groupId,
    label: labelByGroup.get(groupId) ?? groupId,
  }));

  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return {
    ok: true,
    filled: picks.length,
    cleared: clearGroupIds.length,
    unfilled,
  };
}
