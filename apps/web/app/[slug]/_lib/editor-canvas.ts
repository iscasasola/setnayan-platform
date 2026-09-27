/**
 * 🖼 THE MAKER'S CANVAS — "editing should only be the page" (owner 2026-09-25).
 *
 * Two doors render the couple's page with no chrome around it, both for a
 * VERIFIED host only (page.tsx checks `loadHostMembership` before it sets
 * `isEditorCanvas`; the params below only ask the question):
 *
 *   · `?editor=1`       — the Event Hub Maker's canvas iframe. Also mounts the
 *                         click-to-edit bridge.
 *   · `?preview=draft`  — "Preview the whole stage" from the Maker's ▶ menu: a
 *                         new tab that plays the stage as guests meet it, with
 *                         the host's DRAFT laid over the live rows. No bridge —
 *                         nothing in it is clickable into an editor.
 *
 * 🔒 THE FLAG ONLY EVER HIDES. It removes the Host controls bar, the bottom tab
 * bar, the Live hub pill, the floating music button, the site header,
 * Share/Report and the root layout's floating notices. A stranger who types
 * either param fails the host check and gets the ordinary page.
 *
 * 🔴 WHY IT IS NOT ONLY LOOKS. Every piece of that chrome is a LINK into the
 * dashboard ("Edit this site", "Manage"). Tapped inside the Maker's canvas, one
 * of them navigated the iframe into the Maker — the owner saw his editor
 * embedded in his editor. `the-maker-canvas-is-only-the-page.test.ts` holds it.
 */

export type HostCanvasSearch = { editor?: string; preview?: string; only?: string };

/** Does this request ASK for the host canvas? Never an answer on its own — the
 *  caller must still verify host membership before honouring it. */
export function asksForHostCanvas(search: HostCanvasSearch | undefined): boolean {
  return search?.editor === '1' || search?.preview === 'draft';
}

/** The click-to-edit bridge is the Maker's iframe only, never the preview tab. */
export function asksForEditorBridge(search: HostCanvasSearch | undefined): boolean {
  return search?.editor === '1';
}

/**
 * The root layout's floating notices (cookie consent, a stale-tab bar) are
 * client components mounted above this route, so the page cannot un-mount
 * them. They carry `data-app-chrome`, and the canvas hides that one attribute.
 */
export const EDITOR_CANVAS_HIDES_APP_CHROME = '[data-app-chrome]{display:none!important}';

/**
 * 🖼 ONE SCENE ALONE — the Maker's made-once Hero page (owner 2026-09-27: the
 * Hero page showed "the day, the place, the story" and the host note under the
 * hero). `?only=hero` asks the canvas to draw that scene and nothing else.
 *
 * 🔒 HOST CANVAS ONLY. `canvasOnlyScene` answers null unless the caller has
 * ALREADY verified the host canvas (`isEditorCanvas`), so a guest who types
 * `?only=hero` gets the ordinary page, byte for byte.
 *
 * It HIDES, never reveals: the CSS keeps the scene the navigator marks
 * (`data-maker-section`, `lib/maker-scene-list.ts` keys), its ancestors, its
 * contents and the page ground under it, and hides every other element. It
 * applies only while that marker is on the page (`body:has(…)`), so a page with
 * no such scene stays whole rather than going blank.
 *
 * Keyed by scene so the Logo page (logo alone) is one more row, not new code.
 */
export const CANVAS_ONLY_SCENES = { hero: 'f:hero' } as const;
export type CanvasOnlyScene = keyof typeof CANVAS_ONLY_SCENES;

export function canvasOnlyScene(
  search: { only?: string } | undefined,
  isEditorCanvas: boolean,
): CanvasOnlyScene | null {
  if (!isEditorCanvas) return null;
  const only = search?.only;
  return only && Object.prototype.hasOwnProperty.call(CANVAS_ONLY_SCENES, only) ? (only as CanvasOnlyScene) : null;
}

export function canvasOnlyCss(scene: CanvasOnlyScene): string {
  const m = `[data-maker-section="${CANVAS_ONLY_SCENES[scene]}"]`;
  const keep = [
    `:has(${m} + *)`, // an ancestor of the scene
    `${m} + *`, // the scene
    `${m} + * *`, // inside the scene
    '[data-main-ground]',
    '[data-main-ground] *',
    '[data-guest-ground]',
    '[data-guest-ground] *',
  ]
    .map((s) => `:not(${s})`)
    .join('');
  return `body:has(${m}) *${keep}{display:none!important}`;
}
