import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from './strip-comments';
import { countUnlockedCategories } from './todays-one-thing';
import { planGroupsForEventType } from './plan-groups-by-event-type';
import { PLAN_GROUPS } from './wedding-plan-groups';
import {
  BANNED_COUNT_WORD,
  decisionsCountLabel,
  decisionsCountNoun,
  labelUsesBannedWord,
  needsDecisionLabel,
  notBookedLabel,
} from './two-counts-two-names';

/*
  TWO COUNTS, TWO NAMES (wave 2, 2026-09-22).

  A couple met two different numbers wearing one word, "open" — the Overview's
  event-type-scoped bookable categories, and the Overview's cockpit decisions,
  and on the next page Your Team's own different set again.

  ⚠ THE PROPERTY, NOT THE PHRASING. Every assertion below either EXECUTES the
  resolver or asserts that a surface CALLS it. None pins a sentence. A guard
  pinned to a literal string is how the stale ₱499 upsell is still protected by
  four assertions across two tests — the guard became the thing defending the
  defect.
*/

/* ─────────── executed: the labels resolve ─────────── */

test('the category count shows the set it is drawn from', () => {
  // The denominator is the safety: "23" alone is ambiguous, "23 of 25" is not.
  assert.equal(notBookedLabel(23, 25), '23 of 25 categories not booked');
  /*
    ⚠ THE NOUN AGREES WITH THE DENOMINATOR. This line failed on its first run —
    the module pluralised on the numerator and produced "1 of 25 category not
    booked". Adding a denominator moves the agreement, and no amount of reading
    the old wording ("1 category still open", correct) would have predicted it.
  */
  assert.equal(notBookedLabel(1, 25), '1 of 25 categories not booked');
  // …and a one-category scope agrees the other way.
  assert.equal(notBookedLabel(1, 1), '1 of 1 category not booked');
});

test('…and it degrades honestly rather than inventing a denominator', () => {
  // A zero total means the event-type scope could not be resolved. "of 0" would
  // be a fact nobody measured, so the label drops the denominator instead.
  assert.equal(notBookedLabel(4, 0), '4 categories not booked');
  assert.ok(!notBookedLabel(4, 0).includes('of 0'));
  // Everything booked is a real state and reads as one, not as "0 of 25".
  assert.equal(notBookedLabel(0, 25), 'All 25 categories booked');
  assert.equal(notBookedLabel(0, 0), 'Nothing to book');
  /*
    The second wrong denominator: a total BELOW the numerator means the two
    numbers were counted over different sets. The test below proves they are not
    today; this is what a couple sees if that ever stops being true. "27 of 25"
    is the one thing the denominator must never be allowed to say.
  */
  assert.equal(notBookedLabel(27, 25), '27 categories not booked');
  assert.ok(!notBookedLabel(27, 25).includes('of 25'));
  // Negatives and fractions cannot reach a screen.
  assert.equal(notBookedLabel(-3, 25), 'All 25 categories booked');
  assert.equal(notBookedLabel(2.7, 25.9), '2 of 25 categories not booked');
});

test('the decisions count states its noun and stops', () => {
  assert.equal(decisionsCountLabel(4), '4 decisions');
  assert.equal(decisionsCountLabel(1), '1 decision');
  assert.equal(decisionsCountLabel(0), 'Nothing waiting');
  // the noun-only form, for the tile that animates its number separately
  assert.equal(decisionsCountNoun(4), 'decisions');
  assert.equal(decisionsCountNoun(1), 'decision');
  assert.equal(decisionsCountNoun(0), 'nothing waiting');
});

test('Your Team gets its own name, and it is a different sentence', () => {
  assert.equal(needsDecisionLabel(27), '27 need a decision');
  assert.equal(needsDecisionLabel(1), '1 needs a decision');
  assert.equal(needsDecisionLabel(0), 'Nothing needs a decision');
  // The whole point: the two surfaces must not read alike.
  assert.notEqual(needsDecisionLabel(23), notBookedLabel(23, 25));
});

test('NO label any surface can render uses the ambiguous word', () => {
  /*
    This is the property the rename exists for, executed across every label the
    module can produce rather than grepped out of a page.
  */
  const produced: string[] = [];
  for (const n of [0, 1, 2, 23, 27, 25, 999]) {
    for (const total of [0, 1, 25, 25.9]) produced.push(notBookedLabel(n, total));
    produced.push(decisionsCountLabel(n), decisionsCountNoun(n), needsDecisionLabel(n));
  }
  const offenders = produced.filter(labelUsesBannedWord);
  console.log(`  labels generated: ${produced.length} · using "${BANNED_COUNT_WORD}": ${offenders.length}`);
  assert.deepEqual(offenders, [], 'a count label must not call itself "open"');

  // …and prove this check can fail, so a green line means something.
  assert.ok(labelUsesBannedWord('4 open decisions'), 'the detector catches the old wording');
  assert.ok(!labelUsesBannedWord('4 decisions'), 'and does not fire on the new one');
  // word-boundary, not substring: "Open orders" is a LINK, not a count label.
  assert.ok(!labelUsesBannedWord('reopened'), 'substring matches would convict innocent copy');
});

/* ─────────── the denominator belongs to the numerator ─────────── */

