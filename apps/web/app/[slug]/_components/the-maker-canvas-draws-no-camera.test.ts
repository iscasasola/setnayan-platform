/**
 * THE MAKER'S CANVAS DRAWS NO CAMERA — owner, 2026-09-30: *"why is camera
 * repeatedly asking me for access on my event hub maker"* → *"we do not need
 * camera on event hub maker because it just fix details and design."*
 *
 * The Maker's canvas is an iframe of the couple's own page, and a couple holds
 * a seat on their own guest list — so the page drew the inline Papic camera
 * (`PapicGuestCapture`), which turns the camera AND microphone on at mount
 * (`usePapicCamera({ enabled: accepted … })`, audio first). Every canvas frame
 * the Maker loaded or re-keyed asked the browser again: Safari's "Allow
 * setnayan.com to use your camera and microphone?", on every edit.
 *
 * Executed against the source (comments stripped):
 *   1. the page hands the guest identity NO `papicGuest` in the canvas;
 *   2. the hub mounts the camera only behind `papicGuest` — so (1) is enough.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PAGE = read('app/[slug]/page.tsx');
const BODY = read('app/[slug]/_components/site-body.tsx');

test('the canvas render hands the guest identity no Papic camera', () => {
  assert.match(PAGE, /papicGuest: isEditorCanvas \? null : papicGuest,/);
  const identity = PAGE.slice(PAGE.indexOf('identity={guestIdentity({'));
  const call = identity.slice(0, identity.indexOf('})}'));
  assert.doesNotMatch(call, /^\s*papicGuest,\s*$/m, 'a bare `papicGuest,` would draw the camera in the canvas');
});

test('the hub mounts the camera only behind papicGuest', () => {
  const at = BODY.indexOf('<PapicGuestCapture');
  assert.ok(at > 0, 'the hub no longer mounts the camera — update this guard');
  assert.match(BODY.slice(Math.max(0, at - 80), at), /\{papicGuest \? \(\s*$/);
  assert.equal(BODY.split('<PapicGuestCapture').length - 1, 1, 'a second mount would need its own canvas gate');
});
