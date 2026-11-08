/**
 * the-details-and-schedule-are-v113-order.test.ts — 🔒 DETAILS AND SCHEDULE IN v113's ORDER (owner 2026-11-08; v113
 * `strip+three+hosts+det+acc+sups+dec+forms`; B1 step 6).
 *
 *   1 · Details: strip · numbers · Hosts · the brief + what the couple told you · access request · Suppliers on this
 *       event · Decisions · Forms sent;
 *   2 · Suppliers come from the brief's `vendor_roster` only — absent (not booked yet) draws nothing, never "none";
 *   3 · Schedule: Appointments sit right after the supplier's part, before the handover (v113: Appointments before the
 *       paperwork), drawn once.
 *
 * Sabotage log (2026-11-08, each reverted): Suppliers moved above the overview → 1 red · `supplierRows` returning [] for a
 * missing roster → 2 red · Appointments back after `<ScheduleTab` → 3 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('1 · Details in v113 order', () => {
  const d = PAGE.slice(PAGE.indexOf('const detailsShipped = ('), PAGE.indexOf('const bodies = pickedPageBodies({'));
  const order = ['{pipelineBlock}', '<DetailsNumbersRow', '<HostsList', '{overviewNode}', '{coupleAnswersNode}', 'askBlock', '<SuppliersList', '<DetailsDecisionsDoor', '<DetailsFormsDoor'];
  const at = order.map((m) => d.indexOf(m));
  at.forEach((i, k) => assert.ok(i >= 0, `Details lost ${order[k]}`));
  for (let k = 1; k < at.length; k++) assert.ok(at[k - 1]! < at[k]!, `${order[k - 1]} is not before ${order[k]}`);
});

test('2 · Suppliers come from the brief’s roster; absent draws nothing', async () => {
  const { supplierRows } = await import('./_components/suppliers-rows');
  assert.equal(supplierRows(undefined), undefined);
  assert.equal(supplierRows(null), undefined);
  assert.deepEqual(supplierRows([]), []);
  const rows = supplierRows([{ vendor_name: 'Lumière Studio', category: 'photography' }, { bad: 1 }])!;
  assert.equal(rows.length, 1, 'a malformed entry was guessed at');
  assert.equal(rows[0]!.name, 'Lumière Studio');
  assert.match(PAGE, /isBooked \? <SuppliersList rows=\{supplierRows\(\(brief as \{ vendor_roster\?: unknown \}\)\.vendor_roster\)\} \/> : null/);
});

test('4 · Decisions is a door to Chat with one honest line — no read of its own (Build 1)', async () => {
  const { decisionsLine } = await import('./_components/details-decisions');
  const peso = (n: number) => `₱${n}`;
  assert.equal(decisionsLine(null, true, peso), 'Couldn’t load your quote', 'a refused read is worded as no quote');
  assert.equal(decisionsLine(undefined, false, peso), 'No quote sent yet');
  assert.equal(decisionsLine({ status: 'accepted', totalPhp: 40000 }, false, peso), 'Quote · ₱40000 · Accepted');
  const door = stripComments(readFileSync(join(HERE, '_components/details-decisions-door.tsx'), 'utf8'));
  assert.match(door, /nav\.select\('chat'\)/, 'Decisions does not open Chat');
  assert.doesNotMatch(door, /\.from\(|fetch\(|supabase/, 'the Decisions door reads on its own');
  assert.match(PAGE, /Boolean\(proposalRowsError\)/, 'the door is not told the quote read failed');
});

test('3 · Schedule: Appointments right after the supplier’s part, once', () => {
  assert.equal((PAGE.match(/<AppointmentsSection\b/g) ?? []).length, 1, 'Appointments drawn twice');
  const tab = PAGE.slice(PAGE.indexOf('function ScheduleTab('));
  const part = tab.indexOf('<SupplierSchedule eventId={eventId} {...supplierPart} />');
  const appts = tab.indexOf('{props.appointments ?? null}');
  const handover = tab.indexOf('Deliver the handover');
  assert.ok(part > 0 && appts > part && handover > appts, 'Appointments are not between the supplier’s part and the handover');
});
