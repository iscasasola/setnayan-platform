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
import { createAdminClient } from './supabase/admin';
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

/**
 * HOW MANY PEOPLE THE CELEBRANT IS (owner ruling 2026-08-27).
 *
 * Owner, verbatim: *"each event can be set to a single host or multiple host …
 * yes, there can be multiple hosts for every event, but the one celebratiing is
 * the celebrant that can be single, couple, or multiple people."*
 *
 * So HOSTS are always potentially many — that needs no setting, it is a count of
 * the event's own host members — while the CELEBRANT carries a shape, because it
 * cannot be counted from anything we store: a wedding's two celebrants may both
 * be members, one, or neither.
 *
 * The shape is only ever VISIBLE on a countable person-noun ('celebrant',
 * 'graduate'). A collective noun — 'couple', 'family' — never pluralises, which
 * is why a wedding reads identically under every shape.
 */
export type CelebrantShape = 'single' | 'couple' | 'multiple';

/**
 * The two seeded nouns that name the person the event is ABOUT rather than the
 * person who RUNS it. At a seven-year-old's birthday the celebrant is the
 * seven-year-old, so "The celebrant is still arranging the venue layout" names
 * the wrong person entirely.
 *
 * Anything else — including a noun added later — is treated as an organiser word
 * and stays the host noun too. That is the safe direction: naming a real
 * organiser reads fine, naming a child who arranged nothing does not.
 */
export const HONOREE_NOUNS: ReadonlySet<string> = new Set(['celebrant', 'graduate']);

/**
 * What a type's HOST noun is when its row has no `host_noun` of its own — i.e.
 * every row seeded before 2026-08-27, and any row an admin has not revisited.
 *
 * The organiser noun IS the host noun, except where it names the honoree, in
 * which case the host is a plain 'host'. This is what makes the change
 * byte-identical for a wedding ('couple' runs it AND is honoured by it — which
 * is exactly why 'couple' worked where 'celebrant' did not).
 */
/**
 * Nouns that already describe a GROUP, so a shape can never pluralise them.
 *
 * 'couple' is the load-bearing one: it is the wedding's celebrant noun under
 * the 'couple' shape, and "the couples" would be a live defect on the only
 * event type anyone has ever seen in production. 'family' is the funeral's.
 */
const COLLECTIVE_NOUNS: ReadonlySet<string> = new Set(['couple', 'family']);

/**
 * 'celebrant' → 'celebrants' · 'graduate' → 'graduates'. Ordinary English
 * plural, and deliberately small: the seeded nouns are all regular. A collective
 * noun never reaches this — see `shapedCelebrant`.
 */
