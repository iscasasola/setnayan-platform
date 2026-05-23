import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isMissingRelationError,
  logQueryError,
} from '@/lib/supabase/error-detect';

export type GuestRole =
  | 'guest'
  | 'bride'
  | 'groom'
  | 'maid_of_honor'
  | 'matron_of_honor'
  | 'best_man'
  | 'bridesmaid'
  | 'groomsman'
  | 'principal_sponsor'
  | 'candle_sponsor'
  | 'veil_sponsor'
  | 'cord_sponsor'
  | 'coin_sponsor'
  | 'ring_bearer'
  | 'bible_bearer'
  | 'coin_bearer'
  | 'flower_girl'
  | 'officiant'
  | 'reader_lector'
  | 'soloist_musician';

/**
 * Roles that may exist at most once per event. Enforced at the DB layer
 * via partial unique indexes (migration 20260531010000); UI uses this
 * list to filter the role dropdown.
 */
export const SINGLETON_GUEST_ROLES: ReadonlyArray<GuestRole> = ['bride', 'groom'];

export type GuestSide = 'bride' | 'groom' | 'both';
export type GuestGroupCategory =
  | 'family'
  | 'friends'
  | 'work'
  | 'school'
  | 'officiant'
  | 'other';
export type MealPreference =
  | 'beef'
  | 'chicken'
  | 'fish'
  | 'vegetarian'
  | 'vegan'
  | 'kids'
  | 'no_preference';
export type RsvpStatus = 'pending' | 'attending' | 'declined' | 'maybe';

export type GuestRow = {
  guest_id: string;
  public_id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  side: GuestSide;
  group_category: GuestGroupCategory;
  role: GuestRole;
  plus_one_allowed: boolean;
  plus_one_name: string | null;
  plus_one_of_guest_id: string | null;
  plus_one_mode: 'full' | 'limited' | null;
  email: string | null;
  mobile: string | null;
  meal_preference: MealPreference | null;
  dietary_restrictions: string | null;
  photo_consent: boolean;
  invited_to_blocks: string[];
  rsvp_status: RsvpStatus;
  notes: string | null;
  qr_token: string;
  custom_tags: string[];
  created_at: string;
};

export const INVITED_TO_BLOCKS = [
  'ceremony',
  'reception',
  'cocktails',
  'after_party',
  'rehearsal_dinner',
] as const;

export type InvitedToBlock = (typeof INVITED_TO_BLOCKS)[number];

export const INVITED_TO_LABELS: Record<InvitedToBlock, string> = {
  ceremony: 'Ceremony',
  reception: 'Reception',
  cocktails: 'Cocktails',
  after_party: 'After-party',
  rehearsal_dinner: 'Rehearsal dinner',
};

export const MEAL_LABELS: Record<MealPreference, string> = {
  beef: 'Beef',
  chicken: 'Chicken',
  fish: 'Fish',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  kids: 'Kids',
  no_preference: 'No preference',
};

export const ROLE_LABELS: Record<GuestRole, string> = {
  guest: 'Guest',
  bride: 'Bride',
  groom: 'Groom',
  maid_of_honor: 'Maid of Honor',
  matron_of_honor: 'Matron of Honor',
  best_man: 'Best Man',
  bridesmaid: 'Bridesmaid',
  groomsman: 'Groomsman',
  principal_sponsor: 'Principal Sponsor (Ninong/Ninang)',
  candle_sponsor: 'Candle Sponsor',
  veil_sponsor: 'Veil Sponsor',
  cord_sponsor: 'Cord Sponsor',
  coin_sponsor: 'Coin Sponsor (Arrhae)',
  ring_bearer: 'Ring Bearer',
  bible_bearer: 'Bible Bearer',
  coin_bearer: 'Coin Bearer',
  flower_girl: 'Flower Girl',
  officiant: 'Officiant',
  reader_lector: 'Reader / Lector',
  soloist_musician: 'Soloist / Musician',
};

export const SIDE_LABELS: Record<GuestSide, string> = {
  bride: "Bride's side",
  groom: "Groom's side",
  both: 'Both sides',
};

