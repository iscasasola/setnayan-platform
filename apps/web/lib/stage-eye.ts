/**
 * apps/web/lib/stage-eye.ts
 *
 * 👁 WHAT THE MAKER'S EYE STORES for the stage on screen (owner 2026-10-10, "WHAT GUESTS SEE") — the same rule as a
 * tick in the table (`guestsSeeToggle`, `lib/guests-see-table.ts`): the wanted state, or `null` (the choice taken
 * back) when the stage's list has it that way with no choice stored (`base`, `buildStageEyes` in
 * `lib/guests-see-build.ts`). No facts for the scene → the wanted state itself.
 *
 * A file of its own, and this small, on purpose: the Maker's work area imports it in its first load.
 */
export function stageEyeValue(eye: { base: boolean } | null | undefined, want: boolean): boolean | null {
  return eye && want === eye.base ? null : want;
}
