/**
 * The refusal rule's guards.
 *
 * The defect here is not "the guard is missing" — it is "the guard refuses the
 * wrong thing". S5's original wording would have refused every macOS user, and
 * the entire encoder corpus warns about it in three separate docblocks. So the
 * loudest tests below are the ones that prove this module does NOT refuse.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PROBE_SLOW_MS,
  TRANSPORT_SLOW_SENTENCE,
  TRANSPORT_UNUSABLE_SENTENCE,
  decideGoLive,
  guardGoLive,
} from './go-live-guard';
import { Envelope } from './ipc-contract';
import { buildProbeChunk, chunkToBase64 } from './ipc-envelope';
import type { TransportProbeResult } from './ipc-envelope';

function probe(over: Partial<TransportProbeResult> = {}): TransportProbeResult {
  return { envelope: Envelope.Base64, probeMs: 20, usable: true, ...over };
}

// ── THE MISTAKE THIS MODULE MUST NOT REPEAT ──────────────────────────────────
// S0 measured 1797/1797 chunks arriving as JSON and ZERO as Raw. A guard that
// refused anything but Raw would refuse every macOS user — the exact trap named
// in `Envelope::is_zero_copy`'s Rust docblock. Mutate `decideGoLive` to check
// the envelope and this test is what goes red.
test('the base64/JSON envelope goes live — it is the expected path, not a fault', () => {
  const verdict = decideGoLive(probe({ envelope: Envelope.Base64, usable: true }));
  assert.equal(verdict.allowed, true);
  assert.equal(verdict.refusal, null);
  assert.equal(verdict.sentence, '', 'a normal transport says nothing');
});

test('a raw envelope goes live too — neither envelope is refused', () => {
  assert.equal(decideGoLive(probe({ envelope: Envelope.Raw })).allowed, true);
});

// ── THE ONE THING THAT MAY REFUSE ────────────────────────────────────────────
test('an unusable transport refuses, and says which one it is', () => {
  const verdict = decideGoLive(probe({ usable: false }));
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.refusal, 'transport_unusable');
  assert.equal(verdict.sentence, TRANSPORT_UNUSABLE_SENTENCE);
});

test('a probe that never returned refuses, and names no envelope it did not see', () => {
  const verdict = decideGoLive(probe({ envelope: null, usable: false }));
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.envelope, null, 'guessing an envelope here would be a fabrication');
});

// ── SLOWNESS IS A NOTE, NEVER A GATE ─────────────────────────────────────────
// S0 §§ 3.1/3.4: the healthy run's p95 is 151 ms and the degraded run's MEAN is
// 155 ms; the healthy run's max (501 ms) is worse than the degraded run's max
// (420 ms). The distributions overlap, so no threshold separates them — and a
// slow probe must therefore never stop a wedding going to air.
test('a slow probe still goes live, and says so', () => {
  const verdict = decideGoLive(probe({ probeMs: PROBE_SLOW_MS + 1 }));
  assert.equal(verdict.allowed, true, 'slow is NOT a refusal');
  assert.equal(verdict.slow, true);
  assert.equal(verdict.sentence, TRANSPORT_SLOW_SENTENCE);
});

test('an absurdly slow but working probe is still allowed', () => {
  const verdict = decideGoLive(probe({ probeMs: 30_000 }));
  assert.equal(verdict.allowed, true);
  assert.equal(verdict.refusal, null);
});

test('a probe at the threshold is not yet slow', () => {
  assert.equal(decideGoLive(probe({ probeMs: PROBE_SLOW_MS })).slow, false);
});

// The healthy figures S0 actually measured must all pass without a note. If a
// future edit lowers PROBE_SLOW_MS toward the mean, this is what fails.
test('every healthy latency S0 measured passes unremarked', () => {
  for (const probeMs of [19, 50.7, 151, 293]) {
    const verdict = decideGoLive(probe({ probeMs }));
    assert.equal(verdict.allowed, true, `${probeMs}ms must be allowed`);
    assert.equal(verdict.slow, false, `${probeMs}ms is ordinary, not slow`);
    assert.equal(verdict.sentence, '', `${probeMs}ms must not produce a note`);
  }
});

// ── THE PROBE IS ACTUALLY SENT ───────────────────────────────────────────────
// A guard that decides without ever invoking is the same shape of defect as the
// pipeline that encoded without ever sending.
test('guardGoLive really invokes encoder_probe, with a decodable chunk', async () => {
  const calls: Array<{ cmd: string; chunk: string }> = [];
  const verdict = await guardGoLive(async (cmd, args) => {
    calls.push({ cmd, chunk: (args?.chunk as string) ?? '' });
    return 'json:base64_ok';
  });
  assert.equal(calls.length, 1, 'exactly one probe, never zero and never per-frame');
  assert.equal(calls[0]?.cmd, 'encoder_probe');
  assert.equal(calls[0]?.chunk, chunkToBase64(buildProbeChunk()));
  assert.equal(verdict.allowed, true);
});

test('a probe whose invoke throws refuses rather than going live blind', async () => {
  const verdict = await guardGoLive(async () => {
    throw new Error('CSP blocked it');
  });
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.refusal, 'transport_unusable');
});

test("Rust reporting a field that did not decode refuses", async () => {
  const verdict = await guardGoLive(async () => 'json:base64_bad');
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.refusal, 'transport_unusable');
});
