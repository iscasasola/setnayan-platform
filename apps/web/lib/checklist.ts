/**
 * Couple planning checklist — template, persistence, and the urgency filter.
 *
 * A lightweight, deterministic planning checklist for the couple dashboard.
 * Owner-authorized 2026-06-13 as a NEW surface — see the lineage note below.
 *
 * ── Relationship to the retired "Today's Focus" wizard ──────────────────────
 * The single-thing "Today's Focus" wizard was owner-retired 2026-06-03 (/today
 * redirects; lib/wizard.ts + lib/todays-one-thing.ts are dormant). This is a
 * DIFFERENT surface: a multi-item checklist the couple checks off at their own
 * pace, with a pure ranking filter that surfaces only the few most time-urgent
 * items for wherever they are in the runway. It does NOT revive the wizard.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Split, mirroring lib/guests.ts:
 *   - The TEMPLATE + pure helpers (daysUntilEvent / dueDateForItem /
 *     rankUrgentChecklistItems) are integration-agnostic — no Supabase, no
 *     React. Same inputs → same output; safe on server and client.
 *   - The fetcher reads persisted rows (a couple can complete / un-complete
 *     items, and the done-state must survive reloads — hence a table, not a
 *     derived list).
 *
 * The ranking is the feature the brief asks for: given the days remaining until
 * the event, surface only the top-N most urgent OPEN items for that window. Each
 * template item carries a `dueOffsetDays` (how many days BEFORE the event it
 * should be done); the item's due date = event_date − offset, and "most urgent"
 * = soonest (or most overdue) due date among still-open items.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingRelationError, logQueryError } from '@/lib/supabase/error-detect';

export type ChecklistCategory =
  | 'foundations'
  | 'vendors'
  | 'guests'
  | 'paperwork'
  | 'attire'
  | 'design'
  | 'logistics'
  | 'final_week';

export const CHECKLIST_CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  foundations: 'Foundations',
  vendors: 'Vendors',
  guests: 'Guests',
  paperwork: 'Paperwork',
  attire: 'Attire',
  design: 'Design',
  logistics: 'Logistics',
  final_week: 'Final week',
};

export type ChecklistStatus = 'pending' | 'done';

export type ChecklistTemplateItem = {
  /** Stable key — the link between the seeded row and this template entry. */
  key: string;
  title: string;
  category: ChecklistCategory;
  /** Days BEFORE the event this item should be done by (its planning window). */
  dueOffsetDays: number;
};

/**
 * The standard PH-wedding planning checklist, ordered from earliest planning
 * runway (≈12 months out) to the final-week tasks. `dueOffsetDays` places each
 * item on the countdown; the ranking filter reads it to know what's urgent now.
 * The host can complete, skip, or ignore any item — this is a guide, not a gate.
 *
 * Seeded into `event_checklist_items` on first open (see actions.ensureSeeded).
 */
