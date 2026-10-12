/**
 * THE ENTRANCE SEATING CHART (owner 2026-10-13, "one seating chart for the
 * entrance" — By table · A to Z), measured on real layouts and real PDF bytes,
 * at 20, 104 and 300 guests, with long names and plus-ones:
 *   · every seated guest exactly once — and nobody without a seat;
 *   · no name is ever cut: every line inside its column, inside the sheet, and
 *     the lines spell the whole name;
 *   · A to Z is in the registry's order, each name beside its own table;
 *   · By table keeps the plan's table order and each guest under their table;
 *   · when the names cannot fit at the readable minimum, it says so and names
 *     the next size up — it never prints a chart that loses someone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';

import {
  DEFAULT_ENTRANCE_CHART_SIZE,
  ENTRANCE_CHART_SIZES,
  MIN_NAME_PT,
  azEntries,
  chartSizeSpec,
  chartUnits,
  entranceChartFits,
  joinLines,
  layoutEntranceChart,
  seatingUnits,
  unseatedCount,
  type EntranceChartLayout,
  type EntranceChartResult,
  type EntranceChartSize,
  type SeatPlanAssignment,
  type SeatPlanPerson,
  type SeatPlanTable,
} from './print-entrance-chart';
import { registryKeyCompare, surnameFirst } from './print-guest-registry';
import { renderPrintPdf } from './print-render-pdf';
import { PT_PER_MM, printableText } from './print-pieces';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FIRST = ['Ana', 'Ben', 'Carla', 'Diego', 'Elena', 'Francisco', 'Gloria', 'Hernani', 'Isabel', 'Jose', 'Katrina', 'Lorenzo', 'María', 'Ñoel', 'Olivia', 'Paolo', 'Queenie', 'Rafael', 'Sofía', 'Tomas', 'Ursula', 'Vicente', 'Wilma', 'Xavier', 'Ysabel', 'Zaldy'];
const LAST = ['Cruz', 'Santos', 'Reyes', 'Bautista', 'Dela Cruz', 'Garcia', 'Mendoza', 'Ocampo', 'Villanueva', 'Aquino', 'Lopez', 'Ramos', 'Ñañez', 'Zamora', 'Evangelista', 'Macaraeg', 'Tan', 'Uy', 'Yap', 'Quiambao'];
const LONG = [
  ['Maria Concepcion Purificacion', 'Villaseñor-Dimaculangan'],
  ['Juan Miguel Fernando', 'De los Santos-Macapagal III'],
  ['Ma. Theresa Bernadette', 'Pangilinan-Concepcion'],
];

type Fixture = { tables: SeatPlanTable[]; assignments: SeatPlanAssignment[]; guests: SeatPlanPerson[]; seatedIds: Set<string> };

function person(id: string, first: string, last: string, extra: Partial<SeatPlanPerson> = {}): SeatPlanPerson {
  return { guest_id: id, first_name: first, last_name: last, display_name: null, name_suffix: null, plus_one_of_guest_id: null, rsvp_status: 'attending', ...extra };
}

/** `n` seated people at tables of 10 — long names, named plus-ones, unnamed "+1 · TBA" seats, one linked pair — plus 3 unseated guests and 1 declined. */
function fixture(n: number): Fixture {
  const tableCount = Math.ceil(n / 10);
  const tables: SeatPlanTable[] = [];
  for (let t = 0; t < tableCount; t++) {
    tables.push({ table_id: `t${t}`, table_label: t === 0 ? 'Presidential Table' : `Table ${t}`, link_group_id: null, link_group_label: null });
  }
  // Two tables joined into one unit (owner-locked 2026-06-10: one label).
  if (tableCount > 4) {
    tables[3] = { ...tables[3]!, link_group_id: 'lg', link_group_label: 'Ninong & Ninang Tables' };
    tables[4] = { ...tables[4]!, link_group_id: 'lg', link_group_label: 'Ninong & Ninang Tables' };
  }
  const guests: SeatPlanPerson[] = [];
  const assignments: SeatPlanAssignment[] = [];
  const seatedIds = new Set<string>();
  let k = 0;
  while (guests.length < n) {
    const id = `g${k}`;
    const long = k % 37 === 5 ? LONG[(k / 37) % LONG.length | 0] : null;
    const p = person(id, long ? long[0]! : FIRST[k % FIRST.length]!, long ? long[1]! : LAST[(k * 7) % LAST.length]!, k === 9 ? { display_name: 'Tita Baby' } : {});
    guests.push(p);
    const table = `t${Math.floor((guests.length - 1) / 10)}`;
    assignments.push({ table_id: table, guest_id: id });
    seatedIds.add(id);
    // Every 6th guest brings a seat: unnamed ("+1 · TBA") or named — at the same table.
    if (k % 6 === 2 && guests.length < n) {
      const unnamed = k % 12 === 2;
      const sid = `${id}-p`;
      guests.push(person(sid, unnamed ? 'TBA' : 'Bea', unnamed ? '+1' : 'Lim', { plus_one_of_guest_id: id, display_name: unnamed ? '+1 · TBA' : null }));
      assignments.push({ table_id: `t${Math.floor((guests.length - 1) / 10)}`, guest_id: sid });
      seatedIds.add(sid);
    }
    k += 1;
  }
  // A second assignment row for one guest is never a second name on paper.
  assignments.push({ table_id: 't0', guest_id: 'g1' });
  // Not seated: listed nowhere. A declined guest with no seat is not "left to seat".
  guests.push(person('u1', 'Nora', 'Unseated'), person('u2', 'Oscar', 'Waiting'), person('u3', 'Pia', 'Later'));
  guests.push(person('d1', 'Dan', 'Declined', { rsvp_status: 'declined' }));
  // An assignment to a table no longer on the plan seats nobody.
  guests.push(person('x1', 'Gone', 'Table'));
  assignments.push({ table_id: 'deleted-table', guest_id: 'x1' });
  return { tables, assignments, guests, seatedIds };
}

