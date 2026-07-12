/**
 * event-type-profile.ts — iteration 0053, Phase 0 (the profile spine).
 *
 * The Event-Type Profile is the single config object that describes WHAT an
 * event type is: its terminology, which couple-facing surfaces apply, and which
 * content pack drives each surface. Surfaces will read this via resolveProfile()
 * instead of hard-coding "wedding" (see spec 0053_event_type_engine).
 *
 * PHASE 0 CONTRACT: nothing consumes this yet. Only the wedding row is seeded
 * (migration 20270220834284), mirroring today's hard-coded values, so the app is
 * byte-identical. Every read falls back to a hard-coded profile on error or a
 * missing row — the same degrade-to-yesterday contract as lib/event-types-db.ts
 * and lib/taxonomy-db.ts: wedding → WEDDING_PROFILE, anything else →
 * GENERIC_PROFILE. So a DB hiccup (or a not-yet-migrated prod) degrades to
 * today's behaviour instead of throwing.
 *
 * Cached per request + per event_type via React `cache()`. Server-only (reads
 * cookies via the Supabase server client).
 */
import { cache } from 'react';

import { createClient } from './supabase/server';
import { resolveRoleSet, type RoleSet } from './role-sets';

export type ProfileSurface =
  | 'website'
  | 'save_the_date'
  | 'rsvp'
  | 'seating'
  | 'budget'
  | 'schedule'
  | 'monogram'
  | 'day_of'
  | 'gallery';

export type ProfileTerminology = {
  organizerNoun: string; // 'couple' | 'host' | 'celebrant' | ...
  personA: string | null; // 'bride'
  personB: string | null; // 'groom'
  seatWord: string; // 'table' | 'spot'
  eventWord: string; // 'wedding' | 'celebration'
  vipTierLabel: string; // top seating-tier label
};

export type EventTypeProfile = {
  eventType: string;
  terminology: ProfileTerminology;
  enabledSurfaces: ProfileSurface[];
  /** Whether the vendor marketplace ("Explore") applies to this type. TRUE for
   *  every existing type (the column DEFAULTs TRUE → no behaviour change); the
   *  "Simple Event" type sets it FALSE so its dashboard hides Explore/vendors
   *  and stays in-app-services-only. A deny-by-exception flag (not an
   *  enabledSurfaces allow-list entry) so pre-existing profile rows — which
   *  predate it — keep Explore exactly as today. (Owner 2026-06-27.) */
  marketplaceEnabled: boolean;
  onboardingFlowKey: string | null;
  roleSetKey: string | null;
  templatePackKey: string | null;
  monogramSetKey: string | null;
  revealPackKey: string | null;
  budgetTaxonomyKey: string | null;
  scheduleSeedKey: string | null;
  statutoryPackKey: string | null;
};

const ALL_SURFACES: ProfileSurface[] = [
  'website',
  'save_the_date',
  'rsvp',
  'seating',
  'budget',
  'schedule',
  'monogram',
  'day_of',
  'gallery',
];

/** Wedding — mirrors today's hard-coded behaviour exactly. */
export const WEDDING_PROFILE: EventTypeProfile = {
  eventType: 'wedding',
  terminology: {
    organizerNoun: 'couple',
    personA: 'bride',
    personB: 'groom',
    seatWord: 'table',
    eventWord: 'wedding',
    vipTierLabel: 'Family & sponsors',
  },
  enabledSurfaces: ALL_SURFACES,
  marketplaceEnabled: true,
  onboardingFlowKey: 'wedding',
  roleSetKey: 'wedding',
  templatePackKey: 'wedding',
  monogramSetKey: 'wedding',
  revealPackKey: 'wedding',
  budgetTaxonomyKey: 'wedding',
  scheduleSeedKey: 'wedding',
  statutoryPackKey: 'ph_marriage',
};

/**
 * The neutral default for any type without a profile row. Dashboard tools only
 * (seating / budget / schedule / day_of / gallery) PLUS the guest-facing website,
 * Save-the-Date and RSVP — unlocked for all event types 2026-07-12 ("unlock all
 * now"). Only `monogram` stays OFF (couple-initials-shaped; a later call). Kept
 * in lockstep with the DB seed (migration 20270802000000) so a rowless/fallback
 * type and a seeded type expose the same surfaces.
 */
export const GENERIC_PROFILE: EventTypeProfile = {
  eventType: 'generic',
  terminology: {
    organizerNoun: 'host',
    personA: null,
    personB: null,
    seatWord: 'table',
    eventWord: 'event',
    vipTierLabel: 'Guests of honor',
  },
  enabledSurfaces: [
    'website',
    'save_the_date',
    'rsvp',
    'seating',
    'budget',
    'schedule',
    'day_of',
    'gallery',
  ],
  marketplaceEnabled: true,
  onboardingFlowKey: null,
  roleSetKey: null,
  templatePackKey: null,
  monogramSetKey: null,
  revealPackKey: null,
  budgetTaxonomyKey: null,
  scheduleSeedKey: null,
  statutoryPackKey: null,
};

