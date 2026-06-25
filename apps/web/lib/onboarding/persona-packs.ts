/**
 * Iteration 0053 Phase 3 (follow-up) — PER-TYPE persona packs for the generic
 * (non-wedding) onboarding flow.
 *
 * The wedding wizard derives a RICH plan per persona (EXP_ESSENTIAL_PICKS +
 * persona `extras`, effort-scaled — see experience-personas.ts). PR3's generic
 * flow flattened that to a single taxonomy-top-N list (`deriveGenericPlan`), so
 * every persona — and every event type — got the SAME categories in wedding-shaped
 * sort order (a birthday led with "Reception · Ceremony · Coordinator · Cake…").
 *
 * This module restores per-persona richness, scoped per event type, as PURE DATA
 * keyed by the profile's `personaPackKey` (= `event_type_profiles.onboarding_flow_key`,
 * which is the event-type key for every seeded non-wedding profile). A pack lists
 * the type's lead `essentials` plus per-persona `extras`; `derivePackPlan` orders
 * essentials → persona extras → the rest of the taxonomy, INTERSECTED against the
 * type's real `tiles` (so a category that isn't applicable/active for the type is
 * never surfaced), then sizes the list by the effort axis.
 *
 * Safety / degradation: a packKey with no pack (e.g. 'generic', or a type enabled
 * before its pack is authored) falls straight back to `deriveGenericPlan` — the
 * exact PR3 behaviour. Category ids are `service_categories.id` slugs (the same id
 * space as `OnboardingPickChip.cat`), so picks stay consistent with PR3's
 * `interested_categories` write. No I/O — unit-testable + deterministic.
 *
 * Wedding never routes through the generic flow, so this module is non-wedding only.
 */
import type { OnboardingPickChip } from '@/lib/onboarding-refinements';
import { deriveGenericPlan, effortLimit, type GenericPlan } from './generic-plan';

/** Persona keys — must match `EXP_PERSONAS` in experience-personas.ts. */
type PersonaKey =
  | 'keepsake'
  | 'big_celebration'
  | 'best_of_both'
  | 'intimate_romance'
  | 'modern_statement'
  | 'rooted_tradition';

export type TypePersonaPack = {
  /** Lead categories for this event type, regardless of persona (priority order). */
  essentials: readonly string[];
  /** Per-persona EXTRA categories, beyond the essentials (priority order). */
  byPersona: Record<PersonaKey, readonly string[]>;
};

/**
 * Per-event-type packs, keyed by `personaPackKey`. All ids are taxonomy slugs; an
 * id that isn't applicable to a given type is harmlessly dropped by the intersect
 * in `derivePackPlan`, so packs can be authored generously.
 */
