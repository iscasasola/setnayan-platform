import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrubFaceVectorsFromEvent } from './observability-scrub';

const REDACTED = '[redacted:face_vector]';

/** A realistic 128-d dlib descriptor. */
function descriptor(): number[] {
  return Array.from({ length: 128 }, (_, i) => (i % 7) * 0.013 - 0.5);
}

test('redacts a face vector under a named key (structured request body)', () => {
  const event = { request: { data: { faceVectors: [descriptor(), descriptor()], caption: 'hi' } } };
  const out = scrubFaceVectorsFromEvent(event) as typeof event;
  assert.equal((out.request.data as Record<string, unknown>).faceVectors, REDACTED);
  // Non-vector siblings survive.
  assert.equal((out.request.data as Record<string, unknown>).caption, 'hi');
});

test('redacts every face/selfie vector key variant', () => {
  const event = {
    a: { face_vector: descriptor() },
    b: { selfie_vector: descriptor() },
    c: { selfie_vectors: [descriptor()] },
    d: { faceVector: descriptor() },
    e: { face_descriptor: descriptor() },
    f: { face_embedding: descriptor() },
  };
  const out = scrubFaceVectorsFromEvent(event) as typeof event;
  assert.equal(out.a.face_vector, REDACTED);
  assert.equal(out.b.selfie_vector, REDACTED);
  assert.equal(out.c.selfie_vectors, REDACTED);
  assert.equal(out.d.faceVector, REDACTED);
  assert.equal(out.e.face_descriptor, REDACTED);
  assert.equal(out.f.face_embedding, REDACTED);
});

test('redacts a positional descriptor array (server-action args) even without a naming key', () => {
  // Mirrors autoTagSeatCapture(token, photoId, number[][]) captured as args.
  const event = { extra: { args: ['seat-token', 'photo-id', [descriptor(), descriptor()]] } };
  const out = scrubFaceVectorsFromEvent(event) as typeof event;
  const args = out.extra.args as unknown[];
  assert.equal(args[0], 'seat-token'); // non-vector args survive
  assert.equal(args[1], 'photo-id');
  assert.equal(args[2], REDACTED); // the number[][] is redacted wholesale
});

test('redacts a bare number[] descriptor nested anywhere', () => {
  const event = { breadcrumbs: [{ data: { vec: descriptor() } }] };
  const out = scrubFaceVectorsFromEvent(event) as typeof event;
  assert.equal((out.breadcrumbs[0]!.data as Record<string, unknown>).vec, REDACTED);
});

test('leaves short numeric arrays and ordinary payloads untouched', () => {
  const event = {
    message: 'Upload failed',
    tags: { route: '/api/papic/guest-capture', status: 500 },
    shortNumbers: [1, 2, 3, 4, 5],
    counts: Array.from({ length: 10 }, (_, i) => i),
  };
  const out = scrubFaceVectorsFromEvent(event) as typeof event;
  assert.equal(out.message, 'Upload failed');
  assert.equal(out.tags.route, '/api/papic/guest-capture');
  assert.deepEqual(out.shortNumbers, [1, 2, 3, 4, 5]);
  assert.deepEqual(out.counts, Array.from({ length: 10 }, (_, i) => i));
});

test('is cycle-safe (does not throw on self-referential payloads)', () => {
  const cyclic: Record<string, unknown> = { a: 1 };
  cyclic.self = cyclic;
  assert.doesNotThrow(() => scrubFaceVectorsFromEvent(cyclic));
});

test('null/primitive events pass through unchanged', () => {
  assert.equal(scrubFaceVectorsFromEvent(null), null);
  assert.equal(scrubFaceVectorsFromEvent('err'), 'err');
});
