import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isMissingRelationError,
  logQueryError,
} from '@/lib/supabase/error-detect';

export type GuestRole =
  | 'guest'
  | 'bride'
  | 'groom'
  // VIP family — owner directive 2026-05-23 PM. The four new immediate-
  // family roles drive iteration 0008 seating-chart auto-fill (Tier 1 =
  // closest to stage). Not single-instance — a wedding has multiple
  // parents (mother/father, step-parents) and any number of immediate
  // family (siblings/grandparents) per side. Enum values added via
  // migration 20260607040000_guest_role_add_vip_family.sql.
  | 'bride_parents'
  | 'groom_parents'
  | 'bride_immediate_family'
  | 'groom_immediate_family'
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
  | 'soloist_musician'
  // Generic (non-wedding) roles — iteration 0053 Phase 2. Additive enum values
  // (migration 20270220984328) for the GENERIC profile's role set. All
  // multi-instance (no singleton index). Only surface for non-wedding events.
  | 'host'
  | 'vip'
  | 'family'
  | 'helper'
  // Muslim wedding Nikah roles — the structural participants of the Islamic
  // marriage contract. Enum values added via migration 20270308910536. These
  // surface ONLY for muslim weddings via the ceremony-aware MUSLIM_ROLE_SET
  // (lib/role-sets.ts). wali/imam/wakil are at-most-one-per-event (partial
  // unique indexes, migration 20270308998862); witness is multi-instance (a
  // nikah needs at least two).
  | 'wali'
  | 'witness'
  | 'imam'
  | 'wakil';

/**
 * Roles that may exist at most once per event. Enforced at the DB layer
 * via partial unique indexes (migration 20260531010000); UI uses this
 * list to filter the role dropdown.
 */
export const SINGLETON_GUEST_ROLES: ReadonlyArray<GuestRole> = [
  'bride',
  'groom',
  // Muslim Nikah singletons (migration 20270308998862). witness is NOT here — a
  // nikah needs at least two, which a one-per-event guard would forbid.
  'wali',
  'imam',
  'wakil',
];

// What a guest's 3D seat-plan avatar wears. 'neutral' is the stored default; the
// renderer treats it as "unset" and falls back to a role-implied guess (below).
export type GuestAttire = 'gown' | 'suit' | 'neutral';

// Role → attire for the gendered wedding-party roles, so the entourage dresses
// itself without the couple tagging every member. Everyone else (generic guests,
// ungendered sponsors/family) stays 'neutral' until the couple sets it. Kept
// deliberately conservative: only roles whose gender is unambiguous are mapped.
const ATTIRE_BY_ROLE: Partial<Record<GuestRole, GuestAttire>> = {
  bride: 'gown',
  maid_of_honor: 'gown',
  matron_of_honor: 'gown',
  bridesmaid: 'gown',
  flower_girl: 'gown',
  groom: 'suit',
  best_man: 'suit',
  groomsman: 'suit',
  ring_bearer: 'suit',
  bible_bearer: 'suit',
  coin_bearer: 'suit',
  // Muslim Nikah principals whose role is gendered male (the wali is the
  // bride's male guardian; the imam/qadi and the groom's wakil are male).
  // witness is left 'neutral' (a witness may be of any gender).
  wali: 'suit',
  imam: 'suit',
  wakil: 'suit',
};

/**
 * Resolve what a guest wears: an explicit couple-set value wins; otherwise a
 * gendered wedding-party role implies it; otherwise 'neutral'. Pure + shared so
 * the 3D lab and any future surface (print, day-of) dress guests identically.
 */
export function resolveGuestAttire(role: GuestRole, attire: GuestAttire): GuestAttire {
  if (attire !== 'neutral') return attire;
  return ATTIRE_BY_ROLE[role] ?? 'neutral';
}

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

// Where a guest's display photo came from (iteration 0001 photo grid).
//   oauth_google — Gmail-login avatar; display-only, never face-rec grade.
//   selfie       — RSVP selfie; also the Papic face-recognition enrollment source.
//   couple_upload— the host set it manually on the guest detail page.
// Display priority (enforced in each writer's WHERE clause, not in SQL):
//   selfie > couple_upload > oauth_google > null (initials fallback).
export type GuestPhotoSource = 'oauth_google' | 'selfie' | 'couple_upload';

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
  extra_roles: GuestRole[];
  plus_one_allowed: boolean;
  plus_one_name: string | null;
  plus_one_of_guest_id: string | null;
  plus_one_mode: 'full' | 'limited' | null;
  email: string | null;
  mobile: string | null;
  meal_preference: MealPreference | null;
  dietary_restrictions: string | null;
  photo_consent: boolean;
  faceblock_enabled: boolean;
  face_recognition_excluded: boolean;
  photo_url: string | null;
  photo_source: GuestPhotoSource | null;
  photo_updated_at: string | null;
  invited_to_blocks: string[];
  rsvp_status: RsvpStatus;
  notes: string | null;
  qr_token: string;
  custom_tags: string[];
  // Explicit seating-priority tier override (1–4); null = derive from role +
  // group via lib/seating guestTier(). Written by the seat-plan editor.
  seating_priority: number | null;
  // What this guest wears on their 3D seat-plan avatar (see resolveGuestAttire).
  attire: GuestAttire;
  // Chinese tea-ceremony serving order — within-side serve order (lower serves
  // first; null = unset, falls back to role importance) + a free-text relation
  // label ("Grandparents", "Eldest Uncle"). Both optional · migration
  // 20270309030000_guest_seniority.sql.
  seniority_rank: number | null;
  relation: string | null;
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

