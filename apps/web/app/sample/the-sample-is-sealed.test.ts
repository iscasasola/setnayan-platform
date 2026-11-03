/**
 * 🎭 THE SAMPLE IS SEALED — the source-level half of the /sample guards (slice
 * S1, corpus SAMPLE_EVENT_BUILD_BRIEF_2026-11-02.md item 8). The pure read path
 * and gate are `lib/sample-event/sample-event.test.ts`.
 *
 *   (a) a /sample address no page claims is a 404 — the catch-all exists, and
 *       every page opens through `loadSampleOrNotFound()` (one key, else 404);
 *   (b) the read path cannot reach a real event: the snapshot module imports
 *       nothing at all, and nothing under /sample imports a Supabase client;
 *   (c) no server action accepts the sample's id: no `'use server'` module
 *       imports `lib/sample-event/*` or spells the id, and nothing under
 *       /sample is or calls a server action;
 *   (d) noindex on the /sample layout, and no sitemap or robots Allow lists it;
 *   (e) middleware's native-shell bounce carries the sample;
 *   (f) the layout closes the whole tree when the sample is closed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { SAMPLE_EVENT_ID } from '@/lib/sample-event/snapshot';

const SAMPLE_DIR = dirname(fileURLToPath(import.meta.url));
const APP = join(SAMPLE_DIR, '..');
const WEB = join(APP, '..');
const LIB = join(WEB, 'lib');

const code = (p: string) => stripComments(readFileSync(p, 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const SAMPLE_FILES = walk(SAMPLE_DIR);
const importsOf = (src: string) => [...src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!);
/** Imports that survive the build — `import type …` is erased, so it can reach nothing. */
const runtimeImportsOf = (src: string) => importsOf(src.replace(/^\s*import\s+type\s[^;]*;/gm, ''));

