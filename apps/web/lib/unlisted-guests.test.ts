import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readKeepChoice, searchCandidates, unlinkedCandidates, type LinkCandidate } from '@/lib/unlisted-guests';

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

const form = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
const ROLES = ['guest', 'principal_sponsor_ninong', 'bride'] as never[];

test('keeping reads name, side, role and group — and refuses what this event does not offer', () => {
  const ok = readKeepChoice(form({ first_name: ' Shey ', last_name: 'Ferriol', side: 'bride', role: 'principal_sponsor_ninong', group_id: 'g1' }), ROLES, new Set(['g1']));
  assert.deepEqual(ok, { ok: true, value: { first_name: 'Shey', last_name: 'Ferriol', side: 'bride', role: 'principal_sponsor_ninong', group_id: 'g1' } });
  assert.equal(readKeepChoice(form({ first_name: 'A', side: 'bride', role: 'bride' }), ROLES, new Set()).ok, false, 'a second Bride could be picked');
  assert.equal(readKeepChoice(form({ first_name: 'A', side: 'bride', group_id: 'other-event' }), ROLES, new Set(['g1'])).ok, false, 'another event’s group was accepted');
  assert.equal(readKeepChoice(form({ first_name: '', side: 'bride' }), ROLES, new Set()).ok, false);
  assert.equal(readKeepChoice(form({ first_name: 'A', side: 'nobody' }), ROLES, new Set()).ok, false);
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

test('Keep asks for name, side, role and group — and the server re-checks them', () => {
  const page = read('page.tsx');
  for (const field of ['name="first_name"', 'name="last_name"', 'name="side"', 'name="role"', 'name="group_id"']) {
    assert.ok(page.includes(field), `the Keep form lost ${field}`);
  }
  const action = read('actions.ts');
  assert.match(action, /const choice = readKeepChoice\(/, 'the Keep action trusts the form');
  assert.match(action, /if \(!choice\.ok\) back\(eventId, choice\.error\);/, 'the Keep action checks and ignores the answer');
});
