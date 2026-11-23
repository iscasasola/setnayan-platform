/**
 * vendor-card.test.ts — E1 follow-up (2026-09-11).
 *
 * A regression pin for a real production bug: the first version of this
 * module embedded a shop's logo as a data-URI `<img>` node INSIDE the satori
 * tree. `satori` reads an `<img>` node's `src` off a TOP-LEVEL prop, but this
 * file's own `el(type, style, children)` helper puts its second argument
 * under `props.style` — correct for every other node type here, silently
 * wrong for `<img>` (`props.style.src` is not `props.src`). Every render for
 * a shop WITHOUT a logo worked; every render for a shop WITH one threw
 * "Image source is not provided" and the route's catch-all 302'd to the
 * static brand card. Reproduced locally against the real `setnaprod`
 * fixture's actual logo (fetched from its public R2 host) before the fix.
 *
 * `vendor-card.tsx` cannot be imported directly here — it carries
 * `import 'server-only'`, which is not installed for `node:test` (same
 * constraint every other satori card in `lib/social/` lives under; none of
 * them are import-tested directly). So this is a source-scan pin, the
 * established pattern in this codebase for exactly this class of file: it
 * asserts the module NEVER hands satori an `<img>` node again, and instead
 * always composites the logo as a raster tile via `sharp`'s proven
 * `.composite()` — the same technique `profile-card.tsx` uses for its hero
 * photo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = stripComments(readFileSync(join(HERE, 'vendor-card.tsx'), 'utf8'));

test('the logo is never handed to satori as an <img> node', () => {
  assert.doesNotMatch(
    src,
    /el\(\s*'img'/,
    "an <img> node's src is a top-level satori prop, not props.style.src — el() " +
      "cannot express that correctly, and this exact mistake 302'd every logo'd shop's card in production",
  );
});

test('every picture is composited onto the card with sharp — the photo is the ground, never a satori image', () => {
  assert.match(src, /sharp\(ground\)\.composite\(layers\)/, 'the photo (or the dark ground) is the base the layers go on');
  for (const spot of ['LOGO_TILE', 'spot', 'BADGE_ROW', 'MARK']) {
    assert.match(src, new RegExp(`${spot}\\.(top|left)`), `${spot} is placed at its fixed spot by a composite`);
  }
});

test('a picture that fails is left out — the card is still drawn', () => {
  assert.match(src, /const ground = photo \?\? /, 'no photo → the dark Setnayan ground, never a broken image');
  assert.match(src, /if \(tile\)/, 'no logo → no tile');
  assert.match(src, /tile \? SEAL_ON_LOGO : SEAL_SOLO/, 'no logo → the seal moves to the middle');
  assert.match(src, /medals: medalPics\.length/, 'a medal whose art failed is left out before the row is laid out');
});

test('the seal art is the approved v84 art, never a re-draw', () => {
  assert.match(src, /verifiedV84Svg\(/, 'Verified: the v84 check');
  assert.match(src, /sealArtSvgNoYear\('verified_partner'/, 'Partner: the v84 seal, without its year at this size');
  assert.match(src, /resolvePrintBadgeArt\(/, 'the row: the same art resolver the prints use');
  assert.match(src, /SETNAYAN_MARK_PATH/, 'the mark: the shipped geometry');
});
