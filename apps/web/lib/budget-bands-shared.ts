/**
 * budget-bands-shared.ts — client-safe budget feel-band type + in-code fallback.
 *
 * Split out of budget-bands.ts so CLIENT components (the onboarding shell) can
 * import the BudgetBand type + BUDGET_BANDS_FALLBACK WITHOUT transitively pulling
 * in the server-only Supabase client (lib/supabase/server → next/headers). That
 * server import in budget-bands.ts was reaching the client/pages bundle and
 * breaking the production build. This module has NO server imports.
 */

/** One budget feel-band. `med` is the per-head median in PESOS (0 = no_limit). */
export type BudgetBand = { value: string; label: string; tag: string; med: number };

/**
 * In-code fallback — IDENTICAL to the onboarding-shell BUDGET_BANDS literal that
 * the DB-backed reader replaces (essentials med 2000 … luxury 15000, no_limit 0).
 * Used whenever the DB read errors or returns no rows, so onboarding never breaks
 * even before the migration is applied (fallback-safe → mergeable pre-migration).
 */
export const BUDGET_BANDS_FALLBACK: BudgetBand[] = [
  { value: 'essentials', label: 'Essentials', tag: 'Lean & intentional', med: 2000 },
  { value: 'simple', label: 'Simple', tag: 'Comfortable', med: 3500 },
  { value: 'classic', label: 'Classic', tag: 'The sweet spot', med: 5000 },
  { value: 'elevated', label: 'Elevated', tag: 'Polished', med: 7500 },
  { value: 'premium', label: 'Premium', tag: 'Entry luxury', med: 11000 },
  { value: 'luxury', label: 'Luxury', tag: 'No-compromise', med: 15000 },
  { value: 'no_limit', label: 'No limit', tag: 'No ceiling', med: 0 },
];
