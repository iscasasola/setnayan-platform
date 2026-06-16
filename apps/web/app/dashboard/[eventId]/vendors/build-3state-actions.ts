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
 * Resolved picks STILL write to the existing `event_build_picks` table so the
 * Compare + Lock tabs are unchanged. No schema change here.
 */

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isBuildState,
  isDimensionKey,
  resolveBuildPicks,
  type BuildRankMode,
  type BuildState,
  type BuildStateMap,
  type QuotedVendor,
} from '@/lib/build-3state';
import {
  buildRequoteNudgeBody,
  selectNudgesToSend,
  type NudgeCandidate,
  type PriorNudge,
} from '@/lib/build-requote-nudge';
import { computeCompatScore } from '@/lib/compat-score';
import { isSetnayanAiActive } from '@/lib/setnayan-ai';
import { isMissingRelationError, logQueryError } from '@/lib/supabase/error-detect';
import { isMultiPickGroup, PLAN_GROUPS } from '@/lib/wedding-plan-groups';

export type Build3StateResult = { ok: true } | { ok: false; error: string };
export type RunBuildResult =
  | { ok: true; filled: number; cleared: number; unfilled: { groupId: string; label: string }[] }
  | { ok: false; error: string };

// Statuses that mean a vendor is already committed/locked — never recomputed.
const COMMITTED_STATUSES = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);

/** Haversine great-circle distance in km (reception anchor → vendor HQ), used
 *  only for the AI-ON compat ranking. Mirrors category-search.ts's distanceKm. */
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Read the couple's 3-state control rows for an event into a
 * `Map<plan_group_id, { state, pinnedVendorId }>`. Rows absent from the table
 * are implicitly Excluded (the default), so the map only carries explicit
 * states. Fails soft → empty map (every row reads as Excluded) on any error.
 */
