/**
 * the-journal-is-revalidated-by-its-writers.test.ts — A JOURNAL ARTICLE IS KEPT
 * FOR A DAY, AND NOTHING THAT CHANGES IT WAITS THAT LONG (2026-10-20, fewer-reads).
 *
 * `app/blog/[slug]/page.tsx` went from hourly ISR to daily. That is only safe
 * while every write that changes what an article shows revalidates it:
 *
 *   1 · every function that writes `journal_vendor_spotlights` (approve,
 *       sponsor, confirm, remove — and the two-admin queue that publishes a
 *       sponsored one) revalidates the article's own `/blog/<slug>` path;
 *   2 · the writes that take a chapter, a storyteller or a shop DOWN all call
 *       `clearHomeShelf` (held by `lib/home-shelf-writes-clear.test.ts`), and
 *       `clearHomeShelf` revalidates every article for exactly those subjects —
 *       and the route it names is the article route on disk;
 *   3 · a render built around a REFUSED read (spotlights, chapters) is kept an
 *       hour at most, never the page's full day;
 *   4 · the page's revalidate is a number this file has seen — a longer one
 *       must come back here and say why it is still safe.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const PAGE = 'app/blog/[slug]/page.tsx';

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** One piece per top-level function / const, so a clear is held to the function that writes. */
function topLevelPieces(code: string): Array<{ name: string; body: string }> {
  const starts = [...code.matchAll(/^(?:export\s+)?(?:async\s+)?(?:function\s*\*?\s*(\w+)|const\s+(\w+)\s*[=:])/gm)];
  return starts.map((m, i) => ({
    name: (m[1] ?? m[2] ?? '?') as string,
    body: code.slice(m.index ?? 0, i + 1 < starts.length ? (starts[i + 1]!.index ?? code.length) : code.length),
  }));
}

const WRITE = /\.from\(\s*['"`]journal_vendor_spotlights['"`]\s*\)\s*\.(insert|update|upsert|delete)\(/;
/** Revalidates one article: `revalidatePath(`/blog/${…}`)`, or a same-file helper handed a slug. */
const REVALIDATES_ARTICLE = /revalidatePath\(\s*`\/blog\/\$\{/;

test('1 · every function that writes a Journal Spotlight revalidates its article', () => {
  const files = [...sourceFiles(join(WEB, 'app')), ...sourceFiles(join(WEB, 'lib'))];
  assert.ok(files.length > 500, `only ${files.length} source files were read`);
  const writers: string[] = [];
  const misses: string[] = [];
  for (const path of files) {
    const code = stripComments(readFileSync(path, 'utf8'));
    if (!WRITE.test(code)) continue;
    const rel = relative(WEB, path);
    writers.push(rel);
    const pieces = topLevelPieces(code);
    // A same-file helper that revalidates an article, called WITH an argument.
    const helpers = pieces.filter((p) => REVALIDATES_ARTICLE.test(p.body)).map((p) => p.name);
    for (const piece of pieces) {
      if (!WRITE.test(piece.body)) continue;
      const ok =
        REVALIDATES_ARTICLE.test(piece.body) ||
        helpers.some((name) => new RegExp(`\\b${name}\\(\\s*[^)\\s]`).test(piece.body));
      if (!ok) misses.push(`${rel} · ${piece.name}`);
    }
  }
  assert.ok(writers.length >= 2, `only ${writers.length} files write journal_vendor_spotlights — the scan is not seeing them`);
  assert.deepEqual(misses, [], 'these functions change a Journal Spotlight without revalidating its article — it would show the old credits for a day');
});

test('2 · the clears that take a chapter, storyteller or shop down revalidate every article', () => {
  const clear = read('lib/home-shelf-clear.ts');
  assert.match(clear, /revalidatePath\(\s*JOURNAL_ARTICLE_ROUTE\s*,\s*'page'\s*\)/, 'clearHomeShelf no longer revalidates the Journal');
  const subjects = /JOURNAL_SUBJECTS[^=]*=\s*new Set<[^>]*>\(\[([^\]]*)\]\)/.exec(clear)?.[1] ?? '';
  for (const s of ['stories', 'people', 'shops']) {
    assert.match(subjects, new RegExp(`'${s}'`), `clearing "${s}" no longer revalidates the Journal`);
  }
  const route = /JOURNAL_ARTICLE_ROUTE\s*=\s*'([^']+)'/.exec(clear)?.[1];
  assert.equal(route, '/blog/[slug]');
  assert.ok(existsSync(join(WEB, 'app', route as string, 'page.tsx')), `${route} is not the article route on disk`);
});

test('3 · a render around a refused read is kept an hour at most', () => {
  const page = read(PAGE);
  assert.match(page, /fetchApprovedSpotlightsForSlug\([\s\S]{0,80}?,\s*markRefused\s*\)/, 'the spotlight read no longer reports a refusal');
  assert.match(page, /fetchPublishedChapterForShare\(\s*\w+\s*,\s*markRefused\s*\)/, 'the chapter read no longer reports a refusal');
  assert.match(page, /if\s*\(\s*refused\s*\)\s*await\s+keepThisRenderBriefly\(\s*DEGRADED_RENDER_SECONDS\s*\)/);
  const brief = Number(/const DEGRADED_RENDER_SECONDS\s*=\s*(\d+)/.exec(page)?.[1]);
  assert.ok(brief > 0 && brief <= 3600, `a degraded article is kept ${brief} s`);
  // Each reader actually calls what it is handed.
  assert.match(read('lib/journal-spotlights.ts'), /onRefused\?\.\(error\)/);
  assert.match(read('lib/creator-public.ts'), /onRefused\?\.\(error\)[\s\S]*onRefused\?\.\(ownerError\)/);
  // The helper lowers THIS render's revalidate through a numbered unstable_cache read.
  assert.match(read('lib/keep-a-degraded-render-briefly.ts'), /unstable_cache\([\s\S]*revalidate:\s*seconds/);
});

test('4 · the article revalidate is the one this file reasoned about', () => {
  const revalidate = Number(/export const revalidate\s*=\s*(\d+)/.exec(read(PAGE))?.[1]);
  assert.ok(revalidate > 0 && revalidate <= 86400, `the Journal is kept ${revalidate} s — re-check 1–3 before going past a day`);
});
