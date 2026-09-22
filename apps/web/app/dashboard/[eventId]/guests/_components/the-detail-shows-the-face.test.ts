/**
 * the-detail-shows-the-face.test.ts — the guest card renders the guest.
 *
 * This screen read NO photo at all. Every guest showed initials — including one
 * whose selfie was sitting in the very row the component was already handed. It
 * is the guest screen where a face matters most: the couple opens it to work out
 * who somebody is.
 *
 * Not a broken image, so no glyph gave it away. Just a face that never appeared.
 *
 * ── RE-ANCHORED 2026-09-22 ──────────────────────────────────────────────────
 * The quick view and the edit form merged into one card. The body is now
 * `guest-card-body.tsx`, and the two frames that used to be pinned here (the
 * inspector column and the client drawer) became ONE server-rendered card with
 * two presentations. What still has two sides — and is therefore still worth
 * guarding — is the LOADING: the roster page resolves the face for the panel,
 * and the standalone route resolves it for a direct hit. Wiring one and not the
 * other is exactly how half a fix ships.
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
const BODY = read('guest-card-body.tsx');
const ROSTER = readFileSync(resolve(HERE, '..', 'page.tsx'), 'utf8');
const ROUTE = readFileSync(resolve(HERE, '..', '[guestId]', 'page.tsx'), 'utf8');

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
    /photoDisplayUrl: string \| null/.test(BODY),
    'the prop must name itself a display URL, so a caller cannot mistake it',
  );
});

test('BOTH loaders resolve a face — the roster panel and the standalone route', () => {
  /*
    🪤 THIS USED TO PIN THE EXACT ONE-LINE EXPRESSION, and went red the day the
    account-photo fallback was added — a change that made both mounts MORE
    correct, not less. A guard that forbids a phrasing convicts innocent code and
    teaches the next person to weaken it. It asserts the PROPERTY: each loader
    resolves a face from the guest's own photo and falls back to the linked
    account's (lib/guest-account-photos.ts), whatever shape that is written in.

    ⚖ Owner 2026-09-20: "so when users create their accounts, when they have a
    profile photo, it will show here too" — the couple's own upload still wins.
  */
  const propAt = (src: string) => {
    const at = src.indexOf('photoDisplayUrl={');
    return at === -1 ? null : src.slice(at, src.indexOf('}\n', at) + 1);
  };

  const panel = propAt(ROSTER);
  assert.ok(panel, 'the roster panel does not pass the photo');
  assert.match(panel, /photoDisplayUrls\[inspectedGuest\.photo_url \?\? ''\]/);
  assert.match(
    panel,
    /accountFaceByGuest\[inspectedGuest\.guest_id\]/,
    'the roster panel lost the linked-account fallback',
  );

  const route = propAt(ROUTE);
  assert.ok(route, 'the standalone route does not pass the photo');
  assert.match(route, /photoDisplayUrl\}/, 'the route must hand over a resolved value');
  // The route resolves its own single guest rather than reading a page-wide map,
  // so the property is asserted where it is computed.
  assert.match(
    ROUTE,
    /photoDisplayUrls\[guest\.photo_url \?\? ''\]/,
    'the route lost the guest photo lookup',
  );
  assert.match(
    ROUTE,
    /accountPhotoRefsByGuest/,
    'the route lost the linked-account fallback',
  );
});

test('there is no second, unresolved face left behind', () => {
  // The retired quick-view body used to carry its own copy of this logic. If a
  // component starts rendering guests again from the raw column, say so here.
  assert.equal(
    /photo_url\}/.test(BODY),
    false,
    'the card must never read the stored ref directly',
  );
});
