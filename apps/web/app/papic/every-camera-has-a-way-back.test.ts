/**
 * ✕ EVERY CAMERA HAS A WAY BACK TO THE EVENT HUB (owner 31 Oct, on the full-screen camera: "needs exit to return to
 * event hub"). The camera pages no longer scroll, so a camera without its ✕ is a dead end.
 *  · the guest camera's ✕ falls back to this event's OWN hub when it was not opened from a hub tab;
 *  · the seat camera draws the same ✕, from the event's own slug read on the server (never a query param).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, p), 'utf8');
const GUEST_PAGE = read('guest/page.tsx');
const SEAT_PAGE = read('seat/[token]/page.tsx');
// The seat camera IS the guest camera now (owner 2026-11-22, "we only have one camera interface").
const SEAT_CAM = read('guest/_components/papic-guest-capture.tsx');

test('the guest camera always gets an exit — the tab it came from, else its own Event Hub', () => {
  assert.match(GUEST_PAGE, /exitTo=\{backSlug \? \{ slug: backSlug, tab: backTab \} : ownHubSlug \? \{ slug: ownHubSlug, tab: null \} : null\}/);
  assert.match(GUEST_PAGE, /select\(`display_name, slug,/, 'the event read no longer carries its slug');
  assert.match(GUEST_PAGE, /const ownHubSlug = [^\n]*\/\^\[a-z0-9\]\[a-z0-9-\]\{0,79\}\$\/\.test/, 'the slug is not re-checked before it becomes an href');
});

test('the seat camera draws the same ✕ back to the Event Hub', () => {
  // 📷 ONE CAMERA (owner 2026-11-22): the seat page mounts the guest camera itself, so the ✕ is the same element.
  assert.match(SEAT_PAGE, /<PapicGuestCapture\b/, 'the seat page no longer opens the one camera');
  assert.match(SEAT_PAGE, /exitTo=\{hubSlug \? \{ slug: hubSlug, tab: backTab \} : null\}/, 'the seat page does not hand the camera its hub');
  assert.match(SEAT_PAGE, /const hubSlug = hubSlugOf\(/, 'the slug is not re-checked before it becomes an href');
  assert.match(SEAT_PAGE, /const backTab = cameraBackTab\(back\);/, 'the tab it came from is not re-checked against the tab keys');
  assert.match(SEAT_PAGE, /select\(`papic_style, papic_face_mode, event_type, slug,/);
  assert.match(SEAT_CAM, /data-camera-exit=""\s*href=\{cameraExitHref\(exitTo\.slug, exitTo\.tab, added\)\}\s*aria-label="Close the camera"/);
  assert.match(SEAT_CAM, /inline-flex h-11 w-11/, 'the ✕ is under the 44 px floor');
});