function chartFor(f: Fixture, layout: EntranceChartLayout, size: EntranceChartSize): EntranceChartResult {
  const units = seatingUnits(f.tables, f.assignments, f.guests);
  return layoutEntranceChart({ coupleName: 'Maria & Jose', dateLabel: 'December 18, 2026', layout, size, units: chartUnits(units), entries: azEntries(units, f.guests) });
}

const LAYOUTS: EntranceChartLayout[] = ['table', 'az'];
const COUNTS = [20, 104, 300];

// ── The guards ────────────────────────────────────────────────────────────────

test('the seat plan as units: linked tables are ONE unit, each guest once, only real tables', () => {
  const f = fixture(104);
  const units = seatingUnits(f.tables, f.assignments, f.guests);
  assert.equal(units.filter((u) => u.label === 'Ninong & Ninang Tables').length, 1);
  assert.equal(units.find((u) => u.label === 'Ninong & Ninang Tables')!.members.length, 2);
  const ids = units.flatMap((u) => u.guests.map((g) => g.guest_id));
  assert.equal(new Set(ids).size, ids.length, 'a guest appears once');
  assert.deepEqual(new Set(ids), f.seatedIds);
  assert.ok(!ids.includes('x1'), 'a seat at a deleted table is no seat');
});

test('unseated count: no seat and not declined — the seat plan’s own rule', () => {
  const f = fixture(20);
  assert.equal(unseatedCount(f.tables, f.assignments, f.guests), 4); // u1 u2 u3 + x1 (its table is gone); d1 declined
});