test('the numerator and the denominator count the SAME set of groups', () => {
  /*
    🔑 THE RISK THE DENOMINATOR INTRODUCED, AND IT LIVES IN ANOTHER FILE.
    The Overview computes the two numbers from different expressions:

      remainingTaskCount     = countUnlockedCategories(rows, eventPlanGroups)   ← lib/todays-one-thing.ts
      totalLockableCategories = eventPlanGroups.filter(countsTowardLockable !== false).length

    A bare "23" could not be wrong about a set it never named. "23 of 25" can:
    if `countUnlockedCategories` ever stops skipping `countsTowardLockable ===
    false`, the numerator starts counting entry-point cards (live_band,
    bridal_car, guest_shuttle — cards that SHARE a VendorCategory with another
    card) that the denominator excludes, and a couple reads "27 of 25
    categories not booked". Nothing in event-dashboard.tsx would change.

    The clamp at `lockedVendorCount = Math.max(0, total - remaining)` is the
    existing code conceding this mismatch is expressible. This test executes the
    identity instead: with NO vendors nothing is locked, so every lockable group
    is unlocked, and the two expressions must agree exactly.
  */
  /*
    ⚠ THE SCOPE MAP MUST ACTUALLY NARROW, OR THE THREE TYPES ARE ONE TEST RUN
    THRICE. `planGroupsForEventType` fails OPEN on a tile with no scope row, so
    an empty map returns the identical 34-group ladder for every type — which is
    what the first cut of this test did, and its three printed lines were
    byte-identical. Pin a real row so the birthday ladder is genuinely shorter.
  */
  const weddingOnlyTile = PLAN_GROUPS.find((g) => g.catalogTile)?.catalogTile;
  assert.ok(weddingOnlyTile, 'no group carries a catalogTile — the scope cannot narrow anything');
  const scope = new Map<string, readonly string[] | null>([[weddingOnlyTile, ['wedding']]]);
  const ladderSizes = new Set<number>();
  for (const type of ['wedding', 'birthday', 'corporate']) {
    const ladder = planGroupsForEventType(type, scope);
    ladderSizes.add(ladder.length);
    const lockable = ladder.filter((g) => g.countsTowardLockable !== false).length;
    const unlockedWithNoVendors = countUnlockedCategories([], ladder);
    const excluded = ladder.length - lockable;
    console.log(
      `  ${type}: ladder ${ladder.length} · lockable ${lockable} · excluded ${excluded} · numerator-with-no-vendors ${unlockedWithNoVendors}`,
    );
    assert.equal(
      unlockedWithNoVendors,
      lockable,
      `${type}: the numerator counts a different set than the denominator — ` +
        'the label would read "N of M" with N able to exceed M',
    );
  }

  assert.ok(
    ladderSizes.size > 1,
    `every type produced the same ladder (${[...ladderSizes]}) — the scope is not narrowing, ` +
      'so this test ran one case three times',
  );

  /*
    ⚠ AND THE TEST MUST NOT BE VACUOUS. If no group in the ladder carried
    `countsTowardLockable: false`, the two expressions would agree by accident
    and this whole test would prove nothing. Pin that the exclusion is real.
  */
  const excludedInFullLadder = PLAN_GROUPS.filter((g) => g.countsTowardLockable === false).length;
  console.log(`  groups excluded from lockable in PLAN_GROUPS: ${excludedInFullLadder}`);
  assert.ok(
    excludedInFullLadder > 0,
    'no group is excluded, so the identity above holds trivially and proves nothing',
  );
});

/* ─────────── the render sites call the module ─────────── */

const dashboard = stripComments(
  readFileSync(
    path.join(process.cwd(), 'app/dashboard/[eventId]/_components/event-dashboard.tsx'),
    'utf8',
  ),
);

test('the Overview spells neither count at the render site', () => {
  /*
    Asserting the CALL, not the sentence: if the wording changes, this stays
    green, which is the whole reason the words live in one module. The owner has
    not approved the wording — a rename must cost a string, not a refactor.
  */
  assert.ok(
    dashboard.includes('notBookedLabel(remainingTaskCount, totalLockableCategories)'),
    'the category count comes from the module, with its denominator',
  );
  assert.ok(
    dashboard.includes('decisionsCountNoun(openDecisionCount)'),
    'the digest noun comes from the module',
  );

  /*
    And the two sentences it used to spell are gone from RENDERED text. Comments
    are stripped first — this file's own PR quotes both old strings in prose, and
    a naive search over the raw source would report its own explanations.
  */
  const spelled = [
    'categories still open',
    'category still open',
    "'open decision'",
    "'open decisions'",
  ].filter((phrase) => dashboard.includes(phrase));
  console.log(`  old count sentences still rendered: ${spelled.length} — ${JSON.stringify(spelled)}`);
  assert.deepEqual(spelled, [], 'the page must not hand-spell a count name');
});

test('the stripper is doing its job, so the check above means something', () => {
  const raw = readFileSync(
    path.join(process.cwd(), 'app/dashboard/[eventId]/_components/event-dashboard.tsx'),
    'utf8',
  );
  // The source DOES still contain the old wording — in the comments explaining
  // the change. If the stripper stopped working, the test above would go red for
  // the wrong reason, so pin the difference.
  assert.ok(raw.includes('categories still open'), 'the comment explaining the change is there');
  assert.ok(!dashboard.includes('categories still open'), 'and the stripper removes it');
  const ink = (t: string) => t.replace(/\s/g, '').length;
  const pct = Math.round(((ink(raw) - ink(dashboard)) / ink(raw)) * 100);
  console.log(`  stripper removed ${pct}% of the file's non-whitespace`);
  assert.ok(pct > 5 && pct < 70, `stripper removed ${pct}% — it is not running, or eating code`);
});
