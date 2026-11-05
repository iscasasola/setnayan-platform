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
  drawSvgPath,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  StandardFonts,
  type PDFFont,
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

/** The ganged sheet's through-lines — a hairline, so a cut on the line leaves nothing on the card's edge. */
const CUT_LINE_PT = 0.3;
/** Cut 1 (across) is red, cut 2 (down) black — each line also carries its number, for a printer set to grey. */
const CUT_1 = rgb(0.82, 0.2, 0.17);
const CUT_2 = rgb(0, 0, 0);
/** The numbered dot on a cut line, as a radius. */
const BADGE_R = 2.1 * PT_PER_MM;
/**
 * The die line on a ganged sheet: a soft paper tone, not magenta (owner 2026-10-24, *"maybe the purple cut line can be a
 * safer color?"*). Where it runs straight it lies under the cut lines; at a rounded corner it is the curve to punch.
 * Cut a hair inside it and nothing bright is left on the card's edge.
 */
const DIE_TONE = rgb(0.79, 0.75, 0.7);

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
      if (o.evenOdd && o.fill && !o.stroke && o.opacity === undefined) {
        // The couple's logo traces its letters' holes with fill-rule="evenodd";
        // pdf-lib's drawSvgPath always fills non-zero, which would fill the
        // counter of an "O" solid. Same operators, the even-odd fill (f*).
        const opsList = drawSvgPath(o.d, { x: ox, y: pageH - oy, scale: undefined, color: hex(o.fill), borderColor: undefined, borderWidth: 0 });
        page.pushOperators(
          ...opsList.map((op) => (op.toString().trim() === 'f' ? PDFOperator.of(PDFOperatorNames.FillEvenOdd) : op)),
        );
        break;
      }
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
 * trims), and every trim edge is a cut line across the whole sheet — a tick in
 * the margins and a hairline through the gutters — so a guillotine, a trimmer
 * or scissors can follow it after the first cut. Layers and die lines are kept per pass.
 */
export async function renderImposedPdf(
  docs: PrintDoc[],
  images: PrintImages,
  opts: { cols: number; rows: number; landscape: boolean; title: string; subject?: string },
): Promise<Uint8Array> {
  const pdf = await newPrintPdf(opts);
  const layers = registerLayers(pdf);
  const imgs = await embedImages(pdf, images);
  drawImposedPages(pdf, layers, imgs, docs, opts);
  return pdf.save();
}

/** The ganged A4 pages (the body of `renderImposedPdf`), into a document already holding its layers and images. */
function drawImposedPages(
  pdf: PDFDocument,
  layers: Layers,
  imgs: Record<string, PDFImage>,
  docs: PrintDoc[],
  opts: { cols: number; rows: number; landscape: boolean },
) {
  const A4: [number, number] = [210 * PT_PER_MM, 297 * PT_PER_MM];
  const [pageW, pageH] = opts.landscape ? [A4[1], A4[0]] : A4;
  const perPage = opts.cols * opts.rows;
  const font = pdf.embedStandardFont(StandardFonts.HelveticaBold);
  for (let start = 0; start < docs.length; start += perPage) {
    const batch = docs.slice(start, start + perPage);
    const first = batch[0]!;
    const bleed = first.bleed || BLEED_MM * PT_PER_MM;
    const stepX = first.w + 2 * bleed;
    const stepY = first.h + 2 * bleed;
    const g: SheetGrid = {
      pageW,
      pageH,
      cols: opts.cols,
      rows: opts.rows,
      bleed,
      w: first.w,
      h: first.h,
      stepX,
      stepY,
      x0: (pageW - opts.cols * stepX) / 2 + bleed,
      y0: (pageH - opts.rows * stepY) / 2 + bleed,
    };
    const page = pdf.addPage([pageW, pageH]);
    bindLayers(page, layers);
    batch.forEach((doc, i) => {
      const ox = g.x0 + (i % opts.cols) * stepX;
      const oy = g.y0 + Math.floor(i / opts.cols) * stepY;
      drawCell(page, doc, ox, oy, pageH, imgs);
      beginLayer(page, 'die');
      page.drawSvgPath(doc.diePath, { x: ox, y: pageH - oy, borderColor: DIE_TONE, borderWidth: 0.35 });
      endLayer(page);
    });
    cutLines(page, g, font);
    // 🔁 THE BACKS — the next page, so a duplex printer puts each back behind its front (owner 2026-10-24: *"if we allow
    // the printer to do back to back. it needs to align properly. back part does not need cut lines. just front"*). The
    // grid is centred, so the same cell mirrored left to right is exactly behind its front after a flip: on the long
    // edge for a portrait sheet, on the short edge for a landscape one. No cut lines, no die line, no legend.
    if (batch.some((d) => d.back)) {
      const back = pdf.addPage([pageW, pageH]);
      bindLayers(back, layers);
      batch.forEach((doc, i) => {
        if (!doc.back) return;
        const ox = g.x0 + (opts.cols - 1 - (i % opts.cols)) * stepX;
        const oy = g.y0 + Math.floor(i / opts.cols) * stepY;
        drawCell(back, doc.back, ox, oy, pageH, imgs);
      });
    }
  }
}

