/**
 * robots.txt never "Allow"s a bare path whose own page does not exist, and the
 * bare /explore/compare is a real redirect, not an in-stream one.
 *
 * Quality sweep 2026-10-13, item 10: `/tl` returned 404 while robots.ts listed
 * it as an Allow entry. /tl is a locale PREFIX (/tl/about, /tl/features…), so
 * it is listed as '/tl/'. Rule: an Allow entry WITHOUT a trailing slash whose
 * folder exists in app/ (in any route group) must have a page of its own there.
 * An entry with no folder at all is a forward-looking reservation (the playbook
 * pre-allows unshipped surfaces) and is skipped.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const APP = dirname(fileURLToPath(import.meta.url));
const WEB = join(APP, '..');

const isGroup = (n: string) => /^\(.+\)$/.test(n);
const dirsUnder = (d: string) => (existsSync(d) ? readdirSync(d).filter((n) => statSync(join(d, n)).isDirectory()) : []);

/** Every folder that serves URL `path` — through route groups at any level. */
function folders(path: string): string[] {
  let level = [APP];
  for (const seg of path.split('/').filter(Boolean)) {
    const next: string[] = [];
    const expand = (d: string): string[] => [d, ...dirsUnder(d).filter(isGroup).flatMap((g) => expand(join(d, g)))];
    for (const d of level.flatMap(expand)) if (existsSync(join(d, seg))) next.push(join(d, seg));
    level = next;
  }
  return level;
}
function hasOwnPage(dir: string): boolean {
  if (existsSync(join(dir, 'page.tsx'))) return true;
  return dirsUnder(dir).filter(isGroup).some((g) => hasOwnPage(join(dir, g)));
}

test('every bare robots Allow entry with a folder has a page of its own', () => {
  const src = stripComments(readFileSync(join(APP, 'robots.ts'), 'utf8'));
  const block = src.slice(src.indexOf('const ALLOWED_PATHS'), src.indexOf('];', src.indexOf('const ALLOWED_PATHS')));
  const entries = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
  assert.ok(entries.length >= 8, `read ${entries.length} Allow entries — did robots.ts change shape?`);
  const bad: string[] = [];
  let checked = 0;
  for (const e of entries) {
    if (e === '/' || e.endsWith('/')) continue;
    const dirs = folders(e);
    if (dirs.length === 0) continue; // forward-looking reservation, not shipped
    checked++;
    if (!dirs.some(hasOwnPage)) bad.push(`${e} (folder exists, no page of its own — a crawler gets a 404; use '${e}/' for a prefix)`);
  }
  assert.ok(checked >= 5, `only ${checked} entries resolved to folders — the resolver is blind`);
  assert.deepEqual(bad, [], 'robots.ts allows a bare path that 404s:\n  ' + bad.join('\n  '));
});

test('a bare /explore/compare is redirected by the middleware before anything streams', () => {
  const mw = stripComments(readFileSync(join(WEB, 'middleware.ts'), 'utf8'));
  assert.match(
    mw,
    /pathname === '\/explore\/compare' && !request\.nextUrl\.searchParams\.get\('ids'\)\)\s*\{\s*return NextResponse\.redirect\(new URL\('\/explore', request\.url\), 307\)/,
    'middleware.ts no longer answers a bare /explore/compare with a 307 — the page redirect streams and Safari logs every aborted prefetch',
  );
});
