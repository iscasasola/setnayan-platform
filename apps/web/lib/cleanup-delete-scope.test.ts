/**
 * THE ONE QUESTION EVERY CLEANUP DELETE ASKS — proved by calling it.
 *
 * Every assertion here runs the real `planCleanupDelete` against a ref shaped
 * exactly like one a real writer produces, and against the attacks the
 * 2026-09-10 review executed: a foreign tenant in the same bucket, a private
 * bucket, prefix confusion, traversal, a legacy URL, and a scope or a planned
 * target forged by hand.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CleanupDeleteRefused,
  chatAttachmentScope,
  eventSiteMediaScope,
  guestSelfieScope,
  isPlannedDelete,
  paperworkScope,
  papicGuestCaptureScope,
  papicSeatCaptureScope,
  papicVendorCaptureScope,
  planCleanupDelete,
  profilePhotoScope,
  refBelongsToRow,
  samahanStoryScope,
  stdSealedScope,
  vendorIdentityUploadScope,
  vendorLogoScope,
  vendorVerificationRecordScope,
  type CleanupScope,
} from './cleanup-delete-scope';

const EVT = '11111111-1111-4111-8111-111111111111';
const EVT_OTHER = '22222222-2222-4222-8222-222222222222';
const SEAT = '33333333-3333-4333-8333-333333333333';
const GUEST = '44444444-4444-4444-8444-444444444444';
const VENDOR = '55555555-5555-4555-8555-555555555555';
const VICTIM_VENDOR = '66666666-6666-4666-8666-666666666666';
const THREAD = '77777777-7777-4777-8777-777777777777';
const COMMUNITY = '88888888-8888-4888-8888-888888888888';
const USER = '99999999-9999-4999-8999-999999999999';

/** The refs the review actually fired at the sweeps. */
const VICTIM_GOV_ID = `r2://setnayan-vendor-verification/vendors/${VICTIM_VENDOR}/government_id/gov.png`;
const VICTIM_DTI = `r2://setnayan-vendor-verification/vendors/${VICTIM_VENDOR}/verification/dti.pdf`;
const VICTIM_LOGO = `r2://setnayan-media/vendors/${VICTIM_VENDOR}/logo/logo.png`;
const OTHER_COUPLES_PHOTO = `r2://setnayan-media/papic/event-${EVT_OTHER}/seat-${SEAT}/a-papic-1.jpg`;

const ATTACKS = [VICTIM_GOV_ID, VICTIM_DTI, VICTIM_LOGO, OTHER_COUPLES_PHOTO];

test('papic_photos: the seat branch’s own key, its derivatives and a bare legacy key are the row’s own', () => {
  const scope = papicSeatCaptureScope(EVT);
  for (const ok of [
    `r2://setnayan-media/papic/event-${EVT}/seat-${SEAT}/uuid-papic-1786338115745.jpg`,
    `r2://setnayan-media/derivatives/papic/event-${EVT}/seat-${SEAT}/uuid-papic-1.jpg.display.avif`,
    `papic/event-${EVT}/seat-${SEAT}/uuid-papic-1.jpg`,
  ]) {
    const d = planCleanupDelete(ok, scope);
    assert.equal(d.ok, true, `${ok} should be deletable for its own event`);
    if (d.ok) assert.equal(d.target.bucket, 'setnayan-media');
  }
});

test('papic_photos: every attack the review executed is REFUSED', () => {
  const scope = papicSeatCaptureScope(EVT);
  for (const ref of ATTACKS) {
    const d = planCleanupDelete(ref, scope);
    assert.equal(d.ok, false, `${ref} must not be deletable as event ${EVT}'s photo`);
    if (!d.ok) assert.equal(d.reason, 'out_of_scope');
  }
  // …including the same victim ref written as a BARE key, which the old
  // resolver read as the media bucket.
  assert.equal(refBelongsToRow(`vendors/${VICTIM_VENDOR}/logo/logo.png`, scope), false);
  // …and a private bucket named with the right-looking folder.
  assert.equal(
    refBelongsToRow(`r2://setnayan-vendor-verification/papic/event-${EVT}/x.jpg`, scope),
    false,
  );
});

test('prefix confusion: event-1 is not event-12 — the trailing slash is load-bearing', () => {
  const scope = papicSeatCaptureScope('evt-1');
  assert.equal(refBelongsToRow('r2://setnayan-media/papic/event-evt-1/seat-a/x.jpg', scope), true);
  assert.equal(refBelongsToRow('r2://setnayan-media/papic/event-evt-12/seat-a/x.jpg', scope), false);
  assert.equal(refBelongsToRow('r2://setnayan-media/papic/event-evt-1', scope), false);
  assert.equal(refBelongsToRow('r2://setnayan-media/papic/event-evt-1/', scope), false, 'a folder names no object');
});

