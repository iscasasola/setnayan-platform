/**
 * Preparation agenda aggregator — the read-only "Preparation" mode of the
 * couple's /schedule page (chrome redesign delta #3, 2026-06-03).
 *
 * The /schedule page has two modes:
 *   • "Event Day"   — the existing editable day-of timeline
 *                     (event_schedule_blocks). Unchanged.
 *   • "Preparation" — THIS module: a date-sorted, READ-ONLY agenda of the
 *                     dated planning items that lead up to the wedding,
 *                     aggregated from data that ALREADY exists. No new
 *                     table, no new migration — every source below is an
 *                     existing queryable surface.
 *
 * Why a dedicated module (vs reusing lib/upcoming-items.ts): the Home
 * "Upcoming" stream filters to FUTURE-only items + truncates to ~10 +
 * deliberately includes subscription-renewal billing. The Preparation
 * agenda is a planning runway — it keeps OVERDUE items visible (a missed
 * payment / lapsed paperwork deadline is exactly what a couple needs to
 * see), groups by month, and omits subscription renewals (recurring
 * billing is not "preparation leading up to the wedding" — it lives on
 * Orders + Home already). The two surfaces share row shapes + brand-voice
 * conventions but answer different questions, so they stay separate.
 *
 * ── Wired sources (real, dated, queryable) ──────────────────────────────
 *  1. Payment    · event_vendor_line_items.due_date — host-entered vendor
 *                  payment milestones (Deposit / Balance / Tip …). Fully-
 *                  paid lines are dropped (mirrors renderBudgetIcs +
 *                  lib/upcoming-items.ts). Source: iteration 0007 budget.
 *  2. Paperwork  · event_paperwork rows, "complete by" date derived via
 *                  lib/paperwork.ts completeByDate(document_type, event_date).
 *                  Received documents are dropped. Source: 2026-05-22
 *                  paperwork pipeline.
 *  3. Meeting    · CONFIRMED event_appointments.scheduled_at — tastings,
 *                  fittings, site visits booked through the two-sided
 *                  scheduler. (The ad-hoc vendor_meetings table this used to
 *                  read alongside was never written and was dropped
 *                  2026-09-18, S39.)
 *  4. Milestone  · computed statutory windows from events.event_date +
 *                  ceremony_type (PSA/CENOMAR opens −180d, marriage-license
 *                  window −120d, Pre-Cana cutoff −60d for Catholic). These
 *                  are the concierge-flavored derived planning dates. Same
 *                  thresholds as lib/upcoming-items.ts PAPERWORK_DEADLINES.
 *
 *  5. Task       · event_checklist_items — the old Checklist's template tasks
 *                  (owner 2026-11-01, "CHECKLIST MERGES INTO PLANNING STAGE").
 *                  Each carries a real date: the host's own (`due_date_set`)
 *                  or the template's (event date − offset, runway-compressed).
 *                  They keep auto-ticking (checklist-actions
 *                  `ensureChecklistSeeded`) and the host can tick them.
 *  6. Manual     · event_preparation_items — hand-added rows, now with a done
 *                  tick (`completed_at`).
 *
 * 🔑 ONE LIST. This module is the ONLY reader of the plan's tasks: Planning
 * Stage, its "To do" filter (the old /checklist address forwards there), Home's
 * To do tile and the events board's "% planned · N overdue" all read
 * `fetchPreparationAgenda` and count with `planningProgress`. Held by
 * `lib/the-plan-is-one-list.test.ts`.
 *
 * 🔁 A task and an autofill row that are the same work show ONCE
 * (`lib/planning-twins.ts`, folded in `foldTwins`). A fold never moves or
 * removes a task, so the To do filter is the same with or without the
 * autofill — which is why `only: 'todo'` may skip the autofill reads.
 *
 * ── Deliberately NOT wired (documented gaps) ────────────────────────────
 *  • Chapters dated before the day (Step 2, PR #7143 — not on main when the
 *    merge shipped). A chapter is an `event_schedule_blocks` top-level row; one
 *    dated before the event day belongs in this list. THE SEAM: add a
 *    `fetchPreDayChapterItems` source beside the others in
 *    `fetchPreparationAgenda` (a new `PreparationSource`, its rows dated by the
 *    block's start), never a second list.
 *  • Meet-up — one of the plan's six kinds (Task · Meeting · Payment · Site
 *    visit · Document · Meet-up). Site visits come from appointments and
 *    documents from paperwork; Meet-up has no meaning in code or corpus yet, so
 *    it is not invented here (a hand-added Meeting covers it until ruled).
 *  • Orders due dates — the `orders` table has NO due-date column (only
 *    created_at / paid_at / reviewed_at / expires_at). `expires_at` is a
 *    subscription-renewal date, surfaced on Home + Orders already; it is
 *    NOT a wedding-preparation milestone, so it is intentionally omitted.
 *  • Concierge / Setnayan AI per-step milestones — the 0016 wizard is an
 *    ordered card list with NO per-step due/target date column. The only
 *    concierge-adjacent dated data is the statutory windows, wired above as
 *    the Milestone source.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { CONFIRMED_VENDOR_STATUSES } from './events';
import { completeByDate, DOCUMENT_META, type PaperworkDocumentType } from './paperwork';
import {
  CHECKLIST_CATEGORY_LABELS,
  checklistAnchorDateFor,
  checklistItemAllowedForProfile,
  checklistItemHref,
  checklistRunwayFor,
  dueDateForItem,
  readChecklistItems,
  type ChecklistItemRow,
} from './checklist';
import { checklistTaskAnchor } from './checklist-anchor';
import { foldsIntoDoneTask, twinTaskKey, type PlanningTwinSignal } from './planning-twins';
import {
  resolveAppointmentLabel,
  APPOINTMENT_KIND_LABEL,
  type AppointmentKind,
} from './appointments';

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

/**
 * Source tag rendered as a chip on each row + drives the icon/tone. The
 * first four are the read-only autofill sources (PR #840). `manual` is the
 * hybrid layer added 2026-06-03 — a couple-added OR vendor-added row from
 * the `event_preparation_items` table. Manual rows carry a delete control
 * (see `isManual` / `itemId` below) and their chip is overridden per-row
 * via `sourceLabel` ("Added by you" vs "From {vendor}").
 */
