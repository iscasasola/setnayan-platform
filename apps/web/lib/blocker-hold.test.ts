/**
 * ⏳ THE BLOCKER'S HOLD IS A SKIPPABLE AD, NEVER A LOCK ON THE ANSWER (Supplier Build 3 · lane B; DECISION_LOG ⏳
 * 2026-11-09).
 *
 * Owner: the way back waits 5 s the first time a blocker shows, 30 s the second, 60 s from the third on; the count is
 * the server's. 🔑 The ACTION buttons are never held — only "Return to chat" waits.
 *
 * What would silently undo it:
 *   1. the 5 / 30 / 60 ladder drifts, or an unreadable count becomes the SHORTEST hold (a free skip);
 *   2. the action is held for even one second of any hold;
 *   3. the countdown goes negative or the line stops saying how long;
 *   4. the blocker part stops reading the ladder / draws Return to chat while the hold runs.
 *
 * Run: cd apps/web && npx tsx --test lib/blocker-hold.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { actionHeld, blockerHoldSeconds, holdLeft, holdLine } from './blocker-hold';

test('1 · 5 s first show, 30 s second, 60 s third and after', () => {
  assert.equal(blockerHoldSeconds(1), 5);
  assert.equal(blockerHoldSeconds(2), 30);
  assert.equal(blockerHoldSeconds(3), 60);
  assert.equal(blockerHoldSeconds(12), 60);
  assert.equal(blockerHoldSeconds(0), 5, 'a fresh count is the first show');
});

test('1b · a count the server could not give holds the LONGEST, never the shortest', () => {
  assert.equal(blockerHoldSeconds(null), 60);
  assert.equal(blockerHoldSeconds(undefined), 60);
  assert.equal(blockerHoldSeconds(Number.NaN), 60);
});

test('2 · the action is never held — over every second of every hold', () => {
  for (const hold of [5, 30, 60]) {
    for (let s = hold; s >= 0; s--) assert.equal(actionHeld(s), false, `hold ${hold}s at ${s}s left`);
  }
});

test('3 · the countdown counts whole seconds down to 0 and stops there', () => {
  const t0 = 1_000_000;
  assert.equal(holdLeft(t0, 5, t0), 5);
  assert.equal(holdLeft(t0, 5, t0 + 1), 5, 'rounds up — never shows 4 at 4.999 s left');
  assert.equal(holdLeft(t0, 5, t0 + 4_001), 1);
  assert.equal(holdLeft(t0, 5, t0 + 5_000), 0);
  assert.equal(holdLeft(t0, 5, t0 + 99_000), 0);
  assert.equal(holdLine(30), 'Return to chat in 30');
});

test('4 · the ONE blocker part reads the ladder, never disables its action, and draws Return to chat only at 0', () => {
  const src = readFileSync(join(__dirname, '..', 'app', '_components', 'chat', 'chat-blocker.tsx'), 'utf8');
  assert.match(src, /blockerHoldSeconds\(/, 'the hold comes from the ladder');
  assert.match(src, /recordBlockerShow\(/, 'the count is the server\'s');
  assert.match(src, /data-held=\{String\(actionHeld\(/, 'the action wrapper states its (never) held state');
  assert.doesNotMatch(src.slice(src.indexOf('data-blocker-action')), /^[^\n]*\bdisabled\b/m, 'nothing disables the action');
  assert.match(src, /\{free \? \([\s\S]*?Return to chat[\s\S]*?\) : \([\s\S]*?holdLine\(/, 'Return to chat only when free');
});
