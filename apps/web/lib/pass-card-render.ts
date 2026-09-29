/**
 * lib/pass-card-render.ts — the pass card, flattened to the PNG a guest saves.
 *
 * The drawing is `layoutPassCard` (lib/print-layout.ts) — the SAME operations
 * the `phone-card` print format lays on paper (as a vector PDF, through the
 * prints path). This file only turns that one drawing into pixels: the screen
 * SVG (`renderPrintSvg`, type already outlines, images inlined) rasterised by
 * sharp at exactly the density that lands the card on 1080 × 1440.
 *
 * 🔑 THE CUT IS KEPT. Outside the card's die — its rounded corners, and the
 * ticket's two notches — the PNG is transparent, so the saved picture is the
 * shape of the card (the prototype: "the notches are transparent in the PNG, so
 * it reads as a ticket even in Photos").
 *
 * Owner 2026-09-29: "print outs are PDF. digital versions are png" — this is
 * the ONLY way a pass card becomes a PNG, and nothing prints from it.
 *
 * Not `server-only` (sharp is a dynamic import) so the Node test runner can
 * render a real card, measure it and decode its QR.
 */
import { renderPrintSvg } from '@/lib/print-render-svg';
import type { PrintDoc, PrintImages } from '@/lib/print-layout';
import { PASS_CARD_PX } from '@/lib/pass-card';

export async function renderPassCardPng(doc: PrintDoc, images: PrintImages): Promise<Uint8Array> {
  const sharp = (await import('sharp')).default;
  const svg = renderPrintSvg(doc, images, { idPrefix: 'pass-card' });
  const density = (72 * PASS_CARD_PX.w) / doc.w;
  const png = await sharp(Buffer.from(svg), { density })
    .resize({ width: PASS_CARD_PX.w, height: PASS_CARD_PX.h, fit: 'fill' })
    .ensureAlpha()
    .png({ compressionLevel: 8 })
    .toBuffer();
  return new Uint8Array(png);
}