test('(a) a /sample address no page claims is a 404, and every page opens through the one read path', () => {
  const catchAll = join(SAMPLE_DIR, '[...rest]', 'page.tsx');
  assert.ok(existsSync(catchAll), 'without the catch-all, /sample/hub falls through to app/[slug]/hub with slug "sample"');
  assert.match(code(catchAll), /\bnotFound\(\)/, 'the catch-all must answer 404');
  assert.doesNotMatch(code(catchAll), /\breturn\s*\(?\s*</, 'the catch-all must render nothing');

  const pages = SAMPLE_FILES.filter((p) => /[/\\]page\.tsx$/.test(p) && p !== catchAll);
  assert.ok(pages.length >= 1, 'the /sample landing is missing');
  for (const p of pages) {
    assert.match(code(p), /\bawait\s+loadSample(Guest)?OrNotFound\(/, `${relative(WEB, p)} must open with loadSampleOrNotFound() / loadSampleGuestOrNotFound()`);
  }
});

test('(b) the sample’s read path reaches no table', () => {
  const snapshot = code(join(LIB, 'sample-event', 'snapshot.ts'));
  assert.deepEqual(runtimeImportsOf(snapshot), [], 'lib/sample-event/snapshot.ts must import nothing at runtime — it is fixtures only');
  for (const pure of ['gate.ts', 'paths.ts']) {
    assert.deepEqual(importsOf(code(join(LIB, 'sample-event', pure))), [], `lib/sample-event/${pure} must stay pure`);
  }
  for (const p of SAMPLE_FILES) {
    for (const spec of importsOf(code(p))) {
      assert.doesNotMatch(spec, /supabase/i, `${relative(WEB, p)} imports ${spec} — /sample must never read a table`);
    }
  }
});

test('(c) no server action accepts the sample’s id', () => {
  const offenders: string[] = [];
  for (const p of [...walk(APP), ...walk(LIB)]) {
    const src = code(p);
    if (!/['"]use server['"]/.test(src)) continue;
    const rel = relative(WEB, p);
    // (app/tour/_lib/sample-event is the older DB-backed /tour — a different module.)
    if (importsOf(src).some((s) => /(^@\/|\/)lib\/sample-event(\/|$)/.test(s))) offenders.push(`${rel} imports lib/sample-event`);
    if (src.includes(SAMPLE_EVENT_ID)) offenders.push(`${rel} spells the sample id`);
  }
  assert.deepEqual(offenders, [], 'a server action that knows the sample id could be made to accept it');

  for (const p of SAMPLE_FILES) {
    const src = code(p);
    const rel = relative(WEB, p);
    assert.doesNotMatch(src, /['"]use server['"]/, `${rel} is a server action`);
    assert.doesNotMatch(src, /\b(formAction|action)\s*=\s*\{/, `${rel} posts to a server action`);
    for (const spec of importsOf(src)) {
      assert.doesNotMatch(spec, /(^|\/)(actions|[a-z-]+-actions)$/, `${rel} imports a server action module (${spec})`);
    }
  }
});

test('(d) /sample is noindex and absent from every sitemap and from robots’ Allow list', () => {
  const layout = code(join(SAMPLE_DIR, 'layout.tsx'));
  assert.match(layout, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false/, 'the /sample layout must be noindex, nofollow');

  const sitemapSources = readdirSync(APP)
    .filter((n) => /^sitemap/.test(n))
    .flatMap((n) => {
      const p = join(APP, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  assert.ok(sitemapSources.length >= 2, 'the sitemap routes moved — point this guard at them');
  for (const p of sitemapSources) {
    const src = code(p);
    assert.doesNotMatch(src, /['"`]\/sample(\/|['"`])/, `${relative(WEB, p)} lists /sample`);
    assert.doesNotMatch(src, /sample-event/, `${relative(WEB, p)} reads the sample`);
  }

  const robots = code(join(APP, 'robots.ts'));
  const allowed = robots.match(/const ALLOWED_PATHS = \[([\s\S]*?)\];/);
  assert.ok(allowed, 'ALLOWED_PATHS moved out of app/robots.ts');
  assert.doesNotMatch(allowed![1]!, /['"]\/sample/, 'robots.txt must not Allow /sample');
});

test('(e) no native-shell bounce is left to carry the sample — it follows `/` into the app (owner 2026-11-02)', () => {
  // The bounce that sent the app away from /sample (by prefix, while `/` was bounced for Apple review) left with `/`:
  // "let everything go live". What keeps the sample closed now is its own gate, asked on every /sample page ((f)
  // below), whose "is this a browser?" fact is `discoverOpensHere()` — the same answer the account bar gives.
  const mw = code(join(WEB, 'middleware.ts'));
  assert.doesNotMatch(mw, /appShellBouncesSample|APP_EXCLUDED_MARKETING_PATHS|isCapacitorClient|SetnayanApp|setnayan-client-type/, 'middleware bounces the app again — say whether the sample rides it');
  const sw = code(join(LIB, 'sample-event', 'switch.server.ts'));
  assert.match(sw, /const webShell = await discoverOpensHere\(\);\s*if \(!webShell\) return false;/, 'the sample no longer asks whether `/` opens here');
});

test('(f) the layout closes every /sample page when the sample is closed', () => {
  const layout = code(join(SAMPLE_DIR, 'layout.tsx'));
  assert.match(layout, /if\s*\(\s*!\s*\(\s*await\s+sampleOpensHere\(\)\s*\)\s*\)\s*notFound\(\)/, 'the /sample layout no longer 404s a closed sample');
  const sw = code(join(LIB, 'sample-event', 'switch.server.ts'));
  assert.match(sw, /if\s*\(\s*!\s*\(\s*await\s+sampleOpensHere\(\)\s*\)\s*\)\s*notFound\(\)/, 'loadSampleOrNotFound no longer checks the gate');
  assert.match(sw, /if\s*\(\s*!snapshot\s*\)\s*notFound\(\)/, 'loadSampleOrNotFound no longer 404s a foreign key');
  assert.match(sw, /if\s*\(\s*!guest\s*\)\s*notFound\(\)/, 'loadSampleGuestOrNotFound no longer 404s a key that is no sample guest');
  assert.doesNotMatch(sw, /NEXT_PUBLIC_/, 'the switch must be a database flip, never a build flag');
});
