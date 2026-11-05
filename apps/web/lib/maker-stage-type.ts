/**
 * lib/maker-stage-type.ts — import-free, so the Maker's first-load work area
 * (`editor-shell.tsx`) can ask it without pulling the parts map
 * (`lib/maker-parts.ts`) into the first load (`scripts/check-maker-js-budget.mjs`).
 */
/**
 * 👆 A TAP ON THE PAGE ONLY SELECTS (owner 2026-10-09, verbatim: *"on preview screen, you only select. You can
 * change the content there via edit"* — `TOOLBAR-SPEC-2026-10-09.md`). In the new Maker's Stages a tap on a part's
 * words picks the part, the first time and every time after; its words are changed in the toolbar's Edit. So the
 * answer to "may this tap type?" is NO, for every part.
 *
 * It was "typing is a second tap" (DECISION_LOG 2026-10-07 rule 1): a tap on the words of the part ALREADY picked
 * typed them on the page. The two callers still ask here — the work area for the Event Hub canvas
 * (`editor-shell.tsx`) and the reply pages for theirs (`rsvp-canvas-bridge.tsx`) — and still say which part is
 * picked (`picked`, the shell's `data-stage-picked`: the reply pages bring it into view with it), so the rule is ONE
 * line in ONE place, whichever way the owner turns it next.
 */
export function makerStageMayType(_picked: string | null | undefined, _key: string, _el: string | null | undefined): boolean {
  return false;
}
