/**
 * lib/print-render-svg.ts — the ON-SCREEN sample of a print piece.
 *
 * Draws a `PrintDoc` (lib/print-layout.ts) as one self-contained SVG — images
 * inlined as data URIs, type already outlines — so the Maker can show it in an
 * `<img>` and a couple can see their own names on the finished card (owner
 * 2026-09-25: "seeing their own names on a finished card is the strongest
 * reason to unlock").
 *
 * The screen render is the sheet as it will be CUT: clipped to the theme's die
 * shape, no bleed, no spot layers. ⚠ A vector is only ever served to a couple
 * who holds Event Hub Pro. A free couple's screen copy is the flattened,
 * watermarked JPEG `lib/print-sample-raster.ts` rasterises FROM this SVG — the
 * SVG itself never leaves the server for them (the watermark would be an
 * element anyone could delete).
 *
 * Pure string work — no I/O.
 */
import type { PrintDoc, PrintImages, PrintOp } from '@/lib/print-layout';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const n = (v: number) => String(Math.round(v * 100) / 100);

function op(o: PrintOp, images: PrintImages, clipId: string): string {
  const opacity = 'opacity' in o && o.opacity !== undefined && o.opacity < 1 ? ` opacity="${n(o.opacity)}"` : '';
  switch (o.t) {
    case 'rect': {
      const fill = o.fill ? ` fill="${esc(o.fill)}"` : ' fill="none"';
      const stroke = o.stroke ? ` stroke="${esc(o.stroke)}" stroke-width="${n(o.sw ?? 0.5)}"${o.dash ? ' stroke-dasharray="3 2"' : ''}` : '';
      return `<rect x="${n(o.x)}" y="${n(o.y)}" width="${n(o.w)}" height="${n(o.h)}"${fill}${stroke}${opacity}/>`;
    }
    case 'circle': {
      const fill = o.fill ? ` fill="${esc(o.fill)}"` : ' fill="none"';
      const stroke = o.stroke ? ` stroke="${esc(o.stroke)}" stroke-width="${n(o.sw ?? 0.5)}"${o.dash ? ' stroke-dasharray="2.5 2"' : ''}` : '';
      return `<circle cx="${n(o.cx)}" cy="${n(o.cy)}" r="${n(o.r)}"${fill}${stroke}${opacity}/>`;
    }
    case 'path': {
      const fill = o.fill ? ` fill="${esc(o.fill)}"` : ' fill="none"';
      const stroke = o.stroke ? ` stroke="${esc(o.stroke)}" stroke-width="${n(o.sw ?? 0.5)}"` : '';
      return `<path d="${esc(o.d)}"${fill}${stroke}${opacity}/>`;
    }
    case 'image': {
      const img = images[o.ref];
      if (!img) return '';
      const href = `data:${img.mime};base64,${Buffer.from(img.bytes).toString('base64')}`;
      // Cover-crop into the box, the way the paper crops the still.
      const id = `${clipId}-${o.ref.replace(/[^a-z0-9]/gi, '')}-${Math.round(o.x)}-${Math.round(o.y)}`;
      return (
        `<clipPath id="${id}"><rect x="${n(o.x)}" y="${n(o.y)}" width="${n(o.w)}" height="${n(o.h)}"/></clipPath>` +
        `<image href="${href}" x="${n(o.x)}" y="${n(o.y)}" width="${n(o.w)}" height="${n(o.h)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"${opacity}/>`
      );
    }
  }
}

export function renderPrintSvg(doc: PrintDoc, images: PrintImages, opts: { idPrefix?: string } = {}): string {
  const id = opts.idPrefix ?? `p-${doc.piece}`;
  const body = doc.ops.map((o) => op(o, images, id)).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(doc.w)} ${n(doc.h)}" width="${n(doc.w)}" height="${n(doc.h)}">` +
    `<defs><clipPath id="${id}-die"><path d="${doc.diePath}"/></clipPath></defs>` +
    `<g clip-path="url(#${id}-die)">${body}</g>` +
    `</svg>`
  );
}
