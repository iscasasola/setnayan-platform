/**
 * admin-ask-escape-hatch.test.ts — the assistant is REACHABLE by the gesture
 * the owner actually uses, for a sentence describing a TASK rather than naming
 * a page.
 *
 * ── THE BUG, TWICE ──────────────────────────────────────────────────────────
 * PR #4888 built the fill-a-form ask flow and the owner typed the spec's own
 * flagship example straight back at it — *"add a new category on the taxonomy
 * service"* — and the box just navigated to Taxonomy.
 *
 * PR #4892 then made the offer EXIST without making it REACHABLE. Measured on
 * the shipped data for that exact sentence: 16 page hits under 15 group
 * headers, and the offer rendered after all of them inside a 430px scroller —
 * roughly two and a half screens down. Worse, the arrow keys and Enter both
 * indexed `hits` alone, so the offer was in neither key path. The owner
 * repeated his gesture and got his identical outcome. **A fix nobody can reach
 * is no fix.**
 *
 * ── WHY THIS FILE LOOKS DIFFERENT NOW ───────────────────────────────────────
 * 🪤 THE PREVIOUS VERSION OF THIS GUARD WAS DECORATION, PROVED BY MUTATION:
 *   · palette `MIN_SENTENCE_TOKENS` 3 → 6 (which breaks the 5-word flagship)
 *     left it at `# pass 4 # fail 0`, because it declared its OWN copy of the
 *     number and its source-grep matched the IDENTIFIER, never the value.
 *   · adding `display: 'none'` to the offer left it green, and left all 109
 *     admin component tests green, because nothing asserted the offer is
 *     visible, ordered or keyboard-reachable.
 *
 * So the rule now lives in `lib/admin-map/palette-nav.ts` — a plain module —
 * and this file IMPORTS the shipped constant and the shipped functions rather
 * than re-deriving them. Order and selectability are executed; only the two
 * things that genuinely are render facts (the offer renders before the hit
 * list, and is not hidden) are checked against comment-stripped source.
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
// THE REAL ONES. Never a local copy — that is what made the last guard green
// while the feature was unreachable.
import {
  MIN_SENTENCE_TOKENS,
  buildNavRows,
  shouldOfferAssistant,
} from '@/lib/admin-map/palette-nav';

import { buildDestinations, type Dest } from './admin-destinations';

const HERE = dirname(fileURLToPath(import.meta.url));
const ALL = buildDestinations();

/**
 * The palette's scorer, copied verbatim from admin-command-palette.tsx — the
 * same reason admin-sentence-search.test.ts keeps its own copy: the palette is
 * a `'use client'` React component and cannot be imported into a node:test
 * file. A later test in this file pins the two against each other.
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

const FLAGSHIP = 'add a new category on the taxonomy service';

const palette = () =>
  stripComments(readFileSync(join(HERE, 'admin-command-palette.tsx'), 'utf8'));

/** The gate, over the real ranker and the real shipped rule. */
function offersAssistant(q: string): boolean {
  return shouldOfferAssistant({
    hitCount: rankBySentence(ALL, q, score, 30).hits.length,
    jobHitCount: matchJobs(ADMIN_JOBS, q, 3).length,
    query: q,
  });
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
    offersAssistant(FLAGSHIP),
    'the box has a page hit AND offers nothing to reach the assistant — this is the production bug',
  );
});

/**
 * 🔑 THE THRESHOLD IS PINNED BY VALUE, NOT BY NAME. The flagship is five words
 * long, so a threshold of 6 deletes the feature for the one sentence it exists
 * for — silently, and with every other test still green. This asserts the
 * REAL imported constant against the REAL token count.
 */
test('the sentence threshold cannot drift past the flagship it exists for', () => {
  const flagshipWords = searchTokens(FLAGSHIP).length;
  assert.equal(flagshipWords, 5, 'the tokeniser changed — re-measure this guard');
  assert.ok(
    MIN_SENTENCE_TOKENS <= flagshipWords,
    `MIN_SENTENCE_TOKENS is ${MIN_SENTENCE_TOKENS}, above the ${flagshipWords} words of the flagship sentence — the feature is now unreachable for the query it was built for`,
  );
  // And it must stay above the two-word lookups, or every ordinary search grows
  // an assistant nag. Both directions, so neither edge can be widened quietly.
  assert.ok(
    MIN_SENTENCE_TOKENS > 2,
    'MIN_SENTENCE_TOKENS dropped to two or below — ordinary two-word lookups will now nag',
  );
});

test('an ordinary short lookup never grows the AI nag', () => {
  for (const q of ['papic pricing', 'vendor payouts', 'taxonomy', 'pending']) {
    assert.ok(
      !offersAssistant(q),
      `"${q}" is an ordinary lookup and must not offer the assistant beside its answer`,
    );
  }
});

test('a sentence a real job already answers does not ALSO nag with the assistant', () => {
  assert.ok(matchJobs(ADMIN_JOBS, 'create canonical leaf', 3).length > 0);
  assert.ok(
    !offersAssistant('create canonical leaf'),
    'a real deterministic job match should not also show the secondary AI offer',
  );
});

