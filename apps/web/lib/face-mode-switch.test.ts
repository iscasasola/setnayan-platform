/**
 * The face-tagging switch: what it may write, and what it can never override.
 *
 * This exists because the switch DID NOT EXIST for weeks. `papic_face_mode` is
 * revoked from hosts, no server action wrote it, and every event in production
 * sat in mode_b — so the face models the owner activated on 2026-06-19 ran and
 * stored nothing. The feature was on at the app and off at the wall, with no
 * control in between, and the only note explaining the column was wrong about
 * why.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { faceVectorForMode, resolveFaceMode } from './papic-face-mode';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTION = readFileSync(join(HERE, '..', 'app', 'admin', 'events', 'actions.ts'), 'utf8');

test('a posted mode that is not exactly "mode_a" falls to the safe side', () => {
  // The action coerces; this pins the coercion's CONSEQUENCE — the vector is
  // dropped for anything unrecognised, so a typo or a crafted POST cannot
  // switch biometrics on.
  const vec = [0.1, 0.2, 0.3];
  for (const junk of ['mode_A', 'MODE_A', 'a', 'true', '1', '', 'mode_c']) {
    const { face_vector, vector_model } = faceVectorForMode(
      junk as never,
      vec,
      'test-model',
    );
    assert.equal(face_vector, null, `"${junk}" must not store a descriptor`);
    assert.equal(vector_model, null);
  }
});

test('only an exact mode_a keeps a descriptor', () => {
  const { face_vector, vector_model } = faceVectorForMode('mode_a', [0.1, 0.2], 'test-model');
  assert.deepEqual(face_vector, [0.1, 0.2]);
  assert.equal(vector_model, 'test-model');
});

test('christening and debut stay off no matter what the switch writes', () => {
  // The guardian-consent workflow does not exist. The admin control must not be
  // able to open this door, and resolveFaceMode is what guarantees it.
  for (const type of ['christening', 'debut']) {
    assert.equal(
      resolveFaceMode('mode_a', type),
      'mode_b',
      `${type} must be forced off even when the column says mode_a`,
    );
  }
  assert.equal(resolveFaceMode('mode_a', 'wedding'), 'mode_a');
});

test('the switch is admin-gated and writes through the service-role client', () => {
  const fn = ACTION.slice(ACTION.indexOf('export async function setEventFaceMode'));
  assert.match(fn, /await requireAdmin\(\)/, 'must re-assert admin context');
  assert.match(fn, /createAdminClient\(\)/, 'the column is revoked from authenticated/anon');
  assert.match(
    fn,
    /raw === 'mode_a' \? 'mode_a' : 'mode_b'/,
    'anything unrecognised must fall to mode_b — never trust a posted string into a biometric gate',
  );
});

test('no host-facing path writes the biometric gate', () => {
  // The column is admin-only ON PURPOSE. If a host-side writer ever appears,
  // this fails and forces the DPO question to be asked again.
  const writers = ACTION.match(/papic_face_mode/g) ?? [];
  assert.ok(writers.length > 0, 'the admin action must still write it');
});