export const CHECKLIST_TEMPLATE: ReadonlyArray<ChecklistTemplateItem> = [
  // ── Foundations (≈12–9 months) ──
  { key: 'set_date', title: 'Lock your wedding date', category: 'foundations', dueOffsetDays: 365 },
  { key: 'set_budget', title: 'Set your overall budget', category: 'foundations', dueOffsetDays: 360 },
  { key: 'guest_estimate', title: 'Estimate your guest count', category: 'foundations', dueOffsetDays: 350 },
  { key: 'book_venue', title: 'Book your ceremony & reception venue', category: 'vendors', dueOffsetDays: 330 },
  // ── Core vendors (≈9–6 months) ──
  { key: 'book_caterer', title: 'Book your caterer', category: 'vendors', dueOffsetDays: 270 },
  { key: 'book_photo', title: 'Book photographer & videographer', category: 'vendors', dueOffsetDays: 260 },
  { key: 'book_hmua', title: 'Book hair & makeup artist', category: 'vendors', dueOffsetDays: 240 },
  { key: 'book_coordinator', title: 'Book your coordinator', category: 'vendors', dueOffsetDays: 230 },
  // ── Paperwork (PH statutory — mirrors lib/upcoming-items deadlines) ──
  { key: 'psa_cenomar', title: 'Request PSA / CENOMAR documents', category: 'paperwork', dueOffsetDays: 180 },
  { key: 'pre_cana', title: 'Book a pre-Cana / marriage seminar', category: 'paperwork', dueOffsetDays: 150 },
  { key: 'marriage_license', title: 'Apply for your marriage license', category: 'paperwork', dueOffsetDays: 120 },
  // ── Design & attire (≈6–4 months) ──
  { key: 'attire', title: 'Order wedding attire (gown & suit)', category: 'attire', dueOffsetDays: 180 },
  { key: 'mood_board', title: 'Finalize your mood board & palette', category: 'design', dueOffsetDays: 170 },
  { key: 'invitations', title: 'Design & send your invitations', category: 'guests', dueOffsetDays: 120 },
  { key: 'monogram', title: 'Finalize your monogram', category: 'design', dueOffsetDays: 110 },
  // ── Guests & logistics (≈4–2 months) ──
  { key: 'guest_list', title: 'Finalize your guest list', category: 'guests', dueOffsetDays: 90 },
  { key: 'sponsors', title: 'Confirm your principal sponsors', category: 'guests', dueOffsetDays: 90 },
  { key: 'menu_tasting', title: 'Do your menu tasting', category: 'vendors', dueOffsetDays: 75 },
  { key: 'schedule', title: 'Build your wedding-day timeline', category: 'logistics', dueOffsetDays: 60 },
  { key: 'rings', title: 'Buy your wedding rings', category: 'attire', dueOffsetDays: 60 },
  // ── Closing in (≈1 month → week-of) ──
  { key: 'seating', title: 'Finalize your seating chart', category: 'logistics', dueOffsetDays: 30 },
  { key: 'rsvp_followup', title: 'Follow up with pending RSVPs', category: 'guests', dueOffsetDays: 30 },
  { key: 'final_headcount', title: 'Give caterer your final headcount', category: 'vendors', dueOffsetDays: 14 },
  { key: 'final_payments', title: 'Settle remaining vendor balances', category: 'vendors', dueOffsetDays: 10 },
  { key: 'confirm_vendors', title: 'Confirm call times with all vendors', category: 'final_week', dueOffsetDays: 7 },
  { key: 'emcee_script', title: 'Prepare your emcee / host script', category: 'final_week', dueOffsetDays: 5 },
  { key: 'pack_emergency', title: 'Pack a wedding-day emergency kit', category: 'final_week', dueOffsetDays: 3 },
  { key: 'rehearsal', title: 'Run your ceremony rehearsal', category: 'final_week', dueOffsetDays: 1 },
];

export type ChecklistItemRow = {
  item_id: string;
  public_id: string;
  event_id: string;
  /** Template key when seeded, null for a host-added custom item. */
  template_key: string | null;
  title: string;
  category: ChecklistCategory;
  /** Days before the event this is due; null = no countdown (manual item). */
  due_offset_days: number | null;
  status: ChecklistStatus;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
};

/** A row enriched with computed due-date + urgency, for ranking + display. */
export type ChecklistItemView = ChecklistItemRow & {
  /** ISO yyyy-mm-dd this item is due by, or null when no offset / no event date. */
  dueDate: string | null;
  /** Whole days from `now` until due. Negative = overdue. Null = no due date. */
  daysUntilDue: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local-midnight epoch for a YYYY-MM-DD (or full ISO) date string. Mirrors the
 *  tz-safe parse in lib/day-of-mode so countdowns align to the couple's clock. */
function dateToLocalEpoch(date: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0).getTime();
  }
  return new Date(date).getTime();
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
}

/**
 * Whole days from `now` until the event. Negative once the date has passed,
 * null when no date is set. Pure (clock passed in for deterministic tests).
 */
export function daysUntilEvent(
  eventDate: string | null,
  now: Date = new Date(),
): number | null {
  if (!eventDate) return null;
  const eventMs = dateToLocalEpoch(eventDate);
  if (!Number.isFinite(eventMs)) return null;
  return Math.round((eventMs - startOfDay(now)) / DAY_MS);
}

