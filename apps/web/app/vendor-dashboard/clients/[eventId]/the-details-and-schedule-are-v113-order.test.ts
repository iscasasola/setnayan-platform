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
 *   5 · Schedule's month is the CLIENTS calendar (`CustomersCalendar place="schedule"`), never a second grid: first on
 *       the page, the event's day picked, one request on first view, a refused read SAID; in schedule place it writes
 *       no URL, feeds no Clients figures, draws no day bar.
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
  assert.match(PAGE, /<DetailsDecisions threadId=\{threadId\} eventId=\{eventId\} \/>/);
  const comp = stripComments(readFileSync(join(HERE, '_components/details-decisions.tsx'), 'utf8'));
  assert.match(comp, /<SupplierThreadBody threadId=\{threadId\} view="decisions" \/>/, 'the list is not the thread page\u2019s draw');
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

test('5 · Schedule’s month is the Clients calendar — one part, its own place', () => {
  const cal = stripComments(readFileSync(join(HERE, '_components/schedule-calendar.tsx'), 'utf8'));
  assert.match(cal, /<CustomersCalendar\s+place="schedule"/, 'Schedule draws a calendar that is not the Clients one');
  assert.doesNotMatch(cal, /CalendarGrid|calendar-grid/, 'a second month grid');
  assert.match(cal, /initialDay=\{day\}/, 'the event’s day is not picked on arrival');
  // One request on first view = the Clients month action with `whole` (no second server action, budget-lint rule 1),
  // and a read that comes back without its `whole` part is a refused read (null), never an empty month.
  assert.match(cal, /fetchCustomerCalendarMonth\(month, \{ whole: true \}\)/, 'Schedule does not ask the Clients month action');
  assert.match(cal, /setInputs\(r\?\.whole \? \{ \.\.\.r\.whole, dayStates: r\.dayStates, waitlist: r\.waitlist \} : null\)/, 'a read missing its whole part is drawn as a month');
  const acts = stripComments(readFileSync(join(HERE, '../../customers/actions.ts'), 'utf8'));
  assert.equal((acts.match(/^export async function /gm) ?? []).length, 1, 'the customers actions grew a second export (reuse fetchCustomerCalendarMonth)');
  assert.match(cal, /Your calendar couldn’t load just now/, 'a refused month is not said');
  const body = PAGE.slice(PAGE.indexOf('      schedule: (\n'));
  const at = body.indexOf('<ScheduleCalendar eventDate={brief.event.event_date}');
  assert.ok(at >= 0 && at < body.indexOf('{scheduleGated}'), 'the month is not first on Schedule');
  const cc = stripComments(readFileSync(join(HERE, '../../customers/_components/customers-calendar.tsx'), 'utf8'));
  assert.match(cc, /if \(onClients\) syncUrl\(\);/, 'the Schedule month writes the Clients URL');
  assert.match(cc, /if \(onClients\) window\.dispatchEvent\(new CustomEvent\(DATES_FIGURES_EVENT/, 'the Schedule month speaks for Clients’ pinned row');
  assert.match(cc, /\{dayActions && onClients \? <DayBar/, 'the day bar is drawn on Schedule');
  assert.match(cc, /\{!onClients \? null : picked \? \(/, 'Schedule draws the shop’s day rows under its month (v113 draws the schedule there)');
});

test('6 · the supplier’s part in v113 order — Where · hours · Lock · Asked', () => {
  const ss = stripComments(readFileSync(join(HERE, '_components/supplier-schedule.tsx'), 'utf8'));
  const order = ['label="Show"', 'data-supplier-where=""', 'data-supplier-chapter={c.block_id}', 'data-times-lock=', 'data-asked-of-you=""'];
  const at = order.map((m) => ss.indexOf(m));
  at.forEach((i, k) => assert.ok(i >= 0, `the supplier’s part lost ${order[k]}`));
  for (let k = 1; k < at.length; k++) assert.ok(at[k - 1]! < at[k]!, `${order[k - 1]} is not before ${order[k]}`);
});
