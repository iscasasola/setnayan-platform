/**
 * 🔴 The RSVP selfie ref was unpinned — a half-wired fix, not a missing one.
 *
 * `guestSelfiePolicy(eventId, guestId)` was written by #3729 for exactly this flow
 * and was already applied in `app/papic/face-enroll-actions.ts`. It was NEVER
 * applied on the RSVP path (`app/[slug]/actions.ts`), which writes the SAME column
 * read by the SAME renderers. One writer guarded, one not.
 *
 * Why it mattered: that write uses the ADMIN client, so RLS cannot help, and
 * `guests.photo_url` is resolved through `displayUrlForStoredAsset` on at least
 * five surfaces (guest list · seating · seating lab · 3D plan · guest avatar). A
 * crafted RSVP post could therefore store a PRIVATE-bucket key as a guest avatar
 * and have it signed for the couple. The consent/age booleans gating the write are
 * themselves client-supplied, so they were no obstacle.
 *
 * The lesson this encodes: **a policy with only some of its writers wired is a
 * paper record.** Same shape as the `face_enrollment` control that "had ZERO
 * runtime callers" until #3729 wired it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseClientRef, guestSelfiePolicy } from './r2-client-ref';
import { stripComments } from './strip-comments';

const EVENT = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const OTHER_EVENT = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const GUEST = '11111111-2222-3333-4444-555555555555';
const OTHER_GUEST = '99999999-8888-7777-6666-555555555555';

test('the guest keeps their own selfie', () => {
  assert.ok(
    parseClientRef(
      `r2://setnayan-media/events/${EVENT}/guest-selfies/${GUEST}/abc.jpg`,
      guestSelfiePolicy(EVENT, GUEST),
    ),
  );
});

test("🔴 a PRIVATE-bucket key cannot become a guest's avatar", () => {
  // The exposure: stored via the admin client, then signed onto the couple's guest
  // list / seating chart.
  for (const ref of [
    `r2://setnayan-vendor-verification/vendors/X/verification/dti.pdf`,
    `r2://setnayan-thread-files/payments/ORDER/screenshot.png`,
    `r2://setnayan-vendor-contracts/paperwork/${EVENT}/psa_birth/scan.pdf`,
  ]) {
    assert.equal(
      parseClientRef(ref, guestSelfiePolicy(EVENT, GUEST)),
      null,
      `${ref} must never be storable as a guest photo`,
    );
  }
});

test("another guest's selfie, and another event's, are both refused", () => {
  const policy = guestSelfiePolicy(EVENT, GUEST);
  assert.equal(
    parseClientRef(`r2://setnayan-media/events/${EVENT}/guest-selfies/${OTHER_GUEST}/x.jpg`, policy),
    null,
    'a guest must not be able to claim another guest\'s selfie as their own',
  );
  assert.equal(
    parseClientRef(`r2://setnayan-media/events/${OTHER_EVENT}/guest-selfies/${GUEST}/x.jpg`, policy),
    null,
    'nor reach across events',
  );
});

test('the WIRING: the RSVP path takes NO selfie ref at all (owner 2026-09-30)', () => {
  // The strongest pin is no ref: since the question moved to the RSVP and the
  // selfie to the day, submitRsvp strips every selfie field before it reads the
  // form and writes neither `asset_url` nor a selfie avatar. The day-of writer
  // (face-enroll-actions.ts) keeps its own `guestSelfiePolicy` pin.
  const src = stripComments(readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'app', '[slug]', 'actions.ts'),
    'utf8',
  ));
  assert.match(src, /stripInviteFaceFields\(formData\);/, 'submitRsvp no longer strips the selfie fields');
  assert.doesNotMatch(src, /asset_url: selfie|photo_url: selfie|photo_source: 'selfie'/, 'the RSVP path writes a selfie ref again');
  const day = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'papic', 'face-enroll-actions.ts'),
    'utf8',
  );
  assert.match(day, /parseClientRef\(selfieRef, guestSelfiePolicy\(eventId, guestId\)\)/, 'the day-of writer lost its ref pin');
});