for (const n of COUNTS) {
  for (const layout of LAYOUTS) {
    test(`${n} guests · ${layout}: every seated guest exactly once, no name cut, on ${DEFAULT_ENTRANCE_CHART_SIZE.toUpperCase()}`, () => {
      const f = fixture(n);
      const r = chartFor(f, layout, DEFAULT_ENTRANCE_CHART_SIZE);
      assert.ok(r.ok, `${n} guests fit on A2`);
      if (!r.ok) return;
      assert.ok(r.nameSize >= MIN_NAME_PT, `names at ${r.nameSize} pt`);
      const names = r.placed.filter((p) => p.kind === 'name');
      const ids = names.map((p) => p.guestId!);
      assert.equal(ids.length, f.seatedIds.size, 'one name per seated guest');
      assert.equal(new Set(ids).size, ids.length, 'nobody twice');
      assert.deepEqual(new Set(ids), f.seatedIds, 'exactly the seated guests — nobody unseated');
      const spec = chartSizeSpec(DEFAULT_ENTRANCE_CHART_SIZE);
      const W = spec.wMm * PT_PER_MM;
      const H = spec.hMm * PT_PER_MM;
      for (const p of r.placed) {
        // The lines spell the whole text — nothing dropped, nothing "…".
        assert.equal(joinLines(p.lines.map((l) => l.s)), p.text.replace(/\s+/g, ' '), `${p.kind} "${p.text}" spelled whole`);
        for (const l of p.lines) {
          assert.ok(!l.s.includes('…'), 'no ellipsis');
          assert.ok(l.x >= p.x0 - 0.01 && l.x + l.w <= p.x0 + p.maxW + 0.01, `"${l.s}" stays inside its column (${l.x.toFixed(1)}+${l.w.toFixed(1)} vs ${p.x0.toFixed(1)}+${p.maxW.toFixed(1)})`);
          assert.ok(l.x >= 0 && l.x + l.w <= W && l.y > 0 && l.y <= H, `"${l.s}" is on the sheet`);
        }
      }
      // No two lines in one column overlap.
      const byCol = new Map<number, number[]>();
      for (const p of r.placed.filter((q) => q.kind !== 'table')) for (const l of p.lines) byCol.set(p.col, [...(byCol.get(p.col) ?? []), l.y]);
      for (const ys of byCol.values()) {
        ys.sort((a, b) => a - b);
        for (let i = 1; i < ys.length; i++) assert.ok(ys[i]! - ys[i - 1]! >= r.nameSize * 1.0, 'lines do not overlap');
      }
    });
  }
}

test('A to Z: the registry’s order, letter dividers, each name beside ITS table', () => {
  const f = fixture(104);
  const units = seatingUnits(f.tables, f.assignments, f.guests);
  const tableOf = new Map(units.flatMap((u) => u.guests.map((g) => [g.guest_id, u.label] as const)));
  const r = chartFor(f, 'az', 'a2');
  assert.ok(r.ok);
  if (!r.ok) return;
  // Reading order: column by column, top to bottom.
  const reading = [...r.placed].sort((a, b) => a.col - b.col || a.lines[0]!.y - b.lines[0]!.y || (a.kind === 'name' ? -1 : 1));
  const names = reading.filter((p) => p.kind === 'name');
  const byId = new Map(f.guests.map((g) => [g.guest_id, g]));
  const fileKey = (id: string) => {
    const g = byId.get(id)!;
    const bringer = g.plus_one_of_guest_id && g.first_name === 'TBA' ? byId.get(g.plus_one_of_guest_id)! : g;
    return surnameFirst(bringer).key;
  };
  for (let i = 1; i < names.length; i++) {
    assert.ok(registryKeyCompare(fileKey(names[i - 1]!.guestId!), fileKey(names[i]!.guestId!)) <= 0, `${names[i - 1]!.text} before ${names[i]!.text}`);
  }
  // Surname first, as the registry prints it.
  assert.ok(names.some((p) => p.text === 'Cruz, Ana' || /^[^,]+, /.test(p.text)));
  // An unnamed seat follows the guest who brings it.
  const tba = names.findIndex((p) => p.text === '+1 · TBA');
  assert.ok(tba > 0);
  assert.equal(byId.get(names[tba]!.guestId!)!.plus_one_of_guest_id, names[tba - 1]!.guestId, '+1 · TBA sits under its guest');
  // Each table label is the table the guest is seated at, on the same line.
  const tables = r.placed.filter((p) => p.kind === 'table');
  assert.equal(tables.length, names.length);
  for (const t of tables) {
    assert.equal(t.text, printableText(tableOf.get(t.guestId!)!), `${t.guestId} → ${t.text}`);
    const nm = names.find((p) => p.guestId === t.guestId)!;
    assert.equal(t.lines[0]!.y, nm.lines[0]!.y, 'the table sits beside the name');
    assert.equal(t.col, nm.col);
  }
  // Letter dividers, in order, each before its names.
  const letters = r.placed.filter((p) => p.kind === 'letter').map((p) => p.text);
  assert.deepEqual(letters, [...letters].sort());
  assert.ok(letters.includes('N'), 'Ñañez files under N');
});