function pluralOf(noun: string): string {
  if (/(?:s|x|z|ch|sh)$/.test(noun)) return `${noun}es`;
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

/**
 * The celebrant noun under its shape.
 *
 * 'single' and 'couple' both return the noun untouched — a 'couple' shape means
 * the noun ALREADY names two people ('couple'), never that a singular noun
 * should be doubled. Only 'multiple' pluralises, and only a countable noun.
 */
export function shapedCelebrant(noun: string, shape: CelebrantShape): string {
  if (shape !== 'multiple') return noun;
  return COLLECTIVE_NOUNS.has(noun) ? noun : pluralOf(noun);
}
/**
 * Would a shape change anything a guest READS for this celebrant noun?
 *
 * FALSE for a collective noun, where every shape renders the same word — so the
 * control that sets it is not offered. A picker that provably cannot change
 * what anybody sees is a question asked for nothing, and this repo has shipped
 * a stored value nothing reads more than once.
 */
export function celebrantShapeIsVisible(noun: string): boolean {
  return !COLLECTIVE_NOUNS.has(noun.trim());
}

/** Strict parse for the stored `celebrant_shape` key. Anything else is not a
 *  shape — the caller takes its code fallback rather than inventing one. */
export function isCelebrantShape(v: unknown): v is CelebrantShape {
  return v === 'single' || v === 'couple' || v === 'multiple';
}

export function defaultHostNoun(organizerNoun: string): string {
  return HONOREE_NOUNS.has(organizerNoun) ? 'host' : organizerNoun;
}

export type ProfileTerminology = {
  organizerNoun: string; // 'couple' | 'host' | 'celebrant' | ...
  personA: string | null; // 'bride'
  personB: string | null; // 'groom'
  seatWord: string; // 'table' | 'spot'
  eventWord: string; // 'wedding' | 'celebration'
  vipTierLabel: string; // top seating-tier label
  /**
   * The register the guest tree speaks in (owner 2026-08-17: a funeral is "a
   * TONE build across the whole guest tree, not a row in a table").
   *
   * 'celebratory' — every type that existed before the funeral. The guest tree
   * keeps saying "celebration", renders the countdown, offers the upsells.
   * 'solemn' — a wake/funeral. The tree never says "celebrate", never counts
   * down, never pitches; each site renders a deliberately-drafted quiet arm.
   *
   * Parsed strictly in toProfile: anything that is not the literal 'solemn'
   * resolves to the fallback profile's register, so a typo in an admin-edited
   * row degrades to today's voice for the 15 celebratory types — and the
   * FUNERAL_PROFILE code fallback keeps a funeral solemn even when its DB row
   * is missing entirely.
   */
  register: 'celebratory' | 'solemn';
  /**
   * The word for the occasion in mechanical guest-read slots ("during the
   * ___", "for this ___"). 'celebration' everywhere today — byte-identical —
   * and 'gathering' for the funeral, where "celebration" is the defect.
   */
  occasionNoun: string;
  /**
   * WHO RUNS THIS EVENT — the word for the people doing the admin work:
   * publishing a seating plan, arranging the venue, posting the programme,
   * holding the guest list. There may be one of them or many (owner 2026-08-27:
   * *"there can be multiple hosts for every event"*), so this noun is never
   * counted — the event's host members are.
   *
   * Falls back to `defaultHostNoun(organizerNoun)`, so a row seeded before this
   * field existed reads exactly as it does today.
   */
  hostNoun: string;
  /**
   * WHO IS BEING CELEBRATED — the word for the person or people the event is
   * FOR: whose gift page this is, who a greeting is on its way to, whose
   * gallery the shots land in.
   *
   * Falls back to the row's OWN `organizer_noun` (not the code fallback's), so
   * every one of the 16 seeded types keeps the exact word it reads today.
   *
   * 🔒 For a wedding, `hostNoun` and `celebrantNoun` are BOTH 'couple'. That is
   * the safety property: the couple both run the event and are honoured by it.
   */
  celebrantNoun: string;
  /** How many people the celebrant is. Only visible on a countable noun. */
  celebrantShape: CelebrantShape;
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
  /** Composable-event foundation (owner 2026-07-15, migration 20270807254184).
   *  'personal' = only a person may own events of this type; 'community_eligible'
   *  = a community (Samahan) may also own them. Owner-locked: communities can
   *  NEVER own personal-milestone types (wedding · debut · christening ·
   *  gender reveal · birthday · graduation). Nothing consumes this yet — it is
   *  the create-flow gate the community build reads next. */
  eventClass: 'personal' | 'community_eligible';
  /** 'anchored' = a venue is fed (catering — food comes TO the event);
   *  'roaming' = travel/lifestyle (timed dining reservations — people go OUT to
   *  eat). Routes the food layer of the composable-event stack. */
  layerMode: 'anchored' | 'roaming';
  /** TRUE = this type may span several days (events.event_end_date + day-aware
   *  schedule). Segments (rehearsal dinner, send-off brunch) are schedule
   *  blocks on the ONE event, never separate events; lodging is never an event. */
  multiDay: boolean;
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
    register: 'celebratory',
    occasionNoun: 'celebration',
    hostNoun: 'couple',
    celebrantNoun: 'couple',
    celebrantShape: 'couple',
  },
  enabledSurfaces: ALL_SURFACES,
  marketplaceEnabled: true,
  eventClass: 'personal',
  layerMode: 'anchored',
  multiDay: true, // wedding WEEKEND — rehearsal dinner/brunch are days on ONE event
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
 * (seating / budget / schedule / day_of / gallery) PLUS the core guest-facing
 * website + RSVP — unlocked for all event types 2026-07-12 ("unlock all now").
 * `save_the_date` and `monogram` stay OFF on purpose: the STD cinematic reveal is
 * a wedding-signature feature and the monogram is couple-initials-shaped — both
 * CONTENT, not a noun swap, so they'd look broken for a non-wedding; a later call
 * unlocks them once generalized. Kept in lockstep with the DB seed (migrations
 * 20270804110223 + the std_stays_wedding_only follow-up) so a rowless/fallback
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
    register: 'celebratory',
    occasionNoun: 'celebration',
    hostNoun: 'host',
    celebrantNoun: 'host',
    celebrantShape: 'single',
  },
  enabledSurfaces: [
    'website',
    'rsvp',
    'seating',
    'budget',
    'schedule',
    'day_of',
    'gallery',
  ],
  marketplaceEnabled: true,
  eventClass: 'personal', // conservative default: unknown types stay personal-only
  layerMode: 'anchored',
  multiDay: false,
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
 * Save-the-Date, RSVP, monogram and budget stay OFF; the
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
    register: 'celebratory',
    occasionNoun: 'celebration',
    hostNoun: 'host',
    celebrantNoun: 'host',
    celebrantShape: 'single',
  },
  // ⚠ 'website' IS REQUIRED HERE, and leaving it out was a DEAD END (2026-08-02).
  //
  // The note above still holds for what it meant — a simple event gets no
  // wedding-style marketing site, no Save-the-Date, no RSVP. But `day_of` and
  // `gallery` ARE enabled, and both of those RENDER ON THE PUBLIC EVENT SITE.
  // 'website' is not a marketing surface: it is the surface that makes that site
  // editable and, critically, the only place the "go live" control exists.
  //
  // Without it a host was redirected out of BOTH launch buttons — the one on
  // Save-the-Date and the one in the website editor — so their event site stayed
  // private forever. Guests could never open it, which also took the guest
  // camera, the QR and the gallery with it. Enabling the day-of experience while
  // disabling the only switch that turns it on is a contradiction, not a scope
  // choice. Pinned by the 'day_of implies website' guard in the test file.
  enabledSurfaces: ['website', 'seating', 'schedule', 'day_of', 'gallery'],
  marketplaceEnabled: false,
  eventClass: 'community_eligible', // a Samahan may host a simple event
  layerMode: 'anchored',
  multiDay: false,
  onboardingFlowKey: 'simple',
  roleSetKey: 'simple',
  templatePackKey: null,
  monogramSetKey: null,
  revealPackKey: null,
  budgetTaxonomyKey: null,
  scheduleSeedKey: null,
  statutoryPackKey: null,
};