type SheetGrid = { pageW: number; pageH: number; cols: number; rows: number; bleed: number; w: number; h: number; stepX: number; stepY: number; x0: number; y0: number };

/** One piece in its cell: clipped to its bleed. */
function drawCell(page: PDFPage, doc: PrintDoc, ox: number, oy: number, pageH: number, imgs: Record<string, PDFImage>) {
  page.pushOperators(pushGraphicsState(), rectangle(ox - doc.bleed, pageH - oy - doc.h - doc.bleed, doc.w + 2 * doc.bleed, doc.h + 2 * doc.bleed), clip(), endPath());
  for (const o of doc.ops) drawOp(page, o, ox, oy, pageH, imgs, 'print');
  page.pushOperators(popGraphicsState());
}

/**
 * ✂ THE CUT LINES OF A GANGED SHEET (owner 2026-10-24: *"when i cut 1 side, i cannot see where to cut anymore"*, *"mark a
 * label on where to cut first"*, *"complete all lines so there is no confusion"*, *"color code cut 1"*):
 *   · every trim edge is a line from margin to margin — through the gutters and along the cards' own edges, where a cut on
 *     the line takes it away — so each strip keeps the lines it still needs, whatever has been cut;
 *   · CUT 1 runs ACROSS the sheet, in red, numbered 1; CUT 2 runs DOWN each strip, in black, numbered 2;
 *   · the numbers sit where every printer prints: the 1s in the gap between columns (a 1-column sheet's wide side margins
 *     otherwise), the 2s in the top and bottom margins and in every gap between rows; the legend in the top margin.
 */
function cutLines(page: PDFPage, g: SheetGrid, font: PDFFont) {
  const mm = PT_PER_MM;
  const tick = 4 * mm;
  const gridTop = g.y0 - g.bleed;
  const gridBottom = gridTop + g.rows * g.stepY;
  const gridLeft = g.x0 - g.bleed;
  const gridRight = gridLeft + g.cols * g.stepX;
  const Y = (y: number) => g.pageH - y;
  const xs = Array.from({ length: g.cols }, (_, c) => [g.x0 + c * g.stepX, g.x0 + c * g.stepX + g.w]).flat();
  const ys = Array.from({ length: g.rows }, (_, r) => [g.y0 + r * g.stepY, g.y0 + r * g.stepY + g.h]).flat();
  const badge = (x: number, y: number, n: 1 | 2) => {
    const color = n === 1 ? CUT_1 : CUT_2;
    page.drawCircle({ x, y: Y(y), size: BADGE_R, color: n === 1 ? CUT_1 : rgb(1, 1, 1), borderColor: color, borderWidth: 0.6 });
    const s = String(n);
    const size = BADGE_R * 1.35;
    page.drawText(s, { x: x - font.widthOfTextAtSize(s, size) / 2, y: Y(y) - size * 0.36, size, font, color: n === 1 ? rgb(1, 1, 1) : CUT_2 });
  };
  const sideRoom = gridLeft >= 14 * mm;
  // CUT 2 — down: black.
  for (const x of xs) {
    page.drawLine({ start: { x, y: Y(gridTop - 2 - tick) }, end: { x, y: Y(gridBottom + 2 + tick) }, thickness: CUT_LINE_PT, color: CUT_2 });
    page.drawLine({ start: { x, y: Y(gridTop - 2) }, end: { x, y: Y(gridTop - 2 - tick) }, thickness: 0.6, color: CUT_2 });
    page.drawLine({ start: { x, y: Y(gridBottom + 2) }, end: { x, y: Y(gridBottom + 2 + tick) }, thickness: 0.6, color: CUT_2 });
    badge(x, gridTop - 4 - tick - BADGE_R, 2);
    badge(x, gridBottom + 4 + tick + BADGE_R, 2);
    // …and in every gap between rows — on the sheet's outer lines only: a line beside a column gap would crowd its 1s.
    const outer = x === xs[0] || x === xs[xs.length - 1] || !(sideRoom === false && g.cols > 1);
    if (outer) for (let r = 0; r + 1 < g.rows; r += 1) badge(x, g.y0 + r * g.stepY + g.h + g.bleed, 2);
  }
  // CUT 1 — across: red.
  for (const y of ys) {
    const l = sideRoom ? gridLeft - 2 - tick : gridLeft - 2 - Math.min(tick, gridLeft - 6 * mm);
    const r = sideRoom ? gridRight + 2 + tick : gridRight + 2 + Math.min(tick, gridLeft - 6 * mm);
    page.drawLine({ start: { x: l, y: Y(y) }, end: { x: r, y: Y(y) }, thickness: CUT_LINE_PT + 0.05, color: CUT_1 });
    page.drawLine({ start: { x: l, y: Y(y) }, end: { x: gridLeft - 2, y: Y(y) }, thickness: 0.6, color: CUT_1 });
    page.drawLine({ start: { x: gridRight + 2, y: Y(y) }, end: { x: r, y: Y(y) }, thickness: 0.6, color: CUT_1 });
    if (sideRoom) {
      badge(gridLeft - 4 - tick - BADGE_R, y, 1);
      badge(gridRight + 4 + tick + BADGE_R, y, 1);
    } else for (let c = 0; c + 1 < g.cols; c += 1) badge(g.x0 + c * g.stepX + g.w + g.bleed, y, 1);
  }
  // The legend: in the top margin above the 2s, or — on a landscape sheet whose top margin is too thin to print in — down
  // the left margin, wrapped. Never in the outer 8 mm a home printer leaves blank.
  const size = 7.5;
  const say: Array<[string, typeof CUT_1]> = [
    ['1  Cut the red lines first, straight across the sheet', CUT_1],
    ['2  Then cut each strip along the black lines', CUT_2],
  ];
  const legendY = gridTop - 6 - tick - 2 * BADGE_R - 4;
  if (legendY > 9 * mm) {
    page.drawText(say[0]![0], { x: gridLeft, y: Y(legendY - size - 3), size, font, color: say[0]![1] });
    page.drawText(say[1]![0], { x: gridLeft, y: Y(legendY), size, font, color: say[1]![1] });
  } else if (sideRoom) {
    const width = gridLeft - 4 - tick - 2 * BADGE_R - 4 - 8 * mm;
    let y = gridTop + size;
    for (const [words, color] of say) {
      let line = '';
      for (const wd of words.split(/\s+/)) {
        const next = line ? `${line} ${wd}` : wd;
        if (line && font.widthOfTextAtSize(next, size) > width) {
          page.drawText(line, { x: 8 * mm, y: Y(y), size, font, color });
          y += size * 1.3;
          line = wd;
        } else line = next;
      }
      page.drawText(line, { x: 8 * mm, y: Y(y), size, font, color });
      y += size * 2;
    }
  }
}

