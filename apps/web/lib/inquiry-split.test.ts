/**
 * The fair inquiry split (#8013 drawing, panel (e)). What is held: busy letters are shared by count, not by halving
 * the alphabet; a cut can fall inside a letter; 1–5 people each get about the same share; nobody gets an empty
 * block; compound names file as written; the away rule walks next Account Manager → Branch Manager.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_ACCOUNT_MANAGERS_PER_CARD,
  PREFIXES,
  blockWords,
  countPrefixes,
  fairSplit,
  inBlock,
  pickAccountManager,
  shareWords,
  surnameKey,
} from './inquiry-split';

test('the cap is the owner’s five per card, per branch', () => {
  assert.equal(MAX_ACCOUNT_MANAGERS_PER_CARD, 5);
});

test('last names file as written: accents folded, spaces dropped, Dela Cruz under D', () => {
  assert.equal(surnameKey('Dela Cruz'), 'DELACRUZ');
  assert.equal(surnameKey('De Guzmán'), 'DEGUZMAN');
  assert.equal(surnameKey('Peña'), 'PENA');
  assert.equal(surnameKey('  '), null);
  assert.equal(surnameKey(null), null);
  assert.equal(surnameKey('O'), 'OA');
});

test('one person holds A – Z', () => {
  const [only] = fairSplit(countPrefixes(['Santos', 'Reyes']), 1);
  assert.equal(only!.from, 'AA');
  assert.equal(only!.to, null);
  assert.equal(blockWords(only!), 'A – Z');
  assert.equal(only!.share, 1);
});

test('busy letters move the cut: many S and M names push it inside M, not at the alphabet’s middle', () => {
  const names = [
    ...Array(30).fill('Santos'), ...Array(20).fill('Mendoza'), ...Array(20).fill('Manalo'),
    ...Array(10).fill('Cruz'), ...Array(10).fill('Reyes'), ...Array(10).fill('Garcia'),
  ];
  const counts = countPrefixes(names);
  const [a, b] = fairSplit(counts, 2);
  // Running total: C 10, G 20, MA 40, ME 60 → half (50) is reached on ME, so the second person starts after ME.
  assert.equal(a!.from, 'AA');
  assert.equal(a!.to, 'MF');
  assert.equal(blockWords(a!, counts), 'A – Me');
  assert.equal(blockWords(b!, counts), 'Mf – Z');
  assert.equal(shareWords(a!.share), '60%');
  assert.equal(shareWords(b!.share), '40%');
});

test('1 to 5 people: every block is non-empty, contiguous, covers A–Z, and shares are near-even on even data', () => {
  const counts = new Map(PREFIXES.map((p) => [p, 3] as const));
  for (let n = 1; n <= 5; n++) {
    const blocks = fairSplit(counts, n);
    assert.equal(blocks.length, n);
    assert.equal(blocks[0]!.from, 'AA');
    assert.equal(blocks[n - 1]!.to, null);
    for (let k = 0; k + 1 < n; k++) assert.equal(blocks[k]!.to, blocks[k + 1]!.from);
    for (const b of blocks) assert.ok(Math.abs(b.share - 1 / n) < 0.01, `n=${n} share ${b.share}`);
  }
});

test('more than five is capped at five; zero or junk is one', () => {
  assert.equal(fairSplit(new Map(), 9).length, 5);
  assert.equal(fairSplit(new Map(), 0).length, 1);
  assert.equal(fairSplit(new Map(), Number.NaN).length, 1);
});

test('no past clients → an even A–Z split, never a crash', () => {
  const [a, b] = fairSplit(new Map(), 2);
  assert.equal(a!.from, 'AA');
  assert.equal(b!.from, 'NA');
  assert.equal(blockWords(a!), 'A – M');
  assert.equal(blockWords(b!), 'N – Z');
});

test('all the clients under one prefix still leaves the second person a block', () => {
  const blocks = fairSplit(new Map([['SA', 100]]), 3);
  assert.equal(blocks.length, 3);
  assert.ok(blocks.every((b, i) => i === 0 || b.from > blocks[i - 1]!.from));
});

test('the block holds the name', () => {
  assert.ok(inBlock('SANTOS', { from: 'MF', to: null }));
  assert.ok(!inBlock('MANALO', { from: 'MF', to: null }));
  assert.ok(inBlock('DELACRUZ', { from: 'AA', to: 'MF' }));
});

const split = [
  { memberId: 'bea', block: { from: 'AA', to: 'MF' } },
  { memberId: 'joy', block: { from: 'MF', to: null } },
];
const base = { split, branchAccountManagers: ['bea', 'joy', 'mark'], branchManagerId: 'rico', away: new Set<string>() };

test('the holder of the last name gets the inquiry', () => {
  assert.deepEqual(pickAccountManager({ ...base, lastName: 'Dela Cruz' }), { memberId: 'bea', why: 'split' });
  assert.deepEqual(pickAccountManager({ ...base, lastName: 'Tan' }), { memberId: 'joy', why: 'split' });
});

test('away: the next Account Manager in the branch, then the Branch Manager', () => {
  assert.deepEqual(
    pickAccountManager({ ...base, lastName: 'Tan', away: new Set(['joy']) }),
    { memberId: 'mark', why: 'away-next-account-manager' },
  );
  assert.deepEqual(
    pickAccountManager({ ...base, lastName: 'Tan', away: new Set(['joy', 'mark', 'bea']) }),
    { memberId: 'rico', why: 'away-branch-manager' },
  );
  assert.deepEqual(
    pickAccountManager({ ...base, lastName: 'Tan', away: new Set(['joy', 'mark', 'bea', 'rico']) }),
    { memberId: null, why: 'nobody' },
  );
});

test('no usable last name → the first person on the card who is in', () => {
  assert.deepEqual(pickAccountManager({ ...base, lastName: '' }), { memberId: 'bea', why: 'no-name-first-on-card' });
  assert.deepEqual(
    pickAccountManager({ ...base, lastName: null, away: new Set(['bea']) }),
    { memberId: 'joy', why: 'no-name-first-on-card' },
  );
});

test('a card nobody covers is left to the caller (an open owner rule) — never guessed here', () => {
  assert.deepEqual(pickAccountManager({ ...base, split: [], lastName: 'Tan' }), { memberId: null, why: 'nobody' });
});

test('Adjust offers the fair cut and the letter starts around it, each with its two shares', async () => {
  const { cutChoices, twoWayShares } = await import('./inquiry-split');
  const counts = new Map([['DE', 2], ['MA', 1], ['ME', 1], ['SA', 4]]);
  const [a, b] = twoWayShares(counts, 'ME');
  assert.equal(Math.round(a * 100), 38); // DE 2 + MA 1 of 8
  assert.equal(Math.round(b * 100), 63);
  const choices = cutChoices(counts, 'ME').map((c) => c.cut);
  assert.deepEqual(choices, ['LA', 'MA', 'ME', 'NA']);
  assert.deepEqual(cutChoices(counts, 'AA'), []);
});
