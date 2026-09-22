import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from './strip-comments';

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
  ⚠ TWO STRIPPERS WERE HAND-ROLLED HERE BEFORE THIS LINE WAS WRITTEN. Neither
  survived, and the repo already had the answer.

  The first was `/\{\s*\/\*[\s\S]*?\*\/\s*\}/` for JSX comments. With a block
  comment just inside an expression brace — which this PR wrote four of — the
  trailing brace fails to match, the engine backtracks to the next `*` `/` that
  does have one, and everything between vanishes. It ate 45% of this file and
  then reported two endowed empty states as deleted while they sat in the source.

  The second was the two-replace regex. `lint-one-comment-stripper` rejected it
  by name, and `lib/strip-comments.ts` explains why in detail: `/*` inside a
  STRING opens a comment that never existed — `accept="image/*"` alone blanked
  5,104 lines across 1,031 files when a guard shipped with that regex.

  🔑 THE FIX CANNOT BE A BETTER REGEX — deciding whether `/` starts a comment
  needs to know whether you are inside a string, and that is lexing. So this
  uses the ONE string-aware stripper, like every other source-scanning guard.
*/
const rendered = stripComments(source);

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

test('the shared stripper removes comments and NOTHING ELSE', () => {
  // Without this, the tests above read this PR's own explanations as rendered
  // copy and pass — or fail — for the wrong reason.
  assert.ok(
    source.includes('each one links to its room'),
    'the source DOES still quote the removed line, in a comment',
  );
  assert.ok(!flat.includes('each one links to its room'), 'and the stripper removes it');

  // The two hazards that killed the hand-rolled versions, pinned as fixtures.
  const braceAdjacent = stripComments(
    'preview={\n  /* a note */\n  n > 1 ? null : (<p>KEEP ME</p>)\n}',
  );
  assert.ok(braceAdjacent.includes('KEEP ME'), 'a brace-adjacent comment must not swallow its sibling');
  assert.ok(!braceAdjacent.includes('a note'), 'the comment itself still goes');

  const slashInString = stripComments('const a = "image/*"; const KEEP = 1; /** doc */');
  assert.ok(slashInString.includes('const KEEP = 1'), 'a slash-star inside a STRING is not a comment');

  /*
    ⚠ MEASURE INK, NOT LENGTH. `stripComments` blanks a comment to whitespace of
    the SAME LENGTH, to keep line and column positions usable by its callers —
    so `source.length - rendered.length` is always 0 and a percentage built on
    it asserts nothing at all. The first version of this line did exactly that
    and printed "stripper removed 0% of the file" while claiming to be a
    ceiling. Count the non-whitespace characters instead.
  */
  const ink = (t: string) => t.replace(/\s/g, '').length;
  const removedPct = Math.round(((ink(source) - ink(rendered)) / ink(source)) * 100);
  console.log(`  stripper removed ${removedPct}% of the file's non-whitespace`);
  assert.ok(removedPct > 5, `only ${removedPct}% removed — the stripper is not running`);
  assert.ok(removedPct < 70, `${removedPct}% removed — the stripper is eating code`);
});
