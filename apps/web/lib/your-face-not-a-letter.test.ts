/**
 * your-face-not-a-letter.test.ts — the circle that stands in for a person.
 *
 * Two defects of one family, found by sweeping for every surface that paints a
 * stand-in for the SIGNED-IN person:
 *
 *   1. The home composer — the "What's your event?" row — showed the first
 *      letter of your name in the exact slot a profile picture belongs, on a
 *      page whose top bar was already showing your actual photo. Two different
 *      faces for the same person, inches apart.
 *
 *   2. The call room derived its monogram by slicing character zero off
 *      WHATEVER STRING IT WAS HANDED — and every string it was handed except
 *      one was a STATUS. Turning your own camera off drew a circle reading
 *      "C" ("Camera off"); waiting for your supplier drew "W"; your own voice
 *      tile drew "Y" ("You"). None is an initial. All three read as a broken
 *      monogram, because a lone capital in a circle is exactly what a monogram
 *      looks like.
 *
 * 🔑 A STATUS IS NOT A NAME. The caption already carries the words; the circle
 * takes an icon. The ONE label here that genuinely is a name — the supplier on
 * the other end — now passes its initial EXPLICITLY, so the difference between
 * "this is a person" and "this is a state" is stated in the call, not guessed
 * at from the string.
 *
 * 🔑 AND A STORED REF IS NOT A URL. `users.profile_photo_url` holds `r2://…`.
 * Handing the raw value to an <img> renders a broken glyph silently — so the
 * resolution is asserted here, not just the presence of the photo.
 *
 * 🛡 Every assertion mutation-checked by occurrence count, each confirmed RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Comments are stripped because BOTH files carry a note naming the very string
// the defect used to contain. A raw-source guard would read the explanation of
// the fix as the bug itself.
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const CALL_ROOM = 'app/_components/thread-call-room.tsx';
const LAUNCHER = 'app/dashboard/(launcher)/page.tsx';

test('the call room never slices a monogram out of a caption', () => {
  const src = read(CALL_ROOM);
  const slices = src.match(/label\.slice\(/g) ?? [];
  assert.equal(
    slices.length,
    0,
    `a caption is being sliced into a monogram again (${slices.length} site(s)) — ` +
      'that is how "Camera off" became the letter C',
  );
});

test('only a real name carries an initial, and it says so at the call site', () => {
  const src = read(CALL_ROOM);
  // Exactly one: the counterparty. Your own tile and both status tiles must not.
  const passed = src.match(/initial=\{/g) ?? [];
  assert.equal(passed.length, 1, 'exactly one label here is a person, not a state');
  assert.match(
    src,
    /initial=\{counterpartyLabel\.slice\(0, 1\)\.toUpperCase\(\)\}/,
    'the one initial must come from the counterparty NAME',
  );
});

test('every status circle in the call room is given an icon', () => {
  const src = read(CALL_ROOM);
  const avatars = src.match(/<Avatar\b/g) ?? [];
  const icons = src.match(/icon=\{/g) ?? [];
  assert.ok(avatars.length > 0, 'non-vacuity: the status avatar must still exist');
  assert.equal(icons.length, avatars.length, 'every status circle takes an icon, never a letter');
});

test('the launcher actually reads the photo column', () => {
  const src = read(LAUNCHER);
  assert.match(
    src,
    /\.select\('display_name, profile_photo_url'\)/,
    'the composer cannot show a face the page never asked the database for',
  );
});

test('the composer photo is RESOLVED, never a raw r2:// ref', () => {
  const src = read(LAUNCHER);
  assert.match(
    src,
    /composerPhotoUrl\s*=[\s\S]{0,200}?displayUrlForStoredAsset\(/,
    'a stored ref in an <img> is a broken glyph and says nothing about why',
  );
});

test('the composer renders the photo, with the letter only as a fallback', () => {
  const src = read(LAUNCHER);
  assert.match(src, /photoUrl \? \(/, 'the photo must be preferred when present');
  assert.match(src, /src=\{photoUrl\}/, 'the resolved photo must reach an <img>');
  assert.match(src, /\) : \(\s*initial\s*\)/, 'the initial must remain the fallback');
});
