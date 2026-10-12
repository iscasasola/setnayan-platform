/**
 * lib/print-entrance-chart.ts — THE ENTRANCE SEATING CHART: one large sheet at
 * the door that tells every seated guest where they sit.
 *
 * Owner 2026-10-13 (DECISION_LOG "ONE ENTRANCE SEATING CHART, PRINTED, IN TWO
 * LAYOUTS"), verbatim: *"there are 2 ways to list the seat plan. per table.
 * they you write their names under the table. or alphabetically and you can see
 * their table number on the side of the name"* → *"printouts. one seating chart
 * for the entrance"*. So ONE sheet, two layouts:
 *   · BY TABLE — every table a block, its label as the heading, its seated
 *     guests' names under it; tables in the plan's own order (`sort_order`).
 *   · A TO Z — every seated guest by surname (the registry's rule,
 *     `surnameFirst` + `registryKeyCompare`), the table beside the name, with
 *     letter dividers.
 *
 * 🔒 THE RULES THIS FILE KEEPS (`print-entrance-chart.test.ts` holds each):
 *   · ONLY SEATED GUESTS, EACH EXACTLY ONCE. A guest with no seat is listed
 *     nowhere (the couple sees "N guests have no seat yet" before printing,
 *     `unseatedCount`).
 *   · A NAME IS NEVER CUT. Type shrinks — down to `MIN_NAME_PT` — and a long
 *     name wraps onto a second line inside its column; never an ellipsis, never
 *     a clip, never a squeeze past the column. When even the minimum cannot hold
 *     everyone, the chart says so plainly and names the next size up
 *     (`suggest`), instead of printing a chart that loses someone.
 *   · ALWAYS LIGHT (owner 2026-10-13, dark-mode call 9: "printouts … are
 *     ALWAYS light"): white paper, the free prints' ink and house gold.
 *   · Linked tables print as ONE unit under their shared label (owner-locked
 *     2026-06-10) — the same grouping the seating pack uses (`seatingUnits`).
 *
 * The sizes: the app prints A3 posters (`PRINT_PIECES.poster`); an entrance
 * board is read standing, so the chart also offers the next two A sizes and
 * opens on A2.
 *
 * PURE. Fonts are read by the print layout's type setter, nothing else.
 */
import { drawText, measure, type PrintDoc, type PrintOp } from '@/lib/print-layout';
import { PT_PER_MM, printableText, type PrintFontKey } from '@/lib/print-pieces';
import { REPORT_INK, REPORT_MUTED } from '@/lib/print-report';
import { guestDisplayName, type GuestRow } from '@/lib/guests';
import { PLACEHOLDER_FIRST_NAME } from '@/lib/extra-seats';
import { registryKeyCompare, surnameFirst } from '@/lib/print-guest-registry';
import { isDeclined } from '@/lib/seat-plan-details';
import { formatCount } from '@/lib/format-number';
import type { EventTableRow, SeatAssignmentRow } from '@/lib/seating';

// ─── The two choices ────────────────────────────────────────────────────────

export type EntranceChartLayout = 'table' | 'az';
export const ENTRANCE_CHART_LAYOUTS: readonly EntranceChartLayout[] = ['table', 'az'];
export const ENTRANCE_CHART_LAYOUT_LABELS: Record<EntranceChartLayout, string> = { table: 'By table', az: 'A to Z' };

export type EntranceChartSize = 'a3' | 'a2' | 'a1';
export type EntranceChartSizeSpec = { key: EntranceChartSize; label: string; mm: string; wMm: number; hMm: number };
/** Smallest first — `suggest` walks this order upward. */
export const ENTRANCE_CHART_SIZES: readonly EntranceChartSizeSpec[] = [
  { key: 'a3', label: 'A3', mm: '297 × 420 mm', wMm: 297, hMm: 420 },
  { key: 'a2', label: 'A2', mm: '420 × 594 mm', wMm: 420, hMm: 594 },
  { key: 'a1', label: 'A1', mm: '594 × 841 mm', wMm: 594, hMm: 841 },
];
export const DEFAULT_ENTRANCE_CHART_SIZE: EntranceChartSize = 'a2';

