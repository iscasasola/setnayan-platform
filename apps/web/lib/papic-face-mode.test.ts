import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveFaceMode,
  eventTypeForcesModeB,
  faceModeAllowsEmbedding,
  faceVectorForMode,
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

test('christening/debut are OFF BY DEFAULT, and honour an explicit setting', () => {
  // ⚠ REWRITTEN 2026-08-05. This asserted a FORCED mode_b for these two types.
  // The owner — who is also the DPO — ruled that face tagging applies to every
  // event type Setnayan offers, so the type no longer overrides the column.
  //
  // What replaces the block: the default, the deliberate act (the admin
  // confirmation names the risk in words — pinned in face-mode-switch.test.ts),
  // the per-guest 18+ attestation, the host's face_recognition_excluded flag,
  // and the couple's own decline. The guardian-consent workflow still does not
  // exist; that is unchanged and remains the reason to be careful here.
  for (const type of ['christening', 'debut'] as const) {
    assert.equal(resolveFaceMode(null, type), 'mode_b', `${type}: untouched stores nothing`);
    assert.equal(resolveFaceMode('mode_b', type), 'mode_b');
    assert.equal(resolveFaceMode('mode_a', type), 'mode_a', `${type}: an explicit choice holds`);
  }
});

test('the couple can still shut it off on a minor-heavy event', () => {
  // With the type-level block gone, this is now the STRONGEST remaining
  // override on these events, so it matters more than it did before.
  for (const type of ['christening', 'debut'] as const) {
    assert.equal(resolveFaceMode('mode_a', type, true), 'mode_b');
  }
});

// ── faceModeAllowsEmbedding ─────────────────────────────────────────────────
test('faceModeAllowsEmbedding only true for mode_a', () => {
  assert.equal(faceModeAllowsEmbedding('mode_a'), true);
  assert.equal(faceModeAllowsEmbedding('mode_b'), false);
});

// ── faceVectorForMode (server biometric write guard) ────────────────────────
// This is the exact guard both enrollment writes apply (submitRsvp in
// app/[slug]/actions.ts, enrollGuestFace in app/papic/face-enroll-actions.ts):
// the row's face_vector/vector_model are whatever THIS returns, so proving it
// here proves the persisted enrollment carries no descriptor off mode_a.
const MODEL = 'face-api/ssd-mobilenetv1+128d';
const PAYLOAD_VECTOR = [0.1, -0.2, 0.3];

test('mode_a stores the client descriptor + stamps the model', () => {
  const out = faceVectorForMode('mode_a', PAYLOAD_VECTOR, MODEL);
  assert.deepEqual(out.face_vector, PAYLOAD_VECTOR);
  assert.equal(out.vector_model, MODEL);
});

test('mode_b HARD-NULLS the descriptor even when the payload carries a vector', () => {
  // Simulates a crafted/replayed POST that ships selfie_vector on a mode_b event.
  const out = faceVectorForMode('mode_b', PAYLOAD_VECTOR, MODEL);
  assert.equal(out.face_vector, null);
  assert.equal(out.vector_model, null);
});

test('mode_a with no descriptor stays image-only (null vector, null model)', () => {
  assert.deepEqual(faceVectorForMode('mode_a', null, MODEL), {
    face_vector: null,
    vector_model: null,
  });
  assert.deepEqual(faceVectorForMode('mode_a', [], MODEL), {
    face_vector: null,
    vector_model: null,
  });
});

test('an untouched christening/debut stores NO vector even with a consented payload', () => {
  // A guest POSTs biometric_consent=1 + age_affirmation=1 + a real vector. On an
  // event nobody has deliberately enabled, the guard still drops it.
  // ⚠ REWRITTEN 2026-08-05: the premise moved from "the type forces mode_b" to
  // "the default is mode_b". The protection for an untouched event is identical;
  // what changed is that an admin can now choose otherwise, on the record.
  for (const type of ['christening', 'debut'] as const) {
    const effective = resolveFaceMode(null, type);
    assert.equal(effective, 'mode_b');
    const out = faceVectorForMode(effective, PAYLOAD_VECTOR, MODEL);
    assert.equal(out.face_vector, null, `${type}: vector must not persist`);
    assert.equal(out.vector_model, null, `${type}: model must not persist`);
  }
});

test('a couple’s decline drops the vector on a minor-heavy event too', () => {
  for (const type of ['christening', 'debut'] as const) {
    const effective = resolveFaceMode('mode_a', type, true);
    assert.equal(faceVectorForMode(effective, PAYLOAD_VECTOR, MODEL).face_vector, null);
  }
});

test('multi-shot enroll: every shot is nulled in mode_b (mirrors enrollGuestFace map)', () => {
  const shots = [
    { vector: [0.1, 0.2] },
    { vector: [0.3, 0.4] },
    { vector: [0.5, 0.6] },
  ];
  const rows = shots.map((s) => faceVectorForMode('mode_b', s.vector, MODEL));
  assert.ok(rows.every((r) => r.face_vector === null && r.vector_model === null));
  // …and all preserved in mode_a.
  const rowsA = shots.map((s) => faceVectorForMode('mode_a', s.vector, MODEL));
  assert.ok(rowsA.every((r) => Array.isArray(r.face_vector) && r.vector_model === MODEL));
});

test('async: a christening the couple declined stores nothing, whatever the admin set', async () => {
  // ⚠ REWRITTEN 2026-08-05 — was "a christening row saying mode_a still stores
  // nothing", which is no longer true and is no longer supposed to be. The
  // couple's decline is the override that survives, so it is what this pins.
  const client = fakeClient({
    data: {
      papic_face_mode: 'mode_a',
      event_type: 'christening',
      face_tagging_declined_by_couple: true,
    },
    error: null,
  });
  const mode = await resolvePapicFaceMode(client as never, 'evt-1');
  assert.equal(mode, 'mode_b');
  assert.equal(faceVectorForMode(mode, PAYLOAD_VECTOR, MODEL).face_vector, null);
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

test('async: a christening an admin deliberately enabled resolves to mode_a', async () => {
  const client = fakeClient({
    data: { papic_face_mode: 'mode_a', event_type: 'christening' },
    error: null,
  });
  assert.equal(await resolvePapicFaceMode(client as never, 'evt-1'), 'mode_a');
});

test('async: fail-closed still wins — a read error resolves to mode_b', async () => {
  // Unchanged by today's ruling, and the reason it is restated here: the type
  // no longer refuses, so the fallback carries more weight than it used to.
  assert.equal(await resolvePapicFaceMode(fakeClient('throw') as never, 'e'), 'mode_b');
  assert.equal(
    await resolvePapicFaceMode(fakeClient({ data: null, error: { message: 'x' } }) as never, 'e'),
    'mode_b',
  );
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
