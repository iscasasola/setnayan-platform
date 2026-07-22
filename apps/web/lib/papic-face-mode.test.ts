import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveFaceMode,
  eventTypeForcesModeB,
  faceModeAllowsEmbedding,
  resolvePapicFaceMode,
  FORCE_MODE_B_EVENT_TYPES,
  FACE_CONSENT_COPY_VERSION,
} from './papic-face-mode';

// ── eventTypeForcesModeB ────────────────────────────────────────────────────
test('christening + debut are forced to mode_b', () => {
  assert.equal(eventTypeForcesModeB('christening'), true);
  assert.equal(eventTypeForcesModeB('debut'), true);
  // The two are the documented minor-honoree set (spec §3.5).
  assert.deepEqual([...FORCE_MODE_B_EVENT_TYPES].sort(), ['christening', 'debut']);
});

test('non-minor event types are not forced', () => {
  for (const t of ['wedding', 'birthday', 'anniversary', 'corporate', '']) {
    assert.equal(eventTypeForcesModeB(t), false);
  }
  assert.equal(eventTypeForcesModeB(null), false);
  assert.equal(eventTypeForcesModeB(undefined), false);
});

// ── resolveFaceMode (fail-closed) ───────────────────────────────────────────
test('resolveFaceMode returns mode_a only for an explicit, non-forced mode_a', () => {
  assert.equal(resolveFaceMode('mode_a', 'wedding'), 'mode_a');
});

test('resolveFaceMode fails closed to mode_b on anything unexpected', () => {
  assert.equal(resolveFaceMode('mode_b', 'wedding'), 'mode_b');
  assert.equal(resolveFaceMode(null, 'wedding'), 'mode_b'); // pre-migration null
  assert.equal(resolveFaceMode(undefined, 'wedding'), 'mode_b');
  assert.equal(resolveFaceMode('', 'wedding'), 'mode_b');
  assert.equal(resolveFaceMode('garbage', 'wedding'), 'mode_b');
  assert.equal(resolveFaceMode('MODE_A', 'wedding'), 'mode_b'); // case-sensitive
});

test('resolveFaceMode forces mode_b for christening/debut even when stored mode_a', () => {
  assert.equal(resolveFaceMode('mode_a', 'christening'), 'mode_b');
  assert.equal(resolveFaceMode('mode_a', 'debut'), 'mode_b');
});

// ── faceModeAllowsEmbedding ─────────────────────────────────────────────────
test('faceModeAllowsEmbedding only true for mode_a', () => {
  assert.equal(faceModeAllowsEmbedding('mode_a'), true);
  assert.equal(faceModeAllowsEmbedding('mode_b'), false);
});

// ── resolvePapicFaceMode (async, injected client) ───────────────────────────
function fakeClient(
  result: { data: unknown; error: unknown } | 'throw',
): { from: () => unknown } {
  if (result === 'throw') {
    return {
      from: () => {
        throw new Error('boom');
      },
    };
  }
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => result,
  };
  return { from: () => builder };
}

test('resolvePapicFaceMode reads the row and resolves mode_a', async () => {
  const client = fakeClient({
    data: { papic_face_mode: 'mode_a', event_type: 'wedding' },
    error: null,
  });
  assert.equal(await resolvePapicFaceMode(client as never, 'evt-1'), 'mode_a');
});

test('resolvePapicFaceMode forces mode_b for christening even if row says mode_a', async () => {
  const client = fakeClient({
    data: { papic_face_mode: 'mode_a', event_type: 'christening' },
    error: null,
  });
  assert.equal(await resolvePapicFaceMode(client as never, 'evt-1'), 'mode_b');
});

test('resolvePapicFaceMode fails closed to mode_b on empty id, error, missing row, or throw', async () => {
  assert.equal(await resolvePapicFaceMode(fakeClient({ data: null, error: null }) as never, ''), 'mode_b');
  assert.equal(
    await resolvePapicFaceMode(fakeClient({ data: null, error: { message: 'x' } }) as never, 'evt-1'),
    'mode_b',
  );
  assert.equal(await resolvePapicFaceMode(fakeClient({ data: null, error: null }) as never, 'evt-1'), 'mode_b');
  assert.equal(await resolvePapicFaceMode(fakeClient('throw') as never, 'evt-1'), 'mode_b');
});

// ── consent copy version ────────────────────────────────────────────────────
test('a consent copy version is pinned (evidence for all enroll paths)', () => {
  assert.equal(typeof FACE_CONSENT_COPY_VERSION, 'string');
  assert.ok(FACE_CONSENT_COPY_VERSION.length > 0);
});
