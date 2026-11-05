/**
 * the-when-pills-are-one-width.test.ts — DOWN A LIST, EVERY "WHEN" PILL IS ONE WIDTH, SO THE NAMES START ON ONE LINE.
 *
 * Owner, 2026-10-08, on Studio › Love Story's list (asked what the controller recommends for the ragged names;
 * the answer was "aligned"): the pill hugged its words — "2019" narrow, "Feb 14, 2021" wide — so, measured at
 * 375 px, "One umbrella" began at x = 92 and "Our first trip" at x = 111.
 *
 * THE RULE: a when pill is as wide as the WIDEST value its control can show needs, the value centred in it; the name
 * takes the rest; a pill never cuts its value. No width is written anywhere: the pill carries the widest values
 * inside it, unseen and with no height, in its own type, and the BROWSER measures (`TickerPill widest`,
 * `WIDEST_WHEN_WORDS` / `WIDEST_CLOCK_WORDS`).
 *
 * This runner has no layout engine, so a pixel offset cannot be read here (it is read in a browser on the review
 * copy). What CAN be run is the arithmetic the browser does — a pill's width is the widest of the words it holds —
 * under MANY made-up typefaces (random letter widths, digits at one width as `tabular-nums` draws them):
 *
 *   (1) NOTHING A WHEN CAN SHOW IS WIDER THAN THE WIDEST IT CARRIES — every date (a year, a month, a full date, all
 *       twelve months, one- and two-digit days), "When", every clock time in five-minute steps, "End" — in every
 *       made-up typeface. So the pill's width never depends on WHICH value it shows.
 *   (2) PAINTED, THE LOVE STORY: a row with a short when and a row with a long one hold the same widest words, in
 *       the pill's own button → the same pill width → the same offset for the name. Every row; the new row too.
 *   (3) PAINTED, THE SCHEDULE: both pills of every row, whatever the times.
 *   (4) UNSEEN, NO HEIGHT, NEVER CUT: the carried words are invisible, zero-height and hidden from a screen reader;
 *       the value is still the button's first words; nothing on the pill can truncate it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { sortMoments, type LoveStoryMoment } from './love-story-moments';
import { MONTH_NAMES, WIDEST_CLOCK_WORDS, WIDEST_WHEN_WORDS, clockWords, whenWords } from './timeline';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const STORY = 'app/dashboard/[eventId]/website/our-story/_components';
const SCHED = 'app/dashboard/[eventId]/schedule/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** A made-up typeface: every character its own width — except digits, which share one (`tabular-nums`). */
function typeface(seed: number): (text: string) => number {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const widths = new Map<string, number>();
  const digit = 5 + rnd() * 6;
  const of = (ch: string) => {
    if (/\d/.test(ch)) return digit;
    if (!widths.has(ch)) widths.set(ch, 2 + rnd() * 10);
    return widths.get(ch)!;
  };
  return (text) => [...text].reduce((w, ch) => w + of(ch), 0);
}
const FACES = Array.from({ length: 200 }, (_, i) => typeface(i * 7919 + 1));
/** What the browser does: the pill is as wide as the widest of the words it holds. */
const pillWidth = (face: (t: string) => number, value: string, carried: readonly string[]) => Math.max(face(value), ...carried.map(face));
const widest = (face: (t: string) => number, carried: readonly string[]) => Math.max(...carried.map(face));

