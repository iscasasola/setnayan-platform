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

test('the logo is composited onto the rendered PNG with sharp, not embedded pre-render', () => {
  assert.match(
    src,
    /\.composite\(\[\{\s*input:\s*tile/,
    'the logo tile must be layered onto the finished satori+sharp PNG via .composite(), the same proven ' +
      'technique profile-card.tsx uses for its hero photo',
  );
});

test('a missing/broken logo degrades to the plain card, never throws', () => {
  assert.match(
    src,
    /if \(!tile\) return base\.toBuffer\(\);/,
    'renderVendorOgPng must still return a valid card when the logo tile is null',
  );
});
