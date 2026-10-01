/**
 * Iteration 0053 Phase 3 — the engine seam for the generic (non-wedding)
 * onboarding flow. Pure, no I/O. Given an event-type profile it returns the
 * ordered screen manifest + which persona/plan data pack to feed the deterministic
 * resolver. PR2 renders these screens; PR3 swaps per-type persona packs by key.
 *
 * Wedding keeps its OWN dedicated wizard at `/onboarding/wedding` and never routes
 * through here — this manifest is for the lean generic flow only.
 */
import type { EventTypeProfile, ProfileSetup } from '@/lib/event-type-profile';
import { SETUP_CARD_IDS, type SetupCardId, type SetupView } from './setup-answers';

/**
 * Ordered screen ids for the generic onboarding flow. The 5 `EXP_AXES` (the
 * experience quiz) are event-AGNOSTIC, so they carry over unchanged; wedding-only
 * screens (kind/faith, monogram, the love-story arc) are intentionally absent.
 */
export const GENERIC_ONBOARDING_SCREENS = [
  'welcome',
  'name',
  'date',
  'pax',
  'region',
  'exp_for_whom',
  'exp_feel',
  'exp_energy',
  'exp_roots',
  'exp_effort',
  'plan',
  'congrats',
] as const;

export type OnboardingScreenId = (typeof GENERIC_ONBOARDING_SCREENS)[number];

export type OnboardingFlow = {
  /** The profile's `onboarding_flow_key`, or 'generic' when unset. */
  flowKey: string;
  /** Which persona/plan data pack to feed the resolver. PR3 keys packs per type; 'generic' is the default. */
  personaPackKey: string;
  /** Ordered screen ids the flow renders. */
  screens: OnboardingScreenId[];
  /** The event type this flow commits (→ `commitOnboardingEvent`). */
  eventType: string;
};

/**
 * Resolve the generic onboarding flow for an event-type profile. Pure. The
 * persona pack defaults to the profile's `onboardingFlowKey` (PR3 registers
 * per-type packs under that key); a profile with no flow key falls back to
 * 'generic' — the shared default pack.
 */
