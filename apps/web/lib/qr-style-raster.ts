// NOTE: deliberately NOT 'server-only' — loaded only behind lib/qr.ts's own
// dynamic import, from server renderers, and left unmarked so `tsx --test` can
// rasterise a REAL styled code and DECODE it (lib/every-qr-look-decodes.test.ts).
// `sharp` is imported statically for the reason lib/qr-monogram-raster.ts
// records: the dynamic-inside-dynamic form did not reach production.

import sharp from 'sharp';
import { styledQrSvg } from '@/lib/qr-style-svg';
import { monogramTextToPathRenderer } from '@/lib/qr-monogram-raster';
import type { QrLook } from '@/lib/qr-look';

/**
 * lib/qr-style-raster.ts — the SAVED picture of a styled QR.
 *
 * One SVG (lib/qr-style-svg.ts), rasterised whole. A lettered centre is drawn
 * as opentype outlines (`monogramTextToPathRenderer`), never as a `<text>`
 * element, because librsvg's font path is flaky on Vercel and a font request
 * that fails draws NOTHING with no error — the couple would save a blank cream
 * disc in the middle of their invitation. The Setnayan mark and the couple's
 * drawn logo are paths already, so the markup sharp sees contains no font
 * request at all; a logo that carries `<text>` is refused upstream
 * (qrLookFor) for exactly this reason.
 *
 * The screen and the file are the same string apart from `renderText`, so the
 * picture a guest saves is the picture they were shown.
 */
export async function styledQrPng(text: string, look: QrLook, width: number): Promise<Buffer> {
  const svg = styledQrSvg(text, look, { width, renderText: monogramTextToPathRenderer });
  return sharp(Buffer.from(svg)).png().toBuffer();
}
