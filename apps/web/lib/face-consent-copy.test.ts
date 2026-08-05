/**
 * What a guest is told before they tick a biometric consent box.
 *
 * This exists because the copy promised "facial-recognition photo matching for
 * this event" on EVERY event — while every event on the platform sits in the
 * mode where no descriptor is ever computed. Guests consented to processing
 * that did not run, and believed their photos would find them by themselves.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  join(HERE, '..', 'app', '[slug]', '_components', 'selfie-capture.tsx'),
  'utf8',
);

/** Only the JSX, so a docblock explaining the rule can't satisfy a rule. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('the consent wording branches on the face mode', () => {
  assert.match(
    CODE,
    /faceMode === 'mode_a' \?/,
    'the words must follow the processing — one wording for both modes is the bug',
  );
});

test('a mode_b event never promises facial recognition', () => {
  // The mode_b branch is everything after the ternary's `:` in the consent
  // block. It must state the opposite, plainly.
  assert.match(
    CODE,
    /No facial recognition runs at this event/,
    'a guest on a switched-off event must be told matching does not happen',
  );
});

test('mode_a keeps the full disclosure it was widened to carry', () => {
  // Widened 2026-08-02 to close a DPO gate: it must name WHERE the photos come
  // from and WHAT the match is for, not just the technique.
  assert.match(CODE, /including photos other guests take on their own phones/);
  assert.match(CODE, /so those photos can be delivered to me/);
});

test('the 18+ affirmation is still required in BOTH modes', () => {
  // A guest photo on someone else's event list is adults-only whether or not a
  // face is measured. Only the REASON changes.
  const box = CODE.slice(CODE.indexOf('name="age_affirmation"'));
  assert.match(box, /18 or older/);
  assert.ok(
    !/faceMode === 'mode_a' \? \(\s*<input/.test(box),
    'the 18+ input itself must not be conditional — only its wording',
  );
});

test('every claim about recognition sits inside a mode branch', () => {
  // A stray unconditional mention would reintroduce the promise somewhere else
  // on the same screen — which is exactly how the 18+ line kept it alive after
  // the main checkbox was fixed.
  const mentions = CODE.match(/facial-recognition|face recognition/gi) ?? [];
  const guarded = CODE.match(/mode_a/g) ?? [];
  assert.ok(
    guarded.length >= 2,
    'both the consent box and the 18+ line must branch on the mode',
  );
  assert.ok(mentions.length > 0, 'mode_a must still name the technique');
});

// ── The whole SCREEN must agree, not just the checkbox ──────────────────────
// The consent box was fixed first, and the card wrapping it kept promising
// "the candid shots of you get gathered for you automatically. No scanning, no
// searching." Two contradictory claims, two inches apart, on the same screen.
// A guest reads the headline, not the small print.

test('the enrolment card promises no automatic gathering on a switched-off event', () => {
  const card = readFileSync(
    join(HERE, '..', 'app', '[slug]', '_components', 'day-of-face-enroll.tsx'),
    'utf8',
  );
  const code = card.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.match(code, /faceMode === 'mode_a'/, 'the card must branch on the mode too');
  // The three unconditional promises that used to sit here.
  for (const promise of [
    'get gathered for you automatically',
    'No scanning, no\n                searching',
  ]) {
    const idx = code.indexOf(promise.split('\n')[0]!);
    if (idx === -1) continue;
    const before = code.slice(Math.max(0, idx - 400), idx);
    assert.match(
      before,
      /faceMode === 'mode_a'/,
      `"${promise.split('\n')[0]}" must sit inside a mode_a branch`,
    );
  }
});

test('the success state does not tell a mode_b guest photos will find them', () => {
  const card = readFileSync(
    join(HERE, '..', 'app', '[slug]', '_components', 'day-of-face-enroll.tsx'),
    'utf8',
  );
  const code = card.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const idx = code.indexOf('find their way to you');
  assert.ok(idx > -1, 'the mode_a success copy should still exist');
  assert.match(
    code.slice(Math.max(0, idx - 300), idx),
    /faceMode === 'mode_a'/,
    'it must be gated — it is a promise of automatic delivery',
  );
});
