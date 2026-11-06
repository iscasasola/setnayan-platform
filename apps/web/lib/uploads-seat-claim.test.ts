import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadsClaimAnswer, uploadsClaimStep, uploadsClaimWords, type UploadsClaimCode } from './uploads-seat-claim';

test('no camera row is "not ready", a refused read is "couldn’t open" — never the same sentence', () => {
  assert.deepEqual(uploadsClaimStep(null, false), { refuse: 'no_camera' });
  assert.deepEqual(uploadsClaimStep({ claim_qr_token: null }, false), { refuse: 'no_camera' });
  assert.deepEqual(uploadsClaimStep(null, true), { refuse: 'unavailable' });
  assert.deepEqual(uploadsClaimStep({ claim_qr_token: 'tok' }, false), { claim: 'tok' });
});

test('"claimed" is both "yours now" and "already yours" — a second press is a no-op, not a refusal', () => {
  assert.deepEqual(uploadsClaimAnswer('claimed'), { ok: true });
  assert.deepEqual(uploadsClaimAnswer('taken'), { refuse: 'taken' });
  assert.deepEqual(uploadsClaimAnswer('unauthenticated'), { refuse: 'signed_out' });
  assert.deepEqual(uploadsClaimAnswer('invalid'), { refuse: 'no_camera' });
  assert.deepEqual(uploadsClaimAnswer(undefined), { refuse: 'claim_failed' });
});

test('every refusal says nothing was uploaded, and none promises a retry for a missing camera', () => {
  const codes: UploadsClaimCode[] = ['signed_out', 'not_host', 'unavailable', 'no_camera', 'taken', 'full', 'claim_failed'];
  for (const c of codes) {
    const w = uploadsClaimWords(c);
    assert.ok(w.length > 20, `${c} has no words`);
    assert.match(w, /[Nn]othing was uploaded/, `${c} does not say nothing was uploaded`);
  }
  // 👥 Every host has their own camera (owner 2026-10-31): no refusal sends a host to "the other host's account".
  for (const c of codes) assert.doesNotMatch(uploadsClaimWords(c), /other host’s account/, `${c} sends a host to somebody else's account`);
  assert.doesNotMatch(uploadsClaimWords('no_camera'), /could not be turned on/, 'the old dead-end sentence is back');
});
