/**
 * redirect-is-a-redirect.test.ts — a route whose only job is to redirect must
 * actually redirect, not serve an empty page with a 200.
 *
 * ─── THE DEFECT, MEASURED ON THE LIVE SITE ───────────────────────────────
 * `/explore/categories` exists solely to `redirect('/explore')`. It shipped a
 * `GridPageSkeleton` loading boundary, and a loading boundary forces STREAMING
 * — the response commits before the page body runs. Measured on
 * `www.setnayan.com`:
 *
 *     /explore/categories   HTTP 200 · no Location header · 83,797 bytes
 *     /explore/compare      HTTP 200 · no Location header · 117,226 bytes
 *
 * Eighty kilobytes of empty shell, and a crawler indexes it as a real page.
 * After deleting the boundary: `HTTP 307 · location: /explore`.
 *
 * 🔑 SAME FAMILY THE REPO ALREADY PAID FOR. `app/v/[slug]/loading.tsx` was
 * deleted in 2026-08 because it forced streaming, so the shell committed HTTP
 * 200 before `notFound()` ran and every junk shop URL told Google it had found
 * a page. `first-byte.test.ts` was written to hold that — and it covered the
 * `notFound()` shape on one route family, not the `redirect()` shape here.
 * **When you fix a route-shaped bug, sweep every route with that shape.**
 *
 * ─── 🪤 A LOADING BOUNDARY IS INHERITED BY CHILD SEGMENTS ────────────────
 * This is the part that is easy to get wrong, and it was PROVEN by experiment,
 * not assumed. `/explore/compare` had its own `loading.tsx` deleted and STILL
 * returned 200. Temporarily moving the PARENT's `app/(shell)/explore/
 * loading.tsx` out of the way flipped it to `307 · location: /explore`, and
 * restoring it flipped it back.
 *
 * So `loading.tsx` covers its segment AND everything beneath it. Two
 * consequences, both counter-intuitive:
 *   • compare's own boundary file was REDUNDANT — its docblock claimed "the
 *     file still has to exist or this route prefetches an empty tree", and the
 *     parent had been supplying one all along. It is deleted.
 *   • compare CANNOT get a server-side redirect without removing the boundary
 *     from `/explore` itself, which is a busy browse page that wants one.
 *     Named, not silently fixed — see "still open" below.
 *
 * ─── WHAT THIS GUARD ASSERTS ─────────────────────────────────────────────
 * Only the narrow, checkable thing: a redirect-only route has no loading
 * boundary anywhere on its own path. It deliberately does NOT try to police
 * every route that can redirect — fifty routes call `redirect()` under a
 * boundary and almost all sit behind a login, where a client-side redirect
 * harms nobody and no crawler ever arrives.
 *
 * ⏭ STILL OPEN, deliberately: `/explore/compare` still answers 200 with an
 * empty shell for a crawler. The honest fix is a product decision — render a
 * real "nothing to compare yet" state with a way back, rather than redirect —
 * because the alternative costs `/explore` its prefetch boundary.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const HERE = import.meta.dirname;
const APP = path.join(HERE, '..', '..');

test('this route still exists only to redirect', () => {
  /*
    The guard below is only meaningful while that is true. If this page grows a
    real body, the boundary question changes and this file should be revisited
    rather than kept passing.
  */
  const src = readFileSync(path.join(HERE, 'page.tsx'), 'utf8').replace(
    /\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm,
    '',
  );
  assert.match(
    src,
    /redirect\('\/explore'\)/,
    'The categories route no longer redirects to /explore.',
  );
  assert.ok(
    !src.includes('<main'),
    'The categories route grew a <main>. It was a pure redirect; if it now ' +
      'renders something, the no-boundary rule below needs rethinking.',
  );
});

test('no loading boundary sits anywhere on this route path', () => {
  /*
    ⚠ CHECKS EVERY ANCESTOR, NOT JUST THIS DIRECTORY — because a boundary is
    inherited. Deleting the file here and leaving one on `app/explore/` would
    look fixed and behave exactly as broken. That is the trap this whole file
    exists to write down, so the guard has to model it.
  */
  const offenders: string[] = [];
  for (const dir of [HERE, path.join(HERE, '..'), APP]) {
    const p = path.join(dir, 'loading.tsx');
    if (existsSync(p)) offenders.push(path.relative(APP, p));
  }
  assert.deepEqual(
    offenders,
    [],
    'A loading boundary covers /explore/categories:\n' +
      offenders.map((o) => `  - app/${o}`).join('\n') +
      '\nA boundary forces streaming, so the response commits BEFORE ' +
      "redirect() runs — the route answers 200 with an empty shell and no " +
      'Location header, and a crawler indexes 80KB of nothing. Measured on ' +
      'the live site before this was fixed.',
  );
});

test('the route is not statically rendered — a redirect must be evaluated', () => {
  const src = readFileSync(path.join(HERE, 'page.tsx'), 'utf8');
  assert.doesNotMatch(
    src,
    /^export const dynamic = 'force-static'/m,
    'A force-static redirect route would be resolved once at build time.',
  );
});
