/**
 * wedding-cards.ts — the APPROVED wedding onboarding, as pure rules (Lane 1).
 *
 * ⚖ Owner 2026-10-01 (DECISION_LOG "APPROVED — WEDDING ONBOARDING (clickable)…";
 * WEDDING_ONBOARDING_HUB_SETUP_EVENT_DETAILS_BUILD_SPEC_2026-10-01, THE MAP):
 * one question per card, every answer lands in the field its Maker place
 * already reads — never a copy, never a setup-only table. This file is the ONE
 * place that says which cards a wedding walks, in which order, and how a
 * card's answer maps onto the fields the shipped wedding commit writes
 * (`commitOnboardingWedding`).
 *
 * Pure and client-safe: the shell imports it, the guards read it, nothing here
 * touches I/O. Cards that the setup engine already draws (`setup-card.tsx`:
 * entry · photo · look) stay the engine's; only the wedding's own questions
 * (names · kind · area · estimate · budget · colours) are listed here.
 */
import type { FaithKey } from '@/lib/faith-registry';
import type { BudgetBand } from '@/lib/budget-bands-shared';

/** The wedding's own cards — the ones the generic engine has no card for. */
export const WEDDING_CARD_IDS = ['w_names', 'w_kind', 'w_area', 'w_pax', 'w_budget', 'w_colours'] as const;
export type WeddingCardId = (typeof WEDDING_CARD_IDS)[number];

/**
 * The engine cards a wedding keeps (its where/guests/more are answered elsewhere on this flow).
 * ⚖ Owner d24 (2026-10-02): sign-up no longer asks "How do guests get in?" — a personal QR for
 * each guest is the default and Event Details changes it, so `setup_entry` is not a card at all.
 */
export const WEDDING_ENGINE_CARDS = ['setup_photo', 'setup_look'] as const;

/**
 * 🧭 THE APPROVED ORDER (prototype A, "1 of 7" … "7 of 7", then the Event Hub
 * look). `date` is the shipped hot-date calendar screen — never redrawn
 * (DECISION_LOG "ONBOARDING'S WHEN IS IT? IS THE SHIPPED HOT-DATE CALENDAR").
 * `account` sits where it always sat: before anything is saved.
 *
 *   A · your wedding: names · kind · date · area · how many · budget
 *   B · your Event Hub: cover photo · theme · colours
 *   C · make it yours: the services step (Pro · Setnayan AI · Papic, one bill)
 */
export const WEDDING_FLOW_ORDER = [
  'w_names',
  'w_kind',
  'date',
  'w_area',
  'w_pax',
  'w_budget',
  'account',
  'setup_photo',
  'setup_look',
  'w_colours',
  'services_step',
  'congrats',
] as const;

/**
 * The wedding's screen list. `engineCards` is what the engine resolved for the
 * wedding (`resolveSetupSteps`) — a card the engine did not resolve is not
 * drawn, so the profile stays the one authority over which cards exist.
 */
export function weddingFlowScreens(input: {
  engineCards: readonly string[];
  /** Signed-in (or anon-draft): no account gate. */
  skipAccount: boolean;
  /** The services step is flag-gated and dropped from the store shells. */
  services: boolean;
}): string[] {
  return WEDDING_FLOW_ORDER.filter((id) => {
    if (id === 'account') return !input.skipAccount;
    if (id === 'services_step') return input.services;
    if ((WEDDING_ENGINE_CARDS as readonly string[]).includes(id)) return input.engineCards.includes(id);
    return true;
  });
}

/** A wedding card's place in the flow, for "n of N" — counted over the question cards only. */
export const WEDDING_QUESTION_SCREENS: ReadonlySet<string> = new Set([
  ...WEDDING_CARD_IDS,
  'date',
  ...WEDDING_ENGINE_CARDS,
]);

// ── 2 · what kind of wedding? ──────────────────────────────────────────────

export type CeremonyChoice = 'church' | 'civil' | 'nikah' | 'garden' | 'undecided';
export const CEREMONY_CHOICES: readonly CeremonyChoice[] = ['church', 'civil', 'nikah', 'garden', 'undecided'];

/** The Christian churches the "Church wedding" row offers a second dropdown for. */
export const CHURCH_FAITHS: readonly FaithKey[] = [
  'catholic',
  'christian',
  'inc',
  'born_again',
  'aglipayan',
  'lds',
  'sda',
  'jw',
  'orthodox',
];

