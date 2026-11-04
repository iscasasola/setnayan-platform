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
import { lockedShopFor, lockedShopOnMoment, lockedShopOnMoments, patchTouchesPart } from './supplier-part-lock';
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

/* 🏃 Owner, DECISION_LOG 2026-11-03 (2): *"A host's RUNNING-LATE shift moves a supplier's moments even when that supplier
   has locked their times; the supplier still gets the notice."* Two directions, one guard each. */
test('Running late PASSES a lock: the shift-notice path goes through the one running-late door and never asks the lock', () => {
  const body = actionBody('bulkRetimeScheduleBlocks');
  const late = body.indexOf('if (shiftNotice) {');
  assert.ok(late >= 0, 'the running-late path is no longer its own branch');
  const lateBranch = body.slice(late, body.indexOf('} else {', late));
  assert.match(lateBranch, /\.rpc\('running_late_shift_schedule'/, 'running late no longer writes through the door the lock lets past');
  assert.doesNotMatch(lateBranch, /refuseLockedPart\(/, 'running late asks the lock again — the owner ruled it moves a locked part');
  assert.doesNotMatch(lateBranch, /\.update\(/, 'running late writes rows itself, which the database refuses on a locked part');
});

test('every OTHER retime still refuses a lock: the drag path asks before its first write', () => {
  const body = actionBody('bulkRetimeScheduleBlocks');
  const drag = body.slice(body.indexOf('} else {', body.indexOf('if (shiftNotice) {')));
  const refuse = drag.indexOf('refuseLockedPart(');
  assert.ok(refuse >= 0, 'a drag of one moment no longer asks whether the supplier locked their part');
  assert.ok(refuse < drag.indexOf('.update('), 'the drag asks about the lock after it wrote');
});

test('the locked supplier still hears a running-late shift: the day-moved notice is not filtered by the lock', () => {
  const body = actionBody('bulkRetimeScheduleBlocks');
  assert.match(body, /if \(formData\.get\('shift_notice'\) === '1'\) \{\s*const anchor[\s\S]*?await notifyScheduleShifted\(/);
  const notify = read('lib', 'schedule-shift-notify.server.ts');
  assert.doesNotMatch(notify, /locked_at|SCHEDULE_MARK_COLUMNS|schedule_locked_shops|readPartLocks/, 'the shift notice skips a locked supplier');
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

/* ── 5 · the chapters' MOMENT SHEET — the Schedule page's current editor (4 Nov follow-up) ──────────────────────────
   The rail and the old inspector said the lock; the chapters' moment sheet (`moment-sheets.tsx`) said "Try again." to
   a host whose change the database had refused, and showed nothing before the change. */

test('the moment sheet finds the LOCKED supplier on its moment — and only a locked one', () => {
  const suppliers = [
    { id: 'evA', name: 'Kusina ni Lola', locked: true },
    { id: 'evB', name: 'Lumina Studio' },
  ];
  assert.equal(lockedShopOnMoment(['evB', 'evA'], suppliers), 'Kusina ni Lola');
  assert.equal(lockedShopOnMoment(['evB'], suppliers), null, 'an open supplier is not a lock');
  assert.equal(lockedShopOnMoment([], suppliers), null);
});

test('the Schedule page hands the lock down on who.suppliers, from the one marks resolver', () => {
  const page = read('app', 'dashboard', '[eventId]', 'schedule', 'page.tsx');
  assert.match(page, /\.map\(\(v\) => \(\{ id: v\.vendor_id, name: v\.vendor_name, \.\.\.\(v\.times === NOT_TAKING_CHANGES \? \{ locked: true \}/);
});

test('the moment sheet says the calm line BEFORE a change, with Send a request, and AFTER a refusal', () => {
  const sheet = read('app', 'dashboard', '[eventId]', 'schedule', '_components', 'moment-sheets.tsx');
  assert.match(sheet, /const lockedShop = lockedShopOnMoment\(m\.vendor_ids, who\.suppliers\)/);
  // Before: the line + the door to ask instead, which opens the Ask with that supplier picked.
  assert.match(sheet, /data-moment-locked=""[\s\S]{0,200}?\{lockedHead\(lockedShop\)\}/);
  assert.match(sheet, /setAskOpener\(/);
  assert.match(sheet, /opener=\{askOpener\}/);
  // After: a refused field save, a refused delete, and the task / Suppliers-and-crew doors.
  assert.match(sheet, /const refused = lockedShop \? \{ ok: false as const, error: lockedLine\(lockedShop\) \} : NOT_SAVED/);
  assert.match(sheet, /if \(!ok\) return refused;/);
  assert.match(sheet, /\{lockedShop \? lockedLine\(lockedShop\) : `\$\{m\.label\} wasn’t deleted/);
  assert.match(sheet, /<ForRow [^>]*doors=\{partDoors\}/);
  assert.equal((sheet.match(/<TaskEditor[\s\S]*?doors=\{partDoors\}/g) ?? []).length, 2, 'both task editors use the calm doors');
  const ask = read('app', 'dashboard', '[eventId]', 'schedule', '_components', 'ask-supplier-section.tsx');
  assert.match(ask, /if \(!opener\) return;\s*setOpen\(true\);\s*setWho\(opener\.vendorId\);/);
});

test('the admin event page shows each booked supplier’s lock, and a refused read is said', () => {
  const admin = read('app', 'admin', 'events', '[eventId]', 'page.tsx');
  assert.match(admin, /from\('event_supplier_schedule_marks'\)\.select\(SCHEDULE_MARK_COLUMNS\)/);
  assert.match(admin, /mark\.word === NOT_TAKING_CHANGES\s*\?\s*`Locked since/);
  assert.match(admin, /supplierLocks: [^=]+= supRowsRead\.error\s*\?\s*null/);
  assert.match(admin, /marks === null\s*\?\s*COULD_NOT_LOAD/);
});

test('a locked moment renders no editable inputs — plain values, no frame, and ONE thing to press', () => {
  const sheet = read('app', 'dashboard', '[eventId]', 'schedule', '_components', 'moment-sheets.tsx');
  const from = sheet.indexOf("stage === 'details' && lockedShop && lockedId ?");
  assert.ok(from > 0, 'the locked branch of the moment sheet is gone');
  const branch = sheet.slice(from, sheet.indexOf(") : stage === 'details' ?", from));
  // No editable row of any kind, no raw field, no Delete, no Add a task.
  for (const editable of ['<TypedRow', '<TimeRow', '<ChosenRow', '<SwitchRow', '<WhenRow', '<MinutesRow', '<ForRow', '<MarchRow', '<TaskEditor', '<input', '<textarea', '<select', 'onKeep', 'Delete moment', 'Add a task']) {
    assert.ok(!branch.includes(editable), `the locked moment draws ${editable} — the host would type into a refused change`);
  }
  // Exactly one pressable thing: Send them a request (the Ask under it hides its own open button).
  assert.equal((branch.match(/<ActionButton\b/g) ?? []).length, 1, 'one button on a locked moment');
  assert.match(branch, /label="Send them a request"/);
  assert.match(branch, /<AskSupplierSection[\s\S]*?noOpenButton/);
  const ask = read('app', 'dashboard', '[eventId]', 'schedule', '_components', 'ask-supplier-section.tsx');
  assert.match(ask, /\) : noOpenButton \? null : \(/);
  // The values themselves: plain text, nothing pressable, no frame (frames only on what you press).
  const facts = sheet.slice(sheet.indexOf('function LockedMomentFacts('), sheet.indexOf('function SearchHead('));
  assert.ok(facts.length > 100, 'LockedMomentFacts is gone');
  assert.doesNotMatch(facts, /<button|<input|<textarea|onClick|\brounded|\bring-|\bborder(?=[\s"'`])/, 'a read-only value is drawn with a frame or something to press');
});
