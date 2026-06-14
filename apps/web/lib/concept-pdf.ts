/**
 * Concept-book PDF for the Mood Board (owner directive 2026-06-09: "add a pdf
 * file of their rendered concept — showing the Result, and showing how they
 * made this possible: the inspiration and the custom template created").
 *
 * Pure layout layer (mirrors lib/seating-pdf.ts): all I/O — rasterizing the
 * stylized scene, fetching inspiration images, the Setnayan mark, the website
 * QR — happens in the route handler, which hands this function ready PNG bytes.
 *
 * Three pages:
 *   1. Cover            — monogram · names · date · hero (the design)
 *   2. The Concept      — the stylized scene full-bleed (upgrades to the
 *                          photoreal render once "Make it real" ships → resultPng)
 *   3. How you made this — palette swatches · the per-part design choices ·
 *                          the custom template · the uploaded inspirations
 *
 * ₱0 marginal cost: everything is drawn from data the couple already created.
 */
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from 'pdf-lib';
import { RECEPTION_PARTS, sel, type PartId, type ReceptionDesign } from '@/lib/reception-scene';
import { lockupForEvent, drawLockupBadge } from '@/lib/lockup-pdf';
import { deriveMonogram } from '@/lib/monogram';

export type ConceptPdfEvent = {
  display_name: string;
  slug: string | null;
  event_date: string | null;
  monogram_text: string | null;
  monogram_color: string | null;
  // Monogram design columns — present when the couple designed a lockup, so the
  // cover badge draws their REAL mark (bar/duo/script/infinity) not just initials.
  monogram_style?: string | null;
  monogram_font_key?: string | null;
  monogram_frame_key?: string | null;
  monogram_custom_svg?: string | null;
};

export type ConceptPdfInput = {
  appUrl: string;
  event: ConceptPdfEvent;
  design: ReceptionDesign;
  /** Reception/merged palette hexes — swatches + caption. May be empty. */
  palette: string[];
  /** Rasterized stylized scene (the "custom template"), 3:2. */
  scenePng: Uint8Array;
  /** Photoreal render once "Make it real" ships; null today → scene is the hero. */
  resultPng: Uint8Array | null;
  /** Pre-normalized square (1:1) inspiration images. */
  inspirations: Uint8Array[];
  /** Setnayan mark PNG (optional). */
  logoPng: Uint8Array | null;
  /** Website QR PNG (optional). */
  qrPng: Uint8Array | null;
};

// A4 portrait, points.
const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 42;

// Clean Editorial palette (brand lock 2026-05-29).
const PAPER = rgb(0.984, 0.984, 0.98); // Warm Alabaster
const INK = rgb(0.118, 0.133, 0.161); // Deep Obsidian
const GOLD = rgb(0.773, 0.627, 0.349); // Royal Champagne Gold
const SOFT = rgb(0.42, 0.42, 0.46);
const HAIR = rgb(0.85, 0.83, 0.78);

const PART_ORDER: PartId[] = [
  'ceiling',
  'backdrop',
  'stage',
  'tables',
  'tunnel',
  'entrance',
  'people',
];

