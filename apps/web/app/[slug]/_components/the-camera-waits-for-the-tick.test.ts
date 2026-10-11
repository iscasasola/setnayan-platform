/**
 * FACE REGISTRATION: THE CAMERA IS ASKED FOR ONLY AFTER "I'M 18+ AND AGREE" IS TICKED.
 *
 * A guest's walk, 2026-10-11 (fault N17): opening Face tagging asked the phone for the camera before the consent
 * tick. That was the screen as approved on 2026-09-30 ("Camera first", frame A of
 * `prototypes/face_registration_2026-09-30_fable.html`). Owner, 2026-10-11 ("ok all", relayed by the controller):
 * the same one screen, but the camera starts only when the box is ticked; until then the camera area is still.
 *
 * WHAT IS HELD:
 *   (1) THE RULE: no tick, no camera.
 *   (2) THE ONE PLACE THE CAMERA IS ASKED FOR is behind that rule: the file asks for it once, inside an effect whose
 *       first act is to leave unless the rule says yes, that re-runs when the tick changes, and whose cleanup stops
 *       the stream (so UNTICKING releases the camera, and so does leaving).
 *   (3) AS DRAWN BEFORE ANY TICK (the real component, rendered): the box is not ticked, "Take selfie" is disabled
 *       with its reason, nothing is "starting" (no spinner), and neither attestation is in the form.
 *   (4) "Take selfie" waits for the camera to answer — a press in the second it takes to start is not told the
 *       camera is blocked.
 *
 * NOT PROVEN HERE: a real phone's permission prompt (Safari, the in-app browsers). A real Chromium run with a fake
 * camera is in the builder's evidence folder, not in CI.
 *
 * SABOTAGE RUN 2026-10-11 (committed first, put back by `git checkout`): `cameraMayStart` made to answer true
 * always → (1) red; the effect's guard line removed → (2) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const CODE = stripComments(readFileSync(join(__dirname, 'selfie-capture.tsx'), 'utf8'));

test('(1) no tick, no camera', async () => {
  const { cameraMayStart } = await import('./selfie-capture');
  assert.equal(cameraMayStart(false), false, 'the camera may start before the guest has agreed');
  assert.equal(cameraMayStart(true), true, 'a guest who agreed can never take the selfie');
});

test('(2) the one place the camera is asked for is behind the rule, follows the tick, and lets go', () => {
  assert.equal((CODE.match(/getUserMedia\(/g) ?? []).length, 1, 'the camera is asked for in more than one place');
  const ask = CODE.indexOf('getUserMedia(');
  const effect = CODE.lastIndexOf('useEffect(() => {', ask);
  assert.ok(effect > 0, 'the camera is not asked for inside an effect');
  const body = CODE.slice(effect, CODE.indexOf('}, [', ask) + 60);
  assert.match(body, /^useEffect\(\(\) => \{\s*if \(!cameraMayStart\(agreed\)\) return;/, 'the effect asks for the camera without asking the rule first');
  assert.match(body, /\}, \[agreed, onFail, stopStream\]\);/, 'the camera does not follow the tick');
  assert.match(body, /return \(\) => \{\s*cancelled = true;\s*stopStream\(\);\s*\};/, 'unticking (or leaving) does not release the camera');
  // `agreed` is the tick itself, never pre-set.
  assert.match(CODE, /const \[agreed, setAgreed\] = useState\(false\);/, 'the box starts ticked');
  assert.match(CODE, /checked=\{agreed\}/);
});

test('(3) as drawn before any tick: not ticked, the button waits with its reason, nothing is starting', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SelfieCapture } = await import('./selfie-capture');
  const html = renderToStaticMarkup(
    React.createElement(SelfieCapture, { faceMode: 'mode_a', onShot: () => {}, onFail: () => {}, onClose: () => {} }),
  );
  const box = html.match(/<input[^>]*name="face_step_agree"[^>]*>/)?.[0] ?? '';
  assert.ok(box.includes('type="checkbox"'), 'the consent box was not drawn');
  assert.doesNotMatch(box, /\bchecked/, 'the box is drawn ticked');
  const button = html.match(/<button[^>]*>(?:<svg[\s\S]*?<\/svg>)?Take selfie<\/button>/)?.[0] ?? '';
  assert.ok(button, '"Take selfie" was not drawn');
  assert.match(button, /\bdisabled=""/, '"Take selfie" can be pressed before the tick');
  assert.match(button, /aria-describedby="face-step-hint"/, 'the disabled button no longer points at its reason');
  assert.match(html, /id="face-step-hint"/, 'the reason under the button is gone');
  assert.doesNotMatch(html, /animate-spin/, 'the screen shows something starting before the guest agreed');
  assert.doesNotMatch(html, /name="biometric_consent"|name="age_affirmation"/, 'an attestation is in the form before the tick');
  // The still camera area: the element is there (nothing to move when it starts), with no source.
  assert.match(html, /<video\b(?![^>]*\bsrc=)/);
});

test('(4) "Take selfie" waits for the camera to answer', () => {
  assert.match(CODE, /const ready = agreed && !working && \(live \|\| blocked\);/);
  assert.match(CODE, /\{agreed && !live && !blocked \? \(/, 'the "starting" mark shows before the tick, or never');
});
