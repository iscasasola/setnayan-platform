/**
 * 🔒 CHANGE LOCK — the app's half (supplier gate audit D7, 2026-11-02; owner: *"change lock (means the supplier cannot
 * accept changes anymore)"*). The database's half — the triggers that refuse whatever door a write comes through — is
 * `tests/db/a-locked-part-refuses-the-host.db.test.ts`.
 *
 * Here, executed or read from the real files:
 *  1 · the rule (`lib/supplier-part-lock.ts`): which change meets a lock, and which does not;
 *  2 · every host schedule action asks it BEFORE writing (remove the call from any one and this fails by name);
 *  3 · the host SEES it: "Not taking changes" wins on the supplier line, every marks reader selects `locked_at`, and a
 *      refused rail save says "<shop> isn't taking changes…" instead of "check your connection" — host words, never
 *      "lock" (a couple reads "book", never "lock"); only the supplier's own button says "Lock my times";
 *  4 · the supplier HAS the button: Lock my times / Unlock reach `supplier_mark_schedule`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripComments } from './strip-comments';
import { lockedShopFor, lockedShopOnMoments, patchTouchesPart } from './supplier-part-lock';
import { SCHEDULE_MARK_COLUMNS, lockedLine, timesMarkOf } from './supplier-schedule-marks';
import type { PartMoment } from './supplier-part-notice';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(here, '..', ...p), 'utf8'));

const m = (id: string, vendors: string[], extra: Partial<PartMoment> = {}): PartMoment => ({
  block_id: id,
  parent_block_id: null,
  label: 'Lights up',
  responsible_vendor_ids: vendors,
  start_at: '2099-12-12T15:00:00+00:00',
  end_at: '2099-12-12T15:30:00+00:00',
  ...extra,
});
const LOCKS = new Map([['evA', 'Kusina ni Lola']]);

test('a change to when / where / what of a moment with a locked supplier on it meets the lock; a delete too', () => {
  assert.equal(lockedShopFor([m('a', ['evA', 'evB'])], LOCKS, { kind: 'fields' }), 'Kusina ni Lola');
  assert.equal(lockedShopFor([m('a', ['evA'])], LOCKS, { kind: 'delete' }), 'Kusina ni Lola');
  assert.equal(lockedShopFor([m('a', ['evB'])], LOCKS, { kind: 'fields' }), null, 'nobody locked on it → free');
  assert.equal(lockedShopFor([m('a', ['evA'])], new Map(), { kind: 'fields' }), null, 'nobody locked at all → free');
});

test("re-assigning meets the lock only when the LOCKED supplier is put on or taken off — not another supplier's presence", () => {
  assert.equal(lockedShopFor([m('a', ['evA'])], LOCKS, { kind: 'vendors', after: [] }), 'Kusina ni Lola');
  assert.equal(lockedShopFor([m('a', [])], LOCKS, { kind: 'vendors', after: ['evA'] }), 'Kusina ni Lola');
  assert.equal(lockedShopFor([m('a', ['evA'])], LOCKS, { kind: 'vendors', after: ['evA', 'evB'] }), null);
});

test('a field save that does not move the part (the inspector posts every field) does not meet the lock', () => {
  const was = m('a', ['evA']);
  assert.equal(patchTouchesPart(was, { is_public: true, updated_at: 'now' }), false, 'shown to guests only');
  assert.equal(patchTouchesPart(was, { label: 'Lights up', start_at: '2099-12-12T15:00:00.000Z' }), false, 'same values, other spelling');
  assert.equal(patchTouchesPart(was, { start_at: '2099-12-12T15:15:00.000Z' }), true, 'a real retime');
  assert.equal(patchTouchesPart(was, { location: 'Garden' }), true, 'a new place');
});

test("the lock wins on the host's supplier line, in host words, and the calm line names the shop", () => {
  const word = timesMarkOf({ seenAt: 'x', confirmedAt: 'y', lockedAt: '2026-11-02T03:00:00Z' })?.word;
  assert.equal(word, 'Not taking changes');
  assert.doesNotMatch(word ?? '', /lock/i, 'a host reads "book", never "lock"');
  assert.equal(timesMarkOf({ seenAt: 'x', confirmedAt: 'y', lockedAt: null })?.word, 'Times confirmed');
  assert.equal(lockedLine('Kusina ni Lola'), 'Kusina ni Lola isn’t taking changes. Send them a request instead.');
  assert.doesNotMatch(lockedLine('Kusina ni Lola'), /lock/i, 'a host reads "book", never "lock"');
  assert.match(SCHEDULE_MARK_COLUMNS, /\blocked_at\b/, 'a reader that drops locked_at draws a locked part as open');
});

test('a refused rail save on a locked moment (or a chapter carrying one) says the calm line', () => {
  const moments = [
    { block_id: 'ch', parent_block_id: null, responsible_vendor_ids: [] },
    { block_id: 'mo', parent_block_id: 'ch', responsible_vendor_ids: ['evA'] },
  ];
  const suppliers = [{ vendor_id: 'evA', vendor_name: 'Kusina ni Lola', times: 'Not taking changes' }];
  assert.equal(lockedShopOnMoments(['mo'], moments, suppliers), 'Kusina ni Lola');
  assert.equal(lockedShopOnMoments(['ch'], moments, suppliers), 'Kusina ni Lola', 'a chapter move carries its moments');
  assert.equal(lockedShopOnMoments(['mo'], moments, [{ ...suppliers[0]!, times: 'Times confirmed' }]), null);
});

// ── the wiring ─────────────────────────────────────────────────────────────────────────────────────────────────────

const actions = read('app', 'dashboard', '[eventId]', 'schedule', 'actions.ts');
function actionBody(name: string): string {
  const start = actions.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} is gone from schedule/actions.ts — re-point this guard`);
  return actions.slice(start, actions.indexOf('\n}\n', start));
}

for (const name of ['updateScheduleBlock', 'deleteScheduleBlock', 'setBlockResponsibleParty', 'bulkRetimeScheduleBlocks'] as const) {
  test(`${name} refuses a change to a locked part BEFORE it writes`, () => {
    const body = actionBody(name);
    const refuse = body.indexOf('refuseLockedPart(');
    assert.ok(refuse >= 0, `${name} never asks whether the supplier's part is locked`);
    const firstWrite = body.search(/\.(update|delete)\(|\.rpc\('move_schedule_chapter'/);
    assert.ok(firstWrite >= 0, `${name} has no write left to guard`);
    assert.ok(refuse < firstWrite, `${name} asks about the lock after its first write — the change already landed`);
  });
}

test('Running late is not exempt in the app: the retime asks about the lock whatever the shift notice says', () => {
  const body = actionBody('bulkRetimeScheduleBlocks');
  const line = body.split('\n').find((l) => l.includes('refuseLockedPart(')) ?? '';
  assert.doesNotMatch(line, /shiftNotice\s*\?|if\s*\(\s*!?shiftNotice/);
});

test("the host's readers and the rail carry the lock", () => {
  assert.match(read('lib', 'schedule-suppliers-read.ts'), /select\(SCHEDULE_MARK_COLUMNS\)/);
  assert.match(read('lib', 'supplier-schedule-marks.server.ts'), /select\(SCHEDULE_MARK_COLUMNS\)/);
  // The lock's name must REACH the notice — computing it and then saying "check your connection" is the old bug.
  assert.match(
    read('app', 'dashboard', '[eventId]', 'schedule', '_components', 'day-rail.tsx'),
    /const (\w+) = lockedShopOnMoments\(ids,[\s\S]{0,200}?setNotice\(\1 \? lockedLine\(\1\)/,
  );
  // The moment's own sheet (its steppers save through its own `run`, not the rail's) says it too.
  const sheet = read('app', 'dashboard', '[eventId]', 'schedule', '_components', 'moment-inspector.tsx');
  assert.match(sheet, /setLockedBy\(lockedShopOnMoments\(/);
  assert.match(sheet, /lockedBy \? lockedLine\(lockedBy\)/);
});

test('the supplier has Lock my times and Unlock, and they reach supplier_mark_schedule', () => {
  const view = read('app', 'vendor-dashboard', 'clients', '[eventId]', '_components', 'supplier-schedule.tsx');
  assert.match(view, /mark\('lock'\)/);
  assert.match(view, /mark\('unlock'\)/);
  const act = read('app', 'vendor-dashboard', 'clients', '[eventId]', 'actions.ts');
  assert.match(act, /request === 'lock' \|\| request === 'unlock'/);
  assert.match(act, /if \(isMark\) \{\s*const \{ error \} = await supabase\.rpc\('supplier_mark_schedule'/);
  // The page reads the marks through the canonical list (which carries locked_at — asserted above), never a hand-typed one.
  assert.match(read('app', 'vendor-dashboard', 'clients', '[eventId]', 'page.tsx'), /from\('event_supplier_schedule_marks'\)\s*\.select\(SCHEDULE_MARK_COLUMNS\)/);
});