export async function getCategoryBuildStates(eventId: string): Promise<BuildStateMap> {
  const out: BuildStateMap = new Map();
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  // RLS scopes every read to the couple's own event. The AI-gate fields
  // (planning_mode / setnayan_ai_active) + reception coords are read alongside
  // the budget so the Auto rank mode can switch to compat when Setnayan AI is on.
  const [evRes, vendorsRes, stateRes] = await Promise.all([
    supabase
      .from('events')
      .select(
        'estimated_budget_centavos, planning_mode, setnayan_ai_active, venue_latitude, venue_longitude',
      )
      .eq('event_id', input.eventId)
      .maybeSingle(),
    supabase
      .from('event_vendors')
      .select(
        'vendor_id, category, status, total_cost_php, transport_php, food_allowance_php, marketplace_vendor_id',
      )
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
    marketplace_vendor_id: string | null;
  };
  const vendors = (vendorsRes.data ?? []) as VRow[];

  // ── Setnayan-AI gate → rank mode. AI ON (flag on + assisted) ranks Auto rows
  // by compat-score (reception-anchored distance + reviews + verification +
  // boost); AI OFF keeps the shipped cheapest-fit. The governing gate is the
  // app-wide lib/setnayan-ai.ts so this surface agrees with every other one.
  const aiActive = isSetnayanAiActive(
    evRes.data as { planning_mode?: string | null; setnayan_ai_active?: boolean | null },
  );
  const rankMode: BuildRankMode = aiActive ? 'compat' : 'cheapest';
  const evLat = (evRes.data.venue_latitude as number | null) ?? null;
  const evLng = (evRes.data.venue_longitude as number | null) ?? null;

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
  // event_vendors.vendor_id → its marketplace profile id (compat-score source).
  // Off-platform / custom vendors have none → they fall back to a neutral compat
  // (admit-unknown — never down-ranked just for being off-platform).
  const marketplaceIdByVendor = new Map<string, string>();
  for (const r of vendors) {
    if (r.total_cost_php == null) continue;
    if (r.status && COMMITTED_STATUSES.has(r.status)) continue;
    if (r.category == null) continue;
    const groupId = groupByCategory.get(r.category);
    if (!groupId) continue;
    quoted.push({ vendorId: r.vendor_id, planGroupId: groupId, costPhp: rolled(r) });
    if (r.marketplace_vendor_id) {
      marketplaceIdByVendor.set(r.vendor_id, r.marketplace_vendor_id);
    }
  }

  // ── Compat ranking inputs (AI-ON only). Fetch market stats for the quoted
  // vendors' marketplace profiles, then stamp a HIDDEN compatScore on each
  // QuotedVendor so resolveBuildPicks(rankMode:'compat') ranks the Auto fill by
  // reception-anchored compat instead of plain cheapest. AI-OFF skips this read
  // entirely → behavior byte-identical to today. The score is never returned to
  // the client (sort-only). Fails soft: any read error leaves scores absent →
  // resolveBuildPicks treats them as neutral / falls back to cheapest order.
  if (aiActive && marketplaceIdByVendor.size > 0) {
    const profileIds = [...new Set(marketplaceIdByVendor.values())];
    // vendor_market_stats carries the compat inputs (rating / reviews /
    // visibility / hq coords); the admin client reads it like category-search.
    const admin = createAdminClient();
    const { data: statRows } = await admin
      .from('vendor_market_stats')
      .select(
        'vendor_profile_id, avg_rating_overall, review_count, ad_rank, public_visibility, hq_latitude, hq_longitude',
      )
      .in('vendor_profile_id', profileIds);
    type StatRow = {
      vendor_profile_id: string;
      avg_rating_overall: number | null;
      review_count: number | null;
      ad_rank: number | null;
      public_visibility: string | null;
      hq_latitude: number | null;
      hq_longitude: number | null;
    };
    const statById = new Map<string, StatRow>();
    for (const s of (statRows ?? []) as StatRow[]) {
      statById.set(s.vendor_profile_id, s);
    }
    const hasCoords = evLat !== null && evLng !== null;
    for (const q of quoted) {
      const profileId = marketplaceIdByVendor.get(q.vendorId);
      const stat = profileId ? statById.get(profileId) : undefined;
      if (!stat) {
        // Off-platform / no-stats vendor → leave compatScore absent. In compat
        // mode it sorts after scored vendors but the cost tie-break still places
        // it sensibly (admit-unknown — present, just not preferred).
        continue;
      }
      const dKm =
        hasCoords && stat.hq_latitude != null && stat.hq_longitude != null
          ? haversineKm(evLat as number, evLng as number, stat.hq_latitude, stat.hq_longitude)
          : null;
      const adRank = stat.ad_rank ?? 0;
      const { score } = computeCompatScore({
        distanceKm: dKm,
        avgRating: stat.avg_rating_overall,
        reviewCount: stat.review_count,
        verified: stat.public_visibility === 'verified',
        boosted: adRank > 0,
      });
      q.compatScore = score;
    }
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

  const { picks, clearGroupIds, unfilledAuto, budgetRejected } = resolveBuildPicks({
    states,
    quoted,
    budgetPhp,
    rankMode,
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

  // ── Build 3d-C: the vendor RE-QUOTE NUDGE (fire-and-forget) ────────────────
  // Each Auto category turned away a QUOTED vendor purely on budget (they passed
  // date + location — they're a live, non-committed inquiry the couple
  // solicited). Invite each such vendor (subject to the one-per-(event,vendor,
  // service) reply-gated throttle) to send a fresh proposition, IN their chat
  // thread, as a Setnayan system message. Fired via Next's after() so the [Build]
  // response is already sent — the nudge can NEVER slow or fail the build. The
  // helper never throws; any error is swallowed + logged. Only marketplace-linked
  // vendors (with a thread) are reachable — off-platform vendors are skipped.
  if (budgetRejected.length > 0) {
    // Map each budget-rejected event_vendor → its marketplace profile id (the
    // chat thread's vendor key). Off-platform vendors (no marketplace link) have
    // no thread → dropped here. Snapshot the inputs the after() closure needs so
    // it never reaches back into request-scoped state.
    const rejectedForNudge = budgetRejected
      .map((r) => ({
        planGroupId: r.planGroupId,
        vendorProfileId: marketplaceIdByVendor.get(r.vendorId) ?? null,
      }))
      .filter(
        (r): r is { planGroupId: string; vendorProfileId: string } =>
          r.vendorProfileId !== null,
      );
    if (rejectedForNudge.length > 0) {
      const eventId = input.eventId;
      const labels = new Map(labelByGroup);
      after(() => fireRequoteNudges({ eventId, rejected: rejectedForNudge, labelByGroup: labels }));
    }
  }

  revalidatePath(`/dashboard/${input.eventId}/vendors`);
  return {
    ok: true,
    filled: picks.length,
    cleared: clearGroupIds.length,
    unfilled,
  };
}

/**
 * Build 3d-C — post the vendor re-quote nudge(s) for one [Build] run. ALWAYS
 * fire-and-forget (called from Next's after()): it NEVER throws into the build,
 * is best-effort, and degrades silently if its migration (20270101010000) isn't
 * applied yet. The flag-dark guard lives upstream (runBuild3State returns before
 * resolution when BUILD_3STATE_ENABLED is off), so this is unreachable with the
 * flag OFF.
 *
 * Steps (all via the service-role admin client — the couple's JWT can't read the
 * vendor-side thread rows or write a 'system' message under chat RLS):
 *   1. Resolve each budget-rejected (vendor, plan_group) to its OPEN chat thread
 *      (accepted inquiry). No thread → silently skipped (nowhere to post).
 *   2. Read the throttle ledger (build_requote_nudges) + the per-thread last
 *      nudge/last vendor reply, then `selectNudgesToSend` decides who's eligible
 *      under the reply-gated one-per-(event,vendor,service) throttle.
 *   3. Post the Setnayan system message + upsert the throttle row (refresh
 *      sent_at) for each eligible nudge.
 */
async function fireRequoteNudges(args: {
  eventId: string;
  rejected: ReadonlyArray<{ planGroupId: string; vendorProfileId: string }>;
  labelByGroup: ReadonlyMap<string, string>;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    // 1. Open (accepted) chat threads for the budget-rejected vendors on this
    //    event. The nudge only goes into a live couple↔vendor channel — a
    //    pending/declined inquiry has no two-way thread to invite into.
    const vendorProfileIds = [...new Set(args.rejected.map((r) => r.vendorProfileId))];
    const { data: threadRows, error: threadErr } = await admin
      .from('chat_threads')
      .select('thread_id, vendor_profile_id, inquiry_status')
      .eq('event_id', args.eventId)
      .in('vendor_profile_id', vendorProfileIds);
    if (threadErr) {
      logQueryError(
        'fireRequoteNudges:threads',
        threadErr,
        { event_id: args.eventId, missing_relation: isMissingRelationError(threadErr) },
        'graceful_degrade',
      );
      return;
    }
    const threadByVendor = new Map<string, string>();
    for (const t of (threadRows ?? []) as Array<{
      thread_id: string;
      vendor_profile_id: string;
      inquiry_status: string;
    }>) {
      if (t.inquiry_status !== 'accepted') continue; // only open channels.
      threadByVendor.set(t.vendor_profile_id, t.thread_id);
    }

    // Build the gated candidate list (vendors WITH an open thread).
    const candidates: NudgeCandidate[] = [];
    for (const r of args.rejected) {
      const threadId = threadByVendor.get(r.vendorProfileId);
      if (!threadId) continue; // no open thread → silently skipped.
      candidates.push({
        planGroupId: r.planGroupId,
        vendorProfileId: r.vendorProfileId,
        threadId,
      });
    }
    if (candidates.length === 0) return;

    // 2. Throttle state. Read prior nudges for these (vendor, plan_group) pairs,
    //    then check the reply-gate: a vendor message newer than sent_at re-opens
    //    the service. One batched read of nudges + one of post-nudge vendor
    //    messages keeps this O(1) round-trips regardless of candidate count.
    const { data: nudgeRows, error: nudgeErr } = await admin
      .from('build_requote_nudges')
      .select('vendor_profile_id, plan_group_id, thread_id, sent_at')
      .eq('event_id', args.eventId)
      .in('vendor_profile_id', vendorProfileIds);
    if (nudgeErr) {
      // Pre-migration (table absent) or transient → degrade to "no prior nudges"
      // ONLY if it's a missing-relation; otherwise bail so we never double-nudge.
      logQueryError(
        'fireRequoteNudges:nudges',
        nudgeErr,
        { event_id: args.eventId, missing_relation: isMissingRelationError(nudgeErr) },
        'graceful_degrade',
      );
      if (!isMissingRelationError(nudgeErr)) return;
    }
    type NudgeRow = {
      vendor_profile_id: string;
      plan_group_id: string;
      thread_id: string;
      sent_at: string;
    };
    const priorRows = (nudgeRows ?? []) as NudgeRow[];

    // Reply-gate: for each prior nudge, was there a vendor message after sent_at?
    // Read the most-recent vendor message per thread once, compare timestamps.
    const priorThreadIds = [...new Set(priorRows.map((p) => p.thread_id))];
    const lastVendorReplyAt = new Map<string, string>();
    if (priorThreadIds.length > 0) {
      const { data: msgRows } = await admin
        .from('chat_messages')
        .select('thread_id, created_at')
        .in('thread_id', priorThreadIds)
        .eq('sender_role', 'vendor')
        .order('created_at', { ascending: false });
      for (const m of (msgRows ?? []) as Array<{ thread_id: string; created_at: string }>) {
        if (!lastVendorReplyAt.has(m.thread_id)) lastVendorReplyAt.set(m.thread_id, m.created_at);
      }
    }
    const priorNudges: PriorNudge[] = priorRows.map((p) => {
      const reply = lastVendorReplyAt.get(p.thread_id);
      return {
        vendorProfileId: p.vendor_profile_id,
        planGroupId: p.plan_group_id,
        repliedSince: reply != null && new Date(reply) > new Date(p.sent_at),
      };
    });

    const toSend = selectNudgesToSend({ candidates, priorNudges });
    if (toSend.length === 0) return;

    // 3. Couple display name for the copy (already visible to the vendor on the
    //    thread — no PII leak). Fail soft to a generic label.
    const { data: ev } = await admin
      .from('events')
      .select('display_name')
      .eq('event_id', args.eventId)
      .maybeSingle();
    const coupleLabel = (ev?.display_name as string | undefined)?.trim() || 'A couple';

    for (const n of toSend) {
      const categoryLabel = args.labelByGroup.get(n.planGroupId) ?? 'this service';
      const body = buildRequoteNudgeBody({ coupleLabel, categoryLabel });

      // Post the Setnayan system message into the thread. sender_role='system'
      // renders as a centered Setnayan note (not "from the couple") and does NOT
      // trip the vendor-first-reply name-reveal trigger.
      const { error: msgErr } = await admin.from('chat_messages').insert({
        thread_id: n.threadId,
        event_id: args.eventId,
        vendor_profile_id: n.vendorProfileId,
        sender_user_id: null,
        sender_role: 'system',
        body,
      });
      if (msgErr) {
        // 22P02 here means the 'system' enum value isn't applied yet → skip this
        // nudge (and the throttle stamp) so a later run retries cleanly.
        logQueryError(
          'fireRequoteNudges:message',
          msgErr,
          { thread_id: n.threadId, missing_relation: isMissingRelationError(msgErr) },
          'graceful_degrade',
        );
        continue;
      }

      // Stamp / refresh the throttle row (one per event,vendor,service).
      const { error: upErr } = await admin.from('build_requote_nudges').upsert(
        {
          event_id: args.eventId,
          vendor_profile_id: n.vendorProfileId,
          plan_group_id: n.planGroupId,
          thread_id: n.threadId,
          sent_at: new Date().toISOString(),
        },
        { onConflict: 'event_id,vendor_profile_id,plan_group_id' },
      );
      if (upErr) {
        logQueryError(
          'fireRequoteNudges:throttle',
          upErr,
          { event_id: args.eventId, missing_relation: isMissingRelationError(upErr) },
          'graceful_degrade',
        );
      }
    }
  } catch (caught) {
    // The nudge is best-effort; NEVER let it surface from the after() callback.
    logQueryError(
      'fireRequoteNudges (threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { event_id: args.eventId },
      'graceful_degrade',
    );
  }
}
