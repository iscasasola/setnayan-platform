/**
 * Unified upcoming-items fetcher for the V1 Home aggregation hub.
 *
 * Owner directive 2026-05-22: Home must surface every time-sensitive
 * obligation the host has — vendor meetings, day-of schedule blocks,
 * vendor payment milestones, Setnayan SKU subscription renewals, and
 * statutory paperwork windows (PSA, marriage license, Pre-Cana). One
 * pass, sorted chronologically, top N visible.
 *
 * Built on top of PR #329's `UpcomingSchedules` component. That PR
 * pulled only from `event_schedule_blocks`; this module widens the
 * stream to five sources and folds them into a single shape so the
 * Home page renders one merged list.
 *
 * Source-by-source schema audit (refreshed 2026-05-22 Wave 2):
 *
 *  ┌────┬─────────────────────────────────────┬─────────────────────────┐
 *  │ #  │ Source                               │ Table / column          │
 *  ├────┼─────────────────────────────────────┼─────────────────────────┤
 *  │ 1  │ Vendor meetings                      │ vendor_meetings          │
 *  │ 2  │ Day-of schedule blocks               │ event_schedule_blocks    │
 *  │ 3  │ Vendor payment milestones            │ event_vendor_line_items  │
 *  │ 4  │ Setnayan SKU subscription renewals   │ orders.expires_at        │
 *  │ 5  │ Statutory document deadlines         │ computed from events.event_date │
 *  └────┴─────────────────────────────────────┴─────────────────────────┘
 *
 * `vendor_meetings` shipped via migration 20260604060000 (PR following
 * PR #336 to close the table gap that left source #1 returning empty).
 * Spec source: iteration 0006 § "Meetings module" — locked 2026-05-09.
 *
 * Document deadlines are PURE COMPUTED — no table read. The host's
 * `events.event_date` + `events.ceremony_type` are the only inputs.
 * Catholic weddings surface Pre-Cana; civil/other ceremony types skip
 * it. The thresholds match iteration 0016 § 1 "Locked Sequence":
 *   - PSA / CENOMAR window opens: wedding_date − 180 days
 *   - Marriage license window opens: wedding_date − 120 days (PH law,
 *     license valid for 120 days, RA 386 Family Code Art. 20)
 *   - Pre-Cana parish-seminar cutoff: wedding_date − 60 days (Catholic
 *     parishes typically require Pre-Cana completion 60 days out;
 *     verify with parish for the exact window per CLAUDE.md
 *     2026-05-19 row)
 *
 * Past-dated items are silently skipped. The host sees future
 * obligations only — past schedule blocks belong on the activity
 * feed, not the "next-up" surface.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { findSku } from './sku-catalog';
import {
  PLAN_GROUPS,
  canonicalServiceToPlanGroupId,
  statusOfVendor,
  type PlanGroupId,
} from './wedding-plan-groups';

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

export type UpcomingItemSource =
  | 'meeting'
  | 'schedule_block'
  | 'vendor_payment'
  | 'setnayan_sku_expiry'
  | 'document_deadline'
  | 'start_looking';

export type UpcomingItemCategory =
  | 'meeting'
  | 'payment'
  | 'document'
  | 'renewal'
  | 'schedule'
  | 'start_looking';

export type UpcomingItem = {
  /** Stable id — unique per source + row. Used as React key. */
  id: string;
  source: UpcomingItemSource;
  category: UpcomingItemCategory;
  /** Future timestamp the item refers to. */
  date: Date;
  /** Whole-day diff between now and date (negative = past). */
  daysFromNow: number;
  /** Headline copy, no jargon, short. */
  title: string;
  /** Supporting context — vendor name, milestone description, etc. */
  subtitle: string;
  /** PHP centavos for payment items. Undefined elsewhere. */
  amountCentavos?: number;
  /** Vendor display name when source = vendor_payment or meeting. */
  vendorBusinessName?: string;
  /** Deep-link target for tap-through. Stays on-platform. */
  href?: string;
};

