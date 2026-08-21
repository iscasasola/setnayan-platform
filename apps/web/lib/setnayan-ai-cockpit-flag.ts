/**
 * Setnayan-AI Decision Cockpit switch — the couple Overview's "Suri briefing"
 * hero + Decisions rail + What's-next rail.
 *
 * ⚠ REWRITTEN 2026-08-06. This file used to say:
 *
 *   "The cockpit renders ONLY when this returns true. Default OFF, so prod today
 *    keeps the R3 status board byte-for-byte — the whole surface is inert until
 *    the owner flips the env flag after preview QA."
 *
 * **Every sentence of that was false.** `cockpitEnabled()` had ZERO importers
 * anywhere in the repo, so it gated nothing: it neither held the surface back
 * nor could it take the surface down. The cockpit's real and only gate is the
 * AI entitlement — `isSetnayanAiActiveForEvent()` in `event-dashboard.tsx`
 * (`aiActive = aiEntitled || suriPreview`) — which shipped without ever
 * consulting this module. The owner believed they held a lever that was not
 * connected at either end.
 *
 * ── WHY THE DEFAULT IS **ON**, not the OFF the old docblock claimed ──────────
 *
 * The old default described a pre-launch rollout gate for a surface that had not
 * shipped yet. It has shipped. Re-wiring it as a default-OFF gate would add a
 * SECOND, undocumented condition a couple must satisfy — so turning the AI
 * product on for an event would silently produce no briefing, and the next
 * person would hunt for a bug that was a hidden env var. That is precisely the
 * "gate with no handle" failure this codebase has already paid for twice.
 *
 * So this is now a **kill switch**, not a rollout switch:
 *
 *   unset / anything but '0'  → cockpit renders (today's behaviour, unchanged)
 *   '0'                       → cockpit hidden everywhere, entitlement or not
 *
 * Setting it to '0' is a real off switch the owner can reach without a deploy of
 * new code. Leaving it alone changes nothing.
 *
 * ── Blast radius when flipped OFF ───────────────────────────────────────────
 *
 * At the time of writing, NONE. Verified against prod 2026-08-06: 5 events,
 * `setnayan_ai_active IS TRUE` on **0**, `planning_mode = 'assisted'` on **0**,
 * and zero AI orders. Nobody sees the briefing today, so this switch currently
 * changes nothing in either position — it exists so that stays true by choice
 * rather than by accident.
 *
 * Deliberately distinct from the entitlement gates in `lib/setnayan-ai.ts`
 * (isSetnayanAiActiveForUser / eventOwnsSetnayanAi), which answer "does this
 * event OWN the AI product?". This answers "is the surface allowed to render at
 * all?" and can only ever REMOVE the surface, never grant it.
 *
 * Kept as a function (not a module const) so it is re-read per request rather
 * than captured — same convention as lifeStoryEnabled() in life-story-flag.ts.
 */
export function cockpitEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SETNAYAN_AI_COCKPIT !== '0';
}