test('By table: tables in the plan’s order, each guest under their own table', () => {
  const f = fixture(104);
  const units = seatingUnits(f.tables, f.assignments, f.guests);
  const r = chartFor(f, 'table', 'a2');
  assert.ok(r.ok);
  if (!r.ok) return;
  const reading = [...r.placed].sort((a, b) => a.col - b.col || a.lines[0]!.y - b.lines[0]!.y);
  const headings = reading.filter((p) => p.kind === 'heading' && !p.text.endsWith('(CONTINUED)')).map((p) => p.text);
  assert.deepEqual(headings, units.filter((u) => u.guests.length).map((u) => u.label.toUpperCase()));
  let current = '';
  const tableOf = new Map(units.flatMap((u) => u.guests.map((g) => [g.guest_id, u.label.toUpperCase()] as const)));
  for (const p of reading) {
    if (p.kind === 'heading') current = p.text.replace(/ \(CONTINUED\)$/, '');
    else assert.equal(current, tableOf.get(p.guestId!), `${p.text} under ${current}`);
  }
});

test('too many names for the sheet: says so and names the next size up — never a chart that loses someone', () => {
  const f = fixture(300);
  const fits = entranceChartFits({
    coupleName: 'Maria & Jose',
    dateLabel: null,
    layout: 'table',
    units: chartUnits(seatingUnits(f.tables, f.assignments, f.guests)),
    entries: [],
  });
  const big = fixture(600);
  const r = chartFor(big, 'table', 'a3');
  assert.equal(r.ok, false, '600 names do not fit on A3');
  if (r.ok) return;
  assert.equal(r.reason, 'too-many');
  assert.ok(r.suggest === 'a2' || r.suggest === 'a1', `suggests a bigger sheet (${r.suggest})`);
  assert.ok(chartFor(big, 'table', r.suggest!).ok, 'the suggested size really holds everyone');
  // And the page's per-size verdict agrees with the layout's.
  for (const s of ENTRANCE_CHART_SIZES) assert.equal(fits[s.key].ok, chartFor(f, 'table', s.key).ok, s.key);
});

test('nobody seated: one plain sentence, no blank chart', () => {
  const r = layoutEntranceChart({ coupleName: 'Maria & Jose', dateLabel: null, layout: 'az', size: 'a2', units: [], entries: [] });
  assert.ok(r.ok);
  assert.equal(r.seated, 0);
  assert.ok(r.doc.ops.length > 3);
});

test('real PDF bytes: one page at the chosen size, both layouts', async () => {
  const f = fixture(104);
  for (const layout of LAYOUTS) {
    for (const size of ['a3', 'a2', 'a1'] as const) {
      const r = chartFor(f, layout, size);
      assert.ok(r.ok, `${layout} ${size}`);
      const bytes = await renderPrintPdf([r.doc], {}, { mode: 'plain', title: 'Maria & Jose — seating chart' });
      const pdf = await PDFDocument.load(bytes);
      assert.equal(pdf.getPageCount(), 1);
      const { width, height } = pdf.getPage(0).getSize();
      const spec = chartSizeSpec(size);
      assert.ok(Math.abs(width - spec.wMm * PT_PER_MM) < 1 && Math.abs(height - spec.hMm * PT_PER_MM) < 1, `${size} is ${spec.mm}`);
    }
  }
});
