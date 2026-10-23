/**
 * GUARD — PAPIC IS THE CAMERA; MEMORIES HOLDS THE FILES (owner 2026-10-23, verbatim: *"Papic is the camera service.
 * Gallery is the collection of the files for that event. Papic holds: Filter, Credits per guest, face tagging, face
 * blocking, challenge. Gallery holds: follow moments in order, photowall, thank you, guest see photos, google drive,
 * keep full res"* · *"the how guests get in will be on event settings"*; approved
 * `prototypes/papic_controller_one_page_2026-10-23.html`).
 *
 *   1. The Papic page draws the one line (the `papic_on` switch + the dates), the credits band and his five — and
 *      none of the files: no gallery, no photo wall, no "guests see all", no Drive, no Keep full-res, no moderation
 *      door, no "ways in" rows.
 *   2. Memories › ⚙ Gallery settings draws the five that moved — the shipped controls, not copies.
 *   3. "How guests get in" (Event Details) carries the one code under its ONE row; a supplier's row in Event access
 *      carries its whole-delivery switch; Guests' third segment says "Settings".
 *
 * Sabotage (2026-10-23): the Papic page draws `<LiveWallCard` again → 1 red; Memories settings drop `<PoolGalleryCard`
 * → 2 red; the Details row loses `<OneCodeUnderGetIn` → 3 red. Restored → green.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const code = (f: string) => stripComments(readFileSync(join(process.cwd(), f), 'utf8'));
const PAPIC = 'app/dashboard/[eventId]/studio/papic/page.tsx';
const CAMERA = 'app/dashboard/[eventId]/studio/papic/_components/papic-camera-settings.tsx';
const SETTINGS = 'app/dashboard/[eventId]/memories/_components/memories-settings.tsx';
const DETAILS = 'app/dashboard/[eventId]/details/page.tsx';
const ACCESS = 'app/dashboard/[eventId]/details/_components/people-with-access.tsx';
const GUESTS = 'app/dashboard/[eventId]/guests/_components/guests-screen.tsx';

test('1 · the Papic page is the camera: the one line, the credits, his five — and none of the files', () => {
  const page = code(PAPIC);
  const body = page.slice(page.indexOf('data-papic-page="camera"'));
  assert.ok(body.length > 100, 'premise: the camera page is drawn');
  assert.match(body, /<PapicTopBand\b/, 'the Papic page lost the credits band');
  assert.match(body, /<PapicCameraSettings eventId=\{eventId\}/, 'the Papic page no longer draws the camera settings');
  // The camera, in the owner's order — ONE component, also opened under Home's Papic card.
  const cam = code(CAMERA);
  for (const must of [
    /<AnswerPicker[\s\S]{0,120}column="papic_on"[\s\S]{0,200}as="switch"/,
    /<PapicWindowPicker\b/,
    /<StylePicker\b/,
    /<GuestAllotmentsChoice\b/,
    /<FaceTaggingChoice\b/,
    /<FaceBlockingList\b/,
    /<CoupleChallengesManager\b/,
  ]) {
    assert.match(cam, must, `the camera settings lost ${must}`);
  }
  for (const gone of [
    '<LiveWallCard',
    '<PoolGalleryCard',
    '<DriveCopyCard',
    '<GalleryPreviewCard',
    '<PapicStage',
    '<VendorMediaControls',
    '<SourceRow',
    '<UploadsOpenChoice',
    'HIGH_RES_ARCHIVE"',
    '/studio/papic/moderation',
  ]) {
    assert.ok(!body.includes(gone), `the Papic page draws ${gone} again — it belongs to Memories, Event Details or the photo`);
  }
});

test('2 · Memories › ⚙ Gallery settings draws the five that moved — the shipped controls', () => {
  const s = code(SETTINGS);
  for (const must of [
    /<LiveWallCard\b[^>]*variant="row"/,
    /<ServiceParts\b[^>]*service="papic"/,
    /<PoolGalleryCard\b[^>]*variant="row"/,
    /<DriveCopyCard\b/,
    /serviceKey="HIGH_RES_ARCHIVE"/,
  ]) {
    assert.match(s, must, `Gallery settings lost ${must}`);
  }
  const g = code('app/_components/memories/event-memories-gallery.tsx');
  assert.match(g, /Follow the moments in order/, 'the moments switch left the sheet');
});

test('3 · How guests get in carries the one code; a supplier row carries its photos; Guests says Settings', () => {
  const d = code(DETAILS);
  const row = d.indexOf('row="guests-get-in"');
  assert.ok(row > 0, 'premise: the How guests get in row');
  assert.match(d.slice(row, row + 900), /<OneCodeUnderGetIn eventId=\{eventId\} \/>/, 'the one code is not under the How guests get in row');
  assert.match(d, /supplierPhotos=\{supplierShots\}/, 'Event access is not handed the suppliers’ photos');
  const a = code(ACCESS);
  assert.match(a, /<SupplierPhotosSwitch\b/, 'a supplier row draws no photos switch');
  assert.match(a, /name="back" value="details"/, 'the switch would land on the Papic page');
  const gs = code(GUESTS);
  assert.match(gs, /seg\('share', 'Settings'\)/, 'Guests’ third segment no longer says Settings');
  assert.doesNotMatch(gs, /seg\('share', 'Setup'\)/, '"Setup" is back');
});
