/**
 * lib/print-render-pdf.ts — a print piece as a PDF, with pdf-lib.
 *
 * Draws the SAME `PrintDoc` the Maker shows on screen (lib/print-layout.ts),
 * so the file is the card the couple approved. Owner 2026-09-25, "EVERY PRINT
 * IS FREE IN THE CLASSIC LOOK; THE THEMED VERSION IS PRO": a Classic piece is
 * drawn here in `print` mode for everyone, and so are the free group's plain
 * A4 documents; a THEMED piece reaches `print` mode only after the route's
 * `mayServe` says Pro. A free couple's themed samples are flattened JPEGs
 * (lib/print-sample-raster.ts), never this file.
 *
 *   · PRINT — NO watermark. 3 mm bleed with the paper and the still running
 *     into it, TrimBox + BleedBox set, crop marks in the slug, the full-
 *     resolution still, and the spot work on NAMED LAYERS a print shop expects
 *     (optional content groups): "Foil", "White ink", "Die cut". Layers show in
 *     Acrobat's Layers panel and can be separated on the press.
 *
 * Coordinates: the layout is top-left origin in points; pdf-lib's
 * `drawSvgPath` maps (px, py) → (x + px, y − py), so every op is drawn with
 * the page origin set to the sheet's top-left corner — no flipping by hand.
 */
import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFOperator,
  PDFOperatorNames,
  PDFString,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type PDFImage,
  type PDFPage,
  type PDFRef,
} from 'pdf-lib';
import { BLEED_MM, PRINT_PIECES, PT_PER_MM } from '@/lib/print-pieces';
import type { PrintDoc, PrintImages, PrintLayer, PrintOp } from '@/lib/print-layout';

/**
 * `print` = the Pro print-ready file. `plain` = the free do-it-yourself QR sheet (a usable
 * page, no marks, no layers). There is deliberately NO sample mode: a sample is never a
 * PDF — it is a flattened, watermarked JPEG (`lib/print-sample-raster.ts`).
 */
export type PdfMode = 'print' | 'plain';

/** Crop-mark slug around the bleed (print only). */
const SLUG_PT = 9 * PT_PER_MM;

const LAYER_NAMES: Record<PrintLayer, string> = { foil: 'Foil', white: 'White ink', die: 'Die cut' };

function hex(c: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  const v = m ? parseInt(m[1]!, 16) : 0;
  return rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255);
}

type Layers = Partial<Record<PrintLayer, PDFRef>>;

/** Register the optional content groups once per document. */
function registerLayers(pdf: PDFDocument): Layers {
  const refs: Layers = {};
  const all: PDFRef[] = [];
  for (const key of ['foil', 'white', 'die'] as const) {
    const ref = pdf.context.register(pdf.context.obj({ Type: 'OCG', Name: PDFString.of(LAYER_NAMES[key]) }));
    refs[key] = ref;
    all.push(ref);
  }
  pdf.catalog.set(
    PDFName.of('OCProperties'),
    pdf.context.obj({ OCGs: all, D: { Order: all, ON: all, Name: PDFString.of('Setnayan print layers') } }),
  );
  return refs;
}

/** Map a layer's short name into this page's /Properties so BDC can name it. */
function bindLayers(page: PDFPage, layers: Layers) {
  const { Resources } = page.node.normalizedEntries();
  const dict = page.doc.context.obj({}) as PDFDict;
  for (const [k, ref] of Object.entries(layers)) {
    if (ref) dict.set(PDFName.of(`OC_${k}`), ref);
  }
  Resources.set(PDFName.of('Properties'), dict);
}

function beginLayer(page: PDFPage, layer: PrintLayer) {
  page.pushOperators(PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [PDFName.of('OC'), PDFName.of(`OC_${layer}`)]));
}
function endLayer(page: PDFPage) {
  page.pushOperators(PDFOperator.of(PDFOperatorNames.EndMarkedContent));
}

async function embedImages(pdf: PDFDocument, images: PrintImages): Promise<Record<string, PDFImage>> {
  const out: Record<string, PDFImage> = {};
  for (const [ref, img] of Object.entries(images)) {
    if (!img) continue;
    out[ref] = img.mime === 'image/png' ? await pdf.embedPng(img.bytes) : await pdf.embedJpg(img.bytes);
  }
  return out;
}

