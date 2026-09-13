/**
 * The client half of the shutter minute — a shape check, not a gate.
 *
 * The real rule lives in `public.papic_capture_minute`, which both writers
 * consult and which no caller can skip. What is tested here is only that
 * garbage never leaves the device as if it were a capture time, and — the part
 * that matters — that a REAL time survives unmangled.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { capturedAtIso, parseCapturedAtMs } from './papic-capture-minute';

test('a real shutter instant survives the round trip', () => {
  const ms = Date.UTC(2026, 8, 8, 6, 12, 0); // 2026-09-08 14:12 Manila
  const iso = capturedAtIso(ms);
  assert.equal(iso, '2026-09-08T06:12:00.000Z');
  assert.equal(parseCapturedAtMs(String(ms)), ms);
  // ⚖ Without this assertion every check below would pass for a helper that
  // returned null unconditionally — which is the defect wearing a disguise.
  assert.equal(Date.parse(iso!), ms);
});

test('nothing unusable is dressed up as a capture time', () => {
  for (const bad of [undefined, null, NaN, Infinity, 0, -1, 'later']) {
    assert.equal(
      capturedAtIso(bad as number),
      null,
      `${String(bad)} must not be sent as a shutter time`,
    );
  }
  // The 1970 epoch is what a phone with a dead clock reports, and 0 is what an
  // unset queue field holds. Both mean "we do not know" — and "we do not know"
  // travels as an absent argument, which the RPC answers with now().
  assert.equal(parseCapturedAtMs(0), null);
  assert.equal(parseCapturedAtMs('0'), null);
  assert.equal(parseCapturedAtMs(''), null);
  assert.equal(parseCapturedAtMs(Date.UTC(2100, 5, 1)), null);
});

test('parseCapturedAtMs reads the form field the guest camera posts', () => {
  const ms = Date.now() - 6 * 3_600_000;
  assert.equal(parseCapturedAtMs(String(ms)), ms);
  assert.equal(parseCapturedAtMs(ms), ms);
});
