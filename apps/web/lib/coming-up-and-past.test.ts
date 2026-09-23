import test from 'node:test';
import assert from 'node:assert/strict';
import { PAST_FIRST_SCREENFUL, pastShelf, splitComingUpAndPast, type SplittableEvent } from './coming-up-and-past';

/*
  COMING UP vs PAST — owner 2026-09-23: "split coming up from past".

  HIS OWN THREE CELEBRATIONS, with the dates read out of production, because the
  split has to be right about HIS page first: Movie Night (20 Aug 2026) is
  already behind him, and the two weddings are ahead.
*/
type E = SplittableEvent & { name: string };
const MOVIE: E = { name: 'Movie Night', event_date: '2026-08-20', archived: false };
const MARIA: E = { name: 'Maria & Jose', event_date: '2026-12-12', archived: false };
const CLAIRE: E = { name: 'Indalecio & Claire', event_date: '2026-12-18', archived: false };
const TODAY = '2026-09-23';

const names = (xs: E[]) => xs.map((x) => x.name);

test('his page splits one behind, two ahead — soonest first', () => {
  const { comingUp, past } = splitComingUpAndPast([CLAIRE, MOVIE, MARIA], TODAY);
  console.log(`  coming up: ${names(comingUp).join(' · ')} | past: ${names(past).join(' · ')}`);
  assert.deepEqual(names(comingUp), ['Maria & Jose', 'Indalecio & Claire'], 'soonest first');
  assert.deepEqual(names(past), ['Movie Night']);
});

test('the boundary is the day itself — a celebration today is still ahead', () => {
  /*
    `isFinishedEvent` uses `lastDay < todayISO`, so the day OF the wedding is not
    past. A couple looking at their own profile on the morning of their wedding
    must not find it filed under memories.
  */
  const todayEvent: E = { name: 'Today', event_date: TODAY, archived: false };
  const yesterday: E = { name: 'Yesterday', event_date: '2026-09-22', archived: false };
  const { comingUp, past } = splitComingUpAndPast([todayEvent, yesterday], TODAY);
  assert.deepEqual(names(comingUp), ['Today']);
  assert.deepEqual(names(past), ['Yesterday']);
});

test('a multi-day celebration is not past on its first morning', () => {
  /*
    The case that makes `event_end_date` worth a column. Prod holds no ranged
    event today, so this is the guard that will matter the first time one exists.
  */
  const spanning: E = {
    name: 'Three-day fiesta',
    event_date: '2026-09-22',
    event_end_date: '2026-09-25',
    archived: false,
  };
  const { comingUp, past } = splitComingUpAndPast([spanning], TODAY);
  assert.deepEqual(names(comingUp), ['Three-day fiesta'], 'still running, so still ahead');
  assert.deepEqual(names(past), []);
  // …and once its last day is behind us it moves.
  assert.deepEqual(names(splitComingUpAndPast([spanning], '2026-09-26').past), ['Three-day fiesta']);
});

test('a dateless celebration is ahead, and sorts last among the ahead', () => {
  /*
    It has not happened, so it is not a memory. It cannot be "next" either, so
    it must not sit above a celebration with a real date — that would put an
    undated card where the soonest one belongs.
  */
  const undated: E = { name: 'Someday', event_date: null, archived: false };
  const { comingUp, past } = splitComingUpAndPast([undated, MARIA], TODAY);
  assert.deepEqual(names(comingUp), ['Maria & Jose', 'Someday']);
  assert.deepEqual(names(past), []);
});

test('an archived celebration is past whatever its date says', () => {
  const archivedFuture: E = { name: 'Called off', event_date: '2027-01-01', archived: true };
  const { comingUp, past } = splitComingUpAndPast([archivedFuture], TODAY);
  assert.deepEqual(names(past), ['Called off']);
  assert.deepEqual(names(comingUp), []);
});

test('past is newest first — a memory is read backwards from now', () => {
  const older: E = { name: 'Older', event_date: '2025-01-01', archived: false };
  const newer: E = { name: 'Newer', event_date: '2026-01-01', archived: false };
  assert.deepEqual(names(splitComingUpAndPast([older, newer], TODAY).past), ['Newer', 'Older']);
});

test('an empty input yields two empty sections, not one of anything', () => {
  const { comingUp, past } = splitComingUpAndPast([], TODAY);
  assert.deepEqual(comingUp, []);
  assert.deepEqual(past, []);
});

/* ─────────── the page renders two sections, each only when it has cards ─────────── */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from './strip-comments';