function drawOp(page: PDFPage, o: PrintOp, ox: number, oy: number, pageH: number, imgs: Record<string, PDFImage>, mode: PdfMode) {
  // Top-left origin of the op space, in PDF user space.
  const X = (x: number) => ox + x;
  const Y = (y: number) => pageH - oy - y;
  const layer = mode === 'print' && 'layer' in o ? o.layer : undefined;
  if (layer) beginLayer(page, layer);
  switch (o.t) {
    case 'rect': {
      const common = {
        x: X(o.x),
        y: Y(o.y + o.h),
        width: o.w,
        height: o.h,
        opacity: o.opacity,
        borderOpacity: o.opacity,
      };
      if (o.fill && !o.stroke) page.drawRectangle({ ...common, color: hex(o.fill) });
      else
        page.drawRectangle({
          ...common,
          color: o.fill ? hex(o.fill) : undefined,
          borderColor: o.stroke ? hex(o.stroke) : undefined,
          borderWidth: o.sw ?? 0.5,
          borderDashArray: o.dash ? [3, 2] : undefined,
        });
      break;
    }
    case 'circle':
      page.drawCircle({
        x: X(o.cx),
        y: Y(o.cy),
        size: o.r,
        color: o.fill ? hex(o.fill) : undefined,
        borderColor: o.stroke ? hex(o.stroke) : undefined,
        borderWidth: o.stroke ? o.sw ?? 0.5 : 0,
        borderDashArray: o.dash ? [2.5, 2] : undefined,
        opacity: o.opacity,
        borderOpacity: o.opacity,
      });
      break;
    case 'path':
      page.drawSvgPath(o.d, {
        x: ox,
        y: pageH - oy,
        color: o.fill ? hex(o.fill) : undefined,
        borderColor: o.stroke ? hex(o.stroke) : undefined,
        borderWidth: o.stroke ? o.sw ?? 0.5 : 0,
        opacity: o.opacity,
        borderOpacity: o.opacity,
      });
      break;
    case 'image': {
      const img = imgs[o.ref];
      if (!img) break;
      // Cover-crop: scale to fill the box, centre, clip to the box.
      const s = Math.max(o.w / img.width, o.h / img.height);
      const dw = img.width * s;
      const dh = img.height * s;
      page.pushOperators(pushGraphicsState(), rectangle(X(o.x), Y(o.y + o.h), o.w, o.h), clip(), endPath());
      page.drawImage(img, { x: X(o.x) - (dw - o.w) / 2, y: Y(o.y + o.h) - (dh - o.h) / 2, width: dw, height: dh, opacity: o.opacity });
      page.pushOperators(popGraphicsState());
      break;
    }
  }
  if (layer) endLayer(page);
}

