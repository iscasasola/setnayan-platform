import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchChecklistItems, groupChecklistByPhase } from '@/lib/checklist';
import { computeBudgetHealth, type ChecklistBudgetHealth } from '@/lib/checklist-budget';
import { suggestLeafCategories, type LeafSuggestion } from '@/lib/leaf-suggestions';
import {
  resolveVendorCategoryProgress,
  type VendorCategoryProgress,
} from '@/lib/vendor-category-progress';
import { ensureChecklistSeeded } from '../checklist-actions';
import { ChecklistFull } from '../_components/checklist/checklist-full';

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

  const rows = await fetchChecklistItems(supabase, eventId);
  const now = new Date();
  const groups = groupChecklistByPhase(rows, eventDate, now);
  const doneCount = rows.filter((r) => r.status === 'done').length;

  // Live budget health-check — null when the couple hasn't set a budget yet, or
  // graceful-degrades to null if the budget tables aren't present. Never blocks
  // the checklist render.
  let budgetHealth: ChecklistBudgetHealth | null = null;
  try {
    budgetHealth = await computeBudgetHealth(eventId);
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
      budgetHealth={budgetHealth}
      leafSuggestions={leafSuggestions}
      vendorProgress={vendorProgress}
    />
  );
}