test('traversal and hostile keys are refused even under the right prefix', () => {
  const scope = papicSeatCaptureScope(EVT);
  for (const ref of [
    `r2://setnayan-media/papic/event-${EVT}/../../vendors/${VICTIM_VENDOR}/logo/logo.png`,
    `r2://setnayan-media/papic/event-${EVT}/./x.jpg`,
    `r2://setnayan-media/papic/event-${EVT}/x\u0000.jpg`,
    `r2://setnayan-media/papic/event-${EVT}/x\n.jpg`,
    `papic/event-${EVT}/../x.jpg`,
  ]) {
    assert.equal(refBelongsToRow(ref, scope), false, JSON.stringify(ref));
  }
});

test('a legacy URL is never a cleanup target — its tenancy cannot be proven', () => {
  for (const scope of [papicSeatCaptureScope(EVT), eventSiteMediaScope(EVT), profilePhotoScope(USER)]) {
    for (const ref of [
      `https://media.setnayan.com/papic/event-${EVT}/seat-${SEAT}/x.jpg`,
      `https://abc.supabase.co/storage/v1/object/public/media/events/${EVT}/x.jpg`,
      `/papic/event-${EVT}/x.jpg`,
    ]) {
      assert.equal(refBelongsToRow(ref, scope), false, `${scope.label} obeyed ${ref}`);
    }
  }
});

test('bare keys are honoured ONLY by the Papic scopes', () => {
  assert.equal(refBelongsToRow(`events/${EVT}/site-music/a.mp3`, eventSiteMediaScope(EVT)), false);
  assert.equal(
    refBelongsToRow(`r2://setnayan-media/events/${EVT}/site-music/a.mp3`, eventSiteMediaScope(EVT)),
    true,
  );
});

test('guest captures are pinned to the guest; supplier captures to supplier AND event', () => {
  const g = papicGuestCaptureScope(GUEST);
  assert.equal(refBelongsToRow(`r2://setnayan-media/papic/guest/${GUEST}/papic-1.jpg`, g), true);
  assert.equal(refBelongsToRow(`r2://setnayan-media/papic/guest/${GUEST}-x/papic-1.jpg`, g), false);
  assert.equal(refBelongsToRow(`r2://setnayan-media/papic/guest/other/papic-1.jpg`, g), false);

  const v = papicVendorCaptureScope(VENDOR, EVT);
  assert.equal(refBelongsToRow(`r2://setnayan-media/papic/vendor-${VENDOR}/event-${EVT}/cap-1.jpg`, v), true);
  assert.equal(refBelongsToRow(`r2://setnayan-media/papic/vendor-${VENDOR}/event-${EVT}/cap-1-poster.jpg`, v), true);
  assert.equal(
    refBelongsToRow(`r2://setnayan-media/papic/vendor-${VENDOR}/event-${EVT_OTHER}/cap-1.jpg`, v),
    false,
    'the same supplier at a DIFFERENT celebration is a different tenant',
  );
  assert.equal(
    refBelongsToRow(`r2://setnayan-media/papic/vendor-${VICTIM_VENDOR}/event-${EVT}/cap-1.jpg`, v),
    false,
  );
});

test('vendor identity uploads: own verification folder OR own media folder — never another shop', () => {
  const s = vendorIdentityUploadScope(VENDOR);
  assert.equal(
    refBelongsToRow(`r2://setnayan-vendor-verification/vendors/${VENDOR}/verification/gov.png`, s),
    true,
  );
  assert.equal(refBelongsToRow(`r2://setnayan-media/vendors/${VENDOR}/portfolio/p1.jpg`, s), true,
    'the intake accepts a slot in the public media bucket — refusing it would strand a real document');
  for (const ref of [VICTIM_DTI, VICTIM_LOGO, VICTIM_GOV_ID]) {
    assert.equal(refBelongsToRow(ref, s), false, ref);
  }
  // The media folder does not unlock the private bucket outside /verification/.
  assert.equal(
    refBelongsToRow(`r2://setnayan-vendor-verification/vendors/${VENDOR}/other/gov.png`, s),
    false,
  );
});

test('vendor_verifications columns: the private bucket AND the vendor’s own folder', () => {
  const s = vendorVerificationRecordScope(VENDOR);
  assert.equal(refBelongsToRow(`r2://setnayan-vendor-verification/vendors/${VENDOR}/id.jpg`, s), true);
  assert.equal(refBelongsToRow(`r2://setnayan-media/vendors/${VENDOR}/id.jpg`, s), false);
  assert.equal(refBelongsToRow(VICTIM_GOV_ID, s), false);
});

