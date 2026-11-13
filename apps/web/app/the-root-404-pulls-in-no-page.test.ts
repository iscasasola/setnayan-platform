/**
 * GUARD — the root 404 must not make every page download the front door's JavaScript.
 *
 * WHY THIS EXISTS (measured 2026-11-13, production build, Lighthouse mobile from `.lighthouserc.json`):
 * `/login` downloaded `static/chunks/app/page-*.js` — the FRONT DOOR's page chunk — and the seventeen chunks under it,
 * ~200KB of script the sign-in card never runs. Its Lighthouse mobile LCP sat near 6 s.
 *
 * THE MECHANISM. The root `app/not-found.tsx` is the root layout's not-found boundary, so its element is written into
 * the RSC payload of EVERY route. A `<Link>` rendered by a SERVER component there becomes a client reference to
 * `next/link` carrying a chunk list, and Next 15.5 builds that list by merging the root group's manifests with
 * `Object.assign` (next/dist/build/webpack/plugins/flight-manifest-plugin.js, `mergeManifest`) — the LAST root entry to
 * record `next/link` wins, and that was `app/page`. Any route that did not record `next/link` itself (like `/login`)
 * then shipped all of `/`'s JavaScript in its HTML.
 *
 * THE RULE. The two root files whose server output is in every route's payload — `app/layout.tsx` and
 * `app/not-found.tsx` — never import `next/link` (or `next/image`, same mechanism) directly. Their links live in a
 * `'use client'` island (`app/not-found-links.tsx`), whose ONE client reference is recorded by its own entry only.
 *
 * Comments are stripped first, so the explanation in those files cannot satisfy or trip this guard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

const SHARED_ROOT_SERVER_FILES = ['app/layout.tsx', 'app/not-found.tsx'];
const SHARED_CLIENT_REFS = /from\s+['"]next\/(link|image)['"]/;

test('the root layout and the root 404 import no next/link or next/image as server components', () => {
  for (const f of SHARED_ROOT_SERVER_FILES) {
    const src = read(f);
    assert.doesNotMatch(src, /^\s*['"]use client['"]/m, `${f} is expected to stay a server file — rewrite this guard`);
    assert.doesNotMatch(
      src,
      SHARED_CLIENT_REFS,
      `${f} imports next/link or next/image directly. Its output is in EVERY route's payload, so that reference ships ` +
        `the front door's chunks to pages like /login. Put the link in a 'use client' island (see app/not-found-links.tsx).`,
    );
  }
});

test("the root 404's links are a client island and it still renders them", () => {
  const island = read('app/not-found-links.tsx');
  assert.match(island, /^\s*['"]use client['"]/, 'app/not-found-links.tsx must start with "use client"');
  assert.match(island, /href="\/"/, 'the 404 still offers the way home');
  assert.match(island, /href="\/\?browse=1"/, 'the 404 still offers Browse suppliers');
  assert.match(read('app/not-found.tsx'), /<NotFoundLinks\s*\/>/, 'app/not-found.tsx renders <NotFoundLinks />');
});
