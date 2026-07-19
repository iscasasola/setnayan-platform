/**
 * One-page printable Mood Board (Mood Board · free printable, 2026-06-28).
 *
 * DISTINCT from the V2-deferred multi-page "Concept Book" PDF (lib/concept-pdf.ts):
 * this is a single, light-background, print-safe A4 page a couple can hand a
 * vendor or pin to a board — palette swatches grouped per role, a compact
 * reception-design summary, and the couple's names + date. No hero raster, no
 * heavy gradients, no inspiration grid — just the color + material decisions a
 * vendor needs at a glance.
 *
 * Pure layout layer (mirrors lib/seating-pdf.ts / lib/concept-pdf.ts): the only
 * I/O is the optional Setnayan mark, fetched by the route handler and handed in
 * as PNG bytes. ₱0 marginal cost — everything is drawn from data the couple
 * already created.
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
import {
  PALETTE_ORDER,
  PALETTE_LIMITS,
  type PaletteKey,
  type RolePalette,
} from '@/lib/mood-board';
import { RECEPTION_PARTS, sel, type PartId, type ReceptionDesign } from '@/lib/reception-scene';

export type PrintableEvent = {
  display_name: string | null;
  event_date: string | null;
};

export type PrintablePdfInput = {
  event: PrintableEvent;
  palette: RolePalette;
  design: ReceptionDesign;
  /** Setnayan mark PNG (optional — footer credit). */
  logoPng: Uint8Array | null;
};

// A4 portrait, points.
const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 48;

// Clean Editorial palette (brand lock 2026-05-29) — light + print-safe.
const PAPER = rgb(1, 1, 1); // pure white — cheapest to print, no ink-heavy fill
const INK = rgb(0.118, 0.133, 0.161); // Deep Obsidian
const GOLD = rgb(0.773, 0.627, 0.349); // Royal Champagne Gold
const SOFT = rgb(0.42, 0.42, 0.46);
const HAIR = rgb(0.82, 0.8, 0.75);

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

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** WinAnsi-safe: pdf-lib StandardFonts can't encode every glyph (em dash, etc.). */
function ascii(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s*[→➔➜]\s*/g, ' to ')
    .replace(/[^\x00-\xFF]/g, ' ');
}

