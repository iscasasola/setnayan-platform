/**
 * story-spine.test.ts — the arithmetic of the story's clock.
 *
 * Every assertion here was MUTATION-CHECKED: the rule was broken on purpose and
 * this file confirmed RED before the rule was trusted. The occurrence counts of
 * each sabotage are recorded in the PR body.
 *
 * ⚠ IT RUNS UNDER TWO ZONES. `TZ=UTC` (what CI does) and `TZ=Asia/Manila` (what
 * the owner's machine does) must both pass. A Manila-day bug is invisible under
 * exactly one of them, which is why the repo has shipped that class of defect
 * nine times in one day on other surfaces.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AFTER_BAND,
  DAY_BAND,
  DIAL_WIDTH,
  ROAD_BAND,
  SEATED_BLOCK_TYPES,
  dayClock,
  dayX,
  dialBucketMinutes,
  editionVolume,
  filmTimecode,
  gapText,
  layOutDays,
  manilaInstantAt,
  manilaMinuteOfDay,
  mastheadEdition,
  nearestBarAt,
  percentOf,
  roadX,
  subtractWithheldFromBins,
  timecodeLabel,
  toRoman,
  venueStateAt,
  type VenueBlock,
  entryIsRendered,
  readerReached,
} from './story-spine';

// ─── Manila, always ─────────────────────────────────────────────────────────

test('a capture is placed by MANILA wall-clock, not the runtime zone', () => {
  // 5 p.m. UTC is 1 a.m. the NEXT Manila day. Reading this with the runtime's
  // own clock is correct in Manila and eight hours wrong on Vercel, silently.
  assert.equal(manilaMinuteOfDay('2026-02-14T17:00:00Z'), 60);
  assert.equal(manilaMinuteOfDay('2026-02-14T11:20:00+08:00'), 11 * 60 + 20);
  assert.equal(manilaMinuteOfDay('2026-02-14T00:00:00+08:00'), 0);
  assert.equal(manilaMinuteOfDay('2026-02-14T23:59:00+08:00'), 23 * 60 + 59);
  assert.equal(manilaMinuteOfDay(null), null);
  assert.equal(manilaMinuteOfDay('not a time'), null);
});

test('manilaInstantAt is the exact inverse of manilaMinuteOfDay', () => {
  for (const minute of [0, 1, 59, 60, 691, 1152, 1439]) {
    const ms = manilaInstantAt('2026-02-14', minute);
    assert.equal(manilaMinuteOfDay(new Date(ms).toISOString()), minute);
  }
});

// ─── The days ───────────────────────────────────────────────────────────────

test("a day's segment covers the hours that happened, not a whole clock face", () => {
  const c = dayClock([11 * 60 + 20, 21 * 60 + 47]);
  assert.equal(c.startMin, 10 * 60, 'starts on the hour before the first minute');
  assert.ok(c.endMin >= 21 * 60 + 47, 'ends after the last minute');
  assert.ok(c.endMin - c.startMin < 24 * 60, 'never the whole day');
});

test('a day with one written minute still gets a readable span', () => {
  const c = dayClock([13 * 60]);
  assert.ok(c.endMin - c.startMin >= 120);
});

test('a day with NO written minutes still gets a segment', () => {
  // The dial is where a reader learns a day exists. A day the host has not
  // written up yet — or whose minutes this reader may not have — must not
  // vanish off the axis.
  const c = dayClock([]);
  assert.ok(c.endMin > c.startMin);
});

test('DAY WIDTH IS PROPORTIONAL TO THE DAY, so two days are not drawn equal', () => {
  const [d1, d2] = layOutDays([
    { date: '2026-02-13', minutes: [21 * 60, 22 * 60] }, // a two-hour despedida
    { date: '2026-02-14', minutes: [11 * 60, 21 * 60 + 47] }, // a ten-hour wedding
  ]);
  assert.ok(d1 && d2);
  assert.ok(d2.x1 - d2.x0 > d1.x1 - d1.x0, 'the long day is the wide one');
  assert.ok(d1.x0 >= DAY_BAND.x0, 'inside the day band');
  assert.ok(d2.x1 <= DAY_BAND.x1 + 0.001, 'inside the day band');
  assert.ok(d2.x0 > d1.x1, 'the days do not overlap');
});

test('A DAY-2 CAPTURE CAN NEVER BE DRAWN ON A DAY-1 BAR', () => {
  // The load-bearing multi-day rule (08 step 0.4). Each day carries its own
  // clock, so 9 p.m. on day 1 and 9 p.m. on day 2 are different places.
  const days = layOutDays([
    { date: '2026-02-13', minutes: [20 * 60, 23 * 60] },
    { date: '2026-02-14', minutes: [11 * 60, 21 * 60] },
  ]);
  const [d1, d2] = days;
  assert.ok(d1 && d2);
  const nineOnDayOne = dayX(d1, 21 * 60);
  const nineOnDayTwo = dayX(d2, 21 * 60);
  assert.ok(nineOnDayOne <= d1.x1, 'day 1 stays in day 1');
  assert.ok(nineOnDayTwo >= d2.x0, 'day 2 stays in day 2');
  assert.notEqual(nineOnDayOne, nineOnDayTwo);
});

test('every band stays inside the axis, and they do not overlap', () => {
  assert.ok(ROAD_BAND.x1 < DAY_BAND.x0);
  assert.ok(DAY_BAND.x1 < AFTER_BAND.x0);
  assert.equal(AFTER_BAND.x1, DIAL_WIDTH);
  assert.equal(percentOf(DIAL_WIDTH / 2), '50.000%');
});

test('a road date outside its span is clamped, never dropped', () => {
  const start = Date.parse('2025-08-03T00:00:00+08:00');
  const end = Date.parse('2026-02-14T00:00:00+08:00');
  assert.equal(roadX(start - 86_400_000 * 900, start, end), ROAD_BAND.x0);
  assert.equal(roadX(end + 86_400_000, start, end), ROAD_BAND.x1);
});

// ─── The bins ───────────────────────────────────────────────────────────────

test('the bucket width never reaches the RPC as 0 or above its clamp', () => {
  for (const days of [1, 2, 3, 7, 30, 365]) {
    const m = dialBucketMinutes(days);
    assert.ok(m >= 1, `${days} days → ${m}`);
    assert.ok(m <= 180, `${days} days → ${m}`);
  }
  assert.equal(dialBucketMinutes(1), 5, 'a one-day event gets the design resolution');
  assert.ok(dialBucketMinutes(30) > dialBucketMinutes(1), 'it only ever grows');
});

test('EVERY BAR OPENS — any tap on the axis resolves to a bar', () => {
  const centres = [4, 12, 40, 500, 998];
  for (let x = -50; x <= DIAL_WIDTH + 50; x += 7) {
    const i = nearestBarAt(centres, x);
    assert.ok(i >= 0 && i < centres.length, `x=${x} found no bar`);
  }
  // A tap on a bar's own centre opens THAT bar, not a neighbour.
  centres.forEach((c, i) => assert.equal(nearestBarAt(centres, c), i));
  assert.equal(nearestBarAt([], 10), -1, 'no bars, no bar');
});

test('A VETOED CAPTURE WITH NO BLURRED COPY COMES OFF ITS OWN BAR', () => {
  const t0 = Date.parse('2026-02-14T11:00:00+08:00');
  const bins = [
    { at: t0, captures: 4 },
    { at: t0 + 5 * 60_000, captures: 9 },
    { at: t0 + 10 * 60_000, captures: 2 },
  ];
  const out = subtractWithheldFromBins(
    bins,
    [t0 + 6 * 60_000, t0 + 7 * 60_000, t0 + 1000],
    5,
  );
  assert.deepEqual(
    out.map((b) => b.captures),
    [3, 7, 2],
    'it comes off the bin it was taken in, never a neighbour',
  );
});

test('a withheld capture outside the drawn window is charged to no bar at all', () => {
  const t0 = Date.parse('2026-02-14T11:00:00+08:00');
  const bins = [
    { at: t0, captures: 3 },
    { at: t0 + 5 * 60_000, captures: 3 },
  ];
  const before = subtractWithheldFromBins(bins, [t0 - 86_400_000], 5);
  assert.deepEqual(before.map((b) => b.captures), [3, 3]);
  const after = subtractWithheldFromBins(bins, [t0 + 86_400_000], 5);
  assert.deepEqual(after.map((b) => b.captures), [3, 3]);
});

test('a bar never goes below zero, however many captures are withheld', () => {
  const t0 = Date.parse('2026-02-14T11:00:00+08:00');
  const out = subtractWithheldFromBins([{ at: t0, captures: 1 }], [t0, t0, t0, t0], 5);
  assert.equal(out[0]!.captures, 0);
});

// ─── The gaps ───────────────────────────────────────────────────────────────

test('gaps are drawn as gaps, so the day keeps its real proportions', () => {
  assert.equal(gapText(11 * 60 + 20, 14 * 60 + 38), '3 h 18 m');
  assert.equal(gapText(14 * 60 + 38, 15 * 60 + 4), '26 m');
  assert.equal(gapText(15 * 60, 19 * 60), '4 h');
  // Under the threshold there is nothing worth drawing a rule about.
  assert.equal(gapText(15 * 60, 15 * 60 + 8), null);
  assert.equal(gapText(15 * 60, 14 * 60), null, 'time does not run backwards');
});

// ─── The films ──────────────────────────────────────────────────────────────

test('ONE CARD PER BROADCAST SESSION — a minute is timecoded into ITS OWN film', () => {
  // The defect: a single 2h48 file cannot span 2:38 PM → 9:47 PM. The shipped
  // page reads ONE embed url — the most recent completed broadcast — so a
  // timecode measured against it puts the money dance at hour seven of a
  // three-hour video.
  const ceremony = {
    videoId: 'aaaaaaaaaaa',
    liveAtMs: Date.parse('2026-02-14T14:20:00+08:00'),
    endedAtMs: Date.parse('2026-02-14T16:00:00+08:00'),
  };
  const reception = {
    videoId: 'bbbbbbbbbbb',
    liveAtMs: Date.parse('2026-02-14T17:30:00+08:00'),
    endedAtMs: Date.parse('2026-02-14T23:00:00+08:00'),
  };
  const sessions = [ceremony, reception];

  const vows = filmTimecode(Date.parse('2026-02-14T15:04:00+08:00'), sessions);
  assert.equal(vows?.videoId, ceremony.videoId);
  assert.equal(vows?.label, '0:44:00');

  const money = filmTimecode(Date.parse('2026-02-14T21:47:00+08:00'), sessions);
  assert.equal(money?.videoId, reception.videoId, 'the RECEPTION film, not the ceremony');
  assert.equal(money?.label, '4:17:00');

  // The hour and a half between the two broadcasts is in neither film.
  assert.equal(filmTimecode(Date.parse('2026-02-14T16:45:00+08:00'), sessions), null);
  assert.equal(filmTimecode(Date.parse('2026-02-14T09:00:00+08:00'), sessions), null);
  assert.equal(filmTimecode(Date.parse('2026-02-15T09:00:00+08:00'), sessions), null);
});

test('a broadcast whose end was never stamped does not swallow the rest of the story', () => {
  const open = [
    {
      videoId: 'ccccccccccc',
      liveAtMs: Date.parse('2026-02-14T14:20:00+08:00'),
      endedAtMs: null,
    },
  ];
  assert.ok(filmTimecode(Date.parse('2026-02-14T15:00:00+08:00'), open));
  assert.equal(
    filmTimecode(Date.parse('2026-02-15T10:00:00+08:00'), open),
    null,
    'the morning after is not twenty hours into last night’s stream',
  );
});

test('timecodes always show the hour, the way a broadcast timecode reads', () => {
  assert.equal(timecodeLabel(0), '0:00:00');
  assert.equal(timecodeLabel(2640), '0:44:00');
  assert.equal(timecodeLabel(15420), '4:17:00');
});

// ─── The room ───────────────────────────────────────────────────────────────

const BLOCKS: VenueBlock[] = [
  {
    label: 'Getting ready',
    blockType: 'pre_ceremony',
    startMs: Date.parse('2026-02-14T11:00:00+08:00'),
    endMs: Date.parse('2026-02-14T12:30:00+08:00'),
    location: 'the suite',
    vendorNames: [],
  },
  {
    label: 'Ceremony',
    blockType: 'ceremony',
    startMs: Date.parse('2026-02-14T14:00:00+08:00'),
    endMs: Date.parse('2026-02-14T15:30:00+08:00'),
    location: 'on the lawn',
    vendorNames: ['Bloom & Vine'],
  },
  {
    label: 'Reception',
    blockType: 'reception',
    startMs: Date.parse('2026-02-14T17:30:00+08:00'),
    endMs: Date.parse('2026-02-14T22:30:00+08:00'),
    location: 'the long tables',
    vendorNames: ['The Long Table'],
  },
];

test('OWNER LOCK 6 — assigned seats exist ONLY while the reception is in use', () => {
  assert.equal(venueStateAt(Date.parse('2026-02-14T11:20:00+08:00'), BLOCKS), 'unseated');
  assert.equal(venueStateAt(Date.parse('2026-02-14T15:04:00+08:00'), BLOCKS), 'ceremony');
  assert.equal(venueStateAt(Date.parse('2026-02-14T19:12:00+08:00'), BLOCKS), 'seated');
  // The gap between the ceremony and the reception: no plan, because a
  // photograph then belongs to a person, not a table.
  assert.equal(venueStateAt(Date.parse('2026-02-14T16:30:00+08:00'), BLOCKS), 'unseated');
  assert.equal(venueStateAt(Date.parse('2026-02-14T08:00:00+08:00'), BLOCKS), 'before');
});

test('an event with no schedule says so, and does NOT read as "before"', () => {
  // A roaming celebration or a hangout has no venue state to be early for.
  assert.equal(venueStateAt(Date.now(), []), 'no_venue');
});

test('the seated set is the reception venue, never the send-off or the after-party', () => {
  for (const t of ['reception', 'dinner', 'program', 'dancing']) {
    assert.ok(SEATED_BLOCK_TYPES.has(t), t);
  }
  for (const t of ['ceremony', 'pre_ceremony', 'cocktails', 'send_off', 'after_party', 'lodging', 'tour', 'custom']) {
    assert.ok(!SEATED_BLOCK_TYPES.has(t), t);
  }
});

// ─── The edition ────────────────────────────────────────────────────────────

test('THE EDITION NUMBER APPEARS ONLY AT PUBLISH', () => {
  // Before publish the number is recomputed on every render — it counts the
  // event's place in the awards cycle as the cycle stands today — so showing it
  // under the words "theirs forever" is telling somebody something untrue.
  assert.equal(mastheadEdition('2026-02-14', 3, false), 'Vol. I');
  assert.equal(mastheadEdition('2026-02-14', 3, true), 'Vol. I · No. 3');
  assert.equal(mastheadEdition('2026-02-14', null, true), 'Vol. I', 'no number, no claim');
});

test('the volume follows the awards cycle, not the calendar year', () => {
  // Vol. I IS the Nov-18-2026 → Nov-17-2027 cycle, and everything before it is
  // clamped into the inaugural edition rather than given a Volume 0.
  assert.equal(editionVolume('2026-05-01'), 1, 'before the first cycle → the inaugural volume');
  assert.equal(editionVolume('2026-11-18'), 1, 'the first cycle opens Vol. I');
  assert.equal(editionVolume('2027-11-17'), 1, 'the day before the next cutoff is still Vol. I');
  assert.equal(editionVolume('2027-11-18'), 2, 'the next cycle opens Vol. II');
  assert.equal(editionVolume('2028-06-01'), 2, 'a June wedding keeps its December volume');
  assert.equal(editionVolume(null), 1);
  assert.equal(toRoman(4), 'IV');
  assert.equal(toRoman(0), 'I');
});

/* ══════════════════════════════════════════════════════════════════════════
   WHERE THE READER IS — and the hidden copy that captured it
   ══════════════════════════════════════════════════════════════════════════ */

