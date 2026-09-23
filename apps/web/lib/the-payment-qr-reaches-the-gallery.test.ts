/**
 * the-payment-qr-reaches-the-gallery.test.ts
 *
 * The amount-carrying QR is the ONE path that spares a payer typing the figure
 * — and on a phone it is the only path at all, because you cannot point a
 * phone's camera at its own screen. So the couple has to get the picture into
 * their gallery and scan it from there.
 *
 * 🛑 FOR AN UNKNOWN STRETCH IT REACHED NOWHERE. The control was a bare
 * `<a href={dataUrl} download>`. Measured 2026-09-23 on the owner's iPhone in
 * Safari, behind a control probe that confirmed the page COULD launch other
 * apps: four taps, and the file landed in neither Photos nor Files.
 *
 * 🔑 THE LABEL NAMED THE PLACE IT NEVER REACHED — "Save image · scan from
 * gallery". A promise about a destination is exactly the kind of claim that
 * cannot fail loudly: the link clicked, the page did not error, and nothing
 * arrived. Two assertions here, both aimed at that:
 *
 *   1. The save goes through `lib/save-to-device.ts`, which hands the file to
 *      `navigator.share` so the OS offers "Save to Photos" / "Save image".
 *      That module already existed for Papic; the pay page simply never used
 *      it, which is why this was a wiring defect and not a missing capability.
 *   2. No payment surface reintroduces a bare `<a download>`, the exact shape
 *      that failed.
 *
 * What this file CANNOT assert: that the picture arrives. A browser cannot
 * write to the camera roll without the person tapping "Save Image", and
 * `saveImageToDevice` returns 'shared' even when they dismiss the sheet — by
 * design, so a cancel is not re-prompted. Whether the file lands is therefore
 * unobservable from here, which is precisely why the UI must never say
 * "Saved!" and why test 3 exists.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const here = dirname(fileURLToPath(import.meta.url));
const RAILS = join(here, '..', 'app', '_components', 'payment', 'payment-rails.tsx');

function railsSource(): string {
  return stripComments(readFileSync(RAILS, 'utf8'));
}

test('the payment QR is saved through the share sheet, not a raw download', () => {
  const src = railsSource();
  assert.ok(
    src.includes('save-to-device'),
    'payment-rails.tsx must save the QR through lib/save-to-device.ts — that is ' +
      'the module that reaches the camera roll. Re-implementing the save here ' +
      'is how the two mechanisms drift apart.',
  );
  assert.ok(
    /saveImageToDevice\s*\(/.test(src),
    'the share-sheet helper must actually be CALLED, not merely imported',
  );
});

test('no payment surface offers the QR through a bare download attribute', () => {
  const src = railsSource();
  // The measured failure, in its exact shape: an anchor carrying `download`.
  // `saveImageToDevice` builds its own anchor internally as the DESKTOP
  // fallback, and that is fine — it lives in save-to-device.ts, not here.
  assert.ok(
    !/<a[^>]*\bdownload\b/s.test(src),
    'a bare <a download> is back in payment-rails.tsx. On iOS that saves ' +
      'nothing at all — measured, four times. Route it through ' +
      'saveImageToDevice instead.',
  );
});

test('the UI never claims the image was saved', () => {
  // saveImageToDevice resolves 'shared' when the payer DISMISSES the sheet, so
  // any past-tense success claim would be a statement about an action we did
  // not observe. Instructions are allowed; claims are not.
  const src = railsSource();
  const falseClaims = [/\bSaved!/, /\bSaved to your photos\b/i, /\bimage saved\b/i, /\bSaved to gallery\b/i];
  for (const claim of falseClaims) {
    assert.ok(
      !claim.test(src),
      `payment-rails.tsx asserts the save succeeded (${claim}). It cannot know ` +
        `that — a dismissed share sheet resolves 'shared' too. Say what to do ` +
        `next instead of claiming what happened.`,
    );
  }
});

test('the label does not promise a destination before the save has run', () => {
  const src = railsSource();
  // The old label — "Save image · scan from gallery" — named the gallery on the
  // BUTTON, before anything had happened and on a path that never got there.
  // Where the picture went is only knowable after the fact, so the resting
  // label must not name a place.
  const buttonLabel = /{phase === 'working' \? '[^']*' : '([^']*)'}/.exec(src);
  const resting = buttonLabel?.[1];
  // assert.fail returns never, so `resting` is a string below. An absent match
  // must FAIL here rather than coalesce to '' — an empty string would sail
  // through the destination check and report a pass for a guard that found
  // nothing to look at.
  if (typeof resting !== 'string' || resting.length === 0) {
    assert.fail('could not find the save button label to check — has the button been renamed?');
  }
  assert.ok(
    !/gallery|photos|files/i.test(resting),
    `the resting button label ("${resting}") names a destination. Which one the ` +
      `phone actually uses is not known until saveImageToDevice returns — name ` +
      `it in the follow-up line, not on the button.`,
  );
});