// ----------------------------------------------------------------------------
// Per-source row shapes — kept narrow so the supabase query SELECTs match.
// ----------------------------------------------------------------------------

type ScheduleBlockRow = {
  block_id: string;
  label: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  block_type: string;
};

type VendorLineItemRow = {
  line_item_id: string;
  vendor_id: string;
  label: string;
  amount_php: string | number; // Supabase serializes NUMERIC as string in some clients
  due_date: string | null;
};

type EventVendorNameRow = {
  vendor_id: string;
  vendor_name: string;
};

type SubscriptionOrderRow = {
  order_id: string;
  service_key: string | null;
  description: string;
  confirmed_total_php: string | number | null;
  requested_total_php: string | number;
  expires_at: string | null;
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

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function daysBetween(future: Date, now: Date): number {
  const a = new Date(future);
  a.setHours(0, 0, 0, 0);
  const b = new Date(now);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

function toCentavos(amountPhp: string | number | null | undefined): number {
  if (amountPhp === null || amountPhp === undefined) return 0;
  const n = typeof amountPhp === 'string' ? Number.parseFloat(amountPhp) : amountPhp;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

// ----------------------------------------------------------------------------
// Source 1 — vendor_meetings (couple ⋈ vendor scheduled meetings)
//
// Reads from public.vendor_meetings (migration 20260604060000). The table
// links each meeting to one event_vendors row (couple's per-event vendor
// record), NOT vendor_profiles — see migration header for the
// architectural rationale. Display name flows from event_vendors.vendor_name
// in the same pattern as fetchVendorPaymentItems.
//
// Past meetings (starts_at <= now) are skipped — Home surfaces future
// obligations only. The merged-stream's final filter would also catch
// these, but cutting them at the DB layer keeps the result set small
// for events with long meeting histories.
// ----------------------------------------------------------------------------

async function fetchVendorMeetings(
  supabase: SupabaseClient,
  eventId: string,
  now: Date,
): Promise<UpcomingItem[]> {
  const { data: meetings, error } = await supabase
    .from('vendor_meetings')
    .select('meeting_id, vendor_id, starts_at, ends_at, mode, title, location')
    .eq('event_id', eventId)
    .gt('starts_at', now.toISOString())
    .order('starts_at', { ascending: true })
    .limit(20);

  if (error || !meetings || meetings.length === 0) return [];

  // Batched vendor-name lookup — same pattern as fetchVendorPaymentItems.
  // RLS on event_vendors already scopes to the current host's event, so
  // no need to constrain by event_id in the IN-clause.
  const vendorIds = Array.from(
    new Set((meetings as VendorMeetingRow[]).map((row) => row.vendor_id)),
  );
  const { data: vendors } = await supabase
    .from('event_vendors')
    .select('vendor_id, vendor_name')
    .in('vendor_id', vendorIds);
  const vendorName = new Map<string, string>(
    ((vendors as EventVendorNameRow[]) ?? []).map((v) => [v.vendor_id, v.vendor_name]),
  );

  return (meetings as VendorMeetingRow[]).map((row) => {
    const date = new Date(row.starts_at);
    const name = vendorName.get(row.vendor_id) ?? 'Vendor';
    return {
      id: `meeting:${row.meeting_id}`,
      source: 'meeting' as const,
      category: 'meeting' as const,
      date,
      daysFromNow: daysBetween(date, now),
      title: row.title,
      subtitle: formatMeetingSubtitle(date, row.ends_at, row.mode, row.location, name),
      vendorBusinessName: name,
      href: `/dashboard/${eventId}/vendors/${row.vendor_id}`,
    };
  });
}

function formatMeetingSubtitle(
  start: Date,
  endIso: string | null,
  mode: string,
  location: string | null,
  vendorName: string,
): string {
  const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  const startLabel = fmt.format(start);
  const timeLabel = endIso ? `${startLabel} – ${fmt.format(new Date(endIso))}` : startLabel;
  const modeLabel = MEETING_MODE_LABEL[mode] ?? 'meeting';
  // Pattern: "3:00 PM – 4:30 PM · Food tasting with Casa Manila Catering"
  // Or when location is set: "3:00 PM · Site visit at Casa Manila"
  if (location) {
    return `${timeLabel} · ${modeLabel} · ${location}`;
  }
  return `${timeLabel} · ${modeLabel} with ${vendorName}`;
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

// ----------------------------------------------------------------------------
// Source 2 — event_schedule_blocks
// ----------------------------------------------------------------------------

async function fetchScheduleBlockItems(
  supabase: SupabaseClient,
  eventId: string,
  now: Date,
): Promise<UpcomingItem[]> {
  const { data, error } = await supabase
    .from('event_schedule_blocks')
    .select('block_id, label, start_at, end_at, location, block_type')
    .eq('event_id', eventId)
    .gte('start_at', now.toISOString())
    .order('start_at', { ascending: true })
    .limit(20);

  if (error || !data) return [];

  return (data as ScheduleBlockRow[]).map((row) => {
    const date = new Date(row.start_at);
    return {
      id: `schedule_block:${row.block_id}`,
      source: 'schedule_block' as const,
      category: 'schedule' as const,
      date,
      daysFromNow: daysBetween(date, now),
      title: row.label,
      subtitle: row.location ? formatScheduleSubtitle(date, row.end_at, row.location) : formatScheduleSubtitle(date, row.end_at, null),
      href: `/dashboard/${eventId}/schedule`,
    };
  });
}

function formatScheduleSubtitle(start: Date, endIso: string | null, location: string | null): string {
  const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  const startLabel = fmt.format(start);
  const timeLabel = endIso ? `${startLabel} – ${fmt.format(new Date(endIso))}` : startLabel;
  return location ? `${timeLabel} · ${location}` : timeLabel;
}

// ----------------------------------------------------------------------------
// Source 3 — event_vendor_line_items (payment milestones with a due_date)
// ----------------------------------------------------------------------------

async function fetchVendorPaymentItems(
  supabase: SupabaseClient,
  eventId: string,
  now: Date,
): Promise<UpcomingItem[]> {
  // Pull line items that have a due_date in the future. We treat any
  // line item with a due_date as a "milestone" — labels like "Deposit"
  // / "Balance" / "Tip" all qualify. The host can mark them satisfied
  // by recording an event_vendor_payments row in the budget surface.
  //
  // Schema reference: 20260513110000_iteration_0007_budget.sql
  //   event_vendor_line_items(line_item_id, vendor_id, label, amount_php,
  //                            due_date, sort_order, created_at)
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10); // YYYY-MM-DD for DATE comparison

  const { data: lineItems, error: lineItemsErr } = await supabase
    .from('event_vendor_line_items')
    .select('line_item_id, vendor_id, label, amount_php, due_date')
    .eq('event_id', eventId)
    .not('due_date', 'is', null)
    .gte('due_date', todayIso)
    .order('due_date', { ascending: true })
    .limit(20);

  if (lineItemsErr || !lineItems || lineItems.length === 0) return [];

  // Resolve vendor names via a single batched lookup. RLS already
  // restricts event_vendors to the current host's event so we don't
  // need to pass the event_id explicitly in the IN-clause.
  const vendorIds = Array.from(
    new Set((lineItems as VendorLineItemRow[]).map((row) => row.vendor_id)),
  );
  const { data: vendors } = await supabase
    .from('event_vendors')
    .select('vendor_id, vendor_name')
    .in('vendor_id', vendorIds);
  const vendorName = new Map<string, string>(
    ((vendors as EventVendorNameRow[]) ?? []).map((v) => [v.vendor_id, v.vendor_name]),
  );

  return (lineItems as VendorLineItemRow[]).map((row) => {
    // due_date is a DATE (no time component). Anchor to noon local so
    // the day-bucketing in the merged stream is unambiguous.
    const date = new Date(`${row.due_date}T12:00:00`);
    const name = vendorName.get(row.vendor_id) ?? 'Vendor';
    const amountCentavos = toCentavos(row.amount_php);
    return {
      id: `vendor_payment:${row.line_item_id}`,
      source: 'vendor_payment' as const,
      category: 'payment' as const,
      date,
      daysFromNow: daysBetween(date, now),
      title: `${formatCentavosShort(amountCentavos)} due to ${name}`,
      subtitle: row.label,
      amountCentavos,
      vendorBusinessName: name,
      href: `/dashboard/${eventId}/budget`,
    };
  });
}

function formatCentavosShort(centavos: number): string {
  // Compact PHP rendering matching the rest of Home (e.g. ₱25,000).
  const peso = Math.round(centavos / 100);
  return `₱${peso.toLocaleString('en-PH')}`;
}

// ----------------------------------------------------------------------------
// Source 4 — orders.expires_at (Setnayan SKU subscription renewals)
// ----------------------------------------------------------------------------

async function fetchSkuRenewalItems(
  supabase: SupabaseClient,
  eventId: string,
  now: Date,
): Promise<UpcomingItem[]> {
  // Subscription SKUs (Concierge, Pro Weekly, Panood Annual, Patiktok
  // per-day, Tool Weeklies) carry expires_at. Order status 'paid'
  // means the renewal hasn't lapsed yet. Once expires_at is in the
  // past, sweepLapsedSubscriptions flips it to 'lapsed' — we only
  // want to surface upcoming renewals, so filter expires_at > now.
  //
  // Schema reference:
  //   20260602000000_orders_lapsed_status_and_expires_at.sql
  //   Adds orders.expires_at TIMESTAMPTZ + partial index on
  //   (status, expires_at) WHERE status='paid' AND expires_at IS NOT
  //   NULL — keeps this read cheap at scale.
  //
  // 60-day horizon — anything further out doesn't belong on the
  // "Upcoming" surface yet; surfacing a renewal 6 months in advance
  // would create noise.
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 60);

  const { data, error } = await supabase
    .from('orders')
    .select('order_id, service_key, description, confirmed_total_php, requested_total_php, expires_at')
    .eq('event_id', eventId)
    .in('status', ['paid', 'fulfilled'])
    .not('expires_at', 'is', null)
    .gte('expires_at', now.toISOString())
    .lte('expires_at', horizon.toISOString())
    .order('expires_at', { ascending: true })
    .limit(20);

  if (error || !data) return [];

  return (data as SubscriptionOrderRow[])
    .filter((row) => row.expires_at !== null)
    .map((row) => {
      const date = new Date(row.expires_at as string);
      const sku = row.service_key ? findSku(row.service_key) : undefined;
      const displayName = sku?.displayName ?? row.description;
      // Total — confirmed if admin reconciled, requested otherwise.
      const amountCentavos = toCentavos(row.confirmed_total_php ?? row.requested_total_php);
      return {
        id: `setnayan_sku_expiry:${row.order_id}`,
        source: 'setnayan_sku_expiry' as const,
        category: 'renewal' as const,
        date,
        daysFromNow: daysBetween(date, now),
        title: `${displayName} renews`,
        subtitle: amountCentavos > 0 ? `${formatCentavosShort(amountCentavos)} · keep your subscription active` : 'Keep your subscription active',
        amountCentavos,
        href: `/dashboard/${eventId}/orders`,
      };
    });
}

// ----------------------------------------------------------------------------
// Source 5 — computed statutory paperwork deadlines
// ----------------------------------------------------------------------------

type PaperworkDeadline = {
  key: string;
  daysBeforeWedding: number;
  title: string;
  subtitle: string;
  appliesTo: (ceremonyType: string | null | undefined) => boolean;
  href: (eventId: string) => string;
};

const PAPERWORK_DEADLINES: ReadonlyArray<PaperworkDeadline> = [
  {
    key: 'psa_cenomar_window',
    daysBeforeWedding: 180,
    title: 'PSA + CENOMAR window opens',
    subtitle: 'Apply for your birth certificate and Certificate of No Marriage',
    appliesTo: () => true,
    href: (eventId) => `/dashboard/${eventId}/contracts`,
  },
  {
    key: 'marriage_license_window',
    daysBeforeWedding: 120,
    title: 'Marriage license window opens',
    subtitle: 'Valid 120 days from issuance — apply close to your date',
    appliesTo: () => true,
    href: (eventId) => `/dashboard/${eventId}/contracts`,
  },
  {
    key: 'pre_cana_cutoff',
    daysBeforeWedding: 60,
    title: 'Pre-Cana seminar cutoff',
    subtitle: 'Most Catholic parishes require completion 60 days before the wedding',
    appliesTo: (ceremonyType) => ceremonyType === 'catholic',
    href: (eventId) => `/dashboard/${eventId}/contracts`,
  },
];

function buildDocumentDeadlines(
  eventId: string,
  eventDate: string | null,
  ceremonyType: string | null | undefined,
  now: Date,
): UpcomingItem[] {
  if (!eventDate) return [];

  // event_date is DATE. Anchor to noon local for stable day-bucketing.
  const wedding = new Date(`${eventDate}T12:00:00`);
  if (Number.isNaN(wedding.getTime())) return [];

  return PAPERWORK_DEADLINES.filter((deadline) => deadline.appliesTo(ceremonyType))
    .map((deadline) => {
      const date = new Date(wedding);
      date.setDate(date.getDate() - deadline.daysBeforeWedding);
      return {
        id: `document_deadline:${deadline.key}`,
        source: 'document_deadline' as const,
        category: 'document' as const,
        date,
        daysFromNow: daysBetween(date, now),
        title: deadline.title,
        subtitle: deadline.subtitle,
        href: deadline.href(eventId),
      };
    })
    .filter((item) => item.date.getTime() > now.getTime());
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export type FetchUpcomingItemsInput = {
  supabase: SupabaseClient;
  eventId: string;
  eventDate: string | null;
  ceremonyType: string | null | undefined;
  now: Date;
  /** Maximum merged items returned. Defaults to 10. */
  limit?: number;
};

export type FetchUpcomingItemsResult = {
  /** Merged, chronologically sorted, length <= limit. */
  items: ReadonlyArray<UpcomingItem>;
  /** Payment items in the next 30 days (subset of items). Drives the
   *  MoneyInFlight section above UpcomingSchedules. */
  paymentItemsNext30d: ReadonlyArray<UpcomingItem>;
  /** Per-source diagnostic counts. Surfaced in PR body / debug logs. */
  sourceCounts: Record<UpcomingItemSource, number>;
};

// ----------------------------------------------------------------------------
// Source 6 — "start looking" reminders (free planning guidance)
//
// For each plan-group category the couple hasn't LOCKED a vendor in yet,
// surface a forward-looking nudge timed at wedding_date − monthsBefore — the
// owner-authored lead-time already on PLAN_GROUPS, so the reminder and the
// home plan-grid advertise the same windows. This is the free replacement for
// the retired Today's Focus wizard's "best time to start looking" job
// ([[project_setnayan_todays_focus_retired]]) — no fork, no paywall.
//
// Forward-looking only: windows already open are dropped by the merged
// stream's future filter (an "overdue / look now" variant is a clean V2).
// Entry-point plan cards (countsTowardLockable === false — Live band, Stylist,
// Dance instructor, After-party DJ, Bridal car, Guest shuttle) are skipped;
// their picks bucket under a primary card that already carries the reminder.
// Capped at START_LOOKING_CAP so it never floods the stream.
// ----------------------------------------------------------------------------

const START_LOOKING_CAP = 5;

async function fetchStartLookingItems(
  supabase: SupabaseClient,
  eventId: string,
  eventDate: string | null,
  now: Date,
): Promise<UpcomingItem[]> {
  if (!eventDate) return [];
  const wedding = new Date(`${eventDate}T12:00:00`);
  if (Number.isNaN(wedding.getTime())) return [];

  // Plan-groups that already have a LOCKED vendor → don't nudge those.
  const { data: vendors } = await supabase
    .from('event_vendors')
    .select('category, status')
    .eq('event_id', eventId);

  const lockedGroups = new Set<PlanGroupId>();
  for (const v of (vendors ?? []) as Array<{
    category: string | null;
    status: string | null;
  }>) {
    if (!v.category || statusOfVendor(v.status) !== 'locked') continue;
    const group = canonicalServiceToPlanGroupId(v.category);
    if (group) lockedGroups.add(group);
  }

  return PLAN_GROUPS.filter(
    (g) => g.countsTowardLockable !== false && !lockedGroups.has(g.id),
  )
    .map((g) => {
      const date = new Date(wedding);
      date.setMonth(date.getMonth() - g.monthsBefore);
      return { g, date };
    })
    .filter(({ date }) => date.getTime() > now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, START_LOOKING_CAP)
    .map(({ g, date }) => ({
      id: `start_looking:${g.id}`,
      source: 'start_looking' as const,
      category: 'start_looking' as const,
      date,
      daysFromNow: daysBetween(date, now),
      title: `Start looking for your ${g.label}`,
      subtitle: `Most couples lock this about ${g.monthsBefore} months before the wedding.`,
      href: `/dashboard/${eventId}/vendors`,
    }));
}

export async function fetchUpcomingItems(
  input: FetchUpcomingItemsInput,
): Promise<FetchUpcomingItemsResult> {
  const { supabase, eventId, eventDate, ceremonyType, now } = input;
  const limit = input.limit ?? 10;

  const [meetings, scheduleBlocks, vendorPayments, skuRenewals, startLooking] =
    await Promise.all([
      fetchVendorMeetings(supabase, eventId, now),
      fetchScheduleBlockItems(supabase, eventId, now),
      fetchVendorPaymentItems(supabase, eventId, now),
      fetchSkuRenewalItems(supabase, eventId, now),
      fetchStartLookingItems(supabase, eventId, eventDate, now),
    ]);

  // Source 5 — pure-computed, no fetch.
  const documentDeadlines = buildDocumentDeadlines(eventId, eventDate, ceremonyType, now);

  const merged = [
    ...meetings,
    ...scheduleBlocks,
    ...vendorPayments,
    ...skuRenewals,
    ...documentDeadlines,
    ...startLooking,
  ]
    .filter((item) => item.date.getTime() > now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const items = merged.slice(0, limit);

  // MoneyInFlight: payment-source items, next 30 days. Computed
  // against the FULL merged stream (not the truncated `items`) so
  // payments don't get hidden by an overflow of schedule blocks /
  // document deadlines.
  const thirtyDayHorizon = new Date(now);
  thirtyDayHorizon.setDate(thirtyDayHorizon.getDate() + 30);
  const paymentItemsNext30d = merged.filter(
    (item) =>
      item.source === 'vendor_payment' && item.date.getTime() <= thirtyDayHorizon.getTime(),
  );

  const sourceCounts: Record<UpcomingItemSource, number> = {
    meeting: meetings.length,
    schedule_block: scheduleBlocks.length,
    vendor_payment: vendorPayments.length,
    setnayan_sku_expiry: skuRenewals.length,
    document_deadline: documentDeadlines.length,
    start_looking: startLooking.length,
  };

  return { items, paymentItemsNext30d, sourceCounts };
}
