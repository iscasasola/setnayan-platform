/**
 * 🌗 THE COVER SCENE'S Darker ↔ Lighter, ON THE MAKER CANVAS WHILE THE THUMB MOVES — the frame side.
 *
 * Owner 2026-10-17 on cale-ice: *"darker lighter not showing"* — he moved the bar over his sunset clip and the cover
 * did not move with it. The approved prototype (`cover_scene_edit_animate_2026-10-16.html`) repaints the ground on
 * every `input` of the bar; the Maker sent nothing until the thumb was let go, and then waited on the save and a
 * redraw. Now the Maker posts the look at each position (`coverShadeLook`, `lib/cover-scene.ts` — the very functions
 * `coverSceneLayer` renders with) and this lays it:
 *
 *   parent → frame  { source:'setnayan-editor', t:'coverShade', veil, scrim, tone }   the bar at a position
 *   parent → frame  { source:'setnayan-editor', t:'coverShade', off: true }           take it off (a refused save)
 *
 * 🔑 IT ADDS NO NODE TO WHAT REACT DREW. The ground is ONE `<style>` this file owns: the drawn shade and scrim are
 * hidden and the look is painted by the ground's own box's `::after` — after every child, so ABOVE the clip and its
 * still, exactly where `CoverSceneGround` lays its veil. The words' tone is the cover's own four ink variables on its
 * header (`COVER_SCENE_CREAM_VARS`), its `style` attribute kept aside first and put back exactly. The bridge undoes
 * both in the very commit that draws the server's render (`undoLaidPreviews`), so the saved shade replaces the
 * preview without a blink, and React finds every node as it left it.
 *
 * 🔒 NOTHING FROM THE MESSAGE BECOMES CSS UNCHECKED: a colour is a 6-digit hex, an opacity a number 0–1, the tone one
 * of two words. Tiny and dependency-free: it ships in the guest page's bundle, behind the bridge.
 */

export type CoverShadePreview = {
  veil: { color: string; opacity: number } | null;
  scrim: { color: string; opacity: number };
  tone: 'ink' | 'cream';
};

/** The style's own mark — the bridge and the guard find it by it. */
export const COVER_SHADE_PREVIEW_ATTR = 'data-cover-shade-preview';
/** The cover's four ink variables (`COVER_SCENE_CREAM_VARS`, `cover-scene-ground.tsx`) — spelled out: this file imports nothing. */
const INK_VARS = ['--color-ink', '--color-mulberry', '--color-mulberry-600', '--color-gild-text'] as const;
const PAPER_CHANNELS = '251 250 247';

const HEX = /^#[0-9a-fA-F]{6}$/;
function layer(raw: unknown): { color: string; opacity: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const { color, opacity } = raw as { color?: unknown; opacity?: unknown };
  if (typeof color !== 'string' || !HEX.test(color)) return null;
  if (typeof opacity !== 'number' || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) return null;
  return { color, opacity };
}

/** A message → the look to lay, `'off'`, or null (not one of ours / malformed — ignored). */
export function sanitizeCoverShadePreview(raw: unknown): CoverShadePreview | 'off' | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as { off?: unknown; veil?: unknown; scrim?: unknown; tone?: unknown };
  if (m.off === true) return 'off';
  const scrim = layer(m.scrim);
  if (!scrim || (m.tone !== 'ink' && m.tone !== 'cream')) return null;
  const veil = m.veil === null || m.veil === undefined ? null : layer(m.veil);
  if (m.veil && !veil) return null;
  return { veil, scrim, tone: m.tone };
}

const rgba = (hex: string, a: number) =>
  `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${Math.round(a * 1000) / 1000})`;
const flat = (c: string) => `linear-gradient(${c},${c})`;

/**
 * The style's text: the drawn shade and scrim hidden, and the look painted over every child of the ground's box (the
 * scrim on top of the veil — the page's own order).
 */
export function coverShadePreviewCss(p: CoverShadePreview): string {
  const layers = [p.scrim.opacity > 0 ? flat(rgba(p.scrim.color, p.scrim.opacity)) : null, p.veil && p.veil.opacity > 0 ? flat(rgba(p.veil.color, p.veil.opacity)) : null].filter(Boolean);
  const g = '[data-cover-scene-ground]';
  return (
    `${g} [data-cover-scene-shade],${g} [data-cover-scene-scrim]{display:none!important}` +
    `${g}>div::after{content:"";position:absolute;inset:0;pointer-events:none;background-image:${layers.length ? layers.join(',') : 'none'}}`
  );
}

/** Where the header's own `style` attribute is kept while the preview's tone is on it ("" — it had none). */
const KEPT = 'data-cover-shade-kept';

/** Lay the look on this page's cover (if it has a Cover Scene ground). Returns whether it was laid. */
export function applyCoverShadePreview(doc: Document, p: CoverShadePreview): boolean {
  const header = doc.querySelector<HTMLElement>('header[data-cover-scene]');
  if (!header || !header.querySelector('[data-cover-scene-ground]')) return false;
  /* 🖋 The words' tone, as the page sets it: the four ink variables on the header in the paper (cream), or none (ink). */
  if (!header.hasAttribute(KEPT)) header.setAttribute(KEPT, header.getAttribute('style') ?? '');
  for (const v of INK_VARS) {
    if (p.tone === 'cream') header.style.setProperty(v, PAPER_CHANNELS);
    else header.style.removeProperty(v);
  }
  let style = doc.head.querySelector<HTMLStyleElement>(`style[${COVER_SHADE_PREVIEW_ATTR}]`);
  if (!style) {
    style = doc.createElement('style');
    style.setAttribute(COVER_SHADE_PREVIEW_ATTR, '');
    doc.head.appendChild(style);
  }
  style.textContent = coverShadePreviewCss(p);
  return true;
}

/** Take the look off — the server's render (the saved shade) is about to be on screen, or the save was refused. */
export function undoCoverShadePreview(doc: Document): void {
  doc.head.querySelector(`style[${COVER_SHADE_PREVIEW_ATTR}]`)?.remove();
  const header = doc.querySelector<HTMLElement>(`header[${KEPT}]`);
  if (!header) return;
  const was = header.getAttribute(KEPT);
  if (!was) header.removeAttribute('style');
  else header.setAttribute('style', was);
  header.removeAttribute(KEPT);
}
