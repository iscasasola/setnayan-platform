/**
 * the-details-and-schedule-are-v113-order.test.ts — 🔒 DETAILS AND SCHEDULE IN v113's ORDER (owner 2026-11-08; v113
 * `strip+three+hosts+det+acc+sups+dec+forms`; B1 step 6).
 *
 *   1 · Details: strip · numbers · Hosts · the brief + what the couple told you · access request · Suppliers on this
 *       event · Decisions · Forms sent;
 *   2 · Suppliers come from the brief's `vendor_roster` only — absent (not booked yet) draws nothing, never "none";
 *   3 · Schedule: Appointments sit right after the supplier's part, before the handover (v113: Appointments before the
 *       paperwork), drawn once.
 *   4 · Decisions is the list in place, drawn from the thread's one draw (Build 2 #42; was Build 1's door to Chat).
 *   5 · Schedule opens on THIS client's days strip (owner 18 Nov 2026; replaced v113's shop month), first, over the
 *       unchanged blow-by-blow; "All clients" asks the Clients month action (no second action), a refused read SAID.
 *   6 · The supplier's part in v113 order: how changes go · Where · the chapters (hours) · Lock my times · Asked of you.
 *
 * Sabotage log (2026-11-08, each reverted): Suppliers moved above the overview → 1 red · `supplierRows` returning [] for a
 * missing roster → 2 red · Appointments back after `<ScheduleTab` → 3 red · a refused quote read worded "No quote sent yet"
 * → 4 red · the Schedule month writing the Clients URL (`syncUrl()` unconditional) → 5 red · Asked of you moved back
 * above Where → 6 red · a missing `whole` drawn as an empty month → 5 red · a second export
 * beside `fetchCustomerCalendarMonth` → 5 red.
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
  const order = ['{pipelineBlock}', '<DetailsNumbersRow', '<HostsList', '{overviewNode}', '{coupleAnswersNode}', 'askBlock', '<SuppliersList', '<DetailsDecisions ', '<DetailsFormsDoor'];
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

// Build 2 #42 (8 Nov 2026): Build 1's door ("Decisions is a door to Chat with one honest line") became the LIST in place,
// drawn from the thread's one draw. The no-own-read half of this test moved to `a-client-open-draws-the-thread-once`
// (which measures it: Details adds 0 requests); here, only that Details mounts it with the thread it already holds.
test('4 · Decisions is the list in place, mounted with the thread Details already holds (Build 2 #42)', () => {
  assert.match(PAGE, /<DetailsDecisions threadId=\{threadId\} eventId=\{eventId\} threadSearch=\{pickedCtx\.threadSearch\} \/>/);
  const comp = stripComments(readFileSync(join(HERE, '_components/details-decisions.tsx'), 'utf8'));
  assert.match(comp, /<SupplierThreadBody threadId=\{threadId\} view="decisions" search=\{threadSearch\} \/>/, 'the list is not the thread page\u2019s draw');
  assert.doesNotMatch(comp, /\.from\(|fetch\(|supabase/, 'the Decisions body reads on its own');
});

test('3 · Schedule: Appointments right after the supplier’s part, once', () => {
  assert.equal((PAGE.match(/<AppointmentsSection\b/g) ?? []).length, 1, 'Appointments drawn twice');
  const tab = PAGE.slice(PAGE.indexOf('function ScheduleTab('));
  const part = tab.indexOf('<SupplierSchedule eventId={eventId} {...supplierPart} />');
  const appts = tab.indexOf('{props.appointments ?? null}');
  const handover = tab.indexOf('Deliver the handover');
  assert.ok(part > 0 && appts > part && handover > appts, 'Appointments are not between the supplier’s part and the handover');
});

// 📅 Owner 18 Nov 2026 (client-page rulings, drawing NL5NDoD6 v7): the shop month on Schedule became THIS client's days
// strip — Week | Month, "This client ▾ / All clients" — over the shipped blow-by-blow, which it holds unchanged.
test('5 · Schedule opens on the days strip — first, over the unchanged blow-by-blow; All clients asks the Clients month', () => {
  const strip = stripComments(readFileSync(join(HERE, '_components/schedule-days.tsx'), 'utf8'));
  // All clients = the Clients month action itself (no second server action), asked only once chosen; a read that comes
  // back without its `whole` part is a refused read (null), SAID — never other clients drawn as absent.
  assert.match(strip, /if \(scope !== 'all'\) return;/, 'the strip asks the server before All clients is chosen');
  assert.match(strip, /fetchCustomerCalendarMonth\(m, \{ whole: true \}\)/, 'All clients does not ask the Clients month action');
  assert.match(strip, /r\?\.whole \? \{/, 'a read missing its whole part is drawn as a month');
  assert.match(strip, /couldn’t load just now/, 'a refused All clients read is not said');
  assert.match(strip, /<PickMenu[\s\S]*?label="Whose days"/, 'This client / All clients is not the one dropdown');
  const acts = stripComments(readFileSync(join(HERE, '../../customers/actions.ts'), 'utf8'));
  assert.equal((acts.match(/^export async function /gm) ?? []).length, 1, 'the customers actions grew a second export (reuse fetchCustomerCalendarMonth)');
  const body = PAGE.slice(PAGE.indexOf('      schedule: (\n'));
  const at = body.indexOf('<ScheduleDays');
  assert.ok(at >= 0 && at < body.indexOf('{gated(scheduleNode)}'), 'the strip is not first on Schedule');
  assert.ok(body.indexOf('</ScheduleDays>') > body.indexOf('{gated(scheduleNode)}'), 'the blow-by-blow is not held by the strip');
  assert.doesNotMatch(PAGE, /<ScheduleCalendar\b/, 'the shop month is drawn on Schedule as well as the strip');
});

test('6 · the supplier’s part in v113 order — Where · hours · Lock · Asked', () => {
  const ss = stripComments(readFileSync(join(HERE, '_components/supplier-schedule.tsx'), 'utf8'));
  const order = ['label="Show"', 'data-supplier-where=""', 'data-supplier-chapter={c.block_id}', 'data-times-lock=', 'data-asked-of-you=""'];
  const at = order.map((m) => ss.indexOf(m));
  at.forEach((i, k) => assert.ok(i >= 0, `the supplier’s part lost ${order[k]}`));
  for (let k = 1; k < at.length; k++) assert.ok(at[k - 1]! < at[k]!, `${order[k - 1]} is not before ${order[k]}`);
});