// Inner-circle roles get all 5 event blocks by default — couple, parents,
// immediate family, primary wedding party, principal sponsors. Filipino
// wedding reality: rehearsal dinner attendance is essentially these same
// people; after-party defaults skew the same way. Locked 2026-05-23 PM
// (Path 2 from owner walkthrough on Invited-to chip smart defaults). The
// rest of the role list (secondary sponsors · bearers · flower girl ·
// readers · soloists · plain guest) defaults to ceremony + reception +
// cocktails — host toggles after-party / rehearsal-dinner on per-guest
// for the people they actually want there.
const INNER_CIRCLE_ROLES: ReadonlySet<GuestRole> = new Set([
  'bride',
  'groom',
  'bride_parents',
  'groom_parents',
  'bride_immediate_family',
  'groom_immediate_family',
  'maid_of_honor',
  'matron_of_honor',
  'best_man',
  'bridesmaid',
  'groomsman',
  'principal_sponsor',
  // Muslim Nikah principals are inner-circle (invited to every block).
  'wali',
  'imam',
  'wakil',
]);

/**
 * Smart defaults for which event blocks a guest is invited to, given
 * their role in the wedding. Used by the new + edit guest forms via a
 * client-island that snaps the chip checkboxes when the role <select>
 * changes. The host can still toggle any chip on or off after.
 *
 * Inner circle (couple, parents, immediate family, primary wedding
 * party, principal sponsors) defaults to all 5 blocks. Everyone else
 * defaults to ceremony + reception + cocktails — the 3 blocks 95-100%
 * of guests attend regardless.
 */
export function defaultInvitedToForRole(role: GuestRole): InvitedToBlock[] {
  if (INNER_CIRCLE_ROLES.has(role)) {
    return ['ceremony', 'reception', 'cocktails', 'after_party', 'rehearsal_dinner'];
  }
  return ['ceremony', 'reception', 'cocktails'];
}

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
  bride_parents: "Bride's Parents",
  groom_parents: "Groom's Parents",
  bride_immediate_family: "Bride's Immediate Family",
  groom_immediate_family: "Groom's Immediate Family",
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
  // Generic (non-wedding) roles — iteration 0053 Phase 2.
  host: 'Host',
  vip: 'VIP',
  family: 'Family',
  helper: 'Helper',
  // Muslim wedding Nikah roles.
  wali: "Wali (Bride's Guardian)",
  witness: 'Witness (Shahid)',
  imam: 'Imam / Qadi (Officiant)',
  wakil: "Wakil (Groom's Proxy)",
};

// --- Singleton-role messaging (one source for every guest write path) -------
// bride/groom + the Muslim Nikah singletons (wali/imam/wakil) are one-per-event,
// enforced both in the UI (SINGLETON_GUEST_ROLES) and at the DB layer (the
// guests_one_<role>_per_event partial-unique indexes, which raise 23505). These
// helpers keep the user-facing copy + the constraint-name detection in ONE
// place, so adding a future singleton only touches SINGLETON_GUEST_ROLES +
// SINGLETON_INDEX_RE — not a half-dozen drifting bride/groom ternaries.

/** Copy when a couple tries to ADD a singleton role as a second/extra role. */
export function singletonRoleConflictMessage(role: GuestRole): string {
  return `${ROLE_LABELS[role]} can only be one person — change their primary role instead.`;
}

/** Copy when the DB blocks a duplicate singleton (a 23505 on its index). */
export function singletonRoleDuplicateMessage(role: GuestRole): string {
  return `There’s already a ${ROLE_LABELS[role]} in this event — change theirs first.`;
}

const SINGLETON_INDEX_RE = /guests_one_(bride|groom|wali|imam|wakil)_per_event/;

/** Map a Postgres 23505 message on a guests_one_<role>_per_event index back to
 *  the offending role; null if the message isn't one of those constraints. */