export type PreparationSource =
  | 'task'
  | 'payment'
  | 'paperwork'
  | 'meeting'
  | 'milestone'
  | 'manual';

export const PREPARATION_SOURCE_LABEL: Record<PreparationSource, string> = {
  task: 'To do',
  payment: 'Payment',
  paperwork: 'Paperwork',
  meeting: 'Meeting',
  milestone: 'Milestone',
  manual: 'Added',
};

/**
 * The "kind" of a manual (`event_preparation_items`) row — drives which
 * autofill visual a hand-added item borrows. A vendor or couple can place a
 * generic `task`, a `meeting` schedule (renders with the Meeting tag/icon,
 * same as the confirmed-appointment rows), or a `payment` schedule
 * (renders with the Payment tag/icon + a ₱ amount, same as the autofilled
 * vendor payment milestones). Autofill rows leave this `undefined` — their
 * visual is driven by `source` alone. Defaults to 'task' when the
 * kind/amount_php columns are absent on a pre-migration deploy.
 */
export type PreparationItemKind = 'task' | 'meeting' | 'payment';

export type PreparationItem = {
  /** Stable id — unique per source + row. React key. */
  id: string;
  source: PreparationSource;
  /**
   * Manual rows only. When set, the row borrows the autofill visual for that
   * kind ('meeting' → Meeting tag/icon, 'payment' → Payment tag/icon + amount,
   * 'task' → the plain manual style). Undefined on autofill rows.
   */
  kind?: PreparationItemKind;
  /**
   * The date this item is anchored to (a due date, deadline, or start). NULL only on a TASK with no date yet (the event
   * has no date to count back from and the host has not set one) — those sort last, under "No date yet".
   */
  date: Date | null;
  /** Whole-day diff between `now` and `date` (negative = overdue/past). NULL when `date` is. */
  daysFromNow: number | null;
  /** Headline copy — short, no jargon. */
  title: string;
  /** Supporting context — vendor name, document helper, etc. */
  subtitle: string;
  /** Whole pesos for payment items; undefined elsewhere. */
  amountPhp?: number;
  /** On-platform deep-link for tap-through. */
  href?: string;
  /**
   * Per-row chip label override. Autofill rows leave this undefined and
   * fall back to PREPARATION_SOURCE_LABEL[source]. Manual rows set it to
   * "Added by you" (couple_manual) or "From {vendor business name}"
   * (vendor_prep) so the source of a hand-added item is unmistakable.
   */
  sourceLabel?: string;
  /**
   * Hybrid layer only. When true, this row is a real
   * `event_preparation_items` row the current user is allowed to remove —
   * the agenda renders a delete control wired to `deletePreparationItem`.
   * Autofill rows (payment/paperwork/meeting/milestone) leave this falsy;
   * they are owned + edited on their own surface and stay read-only here.
   */
  isManual?: boolean;
  /** The `event_preparation_items.item_id` — present iff `isManual`. */
  itemId?: string;
  /**
   * ✅ Tickable rows only (a task, a hand-added row): ticked done. Undefined on autofill rows — their "done" is the
   * fact on their own surface (paid, received), and a done fact drops the row.
   */
  done?: boolean;
  /** Task rows: the `event_checklist_items.item_id`. */
  taskItemId?: string;
  /** Task rows: the template key (null for a host-added custom task). */
  templateKey?: string | null;
  /** Task rows: the date as yyyy-mm-dd (what the date sheet edits) — null when undated. */
  dateIso?: string | null;
  /** Task rows: the template's own date (event date − offset), what "Back to the plan's date" restores. */
  planDateIso?: string | null;
  /** Task rows: the host moved this task (`due_date_set` is set). */
  dateSet?: boolean;
  /** Task rows: a task for after the day (a negative offset) — its date is not capped at the event day. */
  afterDay?: boolean;
  /** Autofill rows: what the row says about itself, for the one-row-per-piece-of-work fold (`lib/planning-twins.ts`). */
  twin?: PlanningTwinSignal;
  /** Task rows: the autofill rows folded into this one (the same work, shown once). */
  folded?: Array<Pick<PreparationItem, 'id' | 'source' | 'title' | 'subtitle' | 'date' | 'amountPhp' | 'href'>>;
};

/** A row the host ticks — a task or a hand-added row. THE "To do" filter, and everything counted off it. */
export function isTodoItem(item: Pick<PreparationItem, 'source'>): boolean {
  return item.source === 'task' || item.source === 'manual';
}

/** The id a tickable row is addressed by (`#task-<id>`): the checklist item id, or the hand-added row's id. */
export function planningRowId(item: Pick<PreparationItem, 'taskItemId' | 'itemId'>): string | null {
  return item.taskItemId ?? item.itemId ?? null;
}

export { planningTodoHref } from './checklist-anchor';

export type PreparationGroup = {
  /** YYYY-MM key for stable sort. */
  key: string;
  /** "March 2026" display label. */
  label: string;
  items: PreparationItem[];
};

export type PreparationAgenda = {
  /** All items, chronologically sorted (overdue first). */
  items: PreparationItem[];
  /** Same items bucketed by calendar month, months ascending. */
  groups: PreparationGroup[];
  /** Per-source counts — surfaced in the page header + PR/debug logs. */
  sourceCounts: Record<PreparationSource, number>;
  /**
   * 🛑 Sources whose read was REFUSED: the tickable sources ('task', 'manual') and the payment steps ('payment') — they are counted
   * (Home, the events board), and a refused read must say so, never count as "nothing to do".
   */
  unread: PreparationSource[];
};

