/**
 * S3 · the tap: mono is duplicated, a dead input is silence — and the SHIPPED worklet agrees
 * with the typed one, sample for sample.
 *
 * Why the second half exists: `audioWorklet.addModule()` fetches a URL and evaluates it as a
 * module script, so nothing under `lib/` can be what the browser runs. The file the browser
 * runs is `public/encoder/audio-tap.worklet.js`, and a hand-kept copy is a drift waiting to
 * happen — the same argument `csp-embeds-are-allowed.test.ts` makes about the CSP list. So this
 * test loads the shipped JS with the worklet globals stubbed and holds it to the typed source.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TAP_CHANNELS, TAP_QUANTUM_FRAMES, packQuantum } from './audio-tap.worklet';

const SHIPPED = join(__dirname, '..', '..', 'public', 'encoder', 'audio-tap.worklet.js');

function ramp(seed: number, n = TAP_QUANTUM_FRAMES): Float32Array {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i += 1) a[i] = Math.sin((i + seed) * 0.017) * 0.5;
  return a;
}

test('a stereo quantum is copied through, planar', () => {
  const l = ramp(1);
  const r = ramp(500);
  const out = packQuantum([l, r]);
  assert.equal(out.length, TAP_CHANNELS * TAP_QUANTUM_FRAMES);
  assert.deepEqual(out.subarray(0, TAP_QUANTUM_FRAMES), l);
  assert.deepEqual(out.subarray(TAP_QUANTUM_FRAMES), r);
});

test('a MONO phone is duplicated to both channels, never left half-silent', () => {
  const m = ramp(7);
  const out = packQuantum([m]);
  assert.deepEqual(out.subarray(0, TAP_QUANTUM_FRAMES), m);
  assert.deepEqual(out.subarray(TAP_QUANTUM_FRAMES), m);
});

test('no input at all is a full quantum of silence — the clock must not stop', () => {
  for (const input of [undefined, [] as Float32Array[]]) {
    const out = packQuantum(input);
    assert.equal(out.length, TAP_CHANNELS * TAP_QUANTUM_FRAMES);
    assert.ok(out.every((v) => v === 0));
  }
});

test('a short channel buffer is zero-filled, not shifted', () => {
  const short = ramp(3, 40);
  const out = packQuantum([short, short]);
  assert.deepEqual(out.subarray(0, 40), short);
  assert.ok(out.subarray(40, TAP_QUANTUM_FRAMES).every((v) => v === 0));
});

test('the shipped worklet is registered as `setnayan-tap` and never returns false', () => {
  const src = readFileSync(SHIPPED, 'utf8');
  assert.match(src, /registerProcessor\('setnayan-tap'/);
  assert.doesNotMatch(src, /return false/);
  // The laptop mic is not an input anywhere in S3.
  assert.doesNotMatch(src, /getUserMedia/);
});

test('the shipped worklet packs identically to the typed source, sample for sample', async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.AudioWorkletProcessor = class {
    readonly port = { postMessage: () => {}, onmessage: null };
  };
  const registered: string[] = [];
  g.registerProcessor = (name: string) => registered.push(name);
  g.currentFrame = 0;

  const shipped = (await import(SHIPPED)) as { packQuantum: typeof packQuantum };
  assert.deepEqual(registered, ['setnayan-tap'], 'importing the module must register the processor');

  const cases: (Float32Array[] | undefined)[] = [
    [ramp(1), ramp(2)],
    [ramp(3)],
    [],
    undefined,
    [ramp(4, 40), ramp(5)],
    [ramp(6), ramp(7), ramp(8)],
  ];
  for (const [i, input] of cases.entries()) {
    assert.deepEqual(shipped.packQuantum(input), packQuantum(input), `case ${i} diverged`);
  }
});
