/**
 * Small pure helpers the seal plaque uses on its mounted art (v86, owner 15 Nov). Colours live here, not in the `.tsx`.
 *
 *   · `prefixSvgIds` — owner: *"something is wrong with the seal"*: the plaque's copy shared its gradient ids with
 *     another copy on the page, so Chrome painted the face and ribbon from the other one. Every copy gets its own ids.
 *   · `glintSpots` — owner: *"diamonds are not sparkling randomly / velvet still sparkles"*: no fixed sparkles any more.
 *     A glint lands on a random visible DIAMOND (No. 1's `.dmd`, the lowest hidden by the banner) or on a random stud of
 *     the bead ring (every other seal), never on the velvet.
 *   · `logoWatermarkRings` — v86 `shopLogoWatermark`'s gold rings (the logo itself is drawn in gold by the plaque's CSS).
 */

/** Every `id`, and every `url(#…)` / `href="#…"` that names one, gets `p` in front. */
export function prefixSvgIds(svg: string, p: string): string {
  const ids = new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!));
  if (!ids.size) return svg;
  return svg
    .replace(/\sid="([^"]+)"/g, ` id="${p}$1"`)
    .replace(/url\(#([^)]+)\)/g, (m, i: string) => (ids.has(i) ? `url(#${p}${i})` : m))
    .replace(/href="#([^"]+)"/g, (m, i: string) => (ids.has(i) ? `href="#${p}${i}"` : m));
}

/** The bead ring every other seal is studded with (the prototype's selector). */
export const BEAD_RING_SELECTOR = 'circle[stroke-dasharray][stroke="#e8c66c"]';

/**
 * Where a glint may land, in the mount's own (unscaled) px: the centres of No. 1's visible diamonds, else 40 points on
 * the bead ring's upper part. Empty when the art has neither (then nothing glints — nothing is invented).
 */
export function glintSpots(mnt: HTMLElement): Array<[number, number]> {
  const rb = mnt.getBoundingClientRect();
  if (!rb.width || !mnt.offsetWidth) return [];
  const kx = mnt.offsetWidth / rb.width;
  const ky = mnt.offsetHeight / rb.height;
  const L = (x: number, y: number): [number, number] => [(x - rb.left) * kx, (y - rb.top) * ky];
  const dm = [...mnt.querySelectorAll('.dmd')].filter((e) => {
    const m = /translate\(([\d.]+) ([\d.]+)\)/.exec(e.getAttribute('transform') || '');
    return !m || +m[2]! < 80; // the banner hides the lowest diamonds
  });
  if (dm.length)
    return dm.map((e) => {
      const r = e.getBoundingClientRect();
      return L(r.left + r.width / 2, r.top + r.height / 2);
    });
  const ring = mnt.querySelector<SVGCircleElement>(BEAD_RING_SELECTOR);
  const M = ring?.getScreenCTM?.();
  if (!ring || !M) return [];
  const cx = +(ring.getAttribute('cx') || 0);
  const cy = +(ring.getAttribute('cy') || 0);
  const R = +(ring.getAttribute('r') || 0);
  return Array.from({ length: 40 }, (_, i) => i)
    .filter((i) => Math.sin((i / 40) * 6.283) < 0.45)
    .map((i) => {
      const q = new DOMPoint(cx + R * Math.cos((i / 40) * 6.283), cy + R * Math.sin((i / 40) * 6.283)).matrixTransform(M);
      return L(q.x, q.y);
    });
}

/** v86 `shopLogoWatermark`: the two gold rings round the shop's logo (400×400). */
export function logoWatermarkRings(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" aria-hidden="true"><defs><linearGradient id="wm_gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1c0"/><stop offset=".5" stop-color="#d9a93f"/><stop offset="1" stop-color="#8a6214"/></linearGradient></defs><circle cx="200" cy="200" r="190" fill="none" stroke="url(#wm_gd)" stroke-width="3"/><circle cx="200" cy="200" r="178" fill="none" stroke="url(#wm_gd)" stroke-width="1"/></svg>`;
}
