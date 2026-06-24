/**
 * Iteration 0053 Phase 3 (PR3) — derive a STARTER PLAN for the generic onboarding
 * flow from the event type's applicable taxonomy categories (the tier-2 chips from
 * getOnboardingTiles, already ordered by the taxonomy sort_order and scoped to the
 * type via service_categories.applicable_event_types). Scaled by the experience-
 * quiz `effort` axis. Pure + deterministic so it is unit-testable.
 *
 * The persona name + feel (generic-content.ts) personalize the reveal; this sizes
 * + lists the team. No hand-authored per-type lists — the taxonomy is the data.
 */
import type { OnboardingPickChip } from '@/lib/onboarding-refinements';

/** effort axis → how many categories to line up. */
const EFFORT_LIMIT: Record<string, number> = { simple: 4, balanced: 6, allout: 9 };
const DEFAULT_LIMIT = 6;

export type GenericPlan = {
  /** Category ids (service_categories.id) → events.style_preferences.interested_categories. */
  picks: string[];
  /** Human labels for the reveal screen, in the same order as picks. */
  labels: string[];
};

export function deriveGenericPlan(
  chips: readonly OnboardingPickChip[],
  effort: string | null | undefined,
): GenericPlan {
  const limit = (effort && EFFORT_LIMIT[effort]) || DEFAULT_LIMIT;
  const top = chips.slice(0, Math.max(0, limit));
  return { picks: top.map((c) => c.cat), labels: top.map((c) => c.label) };
}