// ----------------------------------------------------------------------------
// Per-source row shapes — narrow so the Supabase SELECTs match.
// ----------------------------------------------------------------------------

type VendorLineItemRow = {
  line_item_id: string;
  vendor_id: string;
  label: string;
  amount_php: string | number;
  due_date: string | null;
};

type EventVendorPaymentRow = {
  line_item_id: string | null;
  amount_php: string | number;
};

type EventVendorNameRow = {
  vendor_id: string;
  vendor_name: string;
  category?: string | null;
  status?: string | null;
  archived_at?: string | null;
};

type PaperworkSourceRow = {
  id: string;
  document_type: PaperworkDocumentType;
  status: string;
};

type PreparationItemRow = {
  item_id: string;
  vendor_profile_id: string | null;
  due_date: string;
  label: string;
  notes: string | null;
  source_tag: string;
  // Added by 20260730000000 (typed items). Optional here so a pre-migration
  // `select('*')` (columns absent) still type-checks; we coalesce below.
  kind?: string | null;
  amount_php?: string | number | null;
  // Added by 20271300250517 (the merge): the done tick.
  completed_at?: string | null;
};

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function daysBetween(target: Date, now: Date): number {
  const a = new Date(target);
  a.setHours(0, 0, 0, 0);
  const b = new Date(now);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

function toPhp(amount: string | number | null | undefined): number {
  if (amount === null || amount === undefined) return 0;
  const n = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
  return Number.isFinite(n) ? n : 0;
}

function formatPhpShort(php: number): string {
  return `₱${Math.round(php).toLocaleString('en-PH')}`;
}

/**
 * Graceful-degrade guard — when a table is missing on a stale deploy
 * (Postgres 42P01) we return [] for that source instead of throwing, so
 * the Preparation tab keeps rendering. Mirrors lib/budget.ts isMissingRelation.
 */
function isMissingRelation(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01';
}

// ----------------------------------------------------------------------------
// Source 1 — vendor payment milestones (event_vendor_line_items.due_date)
// ----------------------------------------------------------------------------

async function fetchPaymentItems(
  supabase: SupabaseClient,
  eventId: string,
  now: Date,
): Promise<PreparationItem[] | null> {
  // 🔌 HONEST (reads-are-honest, 2026-11-02 audit #17): `null` = refused. A refused PAYMENTS read used to count as
  // "nothing paid", so a paid milestone came back as owed or overdue — money invented on the plan.
  const [lineItemsRes, paymentsRes] = await Promise.all([
    supabase
      .from('event_vendor_line_items')
      .select('line_item_id, vendor_id, label, amount_php, due_date')
      .eq('event_id', eventId)
      .not('due_date', 'is', null),
    supabase
      .from('event_vendor_payments')
      .select('line_item_id, amount_php')
      .eq('event_id', eventId),
  ]);

  if (lineItemsRes.error) {
    if (isMissingRelation(lineItemsRes.error)) return [];
    console.error('[preparation] payment line items:', lineItemsRes.error.message);
    return null;
  }
  if (paymentsRes.error && !isMissingRelation(paymentsRes.error)) {
    console.error('[preparation] payments:', paymentsRes.error.message);
    return null;
  }
  const lineItems = (lineItemsRes.data ?? []) as VendorLineItemRow[];
  if (lineItems.length === 0) return [];

  // Sum payments per line so fully-covered milestones drop out (same rule
  // as renderBudgetIcs — keep the agenda focused on still-owed money).
  const paidByLine = new Map<string, number>();
  for (const p of (paymentsRes.data ?? []) as EventVendorPaymentRow[]) {
    if (!p.line_item_id) continue;
    paidByLine.set(p.line_item_id, (paidByLine.get(p.line_item_id) ?? 0) + toPhp(p.amount_php));
  }

  // Batched vendor-name lookup; RLS already scopes event_vendors to the host.
  const vendorIds = Array.from(new Set(lineItems.map((r) => r.vendor_id)));
  const { data: vendors, error: vendorsError } = await supabase
    .from('event_vendors')
    .select('vendor_id, vendor_name, category, status, archived_at')
    .in('vendor_id', vendorIds);
  if (vendorsError) {
    console.error('[preparation] payment suppliers:', vendorsError.message);
    return null;
  }
  // Only a REAL booking owes money on the plan — a milestone of a shortlisted or archived supplier is not owed.
  const booked = new Set<string>(CONFIRMED_VENDOR_STATUSES as readonly string[]);
  const owingVendor = new Set(
    ((vendors as EventVendorNameRow[]) ?? [])
      .filter((v) => booked.has(v.status ?? '') && !v.archived_at)
      .map((v) => v.vendor_id),
  );
  const vendorName = new Map<string, string>(
    ((vendors as EventVendorNameRow[]) ?? []).map((v) => [v.vendor_id, v.vendor_name]),
  );
  const vendorCategory = new Map<string, string | null>(
    ((vendors as EventVendorNameRow[]) ?? []).map((v) => [v.vendor_id, v.category ?? null]),
  );
  // Each supplier's FIRST still-owed line (its earliest due) — the one a booking task stands for (planning-twins).
  const firstLineOf = new Map<string, { id: string; due: string }>();
  for (const row of lineItems) {
    if (!row.due_date || !owingVendor.has(row.vendor_id)) continue;
    const amt = toPhp(row.amount_php);
    if (amt > 0 && (paidByLine.get(row.line_item_id) ?? 0) >= amt) continue;
    const cur = firstLineOf.get(row.vendor_id);
    if (!cur || row.due_date < cur.due) firstLineOf.set(row.vendor_id, { id: row.line_item_id, due: row.due_date });
  }

  const items: PreparationItem[] = [];
  for (const row of lineItems) {
    if (!row.due_date || !owingVendor.has(row.vendor_id)) continue;
    const amountPhp = toPhp(row.amount_php);
    const paid = paidByLine.get(row.line_item_id) ?? 0;
    if (amountPhp > 0 && paid >= amountPhp) continue; // fully paid → skip
    // due_date is a DATE (no time) — anchor to noon local for stable buckets.
    const date = new Date(`${row.due_date}T12:00:00`);
    if (Number.isNaN(date.getTime())) continue;
    const name = vendorName.get(row.vendor_id) ?? 'Supplier';
    items.push({
      id: `payment:${row.line_item_id}`,
      source: 'payment',
      date,
      daysFromNow: daysBetween(date, now),
      title: `${formatPhpShort(amountPhp)} due to ${name}`,
      subtitle: row.label,
      amountPhp,
      href: `/dashboard/${eventId}/budget`,
      twin: {
        kind: 'payment',
        category: vendorCategory.get(row.vendor_id) ?? null,
        firstLine: firstLineOf.get(row.vendor_id)?.id === row.line_item_id,
      },
    });
  }
  return items;
}

// ----------------------------------------------------------------------------
// Source 2 — government / parish paperwork "complete by" deadlines
// ----------------------------------------------------------------------------

async function fetchPaperworkItems(
  supabase: SupabaseClient,
  eventId: string,
  eventDate: string | null,
  now: Date,
): Promise<PreparationItem[]> {
  // A complete-by deadline is only meaningful once a wedding date exists.
  if (!eventDate) return [];

  const { data, error } = await supabase
    .from('event_paperwork')
    .select('id, document_type, status')
    .eq('event_id', eventId);
  if (error) {
    if (isMissingRelation(error)) return [];
    console.error('[preparation] paperwork:', error.message);
    return [];
  }
  const rows = (data ?? []) as PaperworkSourceRow[];

  const items: PreparationItem[] = [];
  for (const row of rows) {
    if (row.status === 'received') continue; // done → not pending prep
    const completeBy = completeByDate(row.document_type, eventDate);
    if (!completeBy) continue;
    const date = new Date(`${completeBy}T12:00:00`);
    if (Number.isNaN(date.getTime())) continue;
    const meta = DOCUMENT_META[row.document_type];
    if (!meta) continue;
    items.push({
      id: `paperwork:${row.id}`,
      source: 'paperwork',
      date,
      daysFromNow: daysBetween(date, now),
      title: `Complete ${meta.label}`,
      subtitle: meta.processingHint,
      href: `/dashboard/${eventId}/paperwork`,
      twin: { kind: 'paperwork', documentType: row.document_type },
    });
  }
  return items;
}

// ----------------------------------------------------------------------------
// Source 3b — confirmed vendor appointments (event_appointments)
//
// The two-sided Appointments scheduler (Relationship Workspace + Appointments)
// writes event_appointments. A couple's CONFIRMED appointments — a food
// tasting, a fitting, a pre-shoot call scheduled with their booked/shortlisted
// vendors — are dated obligations on the runway, rendered under the
// 'meeting' source (one vocabulary, no new chip). Only confirmed rows WITH a scheduled_at are shown;
// proposed rows still awaiting a decision live in the vendor workspace, and
// cancelled/done are not upcoming prep. Graceful-degrades to [] if the table is
// missing on a stale deploy.
//
// Appointments carry the marketplace vendor_profile_id, not the event_vendors
// PK — so the vendor name + couple-side workspace link resolve via a single
// batched event_vendors lookup keyed on marketplace_vendor_id.
// ----------------------------------------------------------------------------

type AppointmentRow = {
  appointment_id: string;
  vendor_profile_id: string | null;
  kind: string;
  type: string;
  custom_label: string | null;
  location: string | null;
  scheduled_at: string | null;
};

async function fetchAppointmentItems(
  supabase: SupabaseClient,
  eventId: string,
  now: Date,
): Promise<PreparationItem[]> {
  const { data, error } = await supabase
    .from('event_appointments')
    .select('appointment_id, vendor_profile_id, kind, type, custom_label, location, scheduled_at')
    .eq('event_id', eventId)
    .eq('status', 'confirmed')
    .not('scheduled_at', 'is', null)
    .order('scheduled_at', { ascending: true });
  if (error) {
    if (isMissingRelation(error)) return [];
    console.error('[preparation] appointments:', error.message);
    return [];
  }
  const rows = (data ?? []) as AppointmentRow[];
  if (rows.length === 0) return [];

  // Resolve each appointment's vendor (name + workspace link) from the
  // marketplace profile id it carries → the couple's event_vendors row. RLS
  // already scopes event_vendors to the host.
  const profileIds = Array.from(
    new Set(rows.map((r) => r.vendor_profile_id).filter((v): v is string => !!v)),
  );
  const vendorByProfile = new Map<string, { vendorId: string; name: string }>();
  if (profileIds.length > 0) {
    const { data: vendors } = await supabase
      .from('event_vendors')
      .select('vendor_id, vendor_name, marketplace_vendor_id')
      .eq('event_id', eventId)
      .in('marketplace_vendor_id', profileIds);
    for (const v of (vendors ?? []) as Array<{
      vendor_id: string;
      vendor_name: string;
      marketplace_vendor_id: string | null;
    }>) {
      if (v.marketplace_vendor_id) {
        vendorByProfile.set(v.marketplace_vendor_id, { vendorId: v.vendor_id, name: v.vendor_name });
      }
    }
  }

  const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  return rows.map((row) => {
    const date = new Date(row.scheduled_at as string);
    // No catalog fetch — resolveAppointmentLabel falls back to a humanized type
    // key when no label map is supplied (custom rows use their custom_label).
    const title = resolveAppointmentLabel(row, {});
    const kindLabel = APPOINTMENT_KIND_LABEL[row.kind as AppointmentKind] ?? 'Appointment';
    const vendor = row.vendor_profile_id ? vendorByProfile.get(row.vendor_profile_id) : undefined;
    const where = row.kind === 'in_person' && row.location ? ` · ${row.location}` : ` with ${vendor?.name ?? 'your supplier'}`;
    return {
      id: `appointment:${row.appointment_id}`,
      source: 'meeting' as const,
      date,
      daysFromNow: daysBetween(date, now),
      title,
      subtitle: `${fmt.format(date)} · ${kindLabel}${where}`,
      href: vendor
        ? `/dashboard/${eventId}/vendors/${vendor.vendorId}/workspace`
        : `/dashboard/${eventId}/vendors`,
      twin: { kind: 'meeting' as const, appointmentType: row.type },
    };
  });
}

// ----------------------------------------------------------------------------
// Source 4 — computed statutory planning milestones from events.event_date
// ----------------------------------------------------------------------------

type StatutoryMilestone = {
  key: string;
  daysBeforeWedding: number;
  title: string;
  subtitle: string;
  appliesTo: (ceremonyType: string | null | undefined) => boolean;
};

// Same thresholds + copy intent as lib/upcoming-items.ts PAPERWORK_DEADLINES
// (PSA −180d · marriage license −120d · Pre-Cana −60d) so the two surfaces
// agree. Deep-link to /paperwork where the host actually acts on each.
const STATUTORY_MILESTONES: ReadonlyArray<StatutoryMilestone> = [
  {
    key: 'psa_cenomar_window',
    daysBeforeWedding: 180,
    title: 'PSA + CENOMAR window opens',
    subtitle: 'Request your birth certificate and Certificate of No Marriage',
    appliesTo: () => true,
  },
  {
    key: 'marriage_license_window',
    daysBeforeWedding: 120,
    title: 'Marriage license window opens',
    subtitle: 'Valid 120 days from issuance — apply close to your date',
    appliesTo: () => true,
  },
  {
    key: 'pre_cana_cutoff',
    daysBeforeWedding: 60,
    title: 'Pre-Cana seminar cutoff',
    subtitle: 'Most Catholic parishes require completion 60 days before the wedding',
    appliesTo: (ceremonyType) => ceremonyType === 'catholic',
  },
];

function buildStatutoryMilestones(
  eventId: string,
  eventDate: string | null,
  ceremonyType: string | null | undefined,
  now: Date,
): PreparationItem[] {
  if (!eventDate) return [];
  const wedding = new Date(`${eventDate}T12:00:00`);
  if (Number.isNaN(wedding.getTime())) return [];

  return STATUTORY_MILESTONES.filter((m) => m.appliesTo(ceremonyType)).map((m) => {
    const date = new Date(wedding);
    date.setDate(date.getDate() - m.daysBeforeWedding);
    return {
      id: `milestone:${m.key}`,
      source: 'milestone' as const,
      date,
      daysFromNow: daysBetween(date, now),
      title: m.title,
      subtitle: m.subtitle,
      href: `/dashboard/${eventId}/paperwork`,
      twin: { kind: 'milestone' as const, key: m.key },
    };
  });
}

// ----------------------------------------------------------------------------
// Source 5 — manual + vendor-added items (event_preparation_items)
//
// The hybrid layer (2026-06-03). Unlike sources 1–4 this is the ONE source
// backed by a NEW table, so it must graceful-degrade hard: on a stale
// deploy where the migration hasn't been pushed, the table is missing
// (Postgres 42P01) and we return [] — the Preparation tab keeps rendering
// from the autofill alone.
//
// `couple_manual` rows are couple-authored ("Added by you"); `vendor_prep`
// rows were added by a booked vendor ("From {business name}"). Both carry
// isManual=true + the item_id so the agenda can show a delete control. RLS
// already scopes the SELECT to rows the caller may see; this query never
// leaks another event's items.
// ----------------------------------------------------------------------------

async function fetchManualItems(
  supabase: SupabaseClient,
  eventId: string,
  now: Date,
): Promise<PreparationItem[] | null> {
  // SELECT * (not an explicit column list) so the new `kind` / `amount_php`
  // columns don't error on a pre-migration deploy where they don't exist yet
  // — we read them defensively below (kind ?? 'task', amount ?? null).
  const { data, error } = await supabase
    .from('event_preparation_items')
    .select('*')
    .eq('event_id', eventId)
    .order('due_date', { ascending: true });
  if (error) {
    // Missing table on a pre-migration deploy → autofill-only. Any other
    // error (RLS edge, transient) also degrades to [] rather than throwing
    // the whole agenda; we log non-missing errors for diagnosis.
    // 🛑 Since the merge these rows carry a done tick and are COUNTED (Home, the events board): a refused read is
    // `null` — "couldn't load" — never an empty list that reads as "nothing to do". A missing table (a stale deploy)
    // is still genuinely none.
    if (isMissingRelation(error)) return [];
    console.error('[preparation] manual items:', error.message);
    return null;
  }
  const rows = (data ?? []) as PreparationItemRow[];
  if (rows.length === 0) return [];

  // Resolve vendor business names for vendor_prep rows in one batched read.
  const vendorProfileIds = Array.from(
    new Set(
      rows
        .filter((r) => r.vendor_profile_id)
        .map((r) => r.vendor_profile_id as string),
    ),
  );
  const vendorName = new Map<string, string>();
  if (vendorProfileIds.length > 0) {
    const { data: vendors } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', vendorProfileIds);
    for (const v of (vendors ?? []) as Array<{
      vendor_profile_id: string;
      business_name: string | null;
    }>) {
      const name = (v.business_name ?? '').trim();
      if (name) vendorName.set(v.vendor_profile_id, name);
    }
  }

  const items: PreparationItem[] = [];
  for (const row of rows) {
    // due_date is a DATE (no time) — anchor to noon local for stable buckets,
    // mirroring the payment + paperwork sources.
    const date = new Date(`${row.due_date}T12:00:00`);
    if (Number.isNaN(date.getTime())) continue;
    const fromVendor = row.source_tag === 'vendor_prep' && row.vendor_profile_id;
    const vendorLabel = fromVendor
      ? vendorName.get(row.vendor_profile_id as string)
      : undefined;
    const sourceLabel = fromVendor
      ? `From ${vendorLabel ?? 'your supplier'}`
      : 'Added by you';

    // Typed items (20260730000000). `kind` / `amount_php` may be absent on a
    // pre-migration deploy (SELECT * returns no such keys) → default to a
    // generic task with no amount, preserving the old behavior exactly.
    const kind: PreparationItemKind =
      row.kind === 'meeting' || row.kind === 'payment' ? row.kind : 'task';
    const amount =
      kind === 'payment' && row.amount_php != null
        ? toPhp(row.amount_php)
        : null;

    // The subtitle leads with notes when present; otherwise it carries the
    // "who added this" context (so a typed Meeting/Payment row whose chip now
    // reads "Meeting"/"Payment" still shows it was added by you / a vendor).
    const subtitle = (row.notes ?? '').trim() || sourceLabel;

    items.push({
      id: `manual:${row.item_id}`,
      source: 'manual',
      kind,
      date,
      daysFromNow: daysBetween(date, now),
      title: row.label,
      subtitle,
      // Surface the amount on payment rows so the agenda renders it the same
      // way it formats autofilled vendor-payment amounts.
      ...(amount != null ? { amountPhp: amount } : {}),
      sourceLabel,
      isManual: true,
      itemId: row.item_id,
      done: row.completed_at != null,
    });
  }
  return items;
}

// ----------------------------------------------------------------------------
// Source 6 — the old Checklist's tasks (event_checklist_items), owner 2026-11-01
//
// The rows the Checklist page used to list, through the ONE reader of them
// (`readChecklistItems`, honest: null = refused), the same profile gate
// (`checklistItemAllowedForProfile`), the same deadline anchor
// (`checklistAnchorDateFor`) and the same runway compression
// (`checklistRunwayFor`) — so a task lands on the day it always did, unless the
// host moved it (`due_date_set`).
// ----------------------------------------------------------------------------

/** The event's date fields a task's template date is counted back from. */
export type PlanningTaskEvent = {
  event_type: string | null;
  event_date: string | null;
  date_candidates?: string[] | null;
  date_window_start?: string | null;
  created_at?: string | null;
};

/** The profile slice the task gate reads (`checklistItemAllowedForProfile`). */
export type PlanningProfile = Parameters<typeof checklistItemAllowedForProfile>[2];

/** Pure: checklist rows → Planning Stage task rows. Exported for the labs and the guards. */
export function taskItemsFrom(
  rawRows: ReadonlyArray<ChecklistItemRow>,
  opts: { eventId: string; event: PlanningTaskEvent; profile?: PlanningProfile | null; now: Date },
): PreparationItem[] {
  const rows = opts.profile
    ? rawRows.filter((r) => checklistItemAllowedForProfile(r.category, r.template_key, opts.profile!))
    : [...rawRows];
  const anchor = checklistAnchorDateFor({
    event_type: opts.event.event_type,
    event_date: opts.event.event_date,
    date_candidates: opts.event.date_candidates ?? null,
    date_window_start: opts.event.date_window_start ?? null,
  });
  // Measured over ALL rows (as the Checklist did): the span is a property of the plan, not of what is left open.
  const runway = checklistRunwayFor(rows, anchor, opts.event.created_at ?? null);
  return rows.map((r) => {
    const planDateIso = dueDateForItem(anchor, r.due_offset_days, runway);
    const set = typeof r.due_date_set === 'string' && /^\d{4}-\d{2}-\d{2}/.test(r.due_date_set) ? r.due_date_set.slice(0, 10) : null;
    const dateIso = set ?? planDateIso;
    const date = dateIso ? new Date(`${dateIso}T12:00:00`) : null;
    const category = CHECKLIST_CATEGORY_LABELS[r.category] ?? 'To do';
    return {
      id: `task:${r.item_id}`,
      source: 'task' as const,
      date: date && !Number.isNaN(date.getTime()) ? date : null,
      daysFromNow: date && !Number.isNaN(date.getTime()) ? daysBetween(date, opts.now) : null,
      title: r.title,
      subtitle: category,
      sourceLabel: category,
      href: checklistItemHref(opts.eventId, r.template_key, r.category) ?? undefined,
      done: r.status === 'done',
      taskItemId: r.item_id,
      templateKey: r.template_key,
      dateIso,
      planDateIso,
      dateSet: set !== null,
      afterDay: (r.due_offset_days ?? 0) < 0,
    };
  });
}

async function fetchTaskItems(
  supabase: SupabaseClient,
  eventId: string,
  event: PlanningTaskEvent,
  profile: PlanningProfile | null | undefined,
  now: Date,
): Promise<PreparationItem[] | null> {
  const raw = await readChecklistItems(supabase, eventId).catch(() => null);
  if (raw === null) return null;
  return taskItemsFrom(raw, { eventId, event, profile, now });
}

// ----------------------------------------------------------------------------
// One piece of work shows once — the fold (lib/planning-twins.ts)
// ----------------------------------------------------------------------------

function shortDate(d: Date | null): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}