/** Palette grouped per role — only rows the couple actually saved a color for. */
function paletteRows(palette: RolePalette): Array<{ label: string; colors: string[] }> {
  return PALETTE_ORDER.map((key) => ({
    label: PALETTE_LIMITS[key as PaletteKey]?.label ?? String(key),
    colors: (palette[key as PaletteKey] ?? []).filter((c) => /^#?[0-9a-f]{6}$/i.test(c)),
  })).filter((r) => r.colors.length > 0);
}

/** The per-part material choices, derived from the live taxonomy. */
function designChoices(design: ReceptionDesign): Array<{ label: string; value: string }> {
  return PART_ORDER.map((pid) => {
    const part = RECEPTION_PARTS.find((p) => p.id === pid)!;
    const vals = part.attributes
      .map((a) => a.options.find((o) => o.id === sel(design, pid, a.id))?.label)
      .filter(Boolean) as string[];
    return { label: part.label, value: vals.join(' · ') };
  }).filter((r) => r.value.length > 0);
}

export async function buildMoodboardPrintable(input: PrintablePdfInput): Promise<Uint8Array> {
  const { event, palette, design } = input;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);

  let logo: PDFImage | null = null;
  if (input.logoPng) {
    try {
      logo = await doc.embedPng(input.logoPng);
    } catch {
      logo = null;
    }
  }

  const p = doc.addPage([A4.w, A4.h]);
  p.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: PAPER });

  // ---- small helpers ------------------------------------------------------
  const center = (page: PDFPage, text: string, y: number, size: number, f: PDFFont, color: RGB) => {
    const t = ascii(text);
    const w = f.widthOfTextAtSize(t, size);
    page.drawText(t, { x: (A4.w - w) / 2, y, size, font: f, color });
  };
  const fitSize = (text: string, f: PDFFont, maxW: number, startSize: number, minSize: number): number => {
    const t = ascii(text);
    let size = startSize;
    while (size > minSize && f.widthOfTextAtSize(t, size) > maxW) size -= 0.5;
    return size;
  };
  const sectionLabel = (text: string, x: number, y: number) =>
    p.drawText(ascii(text), { x, y, size: 9, font: bold, color: GOLD });
  // word-wrap into maxW, returns y after drawing
  const paragraph = (
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
      if (line) p.drawText(line, { x, y: cy, size, font: f, color });
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

  // ---- header: names + date ----------------------------------------------
  const names = event.display_name || 'Your Wedding';
  const dateStr = formatDate(event.event_date);
  let y = A4.h - 76;
  center(p, 'MOOD BOARD', y, 10, font, GOLD);
  y -= 30;
  center(p, names, y, fitSize(names, serif, A4.w - MARGIN * 2, 30, 16), serif, INK);
  y -= 18;
  if (dateStr) {
    center(p, dateStr.toUpperCase(), y, 10, font, SOFT);
    y -= 6;
  }
  y -= 14;
  p.drawLine({
    start: { x: MARGIN, y },
    end: { x: A4.w - MARGIN, y },
    thickness: 1,
    color: GOLD,
  });
  y -= 30;

  // ---- palette, grouped per role -----------------------------------------
  const rows = paletteRows(palette);
  sectionLabel('YOUR PALETTE', MARGIN, y);
  y -= 18;
  if (rows.length === 0) {
    y = paragraph(
      'No palette saved yet — pick your colors on the Mood Board and they will appear here.',
      MARGIN,
      y,
      A4.w - MARGIN * 2,
      10,
      font,
      SOFT,
    );
  } else {
    const labelW = 168;
    for (const { label, colors } of rows) {
      p.drawText(ascii(label), { x: MARGIN, y: y - 11, size: 10, font: bold, color: INK });
      colors.slice(0, 8).forEach((hex, i) => {
        const sx = MARGIN + labelW + i * 30;
        p.drawRectangle({
          x: sx,
          y: y - 16,
          width: 22,
          height: 22,
          color: hexToRgb(hex, rgb(0.9, 0.88, 0.84)),
          borderColor: HAIR,
          borderWidth: 0.5,
        });
        const code = (hex.startsWith('#') ? hex : `#${hex}`).toUpperCase();
        p.drawText(code, { x: sx - 1, y: y - 24, size: 4.6, font, color: SOFT });
      });
      y -= 36;
    }
  }

  // ---- reception design summary ------------------------------------------
  y -= 14;
  const choices = designChoices(design);
  sectionLabel('YOUR RECEPTION DESIGN', MARGIN, y);
  y -= 18;
  if (choices.length === 0) {
    y = paragraph(
      'No reception design saved yet — choose your ceiling, backdrop, stage, tables, and entrance treatments on the Mood Board.',
      MARGIN,
      y,
      A4.w - MARGIN * 2,
      10,
      font,
      SOFT,
    );
  } else {
    const labelW = 110;
    for (const { label, value } of choices) {
      p.drawText(ascii(label), { x: MARGIN, y, size: 10, font: bold, color: INK });
      y = paragraph(value, MARGIN + labelW, y, A4.w - MARGIN * 2 - labelW, 10, font, SOFT, 2) - 6;
    }
  }

  // ---- footer credit ------------------------------------------------------
  const credit = 'Created with WWW.SETNAYAN.COM';
  const cw = font.widthOfTextAtSize(credit, 7.5);
  const markS = logo ? 9 : 0;
  const gap = logo ? 4 : 0;
  const gx = (A4.w - (markS + gap + cw)) / 2;
  if (logo) {
    const lh = (logo.height / logo.width) * markS;
    p.drawImage(logo, { x: gx, y: MARGIN - 18, width: markS, height: lh, opacity: 0.9 });
  }
  p.drawText(credit, { x: gx + markS + gap, y: MARGIN - 17, size: 7.5, font, color: SOFT });

  return doc.save();
}
