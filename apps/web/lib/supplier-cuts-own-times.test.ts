/**
 * supplier-cuts-own-times.test.ts — 🕕 CUT 5, A SUPPLIER'S OWN TIMES BEFORE THE PROGRAM (owner-approved 2026-11-14 —
 * DECISION_LOG "THE SEVEN SUPPLIER CUTS ARE APPROVED"; prototype `prototypes/supplier_eleven_jobs_cuts_2026-11-14_fable.html` § 5).
 *
 *   (1) with no chapters the Schedule view draws Your times (call · arrive · done), never the dead "no chapters" line;
 *   (2) the times are wall clocks and slot in ONCE, into a chapter they are linked to, through the shipped My times path;
 *   (3) the chat's "Set your call time" pin counts a kept call time as set (it turns Done);
 *   (4) it rides the shipped schedule action by `request` — no new server action.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { buildPinFacts } from './chat-pin-facts';
import { OWN_TIMES_ROWS, callTimeIsSet, isOwnClock, ownTimesLine, ownTimesSlotInto } from './supplier-own-times';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const VIEW = 'app/vendor-dashboard/clients/[eventId]/_components/supplier-schedule.tsx';

test('(1) no chapters → Your times, three rows, never the dead line', () => {
  assert.deepEqual(OWN_TIMES_ROWS.map((r) => r.name), ['Call time', 'Arrive at the venue', 'Done by']);
  const view = read(VIEW);
  assert.match(view, /day\.chapters\.length === 0 \? \(\s*<OwnTimesForm /, 'the empty program is a dead end again');
  assert.doesNotMatch(view, /haven’t made their chapters yet\. Your part shows here once they do\./);
});

test('(2) wall clocks, slotted in once, into a linked chapter, the My times way', () => {
  for (const ok of ['00:00', '06:00', '23:59']) assert.ok(isOwnClock(ok), ok);
  for (const bad of ['6:00', '24:00', '07:60', '', '7pm']) assert.equal(isOwnClock(bad), false, bad);
  assert.equal(ownTimesLine({ call: '06:00', arrive: '07:30', done: '23:00' }), 'Call 6:00 AM · arrive 7:30 AM · done 11:00 PM');
  const t = { call: '06:00', arrive: '07:30', done: '23:00', filedAt: null };
  assert.equal(ownTimesSlotInto(t, ['ch1', 'ch2']), 'ch1');
  assert.equal(ownTimesSlotInto(t, []), null, 'slotted with no program');
  assert.equal(ownTimesSlotInto({ ...t, filedAt: '2026-11-14T00:00:00Z' }, ['ch1']), null, 'slotted twice');
  assert.equal(ownTimesSlotInto({ ...t, arrive: null, done: null }, ['ch1']), null, 'a call time alone filed a moment');
  const action = read('app/vendor-dashboard/clients/[eventId]/actions.ts');
  const branch = action.slice(action.indexOf("if (request === 'own_times')"), action.indexOf("if (request === 'times')"));
  assert.ok(branch.length > 300, 'anti-vacuity: the own_times branch was not found');
  assert.match(branch, /\.from\('supplier_own_times'\)\.upsert\(/);
  assert.match(branch, /timesRequests\(\{/, 'the slot-in left the shipped My times path');
  assert.match(branch, /filed_at: new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(branch, /createAdminClient|admin\./, 'the supplier’s times are written by the service role');
});

test('(3) a kept call time turns the chat pin Done', () => {
  assert.equal(callTimeIsSet(null, '06:00'), true);
  assert.equal(callTimeIsSet(null, null), false);
  assert.equal(callTimeIsSet(null, 'nonsense'), false);
  const base = { side: 'vendor' as const, nowMs: 0, themName: 'Ana & Marco', supplierName: 'Liwanag', mayReadMoney: true, todayPh: '2026-11-14' };
  const facts = (at: string | null) => buildPinFacts({ ...base, callTime: { at } } as unknown as Parameters<typeof buildPinFacts>[0]);
  assert.ok(facts(null).some((f) => f.kind === 'call_time'), 'anti-vacuity: an unset call time pins');
  assert.equal(facts('own:06:00').some((f) => f.kind === 'call_time'), false, 'a kept call time still pins DUE NOW');
  assert.match(read('lib/chat-pin-facts.server.ts'), /callTimeIsSet\(rpcAt, ownCall\)/);
});

test('(4) no new server action — the shipped schedule action, by request', () => {
  const action = read('app/vendor-dashboard/clients/[eventId]/actions.ts');
  assert.match(action, /request === 'own_times';/, 'own_times is not a sheet ask');
  assert.doesNotMatch(read('lib/supplier-own-times.ts'), /['"]use server['"]/);
  assert.match(read(VIEW), /request: 'own_times'/);
});
