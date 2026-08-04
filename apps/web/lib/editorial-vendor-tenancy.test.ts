/**
 * SEC-1 lane #3 — `editorial-vendor/` is now TENANTED.
 *
 * This was the last item on the #3729 deferred list, and the only one a guard alone
 * could not fix: the uploader wrote to a FLAT `editorial-vendor/` prefix, so
 * `editorialVendorMediaPolicy()` could only prove *"this is in the media bucket
 * under the right prefix"* — never *"this belongs to this vendor."* The weakness was
 * in the KEY LAYOUT, so the fix had to be in the uploader.
 *
 * Why it matters: these refs are presigned onto the couple's **PUBLIC** editorial
 * site (`app/[slug]/…/editorial/data.ts`) and read server-side by
 * `lib/nsfw-screen.ts`. Two things had to become impossible, not one:
 *   • attaching ANOTHER vendor's media to this event, and
 *   • attaching your OWN media from a DIFFERENT couple's event.
 *
 * Migration-free by luck of timing: `editorial_vendor_media` had **0 rows** in prod
 * when this landed. Had there been flat-prefix rows, they needed backfilling FIRST —
 * a reader of an old flat key is now refused.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseClientRef, editorialVendorMediaPolicy } from './r2-client-ref';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...seg: string[]) => readFileSync(join(WEB, ...seg), 'utf8');

const VENDOR = 'aaaaaaaa-1111-2222-3333-444444444444';
const OTHER_VENDOR = 'bbbbbbbb-1111-2222-3333-444444444444';
const EVENT = 'cccccccc-5555-6666-7777-888888888888';
const OTHER_EVENT = 'dddddddd-5555-6666-7777-888888888888';
const ok = (key: string, v = VENDOR, e = EVENT) =>
  parseClientRef(`r2://setnayan-media/${key}`, editorialVendorMediaPolicy(v, e));

test("the vendor's own media for THIS event is accepted", () => {
  assert.ok(ok(`editorial-vendor/${VENDOR}/${EVENT}/still.jpg`));
  assert.ok(ok(`editorial-vendor/${VENDOR}/${EVENT}/clip.mp4`));
});

test("🔴 ANOTHER vendor's media is refused", () => {
  assert.equal(ok(`editorial-vendor/${OTHER_VENDOR}/${EVENT}/still.jpg`), null);
});

test("🔴 the vendor's OWN media from a DIFFERENT event is refused", () => {
  // The half that a flat prefix could never catch: same vendor, wrong couple. Their
  // editorial media for the Cruz wedding must not appear on the Santos wedding.
  assert.equal(ok(`editorial-vendor/${VENDOR}/${OTHER_EVENT}/still.jpg`), null);
});

test('the OLD flat-prefix layout is now refused — the migration precondition', () => {
  // Documents WHY 0 rows mattered: a legacy flat key no longer validates, so had
  // prod held any, this change would have orphaned them.
  assert.equal(ok('editorial-vendor/still.jpg'), null);
  assert.equal(ok(`editorial-vendor/${EVENT}/still.jpg`), null, 'event-only is not enough either');
});

test('private buckets stay unreachable, and traversal is refused', () => {
  const policy = editorialVendorMediaPolicy(VENDOR, EVENT);
  for (const ref of [
    `r2://setnayan-vendor-verification/editorial-vendor/${VENDOR}/${EVENT}/dti.pdf`,
    `r2://setnayan-thread-files/editorial-vendor/${VENDOR}/${EVENT}/x.png`,
    `r2://setnayan-media/editorial-vendor/${VENDOR}/${EVENT}/../${OTHER_EVENT}/x.jpg`,
  ]) {
    assert.equal(parseClientRef(ref, policy), null, `expected refusal: ${ref}`);
  }
});

test('the WIRING: uploader prefix and server policy agree exactly', () => {
  // A drift between these two is a BROKEN UPLOAD (the server refuses what the
  // client just wrote), so they are pinned together rather than separately.
  const studio = read(
    'app', 'vendor-dashboard', 'clients', '[eventId]', 'editorial-media',
    '_components', 'editorial-media-studio.tsx',
  );
  assert.match(
    studio,
    /const uploadPrefix = `editorial-vendor\/\$\{vendorProfileId\}\/\$\{eventId\}`;/,
    'the uploader must write under the tenanted prefix',
  );
  assert.equal(
    /pathPrefix: 'editorial-vendor'/.test(studio),
    false,
    'the flat prefix must be gone, not merely unused',
  );

  const action = read(
    'app', 'vendor-dashboard', 'clients', '[eventId]', 'editorial-media', 'actions.ts',
  );
  assert.match(
    action,
    /editorialVendorMediaPolicy\(profile\.vendor_profile_id, eventId\)/,
    'the write must pin against the SAME vendor+event pair',
  );
  // And it must be evaluated after the profile exists — an early call would have to
  // pass a placeholder, which is how a tenanted policy silently degrades.
  assert.ok(
    action.indexOf('const profile = await fetchOwnVendorProfile') <
      action.indexOf('editorialVendorMediaPolicy(profile.vendor_profile_id, eventId)'),
    'the policy must be built after the vendor is resolved',
  );
});
