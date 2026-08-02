/**
 * GALLERY CHAPTERS — "split by x months away. to x days away." (owner 2026-08-02)
 *
 * A wedding is a journey, not one day of photos. The gallery groups by how far
 * from the day each photo was taken: months while far out, days once close.
 *
 * The one bug this feature must never introduce is a gallery that silently drops
 * a photo. Papic's governing promise is that every capture reaches the couple —
 * so a capture that cannot be placed gets an honest heading, never the bin.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chapterFor,
  countdownChapter,
  tripDayChapter,
  groupIntoChapters,
  COUNTDOWN_DAYS_THRESHOLD,
  type ChapterContext,
} from './papic-chapters';

const WEDDING: ChapterContext = { eventDateIso: '2026-12-05', mode: 'countdown' };

/** An ISO instant on a given Manila calendar date (Manila is UTC+8). */
const onManilaDate = (date: string, hhmm = '12:00') => `${date}T${hhmm}:00+08:00`;

// ── the owner's labelling ──────────────────────────────────────────────────

test('far out it counts MONTHS', () => {
  assert.equal(countdownChapter(150).label, '5 months to go');
  assert.equal(countdownChapter(91).label, '3 months to go');
  assert.equal(countdownChapter(61).label, '2 months to go');
});

test('close in it counts DAYS', () => {
  assert.equal(countdownChapter(30).label, '30 days to go');
  assert.equal(countdownChapter(7).label, '7 days to go');
  assert.equal(countdownChapter(1).label, '1 day to go', 'singular, not "1 days"');
});

test('the switch is at 30 days — the unit the rest of Papic reasons in', () => {
  assert.equal(COUNTDOWN_DAYS_THRESHOLD, 30);
  assert.match(countdownChapter(30).label, /days to go/);
  assert.match(countdownChapter(31).label, /month/);
});

test('🪤 31 days out reads "1 month", never "2 months"', () => {
  // Rounding up on the very first bucket past the switch would overstate the
  // distance by a whole month — the most visible possible place to be wrong.
  assert.equal(countdownChapter(31).label, '1 month to go');
  assert.equal(countdownChapter(45).label, '1 month to go');
});

test('the day itself and afterwards are single chapters', () => {
  assert.equal(countdownChapter(0).label, 'The day');
  assert.equal(countdownChapter(-3).label, 'After the day');
  // …and they are ONE chapter each, not a countdown running backwards.
  assert.equal(countdownChapter(-3).key, countdownChapter(-40).key);
});

// ── ordering ───────────────────────────────────────────────────────────────

test('🔑 chapters run earliest → latest, and months always precede days', () => {
  const order = [countdownChapter(150), countdownChapter(31), countdownChapter(30), countdownChapter(1), countdownChapter(0), countdownChapter(-2)];
  const sorted = [...order].sort((a, b) => a.sort - b.sort);
  assert.deepEqual(
    sorted.map((c) => c.label),
    ['5 months to go', '1 month to go', '30 days to go', '1 day to go', 'The day', 'After the day'],
  );
});

test('🪤 rounding never lets a monthly chapter sort after a daily one', () => {
  // "1 month to go" covers 31–45 days. If its rank were derived from the ROUNDED
  // month it would collide with the 30-day bucket and the timeline would jump.
  assert.ok(countdownChapter(31).sort < countdownChapter(30).sort);
});

// ── travel ─────────────────────────────────────────────────────────────────

test('a trip counts its days instead', () => {
  const trip: ChapterContext = { eventDateIso: '2026-09-01', mode: 'trip', tripStartIso: '2026-09-01' };
  assert.equal(chapterFor(onManilaDate('2026-09-01'), trip)?.label, 'Day 1');
  assert.equal(chapterFor(onManilaDate('2026-09-03'), trip)?.label, 'Day 3');
  assert.equal(chapterFor(onManilaDate('2026-08-30'), trip)?.label, 'Getting there');
});

test('a trip with no recorded start falls back to the countdown', () => {
  const trip: ChapterContext = { eventDateIso: '2026-12-05', mode: 'trip', tripStartIso: null };
  assert.equal(chapterFor(onManilaDate('2026-12-04'), trip)?.label, '1 day to go');
});

test('day 1 is the start date itself, not the day after', () => {
  assert.equal(tripDayChapter(1).label, 'Day 1');
  assert.equal(tripDayChapter(0).key, 'pre');
});

// ── Manila, and the boundary that makes it matter ─────────────────────────

test('🪤 a late-evening Manila photo stays on its Manila date', () => {
  // 23:00 in Manila is 15:00 UTC the SAME day, but 01:00 Manila is 17:00 UTC the
  // PREVIOUS day. Reading these in UTC would file the last hours of the wedding
  // under "1 day to go" and the small hours under "The day".
  assert.equal(chapterFor('2026-12-05T23:30:00+08:00', WEDDING)?.label, 'The day');
  assert.equal(chapterFor('2026-12-06T00:30:00+08:00', WEDDING)?.label, 'After the day');
});

// ── nothing is ever lost ───────────────────────────────────────────────────

test('🚨 every photo comes out the other side, always', () => {
  const items = [
    { id: 'a', at: onManilaDate('2026-07-08') }, // ~5 months out
    { id: 'b', at: onManilaDate('2026-12-04') }, // 1 day to go
    { id: 'c', at: onManilaDate('2026-12-05') }, // the day
    { id: 'd', at: 'not-a-timestamp' }, // unplaceable
  ];
  const groups = groupIntoChapters(items, (i) => i.at, WEDDING);
  const seen = groups.flatMap((g) => g.items.map((i) => i.id));
  assert.equal(seen.length, items.length, 'no photo may be dropped');
  assert.deepEqual([...seen].sort(), ['a', 'b', 'c', 'd']);
});