/**
 * Travel — the roaming multi-day trip (ai-travel-scheduling, migration
 * 20270825683668). Mirrors the seeded DB row (20270221005058 terminology +
 * the composable trio set to roaming/multi-day by 20270807254184 and
 * re-asserted by 20270825683668) so a DB hiccup degrades to the SAME traits
 * the row carries — the itinerary surface (lib/schedule-travel.ts) never
 * flips single-day on a read error. Surfaces/packs match GENERIC_PROFILE.
 */
export const TRAVEL_PROFILE: EventTypeProfile = {
  ...GENERIC_PROFILE,
  eventType: 'travel',
  terminology: {
    organizerNoun: 'organizer',
    personA: null,
    personB: null,
    seatWord: 'seat',
    eventWord: 'trip',
    vipTierLabel: 'Travelers',
    register: 'celebratory',
    occasionNoun: 'celebration',
    hostNoun: 'organizer',
    celebrantNoun: 'organizer',
    celebrantShape: 'multiple',
  },
  layerMode: 'roaming',
  multiDay: true,
  onboardingFlowKey: 'travel',
};

/**
 * Funeral — the one SOLEMN type (owner 2026-08-17, "yes to all four": funeral
 * approved as a new event type, ruled a TONE build across the whole guest
 * tree). Mirrors the seeded DB row the same way TRAVEL_PROFILE does, and for
 * the same reason with higher stakes: on a DB hiccup a funeral must degrade to
 * the SAME solemn traits its row carries — a read error must never flip a
 * wake's page back to "The celebration is underway".
 *
 * Surfaces match GENERIC_PROFILE (no save_the_date, no monogram — the wake
 * additionally never ENTERS the save_the_date lifecycle phase, gated on this
 * register in app/[slug]/page.tsx). `multiDay` is TRUE because a Filipino
 * lamay runs for days before the interment. A wake MAY accept money (owner,
 * same ruling) — the pabuya surfaces stay reachable and wear their gentler
 * solemn wording instead of "digital money dance".
 */
