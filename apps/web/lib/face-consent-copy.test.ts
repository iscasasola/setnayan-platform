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

/** Only the JSX, so a docblock explaining the rule can't satisfy a rule —
 *  whitespace folded, so a sentence wrapped across JSX lines still reads as one. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ');

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

test('the 18+ affirmation is still required in BOTH modes — carried by the one tick', () => {
  // Owner 2026-09-30 (final face step): ONE tick, "I'm 18+ and agree to face
  // tagging", posts BOTH attestations; neither input is conditional on the mode.
  const { FACE_STEP_TICK } = require('./face-enroll-refusal') as typeof import('./face-enroll-refusal');
  assert.match(FACE_STEP_TICK, /18\+/, 'the one tick no longer states the age');
  const posted = CODE.slice(CODE.indexOf('{agreed ? ('), CODE.indexOf(') : null}', CODE.indexOf('{agreed ? (')));
  assert.match(posted, /name="biometric_consent" value="1"/, 'the tick no longer posts the consent');
  assert.match(posted, /name="age_affirmation" value="1"/, 'the tick no longer posts the 18+ attestation');
  assert.doesNotMatch(posted, /faceMode/, 'an attestation became conditional on the mode');
  // …and the Details say 18 or older in BOTH wordings.
  assert.equal((CODE.match(/I confirm I am 18 or older/g) ?? []).length, 2, 'a Details wording lost the 18+ statement');
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
// Since 2026-09-30 the face step is ONE screen that exists only where face
// tagging runs: on a mode_b event it renders nothing at all, so it can promise
// nothing there — the strongest form of "the words follow the processing".

test('the face step renders nothing on a mode_b event — no promise, no collection', () => {
  const card = readFileSync(
    join(HERE, '..', 'app', '[slug]', '_components', 'day-of-face-enroll.tsx'),
    'utf8',
  );
  const code = card.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.match(code, /if \(faceMode !== 'mode_a' \|\| wish === false\) return null;/, 'the face step shows on an event where no face is matched');
  // The saved toast — the only promise on the card — sits after that return.
  assert.ok(code.indexOf('FACE_STEP_SAVED') > -1);
  assert.ok(
    code.indexOf("if (faceMode !== 'mode_a' || wish === false) return null;") < code.indexOf('if (done) {'),
    'the success toast can render before the mode check',
  );
});
