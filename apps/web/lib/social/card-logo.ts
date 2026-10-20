import sharp from 'sharp';

/**
 * card-logo.ts — THE LINK PREVIEW WEARS THE COUPLE'S OWN LOGO.
 *
 * Owner, 2026-10-20, verbatim: *"the link sent did not use the logo of cale-ice on the thumbnail"*. Measured on
 * production: `/cale-ice` published `og:image = /api/og/realstory-slug/cale-ice?v=…`, and that picture drew the
 * TYPED initials "IC" in terracotta — while the couple's cover and their pass's QR centre draw the I&C logo they
 * made. The route never read the logo at all: its select named `monogram_text` and `monogram_color` only.
 *
 * ⚖ DECISION_LOG 2026-10-15 (4): the Studio Logo switch (`events.logo_wanted`) is REAL — on ⇒ the couple's logo
 * shows; off ⇒ it shows nowhere. The share card is one more place a stranger sees the couple's mark, so it follows
 * the SAME rule through the SAME resolver the cover uses (`heroMarkSvg` → `resolveEventMonogramSvg`), which owns
 * the switch, the read-time safety gate, the centring on the logo's ink and the mood-board repaint. Nothing here
 * decides whether a logo may be shown; this module only turns an already-resolved mark into pixels.
 *
 * 🔑 NEVER A BROKEN PICTURE. A share card is the one image a whole chat sees, so each way a logo can fail to draw
 * returns `null`, and the card draws the initials it drew before this existed:
 *   • no mark (unset, switched off, or refused by the safety gate) — the caller passes null;
 *   • a mark sharp cannot rasterise (it throws);
 *   • a mark that rasterises to NOTHING (every pixel transparent — e.g. paths with no fill) — a blank box is a
 *     broken picture that does not look like one;
 *   • a raster that takes longer than `CARD_LOGO_TIMEOUT_MS` (the route's whole budget is `maxDuration = 30`).
 * The logo lives in the event row itself (an inline SVG; an uploaded raster is stored as a base64 wrapper), so
 * there is no storage fetch to bound — the only wait is sharp's own work, and that is what the limit covers.
 *
 * 🔑 THE NODE PUTS `src` AT THE TOP LEVEL, on purpose. satori reads an <img>'s `src`, `width` and `height` from
 * `props`, NOT from `props.style` — the card files' `el(type, style, children)` helper would put them in the wrong
 * place, and `vendor-card.test.ts` records the production outage that caused ("Image source is not provided", every
 * shop with a logo 302'd to the brand card). `cardLogoNode` builds the node itself, so it cannot repeat that.
 */

/** The box the logo is drawn into on the 1200×630 card — where the 156 px initials sat, a little taller. */
export const CARD_LOGO_BOX = { width: 480, height: 210 } as const;

/** How long a logo may take to rasterise before the card gives up on it and draws the initials. */
export const CARD_LOGO_TIMEOUT_MS = 4000;

export type CardLogo = {
  /** `data:image/png;base64,…` — an inert raster, never the SVG itself. */
  src: string;
  width: number;
  height: number;
};

/** The longest side of an SVG's viewBox, or 0 when it has none we can read. */
function viewBoxLongest(svg: string): number {
  const vb = /viewBox\s*=\s*"\s*-?[\d.]+[\s,]+-?[\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/i.exec(svg);
  return vb ? Math.max(Number(vb[1]), Number(vb[2])) : 0;
}

async function rasterise(svg: string, box: { width: number; height: number }): Promise<CardLogo | null> {
  // Drawn at least as large as the box: a Logo-editor composition can have a viewBox of a few hundred units, which
  // at sharp's default 72 dpi would be drawn small and blown up soft (lib/social/card.tsx learned this first).
  const longest = viewBoxLongest(svg);
  const target = Math.max(box.width, box.height);
  const density = longest > 0 ? Math.min(2400, Math.max(72, (72 * target) / longest)) : 72;
  const { data, info } = await sharp(Buffer.from(svg), { density })
    // Cut to what the logo actually draws, so a mark on a big empty artboard is not drawn tiny in the middle of it.
    .trim()
    .resize(box.width, box.height, { fit: 'inside' })
    .png()
    .toBuffer({ resolveWithObject: true });
  const stats = await sharp(data).stats();
  const alpha = stats.channels[3];
  // No alpha channel means sharp drew an opaque picture, which has ink by definition; with one, at least one pixel
  // must be visible.
  if (alpha && alpha.max === 0) return null;
  return { src: `data:image/png;base64,${data.toString('base64')}`, width: info.width, height: info.height };
}

/**
 * The couple's resolved mark → the picture the share card draws, or `null` for "draw the initials".
 * Pass the output of `heroMarkSvg(row)` — never a raw column (that would skip the switch and the safety gate).
 */
export async function cardLogoImage(
  markSvg: string | null | undefined,
  opts?: { timeoutMs?: number; box?: { width: number; height: number } },
): Promise<CardLogo | null> {
  if (!markSvg || typeof markSvg !== 'string') return null;
  const box = opts?.box ?? CARD_LOGO_BOX;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), opts?.timeoutMs ?? CARD_LOGO_TIMEOUT_MS);
  });
  try {
    return await Promise.race([rasterise(markSvg, box).catch(() => null), late]);
  } finally {
    clearTimeout(timer);
  }
}

/** The satori node for a rasterised logo — `src`/`width`/`height` as top-level props (see the header). */
export function cardLogoNode(logo: CardLogo): { type: 'img'; props: Record<string, unknown> } {
  return {
    type: 'img',
    props: {
      src: logo.src,
      width: logo.width,
      height: logo.height,
      style: { width: `${logo.width}px`, height: `${logo.height}px` },
    },
  };
}
