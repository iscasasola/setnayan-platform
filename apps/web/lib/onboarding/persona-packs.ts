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
import { INAPP_TO_SERVICE_CODE } from '@/app/onboarding/wedding/_components/onboarding-pricing';
import { deriveGenericPlan, effortLimit, type GenericPlan } from './generic-plan';

/** Persona keys — must match `EXP_PERSONAS` in experience-personas.ts. */
type PersonaKey =
  | 'keepsake'
  | 'big_celebration'
  | 'best_of_both'
  | 'intimate_romance'
  | 'modern_statement'
  | 'rooted_tradition';

/**
 * The canonical valid in-app service-key registry. `INAPP_TO_SERVICE_CODE`
 * (onboarding-pricing.ts) is the single source of truth — its keys are the SAME
 * keys the wedding wizard writes to `style_preferences.interested_services` and
 * the ones `INAPP_KEYS` (onboarding-shell.tsx) offers. Authoring a service id
 * outside this set is a programming error; `derivePackServices` intersects every
 * pack against it so a retired SKU (e.g. indoor_blueprint, removed 2026-06-08) can
 * never leak into a write. Exported for the test's only-valid-keys invariant.
 */
export const VALID_SERVICE_KEYS: ReadonlySet<string> = new Set(Object.keys(INAPP_TO_SERVICE_CODE));

