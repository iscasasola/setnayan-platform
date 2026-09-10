/**
 * THE PUBLIC STORY READS THE ARRANGEMENT THROUGH ONE DOOR, AS THE PERSON WHO IS LOOKING.
 *
 * `/[slug]` renders with the service role — outside every RLS rule — so the ONLY thing between a
 * stranger and a guest's photograph on an arranged page is `loadStoryArrangement` (step 3): it
 * reads the audience off the arrangement's own row (the guests' layer, S3) and builds every capture
 * through the consent veto (S14). `story-pages.test.ts` proves that door holds. This file proves
 * the page USES it, and uses it as the reader:
 *
 *   1 · the story hands `loadStoryPages` the viewer it resolved — never a stand-in that would
 *       widen it (a host, a guest) — exactly once;
 *   2 · nothing under the public routes reads the arrangement any other way: no second
 *       `loadStoryArrangement`, no select naming the column, no own copy of the pool;
 *   3 · `story-pages.ts` itself runs no query — it is the gate's caller, never a second gate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('1 · the story reads its pages AS THE READER — the resolved viewer, once', () => {
  const src = read('app/[slug]/_components/editorial/editorial-content.tsx');
  const calls = src.match(/loadStoryPages\s*\(/g) ?? [];
  assert.equal(calls.length, 1, `expected one read of the arranged pages, found ${calls.length}`);
  assert.match(
    src,
    /loadStoryPages\(\s*createAdminClient\(\)\s*,\s*eventId\s*,\s*viewer\s*,/,
    'the arranged pages must be read with the SAME `viewer` the story gate was asked about',
  );
});

test('2 · no public route reads the arrangement except through that door', () => {
  const roots = ['app/[slug]', 'app/api', 'app/realstories'];
  const offenders: string[] = [];
  for (const root of roots) {
    for (const file of walk(join(WEB, root))) {
      const src = stripComments(readFileSync(file, 'utf8'));
      const rel = relative(WEB, file);
      if (/loadStoryArrangement\s*\(/.test(src)) offenders.push(`${rel}: calls loadStoryArrangement directly`);
      if (/loadArrangementPool\s*\(/.test(src)) offenders.push(`${rel}: builds its own pool`);
      if (/readStoredArrangement\s*\(/.test(src)) offenders.push(`${rel}: parses the stored document itself`);
      // A select naming the column, in any quoting.
      if (/select\(\s*[`'"][^`'"]*\barrangement\b/.test(src)) offenders.push(`${rel}: selects the arrangement column`);
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});

test('3 · story-pages.ts runs no query of its own — it only calls the gated read', () => {
  const src = read('lib/story-pages.ts');
  assert.equal(/\.from\s*\(/.test(src), false, 'story-pages.ts reads a table directly');
  assert.equal(/\.rpc\s*\(/.test(src), false, 'story-pages.ts calls a function directly');
  assert.match(src, /loadStoryArrangement\(\s*admin\s*,\s*eventId\s*,\s*viewer\s*\)/);
});
