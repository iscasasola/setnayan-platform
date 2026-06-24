/**
 * Iteration 0053 Phase 3 — the engine seam for the generic (non-wedding)
 * onboarding flow. Pure, no I/O. Given an event-type profile it returns the
 * ordered screen manifest + which persona/plan data pack to feed the deterministic
 * resolver. PR2 renders these screens; PR3 swaps per-type persona packs by key.
 *
 * Wedding keeps its OWN dedicated wizard at `/onboarding/wedding` and never routes
 * through here — this manifest is for the lean generic flow only.
 */
import type { EventTypeProfile } from '@/lib/event-type-profile';

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
    personaPackKey: flowKey,
    screens: [...GENERIC_ONBOARDING_SCREENS],
    eventType: profile.eventType,
  };
}