export type TypePersonaPack = {
  /** Lead categories for this event type, regardless of persona (priority order). */
  essentials: readonly string[];
  /** Per-persona EXTRA categories, beyond the essentials (priority order). */
  byPersona: Record<PersonaKey, readonly string[]>;
  /**
   * Per-persona in-app Setnayan SERVICES to pre-surface (priority order). Keys MUST
   * be in `VALID_SERVICE_KEYS` (= INAPP_TO_SERVICE_CODE); any stray id is dropped by
   * `derivePackServices`. Mirrors the wedding wizard's persona `services` dimension
   * (experience-personas.ts), scoped + re-weighted per event type.
   */
  servicesByPersona: Record<PersonaKey, readonly string[]>;
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
    servicesByPersona: {
      keepsake: ['sde', 'papic_seats', 'animated_monogram', 'advanced_website'],
      big_celebration: ['papic_seats', 'live_photowall', 'papic_guest', 'pabati'],
      best_of_both: ['papic_seats', 'sde', 'advanced_website', 'pabati'],
      intimate_romance: ['advanced_website', 'sde', 'animated_monogram'],
      modern_statement: ['live_background', 'animated_monogram', 'advanced_website', 'sde'],
      rooted_tradition: ['papic_seats', 'pabati', 'live_photowall'],
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
    servicesByPersona: {
      keepsake: ['sde', 'animated_monogram', 'advanced_website', 'papic_seats'],
      big_celebration: ['papic_seats', 'live_photowall', 'panood', 'papic_guest', 'pabati'],
      best_of_both: ['papic_seats', 'advanced_website', 'sde', 'panood'],
      intimate_romance: ['advanced_website', 'sde', 'animated_monogram'],
      modern_statement: ['live_background', 'animated_monogram', 'advanced_website', 'sde'],
      rooted_tradition: ['panood', 'papic_seats', 'pabati'],
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
    servicesByPersona: {
      keepsake: ['sde', 'papic_seats', 'advanced_website'],
      big_celebration: ['papic_seats', 'live_photowall', 'pabati'],
      best_of_both: ['papic_seats', 'sde', 'advanced_website'],
      intimate_romance: ['advanced_website', 'sde', 'pabati'],
      modern_statement: ['live_background', 'animated_monogram', 'sde'],
      rooted_tradition: ['papic_seats', 'pabati', 'advanced_website'],
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
    servicesByPersona: {
      keepsake: ['sde', 'papic_seats', 'advanced_website'],
      big_celebration: ['papic_seats', 'panood', 'pabati'],
      best_of_both: ['papic_seats', 'advanced_website', 'sde'],
      intimate_romance: ['advanced_website', 'sde', 'pabati'],
      modern_statement: ['advanced_website', 'animated_monogram', 'sde'],
      rooted_tradition: ['panood', 'papic_seats', 'pabati'],
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
    // No `pakanta`/`animated_monogram` (couple-only concepts) for corporate —
    // services skew to broadcast (panood), recap film (sde), website + live wall.
    servicesByPersona: {
      keepsake: ['sde', 'advanced_website', 'papic_seats'],
      big_celebration: ['panood', 'live_photowall', 'papic_seats', 'pabati'],
      best_of_both: ['panood', 'papic_seats', 'advanced_website', 'sde'],
      intimate_romance: ['advanced_website', 'sde', 'papic_seats'],
      modern_statement: ['live_background', 'panood', 'advanced_website', 'sde'],
      rooted_tradition: ['panood', 'papic_seats', 'live_photowall'],
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
    // Tournament leans broadcast-heavy: livestream the matches (panood), highlight
    // film (sde), live scoreboard/photo wall, capture seats. No couple-only SKUs.
    servicesByPersona: {
      keepsake: ['sde', 'advanced_website', 'papic_seats'],
      big_celebration: ['panood', 'live_photowall', 'papic_seats', 'pabati'],
      best_of_both: ['panood', 'papic_seats', 'sde', 'advanced_website'],
      intimate_romance: ['papic_seats', 'sde', 'advanced_website'],
      modern_statement: ['live_background', 'panood', 'advanced_website', 'sde'],
      rooted_tradition: ['panood', 'papic_seats', 'live_photowall'],
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
    // Travel/destination: the trip website + candid capture + recap film are the
    // hero services; greetings (pabati) bring along guests who couldn't fly out.
    servicesByPersona: {
      keepsake: ['sde', 'advanced_website', 'papic_seats'],
      big_celebration: ['papic_seats', 'advanced_website', 'pabati'],
      best_of_both: ['papic_seats', 'sde', 'advanced_website'],
      intimate_romance: ['advanced_website', 'sde', 'pabati'],
      modern_statement: ['advanced_website', 'sde', 'animated_monogram'],
      rooted_tradition: ['papic_seats', 'pabati', 'advanced_website'],
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
    servicesByPersona: {
      keepsake: ['sde', 'papic_seats', 'advanced_website', 'animated_monogram'],
      big_celebration: ['papic_seats', 'live_photowall', 'papic_guest', 'pabati'],
      best_of_both: ['papic_seats', 'sde', 'advanced_website', 'pabati'],
      intimate_romance: ['advanced_website', 'sde', 'animated_monogram'],
      modern_statement: ['live_background', 'animated_monogram', 'advanced_website', 'sde'],
      rooted_tradition: ['papic_seats', 'pabati', 'live_photowall'],
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
  return derivePackPlanFrom(packKey ? PERSONA_PACKS[packKey] : undefined, personaKey, tiles, effort);
}

/**
 * Same as `derivePackPlan` but takes the pack OBJECT directly — the DB-driven
 * path: `getOnboardingSpec` resolves the pack (admin override OR the TS default)
 * and the shell passes it straight in, so a per-type admin edit flows through
 * without a key lookup. `null/undefined` pack → `deriveGenericPlan` (PR3
 * behaviour). Pure + deterministic.
 */
export function derivePackPlanFrom(
  pack: TypePersonaPack | null | undefined,
  personaKey: string | null | undefined,
  tiles: readonly OnboardingPickChip[],
  effort: string | null | undefined,
): GenericPlan {
  if (!pack) return deriveGenericPlan(tiles, effort);

  const byId = new Map(tiles.map((t) => [t.cat, t] as const));
  const taxonomyOrder = tiles.map((t) => t.cat);
  // A DB-authored pack may omit a persona — default its extras to [] so the
  // spread never throws (the TS packs always carry all six personas).
  const extras = (isPersonaKey(personaKey) && pack.byPersona[personaKey]) || [];

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

/** effort axis → how many in-app services to pre-surface. */
const SERVICE_LIMIT: Record<string, number> = { simple: 2, balanced: 3, allout: 5 };
const DEFAULT_SERVICE_LIMIT = 3;

/**
 * Derive the in-app SERVICES to pre-surface for the generic flow, persona- AND
 * type-aware. Mirrors `derivePackPlan` but for services rather than categories
 * (→ `style_preferences.interested_services`, which the dashboard reads to
 * auto-surface owned/interested SKUs).
 *
 * - No pack for `packKey`, or an unknown persona → `[]` (the safe PR2 fallback;
 *   the generic flow showed nothing extra). The categories plan still derives.
 * - Otherwise = the persona's `services` list, deduped, INTERSECTED against
 *   `VALID_SERVICE_KEYS` (so a stray/retired key can never reach the write), then
 *   sized by the effort axis (simple=2 / balanced=3 / allout=5). Authoring a key
 *   outside the registry is silently dropped — `derivePackServices` is the guard.
 *
 * Pure + deterministic. These are PRE-SURFACED (not purchased) — no paywall here.
 */
export function derivePackServices(
  packKey: string | null | undefined,
  personaKey: string | null | undefined,
  effort: string | null | undefined,
): string[] {
  return derivePackServicesFrom(packKey ? PERSONA_PACKS[packKey] : undefined, personaKey, effort);
}

/**
 * Same as `derivePackServices` but takes the pack OBJECT directly — the DB-driven
 * path (see `derivePackPlanFrom`). `null`/unknown persona → `[]`. Pure.
 */
export function derivePackServicesFrom(
  pack: TypePersonaPack | null | undefined,
  personaKey: string | null | undefined,
  effort: string | null | undefined,
): string[] {
  if (!pack || !isPersonaKey(personaKey)) return [];

  const personaServices = pack.servicesByPersona[personaKey] || [];
  const limit = (effort && SERVICE_LIMIT[effort]) || DEFAULT_SERVICE_LIMIT;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const key of personaServices) {
    if (out.length >= limit) break;
    if (seen.has(key) || !VALID_SERVICE_KEYS.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}
