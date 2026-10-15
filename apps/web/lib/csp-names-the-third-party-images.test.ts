/**
 * The report-only CSP names the third-party IMAGE hosts the product shows on
 * purpose — read from where those URLs come from, not from a list.
 *
 * Found by the live quality sweep (2026-10-13, item 8): the policy refused
 * `is1-ssl.mzstatic.com` (iTunes song covers — 62 per onboarding page) and
 * `images.unsplash.com` (the Maria & Jose sample wall on /tour/gallery). It is
 * report-only today, so nothing broke; the day it is enforced, both go blank
 * with nothing in that diff to explain it.
 *
 * Coupling:
 *  - every https host in the sample-event seed SQL that serves an image must be
 *    in img-src (the seed is where /tour's pictures come from);
 *  - `lib/itunes-preview.ts` is the code that yields `artworkUrl` (an Apple
 *    `*.mzstatic.com` cover) and `previewUrl` (an `*.itunes.apple.com` clip) —
 *    while it exists, img-src must name `*.mzstatic.com` and media-src
 *    `*.itunes.apple.com`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const SCRIPTS = resolve(WEB, '..', '..', 'scripts');

function directive(name: string): string {
  const src = stripComments(readFileSync(join(WEB, 'next.config.ts'), 'utf8'));
  const m = src.match(new RegExp(`"${name} ([^"]*)"`));
  assert.ok(m, `the ${name} directive is gone from next.config.ts`);
  return m[1]!;
}

/** Does a CSP source list allow `host` (exact, or a `*.` wildcard)? */
function allows(list: string, host: string): boolean {
  return list.split(/\s+/).some((s) => {
    const h = s.replace(/^https:\/\//, '');
    if (h === host) return true;
    return h.startsWith('*.') && host.endsWith(h.slice(1));
  });
}

test('img-src names every image host the sample-event seed (the /tour pictures) uses', () => {
  const seeds = readdirSync(SCRIPTS).filter((f) => /^seed-sample-event-.*\.sql$/.test(f));
  assert.ok(seeds.length > 0, 'no sample-event seed SQL found — did scripts/ move?');
  const hosts = new Set<string>();
  for (const f of seeds) {
    const sql = readFileSync(join(SCRIPTS, f), 'utf8');
    for (const m of sql.matchAll(/'https:\/\/([a-z0-9.-]+)\/[^']*'/gi)) hosts.add(m[1]!.toLowerCase());
  }
  assert.ok(hosts.size > 0, 'the seeds name no https host — the scan saw nothing');
  const img = directive('img-src');
  const missing = [...hosts].filter((h) => !allows(img, h));
  assert.deepEqual(missing, [], `img-src (report-only CSP) does not name: ${missing.join(', ')}`);
});

test('iTunes covers and previews are allowed while itunes-preview.ts exists', () => {
  if (!existsSync(join(WEB, 'lib', 'itunes-preview.ts'))) return;
  assert.ok(allows(directive('img-src'), 'is1-ssl.mzstatic.com'), 'img-src must allow *.mzstatic.com (iTunes artwork)');
  assert.ok(allows(directive('img-src'), 'is5-ssl.mzstatic.com'), 'img-src must allow every isN-ssl.mzstatic.com shard');
  assert.ok(allows(directive('media-src'), 'audio-ssl.itunes.apple.com'), 'media-src must allow *.itunes.apple.com (iTunes previews)');
});
