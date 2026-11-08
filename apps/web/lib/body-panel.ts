/**
 * lib/body-panel.ts — the in-body panel's geometry and clip frames, pure (THE ONE BUILD §10 #33 Makers · §10 #40
 * Portfolio albums; Build 2 lane B2-B). The client part is `app/vendor-dashboard/_components/body-panel.tsx`.
 *
 * The panel stands BETWEEN the top bar and the bottom nav — both stay on screen (owner 8 Nov: *"keep the navs and just
 * take up the body part"*) — across the page's own column. It grows out of the tapped tile/row by a `clip-path` from that
 * rect to the whole panel (the picked client's motion, `picked-client-motion.ts` `rectClip`, measured against the panel
 * instead of the viewport), and the close plays the same two frames in reverse.
 */

export type PanelBox = { top: number; left: number; width: number; height: number };
export type Rect = { top: number; left: number; width: number; height: number };

/** The panel's box: under the top bar, over the bottom nav's top edge, across the page column. Never negative. */
export function bodyPanelBox({
  vw,
  vh,
  topBarBottom,
  dockTop,
  frame,
}: {
  vw: number;
  vh: number;
  /** The top bar's bottom edge; null = no bar on screen (it scrolled away or this tree has none) → the panel starts at 0. */
  topBarBottom: number | null;
  /** The bottom nav's top edge; null = no bar (a wide screen) → the panel runs to the bottom. */
  dockTop: number | null;
  /** The page column; null = the whole width. */
  frame: { left: number; width: number } | null;
}): PanelBox {
  const top = Math.max(0, Math.min(vh, topBarBottom ?? 0));
  const bottom = Math.max(top, Math.min(vh, dockTop ?? vh));
  const left = frame ? Math.max(0, Math.min(vw, frame.left)) : 0;
  const width = frame ? Math.max(0, Math.min(vw - left, frame.width)) : vw;
  return { top: Math.round(top), left: Math.round(left), width: Math.round(width), height: Math.round(bottom - top) };
}

/**
 * The `clip-path` that frames `from` (a viewport rect) inside the panel's box — the open's first frame and the close's
 * last. `from = null` → the whole panel (the open's last frame). Insets are clamped to the box, so a tile partly under a
 * bar still starts from where it shows. Round corners on the tile, square on the full body.
 */
export function panelClip(from: Rect | null, box: PanelBox): string {
  if (!from) return 'inset(0px 0px 0px 0px round 0px)';
  const r = (n: number) => Math.round(Math.max(0, n) * 10) / 10;
  const top = r(Math.min(box.height, from.top - box.top));
  const left = r(Math.min(box.width, from.left - box.left));
  const right = r(Math.min(box.width, box.left + box.width - (from.left + from.width)));
  const bottom = r(Math.min(box.height, box.top + box.height - (from.top + from.height)));
  return `inset(${top}px ${right}px ${bottom}px ${left}px round 16px)`;
}
