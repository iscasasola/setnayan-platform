/**
 * /onboarding/wedding — V2 wedding-onboarding state types.
 *
 * Iteration 0016 V2 · Phase 1 of 5 (CLAUDE.md 2026-06-02 production-port row).
 * Spec: Onboarding_Wedding_Flow_2026-06-01.html (the locked /proto prototype).
 *
 * Architecture: state lives in the client (Onboarding shell + localStorage
 * resume) for screens 1-12 — no DB writes until screen 13 (account-or-skip
 * gate) commits the events row in one shot. This is the locked invest-then-gate
 * model from the prototype + the Blueprint §3.1a sequence.
 *
 * Phase 1 ships screens 1-4 + the shell. Later phases extend OnboardingState
 * with more fields without breaking the shape:
 *   Phase 2 — names · date · region · pax · budget
 *   Phase 3 — picker · style preferences (per-category)
 *   Phase 4 — find-vendor + account-or-skip + Your Plan commit
 */

/** Role on the event — Bride / Groom / Someone helping (parent/planner/entourage). */
export type OnboardingRole = 'bride' | 'groom' | 'helper';

/** Kind of wedding — Religious (faith ceremony) / Civil (judge/registrar) / Mixed (interfaith). */
export type OnboardingKind = 'religious' | 'civil' | 'mixed';

/**
 * Faith / tradition — maps to events.ceremony_type (single value when kind=religious)
 * + events.secondary_ceremony_type (when kind=mixed, up to 2 picks).
 * V1.x active: catholic + civil; INC/Christian/Muslim/Cultural ship as Coming Soon
 * with notify-me signup (per iteration 0043 · wedding_type_launch_status).
 */
export type OnboardingFaith =
  | 'catholic'
  | 'christian'
  | 'inc'
  | 'muslim'
  | 'cultural';

/** Current screen index — 0-based into the SCREEN_SEQUENCE array. */
export type OnboardingStep = number;

/**
 * Full onboarding state — accumulates across screens, persisted to localStorage,
 * committed to events + event_moderators + event_vendor_preferences at screen 13.
 *
 * Every field is nullable / empty-default — Phase 1 only writes role/kind/faith;
 * later phases extend without renaming.
 */
export interface OnboardingState {
  /** Current screen index (0..N). 0 = Welcome. */
  step: OnboardingStep;

  /** The signing user's role on this event (Bride/Groom/Helper). Screen 2. */
  role: OnboardingRole | null;

  /** Kind of wedding (Religious/Civil/Mixed). Screen 3. */
  kind: OnboardingKind | null;

  /**
   * Faith picks — single-element array for kind=religious, up to 2 for kind=mixed,
   * empty for kind=civil. Maps to events.ceremony_type (first element) +
   * events.secondary_ceremony_type (second, when present). Screen 4.
   */
  faith: OnboardingFaith[];

  // -- Phase 2+ fields (declared here for state-shape stability; not written yet)
  brideName: string;
  groomName: string;

  /** ISO timestamp of last save — for debugging stale drafts. */
  lastSavedAt: string;
}

/** Localstorage key for the in-flight draft. Single namespace per browser. */
export const ONBOARDING_DRAFT_KEY = 'setnayan_onboarding_wedding_draft_v1';

/** localStorage TTL: drafts older than this (in days) are auto-cleared on load. */
export const ONBOARDING_DRAFT_TTL_DAYS = 30;

export const EMPTY_ONBOARDING_STATE: OnboardingState = {
  step: 0,
  role: null,
  kind: null,
  faith: [],
  brideName: '',
  groomName: '',
  lastSavedAt: '',
};

/**
 * Canonical screen sequence. Phase 1 ships screens 0-3 (welcome/role/kind/faith).
 * Later phases extend this list — the shell renders by index, so adding screens
 * in the middle requires a coordinated update of step transitions.
 *
 * Faith (index 3) is SKIPPED when kind=civil — handled in shell goNext() logic.
 */
export const SCREEN_SEQUENCE = [
  'welcome',  // 0
  'role',     // 1
  'kind',     // 2
  'faith',    // 3
  // 4-14 land in Phase 2-4
] as const;

export type ScreenId = (typeof SCREEN_SEQUENCE)[number];
