import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pickReuseGroup, type GuestGroupReuseCandidate } from './guest-group-reuse';

const row = (
  group_id: string,
  label: string,
  team_side: string,
): GuestGroupReuseCandidate => ({ group_id, label, team_side });

test('cross-side namesakes present → picks the SAME team_side row (the bug: label-only maybeSingle threw)', () => {
  const candidates = [
    row('g-bride', 'Friends', 'bride'),
    row('g-groom', 'Friends', 'groom'),
    row('g-both', 'Friends', 'both'),
  ];
  const picked = pickReuseGroup(candidates, 'Friends', 'both');
  assert.equal(picked?.group_id, 'g-both');
});

test('never returns a cross-side namesake — no team_side match → null', () => {
  // Only a bride-side "Friends" exists; a 'both' insert must NOT reuse it.
  const candidates = [row('g-bride', 'Friends', 'bride')];
  assert.equal(pickReuseGroup(candidates, 'Friends', 'both'), null);
});

test('label match is case-insensitive (mirrors the lower(label) unique key)', () => {
  const candidates = [row('g-both', 'friends', 'both')];
  assert.equal(pickReuseGroup(candidates, 'FRIENDS', 'both')?.group_id, 'g-both');
});

test('label compare is exact — a wildcard-y label never over-matches a shorter one', () => {
  // An `ilike('label','50% off')` DB fetch over-matches every "50…" label
  // because %/_ are SQL wildcards; the JS exact compare resolves the true row.
  const candidates = [
    row('g-50', '50', 'both'),
    row('g-50off', '50% off', 'both'),
  ];
  assert.equal(pickReuseGroup(candidates, '50% off', 'both')?.group_id, 'g-50off');
});

test('label is trimmed on both sides before comparing', () => {
  const candidates = [row('g-both', 'Friends', 'both')];
  assert.equal(pickReuseGroup(candidates, '  Friends  ', 'both')?.group_id, 'g-both');
});

test('empty candidate set → null', () => {
  assert.equal(pickReuseGroup([], 'Friends', 'both'), null);
});
