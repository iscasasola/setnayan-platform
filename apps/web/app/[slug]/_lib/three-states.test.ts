/**
 * three-states.test.ts — "none yet", "we broke" and "here they are" are three
 * different things, and a guest must be able to tell which one she is looking
 * at.
 *
 * ── PHOTOS OF YOU ───────────────────────────────────────────────────────────
 * `getGuestLiveGallery` returned `null` for zero photos AND `null` from its
 * catch. The invitation rendered the whole section only when that value was
 * truthy — so a guest photographed all evening opened her page and found no
 * "Photos of you" area AT ALL. Not an empty one, not an error: nothing, where
 * it should have been. She has no way to tell whether the photographers missed
 * her or the page did, and nothing on screen to act on either way.
 *
 * An empty list is now a real result; `null` means only that the read failed.
 * Every other caller already handled an empty list — `papic/me` checks
 * `photos.length === 0`, the library maps to `refs: []`, the hub reads
 * `.photos`/`.total` — so nothing downstream changed shape. That is why the fix
 * is a deletion rather than a new return type threaded through four callers.
 *
 * ── THE LIVE WALL ───────────────────────────────────────────────────────────
 * Both its failure paths — `if (!res.ok) return;` and an empty `catch` —
 * changed NO STATE AT ALL. It retried every 25 seconds forever while the guest
 * read "The wall is warming up — photos appear here the moment they're taken."
 * On a bad venue network that sentence was a promise the page had already
 * stopped being able to keep.
 *
 * 🔑 THE THRESHOLD IS TWO CONSECUTIVE FAILURES, NOT ONE. A single miss on venue
 * wifi is ordinary and must not accuse the network — and it must never fire on
 * the ordinary first-load-with-no-tiles, or every guest at a quiet moment sees
 * an error that is not true.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GALLERY = readFileSync(join(HERE, '..', '..', '..', 'lib', 'guest-live-gallery.ts'), 'utf8');
const BODY = readFileSync(join(HERE, '..', '_components', 'site-body.tsx'), 'utf8');
/**
 * The "Photos of you" section moved OUT of site-body.tsx on 2026-08-27 when it
 * was ported to the gallery archetype's obsidian surface — it needs client state
 * for the lightbox, and site-body is a server component.
 *
 * ⚠ THE THREE STATES DID NOT MOVE, AND THAT IS WHAT THIS FILE WATCHES. These
 * assertions follow the code to its new file rather than being relaxed: the
 * failure they exist to catch — "nobody has tagged you yet" and "the read broke"
 * collapsing into one answer — is exactly the kind a port loses quietly.
 */
const PHOTOS_OF_YOU = readFileSync(
  join(HERE, '..', '_components', 'photos-of-you-gallery.tsx'),
  'utf8',
);
const WALL = readFileSync(join(HERE, '..', '_components', 'live-wall-block.tsx'), 'utf8');

test('an empty gallery is a real answer, not the same as a broken read', () => {
  // 🪤 THIS ASSERTION USED TO NAME ONE SPELLING AND MISS ITS TWIN.
  // It matched only the late `if (photos.length === 0) return null` that the
  // 2026-07 fix deleted — while `if (!tags || tags.length === 0) return null`
  // sat 118 lines ABOVE it, untouched, doing the identical harm to the far more
  // common case. The guard passed, the module's docblock declared the bug
  // fixed, and every untagged guest was told the page had failed to load her
  // photos. 🔑 A GUARD THAT MATCHES A STRING DOES NOT WATCH THE ACT: match the
  // ACT — returning the failure value for an EMPTY set, however it is spelled.
  const earlyEmptyNull = [
    ...GALLERY.matchAll(/if\s*\([^)]*\.length === 0[^)]*\)\s*return null;/g),
  ];
  assert.deepEqual(
    earlyEmptyNull.map((m) => m[0]),
    [],
    'An empty set returns null again — which is exactly what the catch returns, ' +
      'so "nobody has tagged you yet" and "the read broke" become one answer ' +
      'and the guest is shown the wrong one of the two.',
  );
  // …and the empty case must reach a REAL result, not just avoid null.
  assert.match(
    GALLERY,
    /if \(!tags \|\| tags\.length === 0\) return \{ photos: \[\], total: 0 \};/,
    'The zero-tags path no longer returns a real empty result. That path is the ' +
      'commonest state of every guest before the photographers finish tagging.',
  );
  // The catch must STAY: gallery trouble must never take the wedding page down.
  assert.match(
    GALLERY,
    /\} catch \{\s*\n\s*return null; \/\/ gallery trouble must never break the wedding page/,
    'The catch was removed. A failing gallery must not break the page — null is ' +
      'the right answer there, and now it is the ONLY thing that means it.',
  );
});

