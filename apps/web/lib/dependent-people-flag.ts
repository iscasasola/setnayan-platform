/**
 * Dependent People layer — feature flag (date-anchor model · Phase 3 · Family
 * graph).
 *
 * ⚠ COUNSEL-GATED. `dependentPeopleEnabled()` defaults OFF. The dependent
 * records store a CHILD's birthdate + religion + sex — the most sensitive data
 * the platform holds (RA 10173 minors + §3(l) sensitive PI). The whole surface
 * (People UI, capture, milestone reminders, faith rites for children,
 * godparents) is guarded by this flag, so it is INERT in production and stores
 * / surfaces NO dependent data until the DPO/counsel batched review (G1) clears
 * it and the owner sets `NEXT_PUBLIC_DEPENDENT_PEOPLE=1` as a Vercel env var.
 *
 * Mirrors the Phase-2 posture (personLifeStoriesEnabled, peopleConnectionsEnabled).
 * Plan: Family_Life_OS_Master_Build_Plan_2026-07-12.md §D Phase 3 + G1.
 */
export function dependentPeopleEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEPENDENT_PEOPLE === '1';
}