/** No name prints smaller than this, on any size (read standing, about an arm's length away). */
export const MIN_NAME_PT = 12;

export function parseChartLayout(v: string | null | undefined): EntranceChartLayout | null {
  return v === 'table' || v === 'az' ? v : null;
}
export function parseChartSize(v: string | null | undefined): EntranceChartSize {
  return ENTRANCE_CHART_SIZES.some((s) => s.key === v) ? (v as EntranceChartSize) : DEFAULT_ENTRANCE_CHART_SIZE;
}
export function chartSizeSpec(size: EntranceChartSize): EntranceChartSizeSpec {
  return ENTRANCE_CHART_SIZES.find((s) => s.key === size)!;
}
/** `<slug>-seating-chart-by-table.pdf` / `…-a-to-z.pdf` — the stem `printFileName` takes. */
export function chartFileStem(layout: EntranceChartLayout): string {
  return layout === 'table' ? 'seating-chart-by-table' : 'seating-chart-a-to-z';
}

// ─── The seat plan, as printed units ────────────────────────────────────────

export type SeatPlanTable = Pick<EventTableRow, 'table_id' | 'table_label' | 'link_group_id' | 'link_group_label'>;
export type SeatPlanAssignment = Pick<SeatAssignmentRow, 'table_id' | 'guest_id'>;
export type SeatPlanPerson = Pick<
  GuestRow,
  'guest_id' | 'first_name' | 'last_name' | 'display_name' | 'name_suffix' | 'plus_one_of_guest_id' | 'rsvp_status'
>;

export type SeatedUnit<T extends SeatPlanTable, G extends SeatPlanPerson> = {
  /** `link_group_id` for linked tables, else the table's own id. */
  key: string;
  label: string;
  /** The first member in the plan's order — the one whose QR a linked unit's sign carries. */
  lead: T;
  members: T[];
  /** Seated guests, by the name the seat plan shows (the pack's order). */
  guests: G[];
};

/**
 * The seat plan as the prints group it — ONE source for the seating pack and
 * this chart. Linked tables are one unit under their shared label, in the
 * plan's own order (`fetchTables` orders by `sort_order`); each guest appears
 * ONCE, at the first table an assignment names (a second row is never a second
 * seat on paper), and only when both the table and the guest are on the plan.
 */
export function seatingUnits<T extends SeatPlanTable, G extends SeatPlanPerson>(
  tables: readonly T[],
  assignments: readonly SeatPlanAssignment[],
  guests: readonly G[],
): SeatedUnit<T, G>[] {
  const guestById = new Map(guests.map((g) => [g.guest_id, g]));
  const tableIds = new Set(tables.map((t) => t.table_id));
  const seatedAt = new Map<string, G[]>();
  const placed = new Set<string>();
  for (const a of assignments) {
    const g = guestById.get(a.guest_id);
    if (!g || !tableIds.has(a.table_id) || placed.has(g.guest_id)) continue;
    placed.add(g.guest_id);
    const arr = seatedAt.get(a.table_id) ?? [];
    arr.push(g);
    seatedAt.set(a.table_id, arr);
  }
  const units = new Map<string, SeatedUnit<T, G>>();
  for (const t of tables) {
    const key = t.link_group_id ?? t.table_id;
    const u = units.get(key);
    if (u) u.members.push(t);
    else units.set(key, { key, label: (t.link_group_label ?? t.table_label ?? '').trim() || 'Table', lead: t, members: [t], guests: [] });
  }
  for (const u of units.values()) {
    u.guests = u.members.flatMap((m) => seatedAt.get(m.table_id) ?? []);
    u.guests.sort((x, y) => guestDisplayName(x).localeCompare(guestDisplayName(y)));
  }
  return [...units.values()];
}

/** An unnamed extra seat ("+1 · TBA") — a count, not a person, until it is named. */
function isUnnamedSeat(g: SeatPlanPerson): boolean {
  return Boolean(g.plus_one_of_guest_id) && (g.first_name ?? '').trim().toUpperCase() === PLACEHOLDER_FIRST_NAME;
}

/**
 * How many guests the couple still has to seat — the seat plan's own rule
 * (`seatPlanGuestSections`): no seat and not declined.
 */
