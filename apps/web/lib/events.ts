import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isMissingRelationError,
  logQueryError,
} from '@/lib/supabase/error-detect';

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
  /**
   * Onboarding free-monogram design (owner-locked 2026-06-03 — the couple's
   * chosen {frame, font} preset persisted by app/onboarding/wedding). The
   * event switcher renders this as the couple's icon (letters-forward in the
   * chosen font + ink). Optional: older / non-onboarding events have neither.
   */
  monogram_frame_key?: string | null;
  monogram_font_key?: string | null;
  monogram_style?: string | null;
  /**
   * Setnayan AI subscription status · production column kept the
   * concierge_status name even after the 2026-05-24 8th-row spec lock
   * specced renaming to todays_focus_status (the rename never shipped
   * per [[feedback_setnayan_latest_spec_priority]] · latest shipped
   * state wins).
   *
   * Drives the DIY/Paid wizard surface bifurcation locked 2026-05-30:
   *   'diy' (default · free tier) → WIZARD_TASKS_DIY 9-card Foundation
   *   'trial' / 'active' (paid Setnayan AI) → WIZARD_TASKS_PAID full 65-card
   *   'expired' (lapsed paid) → falls back to WIZARD_TASKS_DIY
   *
   * Read by `getCarouselTasks` in apps/web/lib/wizard.ts. May be null
   * for legacy rows that pre-date the column · null is treated as
   * 'diy' (the safe default).
   */
  concierge_status: 'diy' | 'trial' | 'active' | 'expired' | null;
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
         monogram_color,
         monogram_frame_key,
         monogram_font_key,
         monogram_style,
         concierge_status
       )`,
    )
    .eq('user_id', userId);

  if (memberType) {
    query = query.eq('member_type', memberType);
  }

  const { data, error } = await query;
  if (error) {
    // Graceful-degrade on missing-relation — this query is load-bearing
    // for the entire /dashboard/[eventId]/* layout (it powers the event
    // switcher). A missing column (e.g. `monogram_text` added 2026-05-13
    // — pushed long ago — but parallel risk for any future events table
    // ADD COLUMN) would crash every authenticated dashboard page, not
    // just the surface that triggered it. Empty switcher list is the
    // safer fallback than a hard crash; the current event still renders
    // via the parent layout's separate `.from('events').single()` query.
    if (isMissingRelationError(error)) {
      logQueryError(
        'fetchUserEvents',
        error,
        { user_id: userId, member_type: memberType ?? null },
        'graceful_degrade',
      );
      return [];
    }
    // 6th-pass hotfix 2026-05-23 — collapse to graceful-degrade-always.
    //
    // PR #404 (3rd pass) had this branch RE-THROW for "real bugs" (RLS
    // denial / auth expiry / network failure), with structured Sentry
    // context preserved before the throw. Sweep #1 of the 5-way parallel
    // investigation traced Sentry digest 3284377371 to THIS specific
    // throw — the layout-level `fetchUserEvents` on a Promise.all that
    // bubbles to the same error.tsx as any page-level throw, crashing
    // EVERY /dashboard/[eventId]/* surface (guests page included).
    //
    // PR #416 (5th pass) collapsed `fetchGuestsByEvent` to graceful-
    // degrade-always but left this layout-level throw intact — owner
    // hit digest 3284377371 again as predicted.
    //
    // The pragmatic move after 5 passes: empty event switcher >
    // crashed event-scoped tree. The layout's separate single-event
    // SELECT still works to render the current event; only the switcher
    // dropdown's "other events" list becomes empty when this fires.
    // The structured Sentry breadcrumb still surfaces the root cause
    // for follow-up triage.
    logQueryError(
      'fetchUserEvents',
      error,
      { user_id: userId, member_type: memberType ?? null },
      'graceful_degrade',
    );
    return [];
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
 * Task #41 (2026-05-22) — is this event_date "in the past" given its
 * precision? Past wedding dates are nonsensical (a wedding either hasn't
 * happened yet or has already happened — there's no editing-back-in-time).
 *
 * "Past" is precision-aware: for year precision we accept the whole year
 * as still-future until Dec 31 of that year has passed; for month
 * precision we accept the whole month until its last day has passed; for
 * day precision we accept today and reject earlier days.
 *
 * Used by:
 *   - updateEventDate server action — defense-in-depth rejection of past
 *     submissions even if the client `min` attributes are bypassed.
 *   - Event home polish — surface a muted warning chip on existing events
 *     whose date is already in the past (e.g. the "Bonbon and Chihuahua"
 *     event that originally surfaced this bug 2026-05-22).
 */
export function isEventDateInPast(
  iso: string | null,
  precision: EventDatePrecision,
  now: Date = new Date(),
): boolean {
  if (!iso) return false;
  const [yearStr, monthStr, dayStr] = iso.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return false;

  // Effective "last day still considered future" per precision.
  let effective: Date;
  if (precision === 'year') {
    effective = new Date(year, 11, 31);
  } else if (precision === 'month') {
    // Last day of the given month: day 0 of next month.
    effective = new Date(year, month, 0);
  } else {
    effective = new Date(year, month - 1, day);
  }
  effective.setHours(0, 0, 0, 0);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  return effective.getTime() < today.getTime();
}

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

// ----------------------------------------------------------------------------
// Reception anchor — "ground 0" for vendor distance (CLAUDE.md 2026-06-02
// directive 3 · owner: "reception will be ground 0 for the distance of other
// vendors"). The reception venue (event_vendors.category='venue') is the
// origin every other vendor's distance is measured from;
// events.venue_latitude/venue_longitude hold it (the anchor schema + the
// initial first-saved-wins population were locked 2026-05-20).
//
// These helpers re-anchor it to the reception the couple actually commits to
// — a LOCKED reception over a 'considering' one, stable first-saved among
// considering — and resolve coords from EITHER a marketplace pick
// (vendor_profiles.hq_*) OR an admin-seeded venue (venue_directory.hq_*),
// which the original inline first-saved path in saveVendorToPicks missed.
// ----------------------------------------------------------------------------

export type ReceptionAnchor = {
  lat: number;
  lng: number;
  /** locked = reception is contracted+; considering = a provisional pick. */
  source: 'locked' | 'considering';
} | null;

/** event_vendors.category value for the reception venue. */
const RECEPTION_CATEGORY = 'venue';

/**
 * Resolve the reception venue the couple is anchoring distance on, reading
 * coords across RLS (needs an admin/service client, like the wizard-rec +
 * category-search reads). Priority: a LOCKED reception (most-recently locked)
 * → else the oldest 'considering' reception (stable first-saved-wins so the
 * anchor doesn't thrash while the couple is still exploring). Skips picks
 * whose coords can't be resolved. Returns null when no reception pick has
 * coords, and never throws (returns null on any read error).
 */
export async function resolveReceptionAnchor(
  admin: SupabaseClient,
  eventId: string,
): Promise<ReceptionAnchor> {
  try {
    const { data: picks, error } = await admin
      .from('event_vendors')
      .select(
        'status, marketplace_vendor_id, source_venue_directory_id, created_at, updated_at',
      )
      .eq('event_id', eventId)
      .eq('category', RECEPTION_CATEGORY)
      .is('archived_at', null);
    if (error || !picks || picks.length === 0) return null;

    type Pick = {
      status: string | null;
      marketplace_vendor_id: string | null;
      source_venue_directory_id: string | null;
      created_at: string | null;
      updated_at: string | null;
    };
    const rows = picks as Pick[];
    const confirmed = new Set<string>(CONFIRMED_VENDOR_STATUSES as unknown as string[]);

    // Ordered candidates: locked first (most-recent lock), then considering
    // (oldest first — stable anchor while the couple is still exploring).
    const locked = rows
      .filter((r) => r.status != null && confirmed.has(r.status))
      .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
    const considering = rows
      .filter((r) => !(r.status != null && confirmed.has(r.status)))
      .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
    const ordered: Array<{ pick: Pick; source: 'locked' | 'considering' }> = [
      ...locked.map((pick) => ({ pick, source: 'locked' as const })),
      ...considering.map((pick) => ({ pick, source: 'considering' as const })),
    ];

    // Batch-resolve coords for both id sets (one read each).
    const marketIds = [
      ...new Set(rows.map((r) => r.marketplace_vendor_id).filter((v): v is string => !!v)),
    ];
    const dirIds = [
      ...new Set(rows.map((r) => r.source_venue_directory_id).filter((v): v is string => !!v)),
    ];

    const marketCoords = new Map<string, { lat: number; lng: number }>();
    if (marketIds.length > 0) {
      const { data } = await admin
        .from('vendor_profiles')
        .select('vendor_profile_id, hq_latitude, hq_longitude')
        .in('vendor_profile_id', marketIds);
      for (const v of data ?? []) {
        const row = v as {
          vendor_profile_id: string;
          hq_latitude: number | null;
          hq_longitude: number | null;
        };
        if (row.hq_latitude != null && row.hq_longitude != null) {
          marketCoords.set(row.vendor_profile_id, { lat: row.hq_latitude, lng: row.hq_longitude });
        }
      }
    }
    const dirCoords = new Map<string, { lat: number; lng: number }>();
    if (dirIds.length > 0) {
      const { data } = await admin
        .from('venue_directory')
        .select('venue_directory_id, hq_latitude, hq_longitude')
        .in('venue_directory_id', dirIds);
      for (const v of data ?? []) {
        const row = v as {
          venue_directory_id: string;
          hq_latitude: number | null;
          hq_longitude: number | null;
        };
        if (row.hq_latitude != null && row.hq_longitude != null) {
          dirCoords.set(row.venue_directory_id, { lat: row.hq_latitude, lng: row.hq_longitude });
        }
      }
    }

    for (const { pick, source } of ordered) {
      const c =
        (pick.marketplace_vendor_id
          ? marketCoords.get(pick.marketplace_vendor_id)
          : undefined) ??
        (pick.source_venue_directory_id
          ? dirCoords.get(pick.source_venue_directory_id)
          : undefined);
      if (c) return { lat: c.lat, lng: c.lng, source };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Re-anchor + persist events.venue_latitude/longitude from the current
 * reception picks. Call after a reception venue is locked or a reception pick
 * is removed so "ground 0" follows the couple's actual chosen reception (not
 * just the first they saved). When no reception pick has resolvable coords,
 * leaves the existing anchor untouched (preserves an onboarding/admin fallback
 * rather than blanking distance chips). Best-effort: never throws — a failed
 * re-anchor must not fail the lock/delete it follows. Returns the resolved
 * anchor (or null when nothing changed).
 */
export async function recomputeReceptionAnchor(
  admin: SupabaseClient,
  eventId: string,
): Promise<ReceptionAnchor> {
  const anchor = await resolveReceptionAnchor(admin, eventId);
  if (!anchor) return null;
  try {
    await admin
      .from('events')
      .update({ venue_latitude: anchor.lat, venue_longitude: anchor.lng })
      .eq('event_id', eventId);
  } catch {
    /* best-effort — a failed re-anchor must not fail the caller. */
  }
  return anchor;
}

// ----------------------------------------------------------------------------
// resolvePrimaryHostEvent (2026-05-22 — Task #46)
// ----------------------------------------------------------------------------
// Returns the user's primary event_id across BOTH host membership models:
//
//   (a) event_members.member_type='couple'  → legacy V1 creator path
//   (b) event_moderators (active, primary-host role_subtype) → iteration
//       0048 multi-host invite path (PR #183, 2026-05-20)
//
// Background: the original 0021 model treated "couple" as the only host
// concept. Iteration 0048 (CLAUDE.md 2026-05-19 row 425 + 2026-05-20 row
// 448) introduced event_moderators with 13 role_subtypes and the host-
// invite flow at /host/accept/[token] writes ONLY to event_moderators,
// NOT event_members. Server actions that gate on event_members alone
// (saveVendorToPicks · addVenueDirectoryEntryToPlan · others) return
// 'no_primary_event' for invited hosts even though they're legitimate
// hosts on a real event.
//
// Returns null when the user has no active membership in either table.
// Throws on real DB errors so the action layer can surface a specific
// message instead of a misleading 'no_primary_event'.
// ----------------------------------------------------------------------------

// Role subtypes that grant "primary host" status — equivalent to the
// legacy member_type='couple' for plan-ownership purposes. Excludes
// viewer / family_helper / ninong / ninang / maid_of_honor / best_man —
// those roles can co-plan but aren't the canonical event-owner host.
// Per iteration 0048 spec § Permission templates, only these subtypes
// default to full edit+checkout permissions.
const PRIMARY_HOST_ROLE_SUBTYPES = [
  'bride',
  'groom',
  'partner1',
  'partner2',
  'parent_of_bride',
  'parent_of_groom',
  'wedding_planner_external',
] as const;

export type PrimaryHostResolution = {
  event_id: string;
  source: 'event_members' | 'event_moderators';
};

/**
 * Resolves the host's primary event across both membership models.
 * Pass the admin client when called from a server action — RLS on
 * event_moderators is restrictive in V1.2 Phase A and would otherwise
 * hide moderator-only rows from the very query trying to surface them.
 */
export async function resolvePrimaryHostEvent(
  client: SupabaseClient,
  userId: string,
): Promise<PrimaryHostResolution | null> {
  // (a) Legacy couple membership.
  const { data: memberRows, error: memErr } = await client
    .from('event_members')
    .select('event_id, events:event_id(event_id, is_primary, archived)')
    .eq('user_id', userId)
    .eq('member_type', 'couple');
  if (memErr) {
    throw new Error(`event_members lookup failed: ${memErr.message}`);
  }

  // (b) event_moderators (iteration 0048 multi-host invite path).
  const { data: modRows, error: modErr } = await client
    .from('event_moderators')
    .select(
      'event_id, role_subtype, events:event_id(event_id, is_primary, archived)',
    )
    .eq('user_id', userId)
    .is('removed_at', null)
    .not('accepted_at', 'is', null)
    .in('role_subtype', PRIMARY_HOST_ROLE_SUBTYPES as unknown as string[]);
  if (modErr) {
    throw new Error(`event_moderators lookup failed: ${modErr.message}`);
  }

  type EventStub = { event_id: string; is_primary: boolean; archived: boolean };
  type Candidate = { event: EventStub; source: PrimaryHostResolution['source'] };
  const candidates: Candidate[] = [];

  for (const row of memberRows ?? []) {
    const ev = (Array.isArray(row.events) ? row.events[0] : row.events) as
      | EventStub
      | null;
    if (ev && !ev.archived) {
      candidates.push({ event: ev, source: 'event_members' });
    }
  }

  for (const row of modRows ?? []) {
    const ev = (Array.isArray(row.events) ? row.events[0] : row.events) as
      | EventStub
      | null;
    if (ev && !ev.archived) {
      candidates.push({ event: ev, source: 'event_moderators' });
    }
  }

  if (candidates.length === 0) return null;

  // De-dupe by event_id (a couple-creator who later got invited as
  // moderator would appear in both lists). Prefer the event_members
  // entry as the canonical source.
  const byEventId = new Map<string, Candidate>();
  for (const c of candidates) {
    const existing = byEventId.get(c.event.event_id);
    if (!existing) {
      byEventId.set(c.event.event_id, c);
    } else if (
      existing.source === 'event_moderators' &&
      c.source === 'event_members'
    ) {
      byEventId.set(c.event.event_id, c);
    }
  }

  const sorted = [...byEventId.values()].sort((a, b) =>
    a.event.is_primary === b.event.is_primary ? 0 : a.event.is_primary ? -1 : 1,
  );

  const winner = sorted[0];
  if (!winner) return null;
  return { event_id: winner.event.event_id, source: winner.source };
}
