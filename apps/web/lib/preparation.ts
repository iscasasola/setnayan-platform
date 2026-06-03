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
 *  3. Meeting    · vendor_meetings.starts_at — consultations, tastings,
 *                  fittings, site visits with vendors. Source: iteration
 *                  0006 meetings module.
 *  4. Milestone  · computed statutory windows from events.event_date +
 *                  ceremony_type (PSA/CENOMAR opens −180d, marriage-license
 *                  window −120d, Pre-Cana cutoff −60d for Catholic). These
 *                  are the concierge-flavored derived planning dates. Same
 *                  thresholds as lib/upcoming-items.ts PAPERWORK_DEADLINES.
 *
 * ── Deliberately NOT wired (documented gaps) ────────────────────────────
 *  • Manual prep items — would require a NEW table (user-authored agenda
 *    rows). DEFERRED to a documented fast-follow per the live-app additive
 *    constraint. This module is read-only aggregation only.
 *  • Orders due dates — the `orders` table has NO due-date column (only
 *    created_at / paid_at / reviewed_at / expires_at). `expires_at` is a
 *    subscription-renewal date, surfaced on Home + Orders already; it is
 *    NOT a wedding-preparation milestone, so it is intentionally omitted.
 *  • Concierge / Today's Focus per-step milestones — the 0016 wizard is an
 *    ordered card list with NO per-step due/target date column. The only
 *    concierge-adjacent dated data is the statutory windows, wired above as
 *    the Milestone source.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { completeByDate, DOCUMENT_META, type PaperworkDocumentType } from './paperwork';

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
  | 'payment'
  | 'paperwork'
  | 'meeting'
  | 'milestone'
  | 'manual';

export const PREPARATION_SOURCE_LABEL: Record<PreparationSource, string> = {
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
 * same as the autofilled vendor_meetings rows), or a `payment` schedule
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
  /** The date this item is anchored to (a due date, deadline, or start). */
  date: Date;
  /** Whole-day diff between `now` and `date` (negative = overdue/past). */
  daysFromNow: number;
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
};

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
};

type PaperworkSourceRow = {
  id: string;
  document_type: PaperworkDocumentType;
  status: string;
};

type VendorMeetingRow = {
  meeting_id: string;
  vendor_id: string;
  starts_at: string;
  ends_at: string | null;
  mode: string;
  title: string;
  location: string | null;
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

const MEETING_MODE_LABEL: Record<string, string> = {
  in_person: 'In-person meeting',
  video_call: 'Video call',
  phone_call: 'Phone call',
  site_visit: 'Site visit',
  food_tasting: 'Food tasting',
  fitting: 'Fitting',
  consultation: 'Consultation',
};

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
): Promise<PreparationItem[]> {
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
    return [];
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
  const { data: vendors } = await supabase
    .from('event_vendors')
    .select('vendor_id, vendor_name')
    .in('vendor_id', vendorIds);
  const vendorName = new Map<string, string>(
    ((vendors as EventVendorNameRow[]) ?? []).map((v) => [v.vendor_id, v.vendor_name]),
  );

  const items: PreparationItem[] = [];
  for (const row of lineItems) {
    if (!row.due_date) continue;
    const amountPhp = toPhp(row.amount_php);
    const paid = paidByLine.get(row.line_item_id) ?? 0;
    if (amountPhp > 0 && paid >= amountPhp) continue; // fully paid → skip
    // due_date is a DATE (no time) — anchor to noon local for stable buckets.
    const date = new Date(`${row.due_date}T12:00:00`);
    if (Number.isNaN(date.getTime())) continue;
    const name = vendorName.get(row.vendor_id) ?? 'Vendor';
    items.push({
      id: `payment:${row.line_item_id}`,
      source: 'payment',
      date,
      daysFromNow: daysBetween(date, now),
      title: `${formatPhpShort(amountPhp)} due to ${name}`,
      subtitle: row.label,
      amountPhp,
      href: `/dashboard/${eventId}/budget`,
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
    });
  }
  return items;
}

// ----------------------------------------------------------------------------
// Source 3 — vendor meetings (consultations, tastings, fittings, site visits)
// ----------------------------------------------------------------------------

