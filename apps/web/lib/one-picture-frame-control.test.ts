/**
 * GUARD — THE PROFILE PICTURE AND THE SHOP LOGO ARE FRAMED BY ONE CONTROL.
 *
 * ⚖ Owner, 2026-11-06, asked whether a person's profile picture gets the same frame as the business logo:
 * "yes, use the same control". Owner 7 Nov (prototype v21, the logo step): "drag and pinch to zoom". The logo's
 * control became `PictureFrameControl` (A3, #7351: drag + pinch, x / y 0–100, zoom 100–300); the profile picture
 * (A4, #7353) mounts the SAME one. Two copies would drift — a gesture, a bound or a fix landing on one and not the
 * other — and each copy would pass its own tests.
 *
 * Anchored on SYMBOL NAMES, never line numbers. Fails when:
 *   • the profile picture stops rendering `<PictureFrameControl picture="profile_photo"`, or holds its own gesture code;
 *   • a place that SETS the profile picture mounts a bare upload instead of the field;
 *   • the keypad ("Keep area N of 9", "How close") is drawn anywhere outside the Maker's own files;
 *   • the profile picture's surfaces stop drawing through the one `pictureFrameStyle`;
 *   • the profile picture stops naming its own three columns in `PICTURE_FRAME_FIELDS`, or the patch stops writing them;
 *   • the profile picture draws a SECOND picture under its circle (the controller's logo review, 7 Nov).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { PICTURE_FRAME_FIELDS, pictureFrameStyle, profilePhotoFrameColumns, readProfilePhotoFrame } from './picture-frame';
import { logoFrameStyle } from './open-shop-logo';
import { stripComments } from './strip-comments';

const read = (p: string) => readFileSync(p, 'utf8');
const strip = stripComments;

const CONTROL = strip(read('app/_components/picture-frame-control.tsx'));
const PHOTO_FIELD = strip(read('app/_components/profile-photo-field.tsx'));
const count = (src: string, re: RegExp) => (src.match(new RegExp(re.source, 'g')) ?? []).length;

test('there is ONE control: PictureFrameControl holds the drag + pinch gesture', () => {
  assert.match(CONTROL, /export function PictureFrameControl\b/);
  assert.match(CONTROL, /s\.pts\.size === 2/);
  assert.match(CONTROL, /zoomPictureFrameAt\(/);
  assert.match(CONTROL, /panPictureFrame\(/);
  assert.match(CONTROL, /pictureFrameStyle\(frame\)/, 'the control’s picture is not the one picture style');
});

test('the profile picture draws through PictureFrameControl, once — and holds no copy of it', () => {
  assert.match(PHOTO_FIELD, /import \{ PictureFrameControl \} from '@\/app\/_components\/picture-frame-control';/);
  assert.match(PHOTO_FIELD, /<PictureFrameControl\s+picture="profile_photo"/);
  assert.equal(count(PHOTO_FIELD, /<PictureFrameControl\b/), 1);
  for (const copy of [/onPointerDown|onPointerMove|addEventListener\('wheel'/, /type="range"/, /HUB_FOCAL_POINTS|HUB_ZOOMS|<PickMenu\b|of 9 in frame|How close/]) {
    assert.doesNotMatch(PHOTO_FIELD, copy, `profile-photo-field.tsx forked the control (${copy})`);
  }
  // ONE picture: the circle first, the upload under it is [Replace photo] [Remove] once a photo is in.
  assert.ok(PHOTO_FIELD.indexOf('<PictureFrameControl') < PHOTO_FIELD.indexOf('<FileUpload'), 'the upload is drawn above the circle');
  assert.match(PHOTO_FIELD, /roundPreview\s+pills=\{\{ replace: 'Replace photo' \}\}/, 'the profile picture draws a second picture under its circle');
  assert.match(strip(read('app/_components/file-upload.tsx')), /\{rowMode && !\(pillMode && items\.length > 0\) \? photoRow : null\}/, 'the You card row still draws its 72 px picture beside the circle');
  // …and both places the profile picture is SET mount that field (the profile page through its identity tile).
  assert.match(strip(read('app/dashboard/(account)/profile/page.tsx')), /<ProfileIdentityTile\b/);
  for (const f of ['app/dashboard/(account)/profile/_components/profile-identity-tile.tsx', 'app/signup/you/_components/you-card.tsx']) {
    assert.match(strip(read(f)), /<ProfilePhotoField\b/, `${f} sets the profile picture without its frame control`);
  }
  for (const f of ['app/dashboard/(account)/profile/page.tsx', 'app/signup/you/_components/you-card.tsx']) {
    const src = strip(read(f));
    assert.doesNotMatch(src, /<FileUpload\b[^>]*pathPrefix=\{`profile-photo\//, `${f} mounts a bare profile-photo upload beside the field`);
  }
});

test('nobody else draws the keypad — it lives only in the Maker now', () => {
  const MAKER = /app\/dashboard\/\[eventId\]\/(?:website\/editor|launch)\//;
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) {
        if (n !== 'node_modules' && n !== '.next') walk(p);
      } else if (p.endsWith('.tsx')) files.push(p);
    }
  };
  walk('app');
  const forks = files.filter((f) => !MAKER.test(f) && /of 9 in frame/.test(strip(read(f))));
  assert.deepEqual(forks, [], 'a keypad outside the Maker — frame with PictureFrameControl instead');
});

test('both pictures render through the one style, and each names its own three columns', () => {
  const sample = { x: 30, y: 72, zoom: 180 };
  assert.deepEqual(logoFrameStyle(sample), pictureFrameStyle(sample), 'the logo style is no longer the picture style');
  assert.deepEqual(PICTURE_FRAME_FIELDS.logo, { x: 'logo_focal_x', y: 'logo_focal_y', zoom: 'logo_zoom' });
  assert.deepEqual(PICTURE_FRAME_FIELDS.profile_photo, { x: 'profile_focal_x', y: 'profile_focal_y', zoom: 'profile_zoom' });
  // The columns written are the columns named — and read back, drop-never-repair.
  assert.deepEqual(profilePhotoFrameColumns(sample), { profile_focal_x: 30, profile_focal_y: 72, profile_zoom: 180 });
  assert.deepEqual(profilePhotoFrameColumns({ x: 50, y: 50, zoom: 100 }), { profile_focal_x: null, profile_focal_y: null, profile_zoom: null });
  assert.deepEqual(readProfilePhotoFrame({ profile_focal_x: 30, profile_focal_y: 72, profile_zoom: 180 }), sample);
  assert.deepEqual(readProfilePhotoFrame({ profile_focal_x: 101, profile_focal_y: 12.5, profile_zoom: 99 }), { x: 50, y: 50, zoom: 100 });
  // The surfaces this change framed draw the profile picture through it.
  for (const f of ['app/_components/account-switcher/account-switcher.tsx', 'app/u/[userSlug]/page.tsx']) {
    assert.match(read(f), /pictureFrameStyle\(/, `${f} draws the profile picture without its frame`);
  }
  // The patch writes the three named fields — never the keypad pair.
  const patch = strip(read('lib/profile-personal-info-patch.ts'));
  assert.match(patch, /const fields = PICTURE_FRAME_FIELDS\.profile_photo;/);
  assert.doesNotMatch(patch, /profile_photo_focal|profile_photo_zoom/);
});
