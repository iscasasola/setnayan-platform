import { CITIES } from '@/app/onboarding/wedding/_data/wedding-cities';
import { PH_PLACES } from '@/app/onboarding/wedding/_data/ph-places';

/**
 * 📍 IS THIS A PLACE ON THE ONBOARDING'S LIST? (owner 2026-10-01, DECISION_LOG
 * "THE MAKER'S VENUES GET A REAL PIN AND A PICKED CITY — NOT FREE TEXT").
 *
 * The event's City or area (`events.std_film_venue_city`) is picked from the
 * SAME vocabulary onboarding offers — the curated wedding cities and every PH
 * province, city and municipality (PSGC) — never typed. The Maker's pick
 * stores the place's own name; this is the server's half of "never typed":
 * `hubDraftAction` refuses any other name before it reaches the draft.
 *
 * Server-side only in practice (the PSGC list is ~80 KB — the browser loads it
 * lazily, on the first search, exactly as onboarding does).
 */
let names: Set<string> | null = null;

export function isListedPlaceName(raw: string): boolean {
  if (!names) names = new Set([...CITIES.map((c) => c.n), ...PH_PLACES.map((p) => p[0])]);
  return names.has(raw.trim());
}