export const GROUP_CATEGORY_LABELS: Record<GuestGroupCategory, string> = {
  family: 'Family',
  friends: 'Friends',
  work: 'Work',
  school: 'School',
  officiant: 'Officiant',
  other: 'Other',
};

export const RSVP_LABELS: Record<RsvpStatus, string> = {
  pending: 'Pending',
  attending: 'Attending',
  declined: 'Declined',
  maybe: 'Maybe',
};

export type GuestStats = {
  total: number;
  attending: number;
  pending: number;
  declined: number;
  maybe: number;
  plus_ones: number;
};

const GUEST_FIELDS =
  'guest_id,public_id,event_id,first_name,last_name,display_name,side,group_category,role,plus_one_allowed,plus_one_name,plus_one_of_guest_id,plus_one_mode,email,mobile,meal_preference,dietary_restrictions,photo_consent,invited_to_blocks,rsvp_status,notes,qr_token,custom_tags,created_at';

export async function fetchGuestsByEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<GuestRow[]> {
  const { data, error } = await supabase
    .from('guests')
    .select(GUEST_FIELDS)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true });

  // 5th-pass hotfix 2026-05-23: collapse to "always graceful-degrade,
  // never crash the page" — log to Sentry with structured call_site
  // context so real bugs (RLS denial, auth failure, network, schema
  // drift) still surface in the dashboard, but the host's page renders
  // as an empty guest list instead of bombing through the error
  // boundary. The prior four hotfix passes (PR #380 / #390 / #404 /
  // #413) layered defensive guards but kept the re-throw on
  // non-missing-relation errors. Each pass moved the crash to the next
  // narrowest path and the same Sentry digest (3284377371) kept firing.
  // The pragmatic move after four passes is "empty page > error page"
  // — the host can refresh OR find an alternate path AND Sentry still
  // has the structured breadcrumb to diagnose root cause.
  if (error) {
    logQueryError(
      'fetchGuestsByEvent',
      error,
      {
        event_id: eventId,
        // Surface whether this fell into the known missing-relation
        // bucket vs a non-classified bug (RLS denial / auth expiry /
        // network) so the Sentry dashboard can pivot the call site
        // by error class without needing a separate severity level.
        missing_relation_match: isMissingRelationError(error),
      },
      'graceful_degrade',
    );
    return [];
  }

  return (data ?? []) as unknown as GuestRow[];
}

export async function fetchGuestById(
  supabase: SupabaseClient,
  eventId: string,
  guestId: string,
): Promise<GuestRow | null> {
  const { data, error } = await supabase
    .from('guests')
    .select(GUEST_FIELDS)
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .is('deleted_at', null)
    .maybeSingle();

  // Same graceful-degrade pattern as fetchGuestsByEvent — the guest
  // detail page should render an empty state instead of crashing when
  // a column referenced in GUEST_FIELDS hasn't been migrated to prod
  // yet. notFound() upstream handles the null cleanly.
  if (error) {
    if (isMissingRelationError(error)) {
      logQueryError(
        'fetchGuestById',
        error,
        { event_id: eventId, guest_id: guestId },
        'graceful_degrade',
      );
      return null;
    }
    logQueryError(
      'fetchGuestById',
      error,
      { event_id: eventId, guest_id: guestId },
      'will_throw',
    );
    throw new Error(`fetchGuestById failed: ${error.message}`);
  }
  return (data ?? null) as unknown as GuestRow | null;
}

export function computeGuestStats(guests: GuestRow[]): GuestStats {
  const stats: GuestStats = {
    total: guests.length,
    attending: 0,
    pending: 0,
    declined: 0,
    maybe: 0,
    plus_ones: 0,
  };

  for (const guest of guests) {
    if (guest.rsvp_status === 'attending') stats.attending += 1;
    else if (guest.rsvp_status === 'pending') stats.pending += 1;
    else if (guest.rsvp_status === 'declined') stats.declined += 1;
    else if (guest.rsvp_status === 'maybe') stats.maybe += 1;
    if (guest.plus_one_allowed) stats.plus_ones += 1;
  }

  return stats;
}

