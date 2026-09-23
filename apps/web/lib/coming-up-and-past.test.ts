import test from 'node:test';
import assert from 'node:assert/strict';
import { splitComingUpAndPast, type SplittableEvent } from './coming-up-and-past';

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

  const renders = (page.match(/\.map\(renderCelebration\)/g) ?? []).length;
  const definitions = (page.match(/const renderCelebration =/g) ?? []).length;
  console.log(`  card renderer: ${definitions} definition, ${renders} call sites`);
  assert.equal(definitions, 1, 'two card renderers is the defect arriving from the other side');
  assert.equal(renders, 2, 'both sections must use it');

  // the split is delegated, not re-derived here
  assert.ok(page.includes('splitComingUpAndPast(listed, manilaTodayISO())'),
    'the page must delegate the split and the clock');
  assert.ok(!/event_date\s*[<>]/.test(page), 'the page is comparing dates itself');
});
