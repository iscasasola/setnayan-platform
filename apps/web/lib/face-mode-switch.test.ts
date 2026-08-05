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
import {
  eventTypeNeedsDeliberateFaceOptIn,
  faceVectorForMode,
  resolveFaceMode,
} from './papic-face-mode';

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

test('every event type we offer honours the admin’s choice', () => {
  // ⚠ CHANGED 2026-08-05. This test asserted the opposite until today:
  // christening and debut were forced off regardless of the column. The owner
  // (also the DPO) ruled that face tagging applies to every event type we
  // offer, so the switch works everywhere — what protects a minor-heavy room is
  // now the deliberate act plus the per-guest flags, not a blanket refusal.
  for (const type of ['wedding', 'birthday', 'christening', 'debut', 'graduation']) {
    assert.equal(resolveFaceMode('mode_a', type), 'mode_a', `${type} must honour mode_a`);
    assert.equal(resolveFaceMode('mode_b', type), 'mode_b', `${type} must honour mode_b`);
  }
});

test('a minor-heavy type is still OFF until someone deliberately turns it on', () => {
  // The default is what carries the protection now. An event nobody has touched
  // stores no descriptors, on every type.
  for (const type of ['christening', 'debut']) {
    assert.equal(resolveFaceMode(null, type), 'mode_b');
    assert.equal(resolveFaceMode(undefined, type), 'mode_b');
  }
  assert.equal(eventTypeNeedsDeliberateFaceOptIn('christening'), true);
  assert.equal(eventTypeNeedsDeliberateFaceOptIn('debut'), true);
  assert.equal(eventTypeNeedsDeliberateFaceOptIn('wedding'), false);
});

test('THE WARNING IS THE PROTECTION NOW — the confirmation must name the risk', () => {
  // With the hard block gone, the only thing between a DPO and switching face
  // tagging on at a room full of children is what the confirmation says. If
  // that text is ever softened to the generic one, the safeguard is gone and
  // nothing else would notice.
  const surface = readFileSync(
    join(HERE, '..', 'app', 'admin', 'accounts', '_surfaces', 'events-surface.tsx'),
    'utf8',
  );
  assert.match(surface, /MINOR_HEAVY\.has\(e\.event_type/, 'the confirm must branch on the type');
  assert.match(surface, /CHILDREN/, 'and say so plainly');
  assert.match(
    surface,
    /guardian-consent workflow does not exist/,
    'and state that the workflow protecting them is still missing',
  );
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
