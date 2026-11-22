/**
 * the-bundle-check-counts-what-a-page-loads.test.ts — the shared first-load ceiling
 * (`scripts/check-bundle-size.mjs`, DECISION_LOG 2026-05-22 KPI, redefined 2026-10-22)
 * counts the chunks a real app page's HTML makes the browser download, and nothing else.
 *
 * Until 2026-10-22 the check counted `framework` + `main` — loaded only by the legacy
 * pages router — and never saw the root layout's own JavaScript. This builds a tiny fake
 * `.next` and proves the new rule on it: the root layout's chunk COUNTS, a legacy-only
 * chunk does NOT, `polyfills-*` (noModule) does NOT, a chunk only one page loads is not
 * "shared", inflating the layout's chunk moves the number, and a blind scan fails rather
 * than passing at zero. (The real build is measured in CI's bundle-size job.)
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { MAX_SHARED_FIRST_LOAD_GZIP, chunksInHtml, measure } from '../scripts/check-bundle-size.mjs';

const ROOT = ['static/chunks/webpack-aaaa.js', 'static/chunks/main-app-bbbb.js'];
const LAYOUT = 'static/chunks/app/layout-cccc.js';
const LEGACY = ['static/chunks/framework-dddd.js', 'static/chunks/main-eeee.js'];

/** Deterministic, poorly-compressible bytes, so a size difference survives gzip. */
function noise(n: number, seed: number): string {
  let x = seed >>> 0;
  let s = '';
  for (let i = 0; i < n; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    s += String.fromCharCode(33 + ((x >>> 16) % 90));
  }
  return s;
}

function fakeBuild(opts: { pages?: number; layoutBytes?: number; dropRootFromHtml?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'bundle-check-'));
  const write = (rel: string, body: string) => {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), body);
  };
  for (const [i, c] of [...ROOT, ...LEGACY].entries()) write(c, noise(4000, i + 1));
  write(LAYOUT, noise(opts.layoutBytes ?? 6000, 99));
  write('static/chunks/polyfills-ffff.js', noise(9000, 7));
  write('static/chunks/app/terms/page-1111.js', noise(3000, 11));
  write('build-manifest.json', JSON.stringify({ rootMainFiles: ROOT, pages: { '/_app': LEGACY, '/_error': [LEGACY[1]] } }));
  write('app-build-manifest.json', JSON.stringify({ pages: {} }));
  const n = opts.pages ?? 6;
  for (let i = 0; i < n; i++) {
    const root = opts.dropRootFromHtml && i === 0 ? [] : ROOT;
    const tags = [...root, LAYOUT].map((c) => `<script src="/_next/${c}" async=""></script>`).join('');
    // Page 0 also loads its own route chunk, named only in the RSC payload (escaped quotes, as Next writes it).
    const flight = i === 0 ? `<script>self.__next_f.push([1,"3:I[1,[\\"static/chunks/app/terms/page-1111.js\\"],\\"T\\"]"])</script>` : '';
    write(`server/app/p${i}.html`, `<html><head><script src="/_next/static/chunks/polyfills-ffff.js" noModule=""></script>${tags}</head><body>${flight}</body></html>`);
  }
  return dir;
}

const gzOf = (dir: string, c: string) => gzipSync(readFileSync(join(dir, c))).length;

test('the shared set is the runtime + the ROOT LAYOUT — not framework/main (legacy only), not polyfills, not one page’s own chunk', () => {
  const dir = fakeBuild();
  try {
    const m = measure(dir);
    assert.deepEqual(m.shared.map((c: { chunk: string }) => c.chunk).sort(), [...ROOT, LAYOUT].sort());
    assert.equal(m.gzip, [...ROOT, LAYOUT].reduce((n, c) => n + gzOf(dir, c), 0));
    assert.deepEqual(m.legacy.map((c: { chunk: string }) => c.chunk).sort(), [...LEGACY].sort(), 'framework/main are reported as legacy-only');
    assert.equal(m.largest.page, 'p0.html', 'the page whose RSC payload names its own route chunk is the heaviest');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('inflating the root layout’s chunk moves the number by exactly its gzip growth', () => {
  const small = fakeBuild({ layoutBytes: 6000 });
  const big = fakeBuild({ layoutBytes: 60000 });
  try {
    const grow = gzOf(big, LAYOUT) - gzOf(small, LAYOUT);
    assert.ok(grow > 30000, `the fixture's layout grew by only ${grow} B gz`);
    assert.equal(measure(big).gzip - measure(small).gzip, grow);
  } finally {
    rmSync(small, { recursive: true, force: true });
    rmSync(big, { recursive: true, force: true });
  }
});

test('a blind scan fails instead of passing at zero', () => {
  const few = fakeBuild({ pages: 2 });
  const lost = fakeBuild({ dropRootFromHtml: true });
  try {
    assert.throws(() => measure(few), /prerendered app pages/);
    assert.throws(() => measure(lost), /root files are not in every page's HTML/);
  } finally {
    rmSync(few, { recursive: true, force: true });
    rmSync(lost, { recursive: true, force: true });
  }
});

test('chunk names are read from script tags and the RSC payload, URL-decoded, polyfills excluded', () => {
  const got = chunksInHtml(
    '<script src="/_next/static/chunks/polyfills-1.js" noModule></script>' +
      '<script src="/_next/static/chunks/app/dashboard/%5BeventId%5D/page-2.js"></script>' +
      '<script>self.__next_f.push([1,"I[9,[\\"static/chunks/4705-3.js\\"]]"])</script>',
  );
  assert.deepEqual([...got].sort(), ['static/chunks/4705-3.js', 'static/chunks/app/dashboard/[eventId]/page-2.js']);
});

test('the ceiling is a real number, not the placeholder', () => {
  assert.ok(MAX_SHARED_FIRST_LOAD_GZIP > 100 * 1024, `MAX_SHARED_FIRST_LOAD_GZIP is ${MAX_SHARED_FIRST_LOAD_GZIP}`);
});
