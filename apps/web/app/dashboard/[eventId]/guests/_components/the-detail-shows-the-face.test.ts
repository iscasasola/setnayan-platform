/**
 * the-detail-shows-the-face.test.ts — the guest detail renders the guest.
 *
 * This screen read NO photo at all. Every guest showed initials — including one
 * whose selfie was sitting in the very row the component was already handed. It
 * is the guest screen where a face matters most: the couple opens it to work out
 * who somebody is.
 *
 * Not a broken image, so no glyph gave it away. Just a face that never appeared.
 *
 * 🛡 Mutation-checked by occurrence count, each confirmed RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => stripComments(readFileSync(join(HERE, p), 'utf8'));
const BODY = read('guest-detail-body.tsx');
const DRAWER = read('guest-drawer.tsx');
const PAGE = readFileSync(resolve(HERE, '..', 'page.tsx'), 'utf8');

test('the body renders a photo when it has one, and initials when it does not', () => {
  assert.ok(/photoDisplayUrl \?/.test(BODY), 'the face must be conditional on having one');
  assert.ok(/guestInitials\(guest\)/.test(BODY), 'initials remain the fallback — never a blank circle');
  assert.ok(/<img/.test(BODY), 'a photo must actually render');
});

test('it takes a RESOLVED url, never the stored column', () => {
  // guests.photo_url holds an r2:// reference. Handing that to an <img> is the
  // exact defect three sibling screens shipped with.
  assert.equal(
    /src=\{guest\.photo_url\}/.test(BODY),
    false,
    'The stored column is a reference, not a URL. A raw one is a broken-image glyph.',
  );
  assert.ok(
    /photoDisplayUrl\?: string \| null/.test(BODY),
    'the prop must name itself a display URL, so a caller cannot mistake it',
  );
});

test('BOTH mounts pass it — the inspector and the sheet', () => {
  // The desktop inspector and the mobile sheet render the SAME body. Wiring one
  // and not the other is how half a fix ships.
  //
  // 🪤 THIS USED TO PIN THE EXACT ONE-LINE EXPRESSION, and went red the day the
  // account-photo fallback was added — a change that made both mounts MORE
  // correct, not less. A guard that forbids a phrasing convicts innocent code
  // and teaches the next person to weaken it. It now asserts the PROPERTY: each
  // mount resolves a face from the guest's own photo, and falls back to the
  // account photo (lib/guest-account-photos.ts), whatever shape that is written
  // in.
  const propAt = (src: string) => {
    const at = src.indexOf('photoDisplayUrl={');
    return at === -1 ? null : src.slice(at, src.indexOf('}\n', at) + 1);
  };

  const inspector = propAt(PAGE);
  assert.ok(inspector, 'the desktop inspector does not pass the photo');
  assert.match(inspector, /photoDisplayUrls\[inspectedGuest\.photo_url \?\? ''\]/);
  assert.match(
    inspector,
    /accountFaceByGuest\[inspectedGuest\.guest_id\]/,
    'the inspector lost the linked-account fallback',
  );

  const sheet = propAt(DRAWER);
  assert.ok(sheet, 'the mobile sheet does not pass the photo');
  assert.match(sheet, /photoDisplayUrls\[guest\.photo_url \?\? ''\]/);
  assert.match(
    sheet,
    /accountFaceByGuest\[guest\.guest_id\]/,
    'the mobile sheet lost the linked-account fallback',
  );

  /*
    The sheet opens from a client store carrying only the row, so the page must
    hand BOTH maps to its host or the fallback above resolves to nothing.

    🪤 ANCHORED ON <GuestDrawerHost>, NOT ON THE FILE. Two elements on this page
    receive these maps — the roster and the drawer host. A file-level match is
    satisfied by either, so deleting the drawer's copy passed a first draft of
    this assertion. A guard that cannot say WHICH mount lost the prop is not
    guarding the mount.
  */
  const hostAt = PAGE.indexOf('<GuestDrawerHost');
  assert.notEqual(hostAt, -1, 'the sheet host is no longer mounted');
  const host = PAGE.slice(hostAt, PAGE.indexOf('/>', hostAt));
  assert.match(host, /photoDisplayUrls=\{photoDisplayUrls\}/, 'the sheet host lost the photo map');
  assert.match(
    host,
    /accountFaceByGuest=\{accountFaceByGuest\}/,
    'the page does not hand the account-photo map to the sheet host',
  );
});
