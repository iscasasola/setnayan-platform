/**
 * admin-ask-escape-hatch.test.ts — the assistant is reachable even when the
 * box's OWN page vocabulary already found a hit, for a sentence a person is
 * clearly using to describe a TASK rather than to name a page.
 *
 * ── THE BUG, IN PRODUCTION ──────────────────────────────────────────────────
 * PR #4888 built the fill-a-form ask flow and the owner typed the spec's own
 * flagship example straight back at it — *"add a new category on the taxonomy
 * service"* — and the box just navigated to Taxonomy, no questions asked.
 *
 * `matchJobs()` correctly returns nothing for that sentence (see
 * `match-job.test.ts` — "add a new category" and `createCanonicalLeaf` share
 * no literal word; that gap is deliberately left for the AI step). The actual
 * defect was one level up: the "Ask Setnayan" button only ever rendered inside
 * the `hits.length === 0` branch of the palette, and `hits` is NEVER empty for
 * this query — "taxonomy" is a literal page name — so the assistant could
 * never be reached for the exact case it exists to bridge.
 *
 * This file is a behavioural test, not merely a source-grep: it re-derives the
 * palette's `showAskEscapeHatch` gate from the real ranking functions over the
 * real destination list, so a change to the ranker, the job matcher or the
 * tokeniser that quietly closes this gap again fails here — not just when the
 * palette's own source text happens to change shape.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { rankBySentence } from '@/lib/admin-map/rank-by-sentence';
import { searchTokens } from '@/lib/search-stop-words';
import { matchJobs } from '@/lib/admin-map/match-job';
import { ADMIN_JOBS } from '@/lib/admin-map/admin-jobs.generated';

import { buildDestinations, type Dest } from './admin-destinations';

const HERE = dirname(fileURLToPath(import.meta.url));
const ALL = buildDestinations();

/**
 * The palette's scorer, copied verbatim from admin-command-palette.tsx — the
 * same reason admin-sentence-search.test.ts keeps its own copy: the palette is
 * a `'use client'` React component and cannot be imported into a node:test
 * file. The last test in this file pins the two files against each other.
 */
function score(d: Dest, needle: string): number {
  if (!needle) return 1;
  const l = d.label.toLowerCase();
  let raw = 0;
  const i = l.indexOf(needle);
  if (i === 0) raw = 100;
  else if (i > 0) raw = Math.max(20, 60 - i);
  else if (d.hay.includes(needle)) raw = 15;
  else {
    let p = 0;
    for (let c = 0; c < l.length && p < needle.length; c++) if (l[c] === needle[p]) p++;
    raw = p === needle.length ? 8 : 0;
  }
  if (d.source === 'map') return raw / 2;
  if (d.source === 'row') return raw / 3;
  return raw;
}

const MIN_SENTENCE_TOKENS = 3;
const FLAGSHIP = 'add a new category on the taxonomy service';

/** The exact gate the palette computes, re-derived over the real ranker. */
function showAskEscapeHatch(q: string): boolean {
  const hits = rankBySentence(ALL, q, score, 30).hits;
  const jobHits = matchJobs(ADMIN_JOBS, q, 3);
  return hits.length > 0 && jobHits.length === 0 && searchTokens(q).length >= MIN_SENTENCE_TOKENS;
}

test('the flagship sentence finds a page hit AND the assistant stays reachable', () => {
  const hits = rankBySentence(ALL, FLAGSHIP, score, 30).hits;
  assert.ok(
    hits.length > 0,
    'the regression precondition is gone — Taxonomy no longer matches this query, re-check this test',
  );
  assert.equal(
    matchJobs(ADMIN_JOBS, FLAGSHIP, 3).length,
    0,
    'a deterministic job now matches this sentence — the coverage gate moved, re-check this test',
  );
  assert.ok(
    showAskEscapeHatch(FLAGSHIP),
    'the box has a page hit AND offers nothing to reach the assistant — this is the production bug',
  );
});

test('an ordinary short lookup never grows the AI nag', () => {
  // These already answer correctly with a plain page hit; adding a secondary
  // "ask Setnayan" offer beside them would be a confusing regression, not a fix.
  for (const q of ['papic pricing', 'vendor payouts', 'taxonomy', 'pending']) {
    assert.ok(
      !showAskEscapeHatch(q),
      `"${q}" is an ordinary lookup and must not offer the assistant beside its answer`,
    );
  }
});

test('a sentence a real job already answers does not ALSO nag with the assistant', () => {
  assert.ok(matchJobs(ADMIN_JOBS, 'create canonical leaf', 3).length > 0);
  assert.ok(
    !showAskEscapeHatch('create canonical leaf'),
    'a real deterministic job match should not also show the secondary AI offer',
  );
});

test('the palette actually wires this gate — not merely this test file', () => {
  const src = stripComments(readFileSync(join(HERE, 'admin-command-palette.tsx'), 'utf8'));
  assert.match(
    src,
    /showAskEscapeHatch\s*=\s*hits\.length > 0 && jobHits\.length === 0 && searchTokens\(q\)\.length >= MIN_SENTENCE_TOKENS/,
    'the palette dropped or weakened the escape-hatch gate this test pins',
  );
  // 🪤 THE OLD BUG, PINNED SO IT CANNOT SILENTLY COME BACK: the ask offer must
  // render somewhere other than inside the `hits.length === 0` branch, or it is
  // unreachable for exactly the query this file is named for.
  assert.match(
    src,
    /showAskEscapeHatch \? \(/,
    'the secondary ask offer is no longer wired into the hits-found branch',
  );
  // And the click path must still be the shared, job-aware handler — never a
  // bare navigation that skips the "this answer names a form" check.
  assert.match(
    src,
    /onClick=\{\(\) => openAnswer\(asked\.answer\)\}/,
    'the escape hatch stopped routing an answer through openAnswer',
  );
});
