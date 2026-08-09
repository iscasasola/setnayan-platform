/**
 * THE PROTECTED LIST MUST BE DERIVED FROM THE REAL PAGES, NOT TYPED.
 *
 * A hand-typed list is silent about whatever nobody typed into it. On
 * 2026-08-09 fourteen real, claimable top-level pages were missing from it —
 * including /creators and /open-shop, which are LIVE and in our sitemap — so a
 * shop, a wedding or a person could take one of our own web addresses.
 *
 * This test re-reads `apps/web/app` from disk and fails naming any route word
 * that the committed list does not protect. Add a page tomorrow and this test,
 * not a human's memory, is what notices.
 *
 * Run: pnpm --filter @setnayan/web test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { routeSlugsFromDisk } from '../scripts/gen-reserved-slugs.mjs';
import {
  DB_MIRRORED_RESERVED_SLUGS,
  RESERVED_SLUGS,
  ROUTE_RESERVED_SLUGS,
  isReservedSlug,
} from './reserved-slugs';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'app');

test('every real top-level page is a protected word', () => {
  const onDisk: string[] = routeSlugsFromDisk(APP_DIR);
  assert.ok(
    onDisk.length > 40,
    `precondition: the app directory was actually read (found ${onDisk.length})`,
  );
  // The two the 2026-08-09 audit named by hand — if the reader ever stops
  // seeing folders, these anchor the failure to something recognisable.
  assert.ok(onDisk.includes('creators'), 'precondition: /creators was seen on disk');
  assert.ok(onDisk.includes('open-shop'), 'precondition: /open-shop was seen on disk');

  const unprotected = onDisk.filter((word) => !isReservedSlug(word));
  assert.deepEqual(
    unprotected,
    [],
    'these are real pages of ours that a shop, wedding or person could claim as their address — run `node scripts/gen-reserved-slugs.mjs`',
  );
});

test('the generated block matches the folders on disk exactly', () => {
  // Catches the other direction too: a page DELETED without regenerating leaves
  // a phantom reservation blocking a name nobody needs to block.
  const onDisk: string[] = routeSlugsFromDisk(APP_DIR);
  assert.deepEqual(
    [...ROUTE_RESERVED_SLUGS].sort(),
    [...onDisk].sort(),
    'lib/reserved-slugs.ts is stale — run `node scripts/gen-reserved-slugs.mjs` from apps/web',
  );
});

test('the hand-typed half is still a strict part of the whole list', () => {
  // The database mirrors DB_MIRRORED_RESERVED_SLUGS only
  // (public.business_slug_is_reserved). Losing a word from it would silently
  // stop the db parity test from covering that word.
  for (const word of DB_MIRRORED_RESERVED_SLUGS) {
    assert.ok(RESERVED_SLUGS.has(word), `${word} fell out of the combined list`);
  }
  assert.ok(DB_MIRRORED_RESERVED_SLUGS.size > 50, 'precondition: the mirrored half was read');
});

/**
 * A FIXTURE TREE, because the real one cannot prove this.
 *
 * The reader used to look at the DIRECT CHILDREN of `apps/web/app` only, so a
 * page inside a Next.js route group — `app/(marketing)/foo/page.tsx`, which
 * serves `/foo` — was invisible to it AND to the test above, which asks the
 * same reader. Both would have stayed green while `/foo` sat unprotected.
 * `apps/web/app` has no top-level group today, so only a built tree can fail
 * this. Build one.
 */
function withFixtureApp(
  paths: string[],
  run: (appDir: string) => void,
): void {
  const root = mkdtempSync(path.join(os.tmpdir(), 'setnayan-reserved-'));
  try {
    for (const rel of paths) {
      const full = path.join(root, rel);
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, '// fixture\n');
    }
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('a page inside a route group is still a top-level word', () => {
  withFixtureApp(
    [
      '(marketing)/foo/page.tsx',
      '(marketing)/(nested)/bar/page.tsx',
      '@modal/baz/page.tsx',
      'plain/page.tsx',
      'api-ish/deep/route.ts',
    ],
    (appDir) => {
      const words: string[] = routeSlugsFromDisk(appDir);
      assert.deepEqual(words, ['api-ish', 'bar', 'baz', 'foo', 'plain']);
    },
  );
});

test('a route group itself is never reserved, and non-serving folders are skipped', () => {
  withFixtureApp(
    ['(marketing)/foo/page.tsx', '_components/thing.tsx', 'empty-shell/notes.md'],
    (appDir) => {
      const words: string[] = routeSlugsFromDisk(appDir);
      assert.deepEqual(words, ['foo'], 'only the words that actually serve a URL');
    },
  );
});

test('the reserved check is case-insensitive and exact-match only', () => {
  assert.equal(isReservedSlug('CREATORS'), true);
  assert.equal(isReservedSlug('open-shop'), true);
  // A word that merely CONTAINS a reserved word is a perfectly good address.
  assert.equal(isReservedSlug('creators-manila'), false);
  assert.equal(isReservedSlug('open-shop-ph'), false);
});
