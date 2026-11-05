/**
 * 📐 THE FILM'S MONOGRAM FITS THE SCREEN IT IS ON (sweep 2026-10-19, row B5).
 *
 * The Save the Date film draws its opening lockup at a fixed `scale-[2.7]` on a
 * 440-wide stage, and the stage is scaled to fit the screen. On a phone the stage
 * IS the screen, and the couple's lockup paints wider than its own box: the
 * `bar` mark's viewBox is cropped tight to its glyphs and draws with
 * `overflow: visible`, so an italic capital's outer serif lands past the svg's
 * right edge. On marco-marga at 375 the svg box measured 30..345 and the ink ran
 * to 375 and beyond — the second M was cut by the screen.
 *
 * The cure is the screen's, not the mark's: on a screen with room (a desktop is
 * height-bound, so its stage has free width either side) the lockup keeps its
 * full size; only where the ink would cross the edge does it come down, by
 * exactly as much as it needs to stand `FILM_INK_GUTTER_PX` inside it.
 *
 * Two halves: `fitLockupScale` (pure — the number) and `measureLockupInk` (DOM —
 * where the ink really is, glyph overhang included, measured with the canvas's
 * own glyph metrics because an svg <text>'s box is its advance, not its ink).
 */

/** The clear space, in screen px, the ink keeps from each edge of the screen. */
export const FILM_INK_GUTTER_PX = 16;

export type LockupInk = {
  /** How far the ink reaches LEFT of the lockup's centre, at the lockup's own (unscaled) size. */
  left: number;
  /** How far the ink reaches RIGHT of the lockup's centre, at the lockup's own (unscaled) size. */
  right: number;
};

/**
 * The lockup's scale on this screen: `base` when the ink fits, otherwise the
 * largest scale at which the wider side of the ink stands the gutter inside the
 * room. Never larger than `base`; never non-finite (bad input → `base`).
 *
 * @param base      the beat's designed scale (2.7 for the opening beat)
 * @param fitScale  the stage's own scale on this screen
 * @param roomW     the width the film is drawn into, in screen px (the screen, on the live page)
 * @param ink       the ink's reach either side of the centre, unscaled
 */
export function fitLockupScale(base: number, fitScale: number, roomW: number, ink: LockupInk | null): number {
  if (!ink || !(fitScale > 0) || !(roomW > 0)) return base;
  const reach = Math.max(ink.left, ink.right);
  if (!(reach > 0) || !Number.isFinite(reach)) return base;
  const half = roomW / 2 - FILM_INK_GUTTER_PX;
  if (!(half > 0)) return base;
  const fits = half / (fitScale * reach);
  return Math.min(base, Math.floor(fits * 1000) / 1000);
}

const ALIGN: Record<string, CanvasTextAlign> = { middle: 'center', start: 'left', end: 'right' };

/**
 * 🍎 THE FLOOR UNDER SAFARI'S GLYPH METRICS. WebKit's canvas `measureText` reports
 * `actualBoundingBoxLeft/Right` as the glyph's ADVANCE (measured 2026-10-19 on the
 * Playwright WebKit build: Cormorant italic "M" at 64px → 27.2 / 27.2, exactly half
 * its 54.4 advance), so on an iPhone the italic overhang is invisible to it. Chromium
 * measures the real ink: 25.4 left / 35.1 right — the italic reaches 7.9px (0.12em)
 * past the advance on the right, which is the slant (cap height ≈ 0.65em × tan ≈ 11°).
 * So the ink taken is the LARGER of the engine's figure and the advance — plus, for
 * italic type, this much on the side the slant leans to. 0.15em sits above the
 * measured 0.12em, so Safari errs a few px small, never off the screen.
 */
export const ITALIC_OVERHANG_EM = 0.15;

/**
 * Where the lockup's ink really reaches, either side of its centre, at its own
 * unscaled size. `el` is the element the scale transform is applied to; its
 * `offsetWidth` is its layout width, which no transform touches, so every
 * client-rect is divided back into that frame (a uniform scale — the stage's,
 * the beat's bloom, the lockup's own — preserves the ratios this relies on).
 *
 * Ink = the union of the element's box, each svg's box, and every svg <text>'s
 * GLYPH ink (canvas `measureText` actual bounds at the text's own font, floored
 * by its advance and italic lean — `ITALIC_OVERHANG_EM`), which is what an
 * italic capital's overhang needs. Returns null when nothing is laid
 * out yet (no width) or when run outside a browser.
 */
export function measureLockupInk(el: HTMLElement | null): LockupInk | null {
  if (!el || typeof document === 'undefined') return null;
  const box = el.getBoundingClientRect();
  const layoutW = el.offsetWidth;
  if (!(box.width > 0) || !(layoutW > 0)) return null;
  const k = box.width / layoutW; // client px per layout px (every transform above and on el)
  let inkL = box.left;
  let inkR = box.right;
  const ctx = document.createElement('canvas').getContext('2d');
  for (const svg of Array.from(el.querySelectorAll('svg'))) {
    const r = svg.getBoundingClientRect();
    if (!(r.width > 0)) continue;
    inkL = Math.min(inkL, r.left);
    inkR = Math.max(inkR, r.right);
    const vb = (svg as SVGSVGElement).viewBox?.baseVal;
    if (!ctx || !vb || !(vb.width > 0)) continue;
    const ppu = r.width / vb.width; // client px per user unit
    for (const t of Array.from(svg.querySelectorAll('text'))) {
      const s = getComputedStyle(t);
      const x = parseFloat(t.getAttribute('x') ?? '');
      if (!Number.isFinite(x)) continue;
      ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      const align = ALIGN[s.textAnchor] ?? 'left';
      ctx.textAlign = align;
      const m = ctx.measureText(t.textContent ?? '');
      // The advance either side of the anchor, and the italic lean on the right (see ITALIC_OVERHANG_EM).
      const advL = align === 'center' ? m.width / 2 : align === 'right' ? m.width : 0;
      const advR = align === 'center' ? m.width / 2 : align === 'left' ? m.width : 0;
      const lean = /italic|oblique/.test(s.fontStyle) ? ITALIC_OVERHANG_EM * (parseFloat(s.fontSize) || 0) : 0;
      const left = Math.max(m.actualBoundingBoxLeft || 0, advL);
      const right = Math.max(m.actualBoundingBoxRight || 0, advR + lean);
      inkL = Math.min(inkL, r.left + (x - left - vb.x) * ppu);
      inkR = Math.max(inkR, r.left + (x + right - vb.x) * ppu);
    }
  }
  const centre = box.left + box.width / 2;
  return { left: (centre - inkL) / k, right: (inkR - centre) / k };
}
