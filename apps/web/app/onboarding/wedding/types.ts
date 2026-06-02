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

  // -- Phase 2 fields (screens 4-8: name · date · region · pax · budget) --

  /** Bride first name (screen 4). Maps to events.bride_name. */
  brideName: string;
  /** Groom first name (screen 4). Maps to events.groom_name. */
  groomName: string;
  /** Monogram frame index into MONO_FRAMES (screen 4 · free styling). */
  monogramFrame: number;
  /** Monogram font index into MONO_FONTS (screen 4). */
  monogramFont: number;

  /**
   * Wedding-date capture mode (screen 5). 'specific' = 1-4 candidate dates within
   * a 90-day cluster; 'window' = a flexible range ≤30 days inclusive. The final
   * events.event_date settles later on vendor availability. Maps to events.date_mode.
   */
  dateMode: 'specific' | 'window';
  /** Specific-mode candidate dates, ISO yyyy-mm-dd, sorted asc (≤4). Maps to events.date_candidates. */
  dateCandidates: string[];
  /** Flexible-window start, ISO yyyy-mm-dd (null in specific mode). Maps to events.date_window_start. */
  windowStart: string | null;
  /** Flexible-window end, ISO yyyy-mm-dd (null until the end is picked). Maps to events.date_window_end. */
  windowEnd: string | null;

  /** Region key (screen 6) — area match for vendor coverage. Maps to events.region. */
  region: string | null;

  /** Exact guest count (screen 7) — may be <50 or >500. Maps to events.estimated_pax. */
  pax: number | null;

  /**
   * Working-budget feel band (screen 8) — essentials/simple/classic/elevated/premium/
   * luxury/nolimit. Maps to events.budget_band. Couple-side compass, NOT a Setnayan SKU price.
   */
  budgetBand: string | null;

  /** ISO timestamp of last save — for debugging stale drafts. */
  lastSavedAt: string;
}

/**
 * Progress-bar denominator. The bar reflects the FULL eventual 15-screen flow
 * (Blueprint §3.1a) — not just the screens shipped this phase — so it doesn't
 * read "complete" at the Phase-1 boundary. Phase 1 renders 4 of these 15.
 */
export const FLOW_TOTAL = 15;

/** Localstorage key for the in-flight draft. Single namespace per browser. */
export const ONBOARDING_DRAFT_KEY = 'setnayan_onboarding_wedding_draft_v1';

/** localStorage TTL: drafts older than this (in days) are auto-cleared on load. */
export const ONBOARDING_DRAFT_TTL_DAYS = 30;

export const EMPTY_ONBOARDING_STATE: OnboardingState = {
  step: 0,
  role: null,
  kind: null,
  faith: [],
  brideName: 'Maria',
  groomName: 'Juan',
  monogramFrame: 0,
  monogramFont: 0,
  dateMode: 'specific',
  dateCandidates: [],
  windowStart: null,
  windowEnd: null,
  region: 'ncr',
  pax: 150,
  budgetBand: 'classic',
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
  'faith',    // 3  (skipped when kind=civil — shell go() logic)
  'name',     // 4
  'date',     // 5
  'region',   // 6
  'pax',      // 7
  'budget',   // 8
  // 9-14 land in Phase 3-4 (picker · style · find-vendor · bundle · congrats · plan)
] as const;

export type ScreenId = (typeof SCREEN_SEQUENCE)[number];