/**
 * Pure: fold every autofill row that is the same work as a task INTO that task. The task stays (its tick, its date);
 * the twin leaves the list and its fact rides on the task's second line, its link becomes the task's link.
 * Never adds, removes or re-dates a task — see `lib/planning-twins.ts` for why that matters.
 */
export function foldTwins(items: ReadonlyArray<PreparationItem>): PreparationItem[] {
  const taskByKey = new Map<string, PreparationItem>();
  for (const it of items) {
    if (it.source === 'task' && it.templateKey && !taskByKey.has(it.templateKey)) taskByKey.set(it.templateKey, { ...it });
  }
  if (taskByKey.size === 0) return [...items];
  const absorbed = new Set<string>();
  for (const it of items) {
    if (it.source === 'task' || !it.twin) continue;
    const key = twinTaskKey(it.twin);
    const task = key ? taskByKey.get(key) : undefined;
    if (!task) continue;
    if (task.done && !foldsIntoDoneTask(it.twin)) continue;
    task.folded = [
      ...(task.folded ?? []),
      { id: it.id, source: it.source, title: it.title, subtitle: it.subtitle, date: it.date, amountPhp: it.amountPhp, href: it.href },
    ];
    absorbed.add(it.id);
  }
  return items
    .filter((it) => !absorbed.has(it.id))
    .map((it) => {
      if (it.source !== 'task' || !it.templateKey) return it;
      const t = taskByKey.get(it.templateKey);
      if (!t || t.id !== it.id || !t.folded || t.folded.length === 0) return it;
      const [first, ...rest] = t.folded;
      const when = shortDate(first!.date);
      const money = t.folded.find((f) => f.amountPhp !== undefined)?.amountPhp;
      return {
        ...t,
        subtitle: [first!.title, when, rest.length > 0 ? `+${rest.length} more` : null].filter(Boolean).join(' · '),
        href: first!.href ?? t.href,
        ...(money !== undefined ? { amountPhp: money } : {}),
      };
    });
}

