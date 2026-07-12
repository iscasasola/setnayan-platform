import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchChecklistItems, groupChecklistByPhase, checklistChrome } from '@/lib/checklist';
import { computeBudgetHealth, type ChecklistBudgetHealth } from '@/lib/checklist-budget';
import { suggestLeafCategories, type LeafSuggestion } from '@/lib/leaf-suggestions';
import {
  resolveVendorCategoryProgress,
  type VendorCategoryProgress,
} from '@/lib/vendor-category-progress';
import { ensureChecklistSeeded } from '../checklist-actions';
import { ChecklistFull } from '../_components/checklist/checklist-full';

type Props = { params: Promise<{ eventId: string }> };

/** Event-type-aware page title (e.g. "Birthday checklist · Setnayan"). */
export async function generateMetadata({ params }: Props) {
  try {
    const { eventId } = await params;
    const supabase = await createClient();
    const { data } = await supabase
      .from('events')
      .select('event_type')
      .eq('event_id', eventId)
      .maybeSingle();
    return { title: checklistChrome((data?.event_type as string | null) ?? null).pageTitle };
  } catch {
    return { title: 'Checklist · Setnayan' };
  }
}

/**
 * /dashboard/[eventId]/checklist — the full, browsable wedding checklist.
 *
 * The home card shows only the top-3 urgent items; this is the complete list,
 * grouped by countdown phase. Visiting also top-ups any tasks the event is
 * missing (idempotent) so couples seeded under an older template gain the rest.
 * Every step graceful-degrades — a missing migration renders the empty state
 * rather than crashing.
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
    .select('event_date, event_type, date_candidates, date_window_start')
    .eq('event_id', eventId)
    .maybeSingle();
  const eventType = (eventRow?.event_type as string | null) ?? null;
  const lockedDate = (eventRow?.event_date as string | null) ?? null;
  // Deadline anchor. Non-wedding events keep event_date NULL until locked
  // (date-as-output), but they now seed candidate/window dates at creation —
  // anchor tentative deadlines on the best-known date so the checklist isn't
  // dateless. This ONLY affects this page's due computation; events.event_date is
  // untouched, so the layout's day-of/recap mode + SetDateNudge are unchanged.
  // Weddings anchor solely on the locked event_date (they lock via the
  // date-selection ceremony; anchoring weddings on candidates is a separate
  // flagship decision) — same wedding-or-unset guard as the budget gate below.
  const isWeddingLike = eventType == null || eventType === 'wedding';
  // Earliest candidate (defensive sort — YYYY-MM-DD sorts chronologically —
  // rather than trusting stored order), then the window start.
  const earliestCandidate =
    ((eventRow?.date_candidates as string[] | null) ?? []).filter(Boolean).sort()[0] ?? null;
  const eventDate =
    lockedDate ??
    (isWeddingLike
      ? null
      : (earliestCandidate ?? (eventRow?.date_window_start as string | null) ?? null));
  const chrome = checklistChrome(eventType);

  const rows = await fetchChecklistItems(supabase, eventId);
  const now = new Date();
  const groups = groupChecklistByPhase(rows, eventDate, now);
  const doneCount = rows.filter((r) => r.status === 'done').length;

  // Live budget health-check — null when the couple hasn't set a budget yet, or
  // graceful-degrades to null if the budget tables aren't present. Never blocks
  // the checklist render. WEDDING-ONLY for now: computeBudgetHealth's tiers,
  // benchmarks, and paperwork line are all wedding-shaped, and generic
  // onboarding DOES write estimated_budget_centavos — without this guard a
  // birthday with a budget would render wedding-shaped health numbers. The
  // per-event-type budget model lifts this (see
  // Budget_Genericization_Design_2026-07-08.md §4 PR-B3); mirrors the
  // isWeddingBudget gate on the budget page itself.
  const isWeddingBudget = eventType == null || eventType === 'wedding';
  let budgetHealth: ChecklistBudgetHealth | null = null;
  try {
    budgetHealth = isWeddingBudget ? await computeBudgetHealth(eventId) : null;
  } catch (caught) {
    logQueryError(
      'EventChecklistPage (computeBudgetHealth threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { event_id: eventId },
      'graceful_degrade',
    );
  }

  // "You might also want…" — relevance-gated leaf-category suggestions. Defensive
  // (returns [] on any failure) so it never blocks the checklist render.
  let leafSuggestions: LeafSuggestion[] = [];
  try {
    leafSuggestions = await suggestLeafCategories(eventId);
  } catch (caught) {
    logQueryError(
      'EventChecklistPage (suggestLeafCategories threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { event_id: eventId },
      'graceful_degrade',
    );
  }

  // Vendor-category progress — the couple's shortlisted/booked vendors resolved
  // to live states ("comparing options", "confirmed"). Defensive: a read error
  // leaves the list empty and the card hidden.
  let vendorProgress: VendorCategoryProgress[] = [];
  try {
    const { data: vendorRows } = await supabase
      .from('event_vendors')
      .select('category, status')
      .eq('event_id', eventId);
    vendorProgress = resolveVendorCategoryProgress(
      (vendorRows ?? []) as { category: string | null; status: string }[],
    );
  } catch (caught) {
    logQueryError(
      'EventChecklistPage (vendor progress threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { event_id: eventId },
      'graceful_degrade',
    );
  }

  return (
    <ChecklistFull
      eventId={eventId}
      groups={groups}
      totalCount={rows.length}
      doneCount={doneCount}
      eventDate={eventDate}
      chrome={chrome}
      budgetHealth={budgetHealth}
      leafSuggestions={leafSuggestions}
      vendorProgress={vendorProgress}
    />
  );
}
