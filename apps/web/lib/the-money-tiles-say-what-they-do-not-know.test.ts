/**
 * THE MONEY TILES SAY WHAT THEY DO NOT KNOW.
 *
 * `your-team.test.ts` proves the arithmetic refuses to guess. This file proves
 * the refusal **reaches the screen**, because those are two different claims and
 * this project has shipped seven fixes for the gap between them:
 *
 *   🔑 A LOG LINE NEVER CHANGED A PIXEL. `teamMoney` can return a perfect
 *   `inBuildUnpriced: 2` and, if no tile renders it, the couple still reads
 *   "₱2,250,000 to spare" — the exact defect, now with a correct value sitting
 *   unused one scope away.
 *
 * Measured on production 2026-09-22, event 044f7e64 (a live wedding): both
 * locked suppliers and both candidates carry `total_cost_php = NULL`; the
 * section printed **LOCKED ₱0** and **₱2,250,000 to spare** beside
 * **₱26,499 paid**, and each of the three row surfaces drew **nothing at all**
 * where the price goes.
 *
 * ⚠ THIS IS A SOURCE GUARD, so it carries that class's known failure modes and
 * answers each one deliberately:
 *   • it reads CODE, not prose — comments here quote the very patterns the
 *     assertions forbid, so it strips them through the repo's canonical
 *     `stripComments` (`lint-one-comment-stripper.mjs` exists to keep there
 *     being exactly one);
 *   • it COUNTS the mounts rather than matching one, because a file-level match
 *     cannot say which of three components still has the defect;
 *   • it asserts the notes are wired **per tile**, since one honest tile beside
 *     two silent ones is still a screen that misleads.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEAM = 'app/dashboard/[eventId]/vendors/_components/build-locked.tsx';
const src = stripComments(readFileSync(resolve(WEB, TEAM), 'utf8'));

const count = (re: RegExp) => (src.match(re) ?? []).length;

test('the unpriced COUNT is handed to the derivation, from the rendered rows', () => {
  // Not a constant, not a guess: the locked rows the section itself renders.
  assert.match(
    src,
    /lockedUnpricedCount:\s*lockedRows\.filter\(\(r\) => r\.cost == null\)\.length/,
    'the locked side must count its own unpriced rows',
  );
  assert.match(
    src,
    /candidateCostsPhp:\s*toLockRows\.map\(\(r\) => r\.cost\)/,
    'candidate costs must arrive with their nulls intact, for teamMoney to count',
  );
});

test('🪤 the buffer tile is worded WITH the count — not from the number alone', () => {
  assert.match(
    src,
    /bufferTile\(\s*money\.bufferPhp,\s*money\.lockedUnpriced \+ money\.inBuildUnpriced\s*\)/,
    'bufferTile(money.bufferPhp) alone cannot say "Not knowable" — it would fall back to "No budget set"',
  );
});

test('🪤 all THREE money tiles carry a note — counted, not spot-checked', () => {
  // A file-level match cannot say WHICH tile still lies. Sabotage that landed
  // 3→2 would stay green against a single `assert.match`.
  assert.equal(
    count(/note=\{unpricedNote\(/g),
    3,
    'Locked, Still to lock and Buffer must each state their own doubt',
  );
  // And each one anchored to its own tile, so the three are not interchangeable.
  for (const [k, arg] of [
    ['Locked', 'money\\.lockedUnpriced'],
    ['Still to lock', 'money\\.inBuildUnpriced'],
    ['Buffer', 'money\\.lockedUnpriced \\+ money\\.inBuildUnpriced'],
  ] as const) {
    assert.match(
      src,
      new RegExp(`k="${k}"[\\s\\S]{0,240}note=\\{unpricedNote\\(${arg}\\)\\}`),
      `the "${k}" tile must carry the count that belongs to it`,
    );
  }
  // The note has to be RENDERED, not merely computed and dropped.
  assert.match(src, /\{note && <div/, 'LockTile must draw the note');
});

test('🪤 a null row price is STATED, on every one of the three row surfaces', () => {
  assert.equal(count(/<RowPrice /g), 3, 'all three row surfaces must state absence');
  assert.doesNotMatch(
    src,
    /pesoFromPhp\(r\.cost\) &&/,
    'this is the defect: a null price rendered as NOTHING, indistinguishable from free or from ₱0',
  );
  assert.match(src, /'No price recorded'/, 'and the absence has words');
});

test('🪤 the subtotal heading cannot round a missing price down to ₱0', () => {
  assert.match(
    src,
    /subtotalLabel\(toLockTotal, money\.inBuildUnpriced\)/,
    'the "in your build" heading must go through subtotalLabel',
  );
  // 🪤 ONE SUM, NOT TWO. This was a second reduce over the same rows with the
  // same `?? 0`; two derivations of one figure drift the moment either is
  // edited, and both were wrong in the same way.
  assert.match(src, /const toLockTotal = money\.inBuildPhp;/, 'the heading reads the tile’s figure');
  assert.doesNotMatch(
    src,
    /reduce\(\(s, r\) => s \+ \(r\.cost \?\? 0\), 0\)/,
    'the duplicate null-swallowing sum must be gone, not merely unused',
  );
});
