import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchCandidates, unlinkedCandidates, type LinkCandidate } from '@/lib/unlisted-guests';

/** ⚖ Owner 2026-09-21: only not-yet-linked · a search bar · keep with name, side, role, group. */

const c = (id: string, first: string, last: string): LinkCandidate => ({ guest_id: id, first_name: first, last_name: last, display_name: null });
const LIST = [c('1', 'Raymond', 'Ablang'), c('2', 'Raymond', 'Acbang'), c('3', 'María', 'Alonzo'), c('4', 'Julian', 'Gerolaga')];

test('a guest an account already claimed is not offered', () => {
  assert.deepEqual(unlinkedCandidates(LIST, new Set(['2', '4'])).map((x) => x.guest_id), ['1', '3']);
});

test('search matches every word, any order, ignoring case and accents', () => {
  assert.deepEqual(searchCandidates(LIST, 'raymond').map((x) => x.guest_id), ['1', '2']);
  assert.deepEqual(searchCandidates(LIST, 'acb ray').map((x) => x.guest_id), ['2']);
  assert.deepEqual(searchCandidates(LIST, 'maria').map((x) => x.guest_id), ['3']);
  assert.deepEqual(searchCandidates(LIST, '   '), [], 'an empty search lists nobody — the couple types first');
});


import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
const read = (...p: string[]) => stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', 'claims', ...p), 'utf8'));

test('the page offers only unlinked guests, through the search picker', () => {
  const page = read('page.tsx');
  assert.match(page, /candidates = unlinkedCandidates\(/, 'linked guests are offered again');
  assert.match(page, /<LinkPicker candidates=\{candidates\} \/>/, 'the search picker is gone');
  assert.ok(!/name="target_guest_id"[\s\S]{0,200}<option/.test(page), 'the 79-name dropdown is back');
});

test('Keep is the guest list’s quick add — one line, previewed, and re-read on the server', () => {
  const page = read('page.tsx');
  assert.match(page, /<KeepQuickAdd\b/, 'the quick-add box is gone from Keep');
  const box = read('keep-quick-add.tsx');
  assert.match(box, /name="line"/, 'the line is not posted');
  assert.match(box, /name="role"/, 'the Role pick is gone');
  assert.match(box, /readKeepLine\(line, role, offeredRoles\)/, 'the preview is not the server’s reading');
  const action = read('actions.ts');
  assert.match(action, /const choice = readKeepLine\(/, 'the Keep action trusts the form');
  assert.match(action, /if \(!choice\.ok\) back\(eventId, choice\.error\);/, 'the Keep action checks and ignores the answer');
  assert.match(action, /quickCreateGroup\(eventId, label, chosen\.side\)/, '#groups are not made on the guest’s side');
  assert.match(action, /syncExtraSeats\(admin, eventId, guestId\)/, '+N makes no seats');
});

import { readKeepLine } from '@/lib/unlisted-guests';

test('keep by quick-add line: the guest list’s grammar, in one box', () => {
  const r = readKeepLine('Shey Ferriol bride #Barkada ninang +2', '', ['guest', 'principal_sponsor_ninang'] as never[]);
  assert.equal(r.ok, true);
  const v = (r as { ok: true; value: import('@/lib/unlisted-guests').KeepLine }).value;
  assert.deepEqual(
    { f: v.first_name, l: v.last_name, s: v.side, r: v.role, g: v.groups, p: v.plusOnes },
    { f: 'Shey', l: 'Ferriol', s: 'bride', r: 'principal_sponsor_ninang', g: ['Barkada'], p: 2 },
  );
});

test('an explicit Role pick wins; an unoffered hint falls back to Guest; an unoffered PICK is refused', () => {
  const offered = ['guest', 'bridesmaid'] as never[];
  const pick = readKeepLine('Shey ninang', 'bridesmaid', offered);
  assert.equal(pick.ok && pick.value.role, 'bridesmaid');
  const hint = readKeepLine('Shey ninang', '', offered);
  assert.equal(hint.ok && hint.value.role, 'guest', 'the capture bar falls back to Guest — so does this');
  assert.equal(readKeepLine('Shey', 'bride', ['guest', 'bride'] as never[]).ok, false, 'a second Bride could be picked');
  assert.equal(readKeepLine('   ', '', offered).ok, false);
});
