/**
 * Planning Stage on fixtures — the ONE list (owner 2026-11-01, "Checklist merges into Planning Stage") drawn by the
 * REAL reader's pure half: the real wedding template (`buildChecklistSeed`) dated by the real anchor and runway
 * (`taskItemsFrom`), the autofill rows a wedding six weeks out would have (some the same work as a task), two
 * hand-added rows, all through `assemblePlanningList` (fold · sort · months). Home's lab counts the SAME fixture with
 * the SAME rule (`planningProgress`), so the two labs side by side show "Home count = list count".
 *
 * No database. Shared by `/dev/schedule-lab?view=preparation` and `/dev/home-lab`.
 */
import { buildChecklistSeed, type ChecklistItemRow } from '@/lib/checklist';
import { assemblePlanningList, taskItemsFrom, type PreparationAgenda, type PreparationItem } from '@/lib/preparation';
import { PLAN_DATE } from './lab-moments';

const LAB_EVENT = 'lab';
/** A lab amount in the shipped peso words (`₱` + grouped) — the way the reader words a payment row. */
const php = (n: number) => `₱${n.toLocaleString('en-PH')}`;
const DAY = 86_400_000;

/** Ticked in the lab — auto-ticked ones (a set budget, a booked photographer) and a few by hand. */
const DONE = new Set(['decide_type', 'who_pays', 'draft_guest_list', 'set_budget', 'guest_estimate', 'set_date', 'lock_theme', 'book_photo', 'book_venue', 'book_reception_venue']);

function labTaskRows(): ChecklistItemRow[] {
  return buildChecklistSeed(LAB_EVENT, 'catholic').map((r, i) => ({
    ...r,
    item_id: `lab-task-${r.template_key}`,
    public_id: `S89K-LAB${i}`,
    status: DONE.has(r.template_key ?? '') ? ('done' as const) : ('pending' as const),
    completed_at: null,
    created_at: '2025-06-01T00:00:00Z',
    // The host moved "Buy your wedding rings" to a Saturday that suits them.
    due_date_set: r.template_key === 'rings' ? addDays(new Date(), 12) : null,
  }));
}

function addDays(from: Date, n: number): string {
  const d = new Date(from.getTime() + n * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function auto(now: Date, id: string, source: PreparationItem['source'], inDays: number, title: string, subtitle: string, extra: Partial<PreparationItem> = {}): PreparationItem {
  const iso = addDays(now, inDays);
  return {
    id,
    source,
    date: new Date(`${iso}T12:00:00`),
    daysFromNow: inDays,
    title,
    subtitle,
    href: '/dev/schedule-lab?view=preparation',
    ...extra,
  };
}

function labAutofill(now: Date): PreparationItem[] {
  return [
    // Same work as a task → folds into it.
    auto(now, 'payment:lab-casa-1', 'payment', 6, `${php(40_000)} due to Casa Catering`, 'First payment', { amountPhp: 40_000, twin: { kind: 'payment', category: 'catering', firstLine: true } }),
    auto(now, 'appointment:lab-tasting', 'meeting', 9, 'Food tasting', '3:00 PM · In-person with Casa Catering', { twin: { kind: 'meeting', appointmentType: 'food_tasting' } }),
    auto(now, 'paperwork:lab-license', 'paperwork', 14, 'Complete Marriage license', 'About 10 days at the civil registry', { twin: { kind: 'paperwork', documentType: 'marriage_license' } }),
    // Their own work → shown on their own.
    auto(now, 'payment:lab-casa-2', 'payment', 39, `${php(92_500)} due to Casa Catering`, 'Balance', { amountPhp: 92_500, twin: { kind: 'payment', category: 'catering', firstLine: false } }),
    auto(now, 'payment:lab-lumina', 'payment', 4, `${php(20_000)} due to Lumina Studio`, 'First payment', { amountPhp: 20_000, twin: { kind: 'payment', category: 'photographer', firstLine: true } }),
  ];
}

function labManual(now: Date): PreparationItem[] {
  return [
    auto(now, 'manual:lab-m1', 'manual', 2, 'Pick up the barong from the tailor', 'Added by you', { isManual: true, itemId: 'lab-m1', done: false, kind: 'task', sourceLabel: 'Added by you' }),
    auto(now, 'manual:lab-m2', 'manual', -3, 'Send the payment slip to the venue', 'Added by you', { isManual: true, itemId: 'lab-m2', done: true, kind: 'task', sourceLabel: 'Added by you' }),
  ];
}

/** The lab's whole Planning Stage — what `fetchPreparationAgenda` would hand the page. */
export function labPlanningList(now: Date = new Date()): PreparationAgenda {
  const tasks = taskItemsFrom(labTaskRows(), {
    eventId: LAB_EVENT,
    event: { event_type: 'wedding', event_date: PLAN_DATE, created_at: '2025-06-01T00:00:00Z' },
    now,
  });
  return assemblePlanningList([...tasks, ...labAutofill(now), ...labManual(now)]);
}

export { PLAN_DATE as LAB_PLAN_DATE };
