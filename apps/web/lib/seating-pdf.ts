import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { renderStyledUrlQrPng } from '@/lib/qr';
import type { QrLook } from '@/lib/qr-look';
import { lockupForEvent, drawLockupBadge } from '@/lib/lockup-pdf';
import { deriveMonogram } from '@/lib/monogram';
import { publicEventPath } from '@/lib/public-event-url';
import {
  TABLE_FOOTPRINT_M,
  boothPresenceLabel,
  defaultTablePosition,
  roomBoxM,
  rotatePoint,
  shapeHintFor,
  tableGeometry,
  type EventTableRow,
  type FloorBoothRow,
  type FloorPlanRow,
  type FloorSignRow,
  type SeatAssignmentRow,
} from '@/lib/seating';
import { BOOTH_FOOTPRINT_M } from '@/lib/seating-3d';
import { seatPlanPrintModel, unitPlanName, type SeatPlanPrintGuest, type SeatPlanPrintUnit } from '@/lib/seat-plan-print';
import { seatPlanRoomName } from '@/lib/seat-plan-details';
import { formatCount } from '@/lib/format-number';

/**
 * lib/seating-pdf.ts — THE SEAT PLAN, PRINTED: ONE A3 LANDSCAPE PAGE.
 *
 * Owner 2026-10-01, DECISION_LOG "THE SEAT PLAN IS THE VENUE FLOOR PLAN — ON
 * THE PHONE, IN 3D AND ON PAPER" (*"when it prints, we need to show the
 * elements, the tables with chairs, the stage, and the rest."*) and the
 * approved frame 7 of prototypes/seat_plan_and_walking_order_2026-10-01
 * _fable.html. This REPLACES the A4 portrait export (a floor-plan page with
 * first names squeezed onto the chairs, then "Seating Arrangements" pages):
 *   LEFT  the room to scale, from the SAME positions the 2D editor and the 3D
 *         plan read — every placed element (stage, dance floor, entrance,
 *         service door, cocktail area, each booth, each sign), every table with
 *         its chairs (a filled chair = seated), its number and count; a linked
 *         unit carries ONE label ("1 + 2  20/20").
 *   RIGHT the legend — who sits where, ONE entry per unit, open seats shown —
 *         then the UNSEATED box. Names live here, not on the chairs: at A3 a
 *         chair is ~3 mm, too small to read.
 * WHAT is printed is decided in `lib/seat-plan-print.ts` (pure, tested); this
 * file only draws it. Two looks, the same page: "in your colours" (ink on
 * white, the couple's colour on the rules and eyebrows) and "blueprint".
 */

export type SeatingPdfMode = 'moodboard' | 'blueprint';

export type SeatingPdfGuest = SeatPlanPrintGuest;

export type SeatingPdfInput = {
  mode: SeatingPdfMode;
  appUrl: string;
  /** Event owner's account slug — encodes the Event Hub QR at /u/{ownerSlug}/{slug}
   *  when the cutover flag is ON; absent / OFF encodes the bare /{slug}. */
  ownerSlug?: string | null;
  event: {
    display_name: string;
    slug: string | null;
    event_date: string | null;
    monogram_text: string | null;
    monogram_color: string | null;
    monogram_style?: string | null;
    monogram_font_key?: string | null;
    monogram_frame_key?: string | null;
    monogram_custom_svg?: string | null;
  };
  tables: EventTableRow[];
  assignments: SeatAssignmentRow[];
  guests: SeatingPdfGuest[];
  floorPlan: FloorPlanRow;
  booths: ReadonlyArray<Pick<FloorBoothRow, 'booth_id' | 'label' | 'x_pos' | 'y_pos' | 'event_vendor_id' | 'zone'>>;
  signs: ReadonlyArray<Pick<FloorSignRow, 'sign_id' | 'label' | 'x_pos' | 'y_pos'>>;
  /** The event type's couple roles — they are never listed as unseated. */
  coupleRoles: ReadonlySet<string>;
  palette: string[]; // the couple's colours (may be empty)
  logoPng: Uint8Array | null;
  /** The event's QR look (lib/qr-look.ts). Absent → the free look. */
  qrLook?: QrLook;
};

// A3 landscape, points.
export const A3_LANDSCAPE = { w: 1190.55, h: 841.89 } as const;
const MARGIN = 34;

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

