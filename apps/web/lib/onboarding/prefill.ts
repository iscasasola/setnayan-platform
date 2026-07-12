import type { SelfPersonalization } from '@/lib/self-personalization';

/**
 * The deterministic "brief brain": given the current user's self-profile facts,
 * decide which per-type onboarding answers can be PREFILLED and which questions
 * can therefore be SKIPPED — so onboarding never re-asks what the profile
 * already knows (owner, 2026-07-13). Pure, no I/O; the reader lives in
 * `@/lib/self-personalization`, the flag in `@/lib/onboarding-v2-brief-flag`.
 *
 * Rule 1 (deterministic, zero-LLM): every mapping here is an authored rule over
 * real field keys in `lib/onboarding/specialty-catalog.ts` /
 * `lib/onboarding/type-questions.ts`. Only SELF-sourced, verified mappings are
 * encoded. Facts that require the flag-gated People layer (a debutante's
 * gender→18F/21M, a child's birthdate→christening age, a dependent's milestone)
 * are intentionally NOT derived here — see the notes below.
 */
export type OnboardingPrefillProvenance =
  | 'religion'
  | 'civil_status'
  | 'birth_date'
  | 'sex';

export type OnboardingPrefill = {
  /** field/question id → pre-selected value (keys match the type's spec). */
  answers: Record<string, string>;
  /** field/question ids the flow may hide because the profile answers them. */
  skip: string[];
  /** field id → which profile fact it came from (for the "on file" UI copy). */
  provenance: Record<string, OnboardingPrefillProvenance>;
};

export const EMPTY_PREFILL: OnboardingPrefill = {
  answers: {},
  skip: [],
  provenance: {},
};

/**
 * religion → christening `rite_type` (specialty-catalog.ts christening).
 * Options there: catholic_baptism · infant_dedication · kumpil_confirmation ·
 * combined_baptism_and_reception. A Catholic maps to a baptism; Born-Again
 * (christian) and Iglesia ni Cristo (inc) do an infant *dedication* (no
 * sponsors/paperwork). Muslim (Aqiqah, not modeled) and 'other' → no mapping,
 * so the question is still asked.
 */
function christeningRiteFromReligion(
  religion: SelfPersonalization['religion'],
): string | null {
  switch (religion) {
    case 'catholic':
      return 'catholic_baptism';
    case 'christian':
    case 'inc':
      return 'infant_dedication';
    default:
      return null;
  }
}

export function deriveOnboardingPrefill(
  eventType: string,
  self: SelfPersonalization,
): OnboardingPrefill {
  const answers: Record<string, string> = {};
  const provenance: OnboardingPrefill['provenance'] = {};
  const skip: string[] = [];

  const set = (
    field: string,
    value: string,
    from: OnboardingPrefillProvenance,
  ) => {
    answers[field] = value;
    provenance[field] = from;
    skip.push(field);
  };

  if (eventType === 'christening') {
    const rite = christeningRiteFromReligion(self.religion);
    if (rite) set('rite_type', rite, 'religion');
  }

  // Deliberately NOT derived from self facts (documented, tested):
  // - Wedding faith: already prefilled by the dedicated wedding flow itself
  //   (religion → faith picker, onboarding/wedding/page.tsx). Centralizing that
  //   is a follow-up; this helper never double-drives it.
  // - Debut 18F/21M, birthday/christening milestone age: need the SUBJECT's
  //   birthdate/gender, which for the common (dependent) case live in the
  //   flag-gated People layer — not the account owner's own profile.
  // - Anniversary silver/golden: needs the union's original WEDDING-EVENT date,
  //   not a `users` column, so it isn't a self-profile prefill.
  // - civil_status: no live onboarding question maps to it 1:1 yet.

  return { answers, skip, provenance };
}
