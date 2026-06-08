import { PDFDocument, StandardFonts, rgb, degrees, type PDFPage, type RGB } from 'pdf-lib';
import QRCode from 'qrcode';
import {
  TABLE_FOOTPRINT_M,
  TABLE_TYPE_LABEL,
  shapeHintFor,
  type EventTableRow,
  type FloorPlanRow,
  type SeatAssignmentRow,
  type TableType,
} from '@/lib/seating';

export type SeatingPdfMode = 'moodboard' | 'blueprint';

export type SeatingPdfGuest = { guest_id: string; name: string; role: string };

export type SeatingPdfInput = {
  mode: SeatingPdfMode;
  appUrl: string;
  event: {
    display_name: string;
    slug: string | null;
    event_date: string | null;
    monogram_text: string | null;
    monogram_color: string | null;
  };
  tables: EventTableRow[];
  assignments: SeatAssignmentRow[];
  guests: SeatingPdfGuest[];
  floorPlan: FloorPlanRow;
  palette: string[]; // mood-board hex colours (may be empty)
  logoPng: Uint8Array | null;
};

// A4 portrait, points.
const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 40;

function hex(h: string | null | undefined, fallback: RGB): RGB {
  if (!h) return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return fallback;
  const n = parseInt(m[1]!, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function lighten(c: RGB, amt: number): RGB {
  return rgb(c.red + (1 - c.red) * amt, c.green + (1 - c.green) * amt, c.blue + (1 - c.blue) * amt);
}

function initialsFrom(displayName: string): string {
  const parts = displayName.replace(/&/g, ' ').split(/\s+/).filter(Boolean);
  const letters = parts.map((p) => p[0]!.toUpperCase());
  if (letters.length >= 2) return `${letters[0]}&${letters[letters.length - 1]}`;
  return (letters[0] ?? 'S').slice(0, 3);
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

type Theme = {
  ink: RGB;
  soft: RGB;
  line: RGB;
  paper: RGB;
  accent: RGB;
  tableFor: (i: number) => { fill: RGB; border: RGB };
};

function buildTheme(mode: SeatingPdfMode, palette: string[], monogramColor: string | null): Theme {
  if (mode === 'blueprint') {
    const blue = rgb(0.12, 0.26, 0.42);
    return {
      ink: blue,
      soft: rgb(0.38, 0.5, 0.62),
      line: rgb(0.62, 0.72, 0.82),
      paper: rgb(1, 1, 1),
      accent: blue,
      tableFor: () => ({ fill: rgb(1, 1, 1), border: blue }),
    };
  }
  // mood-board mode — colour floor + tables from the couple's palette.
  const colours = (palette.length ? palette : [monogramColor ?? '#C5A059'])
    .map((c) => hex(c, rgb(0.77, 0.63, 0.35)))
    .filter(Boolean);
  const accent = colours[0] ?? rgb(0.77, 0.63, 0.35);
  return {
    ink: rgb(0.12, 0.13, 0.16),
    soft: rgb(0.45, 0.46, 0.5),
    line: rgb(0.85, 0.83, 0.78),
    paper: rgb(0.985, 0.98, 0.965),
    accent,
    tableFor: (i: number) => {
      const base = colours[i % colours.length] ?? accent;
      return { fill: lighten(base, 0.62), border: base };
    },
  };
}

function isRound(type: TableType): boolean {
  const s = shapeHintFor(type);
  return s === 'round' || s === 'sweetheart' || s === 'serpentine';
}

export async function buildSeatingPdf(input: SeatingPdfInput): Promise<Uint8Array> {
  const { mode, event, tables, assignments, guests, floorPlan, palette } = input;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const theme = buildTheme(mode, palette, event.monogram_color);

  const guestById = new Map(guests.map((g) => [g.guest_id, g]));
  const seatByTable = new Map<string, SeatingPdfGuest[]>();
  for (const a of assignments) {
    const g = guestById.get(a.guest_id);
    if (!g) continue;
    const arr = seatByTable.get(a.table_id) ?? [];
    arr.push(g);
    seatByTable.set(a.table_id, arr);
  }

  let logo = null;
  if (input.logoPng) {
    try {
      logo = await doc.embedPng(input.logoPng);
    } catch {
      logo = null;
    }
  }

  // QR for the couple's website.
  let qr = null;
  if (event.slug) {
    try {
      const url = `${input.appUrl}/${event.slug}`;
      const png = await QRCode.toBuffer(url, {
        type: 'png',
        width: 360,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: { dark: '#1A1A1A', light: '#FFFFFF' },
      });
      qr = await doc.embedPng(new Uint8Array(png));
    } catch {
      qr = null;
    }
  }

  const monoText = (event.monogram_text?.trim() || initialsFrom(event.display_name)).slice(0, 5);
  const monoColor = hex(event.monogram_color, theme.accent);

  // ---- shared header band -------------------------------------------------
  const drawHeader = (page: PDFPage, subtitle: string) => {
    const top = A4.h - MARGIN;
    // monogram badge
    const cx = MARGIN + 26;
    const cy = top - 26;
    page.drawCircle({ x: cx, y: cy, size: 26, borderColor: monoColor, borderWidth: 1.5, color: theme.paper });
    const mw = bold.widthOfTextAtSize(monoText, 13);
    page.drawText(monoText, { x: cx - mw / 2, y: cy - 4.5, size: 13, font: bold, color: monoColor });

    // names + date
    const tx = MARGIN + 64;
    page.drawText(event.display_name, { x: tx, y: top - 18, size: 19, font: serif, color: theme.ink });
    const dateStr = formatDate(event.event_date);
    if (dateStr) {
      page.drawText(dateStr.toUpperCase(), { x: tx, y: top - 34, size: 8.5, font, color: theme.soft });
    }
    page.drawText(subtitle.toUpperCase(), { x: tx, y: top - 47, size: 7.5, font: bold, color: theme.accent });

    // QR + Setnayan logo, right-aligned
    const right = A4.w - MARGIN;
    if (qr) {
      const s = 46;
      page.drawImage(qr, { x: right - s, y: top - s, width: s, height: s });
      page.drawText('Scan to visit', { x: right - s - 58, y: top - 18, size: 7.5, font, color: theme.soft });
      page.drawText('our website', { x: right - s - 58, y: top - 28, size: 7.5, font, color: theme.soft });
    }
    if (logo) {
      const lw = 60;
      const lh = (logo.height / logo.width) * lw;
      page.drawImage(logo, { x: MARGIN, y: A4.h - MARGIN - 56 - lh, width: lw, height: lh, opacity: 0.85 });
    }

    page.drawLine({
      start: { x: MARGIN, y: top - 60 },
      end: { x: right, y: top - 60 },
      thickness: 0.75,
      color: theme.line,
    });
  };

  // ===================== PAGE 1 — FLOOR PLAN ===============================
  const p1 = doc.addPage([A4.w, A4.h]);
  drawHeader(p1, 'Reception Floor Plan');

  const planTop = A4.h - MARGIN - 76;
  const planBottom = MARGIN + 24;
  const planMaxW = A4.w - MARGIN * 2;
  const planMaxH = planTop - planBottom;

  const venueSet = floorPlan.venue_width_m && floorPlan.venue_length_m;
  // Fit the room (or a default 4:3 area) into the available space, letterboxed.
  const roomAspect = venueSet
    ? floorPlan.venue_width_m! / floorPlan.venue_length_m!
    : planMaxW / planMaxH;
  let planW = planMaxW;
  let planH = planW / roomAspect;
  if (planH > planMaxH) {
    planH = planMaxH;
    planW = planH * roomAspect;
  }
  const planX = MARGIN + (planMaxW - planW) / 2;
  const planYTop = planTop;

  // floor + walls
  p1.drawRectangle({
    x: planX,
    y: planYTop - planH,
    width: planW,
    height: planH,
    color: mode === 'blueprint' ? rgb(1, 1, 1) : lighten(theme.accent, 0.9),
    borderColor: theme.ink,
    borderWidth: mode === 'blueprint' ? 1 : 0.75,
  });
  if (venueSet) {
    p1.drawText(`${floorPlan.venue_width_m} m`, {
      x: planX + planW / 2 - 12,
      y: planYTop + 4,
      size: 7.5,
      font,
      color: theme.soft,
    });
    p1.drawText(`${floorPlan.venue_length_m} m`, {
      x: planX - 6,
      y: planYTop - planH / 2,
      size: 7.5,
      font,
      color: theme.soft,
      rotate: degrees(90),
    });
  }

  // percent (0–100, y-down) → page point (y-up)
  const px = (xPct: number) => planX + (xPct / 100) * planW;
  const py = (yPct: number) => planYTop - (yPct / 100) * planH;

  // stage
  const sx = px(floorPlan.stage_x);
  const sy = py(floorPlan.stage_y);
  p1.drawRectangle({ x: sx - 38, y: sy - 8, width: 76, height: 16, color: theme.paper, borderColor: theme.ink, borderWidth: 0.75 });
  p1.drawText('STAGE', { x: sx - 14, y: sy - 3.5, size: 7, font: bold, color: theme.soft });
  // entrance
  if (floorPlan.entrance_enabled) {
    const ex = px(floorPlan.entrance_x);
    const ey = py(floorPlan.entrance_y);
    p1.drawRectangle({ x: ex - 26, y: ey - 7, width: 52, height: 14, color: theme.paper, borderColor: theme.accent, borderWidth: 0.75 });
    p1.drawText('ENTRANCE', { x: ex - 21, y: ey - 3, size: 6, font: bold, color: theme.soft });
  }

  // tables
  tables.forEach((t, i) => {
    const cx = px(t.x_pos !== null ? Number(t.x_pos) : 50);
    const cy = py(t.y_pos !== null ? Number(t.y_pos) : 50);
    const seated = seatByTable.get(t.table_id)?.length ?? 0;
    const { fill, border } = theme.tableFor(i);
    // size: to-scale when venue set, else a readable default by footprint
    const footPt = venueSet
      ? (TABLE_FOOTPRINT_M[t.table_type] / floorPlan.venue_width_m!) * planW
      : Math.max(20, Math.min(46, (TABLE_FOOTPRINT_M[t.table_type] / 3) * 22));
    const r = footPt / 2;
    if (isRound(t.table_type)) {
      p1.drawCircle({ x: cx, y: cy, size: r, color: fill, borderColor: border, borderWidth: 1 });
    } else {
      p1.drawRectangle({ x: cx - r, y: cy - r * 0.5, width: r * 2, height: r, color: fill, borderColor: border, borderWidth: 1 });
    }
    const num = t.table_label.match(/\d+/)?.[0] ?? String(i + 1);
    const nw = bold.widthOfTextAtSize(num, Math.min(11, r * 0.7));
    p1.drawText(num, { x: cx - nw / 2, y: cy - 3, size: Math.min(11, r * 0.7), font: bold, color: theme.ink });
    // label below
    if (r >= 14) {
      const lbl = t.table_label.length > 16 ? `${t.table_label.slice(0, 15)}…` : t.table_label;
      const lw = font.widthOfTextAtSize(lbl, 6);
      p1.drawText(lbl, { x: cx - lw / 2, y: cy - r - 8, size: 6, font, color: theme.soft });
      const cap = `${seated}/${t.capacity}`;
      const cw = font.widthOfTextAtSize(cap, 5.5);
      p1.drawText(cap, { x: cx - cw / 2, y: cy - r - 15, size: 5.5, font, color: theme.soft });
    }
  });

  // ===================== PAGES 2+ — SEATING ARRANGEMENTS ==================
  const sortedTables = [...tables].sort((a, b) => {
    const an = Number(a.table_label.match(/\d+/)?.[0] ?? 9999);
    const bn = Number(b.table_label.match(/\d+/)?.[0] ?? 9999);
    if (an !== bn) return an - bn;
    return a.table_label.localeCompare(b.table_label);
  });

  let page = doc.addPage([A4.w, A4.h]);
  drawHeader(page, 'Seating Arrangements');
  let y = A4.h - MARGIN - 80;
  const colW = (A4.w - MARGIN * 2 - 16) / 2;
  let col = 0;

  const ensureSpace = (need: number) => {
    if (y - need < MARGIN + 12) {
      if (col === 0) {
        col = 1;
        y = A4.h - MARGIN - 80;
      } else {
        page = doc.addPage([A4.w, A4.h]);
        drawHeader(page, 'Seating Arrangements');
        y = A4.h - MARGIN - 80;
        col = 0;
      }
    }
  };

  for (const t of sortedTables) {
    const seated = seatByTable.get(t.table_id) ?? [];
    const blockHeight = 22 + Math.max(seated.length, 1) * 12 + 10;
    ensureSpace(blockHeight);
    const x = MARGIN + col * (colW + 16);

    page.drawRectangle({ x, y: y - 16, width: colW, height: 18, color: lighten(theme.accent, mode === 'blueprint' ? 0.86 : 0.74) });
    page.drawText(t.table_label, { x: x + 6, y: y - 11, size: 10, font: bold, color: theme.ink });
    const meta = `${seated.length}/${t.capacity} · ${TABLE_TYPE_LABEL[t.table_type]}`;
    const mw = font.widthOfTextAtSize(meta, 7);
    page.drawText(meta, { x: x + colW - mw - 6, y: y - 10.5, size: 7, font, color: theme.soft });
    y -= 24;

    if (seated.length === 0) {
      page.drawText('— no guests seated —', { x: x + 8, y, size: 8, font, color: theme.soft });
      y -= 14;
    } else {
      seated.forEach((g, gi) => {
        page.drawText(`${gi + 1}.`, { x: x + 6, y, size: 8.5, font, color: theme.soft });
        page.drawText(g.name, { x: x + 22, y, size: 8.5, font, color: theme.ink });
        if (g.role && g.role !== 'Guest') {
          const rw = font.widthOfTextAtSize(g.role, 7);
          page.drawText(g.role, { x: x + colW - rw - 4, y, size: 7, font, color: theme.soft });
        }
        y -= 12;
      });
    }
    y -= 12;
  }

  // footer line on every page
  const pages = doc.getPages();
  pages.forEach((pg, i) => {
    pg.drawText(`Setnayan · ${event.display_name}`, { x: MARGIN, y: MARGIN - 14, size: 6.5, font, color: theme.soft });
    const pn = `${i + 1} / ${pages.length}`;
    const pw = font.widthOfTextAtSize(pn, 6.5);
    pg.drawText(pn, { x: A4.w - MARGIN - pw, y: MARGIN - 14, size: 6.5, font, color: theme.soft });
  });

  return doc.save();
}
