/**
 * 📐 …LESS WHAT SITS ABOVE IT. The guest page's pinned top bar (`min-h-[4rem]` + its 1px rule) and the column's top
 * padding come before the cover, so a full `100svh` ran that much past the fold (walked 2026-10-15: the Framed edge's
 * foot fell off the first screen at 375, 390 and iPhone 13). The column says how much sits above it, per breakpoint
 * (`invitation-shell.tsx`); nothing set = 0, the whole screen.
 */
export const COVER_SCENE_ABOVE_PAGE =
  '[--cover-scene-above:calc(4rem_+_1px_+_2.5rem)] sm:[--cover-scene-above:calc(4rem_+_1px_+_3.5rem)] xl:[--cover-scene-above:calc(4rem_+_1px_+_5rem)] [--cover-scene-pad:2.5rem] sm:[--cover-scene-pad:3.5rem] xl:[--cover-scene-pad:5rem]';
/** …in the Maker's canvas (no top bar there): the column's top padding only. */
export const COVER_SCENE_ABOVE_CANVAS =
  '[--cover-scene-above:2.5rem] sm:[--cover-scene-above:3.5rem] xl:[--cover-scene-above:5rem] [--cover-scene-pad:2.5rem] sm:[--cover-scene-pad:3.5rem] xl:[--cover-scene-pad:5rem]';
/**
 * `--cover-scene-pad` (set beside it): the column's top padding alone — Full width's ground reaches UP through it, so
 * an edge-to-edge scene starts right under the top bar (owner's controller, 2026-10-15: no white band above it).
 */
