/**
 * seat-plan-overview.ts — THE WHOLE-ROOM OVERVIEW KEEPS EVERY LABEL WHOLE.
 *
 * At zoom 1 the room fills the seat plan's canvas exactly, and a booth set
 * against a wall wears its name centred on it — so half the name hangs past the
 * wall, and the canvas (overflow hidden) cuts it: "OTO BOOTH", "CAKE T" (owner,
 * live walk 2026-10-05). Measured 2026-10-05 on maria-and-jose's own room
 * (20 × 30 m, booths at 4% and 96% across) on the NORMAL seat-plan page at
 * 375 × 812: 10 of 14 booth labels cut, each by 28px — so this is not the guided
 * step's problem alone, and a fixed 0.9 still left 8px cut.
 *
 * The overview is zoomed out by exactly what the labels need, measured: with
 * the room centred at zoom `z`, a label that reached `o` px past an edge at zoom
 * 1 lands `z·o − W(1−z)/2` past it, which is ≤ 0 when z ≤ W / (W + 2o). The
 * tightest edge decides; nothing past an edge → zoom 1, the room as large as it
 * fits.
 */
export type Box = { left: number; top: number; right: number; bottom: number };

/** The overview's zoom: 1, or less by just what the furthest overhanging label needs (`pad` px clear). */
export function roomOverviewZoom(canvas: Box, items: readonly Box[], pad = 4): number {
  const W = canvas.right - canvas.left;
  const H = canvas.bottom - canvas.top;
  if (!(W > 0) || !(H > 0)) return 1;
  let ox = 0;
  let oy = 0;
  for (const b of items) {
    // Nothing drawn (display: none reads as a 0×0 box at the page's corner).
    if (b.right - b.left <= 0 && b.bottom - b.top <= 0) continue;
    // A layer the size of the room (its walls) is the room, not a label past it.
    if (b.right - b.left >= W - 1 && b.bottom - b.top >= H - 1) continue;
    ox = Math.max(ox, canvas.left - b.left, b.right - canvas.right);
    oy = Math.max(oy, canvas.top - b.top, b.bottom - canvas.bottom);
  }
  const zx = ox > 0 ? W / (W + 2 * (ox + pad)) : 1;
  const zy = oy > 0 ? H / (H + 2 * (oy + pad)) : 1;
  // Never below half: a label so wide it would shrink the room further is the label's problem.
  return Math.max(0.5, Math.min(1, zx, zy));
}
