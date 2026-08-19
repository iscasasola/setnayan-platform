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
  const inspector = /photoDisplayUrl=\{photoDisplayUrls\[inspectedGuest\.photo_url \?\? ''\]/.test(PAGE);
  assert.ok(inspector, 'the desktop inspector does not pass the photo');
  assert.ok(
    /photoDisplayUrl=\{photoDisplayUrls\[guest\.photo_url \?\? ''\]/.test(DRAWER),
    'the mobile sheet does not pass the photo',
  );
  assert.ok(
    /photoDisplayUrls=\{photoDisplayUrls\}/.test(PAGE),
    'the sheet opens from a client store carrying only the row, so the page must ' +
      'hand the map to its host',
  );
});