/**
 * Render one or many docs into ONE PDF, one piece per page.
 */
export async function renderPrintPdf(
  docs: PrintDoc[],
  images: PrintImages,
  opts: { mode: PdfMode; title: string; subject?: string },
): Promise<Uint8Array> {
  const pdf = await newPrintPdf(opts);
  const layers = opts.mode === 'print' ? registerLayers(pdf) : {};
  const imgs = await embedImages(pdf, images);
  drawDocPages(pdf, layers, imgs, docs, opts.mode);
  return pdf.save();
}

/** A new document with the house's title, creator and subject. */
async function newPrintPdf(opts: { title: string; subject?: string }): Promise<PDFDocument> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(opts.title);
  pdf.setCreator('Setnayan — Prints & Tickets');
  pdf.setProducer('Setnayan');
  if (opts.subject) pdf.setSubject(opts.subject);
  return pdf;
}

/** One piece per page (the body of `renderPrintPdf`), into a document already holding its layers and images. */
function drawDocPages(pdf: PDFDocument, layers: Layers, imgs: Record<string, PDFImage>, docs: PrintDoc[], mode: PdfMode) {
  for (const doc of docs) {
    const bleed = mode === 'print' ? doc.bleed || BLEED_MM * PT_PER_MM : 0;
    const plainSheet = PRINT_PIECES[doc.piece].kind === 'free';
    const margin = mode === 'print' && !plainSheet ? bleed + SLUG_PT : 0;
    const pageW = doc.w + margin * 2;
    const pageH = doc.h + margin * 2;
    const page = pdf.addPage([pageW, pageH]);
    if (mode === 'print') bindLayers(page, layers);
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
    for (const o of doc.ops) drawOp(page, o, ox, oy, pageH, imgs, mode);
    page.pushOperators(popGraphicsState());

    if (mode === 'print' && !plainSheet && !doc.isBack) {
      // The die line — its own layer, a thin magenta stroke the cutter follows.
      beginLayer(page, 'die');
      page.drawSvgPath(doc.diePath, { x: ox, y: pageH - oy, borderColor: rgb(1, 0, 1), borderWidth: 0.25 });
      endLayer(page);
      cropMarks(page, ox, oy, doc.w, doc.h, pageH, bleed);
    }
  }
}

/**
 * 🗂 ONE BOOK OF PRINTS (owner 2026-10-17, Everything ◆): pieces one per page AND the ganged pass batch, drawn into ONE document —
 * every image embedded ONCE (a guest's QR on the QR sheet and on their pass is one picture in the file, not two), one set of
 * layers. The SAME page drawing as `renderPrintPdf` and `renderImposedPdf`, section after section.
 */
export type PrintBookSection =
  | { kind: 'pages'; docs: PrintDoc[] }
  | { kind: 'imposed'; docs: PrintDoc[]; cols: number; rows: number; landscape: boolean };
export async function renderPrintBook(sections: PrintBookSection[], images: PrintImages, opts: { title: string; subject?: string }): Promise<Uint8Array> {
  const pdf = await newPrintPdf(opts);
  const layers = registerLayers(pdf);
  const imgs = await embedImages(pdf, images);
  for (const s of sections) {
    if (s.kind === 'pages') drawDocPages(pdf, layers, imgs, s.docs, 'print');
    else drawImposedPages(pdf, layers, imgs, s.docs, s);
  }
  return pdf.save();
}