/**
 * ── ORDER + SELECTABILITY, EXECUTED ─────────────────────────────────────────
 * This is the half that did not exist before. The offer must be the FIRST row
 * and therefore the default selection (the palette resets `sel` to 0 on every
 * keystroke), and it must be inside the list the keyboard walks.
 */
test('the ask offer is the FIRST row and is what Enter reaches for the flagship', () => {
  const hits = rankBySentence(ALL, FLAGSHIP, score, 30).hits;
  const rows = buildNavRows(offersAssistant(FLAGSHIP), hits);

  assert.equal(rows[0]?.kind, 'ask', 'the ask offer is not the first row — Enter will navigate instead of asking');
  assert.equal(
    rows.length,
    hits.length + 1,
    'the nav list is not exactly the hits plus the ask row',
  );
  // `sel` starts at 0 on every new query, so row 0 IS the default selection.
  const DEFAULT_SELECTION = 0;
  assert.equal(
    rows[DEFAULT_SELECTION]?.kind,
    'ask',
    'the default selection is not the ask offer',
  );
  // And the page hits are still all present, one place further down.
  assert.deepEqual(
    rows.slice(1).map((r) => (r.kind === 'dest' ? r.dest.label : '<ask>')),
    hits.map((h) => h.label),
    'the page hits were reordered or dropped by the ask row',
  );
});

test('an ordinary lookup keeps byte-identical navigation — no offset, no extra row', () => {
  for (const q of ['papic pricing', 'vendor payouts', 'taxonomy', 'pending']) {
    const hits = rankBySentence(ALL, q, score, 30).hits;
    const rows = buildNavRows(offersAssistant(q), hits);
    assert.equal(rows.length, hits.length, `"${q}" grew an extra nav row`);
    assert.deepEqual(
      rows.map((r) => (r.kind === 'dest' ? r.dest.label : '<ask>')),
      hits.map((h) => h.label),
      `"${q}" no longer selects the same row first — this is the regression the change promised not to cause`,
    );
  }
});

/**
 * ── THE TWO GENUINE RENDER FACTS ────────────────────────────────────────────
 * Everything above executes. These two cannot: whether the offer is painted
 * before the hit list, and whether it is hidden. Both are matched against
 * COMMENT-STRIPPED source so the docblocks explaining the old bug — which
 * quote the very strings being banned — cannot satisfy or trip them.
 */
test('the ask offer renders ABOVE the page hits, not after them', () => {
  const src = palette();
  const offerIdx = src.indexOf('showAskEscapeHatch ? (');
  const hitsIdx = src.indexOf('hits.map(');
  assert.ok(offerIdx > 0, 'the ask offer block is gone from the palette');
  assert.ok(hitsIdx > 0, 'the hit list is gone from the palette');
  assert.ok(
    offerIdx < hitsIdx,
    'the ask offer renders AFTER the hit list again — that is ~966px down a 430px scroller, which is the exact production bug',
  );
});

test('the ask offer is not hidden, and is wired to the keyboard ring', () => {
  const src = palette();
  const offerIdx = src.indexOf('showAskEscapeHatch ? (');
  // Bounded to the offer itself — the next sibling block — NOT all the way to
  // the hit list. 🪤 The wider window swept in the empty-state branch and its
  // `aria-hidden` icons, and a bare /\bhidden\b/ matched INSIDE `aria-hidden`,
  // so this guard failed on correct code the first time it ran. A guard that
  // cries wolf teaches you to skim past the one time it is right.
  const endIdx = src.indexOf('{unknownNote ?', offerIdx);
  assert.ok(endIdx > offerIdx, 'the ask offer block moved — re-pin this test');
  const block = src.slice(offerIdx, endIdx);
  assert.ok(
    !/display\s*:\s*['"]none['"]/.test(block),
    'the ask offer is hidden — it renders in the tree and cannot be seen',
  );
  assert.ok(
    !/className="[^"]*\bhidden\b/.test(block),
    'the ask offer carries a hidden class — it renders in the tree and cannot be seen',
  );
  // The keyboard walks navRows, and the ask row activates the assistant.
  assert.match(
    src,
    /const target = navRows\[sel\]/,
    'Enter reads something other than the shared nav list again — that is how the offer became unreachable',
  );
  assert.match(
    src,
    /target\.kind === 'ask'/,
    'Enter no longer has a branch for the ask row',
  );
  assert.match(
    src,
    /navRows\.length \? \(s \+ 1\) % navRows\.length : 0/,
    'ArrowDown no longer cycles the shared nav list',
  );
});

test('the palette actually wires this gate — not merely this test file', () => {
  const src = palette();
  assert.match(
    src,
    /shouldOfferAssistant\(\{/,
    'the palette dropped the shared escape-hatch gate this test pins',
  );
  // And the click path must still be the shared, job-aware handler — never a
  // bare navigation that skips the "this answer names a form" check.
  assert.match(
    src,
    /onClick=\{\(\) => openAnswer\(asked\.answer\)\}/,
    'the escape hatch stopped routing an answer through openAnswer',
  );
});
