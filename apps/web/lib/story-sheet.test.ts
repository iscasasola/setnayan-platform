/**
 * THE SHEET MODEL — which moments draw a page on the public story, what is on it, and where on the
 * day's spine it goes. Step 5 of `10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveArrangement, type PoolItem, type StoredArrangement } from './story-arrangement';
import {
  WORD_COLOR_HEX,
  placeSheetsOnDays,
  refsOnSheets,
  sheetsOf,
  withoutPlacedMedia,
} from './story-sheet';

const P = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const at = (iso: string) => Date.parse(iso);

const pool: PoolItem[] = [1, 2, 3].map((n) => ({
  ref: P(n),
  media: n === 3 ? 'snippet' : 'photo',
  capturedAtMs: at(`2026-08-20T0${n + 5}:00:00Z`),
  stillKey: `k/${n}.jpg`,
  playKey: n === 3 ? 'k/3.mp4' : null,
}));
const runOfShow = [
  { id: 'ros:A', label: 'The march', startMs: at('2026-08-20T06:00:00Z') },
  { id: 'ros:B', label: 'The long table', startMs: at('2026-08-20T10:40:00Z') },
];

function hand(over: Partial<StoredArrangement> = {}): StoredArrangement {
  return {
    shape: 1,
    mode: 'hand',
    handTouched: true,
    moments: [
      {
        id: 'ros:A',
        objects: [
          { id: 'photo:1', kind: 'photo', ref: P(1), x: 20, y: 16, w: 146, h: 100 },
          { id: 'words:1', kind: 'words', text: 'Hello', x: 200, y: 40, size: 19, color: 'blue', backing: false, turn: 0 },
          { id: 'words:2', kind: 'words', text: '   ', x: 200, y: 300, size: 19, color: 'ink', backing: false, turn: 0 },
        ],
      },
      { id: 'own:after-a', name: 'Our own', objects: [{ id: 'photo:3', kind: 'photo', ref: P(3), x: 0, y: 0, w: 146, h: 100 }] },
      { id: 'ros:B', objects: [] },
    ],
    sets: [],
    ...over,
  };
}

const resolved = (stored: StoredArrangement | null, p: PoolItem[] = pool) =>
  resolveArrangement({ stored, runOfShow, pool: p, dropBlankWords: true });

test('by hand — one sheet per moment with something on it, in the host\'s order', () => {
  const sheets = sheetsOf(resolved(hand()));
  assert.deepEqual(
    sheets.map((s) => [s.momentId, s.name]),
    [
      ['ros:A', 'The march'],
      ['own:after-a', 'Our own'],
    ],
    'the empty run-of-show moment draws NO sheet',
  );
  const first = sheets[0]!;
  assert.deepEqual(first.objects.map((o) => o.kind), ['photo', 'words'], 'blank words draw nothing');
  const words = first.objects.find((o) => o.kind === 'words');
  assert.equal(words?.kind === 'words' && words.color, WORD_COLOR_HEX.blue);
  assert.equal(sheets[1]!.objects[0]!.kind, 'snippet');
});

test('Automatic — NO sheet, so the story is drawn exactly as it was before', () => {
  assert.deepEqual(sheetsOf(resolved(hand({ mode: 'auto' }))), []);
  assert.deepEqual(sheetsOf(resolved(null)), [], 'nobody arranged anything');
});

test('a withheld arrangement (S3) draws nothing', () => {
  const r = { ...resolved(hand()), withheld: true };
  assert.deepEqual(sheetsOf(r), []);
});

test('a photo out of this reader\'s pool is not on the sheet — and a page left empty draws no sheet', () => {
  const sheets = sheetsOf(resolved(hand(), pool.filter((p) => p.ref !== P(3))));
  assert.deepEqual(sheets.map((s) => s.momentId), ['ros:A'], 'the page whose only photo was taken back is gone');
});

test('the sheet grows downward to meet large words the editor never measured', () => {
  const tall = hand({
    moments: [
      {
        id: 'ros:A',
        objects: [
          { id: 'words:big', kind: 'words', text: 'one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten', x: 0, y: 200, size: 64, color: 'ink', backing: false, turn: 0 },
        ],
      },
    ],
  });
  const [sheet] = sheetsOf(resolved(tall));
  // Ten lines at 64 × 1.25 is 800 units of type before any padding.
  assert.ok(sheet!.height >= 200 + 800, `the sheet stops at ${sheet!.height}, under the words`);
});

test('refsOnSheets — every capture drawn on a sheet, lower-cased, no words', () => {
  const refs = refsOnSheets(sheetsOf(resolved(hand())));
  assert.deepEqual([...refs].sort(), [P(1), P(3)].sort());
});

/* ── where a sheet goes on the spine ────────────────────────────────────── */

