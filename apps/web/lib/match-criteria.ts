/**
 * Match-criteria option + validation sets — the governance-free curated
 * criteria a couple can edit from the Home "Personalized" block: region,
 * mood/feel, and budget.
 *
 * WHY these three only (CLAUDE.md 2026-06-02 "do both" · step 1): date,
 * ceremony, venue, and guest-count carry the booked-vendor change-flow
 * governance (iteration 0021 §10/§11/§12 + the setEventCeremonyType /
 * updateEventDate vendor-confirmed gates). Region, feel, and budget are
 * pure match-tuning prefs that bind no vendor, so they're safe to edit
 * freely. Shared by the server action (validation) + the edit form (options)
 * so the two never drift.
 *
 * region — free TEXT in the DB (no CHECK); we still validate against the
 *   canonical onboarding screen-7 slug set to keep data clean.
 * feel   — events.mood_feel_key CHECK: the 8-feel ladder.
 * budget — events.estimated_budget_centavos (the peso working figure the
 *   Personalized chip shows); edited as a peso amount, stored ×100.
 */

export type Option = { value: string; label: string };

/** Onboarding screen-7 regions (canonical slugs · matches REGION_LABEL). */
export const REGION_OPTIONS: readonly Option[] = [
  { value: 'ncr', label: 'Metro Manila' },
  { value: 'calabarzon', label: 'CALABARZON' },
  { value: 'central_luzon', label: 'Central Luzon' },
  { value: 'central_visayas', label: 'Central Visayas' },
  { value: 'western_visayas', label: 'Western Visayas' },
  { value: 'eastern_visayas', label: 'Eastern Visayas' },
  { value: 'ilocos', label: 'Ilocos Region' },
  { value: 'cagayan_valley', label: 'Cagayan Valley' },
  { value: 'bicol', label: 'Bicol Region' },
  { value: 'mimaropa', label: 'MIMAROPA' },
  { value: 'zamboanga', label: 'Zamboanga Peninsula' },
  { value: 'northern_mindanao', label: 'Northern Mindanao' },
  { value: 'davao', label: 'Davao Region' },
  { value: 'soccsksargen', label: 'SOCCSKSARGEN' },
  { value: 'caraga', label: 'Caraga' },
  { value: 'barmm', label: 'BARMM' },
  { value: 'car', label: 'Cordillera (CAR)' },
  { value: 'outside_ph', label: 'Outside the Philippines' },
] as const;

/** events.mood_feel_key CHECK — the 8-feel ladder (onboarding palette screen). */
export const FEEL_OPTIONS: readonly Option[] = [
  { value: 'timeless', label: 'Timeless' },
  { value: 'modern', label: 'Modern' },
  { value: 'boho', label: 'Boho' },
  { value: 'rustic', label: 'Rustic' },
  { value: 'glam', label: 'Glam' },
  { value: 'royalty', label: 'Royalty' },
  { value: 'filipiniana', label: 'Filipiniana' },
  { value: 'others', label: 'Still deciding' },
] as const;

export const ALLOWED_REGIONS: ReadonlySet<string> = new Set(
  REGION_OPTIONS.map((o) => o.value),
);
export const ALLOWED_FEELS: ReadonlySet<string> = new Set(
  FEEL_OPTIONS.map((o) => o.value),
);

/** ₱100M ceiling — a sane upper bound for a wedding-budget peso figure. */
export const MAX_BUDGET_PESOS = 100_000_000;