export function resolveOnboardingFlow(profile: EventTypeProfile): OnboardingFlow {
  const flowKey = profile.onboardingFlowKey ?? 'generic';
  return {
    flowKey,
    /**
     * 🔑 THE PACK KEY FALLS BACK TO THE EVENT TYPE, NOT TO `flowKey`.
     *
     * Every seeded profile sets `onboarding_flow_key` to its own event type, so
     * for sixteen types these are the same string and nothing changes. The
     * seventeenth — the funeral, added 2026-08-24 — shipped with the column
     * NULL, so it resolved to 'generic': its own questions and its own starter
     * plan were unreachable no matter what was authored for it, while
     * /admin/event-types/[type]/onboarding (which already falls back to the
     * event type) showed HQ the pack the visitor was not being given. Two
     * answers to one question; this is the one the admin screen already used.
     *
     * Inert for a type with no pack authored: PER_TYPE_QUESTIONS / PERSONA_PACKS
     * have no 'generic' key either, so both resolve to the same empty defaults.
     */
    personaPackKey: profile.onboardingFlowKey ?? profile.eventType,
    screens: [...GENERIC_ONBOARDING_SCREENS],
    eventType: profile.eventType,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// THE SETUP ENGINE (G1 · owner 2026-09-30 / 2026-10-01)
// ═══════════════════════════════════════════════════════════════════════════
//
// DECISION_LOG "THE SETUP LIVES AT THE END OF CREATING THE EVENT…", "APPROVED —
// THE EVENT ONBOARDING CONCEPT", "THE ONBOARDING PHONE DESIGN — APPROVED":
// ONE engine at the end of creating an event — the seven shared essentials
// (name · when · where · photo · look · how guests get in · guests) + 0–2 type
// steps (the shipped honoree / anchor / recurs / specialty screens) + one
// Yes/No list. The PROFILE decides which cards appear; this file is the one
// place that turns a profile into the card list. Never a second registry.

/** The seven shared essentials, in the approved order. */
export const SETUP_ESSENTIALS = ['name', 'when', 'where', 'photo', 'look', 'entry', 'guests'] as const;
export type SetupEssential = (typeof SETUP_ESSENTIALS)[number];

/** Which card draws each essential. name/when have none: every creation flow asks them first. */
const ESSENTIAL_CARD: Record<SetupEssential, SetupCardId | null> = {
  name: null,
  when: null,
  where: 'setup_where',
  photo: 'setup_photo',
  look: 'setup_look',
  entry: 'setup_entry',
  guests: 'setup_guests',
};

/**
 * 🔁 NEVER ASK TWICE (INTERACTION_RULES § 1). What each creation flow already
 * collected before the engine starts — the engine drops these. A creation flow
 * that starts asking an essential adds it HERE, and the guard in
 * flow-config.test.ts then proves the engine stops asking it.
 */
export const CREATION_ASKS = {
  /** /onboarding/[type] — the name screen and the date calendar. */
  generic: ['name', 'when'],
  /** /onboarding/simple — one form: name + date. */
  simple: ['name', 'when'],
  /** /onboarding/wedding — the couple's names and the date. */
  wedding: ['name', 'when'],
} as const satisfies Record<string, readonly SetupEssential[]>;
export type CreationFlow = keyof typeof CREATION_ASKS;

/**
 * Where the wedding shell slots the engine's cards: after everything it asks
 * today, right before its services step (and so before congrats). The shell
 * reads THIS, never its own copy.
 */
export const WEDDING_SETUP_INSERT_BEFORE = 'services_step' as const;

/**
 * 🎟 "Will guests reply?" — the default answer by type (DECISION_LOG "THE RSVP
 * IS OPTIONAL…": reply Yes for wedding / debut / gala / corporate; No + one QR
 * for hangout / date / get-together / simple events; owner answer #5 2026-10-01:
 * birthdays default to the easiest, No · One QR; answer #4: a wake is No · One
 * QR). The formal types are named by the decision row itself, so they are
 * listed by key here rather than guessed from a proxy trait.
 */
const REPLY_YES_BY_DEFAULT: ReadonlySet<string> = new Set(['wedding', 'debut', 'gala_night', 'corporate']);

/**
 * The profile → everything the cards need. `pickable` is the theme picker's
 * own list for this type — `pickableInviteThemes({ mayShowStdFilm })`, the
 * wedding fence the Details picker already asks — handed in so this module
 * stays free of the theme catalogue: a Pro look is listed (◆, never blocking —
 * Apply asks) only where the type may wear it at all. Server-side caller:
 * `lib/onboarding/setup-view.ts`.
 */
export function setupViewFor(
  profile: EventTypeProfile,
  setup: ProfileSetup,
  pickable: ReadonlyArray<{ id: string; name: string; tier: 'free' | 'pro' }>,
): SetupView {
  const solemn = profile.terminology.register === 'solemn';
  const own = setup.lookSet.filter((id) => pickable.some((t) => t.id === id));
  const ordered = [
    ...own.map((id) => pickable.find((t) => t.id === id)!),
    // A solemn type sees its quiet set only — no "more looks" (frame K5).
    ...(solemn ? [] : pickable.filter((t) => !own.includes(t.id))),
  ];
  const looks = (ordered.length > 0 ? ordered : pickable.filter((t) => t.tier === 'free')).map((t) => ({
    id: t.id,
    name: t.name,
    pro: t.tier === 'pro',
    own: own.includes(t.id),
  }));
  const isWedding = profile.roleSetKey === 'wedding';
  return {
    eventType: profile.eventType,
    solemn,
    guestWord: setup.guestWord,
    giftsMode: setup.giftsMode,
    cameraDefault: setup.cameraDefault,
    looks,
    replyDefault: REPLY_YES_BY_DEFAULT.has(profile.eventType) ? 'yes' : 'no',
    // A wake runs on one QR for everyone — the guest list is optional, so it is
    // not a card (owner answer #4, 2026-10-01).
    guestList: !solemn,
    // The logo row: a seated, supplier-planned celebration sends invitations a
    // logo belongs on. Not a get-together without a seat plan (hangout · date),
    // not a vendor-free one (simple_event), never a wake (matrix M, table B).
    logoRow: !solemn && profile.marketplaceEnabled && profile.enabledSurfaces.includes('seating'),
    skin: solemn ? 'quiet' : isWedding ? 'wedding' : profile.marketplaceEnabled && profile.enabledSurfaces.includes('seating') ? 'party' : 'casual',
  };
}

/**
 * The engine's cards for a type, after what creation already asked. Pure — the
 * exact list per type is pinned in flow-config.test.ts.
 */
export function resolveSetupSteps(view: SetupView, asked: readonly SetupEssential[]): SetupCardId[] {
  const cards: SetupCardId[] = [];
  for (const essential of SETUP_ESSENTIALS) {
    if (asked.includes(essential)) continue;
    const card = ESSENTIAL_CARD[essential];
    if (!card) continue;
    if (card === 'setup_guests' && !view.guestList) continue;
    cards.push(card);
  }
  cards.push('setup_more');
  // Keep the engine's own order whatever the essentials list says.
  return SETUP_CARD_IDS.filter((c) => cards.includes(c));
}

/**
 * The generic wizard's whole screen list — ONE source for the component and
 * for the per-type tests. With the engine on, the long quiz (pax · region ·
 * the per-type plan questions · the five axes · the persona reveal) has left
 * onboarding for Setnayan AI's first session (approved concept, point 1);
 * without it (a type its seed has not admitted yet) the list is yesterday's.
 */
export function genericFlowScreens(input: {
  engine: boolean;
  asksHonoree: boolean;
  isAnniversary: boolean;
  showRecurToggle: boolean;
  typeQuestionIds: readonly string[];
  hasSpecialty: boolean;
  axisIds: readonly string[];
  services: boolean;
  setupSteps: readonly SetupCardId[];
}): string[] {
  const typeSteps = [
    ...(input.asksHonoree ? ['honoree'] : []),
    ...(input.isAnniversary ? ['anchor'] : []),
  ];
  if (input.engine) {
    return [
      'welcome',
      'name',
      ...typeSteps,
      'date',
      ...(input.showRecurToggle ? ['recurs'] : []),
      ...(input.hasSpecialty ? ['specialty'] : []),
      ...input.setupSteps,
      ...(input.services ? ['services'] : []),
      'congrats',
    ];
  }
  return [
    'welcome',
    'name',
    ...typeSteps,
    'date',
    ...(input.showRecurToggle ? ['recurs'] : []),
    'pax',
    'region',
    ...input.typeQuestionIds.map((id) => `tq_${id}`),
    ...(input.hasSpecialty ? ['specialty'] : []),
    ...input.axisIds,
    'reveal',
    ...(input.services ? ['services'] : []),
    'congrats',
  ];
}