async function fetchMeetingItems(
  supabase: SupabaseClient,
  eventId: string,
  now: Date,
): Promise<PreparationItem[]> {
  const { data, error } = await supabase
    .from('vendor_meetings')
    .select('meeting_id, vendor_id, starts_at, ends_at, mode, title, location')
    .eq('event_id', eventId)
    .order('starts_at', { ascending: true });
  if (error) {
    if (isMissingRelation(error)) return [];
    console.error('[preparation] meetings:', error.message);
    return [];
  }
  const meetings = (data ?? []) as VendorMeetingRow[];
  if (meetings.length === 0) return [];

  const vendorIds = Array.from(new Set(meetings.map((m) => m.vendor_id)));
  const { data: vendors } = await supabase
    .from('event_vendors')
    .select('vendor_id, vendor_name')
    .in('vendor_id', vendorIds);
  const vendorName = new Map<string, string>(
    ((vendors as EventVendorNameRow[]) ?? []).map((v) => [v.vendor_id, v.vendor_name]),
  );

  return meetings.map((row) => {
    const date = new Date(row.starts_at);
    const name = vendorName.get(row.vendor_id) ?? 'Vendor';
    const modeLabel = MEETING_MODE_LABEL[row.mode] ?? 'Meeting';
    const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
    const timeLabel = row.ends_at
      ? `${fmt.format(date)} – ${fmt.format(new Date(row.ends_at))}`
      : fmt.format(date);
    const subtitle = row.location
      ? `${timeLabel} · ${modeLabel} · ${row.location}`
      : `${timeLabel} · ${modeLabel} with ${name}`;
    return {
      id: `meeting:${row.meeting_id}`,
      source: 'meeting' as const,
      date,
      daysFromNow: daysBetween(date, now),
      title: row.title,
      subtitle,
      href: `/dashboard/${eventId}/vendors/${row.vendor_id}`,
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
): Promise<PreparationItem[]> {
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
    if (!isMissingRelation(error)) {
      console.error('[preparation] manual items:', error.message);
    }
    return [];
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
      ? `From ${vendorLabel ?? 'your vendor'}`
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
    });
  }
  return items;
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
};

/**
 * Aggregate every dated preparation item for an event into one
 * chronologically-sorted, month-grouped agenda. Unlike the Home
 * "Upcoming" stream this KEEPS overdue items (negative daysFromNow) so a
 * couple sees what they've slipped on, and it omits subscription renewals.
 *
 * Each source graceful-degrades independently — a missing table or query
 * error yields [] for that source, never a thrown agenda.
 */
export async function fetchPreparationAgenda(
  input: FetchPreparationInput,
): Promise<PreparationAgenda> {
  const { supabase, eventId, eventDate, ceremonyType, now } = input;

  const [payments, paperwork, meetings, manual] = await Promise.all([
    fetchPaymentItems(supabase, eventId, now),
    fetchPaperworkItems(supabase, eventId, eventDate, now),
    fetchMeetingItems(supabase, eventId, now),
    // Source 5 — hybrid manual + vendor-added rows. Graceful-degrades to []
    // when event_preparation_items doesn't exist yet (pre-migration deploy).
    fetchManualItems(supabase, eventId, now),
  ]);
  const milestones = buildStatutoryMilestones(eventId, eventDate, ceremonyType, now);

  const items = [
    ...payments,
    ...paperwork,
    ...meetings,
    ...milestones,
    ...manual,
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Bucket by calendar month, months ascending (matches the already-sorted
  // items order). Overdue items land in their real month so the couple can
  // still see "this was due back in January".
  const groupMap = new Map<string, PreparationGroup>();
  for (const item of items) {
    const key = `${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, '0')}`;
    let group = groupMap.get(key);
    if (!group) {
      group = {
        key,
        label: new Intl.DateTimeFormat('en-US', {
          month: 'long',
          year: 'numeric',
        }).format(item.date),
        items: [],
      };
      groupMap.set(key, group);
    }
    group.items.push(item);
  }
  const groups = Array.from(groupMap.values()).sort((a, b) => a.key.localeCompare(b.key));

  const sourceCounts: Record<PreparationSource, number> = {
    payment: payments.length,
    paperwork: paperwork.length,
    meeting: meetings.length,
    milestone: milestones.length,
    manual: manual.length,
  };

  return { items, groups, sourceCounts };
}