test('(1) nothing a when can show is wider than the widest it carries — in two hundred made-up typefaces', async () => {
  assert.equal(WIDEST_WHEN_WORDS.length, 12, 'a month is missing from the widest whens');
  assert.deepEqual(WIDEST_WHEN_WORDS.map((w) => w.slice(0, 3)), MONTH_NAMES.map((m) => m.slice(0, 3)));
  for (const w of WIDEST_WHEN_WORDS) assert.match(w, /^[A-Z][a-z]{2} \d\d, \d{4}$/, `“${w}” is not a full date with a two-digit day`);
  assert.deepEqual(WIDEST_CLOCK_WORDS, ['10:00 AM', '10:00 PM']);

  // EVERY DATE the Love Story's pill can show…
  const dates: string[] = ['When'];
  for (const y of [1990, 2019, 2026, 2031]) {
    dates.push(whenWords({ y }));
    for (let m = 1; m <= 12; m++) {
      dates.push(whenWords({ y, m }));
      for (const d of [1, 9, 10, 14, 28, 30, 31]) dates.push(whenWords({ y, m, d }));
    }
  }
  assert.ok(dates.includes('Feb 14, 2021') === false && dates.includes('Feb 14, 2019') && dates.includes('2019') && dates.includes('Sep 2026'), 'anti-vacuity: the dates are not the ones the row shows');
  // …and EVERY TIME the Schedule's can.
  const times: string[] = ['End'];
  for (let min = 0; min < 24 * 60; min += 5) times.push(clockWords(min));
  assert.ok(times.includes('2:00 PM') && times.includes('12:55 AM') && times.includes('10:30 PM') && times.length === 289);

  // Each wearer adds the one word its pill reads before a value is set ("When" · "End") — in a typeface with a very
  // wide W it could be the widest of all, and then it too must not move a name.
  const { MOMENT_WHEN_WIDEST } = await import(`../${STORY}/moment-order-cards`);
  const { MOMENT_TIME_WIDEST } = await import(`../${SCHED}/studio-day`);
  assert.deepEqual(MOMENT_WHEN_WIDEST, [...WIDEST_WHEN_WORDS, 'When']);
  assert.deepEqual(MOMENT_TIME_WIDEST, [...WIDEST_CLOCK_WORDS, 'End']);
  for (const [name, values, carried] of [['a date', dates, MOMENT_WHEN_WIDEST as readonly string[]], ['a time', times, MOMENT_TIME_WIDEST as readonly string[]]] as const) {
    for (const face of FACES) {
      const cap = widest(face, carried);
      for (const v of values) {
        assert.ok(face(v) <= cap + 1e-9, `${name}, “${v}”, is wider than the widest its pill carries (${face(v).toFixed(1)} > ${cap.toFixed(1)}) — its row’s name would start further right`);
        assert.equal(pillWidth(face, v, carried), cap);
      }
    }
  }
  // Anti-vacuity: WITHOUT the carried words the widths really do differ — this is the fault being held off.
  assert.notEqual(FACES[0]!('2019'), FACES[0]!('Feb 14, 2021'));
});

/** The when pills of a painted row: the value shown, and the words each carries unseen. */
function pills(row: string, which: string): { value: string; carried: string[]; button: string }[] {
  return [...row.matchAll(new RegExp(`<button\\b[^>]*data-ticker-pill="${which}"[^>]*>([\\s\\S]*?)</button>`, 'g'))].map((m) => ({
    button: m[0].slice(0, m[0].indexOf('>') + 1),
    value: m[1]!.slice(0, m[1]!.indexOf('<') === -1 ? undefined : m[1]!.indexOf('<')),
    carried: [...m[1]!.matchAll(/<span[^>]*data-ticker-pill-fit=""[^>]*>([^<]*)<\/span>/g)].map((x) => x[1]!),
  }));
}

