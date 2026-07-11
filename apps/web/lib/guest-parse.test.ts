/**
 * Unit suite for the pure Add-grammar parser (Living Roster · P2). Proves the
 * capture-bar grammar without a browser — this is the highest-value pure helper
 * of the phase, so the edge cases the plan calls out (empty name, `+3`→2,
 * multiple `#group`, side+plus+group combined, name-only) are all pinned here.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGuestInput, type ParsedGuestDraft } from './guest-parse';

const BASE: ParsedGuestDraft = {
  firstName: '',
  lastName: '',
  side: 'both',
  plusOnes: 0,
  groups: [],
  roleHint: null,
};

// ── empties ──────────────────────────────────────────────────────────────────

test('empty string → all defaults, no name', () => {
  assert.deepEqual(parseGuestInput(''), BASE);
});

test('whitespace-only → all defaults (trim + split yields no tokens)', () => {
  assert.deepEqual(parseGuestInput('   \t  '), BASE);
});

test('null/undefined-ish input is tolerated', () => {
  assert.deepEqual(parseGuestInput(undefined as unknown as string), BASE);
});

// ── names ────────────────────────────────────────────────────────────────────

test('first + last name', () => {
  const d = parseGuestInput('Ana Cruz');
  assert.equal(d.firstName, 'Ana');
  assert.equal(d.lastName, 'Cruz');
});

test('name-only single token → last name is empty (mononym; caller rejects)', () => {
  const d = parseGuestInput('Ana');
  assert.equal(d.firstName, 'Ana');
  assert.equal(d.lastName, '');
});

test('multi-word last name joins the tail', () => {
  const d = parseGuestInput('Maria Clara de la Cruz');
  assert.equal(d.firstName, 'Maria');
  assert.equal(d.lastName, 'Clara de la Cruz');
});

test('collapses irregular whitespace between name words', () => {
  const d = parseGuestInput('  Ana   Cruz  ');
  assert.equal(d.firstName, 'Ana');
  assert.equal(d.lastName, 'Cruz');
});

test('name casing is preserved (only keywords are case-insensitive)', () => {
  const d = parseGuestInput('aNa cRUZ');
  assert.equal(d.firstName, 'aNa');
  assert.equal(d.lastName, 'cRUZ');
});

// ── side ─────────────────────────────────────────────────────────────────────

test('side token sets side and is stripped from the name', () => {
  const d = parseGuestInput('Ana Cruz groom');
  assert.equal(d.side, 'groom');
  assert.equal(d.firstName, 'Ana');
  assert.equal(d.lastName, 'Cruz');
});

test('side keyword is case-insensitive', () => {
  assert.equal(parseGuestInput('Ana BRIDE').side, 'bride');
});

test('defaultSide is used when no side token is present', () => {
  assert.equal(parseGuestInput('Ana Cruz', { defaultSide: 'bride' }).side, 'bride');
});

test('an explicit side token overrides the defaultSide', () => {
  assert.equal(
    parseGuestInput('Ana Cruz groom', { defaultSide: 'bride' }).side,
    'groom',
  );
});

test('last side token wins when several are given', () => {
  assert.equal(parseGuestInput('Ana bride groom both').side, 'both');
});

// ── plus-ones ──────────────────────────────────────────────────────────────

test('+1 → 1 plus-one', () => {
  assert.equal(parseGuestInput('Ana Cruz +1').plusOnes, 1);
});

test('+2 → 2 plus-ones', () => {
  assert.equal(parseGuestInput('Ana Cruz +2').plusOnes, 2);
});

test('+3 clamps to 2 (the hard cap)', () => {
  assert.equal(parseGuestInput('Ana Cruz +3').plusOnes, 2);
});

test('+9 clamps to 2', () => {
  assert.equal(parseGuestInput('Ana +9').plusOnes, 2);
});

test('+0 → 1 (prototype `|| 1` fallthrough, documented quirk)', () => {
  assert.equal(parseGuestInput('Ana +0').plusOnes, 1);
});

test('a non-numeric +tag is NOT a plus token — it stays a name word', () => {
  // `/^\+(\d+)$/` requires digits, so "+bff" falls through to the name path.
  const d = parseGuestInput('Ana +bff');
  assert.equal(d.plusOnes, 0);
  assert.equal(d.firstName, 'Ana');
  assert.equal(d.lastName, '+bff');
});

test('last +N wins when several are given', () => {
  assert.equal(parseGuestInput('Ana +1 +2').plusOnes, 2);
});

// ── groups ───────────────────────────────────────────────────────────────────

test('#Group captures a group name (hash stripped, casing kept)', () => {
  assert.deepEqual(parseGuestInput('Ana #Barkada').groups, ['Barkada']);
});

test('multiple #groups accumulate in first-seen order', () => {
  assert.deepEqual(
    parseGuestInput('Ana #Barkada #CollegeFriends').groups,
    ['Barkada', 'CollegeFriends'],
  );
});

test('duplicate #groups are de-duplicated', () => {
  assert.deepEqual(parseGuestInput('Ana #Barkada #Barkada').groups, ['Barkada']);
});

test('a bare "#" contributes no group', () => {
  assert.deepEqual(parseGuestInput('Ana #').groups, []);
});

// ── role hints ───────────────────────────────────────────────────────────────

test('vip → roleHint vip', () => {
  assert.equal(parseGuestInput('Ana Cruz vip').roleHint, 'vip');
});

test('sponsor / ninong / ninang → roleHint principal_sponsor', () => {
  assert.equal(parseGuestInput('Ana sponsor').roleHint, 'principal_sponsor');
  assert.equal(parseGuestInput('Ana ninong').roleHint, 'principal_sponsor');
  assert.equal(parseGuestInput('Ana NINANG').roleHint, 'principal_sponsor');
});

test('no role keyword → roleHint null', () => {
  assert.equal(parseGuestInput('Ana Cruz').roleHint, null);
});

test('last role keyword wins', () => {
  assert.equal(parseGuestInput('Ana vip sponsor').roleHint, 'principal_sponsor');
});

// ── combined ─────────────────────────────────────────────────────────────────

test('the canonical combined line parses every dimension', () => {
  const d = parseGuestInput('Ana Cruz +1 groom vip #Barkada');
  assert.deepEqual(d, {
    firstName: 'Ana',
    lastName: 'Cruz',
    side: 'groom',
    plusOnes: 1,
    groups: ['Barkada'],
    roleHint: 'vip',
  });
});

test('keyword tokens can appear before the name and in any order', () => {
  const d = parseGuestInput('groom +2 #Ninang ninang Rosa Santos');
  assert.deepEqual(d, {
    firstName: 'Rosa',
    lastName: 'Santos',
    side: 'groom',
    plusOnes: 2,
    groups: ['Ninang'],
    roleHint: 'principal_sponsor',
  });
});

test('side+plus+group with no name → keywords consumed, name empty', () => {
  const d = parseGuestInput('bride +1 #Family');
  assert.deepEqual(d, {
    firstName: '',
    lastName: '',
    side: 'bride',
    plusOnes: 1,
    groups: ['Family'],
    roleHint: null,
  });
});
