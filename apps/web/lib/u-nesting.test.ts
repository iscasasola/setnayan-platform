/**
 * `/u/{userSlug}/…` nesting — what gets rewritten to an event, and what must not.
 *
 * THE BUG THIS LOCKS: the middleware rewrote every 3-segment `/u/` path to an
 * event URL by stripping the first two segments, which turned a storyteller's
 * chapter page `/u/{slug}/c/{id}` into `/c/{id}` — not an event, so it 404'd.
 * Measured on the live site 2026-08-12: a published, video-less chapter rendered
 * a real share card (so the data was fine) while its own page returned 404, and
 * a brand-new never-requested chapter URL 404'd on first request. The chapter
 * page had never once been reachable in production, because publishing required
 * an external video account until that day and prod held zero chapters.
 *
 * The last test derives the truth from the FILESYSTEM, so adding a route under
 * `app/u/[userSlug]/` without listing it fails here instead of silently 404ing
 * in production.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { U_SUBPATH_ROUTES, userNestingRewritePath } from './u-nesting';

test('the chapter route is NOT treated as a nested event', () => {
  // The regression, stated as plainly as it can be.
  assert.equal(userNestingRewritePath('/u/ana-at-marco/c/S89C-CK46HS1VSS'), null);
});

test('a nested EVENT still rewrites to the bare-root event route', () => {
  assert.equal(userNestingRewritePath('/u/ana-at-marco/our-wedding'), '/our-wedding');
});

test('a nested event SUBROUTE keeps its tail', () => {
  assert.equal(
    userNestingRewritePath('/u/ana-at-marco/our-wedding/find-my-table'),
    '/our-wedding/find-my-table',
  );
});

test('a bare profile is never rewritten', () => {
  assert.equal(userNestingRewritePath('/u/ana-at-marco'), null);
  assert.equal(userNestingRewritePath('/u/ana-at-marco/'), null);
});

test('paths outside /u/ are not this function’s business', () => {
  assert.equal(userNestingRewritePath('/v/some-shop'), null);
  assert.equal(userNestingRewritePath('/realstories'), null);
  assert.equal(userNestingRewritePath('/'), null);
});

test('a one-char segment can never be a real event slug anyway', () => {
  // Slugs are ^[a-z0-9-]{3,32}$ — this is why reserving `c` costs nothing.
  assert.ok(!/^[a-z0-9-]{3,32}$/.test('c'));
});

test('THE GUARD: every real route under app/u/[userSlug]/ is reserved', () => {
  // Derived from disk, not hand-typed — a hand-typed list on both sides is not
  // a guard, it is two copies of the same assumption.
  const dir = join(process.cwd(), 'app', 'u', '[userSlug]');
  const routeDirs = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    // `[param]` dirs are dynamic segments (an event slug would land there);
    // `_private` dirs are not routes at all.
    .filter((n) => !n.startsWith('[') && !n.startsWith('_'));

  assert.ok(
    routeDirs.length > 0,
    'found no route dirs under app/u/[userSlug] — the path is wrong, so this ' +
      'guard would pass no matter what. A search that cannot match is not a ' +
      'negative result.',
  );

  for (const name of routeDirs) {
    assert.ok(
      U_SUBPATH_ROUTES.has(name),
      `app/u/[userSlug]/${name}/ is a real route but is not in U_SUBPATH_ROUTES, ` +
        `so the middleware will rewrite /u/{slug}/${name}/… to /${name}/… and it ` +
        `will 404 in production while every local check stays green. Add it.`,
    );
  }
});
