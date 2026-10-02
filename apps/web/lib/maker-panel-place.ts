/**
 * 📐 WHERE A TOOLBAR PANEL OPENS — under its anchor, right-aligned to it, and
 * ALWAYS inside the screen with 8 px gutters. Owner, live phone test
 * 2026-10-02: after Apply the draft panel hung off its anchor's right edge on
 * the phone's second toolbar row and ran off the screen's LEFT side. Pure, so
 * `lib/the-draft-panel-never-pops-up.test.ts` holds it at 390 px.
 */
export type PanelPlace = { top: number; left: number; width: number };

export function placePanelAt(anchor: { bottom: number; right: number }, viewportWidth: number): PanelPlace {
  const width = Math.min(320, viewportWidth - 16);
  const left = Math.max(8, Math.min(anchor.right - width, viewportWidth - width - 8));
  return { top: anchor.bottom + 8, left, width };
}