test('an unplaceable photo gets an honest heading, not a guess', () => {
  const groups = groupIntoChapters(
    [{ at: 'nonsense' }],
    (i) => i.at,
    WEDDING,
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.label, 'Everything else');
});

test('…and that heading always sorts LAST', () => {
  const groups = groupIntoChapters(
    [{ at: 'nonsense' }, { at: onManilaDate('2026-12-05') }],
    (i) => i.at,
    WEDDING,
  );
  assert.equal(groups[groups.length - 1]?.label, 'Everything else');
});

test('no event date ⇒ everything is unplaceable, and still nothing is lost', () => {
  const none: ChapterContext = { eventDateIso: null, mode: 'countdown' };
  const groups = groupIntoChapters([{ at: onManilaDate('2026-12-05') }], (i) => i.at, none);
  assert.equal(groups[0]?.label, 'Everything else');
  assert.equal(groups[0]?.items.length, 1);
});

test('empty chapters never appear', () => {
  // A couple who shot on two days sees two headings, not thirty.
  const groups = groupIntoChapters(
    [{ at: onManilaDate('2026-12-05') }, { at: onManilaDate('2026-12-04') }],
    (i) => i.at,
    WEDDING,
  );
  assert.equal(groups.length, 2);
});

test('photos on the same day share one chapter', () => {
  const groups = groupIntoChapters(
    [
      { at: onManilaDate('2026-12-05', '09:00') },
      { at: onManilaDate('2026-12-05', '21:00') },
    ],
    (i) => i.at,
    WEDDING,
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.items.length, 2);
});

// ── the surface actually uses it ───────────────────────────────────────────

test('🪤 the gallery renders CHAPTERS, not one flat grid', () => {
  // The pure function above can be perfect and change nothing on screen. This
  // is the seam that has broken silently before on this feature family: correct
  // logic beside a surface that never calls it.
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const { join, dirname } = require('node:path') as typeof import('node:path');
  const { fileURLToPath } = require('node:url') as typeof import('node:url');
  const web = join(dirname(fileURLToPath(import.meta.url)), '..');
  const grid = readFileSync(join(web, 'app/papic/pool/_components/pool-grid.tsx'), 'utf8');
  assert.match(grid, /groupIntoChapters\(tiles, \(t\) => t\.capturedAt, chapters\)/);
  assert.match(grid, /\{chapter\.label\}/, 'each chapter must print its heading');
  assert.match(grid, /chapter\.items\.map/, 'and iterate ITS items, not all tiles');

  const page = readFileSync(join(web, 'app/papic/pool/page.tsx'), 'utf8');
  assert.match(page, /event_date/, 'the page must read the date the countdown needs');
  assert.match(
    page,
    /=== 'travel' \? 'trip' : 'countdown'/,
    'a trip counts its days; everything else counts down to the day',
  );
});

test('🪤 "photos of you" chapters too, on the SHOT time not the tag time', () => {
  // A guest tagged today into a five-month-old planning photo belongs in the
  // chapter the photo was TAKEN in. Keying on the tag's created_at would drag
  // every back-tagged photo into this week and quietly rewrite the journey.
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const { join, dirname } = require('node:path') as typeof import('node:path');
  const { fileURLToPath } = require('node:url') as typeof import('node:url');
  const web = join(dirname(fileURLToPath(import.meta.url)), '..');

  const loader = readFileSync(join(web, 'lib/guest-live-gallery.ts'), 'utf8');
  assert.match(loader, /capturedAt: string \| null;/, 'the photo must carry its shot time');
  // The ASSIGNMENT, not merely a mention of the map — an earlier version of this
  // assertion matched a name that survived the very mutation it was meant to
  // catch, because the map was still populated elsewhere in the file.
  assert.match(
    loader,
    /capturedAt: shotAtById\.get\(id\) \?\? null/,
    'the photo\u2019s capturedAt must come from the CAPTURE row',
  );
  assert.match(
    loader,
    /captured_at'\)/,
    'and captured_at must actually be selected from the capture tables',
  );
  assert.ok(
    !/capturedAt: new Date\(\)/.test(loader),
    'never stamp "now" — that files every back-tagged photo into this week',
  );

  const page = readFileSync(join(web, 'app/papic/me/[token]/page.tsx'), 'utf8');
  assert.match(page, /groupIntoChapters\(gallery\.photos, \(p\) => p\.capturedAt \?\? '', chapters\)/);
  assert.match(page, /\{chapter\.items\.map/, 'and iterate ITS items, not all photos');
});

test('a single-chapter gallery shows no heading at all', () => {
  // A lone "The day" over six photos is chrome, not orientation. Asserted
  // because the comment claiming it once shipped without the code doing it.
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const { join, dirname } = require('node:path') as typeof import('node:path');
  const { fileURLToPath } = require('node:url') as typeof import('node:url');
  const web = join(dirname(fileURLToPath(import.meta.url)), '..');
  const page = readFileSync(join(web, 'app/papic/me/[token]/page.tsx'), 'utf8');
  assert.match(page, /groups\.length > 1 \? \(/);
});
