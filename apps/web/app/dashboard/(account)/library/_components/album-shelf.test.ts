/**
 * album-shelf.test.ts — the shelf shows every event, oldest first.
 *
 * Owner 2026-08-19, asked twice and answered plainly: *"show all eight
 * events."* Production has 8 events and 14 photos, ALL 14 on one of them — so
 * 7 covers are empty right now. Dropping the empty ones would make an event
 * somebody is actively planning vanish from their own gallery, and the bug
 * would look like a design choice.
 *
 * Both rules are silent when broken: a filtered shelf renders perfectly with
 * fewer covers, and a mis-sorted shelf renders perfectly in the wrong order.
 *
 * 🛡 Every assertion here was mutation-checked — each rule broken on purpose,
 * the OCCURRENCE COUNT printed before and after to prove the sabotage landed,
 * and the test confirmed RED before being trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHELF = readFileSync(resolve(HERE, 'album-shelf.tsx'), 'utf8');
const PAGE = readFileSync(resolve(HERE, '..', 'page.tsx'), 'utf8');
/** Comments state the rules; they must never satisfy them. */
const CODE = SHELF.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

test('no album is filtered out for being empty', () => {
  assert.equal(
    /\.filter\(\s*\(?\w+\)?\s*=>[^)]*\bcount\b/.test(CODE),
    false,
    'The shelf drops empty albums. The owner said "show all eight events" — and ' +
      '7 of 8 are empty in production today, so this hides almost everything.',
  );
  assert.ok(
    /albums\.length === 0/.test(CODE),
    'Only a total absence of events may render nothing.',
  );
});

test('the shelf sorts by the event date, not by who owns it', () => {
  assert.ok(
    /\.sort\(/.test(CODE) && /event_date/.test(CODE),
    'Chronological was the whole ask. getPhotosAlbums returns owned-then-attended ' +
      'for the ?tab=albums grid, so the shelf must sort its own copy.',
  );
  assert.ok(
    /\[\.\.\.albums\]\.sort\(/.test(CODE),
    'Sort a COPY — mutating the shared array would silently reorder the albums tab.',
  );
});

test('an undated event still gets a cover', () => {
  assert.ok(
    /if \(da\) return -1;[\s\S]{0,80}if \(db\) return 1;/.test(CODE),
    'Undated events must sort to the end, not be dropped: an event with no date ' +
      'yet is the most likely to be empty and the least useful to hide.',
  );
});

test('a clip cover is marked as a clip', () => {
  assert.ok(
    /cover\.isClip/.test(CODE),
    'Photos and videos share one collection (photo_type photo|clip). A video ' +
      'cover with no play badge is indistinguishable from a still.',
  );
});

test('the shelf is actually mounted above the library grid', () => {
  // A component that ships unmounted is this repo's most repeated defect.
  assert.ok(/<AlbumShelf userId=/.test(PAGE), 'AlbumShelf is not rendered on Alaala');
  assert.ok(
    PAGE.indexOf('<AlbumShelf') < PAGE.indexOf('LENSES.map'),
    'The shelf must come BEFORE the lens row — "first row … then under it the grid".',
  );
});
