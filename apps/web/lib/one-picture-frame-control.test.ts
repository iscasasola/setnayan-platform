/**
 * GUARD — THE PROFILE PICTURE AND THE SHOP LOGO USE ONE ALIGN + ZOOM CONTROL.
 *
 * ⚖ Owner, 2026-11-06, asked whether a person's profile picture gets the same align + zoom as the business logo:
 * "yes, use the same control". The logo's control (#7345) was a copy of the Event Hub Maker's "In frame" row; this
 * change extracted it into ONE part, `PictureFrameControl`, and both pictures draw through it. Two copies would drift
 * — a word, a zoom step or a keypad fix landing on one and not the other — and each copy would pass its own tests.
 *
 * Anchored on SYMBOL NAMES, never line numbers. Fails when:
 *   • either picture's control stops rendering `<PictureFrameControl` (or renders it for the other picture);
 *   • the keypad / "How close" menu is drawn anywhere outside `picture-frame-control.tsx` and the Maker's own files;
 *   • the logo's or the profile picture's style stops being the one `pictureFrameStyle`;
 *   • the two pictures stop naming their own two columns in `PICTURE_FRAME_FIELDS`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { PICTURE_FRAME_FIELDS, pictureFrameStyle } from './picture-frame';
import { logoFrameStyle } from './open-shop-logo';
import { stripComments } from './strip-comments';

const read = (p: string) => readFileSync(p, 'utf8');
const strip = stripComments;

const CONTROL = strip(read('app/_components/picture-frame-control.tsx'));
const LOGO_CONTROL = strip(read('app/_components/logo-frame-control.tsx'));
const PHOTO_FIELD = strip(read('app/_components/profile-photo-field.tsx'));

test('there is ONE control: PictureFrameControl holds the keypad and the "How close" menu', () => {
  assert.match(CONTROL, /export function PictureFrameControl\b/);
  assert.match(CONTROL, /HUB_FOCAL_POINTS\.map/);
  assert.match(CONTROL, /aria-label=\{`Keep area \$\{f\} of 9 in frame`\}/);
  assert.match(CONTROL, /label="How close"/);
  assert.match(CONTROL, /pictureFrameStyle\(frame\)/, 'the control’s preview is not the one picture style');
});

test('the shop logo draws through PictureFrameControl — and holds no copy of it', () => {
  assert.match(LOGO_CONTROL, /<PictureFrameControl\s+picture="logo"/);
  for (const copy of [/HUB_FOCAL_POINTS/, /HUB_ZOOMS/, /<PickMenu\b/, /of 9 in frame/]) {
    assert.doesNotMatch(LOGO_CONTROL, copy, `logo-frame-control.tsx forked the control (${copy})`);
  }
});

test('the profile picture draws through PictureFrameControl — and holds no copy of it', () => {
  assert.match(PHOTO_FIELD, /<PictureFrameControl\s+picture="profile_photo"/);
  for (const copy of [/HUB_FOCAL_POINTS/, /HUB_ZOOMS/, /<PickMenu\b/, /of 9 in frame/]) {
    assert.doesNotMatch(PHOTO_FIELD, copy, `profile-photo-field.tsx forked the control (${copy})`);
  }
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

test('nobody else draws the keypad — a third copy outside the Maker is a fork', () => {
  // The Maker's own files keep theirs (~10 guards read that text; it is the source the control was copied from).
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
  const forks = files.filter(
    (f) => !MAKER.test(f) && f !== join('app', '_components', 'picture-frame-control.tsx') && /of 9 in frame/.test(strip(read(f))),
  );
  assert.deepEqual(forks, [], 'a keypad outside PictureFrameControl — extend the one control instead');
});

test('both pictures render through the one style, and each names its own two columns', () => {
  const sample = { focal: 3, zoom: 150 } as const;
  assert.deepEqual(logoFrameStyle(sample), pictureFrameStyle(sample), 'the logo style is no longer the picture style');
  assert.deepEqual(PICTURE_FRAME_FIELDS.logo, { focal: 'logo_focal', zoom: 'logo_zoom' });
  assert.deepEqual(PICTURE_FRAME_FIELDS.profile_photo, { focal: 'profile_photo_focal', zoom: 'profile_photo_zoom' });
  // The surfaces this change framed draw the profile picture through it.
  for (const f of ['app/_components/account-switcher/account-switcher.tsx', 'app/u/[userSlug]/page.tsx']) {
    assert.match(read(f), /pictureFrameStyle\(/, `${f} draws the profile picture without its frame`);
  }
});
