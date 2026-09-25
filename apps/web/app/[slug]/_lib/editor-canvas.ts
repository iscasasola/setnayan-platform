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

export type HostCanvasSearch = { editor?: string; preview?: string };

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
