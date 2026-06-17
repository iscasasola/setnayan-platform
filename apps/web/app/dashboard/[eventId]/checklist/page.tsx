import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchChecklistItems, groupChecklistByPhase, CHECKLIST_BUDGET_TIERS } from '@/lib/checklist';
import { ensureChecklistSeeded } from '../checklist-actions';
import { ChecklistFull } from '../_components/checklist/checklist-full';
import { resolveCategoryState, type CategoryDecision } from '@/lib/checklist-state';
import { PLAN_GROUPS, planGroupForCategory } from '@/lib/wedding-plan-groups';
import { getEventInterestedPlanGroups } from '@/lib/checklist-taxonomy';
import type { VendorCategory } from '@/lib/vendors';

export const metadata = { title: 'Wedding checklist · Setnayan' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * /dashboard/[eventId]/checklist — the full, browsable wedding checklist.
 *
 * The home card shows only the top-3 urgent items; this is the complete list,
 * grouped by countdown phase. Visiting also top-ups any tasks the event is
 * missing (idempotent) so couples seeded under an older template gain the rest.
 * Every step graceful-degrades — a missing migration renders the empty state
 * rather than crashing.
 *
 * Also fetches per-plan-group decision state so the ChecklistFull can render
 * CategoryDecisionPrompt nudges below each vendor-category plan group.
 */
export default async function EventChecklistPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Top-up missing template tasks on open (idempotent · ceremony-tailored).
  try {
    await ensureChecklistSeeded(eventId);
  } catch (caught) {
    logQueryError(
      'EventChecklistPage (ensureChecklistSeeded threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { event_id: eventId },
      'graceful_degrade',
    );
  }

  const { data: eventRow } = await supabase
    .from('events')
    .select('event_date')
    .eq('event_id', eventId)
    .maybeSingle();
  const eventDate = (eventRow?.event_date as string | null) ?? null;

  // Fetch all data in parallel — checklist rows + decision state sources.
  const [rows, decisionsResult, vendorsResult, interestedPlanGroups] = await Promise.all([
    fetchChecklistItems(supabase, eventId),

    // event_category_decisions — explicit couple decisions per plan group.
    // Graceful-degrade: if the migration hasn't landed yet, decisions = [].
    supabase
      .from('event_category_decisions')
      .select('plan_group_id, decision')
      .eq('event_id', eventId)
      .then((r) => {
        if (r.error) {
          logQueryError(
            'EventChecklistPage (event_category_decisions SELECT threw)',
            new Error(r.error.message),
            { event_id: eventId },
            'graceful_degrade',
          );
          return [] as Array<{ plan_group_id: string; decision: string }>;
        }
        return (r.data ?? []) as Array<{ plan_group_id: string; decision: string }>;
      }),

    // event_vendors — status per vendor, to derive category state.
    supabase
      .from('event_vendors')
      .select('category, status')
      .eq('event_id', eventId)
      .then((r) => {
        if (r.error) {
          logQueryError(
            'EventChecklistPage (event_vendors SELECT threw)',
            new Error(r.error.message),
            { event_id: eventId },
            'graceful_degrade',
          );
          return [] as Array<{ category: string; status: string }>;
        }
        return (r.data ?? []) as Array<{ category: string; status: string }>;
      }),

    // Couple's onboarding plan-group picks (for Tier 3).
    getEventInterestedPlanGroups(eventId).catch(() => [] as string[]),
  ]);

  const now = new Date();
  const groups = groupChecklistByPhase(rows, eventDate, now);
  const doneCount = rows.filter((r) => r.status === 'done').length;

  // ── Build per-plan-group decision state ──────────────────────────────────
  // Index explicit decisions by plan_group_id.
  const decisionByGroup = new Map<string, CategoryDecision>(
    decisionsResult.map((d) => [
      d.plan_group_id,
      { decision: d.decision as 'excluded' | 'deferred' },
    ]),
  );

  // Build the plan groups to surface on the checklist:
  //   Tier 1 + Tier 2 (always shown) + Tier 3 (onboarding picks minus T1/T2).
  const tier1Ids = CHECKLIST_BUDGET_TIERS.tier1 as readonly string[];
  const tier2Ids = CHECKLIST_BUDGET_TIERS.tier2 as readonly string[];
  const tier1and2 = new Set([...tier1Ids, ...tier2Ids]);

  // Map checklist tier IDs → PLAN_GROUPS entries (budget tier IDs may differ
  // slightly; fall back gracefully when no matching group is found).
  const planGroupById = new Map(PLAN_GROUPS.map((g) => [g.id as string, g] as const));

  const tier3Ids = interestedPlanGroups.filter((id) => !tier1and2.has(id));
  const vendorPlanGroupIds = [...tier1and2, ...tier3Ids];

  // Group event_vendors by plan_group_id (via category → group lookup).
  const vendorsByGroup = new Map<string, Array<{ status: string }>>();
  for (const v of vendorsResult) {
    // category is a plain string from the DB; cast to VendorCategory for the lookup.
    // planGroupForCategory returns null for unknown categories → safe to skip.
    const groupId = planGroupForCategory(v.category as VendorCategory);
    if (!groupId) continue;
    const gid = groupId as string;
    const existing = vendorsByGroup.get(gid) ?? [];
    existing.push({ status: v.status });
    vendorsByGroup.set(gid, existing);
  }

  // Resolve CategoryDecisionState for each vendor plan group.
  const categoryStates = vendorPlanGroupIds
    .map((id) => {
      const group = planGroupById.get(id);
      if (!group) return null;
      const decision = decisionByGroup.get(id) ?? null;
      const vendors = vendorsByGroup.get(id) ?? [];
      return {
        planGroupId: id,
        label: group.label,
        state: resolveCategoryState(decision, vendors),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <ChecklistFull
      eventId={eventId}
      groups={groups}
      totalCount={rows.length}
      doneCount={doneCount}
      eventDate={eventDate}
      categoryStates={categoryStates}
    />
  );
}
