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

import { allRegions } from '@/lib/region-source';

export type Option = { value: string; label: string };

/**
 * Region options for the Personalization region <select>. Derived from the
 * canonical region source (lib/region-source.allRegions) — `value` is the
 * CANONICAL hyphen slug ('c-visayas'), `label` is the display label. This
 * replaces the hand-maintained underscore list so the picker, the validator,
 * and the stored value share one vocabulary.
 *
 * NOTE: values are now hyphen slugs (the value actually stored by onboarding in
 * events.region), NOT the old underscore slugs. updateEventMatchCriteria
 * normalizes any incoming spelling to the canonical hyphen slug, and the edit
 * form normalizes the stored value to its canonical slug for preselect — so
 * legacy underscore-stored rows keep working.
 */
export const REGION_OPTIONS: readonly Option[] = allRegions().map((r) => ({
  value: r.slug,
  label: r.display_label,
}));

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

/**
 * Server-side validation set for a region value. CRITICAL: accepts BOTH the
 * canonical hyphen slugs (new writes / picker values) AND every legacy spelling
 * — the underscore variants ('central_visayas'), PSGC codes, 'cagayan-valley',
 * 'outside_ph' — because existing events.region rows were written in the old
 * underscore vocabulary and must stay valid. Built from every region's
 * canonical slug + all its aliases (lower-cased). The action still NORMALIZES
 * the accepted value to the canonical hyphen slug before storing, so new writes
 * converge on one spelling. resolveRegion(value) !== null is the equivalent
 * runtime check; this Set is the cheap pre-validated membership test.
 */
export const ALLOWED_REGIONS: ReadonlySet<string> = new Set(
  allRegions().flatMap((r) => [
    r.slug.toLowerCase(),
    ...(r.psgc_code ? [r.psgc_code.toLowerCase()] : []),
    ...r.aliases.map((a) => a.toLowerCase()),
  ]),
);
export const ALLOWED_FEELS: ReadonlySet<string> = new Set(
  FEEL_OPTIONS.map((o) => o.value),
);

/** ₱100M ceiling — a sane upper bound for a wedding-budget peso figure. */
export const MAX_BUDGET_PESOS = 100_000_000;

/**
 * Alphabet-only name sanitizer (owner 2026-06-02, PR #806). Allows Unicode
 * letters (Filipino ñ + accents), spaces (compound names + spaced surnames
 * like "Dela Cruz" / "De Leon"), hyphens ("Anne-Marie") and apostrophes
 * ("D'Souza"); strips digits + symbols. Shared by the Personalization edit
 * form (client, live as the host types) and updateEventMatchCriteria (server,
 * defense-in-depth) so the two never drift — mirrors the onboarding
 * name-screen rule in onboarding-shell.tsx.
 */
export function sanitizeName(raw: string): string {
  return (raw || '').replace(/[^\p{L}\s'-]/gu, '');
}

/** Per-field name length cap (matches the form input maxLength). */
export const MAX_NAME_LEN = 80;
