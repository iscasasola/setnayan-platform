/**
 * THE FULL-RESOLUTION SWEEP DELETES ONLY THE CAPTURE'S OWN ORIGINAL.
 *
 * `runFullResDropSweep` is ON by default and runs with the admin client from the
 * admin layout's after() and from cron. It used to resolve each candidate's
 * `r2_object_key` against ALL FIVE buckets and delete it — so a couple who
 * PATCHed their own photo's key, or a supplier who inserted a capture naming a
 * stranger's object, had our job delete it once the event's clock ran out.
 *
 * Every candidate here is built THROUGH THE PRODUCTION MAPPERS the sweep uses,
 * from a raw row shaped like the sweep's SELECT returns it — a hand-built item
 * is how the clip wiring bug hid (see papic-fullres-drop-wiring.test.ts) — and
 * then handed to `planPapicOriginalDelete`, the one gate the sweep consults
 * between a stored key and `executeCleanupDelete`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  guestClipItem,
  guestPhotoItem,
  planPapicOriginalDelete,
  resolveOriginalRef,
  sameResolvedObject,
  seatClipItem,
  seatPhotoItem,
  vendorPhotoItem,
} from './papic-fullres-drop-core';

const EVT = 'e0000000-0000-4000-8000-000000000001';
const EVT_OTHER = 'e0000000-0000-4000-8000-000000000002';
const SEAT = '5ea70000-0000-4000-8000-000000000001';
const GUEST = '9e570000-0000-4000-8000-000000000001';
const VENDOR = 'fe000000-0000-4000-8000-000000000001';
const VICTIM = 'fe000000-0000-4000-8000-00000000dead';

/** Exactly what the review resolved to a deletable {bucket,key}. */
const VICTIM_GOV_ID = `r2://setnayan-vendor-verification/vendors/${VICTIM}/government_id/gov.png`;
const VICTIM_LOGO = `r2://setnayan-media/vendors/${VICTIM}/logo/logo.png`;
const OTHER_COUPLE = `r2://setnayan-media/papic/event-${EVT_OTHER}/seat-${SEAT}/x-papic-1.jpg`;
const ATTACKS = [VICTIM_GOV_ID, VICTIM_LOGO, OTHER_COUPLE, `vendors/${VICTIM}/logo/logo.png`];

const base = {
  captured_at: '2026-01-01T00:00:00Z',
  full_res_dropped_at: null,
  orig_bytes: 1000,
  preserved_at: null,
};

test('a seat photo: its own key is planned for delete; every attack is refused', () => {
  const own = seatPhotoItem({
    ...base,
    photo_id: 'p1',
    event_id: EVT,
    r2_object_key: `r2://setnayan-media/papic/event-${EVT}/seat-${SEAT}/u-papic-1.jpg`,
    display_r2_key: `r2://setnayan-media/derivatives/papic/event-${EVT}/seat-${SEAT}/u-papic-1.jpg.display.avif`,
  });
  const d = planPapicOriginalDelete(own);
  assert.equal(d.ok, true);
  if (d.ok) {
    assert.equal(d.target.bucket, 'setnayan-media');
    assert.equal(d.target.key, `papic/event-${EVT}/seat-${SEAT}/u-papic-1.jpg`);
  }
  for (const ref of ATTACKS) {
    const forged = seatPhotoItem({ ...base, photo_id: 'p2', event_id: EVT, r2_object_key: ref, display_r2_key: 'x' });
    assert.equal(planPapicOriginalDelete(forged).ok, false, `a couple's own row naming ${ref} was deletable`);
  }
});

test('a guest capture is pinned to ITS guest — the mapper carries guest_id, the gate reads it', () => {
  const row = {
    ...base,
    capture_id: 'c1',
    event_id: EVT,
    guest_id: GUEST,
    r2_object_key: `r2://setnayan-media/papic/guest/${GUEST}/papic-1.jpg`,
    display_r2_key: 'x',
  };
  assert.equal(planPapicOriginalDelete(guestPhotoItem(row)).ok, true);
  assert.equal(
    planPapicOriginalDelete(guestPhotoItem({ ...row, r2_object_key: `r2://setnayan-media/papic/guest/someone-else/papic-1.jpg` })).ok,
    false,
  );
  // A mapper that forgot guest_id would build a scope for nobody — and refuse
  // the guest's OWN capture. That is the fail-closed direction, and it is
  // asserted so a regression shows up as "stopped compressing", loudly.
  assert.equal(planPapicOriginalDelete(guestPhotoItem({ ...row, guest_id: null })).ok, false);
  for (const ref of ATTACKS) {
    assert.equal(planPapicOriginalDelete(guestPhotoItem({ ...row, r2_object_key: ref })).ok, false, ref);
  }
});

test('a supplier capture is pinned to supplier AND celebration', () => {
  const row = {
    ...base,
    capture_id: 'v1',
    event_id: EVT,
    vendor_profile_id: VENDOR,
    r2_object_key: `r2://setnayan-media/papic/vendor-${VENDOR}/event-${EVT}/cap-1.jpg`,
    display_r2_key: 'x',
  };
  assert.equal(planPapicOriginalDelete(vendorPhotoItem(row)).ok, true);
  for (const ref of [
    ...ATTACKS,
    `r2://setnayan-media/papic/vendor-${VENDOR}/event-${EVT_OTHER}/cap-1.jpg`,
    `r2://setnayan-media/papic/vendor-${VICTIM}/event-${EVT}/cap-1.jpg`,
  ]) {
    assert.equal(planPapicOriginalDelete(vendorPhotoItem({ ...row, r2_object_key: ref })).ok, false, ref);
  }
});

test('clip items go through the same gate', () => {
  const seat = seatClipItem({
    ...base,
    photo_id: 'k1',
    event_id: EVT,
    photo_type: 'clip',
    r2_object_key: VICTIM_GOV_ID,
    clip_web_r2_key: `r2://setnayan-media/papic/event-${EVT}/seat-${SEAT}/w.mp4`,
    clip_web_bytes: 5000,
  });
  assert.equal(planPapicOriginalDelete(seat).ok, false);
  const guest = guestClipItem({
    ...base,
    capture_id: 'k2',
    event_id: EVT,
    guest_id: GUEST,
    media_type: 'clip',
    r2_object_key: `r2://setnayan-media/papic/guest/${GUEST}/papic-1.mp4`,
    clip_web_r2_key: `r2://setnayan-media/papic/guest/${GUEST}/papic-2-web.mp4`,
    clip_web_bytes: 5000,
  });
  assert.equal(planPapicOriginalDelete(guest).ok, true);
});

test('resolveOriginalRef no longer resolves into a private bucket', () => {
  // The primitive the review exploited. It is now media-only — and it is not a
  // delete authorisation at all (the sweep reads it for the web-copy HEAD).
  assert.equal(resolveOriginalRef(VICTIM_GOV_ID), null);
  assert.equal(resolveOriginalRef('r2://setnayan-thread-files/chat/t/a.pdf'), null);
  assert.equal(resolveOriginalRef('r2://setnayan-vendor-contracts/paperwork/e/a.pdf'), null);
  assert.equal(resolveOriginalRef('r2://setnayan-samples/x.jpg'), null);
  assert.deepEqual(resolveOriginalRef('r2://setnayan-media/papic/x.jpg'), {
    bucket: 'setnayan-media',
    key: 'papic/x.jpg',
  });
  // …and the clip same-object check still fails closed on a private-bucket ref.
  assert.equal(sameResolvedObject(VICTIM_GOV_ID, 'r2://setnayan-media/papic/x.jpg'), true);
});