export function unseatedCount(
  tables: readonly SeatPlanTable[],
  assignments: readonly SeatPlanAssignment[],
  guests: readonly SeatPlanPerson[],
): number {
  const tableIds = new Set(tables.map((t) => t.table_id));
  const seated = new Set(assignments.filter((a) => tableIds.has(a.table_id)).map((a) => a.guest_id));
  return guests.filter((g) => !seated.has(g.guest_id) && !isDeclined(g)).length;
}

export type ChartName = { guestId: string; name: string };
export type ChartUnit = { label: string; names: ChartName[] };
export type AzEntry = { guestId: string; name: string; key: string; letter: string; table: string };

/**
 * BY TABLE's blocks. A table with no one seated is left off — the chart is for
 * finding a name. Names as the seat plan and the place cards print them
 * (`guestDisplayName`), in the pack's order, except that an unnamed extra seat
 * follows the guest who brings it.
 */
export function chartUnits(units: readonly SeatedUnit<SeatPlanTable, SeatPlanPerson>[]): ChartUnit[] {
  return units
    .filter((u) => u.guests.length > 0)
    .map((u) => {
      const named = u.guests.filter((g) => !isUnnamedSeat(g));
      const unnamed = u.guests.filter(isUnnamedSeat);
      const out: ChartName[] = [];
      for (const g of named) {
        out.push({ guestId: g.guest_id, name: guestDisplayName(g) });
        for (const s of unnamed.filter((x) => x.plus_one_of_guest_id === g.guest_id)) out.push({ guestId: s.guest_id, name: guestDisplayName(s) });
      }
      const homeless = unnamed.filter((s) => !named.some((g) => g.guest_id === s.plus_one_of_guest_id));
      for (const s of homeless) out.push({ guestId: s.guest_id, name: guestDisplayName(s) });
      return { label: u.label, names: out };
    });
}

/** "Ñ" files under N, "É" under E; anything that is not a letter under "#". */
function letterOf(key: string): string {
  const c = key.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(c) ? c : '#';
}

/**
 * A TO Z's entries: every seated guest, filed by surname (the registry's rule)
 * and printed surname-first ("Cruz, Ana") so the letter above matches the
 * first word read. An unnamed extra seat is filed straight after the guest who
 * brings it — under that guest's letter, wherever that guest sits.
 */
export function azEntries(
  units: readonly SeatedUnit<SeatPlanTable, SeatPlanPerson>[],
  everyone: readonly SeatPlanPerson[],
): AzEntry[] {
  const byId = new Map(everyone.map((g) => [g.guest_id, g]));
  const rows: Array<AzEntry & { order: string }> = [];
  for (const u of units) {
    for (const g of u.guests) {
      if (isUnnamedSeat(g)) {
        const bringer = g.plus_one_of_guest_id ? byId.get(g.plus_one_of_guest_id) : undefined;
        const filed = bringer ? surnameFirst(bringer).key : guestDisplayName(g);
        rows.push({ guestId: g.guest_id, name: guestDisplayName(g), key: filed, letter: letterOf(filed), table: u.label, order: `1${guestDisplayName(g)}` });
      } else {
        const n = surnameFirst(g);
        rows.push({ guestId: g.guest_id, name: n.label, key: n.key, letter: letterOf(n.key), table: u.label, order: '0' });
      }
    }
  }
  rows.sort(
    (a, b) =>
      (a.letter === '#' ? 1 : 0) - (b.letter === '#' ? 1 : 0) ||
      registryKeyCompare(a.key, b.key) ||
      a.order.localeCompare(b.order, 'en', { numeric: true }) ||
      a.guestId.localeCompare(b.guestId),
  );
  return rows.map((r) => ({ guestId: r.guestId, name: r.name, key: r.key, letter: r.letter, table: r.table }));
}

// ─── The sheet ──────────────────────────────────────────────────────────────

const GOLD = '#a8843f';
const RULE_GOLD = '#c9b07a';

