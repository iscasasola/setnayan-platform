/**
 * THE GUEST LIST REGISTRY — the reception-desk list (owner 2026-09-25, "PRINTS &
 * TICKETS HOLDS EVERY PRINT"), measured on real rows, a real layout and real
 * PDF bytes:
 *   · alphabetical by surname;
 *   · the columns: name · party size · table · RSVP · a check-in box · a signature line;
 *   · the "passed away" hook: such a guest is LISTED but NOT COUNTED;
 *   · an extra-seat row folds into its guest's party; the couple is not at the desk.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';

import {
  REGISTRY_COLUMNS,
  layoutGuestRegistry,
  listedNotCounted,
  registryDate,
  registryRows,
  registryTotals,
  type RegistryGuest,
} from './print-guest-registry';
import { renderPrintPdf } from './print-render-pdf';
import { PRINT_PIECES, mayServe, printAccess } from './print-pieces';

function g(id: string, first: string, last: string, extra: Partial<RegistryGuest> = {}): RegistryGuest {
  return {
    guest_id: id,
    first_name: first,
    last_name: last,
    display_name: null,
    name_suffix: null,
    role: 'guest',
    rsvp_status: 'attending',
    plus_one_count: 0,
    plus_one_allowed: false,
    plus_one_of_guest_id: null,
    ...extra,
  };
}

const GUESTS: RegistryGuest[] = [
  g('1', 'Zed', 'Abad'),
  g('2', 'Maria', 'Santos', { plus_one_count: 2, plus_one_allowed: true, rsvp_status: 'pending' }),
  g('3', 'Ben', 'Cruz'),
  g('4', 'Ana', 'Cruz', { rsvp_status: 'declined' }),
  g('5', 'Lola', 'Bautista', { passed_away: true, plus_one_count: 1 }),
  // Maria's two extra seats: one named, one still a placeholder.
  g('6', 'Paolo', 'Reyes', { plus_one_of_guest_id: '2' }),
  g('7', 'TBA', 'Santos', { plus_one_of_guest_id: '2' }),
  // The couple.
  g('8', 'Ice', 'Casasola', { role: 'groom' }),
  g('9', 'Cale', 'Casasola', { role: 'bride' }),
];
const TABLES = new Map([
  ['1', 'Table 3'],
  ['2', 'Table 1'],
  ['3', 'Table 1'],
]);

test('rows are alphabetical by surname, then first name', () => {
  const rows = registryRows(GUESTS, TABLES);
  assert.deepEqual(
    rows.map((r) => r.name),
    ['Abad, Zed', 'Bautista, Lola', 'Cruz, Ana', 'Cruz, Ben', 'Santos, Maria'],
  );
});

test('the couple are not at their own desk, and extra seats fold into their guest’s party', () => {
  const rows = registryRows(GUESTS, TABLES);
  assert.ok(!rows.some((r) => r.name.includes('Casasola')), 'bride and groom never sign in');
  assert.ok(!rows.some((r) => r.name.includes('Reyes')), 'a companion row is not a line of its own');
  const maria = rows.find((r) => r.name === 'Santos, Maria')!;
  assert.equal(maria.party, 3, 'Maria + her two extra seats');
  assert.deepEqual(maria.companions, ['Paolo Reyes'], 'the named companion is shown; the TBA seat is a count, not a name');
  assert.equal(maria.table, 'Table 1');
  assert.equal(maria.rsvp, 'Pending');
});

test('an orphaned extra seat (its guest not on the list) still gets a line — nobody vanishes', () => {
  const rows = registryRows([g('x', 'Solo', 'Plus', { plus_one_of_guest_id: 'gone' })], new Map());
  assert.deepEqual(rows.map((r) => r.name), ['Plus, Solo']);
});

test('THE HOOK: a guest marked passed away is LISTED but NOT COUNTED', () => {
  assert.equal(listedNotCounted({ passed_away: true }), true);
  assert.equal(listedNotCounted({ passed_away: null }), false);
  assert.equal(listedNotCounted({}), false, 'until the column exists, everyone counts');
  const rows = registryRows(GUESTS, TABLES);
  const lola = rows.find((r) => r.name === 'Bautista, Lola')!;
  assert.ok(lola, 'listed');
  assert.equal(lola.counted, false);
  assert.equal(lola.party, null, 'no party size — her +1 seat is not counted either');
  assert.equal(lola.rsvp, 'In loving memory');
  const t = registryTotals(rows);
  assert.equal(t.guests, 4, 'five listed, four counted');
  assert.equal(t.people, 1 + 3 + 1 + 1, 'Abad 1 + Santos 3 + Cruz 1 + Cruz 1 — Bautista’s 2 are out');
  assert.equal(t.attendingPeople, 2, 'Abad + Ben Cruz');
});

test('the columns, in order: name · party · table · RSVP · check-in box · signature line', () => {
  assert.deepEqual(
    REGISTRY_COLUMNS.map((c) => [c.label, c.kind ?? 'text']),
    [
      ['Guest', 'text'],
      ['Party', 'text'],
      ['Table', 'text'],
      ['RSVP', 'text'],
      ['Arrived', 'box'],
      ['Signature', 'line'],
    ],
  );
  const total = REGISTRY_COLUMNS.reduce((a, c) => a + c.width, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `the column shares fill the page width (got ${total})`);
});

test('the layout draws ONE check-in box and ONE signature line per listed guest', () => {
  const rows = registryRows(GUESTS, TABLES);
  const docs = layoutGuestRegistry({ title: 'Cale & Ice', dateLabel: registryDate('2026-12-18'), rows });
  const ops = docs.flatMap((d) => d.ops);
  const boxes = ops.filter((o) => o.t === 'rect' && o.stroke && !o.fill && o.w === 9 && o.h === 9);
  assert.equal(boxes.length, rows.length);
  assert.equal(docs[0]!.piece, 'guest-registry');
  assert.equal(Math.round(docs[0]!.w), 595, 'A4 portrait');
  assert.equal(Math.round(docs[0]!.h), 842);
});

test('a long list breaks across A4 pages and every page is a real PDF page', async () => {
  const many = Array.from({ length: 140 }, (_, i) => g(`g${i}`, `Guest${String(i).padStart(3, '0')}`, `Surname${String(i % 37).padStart(2, '0')}`));
  const rows = registryRows(many, new Map());
  const docs = layoutGuestRegistry({ title: 'Big day', rows });
  assert.ok(docs.length >= 3, `140 guests need several pages (got ${docs.length})`);
  const boxes = docs.flatMap((d) => d.ops).filter((o) => o.t === 'rect' && o.stroke && !o.fill && o.w === 9);
  assert.equal(boxes.length, 140, 'no guest lost at a page break');
  const pdf = await PDFDocument.load(await renderPrintPdf(docs, {}, { mode: 'plain', title: 't' }));
  assert.equal(pdf.getPageCount(), docs.length);
});

test('an empty guest list prints a sentence, never a blank table', () => {
  const docs = layoutGuestRegistry({ title: 'New', rows: [] });
  assert.equal(docs.length, 1);
  assert.ok(docs[0]!.ops.length > 5);
});

test('the registry is FREE: no theme, no Pro, store shell included', () => {
  assert.equal(PRINT_PIECES['guest-registry'].kind, 'free');
  for (const a of [printAccess({ ownsPro: false, storeShell: false }), printAccess({ ownsPro: false, storeShell: true })]) {
    assert.equal(mayServe('guest-registry', 'print', a, 'abaca'), true);
    assert.equal(mayServe('guest-registry', 'sample', a, 'house'), true);
  }
});

test('the date is the calendar date — it never slips a day', () => {
  assert.equal(registryDate('2026-12-18'), 'December 18, 2026');
  assert.equal(registryDate(null), null);
});
