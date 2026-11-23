/**
 * lib/day-poster-file.ts — 🖼 THE OUR DAY POSTER'S FREE FILE: the poster flattened to pixels at A4 ≈ 200 dpi
 * (`DAY_POSTER_FREE_PX`) and laid on one A4 page. There is no vector to scale: enlarged at a print shop it comes out soft
 * (owner 2026-11-13, *"if they did free and they went on a larger scale, the print will be soft. but crisp when on event
 * hub pro"*). No watermark. The route draws it for an event without Event Pro (`dayPosterFileIsFlat`).
 *
 * Server-only in practice (sharp), but no `server-only` import, so the Node test runner can rasterise a real one and
 * measure it (`lib/day-poster.test.ts` — the build guard: never more pixels than A4 at 200 dpi).
 */
import { renderPrintSvg } from '@/lib/print-render-svg';
import type { PrintDoc, PrintImages } from '@/lib/print-layout';
import { DAY_POSTER_FREE_PX, DAY_POSTER_KEY } from '@/lib/day-poster';

export async function flatDayPosterPdf(doc: PrintDoc, images: PrintImages, title: string): Promise<{ pdf: Uint8Array; px: { w: number; h: number } }> {
  const sharp = (await import('sharp')).default;
  const svg = renderPrintSvg({ ...doc, bleed: 0 }, images);
  const density = (72 * DAY_POSTER_FREE_PX.w) / doc.w;
  const jpeg = await sharp(Buffer.from(svg), { density })
    .resize({ width: DAY_POSTER_FREE_PX.w, height: DAY_POSTER_FREE_PX.h, fit: 'fill' })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  const page: PrintDoc = { piece: DAY_POSTER_KEY, w: doc.w, h: doc.h, bleed: 0, die: 'rect', diePath: '', ops: [{ t: 'image', ref: 'flat', x: 0, y: 0, w: doc.w, h: doc.h }] };
  // ⚡ The PDF writer loads when the file is asked for (the speed pass's rule, `print-drawers-on-demand.ts`).
  const { renderPrintPdf } = await import('@/lib/print-render-pdf');
  const pdf = await renderPrintPdf([page], { flat: { bytes: new Uint8Array(jpeg.data), mime: 'image/jpeg' } }, { mode: 'plain', title, subject: 'Our Day poster · A4 · free' });
  return { pdf, px: { w: jpeg.info.width, h: jpeg.info.height } };
}