/** One line of type, where it landed — what the guards read. */
export type PlacedLine = { s: string; x: number; y: number; w: number };
export type ChartPlacement = {
  kind: 'heading' | 'letter' | 'name' | 'table';
  /** The whole text the lines spell. */
  text: string;
  guestId?: string;
  col: number;
  /** The width this text may use, from `x0`. */
  x0: number;
  maxW: number;
  align: 'left' | 'right';
  lines: PlacedLine[];
};

export type EntranceChartInput = {
  coupleName: string;
  dateLabel: string | null;
  layout: EntranceChartLayout;
  size: EntranceChartSize;
  units: readonly ChartUnit[];
  entries: readonly AzEntry[];
};

export type EntranceChartResult =
  | { ok: true; doc: PrintDoc; size: EntranceChartSize; nameSize: number; columns: number; placed: ChartPlacement[]; seated: number }
  | { ok: false; doc: PrintDoc; size: EntranceChartSize; reason: 'too-many'; suggest: EntranceChartSize | null; seated: number };

/**
 * Greedy wrap by measured width, with tracking and caps as drawn. A
 * double-barrelled surname ("Villaseñor-Dimaculangan") may break after its
 * hyphen — the hyphen stays at the end of the line, so the name still reads
 * whole (`joinLines`). Nothing is ever dropped: a piece wider than `maxW` is
 * returned as it is, and the caller refuses the size.
 */
function wrapAs(text: string, font: PrintFontKey, size: number, maxW: number, tracking = 0, caps = false): { lines: string[]; widest: number } {
  const words = (caps ? printableText(text).toUpperCase() : printableText(text)).split(/\s+/).filter(Boolean);
  const w = (s: string) => measure(s, font, size, tracking * size);
  // Each word, cut after its hyphens: "Villaseñor-" + "Dimaculangan".
  const pieces: Array<{ s: string; glued: boolean }> = [];
  for (const word of words) {
    const parts = word.split(/(?<=-)(?=[^-])/);
    parts.forEach((part, i) => pieces.push({ s: part, glued: i > 0 }));
  }
  const lines: string[] = [];
  let line = '';
  for (const p of pieces) {
    const next = line ? (p.glued ? `${line}${p.s}` : `${line} ${p.s}`) : p.s;
    if (line && w(next) > maxW) {
      lines.push(line);
      line = p.s;
    } else line = next;
  }
  if (line) lines.push(line);
  return { lines, widest: Math.max(0, ...lines.map(w)) };
}

/** The text a placement's lines spell — a line that ends in a hyphen runs straight into the next. */
export function joinLines(lines: readonly string[]): string {
  return lines.reduce((a, l) => (!a ? l : a.endsWith('-') ? `${a}${l}` : `${a} ${l}`), '');
}

type Sheet = { W: number; H: number; m: number; bodyTop: number; bodyH: number; innerW: number; sMax: number };

function sheetOf(size: EntranceChartSize): Sheet {
  const spec = chartSizeSpec(size);
  const W = spec.wMm * PT_PER_MM;
  const H = spec.hMm * PT_PER_MM;
  const m = W * 0.06;
  const bodyTop = headerBottom(W, m) + W * 0.035;
  return { W, H, m, bodyTop, bodyH: H - m - bodyTop, innerW: W - m * 2, sMax: W * 0.024 };
}

const kickerPt = (W: number) => W * 0.015;
const couplePt = (W: number) => W * 0.06;
const datePt = (W: number) => W * 0.016;
function headerBottom(W: number, m: number): number {
  return m + kickerPt(W) + couplePt(W) * 1.25 + datePt(W) * 2 + W * 0.022;
}

function drawHeader(ops: PrintOp[], sheet: Sheet, coupleName: string, dateLabel: string | null) {
  const { W, m, innerW } = sheet;
  const cx = W / 2;
  let y = m + kickerPt(W);
  drawText(ops, 'Find your table', cx, y, { font: 'poppinsMedium', size: kickerPt(W), color: GOLD, align: 'center', caps: true, tracking: 0.3 });
  y += couplePt(W) * 1.25;
  // The couple's name is set to fit the sheet's width — a long one is smaller, never cut.
  const cw = measure(printableText(coupleName), 'cardo', couplePt(W));
  const cs = cw > innerW ? couplePt(W) * (innerW / cw) * 0.995 : couplePt(W);
  drawText(ops, coupleName, cx, y, { font: 'cardo', size: cs, color: REPORT_INK, align: 'center' });
  y += datePt(W) * 2;
  if (dateLabel) drawText(ops, dateLabel, cx, y, { font: 'poppins', size: datePt(W), color: REPORT_MUTED, align: 'center', caps: true, tracking: 0.12 });
  y += W * 0.022;
  const rw = W * 0.1;
  ops.push({ t: 'rect', x: cx - rw / 2, y, w: rw, h: Math.max(0.8, W * 0.0012), fill: RULE_GOLD });
}