test('a run-of-show moment goes to its block\'s start; the host\'s own moment follows the one before it', () => {
  const placed = placeSheetsOnDays(
    [
      { startMs: at('2026-08-20T06:00:00Z'), id: 'a' },
      { startMs: null, id: 'mine' },
      { startMs: at('2026-08-20T10:40:00Z'), id: 'b' },
    ],
    ['2026-08-20'],
  );
  assert.deepEqual(
    placed.map((p) => [p.sheet.id, p.day, p.atMs, p.timed]),
    [
      ['a', '2026-08-20', at('2026-08-20T06:00:00Z'), true],
      ['mine', '2026-08-20', at('2026-08-20T06:00:00Z'), false],
      ['b', '2026-08-20', at('2026-08-20T10:40:00Z'), true],
    ],
  );
});

test('a host\'s moment that LEADS borrows the next moment\'s time; nothing timed → the top of day one', () => {
  const lead = placeSheetsOnDays(
    [{ startMs: null }, { startMs: at('2026-08-20T10:40:00Z') }],
    ['2026-08-20'],
  );
  assert.equal(lead[0]!.atMs, at('2026-08-20T10:40:00Z'));
  assert.equal(lead[0]!.timed, false);

  const none = placeSheetsOnDays([{ startMs: null }], ['2026-08-20', '2026-08-21']);
  assert.deepEqual(none.map((p) => [p.day, p.atMs]), [['2026-08-20', null]]);
});

test('Manila days, not UTC — a 1 a.m. Manila block is on the second day', () => {
  // 2026-08-20T17:30Z is 01:30 on the 21st in Manila.
  const [p] = placeSheetsOnDays([{ startMs: at('2026-08-20T17:30:00Z') }], ['2026-08-20', '2026-08-21']);
  assert.equal(p!.day, '2026-08-21');
});

test('a block typed on a date the celebration does not have still appears — on the nearest day', () => {
  const [late] = placeSheetsOnDays([{ startMs: at('2026-09-01T06:00:00Z') }], ['2026-08-20', '2026-08-21']);
  assert.equal(late!.day, '2026-08-21');
  const [early] = placeSheetsOnDays([{ startMs: at('2026-08-01T06:00:00Z') }], ['2026-08-20', '2026-08-21']);
  assert.equal(early!.day, '2026-08-20');
});

test('one photo, one place — a minute drops the media a sheet shows, and keeps everything else', () => {
  const minute = {
    title: 'The march',
    writeUp: 'It rained.',
    media: [{ id: P(1).toUpperCase() }, { id: P(2) }, { id: null }],
  };
  const out = withoutPlacedMedia(minute, new Set([P(1)]));
  assert.deepEqual(out.media, [{ id: P(2) }, { id: null }], 'the placed photo leaves, case-blind');
  assert.equal(out.title, 'The march');
  assert.equal(out.writeUp, 'It rained.');
  assert.equal(withoutPlacedMedia(minute, new Set()), minute, 'nothing arranged → the very same minute');
});