test('the reader is never placed inside an entry that is not on the page', () => {
  /*
    🔴 THE EXACT DOM MEASURED ON THE LIVE SITE, 2026-09-09. `/movie-night`
    carried SIX entries: three drawn, and three more inside a `<div hidden>`
    (React parks streamed content in a hidden buffer before relocating it).

    A `display:none` box reports `top: 0`. Zero is above every read line, and
    the hidden copy sorts LAST in document order — so "keep the last entry above
    the line" keeps an invisible one at scroll position zero and never lets go.
    The needle sat at the end of the dial, the readout named the closing entry,
    and the page painted its `after` colour instead of its morning one, from the
    moment it loaded.

    The reader is at the TOP here. The only correct answer is `null` — the
    cover, nothing reached.
  */
  const drawn = [
    { top: 1596, height: 520, width: 976 },
    { top: 2245, height: 610, width: 976 },
    { top: 3448, height: 380, width: 976 },
  ];
  const hiddenCopy = [
    { top: 0, height: 0, width: 0 },
    { top: 0, height: 0, width: 0 },
    { top: 0, height: 0, width: 0 },
  ];

  assert.equal(
    readerReached([...drawn, ...hiddenCopy], 900 * 0.38),
    null,
    'at the top of the page the reader has reached nothing — a hidden entry is not a reached one',
  );

  // And the hidden copy must not win once the reader IS inside the story.
  const insideTheSecond = readerReached([...drawn, ...hiddenCopy], 2400);
  assert.equal(insideTheSecond?.index, 1, 'the reader is in the second DRAWN entry');
});

test('a rendered entry is still found normally, and progress runs 0 → 1', () => {
  const boxes = [
    { top: -200, height: 400, width: 900 },
    { top: 800, height: 400, width: 900 },
  ];
  const early = readerReached(boxes, 0);
  assert.equal(early?.index, 0);
  assert.ok(early!.progress > 0 && early!.progress < 1, `progress was ${early?.progress}`);

  assert.equal(readerReached(boxes, 900)?.index, 1, 'the later entry wins once it is reached');
  assert.equal(readerReached(boxes, -1000), null, 'above everything is the cover');
  assert.equal(readerReached([], 342), null, 'a story with no entries reaches nothing');
});

test('entryIsRendered is about extent, not position', () => {
  // Scrolled far off-screen — still rendered, still followable.
  assert.equal(entryIsRendered({ top: -99999, height: 400, width: 900 }), true);
  assert.equal(entryIsRendered({ top: 99999, height: 400, width: 900 }), true);
  // display:none — no extent at all.
  assert.equal(entryIsRendered({ top: 0, height: 0, width: 0 }), false);
  // A zero-height box that still has width is a collapsed element, not a
  // hidden one; it is drawn, so it counts.
  assert.equal(entryIsRendered({ top: 10, height: 0, width: 900 }), true);
});