function blankSheet(sheet: Sheet): PrintDoc {
  // `seating-pack` — a FREE plain sheet (no bleed, no crop marks), sized here.
  return {
    piece: 'seating-pack',
    w: sheet.W,
    h: sheet.H,
    bleed: 0,
    die: 'rect',
    diePath: `M0 0H${sheet.W}V${sheet.H}H0Z`,
    ops: [{ t: 'rect', x: 0, y: 0, w: sheet.W, h: sheet.H, fill: '#ffffff' }],
  };
}

/** One thing in a column: its height and how to place it at a column's top-left. */
type Item = {
  h: number;
  /** A heading keeps the next item with it. */
  head?: boolean;
  /** By table: the group (block) this item belongs to, and its continued heading. */
  group: number;
  place: (col: number, x: number, y: number, colW: number) => ChartPlacement[];
};
type Built = { items: Item[]; groupGap: number; keepBlocks: boolean; contHead: (group: number) => Item | null; minColW: number };

const NAME_FONT: PrintFontKey = 'cardo';
const lineH = (s: number) => s * 1.32;

function lineAt(s: string, font: PrintFontKey, size: number, x: number, y: number, tracking = 0): PlacedLine {
  return { s, x, y, w: measure(s, font, size, tracking * size) };
}

/** BY TABLE, at name size `s` and column width `colW` — null when a line cannot fit the column. */
function buildByTable(units: readonly ChartUnit[], s: number, colW: number): Built | null {
  const hs = s * 0.92;
  const headLH = hs * 1.6;
  const indent = s * 0.8;
  const items: Item[] = [];
  const heads: Item[] = [];
  const contHeads: Item[] = [];
  const headingItem = (label: string, g: number, cont: boolean): Item | null => {
    const text = cont ? `${label} (continued)` : label;
    const wr = wrapAs(text, 'poppinsMedium', hs, colW, 0.1, true);
    if (wr.widest > colW) return null;
    const h = wr.lines.length * headLH + s * 0.35;
    return {
      h,
      head: true,
      group: g,
      place: (col, x, y) => [
        {
          kind: 'heading',
          text: printableText(text).toUpperCase(),
          col,
          x0: x,
          maxW: colW,
          align: 'left',
          lines: wr.lines.map((l, i) => lineAt(l, 'poppinsMedium', hs, x, y + hs + i * headLH, 0.1)),
        },
      ],
    };
  };
  for (const [g, u] of units.entries()) {
    const head = headingItem(u.label, g, false);
    const cont = headingItem(u.label, g, true);
    if (!head || !cont) return null;
    heads.push(head);
    contHeads.push(cont);
    items.push(head);
    for (const n of u.names) {
      const first = wrapAs(n.name, NAME_FONT, s, colW);
      // A wrapped name's second line is indented, so it reads as one name.
      const lines = first.lines.length > 1 ? [first.lines[0]!, ...wrapAs(joinLines(first.lines.slice(1)), NAME_FONT, s, colW - indent).lines] : first.lines;
      if (lines.some((l, i) => measure(l, NAME_FONT, s) > (i === 0 ? colW : colW - indent))) return null;
      items.push({
        h: lines.length * lineH(s),
        group: g,
        place: (col, x, y) => [
          {
            kind: 'name',
            text: printableText(n.name),
            guestId: n.guestId,
            col,
            x0: x,
            maxW: colW,
            align: 'left',
            lines: lines.map((l, i) => lineAt(l, NAME_FONT, s, i === 0 ? x : x + indent, y + s * 1.02 + i * lineH(s))),
          },
        ],
      });
    }
  }
  return { items, groupGap: s * 1.1, keepBlocks: true, contHead: (g) => contHeads[g] ?? null, minColW: s * 7 };
}

