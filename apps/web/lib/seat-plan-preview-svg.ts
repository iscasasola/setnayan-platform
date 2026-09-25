/**
 * lib/seat-plan-preview-svg.ts — the 2D seat plan's THUMBNAIL, for Prints & Tickets.
 *
 * Owner 2026-09-25 ("PRINTS & TICKETS HOLDS EVERY PRINT"): every free print
 * shows a real preview. The seat plan's file is `lib/seating-pdf.ts` (pdf-lib,
 * drawn straight to PDF), which a browser cannot show in an `<img>`. This draws
 * the same room from the same inputs — table positions through
 * `fitFloorTransform`, table shapes and chairs from `tableGeometry`, the stage,
 * the dance floor and the entrance — as a small SVG. It is the plan the PDF
 * prints, at thumbnail size; names are left to the file.
 *
 * PURE string work.
 */
import {
  defaultTablePosition,
  fitFloorTransform,
  rotatePoint,
  shapeHintFor,
  tableGeometry,
  type EventTableRow,
  type FloorPlanRow,
} from '@/lib/seating';

const n = (v: number) => String(Math.round(v * 10) / 10);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function seatPlanPreviewSvg(input: {
  tables: EventTableRow[];
  floorPlan: FloorPlanRow;
  /** Seats taken per table id — a filled chair reads as "someone sits here". */
  seatedByTable: ReadonlyMap<string, number>;
  mode: 'moodboard' | 'blueprint';
  palette: string[];
}): string {
  const { tables, floorPlan } = input;
  const W = 420;
  const H = 300;
  const pad = 14;
  const blueprint = input.mode === 'blueprint';
  const paper = blueprint ? '#f4f7fb' : '#fbfaf7';
  const ink = blueprint ? '#27476e' : '#1e2229';
  const accent = blueprint ? '#27476e' : input.palette[0] ?? '#c5a059';

  const venueSet = Boolean(floorPlan.venue_width_m && floorPlan.venue_length_m);
  const tablePos = (t: EventTableRow, i: number) =>
    t.x_pos !== null && t.y_pos !== null ? { x: Number(t.x_pos), y: Number(t.y_pos) } : defaultTablePosition(i, tables.length, !venueSet);
  const pts = tables.map(tablePos);
  const all = [...pts, { x: floorPlan.stage_x, y: floorPlan.stage_y }];
  if (floorPlan.entrance_enabled) all.push({ x: floorPlan.entrance_x, y: floorPlan.entrance_y });
  const tf = fitFloorTransform(all);
  const planW = W - pad * 2;
  const planH = H - pad * 2;
  const px = (x: number) => pad + (x / 100) * planW;
  const py = (y: number) => pad + (y / 100) * planH;

  const parts: string[] = [];
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${paper}"/>`);
  parts.push(`<rect x="${pad}" y="${pad}" width="${planW}" height="${planH}" fill="none" stroke="${ink}" stroke-opacity="0.35" stroke-width="1"/>`);
  if (floorPlan.dance_enabled) {
    const d = tf(floorPlan.dance_x, floorPlan.dance_y);
    const w = (floorPlan.dance_w / 100) * planW;
    const h = (floorPlan.dance_h / 100) * planH;
    parts.push(`<rect x="${n(px(d.x) - w / 2)}" y="${n(py(d.y) - h / 2)}" width="${n(w)}" height="${n(h)}" fill="none" stroke="${accent}" stroke-dasharray="4 3" stroke-opacity="0.7"/>`);
  }
  const st = tf(floorPlan.stage_x, floorPlan.stage_y);
  const sw = Math.max(40, (floorPlan.stage_w / 100) * planW);
  const sh = Math.max(10, (floorPlan.stage_h / 100) * planH);
  parts.push(`<rect x="${n(px(st.x) - sw / 2)}" y="${n(py(st.y) - sh / 2)}" width="${n(sw)}" height="${n(sh)}" fill="${ink}" fill-opacity="0.12" stroke="${ink}" stroke-width="0.8"/>`);
  if (floorPlan.entrance_enabled) {
    const e = tf(floorPlan.entrance_x, floorPlan.entrance_y);
    parts.push(`<rect x="${n(px(e.x) - 14)}" y="${n(py(e.y) - 4)}" width="28" height="8" fill="${accent}" fill-opacity="0.5"/>`);
  }

  const geos = tables.map((t) => tableGeometry(shapeHintFor(t.table_type), t.capacity, t.link_group_id != null));
  const centers = pts.map((p) => {
    const q = tf(p.x, p.y);
    return { x: px(q.x), y: py(q.y) };
  });
  const maxBox = Math.max(1, ...geos.map((g) => Math.max(g.box.w, g.box.h)));
  let scale = 70 / maxBox;
  for (let i = 0; i < centers.length; i += 1) {
    let nn = Infinity;
    for (let j = 0; j < centers.length; j += 1) {
      if (i !== j) nn = Math.min(nn, Math.hypot(centers[i]!.x - centers[j]!.x, centers[i]!.y - centers[j]!.y));
    }
    if (Number.isFinite(nn)) scale = Math.min(scale, (0.92 * nn) / maxBox);
  }
  if (!Number.isFinite(scale) || scale <= 0) scale = 70 / maxBox;

  tables.forEach((t, i) => {
    const g = geos[i]!;
    const c = centers[i]!;
    const rot = t.rotation_deg || 0;
    const fill = blueprint ? '#ffffff' : input.palette[i % Math.max(1, input.palette.length)] ?? '#efe6d6';
    if (g.outline) {
      const d = g.outline.map((p, k) => {
        const r = rotatePoint(p, rot);
        return `${k ? 'L' : 'M'}${n(c.x + r.x * scale)} ${n(c.y + r.y * scale)}`;
      });
      parts.push(`<path d="${d.join('')}Z" fill="${fill}" fill-opacity="0.55" stroke="${ink}" stroke-width="0.7"/>`);
    } else if (g.hub.shape === 'round') {
      parts.push(`<circle cx="${n(c.x)}" cy="${n(c.y)}" r="${n(g.hub.radius * scale)}" fill="${fill}" fill-opacity="0.55" stroke="${ink}" stroke-width="0.7"/>`);
    } else {
      const w = g.hub.w * scale;
      const h = g.hub.h * scale;
      parts.push(
        `<rect x="${n(c.x - w / 2)}" y="${n(c.y - h / 2)}" width="${n(w)}" height="${n(h)}" rx="${n(g.hub.shape === 'pill' ? h / 2 : 1.5)}" fill="${fill}" fill-opacity="0.55" stroke="${ink}" stroke-width="0.7" transform="rotate(${n(rot)} ${n(c.x)} ${n(c.y)})"/>`,
      );
    }
    const taken = input.seatedByTable.get(t.table_id) ?? 0;
    const chairR = Math.max(1.4, 7 * scale);
    g.seats.forEach((s, k) => {
      const r = rotatePoint(s, rot);
      parts.push(
        `<circle cx="${n(c.x + r.x * scale)}" cy="${n(c.y + r.y * scale)}" r="${n(chairR)}" fill="${k < taken ? ink : paper}" stroke="${ink}" stroke-width="0.5"/>`,
      );
    });
    const label = t.link_group_label ?? t.table_label;
    parts.push(
      `<text x="${n(c.x)}" y="${n(c.y + 3)}" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="${n(Math.max(6, Math.min(11, 26 * scale)))}" fill="${ink}">${esc(label.length > 10 ? `${label.slice(0, 9)}…` : label)}</text>`,
    );
  });
  if (!tables.length) {
    parts.push(`<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="13" fill="${ink}" fill-opacity="0.6">No tables yet</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join('')}</svg>`;
}
