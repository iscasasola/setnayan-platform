/**
 * S5 · the envelope (base64-in-JSON) and the go-live guard's probe parser.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProbeChunk,
  chunkFromBase64,
  chunkToBase64,
  decodeBase64,
  encodeBase64,
  parseProbeResponse,
  probeTransport,
} from './ipc-envelope';
import { ENCODED_FIXTURE, Envelope, encodeChunk } from './ipc-contract';

test('base64 round-trips arbitrary bytes, including 0x00 and 0xff', () => {
  const bytes = new Uint8Array([0, 1, 2, 253, 254, 255, 0, 255]);
  assert.deepEqual(decodeBase64(encodeBase64(bytes)), bytes);
});

test('chunkToBase64 / chunkFromBase64 round-trip the shared cross-language fixture', () => {
  const field = chunkToBase64(ENCODED_FIXTURE);
  const back = chunkFromBase64(field);
  assert.deepEqual(back, ENCODED_FIXTURE);
});

test('chunkToBase64 encodes to the SAME bytes as the raw fixture hex, just base64 of them', () => {
  // Cross-check against encodeChunk directly rather than deriving expectations
  // from chunkToBase64 itself — a drift in encodeBase64 would otherwise still
  // round-trip through decodeBase64 and hide from the test above.
  const raw = encodeChunk(ENCODED_FIXTURE);
  assert.equal(decodeBase64(chunkToBase64(ENCODED_FIXTURE)).length, raw.length);
  assert.deepEqual(decodeBase64(chunkToBase64(ENCODED_FIXTURE)), raw);
});

test('buildProbeChunk is small and decodes as an ordinary chunk', () => {
  const probe = buildProbeChunk();
  assert.ok(probe.payload.length < 64, 'the probe payload must be tiny — it is not real media');
  const field = chunkToBase64(probe);
  assert.deepEqual(chunkFromBase64(field), probe);
});

// ── THE GUARD: refuse only on a MEASURABLY UNUSABLE transport, never merely
// because the answer is the expected base64/JSON path (rule from the module
// docblock; mirrors Rust's `Envelope::is_zero_copy` comment). ──────────────

test('"raw:<len>" parses as Raw and usable', () => {
  assert.deepEqual(parseProbeResponse('raw:5'), { envelope: Envelope.Raw, usable: true });
});

test('"json:base64_ok" parses as Base64 and usable — the EXPECTED path today, never refused', () => {
  assert.deepEqual(parseProbeResponse('json:base64_ok'), { envelope: Envelope.Base64, usable: true });
});

test('"json:base64_bad" parses as NOT usable — the transport genuinely failed to decode', () => {
  const result = parseProbeResponse('json:base64_bad');
  assert.equal(result.usable, false);
});

test('"json:unrecognized" parses as NOT usable — no chunk field arrived at all', () => {
  const result = parseProbeResponse('json:unrecognized');
  assert.equal(result.usable, false);
});

// ── UNBOUNDED-REFUSAL GUARD — pins the specific defect this file exists to
// prevent: a version of this guard that refuses on anything but Raw. ───────
test('REGRESSION GUARD — being on the base64/JSON envelope alone must never mark unusable', () => {
  const onlyEnvelopeIsJson = parseProbeResponse('json:base64_ok');
  assert.equal(
    onlyEnvelopeIsJson.usable,
    true,
    'a guard that refuses go-live merely for being on the JSON/base64 path would refuse ' +
      'every macOS user, per S0 — see the module docblock',
  );
});

test('probeTransport reports usable=false and envelope=null when invoke itself throws', async () => {
  const throwingInvoke = async () => {
    throw new Error('IPC channel unavailable');
  };
  const result = await probeTransport(throwingInvoke);
  assert.equal(result.usable, false);
  assert.equal(result.envelope, null);
  assert.ok(result.probeMs >= 0);
});

test('probeTransport reports usable=true for a successful base64 round-trip', async () => {
  const okInvoke = async (_cmd: string, _args?: Record<string, unknown>) => 'json:base64_ok';
  const result = await probeTransport(okInvoke);
  assert.equal(result.usable, true);
  assert.equal(result.envelope, Envelope.Base64);
});

test('probeTransport sends the probe chunk as a base64 "chunk" field', async () => {
  let capturedArgs: Record<string, unknown> | undefined;
  const capturingInvoke = async (cmd: string, args?: Record<string, unknown>) => {
    capturedArgs = args;
    assert.equal(cmd, 'encoder_probe');
    return 'json:base64_ok';
  };
  await probeTransport(capturingInvoke);
  assert.ok(capturedArgs, 'invoke must have been called with args');
  assert.equal(typeof capturedArgs!.chunk, 'string');
  assert.deepEqual(chunkFromBase64(capturedArgs!.chunk as string), buildProbeChunk());
});