// ----------------------------------------------------------------------------
// What the one list counts — Home's To do tile, the events board
// ----------------------------------------------------------------------------

export type PlanningProgress = {
  /** Ticked rows of the To do filter. */
  done: number;
  /** Every row of the To do filter. */
  total: number;
  /** Rows still open. */
  open: number;
  /** Open rows whose date has passed. */
  overdue: number;
  /** Open rows due within seven days, the overdue ones included. */
  dueThisWeek: number;
  /** The open rows soonest first (undated last) — `id` is the row's address (`planningRowId`). */
  next: Array<{ id: string; title: string; dueDate: string | null; daysUntilDue: number | null }>;
};

function isoOf(d: Date | null): string | null {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Pure: the counts of the To do filter. THE one counting rule — Home and the board read nothing else. */
export function planningProgress(items: ReadonlyArray<PreparationItem>, limit = 3): PlanningProgress {
  const todo = items.filter(isTodoItem);
  const open = todo.filter((t) => !t.done);
  const ranked = [...open].sort((a, b) => {
    if (a.daysFromNow === null && b.daysFromNow === null) return 0;
    if (a.daysFromNow === null) return 1;
    if (b.daysFromNow === null) return -1;
    return a.daysFromNow - b.daysFromNow;
  });
  return {
    done: todo.length - open.length,
    total: todo.length,
    open: open.length,
    overdue: open.filter((t) => t.daysFromNow !== null && t.daysFromNow < 0).length,
    dueThisWeek: open.filter((t) => t.daysFromNow !== null && t.daysFromNow <= 7).length,
    next: ranked.slice(0, Math.max(0, limit)).map((t) => ({
      id: planningRowId(t) ?? t.id,
      title: t.title,
      dueDate: t.dateIso ?? isoOf(t.date),
      daysUntilDue: t.daysFromNow,
    })),
  };
}

// ----------------------------------------------------------------------------
// Vendor-side read — the items THIS vendor has added, keyed by event
//
// Powers the vendor Bookings view's "what I've added" list + per-item delete.
// RLS (event_prep_items_vendor_read) already restricts the SELECT to rows the
// vendor authored or can see; we additionally filter to vendor_profile_id so
// the vendor sees only their OWN added rows here (couple-added rows on the
// same event are not the vendor's to manage). Graceful-degrades to {} when
// the table is missing on a pre-migration deploy.
// ----------------------------------------------------------------------------

export type VendorAddedPrepItem = {
  itemId: string;
  eventId: string;
  dueDate: string;
  label: string;
  notes: string | null;
  /** 'task' | 'meeting' | 'payment' — defaults to 'task' pre-migration. */
  kind: PreparationItemKind;
  /** Whole/decimal pesos on payment rows; null otherwise. */
  amountPhp: number | null;
};

export async function fetchVendorPreparationItemsByEvent(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<Map<string, VendorAddedPrepItem[]>> {
  const byEvent = new Map<string, VendorAddedPrepItem[]>();
  // SELECT * so the new kind/amount_php columns don't error pre-migration.
  const { data, error } = await supabase
    .from('event_preparation_items')
    .select('*')
    .eq('vendor_profile_id', vendorProfileId)
    .order('due_date', { ascending: true });
  if (error) {
    if (!isMissingRelation(error)) {
      console.error('[preparation] vendor items:', error.message);
    }
    return byEvent;
  }
  const vendorRows = (data ?? []) as Array<PreparationItemRow & { event_id: string }>;
  for (const r of vendorRows) {
    const kind: PreparationItemKind =
      r.kind === 'meeting' || r.kind === 'payment' ? r.kind : 'task';
    const amountPhp =
      kind === 'payment' && r.amount_php != null ? toPhp(r.amount_php) : null;
    const list = byEvent.get(r.event_id) ?? [];
    list.push({
      itemId: r.item_id,
      eventId: r.event_id,
      dueDate: r.due_date,
      label: r.label,
      notes: r.notes,
      kind,
      amountPhp,
    });
    byEvent.set(r.event_id, list);
  }
  return byEvent;
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export type FetchPreparationInput = {
  supabase: SupabaseClient;
  eventId: string;
  eventDate: string | null;
  ceremonyType: string | null | undefined;
  now: Date;
  // Iteration 0053 P4 Unit 1: whether this event type has a statutory
  // (PH-marriage) prep pack. The caller derives it from the Event-Type Profile
  // (profile.statutoryPackKey === 'ph_marriage'). Defaults TRUE so any caller
  // that omits it keeps today's wedding behaviour byte-identical; a non-wedding
  // event passes false → no PSA/CENOMAR/marriage-license milestones.
  statutory?: boolean;
  /**
   * The event's date fields the TASKS count back from (`checklistAnchorDateFor` + the runway). Omitted → the locked
   * `eventDate` alone (a wedding's anchor), no runway compression.
   */
  event?: PlanningTaskEvent;
  /** The profile gate the tasks pass through (a vendor-free event shows no "Book a photographer"). */
  profile?: PlanningProfile | null;
  /**
   * `'todo'` — read only the tickable sources (tasks + hand-added rows): the To do filter, for a caller that only
   * COUNTS (Home, the events board). Safe because a fold never changes the To do filter (`lib/planning-twins.ts`).
   */
  only?: 'todo';
};

/**
 * Pure: every source's rows → the one list. Folds twins, sorts (dated rows by date, undated tasks last), buckets by
 * month. Exported so the labs draw the REAL list on fixture rows.
 */
export function assemblePlanningList(
  rows: ReadonlyArray<PreparationItem>,
  unread: PreparationSource[] = [],
): PreparationAgenda {
  const items = foldTwins(rows).sort((a, b) => {
    if (a.date === null && b.date === null) return 0;
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date.getTime() - b.date.getTime();
  });

  // Bucket by calendar month, months ascending (matches the already-sorted
  // items order). Overdue items land in their real month so the couple can
  // still see "this was due back in January". Undated tasks gather last.
  const groupMap = new Map<string, PreparationGroup>();
  for (const item of items) {
    const key = item.date
      ? `${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, '0')}`
      : UNDATED_GROUP_KEY;
    let group = groupMap.get(key);
    if (!group) {
      group = {
        key,
        label: item.date
          ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(item.date)
          : 'No date yet',
        items: [],
      };
      groupMap.set(key, group);
    }
    group.items.push(item);
  }
  const groups = Array.from(groupMap.values()).sort((a, b) => a.key.localeCompare(b.key));

  const sourceCounts: Record<PreparationSource, number> = {
    task: 0,
    payment: 0,
    paperwork: 0,
    meeting: 0,
    milestone: 0,
    manual: 0,
  };
  for (const it of items) sourceCounts[it.source] += 1;

  return { items, groups, sourceCounts, unread };
}

/** The undated group sorts after every `YYYY-MM` key. */
const UNDATED_GROUP_KEY = '9999-99';

/**
 * Aggregate every dated preparation item for an event into one
 * chronologically-sorted, month-grouped agenda. Unlike the Home
 * "Upcoming" stream this KEEPS overdue items (negative daysFromNow) so a
 * couple sees what they've slipped on, and it omits subscription renewals.
 *
 * Autofill sources graceful-degrade independently — a missing table or query
 * error yields [] for that source. The two TICKABLE sources (tasks, hand-added
 * rows) are counted, so a refused read of either is reported in `unread`.
 */
export async function fetchPreparationAgenda(
  input: FetchPreparationInput,
): Promise<PreparationAgenda> {
  const { supabase, eventId, eventDate, ceremonyType, now, statutory = true, only } = input;
  const taskEvent: PlanningTaskEvent = input.event ?? { event_type: 'wedding', event_date: eventDate };
  const todoOnly = only === 'todo';

  const [tasks, manual, payments, paperwork, appointments] = await Promise.all([
    // Source 6 — the old Checklist's tasks (owner 2026-11-01). Honest: null = refused.
    fetchTaskItems(supabase, eventId, taskEvent, input.profile, now),
    // Source 5 — hybrid manual + vendor-added rows. Honest: null = refused.
    fetchManualItems(supabase, eventId, now),
    todoOnly ? Promise.resolve([] as PreparationItem[]) : fetchPaymentItems(supabase, eventId, now),
    todoOnly ? Promise.resolve([] as PreparationItem[]) : fetchPaperworkItems(supabase, eventId, eventDate, now),
    // Source 3b — confirmed appointments from the two-sided scheduler. Folded
    // into the 'meeting' source so they share the Meeting chip/vocabulary.
    todoOnly ? Promise.resolve([] as PreparationItem[]) : fetchAppointmentItems(supabase, eventId, now),
  ]);
  // Iteration 0053 P4 Unit 1: PH-marriage statutory milestones only for events
  // whose profile has the statutory pack (weddings). statutory defaults TRUE so
  // weddings are byte-identical; non-weddings pass false → no milestones.
  const milestones =
    statutory && !todoOnly ? buildStatutoryMilestones(eventId, eventDate, ceremonyType, now) : [];
  // ⏭ THE SEAM FOR CHAPTERS (Step 2, #7143): pre-day chapters join HERE as one more source, never a second list.

  const unread: PreparationSource[] = [];
  if (tasks === null) unread.push('task');
  if (manual === null) unread.push('manual');
  if (payments === null) unread.push('payment');

  return assemblePlanningList(
    [...(tasks ?? []), ...(payments ?? []), ...paperwork, ...appointments, ...milestones, ...(manual ?? [])],
    unread,
  );
}