/** The ISO yyyy-mm-dd an item is due by = event_date − offset days. */
export function dueDateForItem(
  eventDate: string | null,
  dueOffsetDays: number | null,
): string | null {
  if (!eventDate || dueOffsetDays == null) return null;
  const eventMs = dateToLocalEpoch(eventDate);
  if (!Number.isFinite(eventMs)) return null;
  const due = new Date(eventMs - dueOffsetDays * DAY_MS);
  const y = due.getFullYear();
  const mo = String(due.getMonth() + 1).padStart(2, '0');
  const d = String(due.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

/** Enrich a row with its computed due date + days-until-due. */
export function toChecklistView(
  row: ChecklistItemRow,
  eventDate: string | null,
  now: Date = new Date(),
): ChecklistItemView {
  const dueDate = dueDateForItem(eventDate, row.due_offset_days);
  const daysUntilDue =
    dueDate != null
      ? Math.round((dateToLocalEpoch(dueDate) - startOfDay(now)) / DAY_MS)
      : null;
  return { ...row, dueDate, daysUntilDue };
}

export type RankOptions = {
  /** How many items to surface. The brief asks for the top 3. */
  limit?: number;
  /** Clock, injectable for deterministic tests. */
  now?: Date;
};

/**
 * THE FEATURE: given the days remaining until the event, surface only the most
 * time-urgent OPEN checklist items for that window.
 *
 * Deterministic. Open (pending) items only; done items never resurface. Items
 * are ranked by due date — most overdue first, then soonest-due — so the list
 * naturally tracks the countdown: a couple 9 months out sees venue/caterer
 * tasks; a couple 2 weeks out sees headcount/payments. Items with no due date
 * (custom host items) sort last, after every dated item. Ties broken by
 * sort_order for stability.
 *
 * @example
 * // 60 days out → surfaces seating, RSVP follow-up, final headcount
 * rankUrgentChecklistItems(items, '2026-08-12', { limit: 3 });
 */
export function rankUrgentChecklistItems(
  rows: ReadonlyArray<ChecklistItemRow>,
  eventDate: string | null,
  opts: RankOptions = {},
): ChecklistItemView[] {
  const limit = opts.limit ?? 3;
  const now = opts.now ?? new Date();

  const open = rows
    .filter((r) => r.status === 'pending')
    .map((r) => toChecklistView(r, eventDate, now));

  open.sort((a, b) => {
    // Dated items always rank above undated ones.
    if (a.daysUntilDue == null && b.daysUntilDue == null) {
      return a.sort_order - b.sort_order;
    }
    if (a.daysUntilDue == null) return 1;
    if (b.daysUntilDue == null) return -1;
    // Soonest / most-overdue first.
    if (a.daysUntilDue !== b.daysUntilDue) return a.daysUntilDue - b.daysUntilDue;
    return a.sort_order - b.sort_order;
  });

  return open.slice(0, Math.max(0, limit));
}

const FIELDS =
  'item_id,public_id,event_id,template_key,title,category,due_offset_days,status,sort_order,completed_at,created_at';

/**
 * Fetch all checklist rows for an event. Graceful-degrade to [] on any error
 * (mirrors lib/guests) so the home-page render never crashes if the migration
 * hasn't reached this environment yet — the checklist card just won't show.
 */
export async function fetchChecklistItems(
  supabase: SupabaseClient,
  eventId: string,
): Promise<ChecklistItemRow[]> {
  const { data, error } = await supabase
    .from('event_checklist_items')
    .select(FIELDS)
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true });

  if (error) {
    logQueryError(
      'fetchChecklistItems',
      error,
      { event_id: eventId, missing_relation_match: isMissingRelationError(error) },
      'graceful_degrade',
    );
    return [];
  }
  return (data ?? []) as unknown as ChecklistItemRow[];
}

/** Build the seed payload (one row per template item) for a new event. The
 *  server action inserts these on first open; `sort_order` follows the template
 *  order so the full list reads chronologically. */
export function buildChecklistSeed(
  eventId: string,
): Array<Pick<ChecklistItemRow, 'event_id' | 'template_key' | 'title' | 'category' | 'due_offset_days' | 'status' | 'sort_order'>> {
  return CHECKLIST_TEMPLATE.map((t, idx) => ({
    event_id: eventId,
    template_key: t.key,
    title: t.title,
    category: t.category,
    due_offset_days: t.dueOffsetDays,
    status: 'pending' as ChecklistStatus,
    sort_order: (idx + 1) * 10,
  }));
}
