/**
 * Dependent People layer — feature flag (date-anchor model · Phase 3 · Family
 * graph).
 *
 * ⚠ COUNSEL-GATED. `dependentPeopleEnabled()` defaults OFF. A dependent is a
 * person, a pet, or anything you care for; only the PERSON case can carry
 * sensitive PI (a child's birthdate + religion + sex, guardian-consented — RA
 * 10173 minors + §3(l)), so sensitive data is a conditional sub-case, not the
 * whole table. The whole surface (People UI, capture, milestone reminders, faith
 * rites, godparents) is guarded by this flag, so it is INERT in production and
 * stores / surfaces NO dependent data until the DPO/counsel batched review (G1)
 * clears it and the owner sets `NEXT_PUBLIC_DEPENDENT_PEOPLE=1` as a Vercel env var.
 *
 * Mirrors the Phase-2 posture (personLifeStoriesEnabled, peopleConnectionsEnabled).
 * Plan: Family_Life_OS_Master_Build_Plan_2026-07-12.md §D Phase 3 + G1.
 */
export function dependentPeopleEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEPENDENT_PEOPLE === '1';
}