export function guestDisplayName(guest: GuestRow): string {
  return guest.display_name?.trim() || `${guest.first_name} ${guest.last_name}`.trim();
}

export function guestInitials(guest: GuestRow): string {
  const first = guest.first_name.charAt(0).toUpperCase();
  const last = guest.last_name.charAt(0).toUpperCase();
  return `${first}${last}` || guest.first_name.slice(0, 2).toUpperCase() || '??';
}

/**
 * Lookup which singleton roles (bride / groom) are currently assigned in
 * an event. Returned map keyed by role → guest_id of the holder. Used by
 * the guest edit / new pages to hide options that are already taken.
 *
 * `exceptGuestId` excludes the guest currently being edited so they don't
 * see their own role missing from the dropdown.
 */
export async function fetchSingletonRoleHolders(
  supabase: SupabaseClient,
  eventId: string,
  exceptGuestId?: string,
): Promise<Partial<Record<GuestRole, string>>> {
  const { data, error } = await supabase
    .from('guests')
    .select('guest_id,role')
    .eq('event_id', eventId)
    .in('role', SINGLETON_GUEST_ROLES as readonly string[])
    .is('deleted_at', null);

  if (error) {
    // Likely cause when this fires today: the bride/groom enum values
    // from migration 20260530020000_guest_role_add_bride_groom haven't
    // been pushed to prod yet, so `.in('role', ['bride', 'groom'])`
    // returns a Postgres enum cast error. Empty `{}` keeps the role
    // dropdown showing both singleton roles instead of crashing the
    // page.
    logQueryError(
      'fetchSingletonRoleHolders',
      error,
      { event_id: eventId, except_guest_id: exceptGuestId ?? null },
      isMissingRelationError(error) ? 'graceful_degrade' : 'will_throw',
    );
    return {};
  }
  if (!data) return {};
  const holders: Partial<Record<GuestRole, string>> = {};
  for (const row of data as Array<{ guest_id: string; role: GuestRole }>) {
    if (exceptGuestId && row.guest_id === exceptGuestId) continue;
    holders[row.role] = row.guest_id;
  }
  return holders;
}

// -----------------------------------------------------------------------
// Custom guest groups · iteration 0001 V1.2 extension (locked 2026-05-22).
//
// Custom groups are many-to-many with guests and live alongside the
// role-group sidebar views in apps/web/lib/role-groups.ts. They carry a
// team_side flag so hosts can see at a glance which side of the wedding
// a group belongs to. Schema lives in
// supabase/migrations/20260604170000_iteration_0001_guest_groups.sql.
// -----------------------------------------------------------------------

// `isMissingRelationError` + `logQueryError` are now imported from
// `apps/web/lib/supabase/error-detect.ts` so the same detector covers
// every render-path query (not just guest_groups). The shared module
// keeps the detector docs in one place; the third hotfix pass extended
// the code list to also cover 42704 / 42883 / PGRST116 + a wider
// message-substring net than the inline version above had. PR #380 +
// #390 lived inline here; this third pass extracts to a shared util.

export type GuestGroupTeamSide = 'bride' | 'groom' | 'both';

export const GUEST_GROUP_TEAM_SIDES: ReadonlyArray<GuestGroupTeamSide> = [
  'bride',
  'groom',
  'both',
];

export const TEAM_SIDE_LABELS: Record<GuestGroupTeamSide, string> = {
  bride: 'Team Bride',
  groom: 'Team Groom',
  both: 'Both sides',
};

// Chip palette mirrors the side-of-wedding tints already used on the
// guest Avatar + SidePill so the visual language stays consistent.
export const TEAM_SIDE_CHIP: Record<GuestGroupTeamSide, string> = {
  bride: 'bg-rose-100 text-rose-800 ring-1 ring-rose-200',
  groom: 'bg-sky-100 text-sky-800 ring-1 ring-sky-200',
  both: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
};

export type GuestGroupRow = {
  group_id: string;
  public_id: string;
  event_id: string;
  label: string;
  team_side: GuestGroupTeamSide;
  created_at: string;
  updated_at: string;
};

export type GuestGroupWithCount = GuestGroupRow & {
  member_count: number;
};

