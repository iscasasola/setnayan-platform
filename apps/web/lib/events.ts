import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export type EventRow = {
  event_id: string;
  public_id: string;
  event_type:
    | 'wedding'
    | 'birthday'
    | 'celebration'
    | 'travel'
    | 'corporate'
    | 'tournament'
    | 'christening';
  display_name: string;
  event_date: string | null;
  is_primary: boolean;
  archived: boolean;
  venue_name: string | null;
  venue_address: string | null;
  /**
   * Per-event monogram from iteration 0002 § Branding (locked 2026-05-13).
   * Both columns may be null — the dashboard chrome falls back to the
   * derived `M & J`-style monogram from `display_name` when text is null.
   */
  monogram_text: string | null;
  monogram_color: string | null;
};

export type EventWithRole = EventRow & {
  member_type: 'couple' | 'guest' | 'vendor' | 'coordinator';
};

type MembershipQueryRow = {
  member_type: EventWithRole['member_type'];
  events: EventRow | EventRow[] | null;
};

/**
 * Fetches every event the signed-in user is a member of. Returns the rows
 * sorted with primary events first, then by event date ascending.
 *
 * RLS already filters to the current user via Pattern B + Pattern A overlap;
 * the `.eq('user_id', userId)` is a defense-in-depth narrowing.
 *
 * Wrapped in React `cache()` so the outer dashboard layout and the per-event
 * layout (which both need the switcher list) share a single round-trip per
 * request. Cache key is (supabase, userId, memberType); the cached Supabase
 * client (lib/supabase/server.ts) keeps the first arg identity-stable so
 * the dedupe actually fires.
 */
export const fetchUserEvents = cache(async (
  supabase: SupabaseClient,
  userId: string,
  memberType?: EventWithRole['member_type'],
): Promise<EventWithRole[]> => {
  let query = supabase
    .from('event_members')
    .select(
      `member_type,
       events:event_id (
         event_id,
         public_id,
         event_type,
         display_name,
         event_date,
         is_primary,
         archived,
         venue_name,
         venue_address,
         monogram_text,
         monogram_color
       )`,
    )
    .eq('user_id', userId);

  if (memberType) {
    query = query.eq('member_type', memberType);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as MembershipQueryRow[];

  const events: EventWithRole[] = rows
    .flatMap((row) => {
      const eventArray = Array.isArray(row.events)
        ? row.events
        : row.events
          ? [row.events]
          : [];
      return eventArray.map((e) => ({ ...e, member_type: row.member_type }));
    })
    .sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      if (a.event_date && b.event_date) return a.event_date.localeCompare(b.event_date);
      if (a.event_date) return -1;
      if (b.event_date) return 1;
      return 0;
    });

  return events;
});

// Post-wedding grace window before an event flips to "expired" on the
// event-switcher carousel and on per-feature App Store-detail surfaces.
// Mirrors EXPIRATION_GRACE_DAYS in lib/add-on-state.ts — keep both in sync.
const EVENT_EXPIRATION_GRACE_DAYS = 90;

/**
 * Returns TRUE when the event has passed its post-wedding grace cutoff,
 * matching the App Store-detail page's "expired" state (lib/add-on-state.ts).
 * Archived events are NOT classified as expired here — the dashboard layout
 * filters archived events out of the switcher upstream.
 */
export function isEventExpiredForSwitcher(
  event: Pick<EventRow, 'event_date'>,
): boolean {
  if (!event.event_date) return false;
  const eventDate = new Date(event.event_date);
  if (Number.isNaN(eventDate.getTime())) return false;
  const cutoff = new Date(eventDate);
  cutoff.setDate(cutoff.getDate() + EVENT_EXPIRATION_GRACE_DAYS);
  return cutoff.getTime() < Date.now();
}

/**
 * Sort the events feed for the chrome event-switcher carousel:
 *   1. Active events first — primary first, then event_date ascending.
 *   2. Expired events pushed to the end — newest-expired first,
 *      oldest-expired last (i.e. event_date descending), so the oldest
 *      expired event lands at the rightmost / final slot.
 *
 * Owner directive 2026-05-17 — "Expired Events will be at the right most
 * of the lists. (oldest expired is the farthest)."
 */
export function sortEventsForSwitcher<T extends EventRow>(events: T[]): T[] {
  const active: T[] = [];
  const expired: T[] = [];
  for (const e of events) {
    if (isEventExpiredForSwitcher(e)) expired.push(e);
    else active.push(e);
  }
  active.sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    if (a.event_date && b.event_date) return a.event_date.localeCompare(b.event_date);
    if (a.event_date) return -1;
    if (b.event_date) return 1;
    return 0;
  });
  expired.sort((a, b) => {
    if (a.event_date && b.event_date) return b.event_date.localeCompare(a.event_date);
    if (a.event_date) return -1;
    if (b.event_date) return 1;
    return 0;
  });
  return [...active, ...expired];
}