export const FUNERAL_PROFILE: EventTypeProfile = {
  ...GENERIC_PROFILE,
  eventType: 'funeral',
  terminology: {
    organizerNoun: 'family',
    personA: null,
    personB: null,
    seatWord: 'table',
    eventWord: 'wake',
    vipTierLabel: 'Immediate family',
    register: 'solemn',
    occasionNoun: 'gathering',
    hostNoun: 'family',
    celebrantNoun: 'family',
    celebrantShape: 'single',
  },
  multiDay: true,
};

function fallbackFor(eventType: string): EventTypeProfile {
  if (eventType === 'wedding') return WEDDING_PROFILE;
  if (eventType === 'simple_event') return SIMPLE_PROFILE;
  if (eventType === 'travel') return TRAVEL_PROFILE;
  if (eventType === 'funeral') return FUNERAL_PROFILE;
  return { ...GENERIC_PROFILE, eventType };
}

type ProfileRow = {
  event_type: string;
  terminology: Record<string, unknown> | null;
  enabled_surfaces: string[] | null;
  marketplace_enabled: boolean | null;
  event_class: string | null;
  layer_mode: string | null;
  multi_day: boolean | null;
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
  // Resolved FIRST: both new nouns fall back through it, not through the code
  // profile. A birthday row carries organizer_noun 'celebrant' while its code
  // fallback is GENERIC ('host'), so defaulting the celebrant word to the
  // fallback profile would have SILENTLY DOWNGRADED fifteen seeded types to
  // "the host" — a regression dressed as a default.
  const organizerNoun = str(t.organizer_noun, fb.terminology.organizerNoun);
  return {
    eventType: row.event_type,
    terminology: {
      organizerNoun,
      personA: strOrNull(t.person_a, fb.terminology.personA),
      personB: strOrNull(t.person_b, fb.terminology.personB),
      seatWord: str(t.seat_word, fb.terminology.seatWord),
      eventWord: str(t.event_word, fb.terminology.eventWord),
      vipTierLabel: str(t.vip_tier_label, fb.terminology.vipTierLabel),
      // Only the exact literals are honoured; anything else takes the code
      // fallback's register, so a malformed row can neither turn a birthday
      // solemn nor a funeral celebratory (FUNERAL_PROFILE carries 'solemn').
      register:
        t.register === 'solemn'
          ? 'solemn'
          : t.register === 'celebratory'
            ? 'celebratory'
            : fb.terminology.register,
      occasionNoun: str(t.occasion_noun, fb.terminology.occasionNoun),
      // The row's OWN organiser noun is the default for both, via the shared
      // rule — so every row seeded before 2026-08-27 reads exactly as it does
      // today, and a wedding is byte-identical.
      hostNoun: str(t.host_noun, defaultHostNoun(organizerNoun)),
      celebrantNoun: str(t.celebrant_noun, organizerNoun),
      // Strict literals only, exactly like `register`: a typo in an
      // admin-edited row takes the code fallback rather than inventing a shape.
      celebrantShape: isCelebrantShape(t.celebrant_shape)
        ? t.celebrant_shape
        : fb.terminology.celebrantShape,
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
    eventClass:
      row.event_class === 'personal' || row.event_class === 'community_eligible'
        ? row.event_class
        : fb.eventClass,
    layerMode:
      row.layer_mode === 'anchored' || row.layer_mode === 'roaming'
        ? row.layer_mode
        : fb.layerMode,
    multiDay: typeof row.multi_day === 'boolean' ? row.multi_day : fb.multiDay,
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
// The profile columns, split so columns added by LATER migrations than the
// table (`marketplace_enabled`, and the 20270807254184 composable-event trio
// `event_class` / `layer_mode` / `multi_day`) can be dropped when reading a
// not-yet-migrated prod without losing the rest of the row. See the
// deploy-order note in resolveProfile.
const PROFILE_BASE_COLUMNS =
  'event_type, terminology, enabled_surfaces, onboarding_flow_key, role_set_key, template_pack_key, monogram_set_key, reveal_pack_key, budget_taxonomy_key, schedule_seed_key, statutory_pack_key';
const PROFILE_OPTIONAL_COLUMNS =
  'marketplace_enabled, event_class, layer_mode, multi_day';

export const resolveProfile = cache(
  async (eventType: string): Promise<EventTypeProfile> => {
    try {
      const sb = await createClient();
      // Try the full row (incl. the later-migration optional columns). If any
      // of those columns does not exist yet — i.e. the code deployed before its
      // migration applied — the whole select errors, which would degrade EVERY
      // type to its hard-coded fallback and so strip the seeded non-wedding
      // types of their per-type terminology. So on error we retry WITHOUT the
      // optional columns: the row's terminology/surfaces/packs are preserved
      // and each optional field falls back to its code default. Once the
      // migrations are applied the first select succeeds and the columns read.
      const full = await sb
        .from('event_type_profiles')
        .select(`${PROFILE_BASE_COLUMNS}, ${PROFILE_OPTIONAL_COLUMNS}`)
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
      return toProfile({
        ...(base.data as object),
        marketplace_enabled: null,
        event_class: null,
        layer_mode: null,
        multi_day: null,
      } as ProfileRow);
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
 * Surfaces that RENDER ON the public event site and therefore cannot stand on
 * their own. `day_of` and `gallery` are not independent switches: both are
 * pages of the couple's public event website, and `website` is the surface that
 * makes that site editable and carries the ONLY "go live" control in the
 * product. Enabling either while `website` is off produces a page that is built
 * but can never be opened by a guest — the dead end migration
 * 20271102084500 repaired for `simple_event` after the owner hit it
 * (2026-08-02: "the host of the event cannot launch his on the day website").
 *
 * That migration repaired the rows that already existed. This constant is how
 * the rule is enforced going FORWARD, at the admin save path.
 */
export const SURFACES_THAT_RENDER_ON_THE_WEBSITE: readonly ProfileSurface[] = [
  'day_of',
  'gallery',
];

/**
 * The website-dependent surfaces present in `surfaces` while `website` is NOT.
 * Empty array = the combination is launchable. Works off a raw surface list so
 * the admin editor can validate a FormData selection before anything is saved.
 */
export function surfacesStrandedWithoutWebsite(
  surfaces: readonly string[],
): ProfileSurface[] {
  if (surfaces.includes('website')) return [];
  return SURFACES_THAT_RENDER_ON_THE_WEBSITE.filter((s) => surfaces.includes(s));
}

/** Same rule against a resolved profile — reuses {@link surfaceEnabled}. */
export function profileSurfacesStrandedWithoutWebsite(
  profile: EventTypeProfile,
): ProfileSurface[] {
  if (surfaceEnabled(profile, 'website')) return [];
  return SURFACES_THAT_RENDER_ON_THE_WEBSITE.filter((s) => surfaceEnabled(profile, s));
}

/** Human-readable refusal for the admin editor. Names what to change. */
export function strandedWithoutWebsiteMessage(
  stranded: readonly ProfileSurface[],
): string {
  const names = stranded
    .map((s) => (s === 'day_of' ? 'Day-of page' : 'Gallery'))
    .join(' and ');
  const verb = stranded.length > 1 ? 'both render' : 'renders';
  return (
    `Can't save: ${names} ${verb} on the event's public website, and Website is ` +
    `switched off — the host would have no way to make the page live, so guests ` +
    `could never open it. Tick Website, or untick ${names}.`
  );
}

/**
 * The event's OWN type columns — the one read behind every by-event resolver.
 *
 * 🔴 THIS READ USED TO BE MADE WITH THE COOKIE-SCOPED SESSION CLIENT, AND IT
 * ANSWERED NOTHING FOR A SIGNED-OUT VISITOR. `public.events` has three SELECT
 * policies and ALL THREE are `roles={authenticated}` — measured against
 * production, not read off a migration — so the number of policies admitting
 * `anon` is ZERO. A signed-out read therefore came back empty, `!data` was true,
 * and the resolver fell through to WEDDING_PROFILE.
 *
 * 🚨 THAT IS THE BACK DOOR INTO THE FUNERAL WORK. PR #4793 exists precisely so a
 * wake never speaks in wedding words — solemn register, no countdown, "A gift of
 * sympathy" rather than a money dance. But the mourner who scans the wake's QR
 * arrives SIGNED OUT, on the one surface anonymous mourners actually land on,
 * and every by-event resolver handed them the full celebratory vocabulary: the
 * join door said "the couple", and the wake's role picker offered "Maid of
 * honor", "Ring bearer" and "Veil sponsor". The register the whole stream was
 * built to protect was arriving wrong through the arm nobody was signed in to.
 *
 * ⚠ THE COLUMN GRANT WAS NEVER THE BLOCKER, AND "ADD THE GRANT" IS THE OBVIOUS
 * WRONG FIX. `has_column_privilege('anon','public.events','event_type','SELECT')`
 * is already TRUE — RLS is what refuses the row. This repo's per-column
 * allowlist trap on `events` is real and is a different trap; do not confuse the
 * two.
 *
 * ⚖ SO IT READS WITH THE SERVICE-ROLE CLIENT, AND THAT IS A DELIBERATE WIDENING
 * — say it out loud rather than let a future reader find it. What crosses the
 * boundary is three columns describing what KIND of celebration this is, turned
 * into a noun and a list of role names; no event row, no name, no date, no venue
 * ever leaves. The event's own public page already renders exactly these
 * type-derived words to anonymous visitors (it reads the shell with the admin
 * client and calls `eventWordsFor(event.event_type)`), so nothing is disclosed
 * here that the page beside it does not already say aloud. For the ~13 signed-in
 * dashboard callers the answer is UNCHANGED — they could always read their own
 * event; only the refused-read arm moves.
 *
 * 🔑 ONE READ, NOT TWO. The ceremony columns come back with the type, so the
 * role-set resolver below no longer makes a second (also-refused) round trip.
 */
type EventTypeRow = {
  event_type: string | null;
  ceremony_type: string | null;
  secondary_ceremony_type: string | null;
  celebrant_shape?: string | null;
};

const EVENT_ROW_BASE = 'event_type, ceremony_type, secondary_ceremony_type';

const readEventTypeRow = cache(
  async (eventId: string): Promise<EventTypeRow | null> => {
    try {
      const admin = createAdminClient();
      // 🪤 NAMING A COLUMN THAT DOES NOT EXIST YET MAKES POSTGREST REFUSE THE
      // WHOLE QUERY — and this one read backs the entire guest tree's
      // vocabulary. In the window where this code is deployed and its migration
      // is not, a single select would return no row, `!row` would answer
      // WEDDING_PROFILE, and EVERY celebration of every type would silently
      // become a wedding. That is the exact defect this function was just
      // rewritten to kill, so the new column is asked for in a way that can only
      // cost itself: on error, retry without it and take the type's own shape.
      const full = await admin
        .from('events')
        .select(`${EVENT_ROW_BASE}, celebrant_shape`)
        .eq('event_id', eventId)
        .maybeSingle();
      // ⚠ Supabase RESOLVES with `{ error }`; it does not throw. The catch below
      // cannot see a refused query, which is what makes this branch load-bearing
      // rather than defensive decoration.
      if (!full.error) return (full.data as EventTypeRow | null) ?? null;

      const base = await admin
        .from('events')
        .select(EVENT_ROW_BASE)
        .eq('event_id', eventId)
        .maybeSingle();
      return (base.data as EventTypeRow | null) ?? null;
    } catch {
      return null;
    }
  },
);

/**
 * Server helper: the EventTypeProfile for an event id (fetches its event_type).
 *
 * ⚠ `null` HERE NOW MEANS "NO SUCH EVENT", AND ONLY THAT. The docblock that
 * stood here said "a missing event / read error degrades to WEDDING_PROFILE" —
 * it conflated the two, which is how the defect above came to read as the
 * design rather than as a trap. A refused read was indistinguishable from an
 * event that does not exist, and the fallback quietly made every signed-out
 * celebration a wedding. The read can no longer be refused; a genuinely absent
 * row still degrades to WEDDING_PROFILE, which is the original 0053 contract.
 *
 * Cached per request + per eventId. (Iteration 0053 P2.)
 */
export const resolveProfileByEvent = cache(
  async (eventId: string): Promise<EventTypeProfile> => {
    // THEIRS, kept: one cached ADMIN read, shared with resolveRoleSetKeyForEvent.
    // Mine used the caller's own session and a second query — wrong on both
    // counts here. The docblock above records why: a refused read was
    // indistinguishable from a missing event, and quietly made every
    // signed-out celebration a wedding.
    const row = await readEventTypeRow(eventId);
    if (!row) return WEDDING_PROFILE;
    const profile = await resolveProfile(row.event_type ?? 'wedding');
    // …and this celebration's own celebrant shape, if it set one. NULL — every
    // row today — leaves the event type's default exactly in place.
    return applyEventCelebrantShape(
      profile,
      isCelebrantShape(row.celebrant_shape) ? row.celebrant_shape : null,
    );
  },
);

/** Pure — overlay a per-event shape onto a resolved profile. Exported for the
 *  tests, which is the only way to exercise it without a database. */
export function applyEventCelebrantShape(
  profile: EventTypeProfile,
  shape: CelebrantShape | null,
): EventTypeProfile {
  if (!shape || shape === profile.terminology.celebrantShape) return profile;
  return {
    ...profile,
    terminology: { ...profile.terminology, celebrantShape: shape },
  };
}

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
 *
 * ⚠ IT MADE A SECOND COOKIE-SCOPED READ, WITH THE SAME BLIND SPOT as the profile
 * read above: refused for a signed-out visitor, so the join door's role picker
 * fell back to the Catholic wedding cast on every event it could not see — a
 * wake included. Both halves now come from the ONE service-role read, so a
 * signed-out visitor gets the celebration's real role set.
 */
export const resolveRoleSetKeyForEvent = cache(
  async (eventId: string): Promise<string | null> => {
    const profile = await resolveProfileByEvent(eventId);
    // Only weddings get a ceremony-specific role set; everything else (generic /
    // simple / future types) uses its profile default untouched.
    if (profile.roleSetKey !== 'wedding') return profile.roleSetKey;
    const row = await readEventTypeRow(eventId);
    const primary = row?.ceremony_type ?? null;
    const secondary = row?.secondary_ceremony_type ?? null;
    if (primary === 'muslim' || secondary === 'muslim') return 'wedding_muslim';
    return profile.roleSetKey;
  },
);

/** Server helper: the RoleSet for an event id (iteration 0053 Phase 2). */
export const resolveRoleSetForEvent = cache(
  async (eventId: string): Promise<RoleSet> => {
    return resolveRoleSet(await resolveRoleSetKeyForEvent(eventId));
  },
);