function hexToRgb(h: string | null | undefined, fallback: RGB): RGB {
  if (!h) return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return fallback;
  const n = parseInt(m[1]!, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function initialsFrom(displayName: string): string {
  const parts = displayName.replace(/&/g, ' ').split(/\s+/).filter(Boolean);
  const letters = parts.map((p) => p[0]!.toUpperCase());
  if (letters.length >= 2) return `${letters[0]} & ${letters[letters.length - 1]}`;
  return (letters[0] ?? 'S').slice(0, 3);
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** The per-part material choices, derived from the live taxonomy. */
function designChoices(design: ReceptionDesign): Array<{ label: string; value: string }> {
  return PART_ORDER.map((pid) => {
    const part = RECEPTION_PARTS.find((p) => p.id === pid)!;
    const vals = part.attributes
      .map((a) => part && a.options.find((o) => o.id === sel(design, pid, a.id))?.label)
      .filter(Boolean) as string[];
    return { label: part.label, value: vals.join(' · ') };
  });
}

/** WinAnsi-safe: pdf-lib StandardFonts can't encode every glyph (em dash, etc.). */
function ascii(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s*[→➔➜]\s*/g, ' to ') // arrows aren't WinAnsi-encodable
    .replace(/[^\x00-\xFF]/g, ' '); // drop anything else outside Latin-1
}

export async function buildConceptPdf(input: ConceptPdfInput): Promise<Uint8Array> {
  const { event, design, palette } = input;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);

  // ---- embed images (silently skip any that fail) -------------------------
  const embed = async (bytes: Uint8Array | null): Promise<PDFImage | null> => {
    if (!bytes) return null;
    try {
      return await doc.embedPng(bytes);
    } catch {
      return null;
    }
  };
  const scene = await embed(input.scenePng);
  const result = await embed(input.resultPng);
  const logo = await embed(input.logoPng);
  const qr = await embed(input.qrPng);
  const inspImgs: PDFImage[] = [];
  for (const b of input.inspirations) {
    const im = await embed(b);
    if (im) inspImgs.push(im);
  }
  const hero = result ?? scene; // photoreal once it exists, else the stylized scene

  const monoText = ascii(event.monogram_text?.trim() || initialsFrom(event.display_name)).slice(0, 7);
  const monoColor = hexToRgb(event.monogram_color, GOLD);
  // The couple's chosen type-only lockup (bar/duo/script/infinity), or null →
  // keep the legacy initials badge. Use deriveMonogram (splits on &|and|+|/|-)
  // so the label matches the QR/hero/chrome — the raw display_name would drop
  // the lockup for "and"/"-"/"+"-joined couples (splitInitials only splits "&").
  const lockupLabel = event.monogram_text?.trim() || deriveMonogram(event.display_name);
  const lockup = lockupForEvent(event, lockupLabel);
  const names = ascii(event.display_name || 'Your Wedding');
  const dateStr = formatDate(event.event_date);

  // ---- small text helpers -------------------------------------------------
  const center = (
    page: PDFPage,
    text: string,
    y: number,
    size: number,
    f: PDFFont,
    color: RGB,
  ) => {
    const t = ascii(text);
    const w = f.widthOfTextAtSize(t, size);
    page.drawText(t, { x: (A4.w - w) / 2, y, size, font: f, color });
  };
  // largest size (down to minSize) at which `text` fits within maxW — keeps
  // long Filipino names / wide monograms from overflowing.
  const fitSize = (text: string, f: PDFFont, maxW: number, startSize: number, minSize: number): number => {
    const t = ascii(text);
    let size = startSize;
    while (size > minSize && f.widthOfTextAtSize(t, size) > maxW) size -= 0.5;
    return size;
  };
  const label = (page: PDFPage, text: string, x: number, y: number) =>
    page.drawText(ascii(text), { x, y, size: 8, font: bold, color: GOLD });
  // gold frame + contained image (no overflow; image aspect must match the box)
  const framed = (page: PDFPage, img: PDFImage | null, x: number, y: number, w: number, h: number) => {
    page.drawRectangle({ x: x - 3, y: y - 3, width: w + 6, height: h + 6, color: GOLD });
    if (img) {
      page.drawImage(img, { x, y, width: w, height: h });
    } else {
      page.drawRectangle({ x, y, width: w, height: h, color: rgb(0.92, 0.9, 0.86) });
    }
  };
  // word-wrap into `maxW`, returns the y after drawing
  const paragraph = (
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    maxW: number,
    size: number,
    f: PDFFont,
    color: RGB,
    lineGap = 3,
  ): number => {
    const words = ascii(text).split(/\s+/).filter(Boolean);
    let line = '';
    let cy = y;
    const flush = () => {
      if (line) page.drawText(line, { x, y: cy, size, font: f, color });
    };
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(trial, size) > maxW && line) {
        flush();
        cy -= size + lineGap;
        line = word;
      } else {
        line = trial;
      }
    }
    flush();
    return cy - size - lineGap;
  };

  const footer = (page: PDFPage) => {
    const credit = 'Created with WWW.SETNAYAN.COM';
    const cw = font.widthOfTextAtSize(credit, 7);
    const markS = logo ? 9 : 0;
    const gap = logo ? 4 : 0;
    const gx = (A4.w - (markS + gap + cw)) / 2;
    if (logo) {
      const lh = (logo.height / logo.width) * markS;
      page.drawImage(logo, { x: gx, y: MARGIN - 14, width: markS, height: lh, opacity: 0.9 });
    }
    page.drawText(credit, { x: gx + markS + gap, y: MARGIN - 13, size: 7, font, color: SOFT });
  };

  // ════════════════════ PAGE 1 — COVER ════════════════════
  {
    const p = doc.addPage([A4.w, A4.h]);
    p.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: PAPER });
    p.drawRectangle({
      x: 24,
      y: 24,
      width: A4.w - 48,
      height: A4.h - 48,
      borderColor: GOLD,
      borderWidth: 1,
    });
    let y = A4.h - 84;
    center(p, 'SETNAYAN', y, 19, bold, GOLD);
    y -= 20;
    center(p, 'W E D D I N G   C O N C E P T', y, 9, font, INK);

    // monogram badge
    const cx = A4.w / 2;
    const cy = A4.h - 236;
    p.drawCircle({ x: cx, y: cy, size: 46, borderColor: monoColor, borderWidth: 2, color: PAPER });
    if (lockup) {
      drawLockupBadge(p, lockup, { centerX: cx, centerY: cy, radius: 46 });
    } else {
      const monoSize = fitSize(monoText, serif, 74, 26, 10);
      const mw = serif.widthOfTextAtSize(monoText, monoSize);
      p.drawText(monoText, { x: cx - mw / 2, y: cy - monoSize * 0.34, size: monoSize, font: serif, color: INK });
    }

    center(p, names, A4.h - 330, fitSize(names, serif, A4.w - 80, 30, 15), serif, INK);
    if (dateStr) center(p, dateStr.toUpperCase(), A4.h - 352, 11, font, GOLD);
    p.drawLine({
      start: { x: cx - 60, y: A4.h - 370 },
      end: { x: cx + 60, y: A4.h - 370 },
      thickness: 1,
      color: GOLD,
    });

    // hero band (3:2) — sits below the divider, clear of the title block
    const bw = A4.w - MARGIN * 2;
    const bh = bw * (2 / 3);
    const by = 100;
    framed(p, hero, MARGIN, by, bw, bh);

    if (qr) {
      const s = 40;
      p.drawImage(qr, { x: A4.w - MARGIN - s, y: by - s - 16, width: s, height: s });
      p.drawText('Scan to visit', {
        x: A4.w - MARGIN - s - 64,
        y: by - s + 6,
        size: 7.5,
        font,
        color: SOFT,
      });
      p.drawText('your wedding site', {
        x: A4.w - MARGIN - s - 78,
        y: by - s - 4,
        size: 7.5,
        font,
        color: SOFT,
      });
    }
    center(p, 'setnayan.com', MARGIN + 4, 8, font, INK);
  }

  // ════════════════════ PAGE 2 — THE CONCEPT / RESULT ════════════════════
  {
    const p = doc.addPage([A4.w, A4.h]);
    p.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: PAPER });
    const heading = result ? 'The Result' : 'Your Concept';
    p.drawText(heading, { x: MARGIN, y: A4.h - 76, size: 30, font: serif, color: INK });
    p.drawLine({
      start: { x: MARGIN, y: A4.h - 86 },
      end: { x: MARGIN + 150, y: A4.h - 86 },
      thickness: 2,
      color: GOLD,
    });
    p.drawText(
      ascii('Your reception, in your palette — your room, everyone in their attire.'),
      { x: MARGIN, y: A4.h - 108, size: 12, font, color: SOFT },
    );

    const bw = A4.w - MARGIN * 2;
    const bh = bw * (2 / 3);
    const by = A4.h - 140 - bh;
    framed(p, hero, MARGIN, by, bw, bh);

    let cy = by - 26;
    const colors = palette.filter((c) => /^#?[0-9a-f]{6}$/i.test(c)).slice(0, 6);
    if (colors.length) {
      const caption = `In your palette: ${colors.map((c) => (c.startsWith('#') ? c : `#${c}`).toUpperCase()).join('  ')}`;
      p.drawText(ascii(caption), { x: MARGIN, y: cy, size: 9.5, font, color: SOFT });
      cy -= 18;
    }
    if (!result) {
      p.drawText(
        ascii('This is your design preview. Use "Make it real" to render it as a photoreal photograph.'),
        { x: MARGIN, y: cy, size: 10, font: bold, color: GOLD },
      );
    }
    footer(p);
  }

  // ════════════════════ PAGE 3 — HOW YOU MADE THIS ════════════════════
  {
    const p = doc.addPage([A4.w, A4.h]);
    p.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: PAPER });
    p.drawText('How you made this', { x: MARGIN, y: A4.h - 76, size: 26, font: serif, color: INK });
    p.drawLine({
      start: { x: MARGIN, y: A4.h - 86 },
      end: { x: MARGIN + 230, y: A4.h - 86 },
      thickness: 2,
      color: GOLD,
    });
    p.drawText(ascii('Your design and your inspirations, brought together into your render.'), {
      x: MARGIN,
      y: A4.h - 106,
      size: 11,
      font,
      color: SOFT,
    });

    // ---- LEFT column ----
    const lx = MARGIN;
    const colW = 250;
    let ly = A4.h - 140;

    const sw = palette.filter((c) => /^#?[0-9a-f]{6}$/i.test(c)).slice(0, 6);
    if (sw.length > 0) {
      label(p, 'YOUR PALETTE', lx, ly);
      ly -= 16;
      sw.forEach((c, i) => {
        const x = lx + i * 40;
        p.drawRectangle({
          x,
          y: ly - 30,
          width: 32,
          height: 32,
          color: hexToRgb(c, rgb(0.9, 0.88, 0.84)),
          borderColor: HAIR,
          borderWidth: 0.5,
        });
      });
      ly -= 56;
    }

    label(p, 'YOUR DESIGN', lx, ly);
    ly -= 18;
    for (const { label: lbl, value } of designChoices(design)) {
      p.drawText(ascii(lbl), { x: lx, y: ly, size: 10, font: bold, color: INK });
      ly -= 13;
      ly = paragraph(p, value || '-', lx + 4, ly, colW - 4, 9, font, SOFT, 2) - 6;
    }

    // custom template thumbnail
    ly -= 4;
    label(p, 'YOUR CUSTOM TEMPLATE', lx, ly);
    ly -= 12;
    const tw = colW;
    const th = tw * (2 / 3);
    framed(p, scene, lx, ly - th, tw, th);

    // ---- RIGHT column — inspirations grid ----
    const rx = MARGIN + colW + 26;
    const rW = A4.w - MARGIN - rx;
    let ry = A4.h - 140;
    label(p, 'YOUR INSPIRATIONS', rx, ry);
    ry -= 14;
    if (inspImgs.length === 0) {
      p.drawText(ascii('Add inspiration photos on the Mood Board to fill this page.'), {
        x: rx,
        y: ry - 12,
        size: 9,
        font,
        color: SOFT,
      });
    } else {
      const cols = 2;
      const gap = 8;
      const cell = (rW - gap * (cols - 1)) / cols;
      inspImgs.slice(0, 6).forEach((img, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = rx + col * (cell + gap);
        const yy = ry - 14 - row * (cell + gap) - cell;
        framed(p, img, x, yy, cell, cell);
      });
      const rows = Math.ceil(Math.min(inspImgs.length, 6) / cols);
      const capY = ry - 14 - rows * (cell + gap) - 6;
      paragraph(
        p,
        'The looks you uploaded — we match your render to these, not a generic wedding.',
        rx,
        capY,
        rW,
        9,
        font,
        SOFT,
      );
    }

    footer(p);
  }

  return doc.save();
}
