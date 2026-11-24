/**
 * GUARD — the front page draws its small pictures from small files (speed pass, 24 Nov 2026).
 *
 * Measured on production at 390 px, Fast 4G, 4× CPU (median of 3): a first open of `/` downloaded 9.9 MB, 9.1 MB of it
 * the sample wedding's full photos (`public/demo/maria-jose/*.webp`, 1.1–1.8 MB each) drawn as a 124 × 156 Papic pile
 * and a 150-px event tile. The page's load event came at 11.2 s and its main thread was busy decoding them until
 * ~10 s. The pile, the shelf and the 64-px "Keep it" row now read copies at their drawn size (`sm/`, 480–560 px on the
 * short side, 11–62 KB). Held as properties of the files, never a pinned list:
 *
 *   1 · EVERY SMALL COPY THE PAGE ASKS FOR EXISTS. Each `demoSmallPhoto('k')` / `marketingSmallPhoto('k')` in the
 *       landing names a file in its `sm/` folder — a missing copy would be a broken picture on the front page.
 *   2 · A SMALL COPY STAYS SMALL. Every file in those `sm/` folders is under 80 KB — a full render dropped in under
 *       the same name would quietly bring the megabytes back.
 *   3 · NO FULL DEMO PHOTO COMES BACK. The landing names no `/demo/maria-jose/<name>.webp` outside `sm/`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const PUBLIC = join(WEB, 'public');
const LANDING = stripComments(readFileSync(join(HERE, 'front-door-landing.tsx'), 'utf8'));

const SMALL = [
  { call: 'demoSmallPhoto', dir: join(PUBLIC, 'demo', 'maria-jose', 'sm') },
  { call: 'marketingSmallPhoto', dir: join(PUBLIC, 'marketing', '2026-11-04', 'sm') },
] as const;

/** Under this, a copy is a tile-size picture; a full render is 70 KB – 2.4 MB. */
const SMALL_COPY_MAX_BYTES = 80 * 1024;

test('1 · every small copy the front page asks for exists', () => {
  let asked = 0;
  for (const { call, dir } of SMALL) {
    for (const m of LANDING.matchAll(new RegExp(`${call}\\('([^']+)'\\)`, 'g'))) {
      asked += 1;
      assert.ok(existsSync(join(dir, `${m[1]}.webp`)), `${call}('${m[1]}') has no file in ${dir}`);
    }
  }
  assert.ok(asked >= 6, 'the landing no longer asks for its small copies — the full photos are back on the front page');
});

test('2 · a small copy stays small', () => {
  for (const { dir } of SMALL) {
    const files = readdirSync(dir).filter((f) => f.endsWith('.webp'));
    assert.ok(files.length > 0, `${dir} is empty`);
    for (const f of files) {
      const size = statSync(join(dir, f)).size;
      assert.ok(size < SMALL_COPY_MAX_BYTES, `${f} is ${Math.round(size / 1024)} KB — not a small copy`);
    }
  }
});

test('3 · no full sample-wedding photo comes back on the front page', () => {
  const full = [...LANDING.matchAll(/\/demo\/maria-jose\/(?!sm\/)[\w-]+\.webp/g)].map((m) => m[0]);
  assert.deepEqual(full, [], 'the front page draws a full 1–2 MB photo where a small copy belongs');
});