/**
 * Simple Event (owner 2026-06-27) — a vendor-free event whose only purpose is to
 * exercise the in-app Setnayan services. So `marketplaceEnabled` is FALSE (the
 * dashboard hides Explore/vendors) and the enabled content surfaces are the
 * couple TOOLS that work without vendors — seating / schedule / day_of / gallery.
 * The public website, Save-the-Date, RSVP, monogram and budget stay OFF; the
 * in-app services hub (Studio) is always available and is the point of the type.
 * roleSetKey 'simple' → SIMPLE_ROLE_SET (a single flat 'guest' role).
 */
export const SIMPLE_PROFILE: EventTypeProfile = {
  eventType: 'simple_event',
  terminology: {
    organizerNoun: 'host',
    personA: null,
    personB: null,
    seatWord: 'table',
    eventWord: 'event',
    vipTierLabel: 'Guests',
  },
  enabledSurfaces: ['seating', 'schedule', 'day_of', 'gallery'],
  marketplaceEnabled: false,
  onboardingFlowKey: 'simple',
  roleSetKey: 'simple',
  templatePackKey: null,
  monogramSetKey: null,
  revealPackKey: null,
  budgetTaxonomyKey: null,
  scheduleSeedKey: null,
  statutoryPackKey: null,
};

function fallbackFor(eventType: string): EventTypeProfile {
  if (eventType === 'wedding') return WEDDING_PROFILE;
  if (eventType === 'simple_event') return SIMPLE_PROFILE;
  return { ...GENERIC_PROFILE, eventType };
}

type ProfileRow = {
  event_type: string;
  terminology: Record<string, unknown> | null;
  enabled_surfaces: string[] | null;
  marketplace_enabled: boolean | null;
  onboarding_flow_key: string | null;
  role_set_key: string | null;
  template_pack_key: string | null;
  monogram_set_key: string | null;
  reveal_pack_key: string | null;
  budget_taxonomy_key: string | null;
  schedule_seed_key: string | null;
  statutory_pack_key: string | null;
};

function toProfile(row: ProfileRow): EventTypeProfile {
  const t = (row.terminology ?? {}) as Record<string, unknown>;
  const fb = fallbackFor(row.event_type);
  const str = (v: unknown, d: string): string =>
    typeof v === 'string' && v.length > 0 ? v : d;
  const strOrNull = (v: unknown, d: string | null): string | null =>
    typeof v === 'string' && v.length > 0 ? v : d;
  return {
    eventType: row.event_type,
    terminology: {
      organizerNoun: str(t.organizer_noun, fb.terminology.organizerNoun),
      personA: strOrNull(t.person_a, fb.terminology.personA),
      personB: strOrNull(t.person_b, fb.terminology.personB),
      seatWord: str(t.seat_word, fb.terminology.seatWord),
      eventWord: str(t.event_word, fb.terminology.eventWord),
      vipTierLabel: str(t.vip_tier_label, fb.terminology.vipTierLabel),
    },
    enabledSurfaces:
      Array.isArray(row.enabled_surfaces) && row.enabled_surfaces.length > 0
        ? (row.enabled_surfaces.filter((s): s is ProfileSurface =>
            (ALL_SURFACES as string[]).includes(s),
          ))
        : fb.enabledSurfaces,
    marketplaceEnabled:
      typeof row.marketplace_enabled === 'boolean'
        ? row.marketplace_enabled
        : fb.marketplaceEnabled,
    onboardingFlowKey: row.onboarding_flow_key ?? fb.onboardingFlowKey,
    roleSetKey: row.role_set_key ?? fb.roleSetKey,
    templatePackKey: row.template_pack_key ?? fb.templatePackKey,
    monogramSetKey: row.monogram_set_key ?? fb.monogramSetKey,
    revealPackKey: row.reveal_pack_key ?? fb.revealPackKey,
    budgetTaxonomyKey: row.budget_taxonomy_key ?? fb.budgetTaxonomyKey,
    scheduleSeedKey: row.schedule_seed_key ?? fb.scheduleSeedKey,
    statutoryPackKey: row.statutory_pack_key ?? fb.statutoryPackKey,
  };
}

/**
 * The Event-Type Profile for a given type. Cached per request. Falls back to the
 * hard-coded WEDDING_PROFILE / GENERIC_PROFILE on any error or missing row.
 */
// The profile columns, split so `marketplace_enabled` (added by a LATER migration
// than the table) can be dropped when reading a not-yet-migrated prod without
// losing the rest of the row. See the deploy-order note in resolveProfile.
const PROFILE_BASE_COLUMNS =
  'event_type, terminology, enabled_surfaces, onboarding_flow_key, role_set_key, template_pack_key, monogram_set_key, reveal_pack_key, budget_taxonomy_key, schedule_seed_key, statutory_pack_key';

