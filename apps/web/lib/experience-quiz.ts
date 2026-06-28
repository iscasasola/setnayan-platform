/**
 * Experience-persona onboarding flag (iteration 0016 · the experience-first
 * reorientation).
 *
 * When ON, the wedding onboarding STOPS asking the couple to hand-pick vendor
 * categories from the 53-tile "dream team" grid. Instead a short 5-question
 * EXPERIENCE QUIZ (for-whom · feel · energy · roots · effort) resolves to a named
 * persona, and the persona DERIVES the whole plan — which vendor categories to
 * line up, which in-app Setnayan services to surface, and the style refinements
 * the matcher consumes. "Experience fully derives the plan" (owner 2026-06-21).
 *
 * Flag-gated so the live funnel is byte-identical until the owner flips it on:
 *   - OFF (default): the flow is unchanged — aigate + the team_basics/refine/
 *     team_extras picker screens run exactly as today; the exp_* screens are
 *     dropped from the sequence; the commit never writes the experience_* columns.
 *   - ON: the exp_* quiz + reveal replace aigate + the picker screens; the persona
 *     derives picks/refinements/feel/services; the commit persists the persona.
 *
 * Default OFF. Going live needs ONE owner action the code can't do:
 *   1. Apply migration 20270207000000_events_experience_persona.sql
 *      (adds events.experience_persona / experience_for_whom / experience_axes).
 *   …then set NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED=true.
 *
 * NEXT_PUBLIC_ so the onboarding client (which swaps the screens) and the commit
 * server action (which guards the new columns) read the SAME flag — one source of
 * truth, no client/server drift. Inlined at build time.
 */
// LAUNCHED 2026-06-28 (owner-authorized). Migration 20270208703382 is applied in
// prod (events.experience_persona / experience_for_whom / experience_axes all
// exist) and the quiz flow was verified end-to-end (screens render + align, the
// 5-axis quiz derives a persona, and the commit's data-path passes every
// constraint under a real user). The flag now defaults ON; it remains a
// KILL-SWITCH — set NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED=false to fall back to the
// legacy manual-picker flow with no code change.
export function experienceQuizEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED !== 'false';
}