export function formatEventDate(iso: string | null, locale = 'en-US'): string {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Task #39 (2026-05-22) — render the event date with precision-aware
 * phrasing. Year precision reads as "Sometime in 2027"; month precision
 * reads as "August 2027"; day precision reads as the full long form
 * ("Friday, August 15, 2027"). For year/month modes, event_date stores
 * the first-day-of-range placeholder ('2027-01-01' / '2027-08-01') so we
 * parse parts manually to avoid timezone drift on the DATE column.
 *
 * Returns empty string when iso is null. The "Date to be confirmed"
 * empty-state copy is handled at the call site so the literal isn't
 * duplicated across surfaces.
 */
export type EventDatePrecision = 'year' | 'month' | 'day';

export function formatEventDateWithPrecision(
  iso: string | null,
  precision: EventDatePrecision,
  locale = 'en-US',
): string {
  if (!iso) return '';
  // Parse parts manually to avoid timezone drift on the DATE column.
  const [yearStr, monthStr, dayStr] = iso.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return iso;

  if (precision === 'year') {
    return `Sometime in ${year}`;
  }
  if (precision === 'month') {
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
  }
  // precision === 'day'
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Task #39 — countdown phrasing per precision. Day-precision returns the
 * canonical "N days to go" / "today!" / "N days ago" string (matches the
 * existing WelcomeHeader behavior). Month-precision returns "in N months"
 * approximate. Year-precision returns "this year" if same calendar year,
 * "in N months" if next year is < 12 months away, or null when the year
 * is too distant for a meaningful countdown (the precision itself is
 * already the countdown signal).
 */
export function formatEventCountdown(
  iso: string | null,
  precision: EventDatePrecision,
  now: Date = new Date(),
): string | null {
  if (!iso) return null;
  const [yearStr, monthStr, dayStr] = iso.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return null;

  if (precision === 'day') {
    const event = new Date(year, month - 1, day);
    event.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const ms = event.getTime() - today.getTime();
    const days = Math.round(ms / 86_400_000);
    if (days > 0) return `${days} day${days === 1 ? '' : 's'} to go`;
    if (days === 0) return 'today!';
    const absDays = Math.abs(days);
    return `${absDays} day${absDays === 1 ? '' : 's'} ago`;
  }

  if (precision === 'month') {
    const event = new Date(year, month - 1, 1);
    const today = new Date(now.getFullYear(), now.getMonth(), 1);
    const months =
      (event.getFullYear() - today.getFullYear()) * 12 + (event.getMonth() - today.getMonth());
    if (months > 0) return `in ${months} month${months === 1 ? '' : 's'}`;
    if (months === 0) return 'this month';
    const absMonths = Math.abs(months);
    return `${absMonths} month${absMonths === 1 ? '' : 's'} ago`;
  }

  // precision === 'year'
  const nowYear = now.getFullYear();
  if (year === nowYear) return 'this year';
  if (year === nowYear + 1) {
    // Approximate months to start of next year — never less than 1.
    const monthsToYearStart = 12 - now.getMonth();
    return `in ${monthsToYearStart} month${monthsToYearStart === 1 ? '' : 's'}`;
  }
  if (year < nowYear) return `${nowYear - year} year${nowYear - year === 1 ? '' : 's'} ago`;
  // Year is 2+ years away — precision itself is the countdown. Skip.
  return null;
}

/**
 * Task #39 — precision ranking for the refine-only ratchet. Higher value
 * means more precise. Used to gate widening when confirmed vendors exist.
 */
export const PRECISION_ORDER: Record<EventDatePrecision, number> = {
  year: 0,
  month: 1,
  day: 2,
};

/**
 * Vendor statuses that count as a confirmed commitment for the
 * date-edit + ceremony-type-edit gates on event home (iteration 0021
 * § 10 / § 11 / § 13 + Task #37).
 *
 * Mirrors the spec language ("≥1 confirmed vendor") against the actual
 * `vendor_status` enum from 20260513100000_iteration_0006_vendors.sql.
 * `considering` and `shortlisted` are exploratory — a host can still
 * change the date / wedding type freely. `contracted` onwards means an
 * actual booking commitment that would be disrupted by a unilateral
 * change, so the edit flips to support-mediated negotiation per § 10.1.
 */
export const CONFIRMED_VENDOR_STATUSES = [
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
] as const;

export type ConfirmedVendorStatus = (typeof CONFIRMED_VENDOR_STATUSES)[number];

/**
 * Count of vendors on this event whose status is at-or-past 'contracted'.
 * Returns 0 on error so the chrome never crashes the event page; the
 * downstream UI will simply render the unlocked state, which is the
 * conservative default (worst case: host edits → server action's own
 * idempotent guard catches the conflict).
 */
export async function getConfirmedVendorCount(
  supabase: SupabaseClient,
  eventId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('event_vendors')
    .select('vendor_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[]);
  if (error) return 0;
  return count ?? 0;
}