export const resolveProfile = cache(
  async (eventType: string): Promise<EventTypeProfile> => {
    try {
      const sb = await createClient();
      // Try the full row (incl. marketplace_enabled). If that column does not
      // exist yet — i.e. the code deployed before its migration applied — the
      // whole select errors, which would degrade EVERY type to its hard-coded
      // fallback and so strip the 8 seeded non-wedding types of their per-type
      // terminology. So on error we retry WITHOUT the new column: the row's
      // terminology/surfaces/packs are preserved and marketplace_enabled falls
      // back to the code default (TRUE for all but Simple Event). Once the
      // migration is applied the first select succeeds and the column is read.
      const full = await sb
        .from('event_type_profiles')
        .select(`${PROFILE_BASE_COLUMNS}, marketplace_enabled`)
        .eq('event_type', eventType)
        .maybeSingle();
      if (!full.error) {
        return full.data ? toProfile(full.data as ProfileRow) : fallbackFor(eventType);
      }
      const base = await sb
        .from('event_type_profiles')
        .select(PROFILE_BASE_COLUMNS)
        .eq('event_type', eventType)
        .maybeSingle();
      if (base.error || !base.data) return fallbackFor(eventType);
      return toProfile({ ...(base.data as object), marketplace_enabled: null } as ProfileRow);
    } catch {
      return fallbackFor(eventType);
    }
  },
);

/** Convenience: does this profile enable a given surface? */
export function surfaceEnabled(
  profile: EventTypeProfile,
  surface: ProfileSurface,
): boolean {
  return profile.enabledSurfaces.includes(surface);
}

/**
 * Server helper: the EventTypeProfile for an event id (fetches its event_type).
 * A missing event / read error degrades to WEDDING_PROFILE so existing wedding
 * flows are unaffected. Cached per request + per eventId. (Iteration 0053 P2.)
 */
export const resolveProfileByEvent = cache(
  async (eventId: string): Promise<EventTypeProfile> => {
    try {
      const sb = await createClient();
      const { data } = await sb
        .from('events')
        .select('event_type')
        .eq('event_id', eventId)
        .maybeSingle();
      if (!data) return WEDDING_PROFILE;
      return resolveProfile((data.event_type as string | null) ?? 'wedding');
    } catch {
      return WEDDING_PROFILE;
    }
  },
);

/**
 * Server helper: the ROLE-SET KEY for an event id, ceremony-aware.
 *
 * Role sets are keyed off the event-type profile (wedding/generic/simple). But
 * within a WEDDING, the Nikah's cast differs by ceremony_type: a muslim wedding
 * wants the wali/witness/imam/wakil principals and none of the Catholic
 * sponsors. Rather than fork the profile spine (which is event_type-shaped), we
 * branch here: a wedding whose ceremony_type (primary OR a mixed secondary) is
 * 'muslim' resolves to the 'wedding_muslim' role set; everything else keeps its
 * profile's roleSetKey. This is the single chokepoint every guest picker, its
 * server-action validator, the join self-claim flow, and the seating tier
 * resolution all flow through — so they become ceremony-aware atomically while
 * WEDDING_ROLE_SET stays byte-identical for Catholic/civil/etc. weddings.
 *
 * Returns a plain string so it can also feed the CLIENT quick-add sheet (which
 * resolves its picker list from a roleSetKey prop via resolveRoleSet). Cached
 * per request + per eventId; degrades to the profile key on any read error.
 */
export const resolveRoleSetKeyForEvent = cache(
  async (eventId: string): Promise<string | null> => {
    const profile = await resolveProfileByEvent(eventId);
    // Only weddings get a ceremony-specific role set; everything else (generic /
    // simple / future types) uses its profile default untouched.
    if (profile.roleSetKey !== 'wedding') return profile.roleSetKey;
    try {
      const sb = await createClient();
      const { data } = await sb
        .from('events')
        .select('ceremony_type, secondary_ceremony_type')
        .eq('event_id', eventId)
        .maybeSingle();
      const primary = (data?.ceremony_type as string | null) ?? null;
      const secondary = (data?.secondary_ceremony_type as string | null) ?? null;
      if (primary === 'muslim' || secondary === 'muslim') return 'wedding_muslim';
      return profile.roleSetKey;
    } catch {
      return profile.roleSetKey;
    }
  },
);

/** Server helper: the RoleSet for an event id (iteration 0053 Phase 2). */
export const resolveRoleSetForEvent = cache(
  async (eventId: string): Promise<RoleSet> => {
    return resolveRoleSet(await resolveRoleSetKeyForEvent(eventId));
  },
);
