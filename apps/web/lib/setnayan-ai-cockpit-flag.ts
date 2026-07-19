/**
 * Setnayan-AI Decision Cockpit rollout flag — a DORMANT rollout switch.
 *
 * The cockpit (the "Suri briefing" hero + Decisions rail + What's-next rail on
 * the couple Overview) renders ONLY when this returns true. Default OFF, so prod
 * today keeps the R3 status board byte-for-byte — the whole surface is inert
 * until the owner flips the env flag after preview QA (item R4, owner-approved
 * taxonomy 2026-07-09).
 *
 * Deliberately distinct from the Setnayan-AI ENTITLEMENT gates in
 * `lib/setnayan-ai.ts` (isSetnayanAiActiveForUser / eventOwnsSetnayanAi): those
 * answer "does this event OWN the AI product?"; this answers "is the cockpit UI
 * shipped yet?". A pure presentation rollout switch — no legal/entitlement
 * meaning, no DB dependency.
 *
 * Kept as a function (not a module const) so it's re-read per request rather
 * than captured — same convention as lifeStoryEnabled() in life-story-flag.ts.
 */
export function cockpitEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SETNAYAN_AI_COCKPIT === '1';
}