export const PERSONA_PACKS: Record<string, TypePersonaPack> = {
  birthday: {
    essentials: ['cake', 'catering', 'host_mc', 'photo_booth'],
    byPersona: {
      keepsake: ['photo_video', 'editorial', 'stylist_decorator', 'dessert'],
      big_celebration: ['dj', 'live_band', 'dance_floor', 'mobile_bar', 'lights_sound'],
      best_of_both: ['photo_video', 'dj', 'stylist_decorator', 'mobile_bar'],
      intimate_romance: ['stylist_decorator', 'florist', 'dessert', 'coffee_espresso'],
      modern_statement: ['led_wall', 'dj', 'photo_video', 'lights_sound'],
      rooted_tradition: ['live_band', 'food_cart', 'souvenir_giveaways', 'stylist_decorator'],
    },
  },
  debut: {
    essentials: ['reception', 'catering', 'host_mc', 'photo_video'],
    byPersona: {
      keepsake: ['editorial', 'hmua', 'stylist_decorator', 'florist'],
      big_celebration: ['dj', 'live_band', 'lights_sound', 'dance_floor', 'photo_booth'],
      best_of_both: ['stylist_decorator', 'dj', 'photo_booth', 'hmua'],
      intimate_romance: ['stylist_decorator', 'florist', 'hmua', 'dessert'],
      modern_statement: ['led_wall', 'lights_sound', 'choreographer', 'stylist_decorator'],
      rooted_tradition: ['choir', 'filipiniana_barongs', 'performers', 'stylist_decorator'],
    },
  },
  gender_reveal: {
    essentials: ['cake', 'catering', 'stylist_decorator', 'photo_booth'],
    byPersona: {
      keepsake: ['photo_video', 'editorial', 'dessert'],
      big_celebration: ['host_mc', 'mobile_bar', 'fireworks', 'dessert'],
      best_of_both: ['photo_video', 'host_mc', 'dessert'],
      intimate_romance: ['florist', 'dessert', 'coffee_espresso'],
      modern_statement: ['led_wall', 'fireworks', 'photo_video'],
      rooted_tradition: ['food_cart', 'souvenir_giveaways', 'photo_video'],
    },
  },
  christening: {
    essentials: ['ceremony_venue', 'catering', 'cake', 'photo_video'],
    byPersona: {
      keepsake: ['editorial', 'stylist_decorator', 'florist'],
      big_celebration: ['host_mc', 'live_band', 'mobile_bar', 'dessert'],
      best_of_both: ['host_mc', 'stylist_decorator', 'photo_booth'],
      intimate_romance: ['florist', 'choir', 'coffee_espresso'],
      modern_statement: ['stylist_decorator', 'led_wall', 'host_mc'],
      rooted_tradition: ['choir', 'filipiniana_barongs', 'souvenir_giveaways'],
    },
  },
  corporate: {
    essentials: ['catering', 'host_mc', 'lights_sound', 'photo_video'],
    byPersona: {
      keepsake: ['editorial', 'livestream', 'photo_booth'],
      big_celebration: ['dj', 'live_band', 'performers', 'mobile_bar', 'led_wall'],
      best_of_both: ['livestream', 'photo_booth', 'trophies_awards', 'led_wall'],
      intimate_romance: ['coffee_espresso', 'dessert', 'reception'],
      modern_statement: ['led_wall', 'livestream', 'digital_services'],
      rooted_tradition: ['performers', 'food_cart', 'trophies_awards'],
    },
  },
  tournament: {
    essentials: ['trophies_awards', 'catering', 'host_mc', 'photo_video'],
    byPersona: {
      keepsake: ['editorial', 'livestream', 'photo_booth'],
      big_celebration: ['performers', 'led_wall', 'livestream', 'mobile_bar', 'lights_sound'],
      best_of_both: ['host_mc', 'livestream', 'photo_booth', 'lights_sound'],
      intimate_romance: ['food_truck', 'coffee_espresso', 'catering'],
      modern_statement: ['led_wall', 'livestream', 'digital_services'],
      rooted_tradition: ['food_cart', 'souvenir_giveaways', 'performers'],
    },
  },
  travel: {
    essentials: ['coordinator', 'photo_video', 'guest_shuttle', 'digital_services'],
    byPersona: {
      keepsake: ['editorial', 'photo_booth'],
      big_celebration: ['host_mc', 'photo_booth', 'catering'],
      best_of_both: ['host_mc', 'editorial', 'catering'],
      intimate_romance: ['editorial', 'coffee_espresso'],
      modern_statement: ['digital_services', 'editorial', 'livestream'],
      rooted_tradition: ['souvenir_giveaways', 'food_cart'],
    },
  },
  celebration: {
    essentials: ['catering', 'host_mc', 'cake', 'photo_video'],
    byPersona: {
      keepsake: ['editorial', 'stylist_decorator', 'photo_booth'],
      big_celebration: ['dj', 'live_band', 'dance_floor', 'mobile_bar', 'lights_sound'],
      best_of_both: ['dj', 'stylist_decorator', 'photo_booth', 'mobile_bar'],
      intimate_romance: ['stylist_decorator', 'florist', 'dessert', 'coffee_espresso'],
      modern_statement: ['led_wall', 'dj', 'lights_sound', 'stylist_decorator'],
      rooted_tradition: ['live_band', 'food_cart', 'souvenir_giveaways', 'stylist_decorator'],
    },
  },
};

function isPersonaKey(k: string | null | undefined): k is PersonaKey {
  return (
    k === 'keepsake' ||
    k === 'big_celebration' ||
    k === 'best_of_both' ||
    k === 'intimate_romance' ||
    k === 'modern_statement' ||
    k === 'rooted_tradition'
  );
}

/**
 * Derive the starter plan for the generic flow, persona- AND type-aware.
 *
 * - No pack for `packKey` → fall back to `deriveGenericPlan` (PR3 behaviour).
 * - Otherwise order = essentials → persona extras (if the persona is known) → the
 *   rest of the taxonomy in `tiles` order; dedupe; KEEP ONLY ids that exist in
 *   `tiles` (drops categories not applicable/active for the type); size by effort.
 *
 * Pure + deterministic. `picks` are taxonomy ids; `labels` align 1:1.
 */
export function derivePackPlan(
  packKey: string | null | undefined,
  personaKey: string | null | undefined,
  tiles: readonly OnboardingPickChip[],
  effort: string | null | undefined,
): GenericPlan {
  const pack = packKey ? PERSONA_PACKS[packKey] : undefined;
  if (!pack) return deriveGenericPlan(tiles, effort);

  const byId = new Map(tiles.map((t) => [t.cat, t] as const));
  const taxonomyOrder = tiles.map((t) => t.cat);
  const extras = isPersonaKey(personaKey) ? pack.byPersona[personaKey] : [];

  const limit = effortLimit(effort);
  const picks: string[] = [];
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const id of [...pack.essentials, ...extras, ...taxonomyOrder]) {
    if (picks.length >= limit) break;
    if (seen.has(id)) continue;
    const tile = byId.get(id);
    if (!tile) continue; // not applicable/active for this type — skip
    seen.add(id);
    picks.push(id);
    labels.push(tile.label);
  }

  return { picks, labels };
}
