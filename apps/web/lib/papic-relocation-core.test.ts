/**
 * Unit suite for the Papic sampler→permanent prefix relocation (pure core).
 * The rule: replace the `papic-sampler/` path segment with `papic/` in a stored
 * `r2://bucket/key` ref — uniformly across the direct tree AND the derivative
 * tree — idempotently (a permanent / legacy / null value is a no-op).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relocateRef, isEphemeralKey } from './papic-relocation-core';

const B = 'setnayan-media';

test('relocates an ephemeral original to the permanent prefix', () => {
  const r = relocateRef(`r2://${B}/papic-sampler/event-abc/seat-12/uuid.jpg`);
  assert.deepEqual(r, {
    bucket: B,
    fromKey: 'papic-sampler/event-abc/seat-12/uuid.jpg',
    toKey: 'papic/event-abc/seat-12/uuid.jpg',
    toRef: `r2://${B}/papic/event-abc/seat-12/uuid.jpg`,
  });
});

test('relocates a derivative under derivatives/papic-sampler/ too', () => {
  const r = relocateRef(`r2://${B}/derivatives/papic-sampler/event-abc/seat-12/uuid.jpg.display.jpg`);
  assert.ok(r);
  assert.equal(r!.toKey, 'derivatives/papic/event-abc/seat-12/uuid.jpg.display.jpg');
  assert.equal(r!.toRef, `r2://${B}/derivatives/papic/event-abc/seat-12/uuid.jpg.display.jpg`);
});

test('idempotent: an already-permanent ref is a no-op', () => {
  assert.equal(relocateRef(`r2://${B}/papic/event-abc/seat-12/uuid.jpg`), null);
  assert.equal(relocateRef(`r2://${B}/derivatives/papic/event-abc/seat-12/uuid.jpg.thumb.jpg`), null);
});

test('null / empty / legacy (non-r2://) values are no-ops', () => {
  assert.equal(relocateRef(null), null);
  assert.equal(relocateRef(undefined), null);
  assert.equal(relocateRef(''), null);
  assert.equal(relocateRef('https://media.setnayan.com/papic-sampler/x.jpg'), null);
});

test('only matches papic-sampler/ as a whole path segment', () => {
  // A token that merely contains the substring but is not a path segment is left alone.
  assert.equal(relocateRef(`r2://${B}/notpapic-sampler/x.jpg`), null);
  // Real segment at start of the key still matches.
  assert.ok(relocateRef(`r2://${B}/papic-sampler/x.jpg`));
});

test('replaces only the sampler segment, once, preserving the rest of the key', () => {
  const r = relocateRef(`r2://${B}/papic-sampler/event-1/seat-2/a-b-c.jpg`);
  assert.equal(r!.toKey, 'papic/event-1/seat-2/a-b-c.jpg');
});

test('malformed ref (no key after bucket) is a no-op', () => {
  assert.equal(relocateRef('r2://setnayan-media'), null);
  assert.equal(relocateRef('r2:///papic-sampler/x.jpg'), null);
});

test('isEphemeralKey flags only keys under the sampler segment', () => {
  assert.equal(isEphemeralKey('papic-sampler/event-1/x.jpg'), true);
  assert.equal(isEphemeralKey('derivatives/papic-sampler/event-1/x.jpg'), true);
  assert.equal(isEphemeralKey('papic/event-1/x.jpg'), false);
  assert.equal(isEphemeralKey(null), false);
  assert.equal(isEphemeralKey(''), false);
});

test('isEphemeralKey works on full r2:// refs (the derivative-guard call shape)', () => {
  // The persistDerivativeRefs guard passes a stored ref, not a bare key.
  assert.equal(isEphemeralKey('r2://setnayan-media/papic-sampler/e/s/u.jpg'), true);
  assert.equal(isEphemeralKey('r2://setnayan-media/derivatives/papic-sampler/e/s/u.jpg.display.jpg'), true);
  assert.equal(isEphemeralKey('r2://setnayan-media/papic/e/s/u.jpg'), false);
  assert.equal(isEphemeralKey('r2://setnayan-media/derivatives/papic/e/s/u.jpg.thumb.jpg'), false);
});