test('a REFUSED read is caught — every query checks .error, none of them throws', () => {
  // A rejected query comes back `{ data: null, error }` and never throws, so a
  // discarded `.error` renders as "you have no photos" over rows that exist.
  // All three reads in this module must check it, or the contract above is a
  // sentence rather than a mechanism.
  assert.match(GALLERY, /error: tagsError/, 'the photo_tags read discards its error again');
  assert.match(GALLERY, /if \(tagsError\) return null;/, 'a refused tag read no longer fails closed');
  assert.equal(
    [...GALLERY.matchAll(/if \('error' in \w+Res && \w+Res\.error\) return null;/g)].length,
    2,
    'Both media reads must check .error. Covering one leaves the other able to ' +
      'report a broken read as an empty album.',
  );
});

test('the Alaala wall maps that null onto its own not-measured flag', () => {
  // The wall deliberately did NOT do this while `null` was ambiguous — doing it
  // then would have raised "could not be loaded" at every untagged guest. Now
  // that null means only failure, refusing to map it would be the opposite
  // error: a broken gate printed as "no photos of you yet".
  const WALL_DATA = readFileSync(
    join(HERE, '..', '..', '..', 'lib', 'alaala-wall-data.ts'),
    'utf8',
  );
  assert.match(
    WALL_DATA,
    /if \(!gallery\) return \{ refs: \[\], unreadable: true, saturated: false \};/,
    'A failed attended read is reported as a successful empty one again.',
  );
});

test('the section renders for the whole window, whatever the answer is', () => {
  assert.match(
    BODY,
    /\{isLive \|\| isPost \? \(/,
    'The section is gated on the gallery being truthy again, so a guest with no ' +
      'photos yet — or a failed read — sees nothing at all where it should be.',
  );
  assert.match(
    PHOTOS_OF_YOU,
    /No one has tagged you yet/,
    'The empty state lost its words. This is the commonest state early in a day ' +
      'and the one a guest most needs reassurance about.',
  );
  assert.match(
    PHOTOS_OF_YOU,
    /We couldn&rsquo;t load your photos just now/,
    'The failed-read state lost its words, so it reads as "you have none".',
  );
});

test('the gallery never asserts a count or a promise it cannot back', () => {
  assert.match(
    PHOTOS_OF_YOU,
    /\(gallery\?\.total \?\? 0\)\.toLocaleString\(\)/,
    'The count reads through a possibly-null gallery again.',
  );
  assert.match(
    PHOTOS_OF_YOU,
    /\{photos\.length > 0 \? \(/,
    '"More arrive as the day unfolds" and "Tap any photo" must not render over ' +
      'an empty grid or a failed read — they describe photos that are not there.',
  );
});

test('the live wall stops promising photos it cannot fetch', () => {
  assert.match(WALL, /const \[stalled, setStalled\] = useState\(false\)/, 'the stalled state is gone');
  assert.match(
    WALL,
    /We can’t reach the wall right now/,
    'The wall shows only "warming up" again — a promise it has stopped being ' +
      'able to keep.',
  );
  // Both failure paths must count. Missing either one leaves a silent branch.
  const setters = WALL.match(/if \(misses >= 2\) setStalled\(true\)/g) ?? [];
  assert.equal(
    setters.length,
    2,
    'Both failure paths must count — the non-OK response AND the thrown error. ' +
      'Covering one leaves the other silent forever.',
  );
  assert.match(WALL, /misses = 0;\s*\n\s*setStalled\(false\)/, 'a recovered fetch must clear it');
});

test('one bad fetch is not an accusation — the threshold is two', () => {
  assert.ok(
    !/if \(misses >= 1\)/.test(WALL) && !/setStalled\(true\);\s*\n\s*return;/.test(WALL.replace(/if \(misses >= 2\) setStalled\(true\);\s*\n\s*return;/g, '')),
    'The wall now accuses the network after a SINGLE miss. One miss on venue ' +
      'wifi is ordinary; firing on it means every guest sees an error that is ' +
      'not true, including on an ordinary quiet first load.',
  );
});
