/**
 * B1(a) — a capture-window refusal must never read as a failed upload.
 *
 * Asserts the PROPERTY, not a phrasing: for both window-refusal codes, the
 * message must not contain a retry instruction ("tap"/"retry"), and
 * `capture_not_started` must name the date it opens when one is given. A
 * reword of the sentence that keeps these properties is fine; one that
 * reintroduces "tap it in the roll to retry" on a window that isn't open
 * fails this test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isPapicWindowRefusalCode,
  papicSeatCaptureWindowRefusalMessage,
} from './papic-seat-capture-refusal-copy';

function assertNoRetryInstruction(message: string) {
  const lower = message.toLowerCase();
  assert.equal(lower.includes('tap'), false, `"${message}" tells the photographer to tap/retry`);
  assert.equal(
    lower.includes('retry') && !lower.includes('nothing') && !lower.includes('no'),
    false,
    `"${message}" reads as a retry instruction`,
  );
}

test('isPapicWindowRefusalCode recognises exactly the two window codes', () => {
  assert.equal(isPapicWindowRefusalCode('capture_not_started'), true);
  assert.equal(isPapicWindowRefusalCode('capture_window_closed'), true);
  assert.equal(isPapicWindowRefusalCode('revoked'), false);
  assert.equal(isPapicWindowRefusalCode('not_your_seat'), false);
  assert.equal(isPapicWindowRefusalCode(null), false);
  assert.equal(isPapicWindowRefusalCode(undefined), false);
});

test('capture_not_started names the date the camera opens, when given one', () => {
  const msg = papicSeatCaptureWindowRefusalMessage('capture_not_started', 'photo', '2026-09-19');
  assert.match(msg, /Sep 19/);
  assert.equal(msg.toLowerCase().includes('opens'), true);
  assertNoRetryInstruction(msg);
});

test('capture_not_started degrades gracefully with no date', () => {
  const msg = papicSeatCaptureWindowRefusalMessage('capture_not_started', 'clip', null);
  assert.equal(msg.toLowerCase().includes("hasn't opened yet") || msg.includes('hasn’t opened yet'), true);
  assertNoRetryInstruction(msg);
});

test('capture_window_closed never tells the photographer to retry', () => {
  const msg = papicSeatCaptureWindowRefusalMessage('capture_window_closed', 'photo', '2026-09-19');
  assert.equal(msg.toLowerCase().includes('closed'), true);
  assertNoRetryInstruction(msg);
});

test('the message names photo vs clip correctly', () => {
  const photoMsg = papicSeatCaptureWindowRefusalMessage('capture_not_started', 'photo', null);
  const clipMsg = papicSeatCaptureWindowRefusalMessage('capture_not_started', 'clip', null);
  assert.match(photoMsg, /\bshot\b/);
  assert.match(clipMsg, /\bclip\b/);
});

// 🛑 THE REGRESSION THIS TEST HOLDS: the OLD behaviour set the same generic
// "tap it in the roll to retry" sentence for every terminal code, including
// these two. Reproduce that here so the property assertion above is proven to
// fire on the actual defect, not just on a hypothetical.
test('regression: the old one-size-fits-all retry sentence fails these assertions', () => {
  const oldGenericMessage = "A shot didn't upload — tap it in the roll to retry.";
  assert.throws(() => assertNoRetryInstruction(oldGenericMessage));
});