test('the remaining scopes each admit their own writer’s shape and nothing next door', () => {
  const cases: Array<[CleanupScope, string, string]> = [
    [eventSiteMediaScope(EVT), `r2://setnayan-media/events/${EVT}/pakanta-song/s.mp3`, `r2://setnayan-media/events/${EVT_OTHER}/pakanta-song/s.mp3`],
    [guestSelfieScope(EVT, GUEST), `r2://setnayan-media/events/${EVT}/guest-selfies/${GUEST}/s.jpg`, `r2://setnayan-media/events/${EVT}/guest-selfies/other/s.jpg`],
    [samahanStoryScope(COMMUNITY), `r2://setnayan-media/samahan/${COMMUNITY}/story-1.mp4`, `r2://setnayan-media/samahan/other/story-1.mp4`],
    [stdSealedScope(EVT), `r2://setnayan-media/events/${EVT}/std-screened/v.mp4`, `r2://setnayan-media/events/${EVT}/std-video/v.mp4`],
    [paperworkScope(EVT), `r2://setnayan-vendor-contracts/paperwork/${EVT}/psa/scan.pdf`, `r2://setnayan-vendor-contracts/paperwork/${EVT_OTHER}/psa/scan.pdf`],
    [chatAttachmentScope(THREAD), `r2://setnayan-thread-files/chat/${THREAD}/a.pdf`, `r2://setnayan-thread-files/payments/${THREAD}/a.pdf`],
    [profilePhotoScope(USER), `r2://setnayan-media/profile-photo/${USER}/p.png`, `r2://setnayan-media/profile-photo/other/p.png`],
    [vendorLogoScope(VENDOR), `r2://setnayan-media/vendors/${VENDOR}/logo/l.png`, VICTIM_LOGO],
  ];
  for (const [scope, own, foreign] of cases) {
    assert.equal(refBelongsToRow(own, scope), true, `${scope.label} refused its own ${own}`);
    assert.equal(refBelongsToRow(foreign, scope), false, `${scope.label} admitted ${foreign}`);
    for (const attack of ATTACKS) {
      assert.equal(refBelongsToRow(attack, scope), false, `${scope.label} admitted ${attack}`);
    }
  }
});

test('an unusable tenant id yields a scope that admits NOTHING — never a wider one', () => {
  for (const bad of [null, undefined, '', '   ', '../x', 'a/b', '.', 42, {}]) {
    const scope = papicSeatCaptureScope(bad);
    assert.equal(scope.policies.length, 0, `${JSON.stringify(bad)} built a live scope`);
    assert.equal(refBelongsToRow(`r2://setnayan-media/papic/event-${String(bad)}/x.jpg`, scope), false);
    assert.equal(refBelongsToRow('r2://setnayan-media/papic/event-/x.jpg', scope), false);
  }
  assert.equal(papicVendorCaptureScope(VENDOR, null).policies.length, 0);
  assert.equal(guestSelfieScope(null, GUEST).policies.length, 0);
});

test('A HAND-BUILT SCOPE IS REFUSED AT RUNTIME, not just by the type checker', () => {
  // The whole point: nobody hands the planner a wider rule than the row earns.
  const forged = {
    label: 'forged',
    policies: [{ bucket: 'setnayan-vendor-verification', prefixes: ['vendors/'] }],
    bareKeysIn: null,
  } as unknown as CleanupScope;
  const d = planCleanupDelete(VICTIM_GOV_ID, forged);
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.reason, 'invalid_scope');

  // A SPREAD COPY of a real scope with a wider policy list — the shape that a
  // property-borne brand would have let through, because object spread copies
  // own symbol keys. Identity is the proof, so the copy is refused.
  const real = papicSeatCaptureScope(EVT);
  const widened = { ...real, policies: [{ prefixes: ['vendors/'] }] } as unknown as CleanupScope;
  const w = planCleanupDelete(VICTIM_LOGO, widened);
  assert.equal(w.ok, false, 'a widened copy of a real scope was obeyed');
  if (!w.ok) assert.equal(w.reason, 'invalid_scope');
  assert.equal(Object.isFrozen(real), true, 'a minted scope is frozen');
  assert.throws(() => {
    (real.policies as unknown as unknown[]).push({ prefixes: ['vendors/'] });
  }, 'a minted scope’s policy list is frozen');
});

test('only the planner can mint a delete target', () => {
  const d = planCleanupDelete(`r2://setnayan-media/events/${EVT}/site-music/a.mp3`, eventSiteMediaScope(EVT));
  assert.equal(d.ok, true);
  if (d.ok) assert.equal(isPlannedDelete(d.target), true);
  assert.equal(isPlannedDelete({ bucket: 'setnayan-media', key: 'vendors/x/logo.png', scope: 'forged' }), false);
  if (d.ok) assert.equal(isPlannedDelete({ ...d.target, key: 'vendors/x/logo.png' }), false, 'a spread copy is not a plan');
  assert.equal(isPlannedDelete(null), false);
});

test('empty and non-string refs are refused as empty, never crash a sweep', () => {
  const scope = eventSiteMediaScope(EVT);
  for (const v of [null, undefined, '', '   ', 7, {}]) {
    const d = planCleanupDelete(v, scope);
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.reason, 'empty');
  }
});

test('the refusal error carries no storage key', () => {
  const err = new CleanupDeleteRefused('papic_photos:x', 'out_of_scope');
  assert.equal(err.message.includes('r2://'), false);
  assert.match(err.message, /papic_photos:x/);
});