test('both sections are gated on having cards, and share ONE card renderer', () => {
  /*
    🔑 A SECTION MUST NOT RENDER EMPTY. A couple with only future celebrations
    would otherwise meet a "Past celebrations" heading with nothing under it —
    which reads as a page that failed rather than a life that has not happened
    yet. He has one past event today, so his own page would never have shown it.

    And both sections call the SAME renderer: two copies of the card is how the
    split would recreate the very defect it exists to fix, from the other side.
  */
  const page = stripComments(
    readFileSync(path.join(process.cwd(), 'app/u/[userSlug]/page.tsx'), 'utf8'),
  );
  assert.match(page, /comingUp\.length > 0 \? \(/, 'Coming up is not gated on having cards');
  assert.match(page, /pastEvents\.length > 0 \? \(/, 'Past is not gated on having cards');

  const renders = (page.match(/\.map\(renderCelebration\(/g) ?? []).length;
  const definitions = (page.match(/const renderCelebration =/g) ?? []).length;
  console.log(`  card renderer: ${definitions} definition, ${renders} call sites`);
  assert.equal(definitions, 1, 'two card renderers is the defect arriving from the other side');
  /*
    THREE call sites since the past cap landed: Coming up, the first screenful of
    Past, and the remainder behind "Show all N". The number matters less than the
    DEFINITION count above — one renderer is the property; a second definition is
    how the sections drift into two different cards.
  */
  assert.equal(renders, 3, 'every list must use the one renderer');

  /*
    ⚠ AND EACH CALL SITE MUST NAME ITS OWN SECTION. The renderer takes the
    section so the status sash can exist on Coming up and be absent from Past —
    the ONE mark that distinguishes an invitation from a memory. A past list
    rendered with 'coming-up' would label a finished wedding "Up next", and the
    count above would still be 3. Two of the three are Past.
  */
  const comingCalls = (page.match(/renderCelebration\('coming-up'\)/g) ?? []).length;
  const pastCalls = (page.match(/renderCelebration\('past'\)/g) ?? []).length;
  console.log(`  call sites by section: coming-up ${comingCalls} · past ${pastCalls}`);
  assert.equal(comingCalls, 1, 'Coming up must be the only coming-up list');
  assert.equal(pastCalls, 2, 'both Past lists — the screenful and the remainder — must say past');
  assert.equal(comingCalls + pastCalls, renders, 'a call site names no section');

  // the split is delegated, not re-derived here
  assert.ok(page.includes('splitComingUpAndPast(listed, manilaTodayISO())'),
    'the page must delegate the split and the clock');
  assert.ok(!/event_date\s*[<>]/.test(page), 'the page is comparing dates itself');
});

test('the past shelf caps at a screenful and offers ONE control', () => {
  const many = Array.from({ length: 14 }, (_, i) => `m${i}`);
  const shelf = pastShelf(many);
  console.log(`  14 past → shown ${shelf.shown.length}, hidden ${shelf.hidden}, label "${shelf.moreLabel}"`);
  assert.equal(shelf.shown.length, PAST_FIRST_SCREENFUL);
  assert.equal(shelf.hidden, 8);
  assert.equal(shelf.moreLabel, 'Show all 14', 'the label states the total, not the remainder');
});

test('it degrades at both ends with no special case', () => {
  // His page today: one past celebration, so no control at all.
  const one = pastShelf(['Movie Night']);
  assert.deepEqual(one.shown, ['Movie Night']);
  assert.equal(one.hidden, 0);
  assert.equal(one.moreLabel, null, 'nothing is hidden, so nothing offers to reveal it');

  assert.equal(pastShelf([]).moreLabel, null);
  // exactly at the cap — still no control, because nothing is hidden
  assert.equal(pastShelf(Array.from({ length: PAST_FIRST_SCREENFUL }, (_, i) => i)).moreLabel, null);
  // one over — the control appears
  assert.equal(pastShelf(Array.from({ length: PAST_FIRST_SCREENFUL + 1 }, (_, i) => i)).hidden, 1);
  // and at 40 there is still exactly ONE control
  assert.equal(pastShelf(Array.from({ length: 40 }, (_, i) => i)).moreLabel, 'Show all 40');
});

test('the cap lands on a row edge, and a nonsense limit cannot break it', () => {
  assert.equal(PAST_FIRST_SCREENFUL % 2, 0, 'an odd cap cuts a row in half at two columns');
  for (const bad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
    const s = pastShelf(Array.from({ length: 10 }, (_, i) => i), bad);
    assert.equal(s.shown.length, PAST_FIRST_SCREENFUL, `limit ${bad} broke the shelf`);
  }
});

test('the page actually USES the cap — a module nothing calls is not a feature', () => {
  /*
    🔑 THIS GUARD EXISTS BECAUSE I SHIPPED THE MODULE AND FORGOT THE PAGE.
    `pastShelf` was written, tested and pushed while `app/u/[userSlug]/page.tsx`
    still rendered every past celebration — a well-tested module nothing runs,
    which is exactly the defect that got `lib/digest-sub.ts` deleted this week.
    The tests were green and the cap did not exist on screen.
  */
  const page = stripComments(
    readFileSync(path.join(process.cwd(), 'app/u/[userSlug]/page.tsx'), 'utf8'),
  );
  assert.ok(page.includes('pastShelf(pastEvents)'), 'the page must ask for the shelf');
  assert.ok(page.includes('pastShown.shown.map'), 'the page must render the capped list, not all of it');
  assert.ok(page.includes('pastShown.moreLabel'), 'the reveal control must be gated on there being more');
  // the full list must still be reachable — capped is not truncated
  assert.ok(
    page.includes('pastEvents.slice(pastShown.shown.length)'),
    'the hidden celebrations must still render behind the control',
  );
  console.log('  page wiring: shelf asked for, capped list rendered, remainder reachable');
});