/** A TO Z, at name size `s` and column width `colW` — null when a line cannot fit. */
function buildAz(entries: readonly AzEntry[], s: number, colW: number): Built | null {
  const ts = s * 0.86;
  const ls = s * 1.7;
  const gap = s * 0.9;
  // The table sits at the right of the column, as wide as its own label: the
  // room a short name leaves, else up to 42 % of the column (wrapping past
  // that; a single longer word up to 60 %). The name takes the rest.
  const tableCap = colW * 0.42;
  const items: Item[] = [];
  let letter: string | null = null;
  let g = -1;
  for (const e of entries) {
    if (e.letter !== letter) {
      letter = e.letter;
      g += 1;
      const L = letter;
      items.push({
        h: ls * 1.25,
        head: true,
        group: g,
        place: (col, x, y) => [
          { kind: 'letter', text: L, col, x0: x, maxW: colW, align: 'left', lines: [lineAt(L, 'cardoBold', ls, x, y + ls * 0.95)] },
        ],
      });
    }
    // One word longer than the cap ("Presidential") takes what it needs, up to 60 %.
    // A short name leaves the label the rest of the line.
    const room = Math.max(tableCap, colW - measure(printableText(e.name), NAME_FONT, s) - gap);
    let table = wrapAs(e.table, 'poppinsMedium', ts, room);
    if (table.widest > room) table = wrapAs(e.table, 'poppinsMedium', ts, table.widest);
    if (table.widest > colW * 0.6) return null;
    const tableW = table.widest;
    const nameW = colW - tableW - gap;
    if (nameW < s * 4) return null;
    const name = wrapAs(e.name, NAME_FONT, s, nameW);
    if (name.widest > nameW) return null;
    const n = Math.max(name.lines.length, table.lines.length);
    items.push({
      h: n * lineH(s),
      group: g,
      place: (col, x, y) => [
        {
          kind: 'name',
          text: printableText(e.name),
          guestId: e.guestId,
          col,
          x0: x,
          maxW: nameW,
          align: 'left',
          lines: name.lines.map((l, i) => lineAt(l, NAME_FONT, s, x, y + s * 1.02 + i * lineH(s))),
        },
        {
          kind: 'table',
          text: printableText(e.table),
          guestId: e.guestId,
          col,
          x0: x + colW - tableW,
          maxW: tableW,
          align: 'right',
          lines: table.lines.map((l, i) => {
            const w = measure(l, 'poppinsMedium', ts);
            return { s: l, x: x + colW - w, y: y + s * 1.02 + i * lineH(s), w };
          }),
        },
      ],
    });
  }
  return { items, groupGap: s * 0.55, keepBlocks: false, contHead: () => null, minColW: s * 9 };
}

type Slot = { item: Item; col: number; y: number };

/** Flow the items down `cols` columns of height `limit`. Null when they do not all fit. */
function flow(b: Built, cols: number, limit: number): Slot[] | null {
  const out: Slot[] = [];
  let col = 0;
  let y = 0;
  const { items } = b;
  const blockH = new Map<number, number>();
  for (const it of items) blockH.set(it.group, (blockH.get(it.group) ?? 0) + it.h);
  let lastGroup = -1;
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    if (it.h > limit) return null;
    if (it.group !== lastGroup && y > 0) y += b.groupGap;
    if (it.head) {
      const next = items[i + 1];
      const need = b.keepBlocks && (blockH.get(it.group) ?? 0) <= limit ? blockH.get(it.group)! : it.h + (next && next.group === it.group ? next.h : 0);
      if (y > 0 && y + need > limit) {
        col += 1;
        y = 0;
      }
    } else if (y + it.h > limit) {
      col += 1;
      y = 0;
      const cont = b.contHead(it.group);
      if (cont) {
        if (col >= cols || cont.h + it.h > limit) return null;
        out.push({ item: cont, col, y });
        y += cont.h;
      }
    }
    if (col >= cols) return null;
    out.push({ item: it, col, y });
    y += it.h;
    lastGroup = it.group;
  }
  return out;
}

