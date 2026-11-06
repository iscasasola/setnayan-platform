/**
 * GUARD — before the day, early shooting shows a guest THEIR OWN shots, and
 * nothing of anybody else's (owner 2026-10-14, DECISION_LOG 🖼: "Only their own
 * shots"; "announce features, hide content" still stands for the rest).
 *
 *   · the loader decides it with the SAME early flag and the SAME gate the
 *     camera uses (`papic_guest_capture_early` → `guestCaptureGate`), from the
 *     event's one row (`eventRowOnce`);
 *   · before the day it loads the guest's own shots and NOT the shared gallery
 *     switch (no door to everyone's);
 *   · the page draws only "Your shots" — no "Photos of you", no everyone's —
 *     and an empty one invites a first photo with the Camera, never a blank wall.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const SLUG = dirname(dirname(fileURLToPath(import.meta.url)));
const LOADERS = stripComments(readFileSync(join(SLUG, '_lib', 'loaders.ts'), 'utf8'));
const BODY = stripComments(readFileSync(join(SLUG, '_components', 'site-body.tsx'), 'utf8'));
const SHOTS = stripComments(readFileSync(join(SLUG, '_components', 'your-shots-gallery.tsx'), 'utf8'));

test('the loader asks the camera gate, with the early flag, from the one event row', () => {
  const at = LOADERS.indexOf('let earlyOwnShots = false;');
  assert.ok(at > 0, 'the early decision is gone from the loader');
  const block = LOADERS.slice(at, at + 1400);
  assert.match(block, /eventRowOnce\(admin, event\.event_id, GUEST_CAPTURE_GATE_COLUMNS/);
  assert.match(block, /papic_guest_capture_early === true/);
  assert.match(block, /guestCaptureGate\(\{[\s\S]*?\}\)\.state === 'open'/);
  assert.match(block, /!galleryWindow && guest\.rsvp_status !== 'declined'/);
});

test('before the day it loads their own shots — and never the shared-gallery door', () => {
  assert.match(LOADERS, /earlyOwnShots\s*\?\s*\[await getGuestOwnShots\(event\.event_id, guest\.guest_id\), false\]/);
});

test('the page draws "Your shots" only — no everyone\'s, no Photos of you — and an empty one hands over the Camera', () => {
  const at = BODY.indexOf(') : earlyOwnShots ? (');
  assert.ok(at > 0, 'the before-the-day Gallery branch is gone');
  const branch = BODY.slice(at, BODY.indexOf(') : null}', at));
  assert.match(branch, /<YourShotsGallery/);
  assert.match(branch, /everyoneHref=\{null\}/, 'a door to everyone\'s photos opened before the day');
  assert.match(branch, /cameraHref=\{guestCameraHref\}/);
  assert.doesNotMatch(branch, /PhotosOfYou|poolGalleryOpen/);
  // Photos of you stays a day-and-after section.
  assert.match(BODY, /\(isLive \|\| isPost\) && !partsOff\.has\('photosofyou'\)/);
  // The empty state is an invitation, not a blank wall.
  assert.match(SHOTS, /Take your first photo/);
  assert.match(SHOTS, /cameraHref \? \(/);
});

test('the bar is told — the one rule lives in site-nav', () => {
  assert.match(BODY, /earlyOwnShots,\n\s+hostAllowsCamera:/);
});
