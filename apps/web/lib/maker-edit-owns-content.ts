/**
 * lib/maker-edit-owns-content.ts — ✏️ IN THE NEW MAKER, CONTENT IS EDIT'S AND STYLE IS ONLY THE LOOK.
 *
 * 🔴 2026-10-19, live, the owner's Safari at ~840 px, Invitation › Home with the Love Story on it: the toolbar read
 * "YOU'RE EDITING · INVITATION › HOME" with a BLANK Edit, and Style showed the Love Story's moments editor ("…the same
 * field as in Event Details — saved once, shown everywhere." · Before us · 1 moment · ＋ Add a moment …). Owner,
 * verbatim: *"why is it on style and not on edit (and i thought it should jump to the studio?)"* — he was right: the
 * shipped Edit for the Love Story is its ONE door, "Open in Studio › Love Story" (TOOLBAR-SPEC 2026-10-09 § EDIT,
 * owner: *"Only jump if it has editing that cannot be done there. Example: Schedule, Love Story, Wedding March,
 * Logo"* — `lib/maker-parts.ts` `makerPartQuietRow`).
 *
 * Two faults, one disease (the toolbar and the work area disagreed about what was picked):
 *   1. The real canvas wraps the Love Story in its region `#site-story`, which the bridge also listens to as
 *      `f:story` (`canvas-section-binder.ts` `ID_SECTIONS`). A tap the region took named no part
 *      (`makerPartOfCanvas` knew only `w:our_love_story`) — so the toolbar picked nothing (blank Edit, "› HOME").
 *      → `MAKER_CANVAS_ALIAS`: the region names the Love Story part (`maker-parts.ts` `makerCanvasKeyOf`).
 *   2. The work area had opened the region's fixed panel anyway, and in the new Maker that panel laid the Details
 *      fact's editor (`factEditorFor`) inside Style's look. → `makerStyleLook` below: Style's body never carries a
 *      content editor, and `makerWorkAreaTab` never opens Content under the toolbar.
 *
 * Pure. No React — the guard drives these very functions (`edit-owns-content.test.ts`).
 */

/** The work area's scene tabs (`scene-inspector.tsx` `SceneTab`), as this module sees them. */
export type MakerWorkAreaTab = 'format' | 'animate' | 'arrange' | 'content' | 'transition';

/**
 * 🧭 THE TAB THE WORK AREA'S BODY SHOWS. Under the new Maker's toolbar (`stagesStudio`) that body is Style ·
 * Background · Animate only — Edit is the toolbar's OWN rows (`stage-panel/stage-edit.tsx`: the part's words in
 * place, or its one door). So a scene asked for its Content there opens on its Format: Content would be drawn
 * under the Style pill. The old Maker keeps every tab, unchanged. The old Transition tab is Animate (answer 4).
 */
export function makerWorkAreaTab(asked: MakerWorkAreaTab, stagesStudio: boolean): Exclude<MakerWorkAreaTab, 'transition'> {
  if (asked === 'transition') return 'animate';
  if (stagesStudio && asked === 'content') return 'format';
  return asked;
}

/**
 * 🎨 WHAT A FIXED PART'S STYLE HOLDS IN THE NEW MAKER — its look row, the ticket's style, the tool it is made in
 * (the Reveal's opening, Post Event's rows) — NEVER its fact's editor (the Love Story's moments): that is content,
 * and content is Edit's door (`makerPartQuietRow`). The old Maker's fixed panel draws the fact in place, unchanged.
 * Returned in order; a missing piece is left out.
 */
export function makerStyleLook<N>(
  pieces: { style: N | null; ticket: N | null; fact: N | null; tool: N | null },
  stagesStudio: boolean,
): N[] {
  const out = stagesStudio ? [pieces.style, pieces.ticket, pieces.tool] : [pieces.style, pieces.ticket, pieces.fact ?? pieces.tool];
  return out.filter((n): n is N => n !== null && n !== undefined);
}

/**
 * ✋ ROW 1 WHEN THE TOOLBAR HAS NOTHING ELSE TO SAY. Two states, never the same words (2026-10-18/19):
 *   'silent'  the page on screen does not answer taps (`canvas-bridge-watch.ts`, #6649) — its line and Reload win;
 *   'pick'    the page answers, and nothing is picked — ONE plain line, never a blank Edit.
 * A part picked has its own rows: null.
 */
export type StageRowOneLine = 'silent' | 'pick' | null;
export function stageRowOneLine(state: { picked: boolean; canvasSilent: boolean }): StageRowOneLine {
  if (state.canvasSilent) return 'silent';
  return state.picked ? null : 'pick';
}
/** The line itself (controller's call 2026-10-19, recorded in the PR: one plain line, no tiles, no button). */
export const STAGE_NOTHING_PICKED_WORDS = 'Tap a part of the page to edit it.';