const colWidth = (sheet: Sheet, cols: number, s: number) => (sheet.innerW - gutterOf(sheet, s) * (cols - 1)) / cols;
const gutterOf = (sheet: Sheet, s: number) => Math.max(s * 1.8, sheet.W * 0.02);

function build(input: EntranceChartInput, s: number, colW: number): Built | null {
  return input.layout === 'table' ? buildByTable(input.units, s, colW) : buildAz(input.entries, s, colW);
}

type Fit = { s: number; cols: number; colW: number; limit: number; slots: Slot[] };

/** The tallest the columns need be: the shortest height at which everything still fits (balanced columns). */
function balance(b: Built, cols: number, bodyH: number): { limit: number; slots: Slot[] } | null {
  const full = flow(b, cols, bodyH);
  if (!full) return null;
  // By table never splits a table to even the columns out: a block that fits a
  // whole column is a floor for the balanced height.
  const blocks = new Map<number, number>();
  for (const it of b.items) blocks.set(it.group, (blocks.get(it.group) ?? 0) + it.h);
  const wholeBlock = b.keepBlocks ? Math.max(0, ...[...blocks.values()].filter((h) => h <= bodyH)) : 0;
  let lo = Math.max(0, wholeBlock - 1e-6, ...b.items.map((i) => i.h));
  let hi = bodyH;
  let best = { limit: bodyH, slots: full };
  for (let k = 0; k < 14 && hi - lo > 1; k++) {
    const mid = (lo + hi) / 2;
    const f = flow(b, cols, mid);
    if (f) {
      best = { limit: mid, slots: f };
      hi = mid;
    } else lo = mid;
  }
  return best;
}

function fitAt(input: EntranceChartInput, sheet: Sheet, s: number, cols: number): Built | null {
  const colW = colWidth(sheet, cols, s);
  if (colW <= 0) return null;
  const b = build(input, s, colW);
  if (!b || colW < b.minColW) return null;
  return flow(b, cols, sheet.bodyH) ? b : null;
}

/** The largest name size, and the column count, that seat everyone on the sheet. */
function bestFit(input: EntranceChartInput, sheet: Sheet): Fit | null {
  let best: Fit | null = null;
  for (let cols = 1; cols <= 10; cols++) {
    if (!fitAt(input, sheet, MIN_NAME_PT, cols)) continue;
    let lo = MIN_NAME_PT;
    let hi = sheet.sMax;
    if (fitAt(input, sheet, hi, cols)) lo = hi;
    else {
      for (let k = 0; k < 10 && hi - lo > 0.1; k++) {
        const mid = (lo + hi) / 2;
        if (fitAt(input, sheet, mid, cols)) lo = mid;
        else hi = mid;
      }
    }
    const s = Math.floor(lo * 4) / 4;
    const colW = colWidth(sheet, cols, s);
    const b = build(input, s, colW);
    if (!b) continue;
    const bal = balance(b, cols, sheet.bodyH);
    if (!bal) continue;
    const cand: Fit = { s, cols, colW, limit: bal.limit, slots: bal.slots };
    // Bigger type wins; at the same type, the shorter (more even) columns; then fewer columns.
    if (!best || cand.s > best.s + 0.01 || (Math.abs(cand.s - best.s) <= 0.01 && cand.limit < best.limit - 1)) best = cand;
  }
  return best;
}

function seatedOf(input: EntranceChartInput): number {
  return input.layout === 'table' ? input.units.reduce((a, u) => a + u.names.length, 0) : input.entries.length;
}

/**
 * The chart on one sheet. `ok: false` when the names cannot all be set at
 * `MIN_NAME_PT` or larger — the doc then carries the header and the plain
 * sentence, and `suggest` names the next size up that holds everyone.
 */
