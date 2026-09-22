import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/*
  THE OVERVIEW STOPS DESCRIBING WHAT IS ALREADY ON IT (owner-approved 2026-09-22).

  The owner's complaint that started the redesign: "too much text, too many
  descriptions, and the flow of use is scattered." PRs 1–2 fixed the flow; PR 3
  removed eight lines that each described something the reader can already see.

  ⚠ THIS GUARD EXISTS FOR THE OTHER DIRECTION. Trimming copy is one careless
  grep away from deleting an ENDOWED EMPTY STATE — the hopeful one-liners the
  2026-07-12 council shipped in Phase 2, which look like description and are
  not: they carry a fact and a first step to a couple who has nothing yet.
  So the removed lines are asserted absent AND the endowed lines are asserted
  present, each by name.
*/

const DASHBOARD = path.join(
  process.cwd(),
  'app/dashboard/[eventId]/_components/event-dashboard.tsx',
);
const source = readFileSync(DASHBOARD, 'utf8');

/**
 * Rendered text only. A JSX comment quoting the copy it removed is not on the
 * page — and this file's own PR wrote several of those, so a naive substring
 * search over the whole source would have reported its own explanations as
 * regressions.
 */
/*
  ⚠ THE FIRST CUT OF THIS STRIPPER ATE 45% OF THE FILE AND THIS GUARD CAUGHT IT.

  It began with a dedicated JSX-comment pass, `/\{\s*\/\*[\s\S]*?\*\/\s*\}/`.
  That looks precise and is a trap: when a bare block comment sits just inside
  an expression brace — `preview={ /_* note *_/ x ? null : (…) }` (underscores
  here only so this comment does not close itself), which this PR
  wrote four of — the `\{\s*\/\*` half matches, the lazy middle stops at that
  comment's `*\/`, the trailing `\s*\}` fails, and the engine BACKTRACKS to the
  next `*\/` that does have a `}` after it. Everything in between disappears,
  including two endowed empty states, and the guard reported them as deleted
  when they were sitting right there in the file.

  One rule instead: a block comment is a block comment, wherever it sits. The
  leftover empty braces are then swept up. The last test in this file pins the
  stripper against real content so it cannot quietly over-match again.
*/
const rendered = source
  .replace(/\/\*[\s\S]*?\*\//g, '') // every block comment, JSX or not
  .replace(/^\s*\/\/.*$/gm, '') // line comments
  .replace(/\{\s*\}/g, ''); // braces the comments left behind

/** Collapse JSX whitespace so a phrase split across lines still matches. */
const flat = rendered.replace(/\s+/g, ' ');

const REMOVED: ReadonlyArray<readonly [string, string]> = [
  ['decisions: the link instruction', 'each one links to its room'],
  ['decisions: the free-state twin', 'Choices only you can make'],
  ['coming up: the sub-line', 'Nothing to decide — just what lands when'],
  ['band: the list of its own cards', 'this is the doorstep'],
  ['progress: how to press an arrow', 'Tap a stage'],
  ['hosts: expand instruction', 'expand to see who'],
  ['team: expand instruction', 'expand to see your team'],
  ['conversations: count restated', 'unread messages — open to catch up'],
];

/*
  ⚠ ANCHORED ON THE TAIL, NOT THE OPENING — a sabotage run taught this file.

  The first cut matched 'No vendors booked yet'. Trimming the line to exactly
  "No vendors booked yet." — deleting the half that does the work — left the
  guard GREEN, because the opening survived. An endowed empty state is not
  valuable for announcing that something is empty; it is valuable for the FIRST
  STEP it names. So each anchor is that first step.
*/
const KEPT_ENDOWED: ReadonlyArray<readonly [string, string]> = [
  ['team, empty', 'start with the ones that book out first'],
  ['conversations, empty', 'when a vendor replies, it lands right here'],
  ['services, empty', 'the Studio has everything for the day'],
  ['schedule, empty', 'your guests follow the timeline live on the day'],
  ['hosts, alone', 'invite your partner, family, or a coordinator'],
];

test('every line that only described the screen is gone', () => {
  const still = REMOVED.filter(([, phrase]) => flat.includes(phrase));
  console.log(`  described-the-screen lines still rendered: ${still.length} of ${REMOVED.length}`);
  assert.deepEqual(
    still.map(([label]) => label),
    [],
    'these describe something the reader can already see',
  );
});

test('every endowed empty state survived the trim', () => {
  const lost = KEPT_ENDOWED.filter(([, phrase]) => !flat.includes(phrase));
  console.log(`  endowed empty states present: ${KEPT_ENDOWED.length - lost.length} of ${KEPT_ENDOWED.length}`);
  assert.deepEqual(
    lost.map(([label]) => label),
    [],
    'Phase 2 shipped these on purpose — a fact and a first step, not description',
  );
});

test('the facts that look like description are still said', () => {
  // The ordering IS a fact, and it is one of Setnayan AI's appearances.
  assert.ok(flat.includes('Ranked by what closes soonest.'), 'Sai chose the order');
  assert.ok(
    !flat.includes('Ranked by what closes soonest — each one'),
    'trimmed to the fact, not left at twelve words',
  );
  // A privacy promise, council-locked to appear exactly once.
  const masking = (flat.match(/never a personal profile/g) || []).length;
  console.log(`  supplier-masking note occurrences: ${masking}`);
  assert.equal(masking, 1, 'stated once as a global footnote, never per-card legalese');
});

test('the stripper removes comments and NOTHING ELSE', () => {
  // Without this, the tests above read their own PR's explanations as rendered
  // copy, and pass — or fail — for the wrong reason.
  assert.ok(
    source.includes('each one links to its room'),
    'the source DOES still quote the removed line, in a comment',
  );
  assert.ok(!flat.includes('each one links to its room'), 'and the stripper removes it');

  // …and it must not take real code with it. A comment sitting just inside an
  // expression brace is the exact shape that made the first cut over-match.
  const sample = `preview={
    /* a note */
    n > 1 ? null : (<p>KEEP THIS LINE</p>)
  }`;
  const stripped = sample
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\}/g, '');
  assert.ok(stripped.includes('KEEP THIS LINE'), 'a brace-adjacent comment must not swallow its sibling');
  assert.ok(!stripped.includes('a note'), 'the comment itself still goes');

  // Sanity on the real file: comments are most of it, but not all of it.
  const removedPct = Math.round(((source.length - rendered.length) / source.length) * 100);
  console.log(`  stripper removed ${removedPct}% of the file`);
  assert.ok(removedPct < 60, `stripper removed ${removedPct}% — it is eating code again`);
});
