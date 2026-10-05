/**
 * the-maker-never-imports-the-guest-bridge.test.ts — 2026-09-30 (#6187).
 *
 * The shared bundle (`scripts/check-bundle-size.mjs`, 202KB) is measured on
 * EVERY page, and webpack's runtime in it carries one entry per async chunk.
 * When the Maker imported `findMakerSection` from the guest page's editing
 * bridge (`app/[slug]/_components/editor-bridge.tsx`, ~32KB), the bridge was
 * shared by two chunk groups and split into a chunk of its own — one more
 * runtime entry, and the shared bundle went over by bytes. The Maker reads the
 * small `maker-section-find.ts` instead; only the guest page mounts the bridge.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');

test('only the guest page imports the editing bridge — the Maker imports maker-section-find', () => {
  const hits = execFileSync('git', ['grep', '-l', '-E', "from '[^']*editor-bridge'", '--', 'app', 'lib', 'components'], {
    cwd: APP,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((f) => f && !/\.test\.tsx?$/.test(f));
  // The dev Maker lab's canvas stand-in is a guest page of its own (dev-only, 404 in production).
  assert.deepEqual(hits, ['app/[slug]/_components/site-body.tsx', 'app/dev/maker-lab/guest/page.tsx'], `these import the bridge:\n  ${hits.join('\n  ')}`);
});