test('(2) painted, the Love Story: a short when and a long one give the SAME pill width — so the SAME offset for the name', async () => {
  const { MomentOrderCards } = await import(`../${STORY}/moment-order-cards`);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const moments: LoveStoryMoment[] = [
    { id: 'u', date: { y: 2019 }, title: 'One umbrella', line: 'A rainy Tuesday.', order: 0, canvas: {} },
    { id: 't', date: { y: 2021, m: 2, d: 14 }, title: 'Our first trip', line: 'Baguio.', order: 1, canvas: {} },
    { id: 's', date: { y: 2022, m: 6 }, title: 'Siargao', line: 'He asked.', order: 2, canvas: {} },
    { id: 'x', line: 'We just knew.', title: 'No date yet', order: 3, canvas: {} },
  ];
  const action = async () => {};
  const html = renderToStaticMarkup(
    React.createElement(MomentOrderCards, { action, moments: sortMoments(moments), mediaUrls: {}, sheet: { action, moments, partners: [], ownsPro: true, storeShell: false, proHref: '/p', proPrice: null, eventId: 'ev-1', mediaUrls: {} }, add: { can: true } }),
  );
  const rows = html.split(/(?=<li[^>]*data-moment-card=")/).slice(1).map((r) => r.slice(0, r.indexOf('</li>')));
  assert.equal(rows.length, 4);
  const whens = rows.map((r) => pills(r, 'when')[0]!);
  assert.deepEqual(whens.map((p) => p.value), ['2019', 'Feb 14, 2021', 'Jun 2022', 'When'], 'the value is no longer the pill’s first words');
  for (const p of whens) assert.deepEqual(p.carried, [...WIDEST_WHEN_WORDS, 'When'], `the pill showing “${p.value}” does not carry the widest whens — it hugs its own words`);
  // THE OFFSET: the name starts where the pill ends (the row's own padding and gap are the same for every row), so
  // equal pill widths are equal offsets — in every made-up typeface.
  for (const face of FACES) {
    const offsets = whens.map((p) => pillWidth(face, p.value, p.carried));
    assert.equal(new Set(offsets).size, 1, `the names start at ${offsets.map((o) => o.toFixed(1)).join(' / ')}`);
  }
  // The same floor, type and padding on every pill (nothing else that could move one name).
  assert.equal(new Set(whens.map((p) => /class="([^"]*)"/.exec(p.button)![1]!.replace(' !text-ink/55', '').replace(/\s+/g, ' ').trim())).size, 1, 'one when pill is dressed differently from another');
  // The picture square is not a when: it carries nothing.
  assert.deepEqual(pills(rows[0]!, 'photos')[0]!.carried, []);
  // A new moment's row wears the same rule (it is drawn after a tap, so it is read from the source).
  const s = read(`${STORY}/moment-order-cards.tsx`);
  assert.equal((s.match(/<TickerPill\b[^>]*data="when"/g) ?? []).length, 2);
  assert.equal((s.match(/widest=\{MOMENT_WHEN_WIDEST\}/g) ?? []).length, 2, 'a when pill on this page hugs its own words');
});

test('(3) painted, the Schedule: both pills of every row are one width, whatever the times', async () => {
  const { StudioDay } = await import(`../${SCHED}/studio-day`);
  const { DayActionsContext } = await import(`../${SCHED}/day-ui`);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const DAY = '2026-12-12';
  const moment = (id: string, label: string, start: string, end: string | null) => ({
    block_id: id, label, block_type: 'custom', start_at: `${DAY}T${start}:00.000Z`, end_at: end ? `${DAY}T${end}:00.000Z` : null, location: null, notes: null,
    is_public: true, parent_block_id: null, run_state: 'upcoming', staged: false, responsible_party: null, responsible_vendor_ids: [], audience: null,
  });
  const actions = new Proxy({}, { get: () => async () => {} });
  const html = renderToStaticMarkup(
    React.createElement(
      DayActionsContext.Provider,
      { value: actions as never },
      React.createElement(StudioDay as React.ComponentType<Record<string, unknown>>, {
        eventId: 'ev-1', dateKey: DAY, canEdit: true, onPatch: () => {}, onAdd: () => {}, onMore: () => {}, notice: null,
        moments: [moment('a', 'Breakfast', '01:05', '02:00'), moment('b', 'Ceremony', '10:30', '11:55'), moment('c', 'Dancing', '14:30', '22:00'), moment('d', 'Send-off', '23:00', null)],
      }),
    ),
  );
  const rows = html.split(/(?=<li[^>]*data-studio-moment=")/).slice(1).map((r) => r.slice(0, r.indexOf('</li>')));
  assert.equal(rows.length, 4);
  const all = rows.flatMap((r) => [pills(r, 'start')[0]!, pills(r, 'end')[0]!]);
  assert.ok(all.some((p) => /^\d:\d\d [AP]M$/.test(p.value)) && all.some((p) => /^\d\d:\d\d [AP]M$/.test(p.value)) && all.some((p) => p.value === 'End'), `anti-vacuity: the rows do not mix short, long and empty times: ${all.map((p) => p.value).join(' · ')}`);
  for (const p of all) assert.deepEqual(p.carried, [...WIDEST_CLOCK_WORDS, 'End'], `the pill showing “${p.value}” does not carry the widest times`);
  for (const face of FACES) {
    const offsets = rows.map((r) => pillWidth(face, pills(r, 'start')[0]!.value, pills(r, 'start')[0]!.carried) + pillWidth(face, pills(r, 'end')[0]!.value, pills(r, 'end')[0]!.carried));
    assert.equal(new Set(offsets.map((o) => o.toFixed(6))).size, 1, `the names start at ${offsets.map((o) => o.toFixed(1)).join(' / ')}`);
  }
});

test('(4) the carried words are unseen, have no height and are hidden from a screen reader; the value is never cut', async () => {
  const { TickerPill, TICKER_PILL_CLASS, TICKER_PILL_FIT_CLASS } = await import('../app/_components/ticker');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const paint = (w?: readonly string[]) => renderToStaticMarkup(React.createElement(TickerPill as React.ComponentType<Record<string, unknown>>, { text: '2019', ariaLabel: 'When: 2019', title: 'When', widest: w, data: 'when' }, (() => null) as unknown as React.ReactNode));
  const fit = paint(WIDEST_WHEN_WORDS);
  // The value is still the button's FIRST words; it is named for a screen reader by the button itself.
  assert.match(fit, /^<button type="button" aria-label="When: 2019"[^>]*data-ticker-pill="when"[^>]*>2019<span/);
  const carried = [...fit.matchAll(/<span([^>]*)>([^<]*)<\/span>/g)];
  assert.equal(carried.length, WIDEST_WHEN_WORDS.length);
  for (const [, attrs] of carried) {
    assert.match(attrs!, /aria-hidden="true"/, 'a carried word is read out');
    const cls = /class="([^"]*)"/.exec(attrs!)![1]!.split(/\s+/);
    for (const c of ['invisible', 'h-0', 'overflow-hidden']) assert.ok(cls.includes(c), `a carried word is ${c === 'invisible' ? 'seen' : 'given height'} (${cls.join(' ')})`);
  }
  // ONE column as wide as the widest, the value centred in it — and the pill keeps its own look.
  const cls = /^<button[^>]*class="([^"]*)"/.exec(fit)![1]!.split(/\s+/);
  for (const c of TICKER_PILL_FIT_CLASS.split(' ')) assert.ok(cls.includes(c), `the fitted pill lost ${c}`);
  for (const c of ['!inline-grid', 'grid-cols-1', 'justify-items-center', 'content-center']) assert.ok(TICKER_PILL_FIT_CLASS.split(' ').includes(c));
  for (const c of TICKER_PILL_CLASS.split(' ').filter(Boolean)) assert.ok(cls.includes(c), `the fitted pill lost its own ${c}`);
  // NEVER CUT: nothing on the pill hides overflow or truncates, and it never wraps.
  assert.ok(cls.includes('whitespace-nowrap'));
  assert.ok(!cls.some((c) => /^(truncate|overflow-hidden|overflow-x-hidden|text-ellipsis|line-clamp-\d+|max-w-.*)$/.test(c)), `the pill can cut its value: ${cls.join(' ')}`);
  // A pill handed no widest words is exactly the pill it was (the picture square; any other wearer).
  const plain = paint(undefined);
  assert.match(plain, /^<button[^>]*>2019<\/button>$/);
  assert.doesNotMatch(plain, /inline-grid|data-ticker-pill-fit/);
  assert.equal(paint([]), plain);
});