/** Crop marks at the four trim corners, in the slug (never inside the bleed). */
function cropMarks(page: PDFPage, ox: number, oy: number, w: number, h: number, pageH: number, bleed: number) {
  const len = SLUG_PT - 2;
  const k = rgb(0, 0, 0);
  const gap = bleed + 1.5;
  const corners: Array<[number, number, number, number]> = [
    [0, 0, -1, -1],
    [w, 0, 1, -1],
    [0, h, -1, 1],
    [w, h, 1, 1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    const x = ox + cx;
    const y = pageH - oy - cy;
    // horizontal
    page.drawLine({ start: { x: x + dx * gap, y }, end: { x: x + dx * (gap + len), y }, thickness: 0.25, color: k });
    // vertical (dy is in top-left terms, so flip for PDF)
    page.drawLine({ start: { x, y: y - dy * gap }, end: { x, y: y - dy * (gap + len) }, thickness: 0.25, color: k });
  }
}

/**
 * THE PER-GUEST BATCH, GANGED ON A4 — owner 2026-09-25: several passes per sheet
 * with cut lines, so a couple can print at home or at a shop. Each pass keeps
 * its full 3 mm bleed; neighbours sit bleed-to-bleed (a 6 mm gutter between
 * trims), and the cut lines run in the sheet's margins, one per trim edge, so a
 * guillotine can follow them. Layers and die lines are kept per pass.
 */
export async function renderImposedPdf(
  docs: PrintDoc[],
  images: PrintImages,
  opts: { cols: number; rows: number; landscape: boolean; title: string; subject?: string },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(opts.title);
  pdf.setCreator('Setnayan — Prints & Tickets');
  pdf.setProducer('Setnayan');
  if (opts.subject) pdf.setSubject(opts.subject);
  const layers = registerLayers(pdf);
  const imgs = await embedImages(pdf, images);
  const A4: [number, number] = [210 * PT_PER_MM, 297 * PT_PER_MM];
  const [pageW, pageH] = opts.landscape ? [A4[1], A4[0]] : A4;
  const perPage = opts.cols * opts.rows;
  const k = rgb(0, 0, 0);
  for (let start = 0; start < docs.length; start += perPage) {
    const batch = docs.slice(start, start + perPage);
    const first = batch[0]!;
    const bleed = first.bleed || BLEED_MM * PT_PER_MM;
    const stepX = first.w + 2 * bleed;
    const stepY = first.h + 2 * bleed;
    const gridW = opts.cols * stepX;
    const gridH = opts.rows * stepY;
    const x0 = (pageW - gridW) / 2 + bleed;
    const y0 = (pageH - gridH) / 2 + bleed;
    const page = pdf.addPage([pageW, pageH]);
    bindLayers(page, layers);
    batch.forEach((doc, i) => {
      const ox = x0 + (i % opts.cols) * stepX;
      const oy = y0 + Math.floor(i / opts.cols) * stepY;
      page.pushOperators(pushGraphicsState(), rectangle(ox - bleed, pageH - oy - doc.h - bleed, doc.w + 2 * bleed, doc.h + 2 * bleed), clip(), endPath());
      for (const o of doc.ops) drawOp(page, o, ox, oy, pageH, imgs, 'print');
      page.pushOperators(popGraphicsState());
      beginLayer(page, 'die');
      page.drawSvgPath(doc.diePath, { x: ox, y: pageH - oy, borderColor: rgb(1, 0, 1), borderWidth: 0.25 });
      endLayer(page);
    });
    // Cut lines in the margins — one per trim edge, across the whole sheet.
    const len = 6 * PT_PER_MM;
    const gridTop = y0 - bleed;
    const gridBottom = y0 - bleed + gridH;
    const gridLeft = x0 - bleed;
    const gridRight = x0 - bleed + gridW;
    for (let c = 0; c < opts.cols; c += 1) {
      for (const x of [x0 + c * stepX, x0 + c * stepX + first.w]) {
        page.drawLine({ start: { x, y: pageH - gridTop + 2 }, end: { x, y: pageH - gridTop + 2 + len }, thickness: 0.3, color: k });
        page.drawLine({ start: { x, y: pageH - gridBottom - 2 }, end: { x, y: pageH - gridBottom - 2 - len }, thickness: 0.3, color: k });
      }
    }
    for (let r = 0; r < opts.rows; r += 1) {
      for (const y of [y0 + r * stepY, y0 + r * stepY + first.h]) {
        page.drawLine({ start: { x: gridLeft - 2, y: pageH - y }, end: { x: gridLeft - 2 - len, y: pageH - y }, thickness: 0.3, color: k });
        page.drawLine({ start: { x: gridRight + 2, y: pageH - y }, end: { x: gridRight + 2 + len, y: pageH - y }, thickness: 0.3, color: k });
      }
    }
  }
  return pdf.save();
}

/**
 * Render one or many docs into ONE PDF, one piece per page.
 */
export async function renderPrintPdf(
  docs: PrintDoc[],
  images: PrintImages,
  opts: { mode: PdfMode; title: string; subject?: string },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(opts.title);
  pdf.setCreator('Setnayan — Prints & Tickets');
  pdf.setProducer('Setnayan');
  if (opts.subject) pdf.setSubject(opts.subject);
  const layers = opts.mode === 'print' ? registerLayers(pdf) : {};
  const imgs = await embedImages(pdf, images);

  for (const doc of docs) {
    const bleed = opts.mode === 'print' ? doc.bleed || BLEED_MM * PT_PER_MM : 0;
    const plainSheet = PRINT_PIECES[doc.piece].kind === 'free';
    const margin = opts.mode === 'print' && !plainSheet ? bleed + SLUG_PT : 0;
    const pageW = doc.w + margin * 2;
    const pageH = doc.h + margin * 2;
    const page = pdf.addPage([pageW, pageH]);
    if (opts.mode === 'print') bindLayers(page, layers);
    const ox = margin;
    const oy = margin;
    if (margin > 0) {
      page.setTrimBox(ox, oy, doc.w, doc.h);
      page.setBleedBox(ox - bleed, oy - bleed, doc.w + 2 * bleed, doc.h + 2 * bleed);
      // Nothing may paint past the bleed into the slug.
      page.pushOperators(pushGraphicsState(), rectangle(ox - bleed, oy - bleed, doc.w + 2 * bleed, doc.h + 2 * bleed), clip(), endPath());
    } else {
      page.pushOperators(pushGraphicsState(), rectangle(0, 0, doc.w, doc.h), clip(), endPath());
    }
    for (const o of doc.ops) drawOp(page, o, ox, oy, pageH, imgs, opts.mode);
    page.pushOperators(popGraphicsState());

    if (opts.mode === 'print' && !plainSheet) {
      // The die line — its own layer, a thin magenta stroke the cutter follows.
      beginLayer(page, 'die');
      page.drawSvgPath(doc.diePath, { x: ox, y: pageH - oy, borderColor: rgb(1, 0, 1), borderWidth: 0.25 });
      endLayer(page);
      cropMarks(page, ox, oy, doc.w, doc.h, pageH, bleed);
    }
  }
  return pdf.save();
}