export function singletonRoleFromIndexError(
  message: string | null | undefined,
): GuestRole | null {
  if (!message) return null;
  const m = SINGLETON_INDEX_RE.exec(message);
  return m ? (m[1] as GuestRole) : null;
}

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
  'guest_id,public_id,event_id,first_name,last_name,display_name,side,group_category,role,extra_roles,plus_one_allowed,plus_one_name,plus_one_of_guest_id,plus_one_mode,email,mobile,meal_preference,dietary_restrictions,photo_consent,faceblock_enabled,face_recognition_excluded,photo_url,photo_source,photo_updated_at,invited_to_blocks,rsvp_status,notes,qr_token,custom_tags,seating_priority,attire,seniority_rank,relation,created_at';

// Bride & groom are the foundation of the event — always Attending, never
// Pending (owner directive 2026-06-03). The DB trigger from migration
// 20260725000000_guests_couple_attending is the source of truth; we also
// coerce on read so the UI is correct the instant this ships, even before the
// migration is pushed to prod and for any row the trigger hasn't rewritten.
function coupleAttending(row: GuestRow): GuestRow {
  return row.role === 'bride' || row.role === 'groom'
    ? { ...row, rsvp_status: 'attending' }
    : row;
}

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

  return ((data ?? []) as unknown as GuestRow[]).map(coupleAttending);
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
  const row = (data ?? null) as unknown as GuestRow | null;
  return row ? coupleAttending(row) : null;
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

// Which guests count toward the live headcount + the pax sent to vendors
// (events.headcount_basis). 'attending' = sure guests only (the owner-locked
// default + the basis vendor pricing keys off); 'attending_plus_maybe' adds
// maybes; 'invited' is everyone still on the list (total minus declined).
// Adaptive Pax Pricing, 2026-06-13.
export type HeadcountBasis = 'attending' | 'attending_plus_maybe' | 'invited';

export function headcountForBasis(
  stats: GuestStats,
  basis: HeadcountBasis = 'attending',
): number {
  switch (basis) {
    case 'attending_plus_maybe':
      return stats.attending + stats.maybe;
    case 'invited':
      return stats.total - stats.declined;
    case 'attending':
    default:
      return stats.attending;
  }
}

export type PaxProgress = {
  /** events.estimated_pax — the couple's "minimum pax" = the pricing floor. */
  target: number;
  /** Live headcount on the chosen basis (Phase 1 default: sure attending). */
  headcount: number;
  /** max(target, headcount) — the vendor-facing number once it tops the floor. */
  livePax: number;
  /** Headcount as a % of the target, capped at 100 for the bar. */
  progressPct: number;
  /** headcount has passed the minimum pax floor. */
  exceeded: boolean;
  /** Guests above the floor (0 until exceeded). */
  overBy: number;
  /** Guests still needed to reach the floor (0 once met). */
  remaining: number;
};

// Progress of the live headcount toward the couple's minimum pax (the pricing
// floor). Returns null when no target is set (estimated_pax NULL/0). The meter
// fills on the chosen basis; livePax = max(target, headcount) is the
// vendor-facing number once the count tops the floor. Pure — no DB, no prices.
// Adaptive Pax Pricing, 2026-06-13.
export function computePaxProgress(
  stats: GuestStats,
  estimatedPax: number | null | undefined,
  basis: HeadcountBasis = 'attending',
): PaxProgress | null {
  if (!estimatedPax || estimatedPax <= 0) return null;
  const headcount = headcountForBasis(stats, basis);
  const livePax = Math.max(estimatedPax, headcount);
  return {
    target: estimatedPax,
    headcount,
    livePax,
    progressPct: Math.min(100, Math.round((headcount / estimatedPax) * 100)),
    exceeded: headcount > estimatedPax,
    overBy: Math.max(0, headcount - estimatedPax),
    remaining: Math.max(0, estimatedPax - headcount),
  };
}

export function guestDisplayName(
  guest: Pick<GuestRow, 'display_name' | 'first_name' | 'last_name'>,
): string {
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
// Per-team-side chip colors · owner directive 2026-05-23 PM: "pink for
// bride, blue for groom, amethyst for both". Aligned across surfaces:
// the sidebar group row tint, the per-guest GroupChipList chip on the
// table, and any future team_side chrome.
export const TEAM_SIDE_CHIP: Record<GuestGroupTeamSide, string> = {
  bride: 'bg-danger-100 text-danger-800 ring-1 ring-danger-200',
  groom: 'bg-sky-100 text-sky-800 ring-1 ring-sky-200',
  // Amethyst (purple) — distinct from bride's rose + groom's sky.
  // Replaces the prior amber treatment so "Both sides" reads as a
  // distinct third option rather than a warm neutral.
  both: 'bg-purple-100 text-purple-800 ring-1 ring-purple-200',
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