/** "Saturday 3 October 2026" — the event's own calendar date (no time-zone drift). */
export function longEventDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return '';
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });
  return `${part({ weekday: 'long' })} ${part({ day: 'numeric' })} ${part({ month: 'long' })} ${part({ year: 'numeric' })}`;
}

type Theme = { ink: RGB; soft: RGB; line: RGB; paper: RGB; accent: RGB; seatFill: RGB };

function buildTheme(mode: SeatingPdfMode, palette: string[], monogramColor: string | null): Theme {
  if (mode === 'blueprint') {
    const blue = rgb(0.12, 0.26, 0.42);
    return { ink: blue, soft: rgb(0.38, 0.5, 0.62), line: rgb(0.62, 0.72, 0.82), paper: rgb(1, 1, 1), accent: blue, seatFill: blue };
  }
  // Black-on-white friendly (the approved frame): the couple's colour only on
  // the rules and the eyebrows.
  const accent = hex(palette[0] ?? monogramColor ?? '#a8843f', rgb(0.66, 0.52, 0.25));
  const ink = rgb(0.12, 0.13, 0.16);
  return { ink, soft: rgb(0.45, 0.46, 0.5), line: rgb(0.85, 0.83, 0.78), paper: rgb(1, 1, 1), accent, seatFill: ink };
}

/** Standard fonts are WinAnsi — a character outside it would throw mid-render. */
function safeText(font: PDFFont): (s: string) => string {
  const ok = new Map<string, boolean>();
  return (s: string) =>
    [...s]
      .map((ch) => {
        let v = ok.get(ch);
        if (v === undefined) {
          try {
            font.encodeText(ch);
            v = true;
          } catch {
            v = false;
          }
          ok.set(ch, v);
        }
        return v ? ch : '?';
      })
      .join('');
}