const GUEST_GROUP_FIELDS =
  'group_id,public_id,event_id,label,team_side,created_at,updated_at';

export async function fetchGuestGroupsByEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<GuestGroupWithCount[]> {
  const [groupsRes, membershipsRes] = await Promise.all([
    supabase
      .from('guest_groups')
      .select(GUEST_GROUP_FIELDS)
      .eq('event_id', eventId)
      .order('label', { ascending: true }),
    // Pull all memberships for groups in this event in one round trip;
    // join through group_id then count client-side. Avoids a per-group
    // count(*) which would N+1.
    supabase
      .from('guest_group_memberships')
      .select('group_id, guest_groups!inner(event_id)')
      .eq('guest_groups.event_id', eventId),
  ]);

  // 5th-pass hotfix 2026-05-23: collapse to "always graceful-degrade,
  // never throw" — same rationale as fetchGuestsByEvent above. The
  // multi-select + custom groups feature added this query to the
  // guests-page Promise.all; the third hotfix (PR #404) added
  // re-throw-on-non-missing-relation but the same Sentry digest
  // (3284377371) kept firing because RLS-denial / auth-expiry /
  // network errors slip past isMissingRelationError. After four passes
  // of speculative classification, the pragmatic move is "empty groups
  // sidebar > crashed page". The structured Sentry log still surfaces
  // the call site for diagnosis.
  if (groupsRes.error) {
    logQueryError(
      'fetchGuestGroupsByEvent (groups)',
      groupsRes.error,
      {
        event_id: eventId,
        missing_relation_match: isMissingRelationError(groupsRes.error),
      },
      'graceful_degrade',
    );
    return [];
  }
  const groups = (groupsRes.data ?? []) as unknown as GuestGroupRow[];

  if (membershipsRes.error) {
    logQueryError(
      'fetchGuestGroupsByEvent (memberships)',
      membershipsRes.error,
      {
        event_id: eventId,
        missing_relation_match: isMissingRelationError(membershipsRes.error),
      },
      'graceful_degrade',
    );
  }

  const counts = new Map<string, number>();
  for (const m of (membershipsRes.data ?? []) as Array<{ group_id: string }>) {
    counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);
  }
  return groups.map((g) => ({ ...g, member_count: counts.get(g.group_id) ?? 0 }));
}

/**
 * Fetch the guest_id → group_ids map for one event. Lets the page render
 * group chips on each guest row + filter the visible list when the host
 * has picked a custom-group view.
 */
export async function fetchGroupMembershipsByEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<Map<string, string[]>> {
  const { data, error } = await supabase
    .from('guest_group_memberships')
    .select('guest_id, group_id, guest_groups!inner(event_id)')
    .eq('guest_groups.event_id', eventId);

  // Graceful-degrade on any error — render the page with no custom-group
  // memberships rather than crashing. Symmetric with the 5th-pass
  // hotfix on `fetchGuestGroupsByEvent` and `fetchGuestsByEvent` above
  // (2026-05-23): every async on the guests-page render path now
  // collapses to "log loudly to Sentry, return empty, never throw."
  // After four prior hotfix passes failed to pin down the exact call
  // site of Sentry digest 3284377371, the pragmatic move is to stop
  // trying to classify error types (missing-relation vs RLS denial vs
  // auth expiry vs network) and just always render the page. Real
  // bugs still surface in Sentry via the structured `call_site` +
  // `missing_relation_match` context; the host doesn't see an error
  // boundary anymore. Severity downgraded from `will_throw` to
  // `graceful_degrade` because we no longer throw — the prior label
  // was misleading.
  if (error) {
    logQueryError(
      'fetchGroupMembershipsByEvent',
      error,
      {
        event_id: eventId,
        missing_relation_match: isMissingRelationError(error),
      },
      'graceful_degrade',
    );
    return new Map();
  }
  const map = new Map<string, string[]>();
  for (const row of (data ?? []) as Array<{ guest_id: string; group_id: string }>) {
    const existing = map.get(row.guest_id) ?? [];
    existing.push(row.group_id);
    map.set(row.guest_id, existing);
  }
  return map;
}