export function layoutEntranceChart(input: EntranceChartInput): EntranceChartResult {
  const sheet = sheetOf(input.size);
  const doc = blankSheet(sheet);
  drawHeader(doc.ops, sheet, input.coupleName, input.dateLabel);
  const seated = seatedOf(input);
  const message = (lines: string[]) => {
    const size = sheet.W * 0.022;
    lines.forEach((l, i) =>
      drawText(doc.ops, l, sheet.W / 2, sheet.bodyTop + sheet.bodyH * 0.3 + i * size * 1.6, { font: 'poppins', size, color: REPORT_MUTED, align: 'center', maxWidth: sheet.innerW }),
    );
  };
  if (seated === 0) {
    message(['No one is seated yet.', 'Seat your guests in the Seat plan, then print this chart.']);
    return { ok: true, doc, size: input.size, nameSize: 0, columns: 0, placed: [], seated };
  }
  const fit = bestFit(input, sheet);
  if (!fit) {
    const bigger = ENTRANCE_CHART_SIZES.slice(ENTRANCE_CHART_SIZES.findIndex((x) => x.key === input.size) + 1);
    const suggest = bigger.find((x) => bestFit(input, sheetOf(x.key)))?.key ?? null;
    message(entranceChartTooBigWords(seated, input.size, suggest));
    return { ok: false, doc, size: input.size, reason: 'too-many', suggest, seated };
  }
  const g = gutterOf(sheet, fit.s);
  const used = Math.max(...fit.slots.map((sl) => sl.col)) + 1;
  const total = used * fit.colW + (used - 1) * g;
  const x0 = (sheet.W - total) / 2;
  // A short chart sits a little above the middle of the space under the header.
  const y0 = sheet.bodyTop + Math.max(0, (sheet.bodyH - fit.limit) / 3);
  const placed: ChartPlacement[] = [];
  for (const sl of fit.slots) placed.push(...sl.item.place(sl.col, x0 + sl.col * (fit.colW + g), y0 + sl.y, fit.colW));
  for (const p of placed) {
    for (const l of p.lines) {
      if (p.kind === 'heading') drawText(doc.ops, l.s, l.x, l.y, { font: 'poppinsMedium', size: fit.s * 0.92, color: GOLD, caps: true, tracking: 0.1 });
      else if (p.kind === 'letter') drawText(doc.ops, l.s, l.x, l.y, { font: 'cardoBold', size: fit.s * 1.7, color: GOLD });
      else if (p.kind === 'table') drawText(doc.ops, l.s, l.x, l.y, { font: 'poppinsMedium', size: fit.s * 0.86, color: REPORT_INK });
      else drawText(doc.ops, l.s, l.x, l.y, { font: NAME_FONT, size: fit.s, color: REPORT_INK });
    }
    // A hairline under each table's heading.
    if (p.kind === 'heading') {
      const last = p.lines[p.lines.length - 1]!;
      doc.ops.push({ t: 'rect', x: p.x0, y: last.y + fit.s * 0.42, w: p.maxW, h: Math.max(0.5, fit.s * 0.05), fill: RULE_GOLD, opacity: 0.7 });
    }
  }
  return { ok: true, doc, size: input.size, nameSize: fit.s, columns: used, placed, seated };
}

/** The plain sentence for a chart too full for its sheet — the page and the route say the same. */
export function entranceChartTooBigWords(seated: number, size: EntranceChartSize, suggest: EntranceChartSize | null): string[] {
  const here = chartSizeSpec(size).label;
  return [
    `${formatCount(seated)} names don’t fit on ${here} at a size guests can read.`,
    suggest ? `Choose ${chartSizeSpec(suggest).label} — every name fits there.` : 'Even A1 is too small — print By table and A to Z as two charts.',
  ];
}

/** Whether each size holds every name, for one layout — what the page shows before a press. */
export function entranceChartFits(input: Omit<EntranceChartInput, 'size'>): Record<EntranceChartSize, { ok: boolean; suggest: EntranceChartSize | null }> {
  const out = {} as Record<EntranceChartSize, { ok: boolean; suggest: EntranceChartSize | null }>;
  let firstFitAbove: EntranceChartSize | null = null;
  for (const spec of [...ENTRANCE_CHART_SIZES].reverse()) {
    const r = seatedOf({ ...input, size: spec.key }) === 0 ? true : Boolean(bestFit({ ...input, size: spec.key }, sheetOf(spec.key)));
    out[spec.key] = { ok: r, suggest: r ? null : firstFitAbove };
    if (r) firstFitAbove = spec.key;
  }
  return out;
}
