/**
 * guest-import-file.test.ts — the guest list file (owner 2026-10-01).
 *
 * 1. TEMPLATE SERVED PER EVENT TYPE — a wedding gets the file with Side, every
 *    other role set the general one; both files exist under public/ and neither
 *    carries an email column (guests are never emailed).
 * 2. UPLOAD PARSES FRIENDLY HEADERS — the template's own files, read back
 *    through readGuestFile + planGuestImport, land on the right fields.
 * 3. PREVIEW NEVER MERGES TWO PEOPLE — every row is one preview row; the same
 *    name twice, a shared phone, Jr. vs no suffix, a guest claimed twice all
 *    become "needs a look", never one person.
 * 4. UPLOAD AGAIN TO UPDATE — a re-upload matches by name or mobile, updates
 *    only what changed, never blanks a field, never duplicates.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  GUEST_TEMPLATES,
  guestTemplateFor,
  planGuestImport,
  readGuestFile,
  type ExistingGuest,
} from './guest-import-file';
import { eventHasSides } from './guest-side-question';
import {
  GENERIC_ROLE_SET,
  MUSLIM_ROLE_SET,
  SIMPLE_ROLE_SET,
  WEDDING_ROLE_SET,
} from './role-sets';

const WEB = path.join(__dirname, '..');
const PAGE = path.join(WEB, 'app/dashboard/[eventId]/guests/import/page.tsx');

// --- 1. Template served per event type -------------------------------------

test('a wedding (either role set) gets the file WITH Side; other types the general one', () => {
  assert.equal(guestTemplateFor(eventHasSides(WEDDING_ROLE_SET)), GUEST_TEMPLATES.withSides);
  assert.equal(guestTemplateFor(eventHasSides(MUSLIM_ROLE_SET)), GUEST_TEMPLATES.withSides);
  assert.equal(guestTemplateFor(eventHasSides(GENERIC_ROLE_SET)), GUEST_TEMPLATES.withoutSides);
  assert.equal(guestTemplateFor(eventHasSides(SIMPLE_ROLE_SET)), GUEST_TEMPLATES.withoutSides);
});

test('every template file exists, Side only in the wedding one, and no email column', () => {
  for (const [kind, files] of Object.entries(GUEST_TEMPLATES)) {
    for (const href of Object.values(files)) {
      const file = path.join(WEB, 'public', href);
      assert.ok(existsSync(file), `${href} is linked but not in public/`);
    }
    const header = readFileSync(path.join(WEB, 'public', files.csv), 'utf8').split(/\r?\n/)[0]!;
    const cols = header.split(',').map((c) => c.trim().toLowerCase());
    assert.equal(cols.includes('side'), kind === 'withSides', `${files.csv}: Side column`);
    assert.ok(!cols.some((c) => c.includes('email')), `${files.csv} must not ask for an email`);
    assert.ok(cols.includes('first name') && cols.includes('last name'), `${files.csv}: name columns`);
  }
});

test('the import page picks the file from the event, not a fixed one', () => {
  const src = readFileSync(PAGE, 'utf8');
  const picks = src.match(/guestTemplateFor\(eventHasSides\(/g) ?? [];
  assert.equal(picks.length, 1, 'the page must choose the template with guestTemplateFor(eventHasSides(…))');
  assert.ok(!/\/templates\/setnayan-guest-list/.test(src), 'the page hard-codes a template path');
  assert.ok(/Download for Excel \/ Numbers/.test(src), 'the download button copy is gone');
});

// --- 2. Upload parses friendly headers -------------------------------------

const ctx = (existing: ExistingGuest[] = [], hasSides = true) => ({
  offeredRoles: (hasSides ? WEDDING_ROLE_SET : GENERIC_ROLE_SET).offeredRoles,
  singletonRoles: (hasSides ? WEDDING_ROLE_SET : GENERIC_ROLE_SET).singletonRoles,
  hasSides,
  existing,
});

test('the wedding template, saved by Excel (with a BOM), reads back field by field', () => {
  const text = '\uFEFF' + readFileSync(path.join(WEB, 'public', GUEST_TEMPLATES.withSides.csv), 'utf8');
  const plan = planGuestImport(readGuestFile(text), ctx());
  assert.deepEqual(plan.counts, { new: 3, changed: 0, same: 0, look: 0 }, JSON.stringify(plan.rows));
  const manuel = plan.rows[0]!.record!;
  assert.equal(manuel.name_prefix, 'Mr.');
  assert.equal(manuel.first_name, 'Manuel');
  assert.equal(manuel.middle_name, 'Cortez');
  assert.equal(manuel.last_name, 'Casasola');
  assert.equal(manuel.side, 'groom');
  assert.equal(manuel.group_category, 'family');
  assert.equal(manuel.role, 'principal_sponsor_ninong');
  assert.equal(manuel.plus_one_count, 1);
  const maria = plan.rows[1]!.record!;
  assert.equal(maria.mobile, '+63 917 123 4567');
  assert.equal(maria.role, 'bridesmaid');
  assert.equal(plan.rows[2]!.record!.name_suffix, 'Jr.');
});

test('the general template reads back on a non-wedding event, sideless', () => {
  const text = readFileSync(path.join(WEB, 'public', GUEST_TEMPLATES.withoutSides.csv), 'utf8');
  const plan = planGuestImport(readGuestFile(text), ctx([], false));
  assert.deepEqual(plan.counts, { new: 3, changed: 0, same: 0, look: 0 }, JSON.stringify(plan.rows));
  assert.equal(plan.rows[2]!.record!.role, 'vip');
  assert.ok(plan.rows.every((r) => r.record!.side === 'both'));
});

test('an old raw-key file still imports', () => {
  const plan = planGuestImport(
    readGuestFile('first_name,last_name,side,group,role,plus_one_allowed\nAnna,Cruz,bride,school,bridesmaid,true'),
    ctx(),
  );
  assert.equal(plan.counts.new, 1);
  assert.equal(plan.rows[0]!.record!.plus_one_count, 1);
});

// --- 3. Preview never merges two people ------------------------------------

const HDR = 'Prefix,First name,Middle name,Last name,Suffix,Side,Group,Role,Their guests (+),Mobile (optional)\n';
const guest = (o: Partial<ExistingGuest> & { guest_id: string; first_name: string; last_name: string }): ExistingGuest => ({
  name_prefix: null,
  middle_name: null,
  name_suffix: null,
  side: 'both',
  group_category: 'friends',
  role: 'guest',
  mobile: null,
  plus_one_count: 0,
  ...o,
});

test('every row is exactly one preview row, in order', () => {
  const body = ',Ana,,Cruz,,,,,,\n,Ben,,Cruz,,,,,,\n,Ana,,Cruz,,,,,,\n';
  const plan = planGuestImport(readGuestFile(HDR + body), ctx());
  assert.deepEqual(plan.rows.map((r) => r.line), [2, 3, 4]);
  assert.deepEqual(plan.rows.map((r) => r.status), ['new', 'new', 'look']);
});

test('Juan Reyes and Juan Reyes Jr. in one file are two people', () => {
  const plan = planGuestImport(readGuestFile(HDR + ',Juan,,Reyes,,,,,,\n,Juan,,Reyes,Jr.,,,,,\n'), ctx());
  assert.deepEqual(plan.rows.map((r) => r.status), ['new', 'new']);
});

test('a suffix that only one side has is a question, not a merge', () => {
  const plan = planGuestImport(readGuestFile(HDR + ',Juan,,Reyes,Jr.,,,,,\n'), ctx([guest({ guest_id: 'g1', first_name: 'Juan', last_name: 'Reyes' })]));
  assert.equal(plan.rows[0]!.status, 'look');
  assert.equal(plan.rows[0]!.guestId, undefined);
});

test('a shared family phone never folds one person into another', () => {
  const existing = [guest({ guest_id: 'g1', first_name: 'Rosa', last_name: 'Lim', mobile: '09171234567' })];
  const plan = planGuestImport(readGuestFile(HDR + ',Pedro,,Santos,,,,,,+63 917 123 4567\n'), ctx(existing));
  assert.equal(plan.rows[0]!.status, 'look');
});

test('one guest on the list is matched by at most one row', () => {
  const existing = [guest({ guest_id: 'g1', first_name: 'Rosa', last_name: 'Lim', mobile: '09171234567' })];
  const body = ',Rosa,,Lim,,,,,,\n,Rosa,,Tan,,,,,,+639171234567\n';
  const plan = planGuestImport(readGuestFile(HDR + body), ctx(existing));
  assert.deepEqual(plan.rows.map((r) => r.status), ['same', 'look']);
  assert.equal(plan.rows.filter((r) => r.guestId === 'g1').length, 1);
});

test('two guests on the list sharing a name are never guessed between', () => {
  const existing = [guest({ guest_id: 'g1', first_name: 'Ana', last_name: 'Cruz' }), guest({ guest_id: 'g2', first_name: 'Ana', last_name: 'Cruz' })];
  const plan = planGuestImport(readGuestFile(HDR + ',Ana,,Cruz,,Bride,,,,\n'), ctx(existing));
  assert.equal(plan.rows[0]!.status, 'look');
});

test('only one bride per event', () => {
  const existing = [guest({ guest_id: 'g1', first_name: 'Ice', last_name: 'C', role: 'bride' })];
  const plan = planGuestImport(readGuestFile(HDR + ',Mia,,Sy,,Bride,Family,Bride,,\n'), ctx(existing));
  assert.equal(plan.rows[0]!.status, 'look');
});

// --- 4. Upload again to update ---------------------------------------------

test('a re-upload updates what changed, adds the new, and never duplicates', () => {
  const existing = [
    guest({ guest_id: 'g1', first_name: 'Ana', last_name: 'Cruz', mobile: '+639170000001', group_category: 'friends' }),
    guest({ guest_id: 'g2', first_name: 'Ben', last_name: 'Tan', side: 'groom', plus_one_count: 1 }),
    guest({ guest_id: 'g3', first_name: 'Carla', last_name: 'Diaz', mobile: '0917 000 0003' }),
  ];
  const body = [
    ',Ana,,Cruz,,,Family,,,', // group changes
    ',Ben,,Tan,,Groom,,,1,', // nothing changes
    ',Karla,,Diaz,,,,,,+63 917 000 0003', // typo fixed: matched by mobile + last name
    ',Dina,,Uy,,Bride,,,,', // new
  ].join('\n');
  const plan = planGuestImport(readGuestFile(HDR + body), ctx(existing));
  assert.deepEqual(plan.rows.map((r) => r.status), ['changed', 'same', 'changed', 'new']);
  assert.deepEqual(plan.rows[0]!.patch, { group_category: 'family' });
  assert.equal(plan.rows[2]!.guestId, 'g3');
  assert.equal(plan.rows[2]!.patch!.first_name, 'Karla');
  assert.deepEqual(plan.counts, { new: 1, changed: 2, same: 1, look: 0 });
});

test('an empty cell never blanks what is on the list, and RSVP is never overwritten', () => {
  const existing = [guest({ guest_id: 'g1', first_name: 'Ana', last_name: 'Cruz', mobile: '+639170000001', middle_name: 'Reyes', plus_one_count: 2 })];
  const plan = planGuestImport(readGuestFile(HDR + ',Ana,,Cruz,,,,,,\n'), ctx(existing));
  assert.equal(plan.rows[0]!.status, 'same');
  const withRsvp = planGuestImport(readGuestFile('first_name,last_name,rsvp_status\nAna,Cruz,declined'), ctx(existing));
  assert.equal(withRsvp.rows[0]!.status, 'same');
});

test("a role written in the couple's own word is read as that role", () => {
  const plan = planGuestImport(readGuestFile(HDR + ",Mia,,Sy,,Bride,Friends,Bride's Crew,,\n"), {
    ...ctx(),
    roleNames: { bridesmaid: { one: "Bride's Crew" } },
  });
  assert.equal(plan.rows[0]!.record?.role, 'bridesmaid');
});
