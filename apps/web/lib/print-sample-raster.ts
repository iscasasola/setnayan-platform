/**
 * lib/print-sample-raster.ts — THE FREE SAMPLE: a flattened, watermarked,
 * low-resolution JPEG. Never a PDF, never a vector.
 *
 * Owner, 2026-09-25, verbatim: *"print outs are pro feature. but we can show
 * them a sample. just compressed so not print ready"* → *"make sure sample has a
 * watermark as sample so they cannot simply edit and remove watermark easily"*
 * → *"and make it low res"*.
 *
 * So a sample is rendered HERE, on the server, and the only thing that leaves
 * is pixels:
 *   · the piece's one layout (lib/print-layout.ts) is drawn to SVG, the tiled
 *     "SAMPLE · SETNAYAN" watermark is laid OVER it, and the lot is flattened by
 *     sharp into one JPEG — there is no element to delete in devtools, no layer
 *     to hide in a PDF editor, no vector to un-group;
 *   · every QR on a sample is a NON-SCANNABLE placeholder pattern (no finder
 *     squares, a "SAMPLE" band across it), so a sample cannot be printed and
 *     handed out as a working invitation or pass;
 *   · the long edge is capped at `SAMPLE_LONG_EDGE_PX` and the quality at
 *     `SAMPLE_JPEG_QUALITY` — clear on a phone, visibly soft on paper.
 *
 * 🔒 THIS FILE CANNOT MAKE A PRINT-READY FILE. It does not import the PDF
 * renderer, and `lib/print-pieces.test.ts` holds that it never will.
 *
 * Server-only in practice (sharp), but no `server-only` import, so the Node
 * test runner can rasterise a real sample and measure it.
 */
import { renderPrintSvg } from '@/lib/print-render-svg';
import { watermarkOps, type PrintDoc, type PrintImages } from '@/lib/print-layout';

/**
 * ~800 px on the long edge: enough to judge the design on a phone screen, but a
 * 5 × 7 card prints at ~114 dpi and an A5 at ~100 dpi — visibly soft on paper,
 * which is the point (owner: "make it low res"). A print shop wants 300.
 */
export const SAMPLE_LONG_EDGE_PX = 800;

/** JPEG quality ~60: compression artefacts a printer would reject, a screen forgives. */
export const SAMPLE_JPEG_QUALITY = 60;

/** Every image ref a layout uses for a QR code. */
export function isQrRef(ref: string): boolean {
  return ref === 'eventqr' || ref.startsWith('qr-');
}

let placeholderQr: Uint8Array | null = null;

/**
 * A QR-shaped pattern that no scanner can read: pseudo-random modules with NO
 * finder patterns (the three corner squares every decoder locks onto), and a
 * solid "SAMPLE" band through the middle. It looks like a code at a glance —
 * the design reads true — and opens nothing.
 */
export async function placeholderQrPng(): Promise<Uint8Array> {
  if (placeholderQr) return placeholderQr;
  const n = 29;
  const cell = 10;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rects: string[] = [];
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (rand() > 0.52) rects.push(`<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`);
    }
  }
  const size = n * cell;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" fill="#faf7f2"/><g fill="#1a1a1a">${rects.join('')}</g>` +
    `<rect x="0" y="${size * 0.4}" width="${size}" height="${size * 0.2}" fill="#faf7f2"/>` +
    `<rect x="0" y="${size * 0.46}" width="${size}" height="${size * 0.08}" fill="#1a1a1a"/>` +
    `</svg>`;
  const sharp = (await import('sharp')).default;
  placeholderQr = new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer());
  return placeholderQr;
}

/** The images a SAMPLE may carry: every QR swapped for the placeholder. */
export async function sampleImages(images: PrintImages): Promise<PrintImages> {
  const fake = await placeholderQrPng();
  const out: PrintImages = {};
  for (const [ref, img] of Object.entries(images)) {
    out[ref] = isQrRef(ref) ? { bytes: fake, mime: 'image/png' } : img;
  }
  return out;
}

/** The SVG a sample is flattened from: the design, then the watermark OVER it. */
export function sampleSvg(doc: PrintDoc, images: PrintImages): string {
  const marked: PrintDoc = { ...doc, ops: [...doc.ops, ...watermarkOps(doc.w, doc.h)] };
  return renderPrintSvg(marked, images, { idPrefix: `s-${doc.piece}` });
}

/** One piece → one flattened, watermarked, low-resolution JPEG. */
export async function renderSampleJpeg(doc: PrintDoc, images: PrintImages): Promise<Uint8Array> {
  const sharp = (await import('sharp')).default;
  const svg = sampleSvg(doc, await sampleImages(images));
  const long = Math.max(doc.w, doc.h);
  // Rasterise at exactly the density that lands the long edge on the cap.
  const density = Math.max(24, (72 * SAMPLE_LONG_EDGE_PX) / long);
  const flat = await sharp(Buffer.from(svg), { density })
    .resize({ width: SAMPLE_LONG_EDGE_PX, height: SAMPLE_LONG_EDGE_PX, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: SAMPLE_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  return new Uint8Array(flat);
}

/** The whole set as ONE contact sheet — still a single flattened JPEG under the cap. */
export async function renderSampleSheetJpeg(docs: PrintDoc[], images: PrintImages): Promise<Uint8Array> {
  const sharp = (await import('sharp')).default;
  const tiles = await Promise.all(docs.map((d) => renderSampleJpeg(d, images)));
  const cols = 3;
  const rows = Math.ceil(tiles.length / cols);
  const pad = 12;
  const cellW = Math.floor((SAMPLE_LONG_EDGE_PX - pad * (cols + 1)) / cols);
  const cellH = Math.floor(cellW * 1.4);
  const resized = await Promise.all(
    tiles.map((t) => sharp(Buffer.from(t)).resize({ width: cellW, height: cellH, fit: 'inside' }).toBuffer({ resolveWithObject: true })),
  );
  const width = SAMPLE_LONG_EDGE_PX;
  const height = Math.min(SAMPLE_LONG_EDGE_PX, rows * cellH + pad * (rows + 1));
  const composite = resized.map((r, i) => ({
    input: r.data,
    left: pad + (i % cols) * (cellW + pad) + Math.floor((cellW - r.info.width) / 2),
    top: pad + Math.floor(i / cols) * (cellH + pad) + Math.floor((cellH - r.info.height) / 2),
  }));
  const out = await sharp({ create: { width, height, channels: 3, background: '#efece6' } })
    .composite(composite)
    .jpeg({ quality: SAMPLE_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  return new Uint8Array(out);
}
