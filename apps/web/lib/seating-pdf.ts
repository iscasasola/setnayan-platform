import { PDFDocument, StandardFonts, rgb, degrees, type PDFPage, type RGB } from 'pdf-lib';
import QRCode from 'qrcode';
import { lockupForEvent, drawLockupBadge } from '@/lib/lockup-pdf';
import {
  CHAIR_PX,
  TABLE_TYPE_LABEL,
  defaultTablePosition,
  effectiveCapacity,
  fitFloorTransform,
  removedSeatSet,
  rotatePoint,
  shapeHintFor,
  tableGeometry,
  type EventTableRow,
  type FloorPlanRow,
  type SeatAssignmentRow,
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
    // Monogram design columns — present when the couple designed a lockup, so
    // the badge draws their REAL mark (bar/duo/script/infinity) not just initials.
    monogram_style?: string | null;
    monogram_font_key?: string | null;
    monogram_frame_key?: string | null;
    monogram_custom_svg?: string | null;
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

// First name (or initials when it's long) for a chair label — keeps the ring of
// names around a table legible instead of overflowing into neighbours.
function chairLabel(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const first = clean.split(' ')[0]!;
  if (first.length <= 11) return first;
  // Long single token → initials of up to the first two words.
  const inits = clean
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  return inits || first.slice(0, 10);
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
  const assignsByTable = new Map<string, SeatAssignmentRow[]>();
  for (const a of assignments) {
    const g = guestById.get(a.guest_id);
    if (!g) continue;
    const arr = seatByTable.get(a.table_id) ?? [];
    arr.push(g);
    seatByTable.set(a.table_id, arr);
    const al = assignsByTable.get(a.table_id) ?? [];
    al.push(a);
    assignsByTable.set(a.table_id, al);
  }

  // Per-table occupant slots indexed by seat number — so the floor-plan chairs
  // land each guest in their actual chair (mirrors the editor's occupantsFor:
  // seat_number wins; anyone unnumbered/overflowing fills the next free slot).
  const occByTable = new Map<string, (SeatingPdfGuest | null)[]>();
  for (const t of tables) {
    const occ: (SeatingPdfGuest | null)[] = new Array(t.capacity).fill(null);
    const overflow: SeatingPdfGuest[] = [];
    for (const a of assignsByTable.get(t.table_id) ?? []) {
      const g = guestById.get(a.guest_id);
      if (!g) continue;
      if (
        a.seat_number !== null &&
        a.seat_number >= 0 &&
        a.seat_number < t.capacity &&
        occ[a.seat_number] === null
      ) {
        occ[a.seat_number] = g;
      } else {
        overflow.push(g);
      }
    }
    const removed = removedSeatSet(t.removed_seats, t.capacity);
    let idx = 0;
    for (const g of overflow) {
      while (idx < occ.length && (occ[idx] !== null || removed.has(idx))) idx++;
      if (idx < occ.length) occ[idx] = g;
    }
    occByTable.set(t.table_id, occ);
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
  // The couple's chosen type-only lockup (bar/duo/script/infinity), or null →
  // keep the legacy initials badge (framed · single-initial · bespoke · legacy).
  // The lockup label keeps the "A & B" form deriveMonogram produces, not the
  // squashed "A&B" monoText above.
  const lockupLabel = event.monogram_text?.trim() || event.display_name;
  const lockup = lockupForEvent(event, lockupLabel);

  // ---- shared header band -------------------------------------------------
  const drawHeader = (page: PDFPage, subtitle: string) => {
    const top = A4.h - MARGIN;
    // monogram badge
    const cx = MARGIN + 26;
    const cy = top - 26;
    page.drawCircle({ x: cx, y: cy, size: 26, borderColor: monoColor, borderWidth: 1.5, color: theme.paper });
    if (lockup) {
      drawLockupBadge(page, lockup, { centerX: cx, centerY: cy, radius: 26 });
    } else {
      const mw = bold.widthOfTextAtSize(monoText, 13);
      page.drawText(monoText, { x: cx - mw / 2, y: cy - 4.5, size: 13, font: bold, color: monoColor });
    }

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

  // The free auto-grow board can place tables beyond 0–100; fit such a spread
  // layout back into the box (no-op for in-bounds / to-scale-room layouts).
  const tablePos = (t: EventTableRow, i: number) =>
    t.x_pos !== null && t.y_pos !== null
      ? { x: Number(t.x_pos), y: Number(t.y_pos) }
      : defaultTablePosition(i, tables.length, !venueSet);
  const tablePts = tables.map((t, i) => tablePos(t, i));
  const allPts = [...tablePts, { x: floorPlan.stage_x, y: floorPlan.stage_y }];
  if (floorPlan.entrance_enabled) {
    allPts.push({ x: floorPlan.entrance_x, y: floorPlan.entrance_y });
  }
  const tf = fitFloorTransform(allPts);

  // percent (0–100, y-down) → page point (y-up), via the fit transform
  const px = (xPct: number) => planX + (xPct / 100) * planW;
  const py = (yPct: number) => planYTop - (yPct / 100) * planH;

  // stage
  const stageP = tf(floorPlan.stage_x, floorPlan.stage_y);
  const sx = px(stageP.x);
  const sy = py(stageP.y);
  p1.drawRectangle({ x: sx - 38, y: sy - 8, width: 76, height: 16, color: theme.paper, borderColor: theme.ink, borderWidth: 0.75 });
  p1.drawText('STAGE', { x: sx - 14, y: sy - 3.5, size: 7, font: bold, color: theme.soft });
  // entrance
  if (floorPlan.entrance_enabled) {
    const eP = tf(floorPlan.entrance_x, floorPlan.entrance_y);
    const ex = px(eP.x);
    const ey = py(eP.y);
    p1.drawRectangle({ x: ex - 26, y: ey - 7, width: 52, height: 14, color: theme.paper, borderColor: theme.accent, borderWidth: 0.75 });
    p1.drawText('ENTRANCE', { x: ex - 21, y: ey - 3, size: 6, font: bold, color: theme.soft });
  }

  // tables + chairs, drawn as large as the layout allows ("full size"). We reuse
  // the editor's chair geometry (tableGeometry) so the print matches the screen,
  // then pick ONE global points-per-px scale: big enough to read each guest's
  // name, small enough that neighbouring tables never collide and every table
  // stays inside the floor box.
  // Geometry per table, rotated by the table's orientation (seats + ribbon
  // outline) so rotated/connected tables print as laid out. Box stays unrotated
  // (it only feeds the spacing scale below).
  const geos = tables.map((t) => {
    const g = tableGeometry(shapeHintFor(t.table_type), t.capacity);
    const rot = t.rotation_deg || 0;
    if (!rot) return g;
    return {
      ...g,
      seats: g.seats.map((p) => rotatePoint(p, rot)),
      outline: g.outline?.map((p) => rotatePoint(p, rot)),
    };
  });
  const centers = tables.map((t, i) => {
    const raw = tablePos(t, i);
    const p = tf(raw.x, raw.y);
    return { x: px(p.x), y: py(p.y) };
  });
  const bbox = geos.map((g) => Math.max(g.box.w, g.box.h)); // px footprint incl. chairs
  const maxBox = bbox.length ? Math.max(...bbox) : 1;

  let scale = 240 / maxBox; // cap: keep a lone/sparse table from ballooning
  for (let i = 0; i < centers.length; i++) {
    // collision: drawn footprint ≤ ~0.9 × distance to the nearest other table
    let nn = Infinity;
    for (let j = 0; j < centers.length; j++) {
      if (i === j) continue;
      nn = Math.min(nn, Math.hypot(centers[i]!.x - centers[j]!.x, centers[i]!.y - centers[j]!.y));
    }
    if (Number.isFinite(nn)) scale = Math.min(scale, (0.9 * nn) / bbox[i]!);
    // fit: the drawn footprint must stay inside the floor box on every side
    const half = Math.max(
      6,
      Math.min(
        centers[i]!.x - planX,
        planX + planW - centers[i]!.x,
        planYTop - centers[i]!.y,
        centers[i]!.y - (planYTop - planH),
      ),
    );
    scale = Math.min(scale, (2 * half) / bbox[i]!);
  }
  if (!Number.isFinite(scale) || scale <= 0) scale = 240 / maxBox;

  const nameSize = Math.max(3.6, Math.min(7, scale * 17));
  const chairR = Math.max(1.6, scale * (CHAIR_PX / 2) * 0.5);

  tables.forEach((t, i) => {
    const geo = geos[i]!;
    const { x: cx, y: cy } = centers[i]!;
    const occ = occByTable.get(t.table_id) ?? [];
    const seated = seatByTable.get(t.table_id)?.length ?? 0;
    const { fill, border } = theme.tableFor(i);

    // hub (table body) — a curved ribbon for serpentine (outline polygon),
    // else a circle (round) or rectangle. Seat-space is y-down; map each point
    // to the page the same way chairs are (cx + x·s, cy − y·s).
    if (geo.outline) {
      // pdf-lib maps a path point (px,py) → page (x + px·scale, y − py·scale),
      // i.e. the same y-down→y-up flip we use for chairs, so feed raw seat-space.
      const d =
        geo.outline
          .map((p, k) => `${k === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
          .join(' ') + ' Z';
      p1.drawSvgPath(d, { x: cx, y: cy, scale, color: fill, borderColor: border, borderWidth: 1 });
    } else if (geo.hub.shape === 'round') {
      p1.drawCircle({ x: cx, y: cy, size: geo.hub.radius * scale, color: fill, borderColor: border, borderWidth: 1 });
    } else {
      // rect / pill — draw as a (possibly rotated) corner polygon so a rotated
      // banquet/sweetheart body matches its rotated chairs.
      const hw = geo.hub.w / 2;
      const hh = geo.hub.h / 2;
      const rot = t.rotation_deg || 0;
      const corners = [
        { x: -hw, y: -hh },
        { x: hw, y: -hh },
        { x: hw, y: hh },
        { x: -hw, y: hh },
      ].map((c) => rotatePoint(c, rot));
      const d =
        corners.map((p, k) => `${k === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + ' Z';
      p1.drawSvgPath(d, { x: cx, y: cy, scale, color: fill, borderColor: border, borderWidth: 1 });
    }

    // chairs + the seated guest's name at each chair (deleted chairs skipped)
    const removed = removedSeatSet(t.removed_seats, t.capacity);
    geo.seats.forEach((s, si) => {
      if (removed.has(si)) return;
      const chx = cx + s.x * scale;
      const chy = cy - s.y * scale; // editor y-down → page y-up
      const g = occ[si] ?? null;
      p1.drawCircle({
        x: chx,
        y: chy,
        size: chairR,
        color: g ? lighten(border, 0.55) : theme.paper,
        borderColor: border,
        borderWidth: 0.6,
      });
      if (g) {
        const label = chairLabel(g.name);
        const halfW = font.widthOfTextAtSize(label, nameSize) / 2;
        const halfH = nameSize * 0.5;
        // unit radial direction from the hub centre (page-space, y-up)
        const len = Math.hypot(s.x, s.y) || 1;
        const dx = s.x / len;
        const dy = -s.y / len;
        // push far enough that the name's own box clears the chair on whichever
        // side it sits — projects the label's half-extent onto the radial.
        const dist = chairR + Math.abs(dx) * halfW + Math.abs(dy) * halfH + 2;
        const nx = chx + dx * dist;
        const ny = chy + dy * dist;
        p1.drawText(label, { x: nx - halfW, y: ny - nameSize * 0.34, size: nameSize, font, color: theme.ink });
      }
    });

    // table number in the hub centre
    const num = t.table_label.match(/\d+/)?.[0] ?? String(i + 1);
    const hubHalf = (geo.hub.shape === 'round' ? geo.hub.radius : geo.hub.h / 2) * scale;
    const numSize = Math.max(6.5, Math.min(13, hubHalf * 0.95));
    const nw = bold.widthOfTextAtSize(num, numSize);
    p1.drawText(num, { x: cx - nw / 2, y: cy - numSize * 0.34, size: numSize, font: bold, color: theme.ink });

    // table label just under the whole table footprint
    const reachPt = (geo.box.h / 2) * scale;
    const lbl = t.table_label.length > 18 ? `${t.table_label.slice(0, 17)}…` : t.table_label;
    const lblSize = Math.max(5, Math.min(7.5, scale * 15));
    const effCap = effectiveCapacity(t.capacity, t.removed_seats);
    const lw2 = bold.widthOfTextAtSize(`${lbl}  ${seated}/${effCap}`, lblSize);
    p1.drawText(`${lbl}  ${seated}/${effCap}`, {
      x: cx - lw2 / 2,
      y: cy - reachPt - lblSize - 1.5,
      size: lblSize,
      font: bold,
      color: theme.soft,
    });
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

  // footer on every page: event name (left) · gold mark + "Created by WWW.SETNAYAN.COM"
  // (centre) · page no. (right)
  const pages = doc.getPages();
  const credit = 'Created by WWW.SETNAYAN.COM';
  const creditW = font.widthOfTextAtSize(credit, 6.5);
  const markS = logo ? 9 : 0;
  const markGap = logo ? 4 : 0;
  const groupX = (A4.w - (markS + markGap + creditW)) / 2;
  pages.forEach((pg, i) => {
    pg.drawText(event.display_name, { x: MARGIN, y: MARGIN - 14, size: 6.5, font, color: theme.soft });
    if (logo) {
      const lh = (logo.height / logo.width) * markS;
      pg.drawImage(logo, { x: groupX, y: MARGIN - 16, width: markS, height: lh, opacity: 0.9 });
    }
    pg.drawText(credit, { x: groupX + markS + markGap, y: MARGIN - 14, size: 6.5, font, color: theme.soft });
    const pn = `${i + 1} / ${pages.length}`;
    const pw = font.widthOfTextAtSize(pn, 6.5);
    pg.drawText(pn, { x: A4.w - MARGIN - pw, y: MARGIN - 14, size: 6.5, font, color: theme.soft });
  });

  return doc.save();
}