/**
 * What each answer writes. They are the SAME columns the shipped commit writes
 * (`ceremony_type` · `ceremony_sub_type` · `is_mixed_ceremony`), through the
 * wizard's own `kind` + `faith`:
 *   · church    → a faith ceremony in the chosen church (Catholic until picked)
 *   · civil     → civil
 *   · nikah     → the muslim ceremony (its sub-type defaults in the commit)
 *   · garden    → `cultural` / sub-type `other` — the registry's non-church faith slot
 *   · undecided → the DB's own "not picked yet" convention: `ceremony_type` keeps
 *                 its default and `ceremony_type_locked_at` stays NULL (migration
 *                 20260603000000), so the host can still confirm it later.
 */
export function ceremonyChoiceToState(
  choice: CeremonyChoice,
  church: FaithKey = 'catholic',
): { kind: 'religious' | 'civil'; faith: FaithKey[]; ceremonyUndecided: boolean } {
  switch (choice) {
    case 'church':
      return { kind: 'religious', faith: [(CHURCH_FAITHS as readonly string[]).includes(church) ? church : 'catholic'], ceremonyUndecided: false };
    case 'civil':
      return { kind: 'civil', faith: [], ceremonyUndecided: false };
    case 'nikah':
      return { kind: 'religious', faith: ['muslim'], ceremonyUndecided: false };
    case 'garden':
      return { kind: 'religious', faith: ['cultural'], ceremonyUndecided: false };
    case 'undecided':
      return { kind: 'religious', faith: ['catholic'], ceremonyUndecided: true };
  }
}

/** Which row the wizard's state reads as — null until a pick was made. */
export function ceremonyChoiceOf(s: {
  kind: 'religious' | 'civil' | 'mixed' | null;
  faith: readonly string[];
  ceremonyUndecided: boolean;
}): CeremonyChoice | null {
  if (s.ceremonyUndecided) return 'undecided';
  if (s.kind === 'civil') return 'civil';
  if (s.kind !== 'religious') return null;
  const f = s.faith[0];
  if (!f) return null;
  if (f === 'muslim') return 'nikah';
  if (f === 'cultural') return 'garden';
  return (CHURCH_FAITHS as readonly string[]).includes(f) ? 'church' : null;
}

// ── 6 · about how many guests? ─────────────────────────────────────────────

/** DECISION_LOG 2026-10-01 "THE ONBOARDING GUEST ESTIMATE GOES FROM 10 TO 500, IN STEPS OF 10". */
export const ESTIMATE_MIN = 10;
export const ESTIMATE_MAX = 500;
export const ESTIMATE_STEP = 10;
/** Where − / + starts: the drawn value ("About how many guests? − [150] +"). */
export const ESTIMATE_START = 150;

/** The estimate nearest to `n` on the 10–500 ladder (a resumed draft may carry any number). */
export function snapEstimate(n: number | null | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return ESTIMATE_START;
  const snapped = Math.round(n / ESTIMATE_STEP) * ESTIMATE_STEP;
  return Math.min(ESTIMATE_MAX, Math.max(ESTIMATE_MIN, snapped));
}

/** One − / + press: stays on the ladder, stops at both ends (never wraps). */
export function stepEstimate(n: number | null | undefined, dir: 1 | -1): number {
  return snapEstimate(snapEstimate(n) + dir * ESTIMATE_STEP);
}

// ── 7 · about how much is your budget? ────────────────────────────────────

export type BudgetRow = { value: string; label: string; tag: string; pesos: number | null };

/**
 * The budget card's rows: every `budget_band_config` band, "about ₱X for your N
 * guests" = per-head median × the estimate. `no_limit` has no figure.
 *
 * 💰 BUDGET IS FOR TRACKING, NEVER FOR LIMITING (DECISION_LOG 2026-10-01): every
 * band is always offered; nothing here ever hides or narrows a choice by price.
 */
export function budgetRows(bands: readonly BudgetBand[], guests: number): BudgetRow[] {
  const n = snapEstimate(guests);
  return bands.map((b) => ({
    value: b.value,
    label: b.label,
    tag: b.tag,
    pesos: b.value === 'no_limit' || b.med <= 0 ? null : b.med * n,
  }));
}

/** The band pre-selected when the card opens ("Classic · The sweet spot"). */
export const BUDGET_DEFAULT_BAND = 'classic';
