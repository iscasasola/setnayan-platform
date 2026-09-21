import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  DATES_GROUP_ID,
  rankMarkFor,
  splitDecisionsAndDates,
  type SplitGroup,
} from './a-date-is-not-a-decision';

/*
  Owner-approved 2026-09-22, three rulings off the Overview redesign prototype
  (`prototypes/event_overview_redesign_2026-09-22/`):

    1. a date is not a decision   — the count means decisions only
    2. one rank mark, not two     — "PRIORITY n" folds into the number
    3. after the day, the minis that stopped being true go

  (1) and (2) are EXECUTED below against the pure module. (3) lives inside a
  `server-only` React server component that no test can import, so it is checked
  by reading the source — with the occurrence count printed, and with the guard
  probed against a deliberately broken copy first, so a green line proves the
  guard can still go red rather than proving only that it ran.
*/

const group = (id: string, n: number): SplitGroup<{ id: string }> => ({
  id,
  items: Array.from({ length: n }, (_, i) => ({ id: `${id}:${i}` })),
});

test('the dates are rendered and NOT counted as decisions', () => {
  const dates = group(DATES_GROUP_ID, 6);
  const split = splitDecisionsAndDates(
    [group('book', 1), group('pay', 1), group('pick', 1), group('role', 1)],
    dates,
  );

  // The live page's own numbers: four things need you, six dates are coming.
  assert.equal(split.openDecisionCount, 4, 'the count is decisions only');
  assert.equal(split.datesCount, 6, 'the dates keep their own count');

  // NOTHING IS REMOVED — the rows are still there to render.
  assert.ok(split.datesGroup, 'the dates group survives the split');
  assert.equal(split.datesGroup?.items.length, 6);
  assert.equal(split.decisionGroups.length, 4);
  assert.ok(
    !split.decisionGroups.some((g) => g.id === DATES_GROUP_ID),
    'the board never contains the dates group',
  );
});

test('a dates group smuggled in through the board array is still pulled out', () => {
  // This is the exact regression: someone re-adds `groups.push(deadlineGroup)`.
  const split = splitDecisionsAndDates(
    [group('book', 2), group(DATES_GROUP_ID, 6), group('pay', 1)],
    null,
  );
  assert.equal(split.openDecisionCount, 3, 'the smuggled dates do not inflate the count');
  assert.equal(split.datesCount, 6, 'and they are handed back to be rendered');
  assert.equal(split.decisionGroups.length, 2);
});

test('no dates at all is a clean zero, not a missing group', () => {
  const split = splitDecisionsAndDates([group('book', 2)], null);
  assert.equal(split.openDecisionCount, 2);
  assert.equal(split.datesCount, 0);
  assert.equal(split.datesGroup, null);
});

test('one rank mark: Sai ranks, the dates never do', () => {
  assert.equal(rankMarkFor(true, 0), 1, 'Sai on → a 1-based rank');
  assert.equal(rankMarkFor(true, 3), 4);
  assert.equal(rankMarkFor(false, 0), null, 'no Sai, no ranking');
  assert.equal(
    rankMarkFor(true, null),
    null,
    'the dates are in date order — a rank there would be a claim nobody made',
  );
});

/* ─────────── source checks on the component that cannot be imported ─────── */

const DASHBOARD = path.join(
  process.cwd(),
  'app/dashboard/[eventId]/_components/event-dashboard.tsx',
);
const source = readFileSync(DASHBOARD, 'utf8');

/** Count non-overlapping matches, and PRINT the number — a bare pass proves nothing. */
function countMatches(text: string, re: RegExp): number {
  const m = text.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'));
  return m ? m.length : 0;
}

test('the board no longer labels a group PRIORITY (ruling 2)', () => {
  // Assert the PROPERTY — no rendered "PRIORITY <n>" label — not a phrasing ban:
  // the word may still appear in prose, and does (a comment explains the change).
  // JSX text is what matters, so the pattern is the label shape, not the word.
  const rendered = countMatches(source, /PRIORITY \{/);
  console.log(`  rendered "PRIORITY {…}" labels: ${rendered}`);
  assert.equal(rendered, 0, 'the word folded into the number; see rankMarkFor');

  // …and prove this guard can still fail, on a copy with the label put back.
  const sabotaged = source.replace(
    'aria-label={`Priority ${rankMarkFor(aiActive, gi)}`}',
    'aria-label="x">PRIORITY {gi}<span hidden',
  );
  assert.notEqual(sabotaged, source, 'the sabotage anchor still exists in the file');
  assert.ok(
    countMatches(sabotaged, /PRIORITY \{/) > 0,
    'the guard detects the label when it is present',
  );
});

test('the three expired minis are gated on the event being ahead (ruling 3)', () => {
  // Guests · Schedule-next · Papic each state a fact about a day still to come.
  // Each push must be gated; Budget and Messages must NOT be — a balance and an
  // unread thread are still true the morning after.
  const gated = countMatches(source, /&& !eventHasHappened\)/);
  console.log(`  minis gated on !eventHasHappened: ${gated}`);
  assert.ok(gated >= 3, `expected at least 3 gated minis, found ${gated}`);

  for (const anchor of [
    'if (stats.total > 0 && !eventHasHappened) {',
    'if (!schedulePreview.isEmpty && !eventHasHappened) {',
    'if (papicMini && !eventHasHappened) miniTiles.push(papicMini);',
  ]) {
    assert.ok(source.includes(anchor), `missing gate: ${anchor}`);
  }

  // Budget stays ungated — this is the half of the rule that is easy to lose.
  assert.ok(
    source.includes('if (committedCentavos > 0 || (budgetTargetCentavos ?? 0) > 0) {'),
    'the budget mini must NOT be gated on the event being ahead',
  );
});

test('the dates still have a home, and the inspector still resolves them', () => {
  assert.ok(source.includes('aria-label="Coming up"'), 'the dates render under their own heading');
  assert.ok(
    source.includes('renderDecisionGroup(datesGroup, null)'),
    'drawn by the SAME renderer as the board, unranked',
  );
  assert.ok(
    source.includes('...(datesGroup ? [datesGroup] : [])'),
    '?inspect=d:u:… must still resolve a date row at ≥xl',
  );
  /*
    ⚠ THIS USED TO BAN THE PHRASE `groupsUnordered.push(deadlineGroup)`, and a
    sabotage run walked straight through it: writing
    `groupsUnordered.push(deadlineGroup as never)` left the guard green. The ban
    was also asserting the wrong thing — pushing the dates back onto the board
    is now HARMLESS, because `splitDecisionsAndDates` pulls them out again.
    That is the whole point of moving the split into a pure module.

    So the property to hold is not "nobody writes that line". It is: THE COUNT
    COMES FROM THE SPLIT, and nothing hand-rolls a second one beside it.
  */
  assert.ok(
    source.includes('} = splitDecisionsAndDates(sortedGroups, deadlineGroup);'),
    'the count and the dates must come from the pure split',
  );
  const handRolled = countMatches(
    source,
    /openDecisionCount\s*=\s*[^;]*reduce/,
  );
  console.log(`  hand-rolled decision counts beside the split: ${handRolled}`);
  assert.equal(handRolled, 0, 'a second count is how two numbers start disagreeing');
});