export async function buildSeatingPdf(input: SeatingPdfInput): Promise<Uint8Array> {
  const { mode, event, tables, floorPlan } = input;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const safe = safeText(font);
  const theme = buildTheme(mode, input.palette, event.monogram_color);
  const W = A3_LANDSCAPE.w;
  const H = A3_LANDSCAPE.h;

  const model = seatPlanPrintModel({
    tables,
    assignments: input.assignments,
    guests: input.guests,
    coupleRoles: input.coupleRoles,
  });

  let logo = null;
  if (input.logoPng) {
    try {
      logo = await doc.embedPng(input.logoPng);
    } catch {
      logo = null;
    }
  }
  // The Event Hub code in the event's look (lib/qr-look.ts) — every print carries it.
  let qr = null;
  if (event.slug) {
    try {
      const url = `${input.appUrl}${publicEventPath(event.slug, input.ownerSlug)}`;
      const png = await renderStyledUrlQrPng(url, input.qrLook, 360);
      qr = await doc.embedPng(new Uint8Array(png));
    } catch {
      qr = null;
    }
  }

  const monoText = (event.monogram_text?.trim() || initialsFrom(event.display_name)).slice(0, 5);
  const monoColor = hex(event.monogram_color, theme.accent);
  const lockupLabel = event.monogram_text?.trim() || deriveMonogram(event.display_name);
  const lockup = lockupForEvent(event, lockupLabel);

  // ── The room box (metres) — contract § 2: the venue's size, else the default
  //    board. Content may sit beyond it on a free board; the drawn area grows
  //    to hold everything, the walls stay where the room is.
  const room = roomBoxM(floorPlan);
  const sized = !room.isDefault;
  const pct = (xPct: number, yPct: number) => ({ x: (xPct / 100) * room.w, y: (yPct / 100) * room.d });
  const tablePct = (t: EventTableRow, i: number) =>
    t.x_pos !== null && t.y_pos !== null
      ? { x: Number(t.x_pos), y: Number(t.y_pos) }
      : defaultTablePosition(i, tables.length, !sized);
  const geos = tables.map((t) => {
    const g = tableGeometry(shapeHintFor(t.table_type), t.capacity, t.link_group_id != null);
    const mPerPx = TABLE_FOOTPRINT_M[t.table_type] / g.box.w;
    const rot = t.rotation_deg || 0;
    return {
      g: rot ? { ...g, seats: g.seats.map((p) => rotatePoint(p, rot)), outline: g.outline?.map((p) => rotatePoint(p, rot)) } : g,
      mPerPx,
      rot,
    };
  });
  const centersM = tables.map((t, i) => {
    const p = tablePct(t, i);
    return pct(p.x, p.y);
  });

  type Rect = { cx: number; cy: number; w: number; h: number; label: string; dashed?: boolean; fill?: boolean };
  const els: Rect[] = [];
  const pctRect = (x: number, y: number, w: number, h: number) => ({ ...pct(x, y), w: (w / 100) * room.w, h: (h / 100) * room.d });
  if (floorPlan.dance_enabled) {
    const r = pctRect(floorPlan.dance_x, floorPlan.dance_y, floorPlan.dance_w, floorPlan.dance_h);
    els.push({ cx: r.x, cy: r.y, w: r.w, h: r.h, label: 'DANCE FLOOR', dashed: true });
  }
  if (floorPlan.cocktail_enabled) {
    const r = pctRect(floorPlan.cocktail_x, floorPlan.cocktail_y, floorPlan.cocktail_w, floorPlan.cocktail_h);
    els.push({ cx: r.x, cy: r.y, w: r.w, h: r.h, label: (floorPlan.cocktail_label || 'Cocktail area').toUpperCase(), dashed: true });
  }
  {
    const r = pctRect(floorPlan.stage_x, floorPlan.stage_y, floorPlan.stage_w, floorPlan.stage_h);
    els.push({ cx: r.x, cy: r.y, w: Math.max(2, r.w), h: Math.max(1, r.h), label: 'STAGE', fill: true });
  }
  if (floorPlan.entrance_enabled) {
    const e = pct(floorPlan.entrance_x, floorPlan.entrance_y);
    const deep = floorPlan.entrance_kind === 'tunnel' ? Math.max(1.5, floorPlan.entrance_depth_m) : 0.9;
    els.push({ cx: e.x, cy: e.y, w: 3, h: deep, label: floorPlan.entrance_kind === 'tunnel' ? 'WALK-THROUGH' : 'ENTRANCE' });
  }
  if (floorPlan.service_entrance_enabled) {
    const s = pct(floorPlan.service_entrance_x, floorPlan.service_entrance_y);
    els.push({ cx: s.x, cy: s.y, w: 2.4, h: 0.8, label: 'SERVICE' });
  }
  for (const b of input.booths) {
    const c = pct(b.x_pos, b.y_pos);
    els.push({ cx: c.x, cy: c.y, w: BOOTH_FOOTPRINT_M.w, h: BOOTH_FOOTPRINT_M.d, label: boothPresenceLabel(b).toUpperCase() });
  }
  for (const s of input.signs) {
    const c = pct(s.x_pos, s.y_pos);
    els.push({ cx: c.x, cy: c.y, w: 1.6, h: 0.6, label: (s.label || 'Sign').toUpperCase() });
  }

  // Everything drawn, in metres → the area the page must hold.
  let minX = 0;
  let minY = 0;
  let maxX = room.w;
  let maxY = room.d;
  const grow = (x0: number, y0: number, x1: number, y1: number) => {
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  };
  tables.forEach((_, i) => {
    const { g, mPerPx } = geos[i]!;
    const r = (Math.max(g.box.w, g.box.h) / 2) * mPerPx;
    grow(centersM[i]!.x - r, centersM[i]!.y - r, centersM[i]!.x + r, centersM[i]!.y + r);
  });
  for (const e of els) grow(e.cx - e.w / 2, e.cy - e.h / 2, e.cx + e.w / 2, e.cy + e.h / 2);

  // ── Page frame
  const headerH = 74;
  const footerH = 30;
  const bodyTop = H - MARGIN - headerH;
  const bodyBottom = MARGIN + footerH;
  const planMaxW = (W - MARGIN * 2) * 0.5;
  const planMaxH = bodyTop - bodyBottom;
  const k = Math.min(planMaxW / (maxX - minX), planMaxH / (maxY - minY)); // points per metre
  const planW = (maxX - minX) * k;
  const planH = (maxY - minY) * k;
  const ox = MARGIN;
  const oy = bodyTop - (planMaxH - planH) / 2; // top of the drawn area (y-up page)
  const X = (xm: number) => ox + (xm - minX) * k;
  const Y = (ym: number) => oy - (ym - minY) * k;
  // 1 m on paper = k pt = k × 0.3528 mm → the scale as printed.
  const scaleDenom = Math.round(1000 / (k * 0.352778) / 5) * 5;

  const page1 = doc.addPage([W, H]);
  page1.drawRectangle({ x: 0, y: 0, width: W, height: H, color: theme.paper });

  // ── Header (every page draws it; page 1 carries the summary)
  const linkedNote = model.linkedLabels.length > 0 ? ` (${model.linkedLabels.join(' and ')} linked)` : '';
  const roomName = seatPlanRoomName(sized ? { width: room.w, length: room.d } : null);
  const summary = [
    sized ? `${roomName} · ${formatCount(room.w)} × ${formatCount(room.d)} m` : roomName,
    `${formatCount(model.tableCount)} ${model.tableCount === 1 ? 'table' : 'tables'}${linkedNote}`,
    `${formatCount(model.seatedCount)} seated`,
    `${formatCount(model.unseated.length)} unseated`,
    sized ? `scale 1:${formatCount(scaleDenom)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const drawHeader = (page: PDFPage, eyebrow: string, sub: string | null) => {
    const top = H - MARGIN;
    page.drawText(eyebrow, { x: MARGIN, y: top - 8, size: 7.5, font: bold, color: theme.accent });
    const dateStr = longEventDate(event.event_date);
    page.drawText(safe(dateStr ? `${event.display_name} · ${dateStr}` : event.display_name), {
      x: MARGIN,
      y: top - 34,
      size: 22,
      font: serif,
      color: theme.ink,
    });
    if (sub) page.drawText(safe(sub), { x: MARGIN, y: top - 50, size: 8, font, color: theme.soft });
    // Right: the couple's mark, then the Event Hub code.
    let rx = W - MARGIN;
    if (qr) {
      const s = 46;
      page.drawImage(qr, { x: rx - s, y: top - s, width: s, height: s });
      const cap = 'Event Hub';
      page.drawText(cap, { x: rx - s / 2 - font.widthOfTextAtSize(cap, 6) / 2, y: top - s - 8, size: 6, font, color: theme.soft });
      rx -= s + 14;
    }
    const cx = rx - 24;
    const cy = top - 24;
    page.drawCircle({ x: cx, y: cy, size: 22, borderColor: monoColor, borderWidth: 1.2, color: theme.paper });
    if (lockup) drawLockupBadge(page, lockup, { centerX: cx, centerY: cy, radius: 22 });
    else {
      const mw = bold.widthOfTextAtSize(safe(monoText), 12);
      page.drawText(safe(monoText), { x: cx - mw / 2, y: cy - 4, size: 12, font: bold, color: monoColor });
    }
    page.drawLine({ start: { x: MARGIN, y: top - headerH + 10 }, end: { x: W - MARGIN, y: top - headerH + 10 }, thickness: 0.6, color: theme.accent });
  };
  drawHeader(page1, 'SEAT PLAN', summary);

  // ── The room: floor + walls, then the elements, then the tables.
  page1.drawRectangle({
    x: X(0),
    y: Y(room.d),
    width: room.w * k,
    height: room.d * k,
    color: theme.paper,
    borderColor: theme.ink,
    borderWidth: 1.4,
  });
  const label = (page: PDFPage, text: string, cx: number, cy: number, size: number, f: PDFFont, color: RGB, maxW?: number) => {
    let t = safe(text);
    if (maxW) while (t.length > 3 && f.widthOfTextAtSize(t, size) > maxW) t = `${t.slice(0, -2)}…`.replace('……', '…');
    const w = f.widthOfTextAtSize(t, size);
    page.drawText(t, { x: cx - w / 2, y: cy - size * 0.34, size, font: f, color });
  };
  for (const e of els) {
    const x0 = X(e.cx - e.w / 2);
    const y0 = Y(e.cy + e.h / 2);
    page1.drawRectangle({
      x: x0,
      y: y0,
      width: e.w * k,
      height: e.h * k,
      color: e.fill ? lighten(theme.ink, 0.9) : theme.paper,
      borderColor: theme.ink,
      borderWidth: 0.8,
      borderDashArray: e.dashed ? [3, 2] : undefined,
    });
    label(page1, e.label, X(e.cx), Y(e.cy), Math.max(4.5, Math.min(8, e.h * k * 0.5)), bold, theme.soft, e.w * k - 4);
  }

  const chairR = Math.max(1.4, 0.22 * k); // a chair ≈ 0.45 m across
  const unitOfTable = new Map<string, SeatPlanPrintUnit>();
  for (const u of model.units) for (const id of u.tableIds) unitOfTable.set(id, u);
  tables.forEach((t, i) => {
    const { g, mPerPx, rot } = geos[i]!;
    const cx = X(centersM[i]!.x);
    const cy = Y(centersM[i]!.y);
    const s = mPerPx * k; // points per geometry px
    // Body — the serpentine ribbon outline, else a circle, else the (rotated) rectangle.
    if (g.outline) {
      const d = g.outline.map((p, n) => `${n === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + ' Z';
      page1.drawSvgPath(d, { x: cx, y: cy, scale: s, color: theme.paper, borderColor: theme.ink, borderWidth: 0.9 });
    } else if (g.hub.shape === 'round') {
      page1.drawCircle({ x: cx, y: cy, size: g.hub.radius * s, color: theme.paper, borderColor: theme.ink, borderWidth: 0.9 });
    } else {
      const hw = g.hub.w / 2;
      const hh = g.hub.h / 2;
      const corners = [
        { x: -hw, y: -hh },
        { x: hw, y: -hh },
        { x: hw, y: hh },
        { x: -hw, y: hh },
      ].map((c) => rotatePoint(c, rot));
      const d = corners.map((p, n) => `${n === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + ' Z';
      page1.drawSvgPath(d, { x: cx, y: cy, scale: s, color: theme.paper, borderColor: theme.ink, borderWidth: 0.9 });
    }
    // Chairs — one per occupiable seat; filled = someone sits there.
    for (const c of model.chairs.get(t.table_id) ?? []) {
      const seat = g.seats[c.seat];
      if (!seat) continue;
      page1.drawCircle({
        x: cx + seat.x * s,
        y: cy - seat.y * s,
        size: chairR,
        color: c.name ? theme.seatFill : theme.paper,
        borderColor: theme.ink,
        borderWidth: 0.6,
      });
    }
    // A single table wears its own number + count; a linked unit is labelled once, below.
    const u = unitOfTable.get(t.table_id);
    if (u && u.tableIds.length === 1) {
      const hubHalf = (g.hub.shape === 'round' ? g.hub.radius : Math.min(g.hub.w, g.hub.h) / 2) * s;
      const name = unitPlanName(u, [t.table_label]);
      const size = Math.max(5, Math.min(11, hubHalf * 0.7));
      label(page1, name, cx, cy + size * 0.35, size, serif, theme.ink, Math.max(18, hubHalf * 1.9));
      label(page1, `${formatCount(u.seated)}/${formatCount(u.seats)}`, cx, cy - size * 0.75, Math.max(3.8, size * 0.6), font, theme.soft);
    }
  });
  // ONE label per linked unit, at the centre of its tables.
  for (const u of model.units) {
    if (u.tableIds.length < 2) continue;
    const idx = u.tableIds.map((id) => tables.findIndex((t) => t.table_id === id)).filter((n) => n >= 0);
    if (idx.length === 0) continue;
    const mx = idx.reduce((a, n) => a + X(centersM[n]!.x), 0) / idx.length;
    const my = idx.reduce((a, n) => a + Y(centersM[n]!.y), 0) / idx.length;
    const text = `${unitPlanName(u, idx.map((n) => tables[n]!.table_label))}   ${formatCount(u.seated)}/${formatCount(u.seats)}`;
    const size = 7.5;
    const tw = bold.widthOfTextAtSize(safe(text), size);
    page1.drawRectangle({ x: mx - tw / 2 - 4, y: my - size * 0.75, width: tw + 8, height: size * 1.5, color: theme.paper, borderColor: theme.accent, borderWidth: 0.7 });
    label(page1, text, mx, my, size, bold, theme.ink);
  }

  // ── The legend: one entry per unit (numbered order), then the unseated box.
  const num = (l: string) => Number(l.match(/\d+/)?.[0] ?? Number.POSITIVE_INFINITY);
  const ordered = [...model.units].sort((a, b) => num(a.label) - num(b.label) || a.label.localeCompare(b.label));
  const GAP = 14;
  const COL_W = 118;
  const LINE = 7.4;
  type Block = { title: string; meta: string; lines: Array<{ text: string; muted: boolean }>; boxed?: boolean };
  const blocks: Block[] = ordered.map((u) => ({
    title: u.label,
    meta: `${u.kind} · ${formatCount(u.seated)}/${formatCount(u.seats)}`,
    lines: u.roster.map((n) => (n ? { text: n, muted: false } : { text: 'open seat', muted: true })),
  }));
  if (model.unseated.length > 0) {
    blocks.push({ title: `Unseated · ${formatCount(model.unseated.length)}`, meta: '', lines: model.unseated.map((n) => ({ text: n, muted: false })), boxed: true });
  }

  let page = page1;
  // The legend starts right beside the room as drawn (a tall room leaves more width for names).
  let colLeft = ox + planW + 28;
  let colX = colLeft;
  let y = bodyTop;
  const pageCols = () => Math.floor((W - MARGIN - colLeft + GAP) / (COL_W + GAP));
  let colIdx = 0;
  const nextColumn = () => {
    colIdx += 1;
    if (colIdx >= pageCols()) {
      page = doc.addPage([W, H]);
      page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: theme.paper });
      drawHeader(page, 'SEAT PLAN · WHO SITS WHERE (CONTINUED)', null);
      colLeft = MARGIN;
      colIdx = 0;
    }
    colX = colLeft + colIdx * (COL_W + GAP);
    y = bodyTop;
  };
  for (const b of blocks) {
    // Keep a block's title with at least three of its lines.
    if (y - (16 + Math.min(3, b.lines.length) * LINE) < bodyBottom) nextColumn();
    if (b.boxed) {
      page.drawText(safe(b.title.toUpperCase()), { x: colX, y: y - 8, size: 7, font: bold, color: theme.accent });
    } else {
      page.drawText(safe(b.title), { x: colX, y: y - 9, size: 10.5, font: serif, color: theme.ink });
      const mw = font.widthOfTextAtSize(safe(b.meta), 5.6);
      page.drawText(safe(b.meta), { x: colX + COL_W - mw, y: y - 8, size: 5.6, font, color: theme.soft });
    }
    page.drawLine({ start: { x: colX, y: y - 12.5 }, end: { x: colX + COL_W, y: y - 12.5 }, thickness: 0.5, color: theme.accent });
    y -= 20;
    for (const ln of b.lines) {
      if (y - LINE < bodyBottom) {
        nextColumn();
        page.drawText(safe(`${b.title} (cont.)`), { x: colX, y: y - 8, size: 7, font: bold, color: theme.soft });
        y -= 14;
      }
      let t = safe(ln.text);
      while (t.length > 3 && font.widthOfTextAtSize(t, 6.2) > COL_W) t = `${t.slice(0, -2)}…`.replace('……', '…');
      page.drawText(t, { x: colX, y, size: 6.2, font, color: ln.muted ? lighten(theme.soft, 0.35) : theme.ink });
      y -= LINE;
    }
    y -= 9;
  }

  // ── Footer on every page.
  const pages = doc.getPages();
  const credit = 'Printed from Setnayan · the same layout as the 2D and 3D plan · seating can change up to and during the event';
  const keyRest = 'linked tables print as one unit  ·  names are in the legend, not on the chairs';
  pages.forEach((pg, i) => {
    // The key: a filled chair, an empty chair, then what the plan promises.
    let kx = MARGIN + 3;
    const ky = MARGIN + 14.3;
    pg.drawCircle({ x: kx, y: ky, size: 2.4, color: theme.seatFill });
    pg.drawText('seated', { x: kx + 5, y: MARGIN + 12, size: 6.5, font, color: theme.soft });
    kx += 5 + font.widthOfTextAtSize('seated', 6.5) + 10;
    pg.drawCircle({ x: kx, y: ky, size: 2.4, color: theme.paper, borderColor: theme.ink, borderWidth: 0.6 });
    pg.drawText('open seat', { x: kx + 5, y: MARGIN + 12, size: 6.5, font, color: theme.soft });
    kx += 5 + font.widthOfTextAtSize('open seat', 6.5) + 10;
    pg.drawText(keyRest, { x: kx, y: MARGIN + 12, size: 6.5, font, color: theme.soft });
    pg.drawText(safe(credit), { x: MARGIN, y: MARGIN + 2, size: 6, font, color: theme.soft });
    const right = pages.length > 1 ? `SETNAYAN   ${formatCount(i + 1)} / ${formatCount(pages.length)}` : 'SETNAYAN';
    const rw = bold.widthOfTextAtSize(right, 6.5);
    pg.drawText(right, { x: W - MARGIN - rw, y: MARGIN + 2, size: 6.5, font: bold, color: theme.accent });
    if (logo) {
      const s = 9;
      pg.drawImage(logo, { x: W - MARGIN - rw - s - 4, y: MARGIN, width: s, height: (logo.height / logo.width) * s, opacity: 0.9 });
    }
  });

  return doc.save();
}
