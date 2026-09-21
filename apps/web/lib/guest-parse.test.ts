/**
 * Unit suite for the pure Add-grammar parser (Living Roster · P2). Proves the
 * capture-bar grammar without a browser — this is the highest-value pure helper
 * of the phase, so the edge cases the plan calls out (empty name, `+3`→3 (cap 4 since 2026-09-21),
 * multiple `#group`, side+plus+group combined, name-only) are all pinned here.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGuestInput, type ParsedGuestDraft } from './guest-parse';

const BASE: ParsedGuestDraft = {
  firstName: '',
  lastName: '',
  prefix: '',
  middleName: '',
  suffix: '',
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

test('a middle name and a particle surname split at the particle', () => {
  // WAS: lastName === 'Clara de la Cruz' — the pre-2026-09-14 rule that every
  // word after the first is the surname. `parsePersonName` now owns this split,
  // so "Clara" is the middle name and the family name starts at the particle.
  const d = parseGuestInput('Maria Clara de la Cruz');
  assert.equal(d.firstName, 'Maria');
  assert.equal(d.middleName, 'Clara');
  assert.equal(d.lastName, 'de la Cruz');
});

test('the capture bar splits a title off the name (the reported bug)', () => {
  // "Atty. Bob Casasola Jr." used to store first='Atty.', last='Bob Casasola Jr.'
  const d = parseGuestInput('Atty. Bob Casasola Jr.');
  assert.equal(d.prefix, 'Atty.');
  assert.equal(d.firstName, 'Bob');
  assert.equal(d.lastName, 'Casasola');
  assert.equal(d.suffix, 'Jr.');
});

test('the Add grammar still wins over the name parser', () => {
  // Tokens are stripped BEFORE the name is parsed, so a group called #Jr or a
  // side keyword can never be mistaken for a suffix or an honorific.
  const d = parseGuestInput('Atty. Bob Casasola Jr. +1 groom vip #Barkada');
  assert.equal(d.prefix, 'Atty.');
  assert.equal(d.firstName, 'Bob');
  assert.equal(d.lastName, 'Casasola');
  assert.equal(d.suffix, 'Jr.');
  assert.equal(d.side, 'groom');
  assert.equal(d.plusOnes, 1);
  assert.equal(d.roleHint, 'vip');
  assert.deepEqual(d.groups, ['Barkada']);
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

// ⚖ The cap moved from 2 to 4 (owner 2026-09-21: "+1 per guest can be up to number 4").
test('+3 → 3 and +4 → 4 (the cap is four)', () => {
  assert.equal(parseGuestInput('Ana Cruz +3').plusOnes, 3);
  assert.equal(parseGuestInput('Ana Cruz +4').plusOnes, 4);
});

test('+9 clamps to 4', () => {
  assert.equal(parseGuestInput('Ana +9').plusOnes, 4);
});

test('+0 → 0 (reads as none — no phantom +1)', () => {
  assert.equal(parseGuestInput('Ana +0').plusOnes, 0);
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

test('ninong / ninang tag the SPECIFIC half; bare sponsor defaults to Ninong', () => {
  // Split 2026-09-14 (owner): principal sponsors stand in pairs, so the token
  // that names which half must not collapse to the generic role any more.
  assert.equal(parseGuestInput('Ana ninong').roleHint, 'principal_sponsor_ninong');
  assert.equal(parseGuestInput('Ana NINANG').roleHint, 'principal_sponsor_ninang');

  // The bare `sponsor` used to land on the plain `principal_sponsor`. The owner
  // RETIRED that role on 2026-09-15 and, asked what an unspecified sponsor
  // should become, chose Ninong — first in every ordering in the app, and one
  // dropdown from Ninang.
  assert.equal(parseGuestInput('Ana sponsor').roleHint, 'principal_sponsor_ninong');

  // 🔒 THE REAL ASSERTION: whatever the default is, the parser must never mint
  // the retired role again. This is the line that fails if someone restores the
  // old fallback for "safety".
  for (const line of ['Ana sponsor', 'Ana ninong', 'Ana NINANG', 'Ana vip sponsor']) {
    assert.notEqual(
      parseGuestInput(line).roleHint,
      'principal_sponsor',
      `"${line}" minted the retired principal_sponsor role`,
    );
  }
});

test('no role keyword → roleHint null', () => {
  assert.equal(parseGuestInput('Ana Cruz').roleHint, null);
});

test('last role keyword wins', () => {
  assert.equal(parseGuestInput('Ana vip sponsor').roleHint, 'principal_sponsor_ninong');
});

// ── combined ─────────────────────────────────────────────────────────────────

test('the canonical combined line parses every dimension', () => {
  const d = parseGuestInput('Ana Cruz +1 groom vip #Barkada');
  assert.deepEqual(d, {
    prefix: '',
    firstName: 'Ana',
    middleName: '',
    lastName: 'Cruz',
    suffix: '',
    side: 'groom',
    plusOnes: 1,
    groups: ['Barkada'],
    roleHint: 'vip',
  });
});

test('keyword tokens can appear before the name and in any order', () => {
  const d = parseGuestInput('groom +2 #Ninang ninang Rosa Santos');
  assert.deepEqual(d, {
    prefix: '',
    firstName: 'Rosa',
    middleName: '',
    lastName: 'Santos',
    suffix: '',
    side: 'groom',
    plusOnes: 2,
    groups: ['Ninang'],
    roleHint: 'principal_sponsor_ninang',
  });
});

test('side+plus+group with no name → keywords consumed, name empty', () => {
  const d = parseGuestInput('bride +1 #Family');
  assert.deepEqual(d, {
    prefix: '',
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',
    side: 'bride',
    plusOnes: 1,
    groups: ['Family'],
    roleHint: null,
  });
});
