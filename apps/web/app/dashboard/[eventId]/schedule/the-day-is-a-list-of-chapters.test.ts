/**
 * the-day-is-a-list-of-chapters.test.ts — 📋 event chapters slice 8, THE EVENT DAY LOOK (owner-approved brief
 * SCHEDULE_SLICES_8_10_BRIEF_2026-11-05; prototype `prototypes/schedule_redesign_2026-11-04.html`).
 *
 *   1 · a chapter is a row sized by its content: start large, end small, its length; the gap between two chapters reads
 *       "1h 30m · free · travel to <venue>"; a supplier who has not picked is a dashed face; "Happening now" on the
 *       running chapter and its running moment;
 *   2 · where chapters are drawn the rail draws THE LIST, not the hour grid — and the list has no 👁 and no monospace;
 *   3 · the one row is pinned and tightens on scroll; "N chapters" is a door that narrows the day, reads as a chip
 *       with ✕, and a line under the date says what you see and how to clear it;
 *   4 · View as shows its state: a tinted chip with ✕ once a view is on;
 *   5 · the row's one action is "N need you ›" — the same requests sheet;
 *   6 · who sees a chapter is inside its ⓘ.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { dayList, facesWords, lengthWords, type ListChapter, type ListMoment } from '@/lib/day-list';

const DIR = dirname(fileURLToPath(import.meta.url));
const code = (f: string) => stripComments(readFileSync(join(DIR, f), 'utf8'));
const at = (hhmm: string) => `2026-12-18T${hhmm}:00.000Z`;

const CH: ListChapter[] = [
  { block_id: 'prep', label: 'Prep', block_type: 'pre_ceremony', start_at: at('09:00'), end_at: at('13:30'), location: 'Seda Vertis North' },
  { block_id: 'cer', label: 'Ceremony', block_type: 'ceremony', start_at: at('14:30'), end_at: at('15:30'), location: 'San Vicente Parish' },
  { block_id: 'rec', label: 'Reception', block_type: 'reception', start_at: at('18:00'), end_at: at('23:00'), location: 'San Vicente Parish' },
];
const MO: ListMoment[] = [
  { block_id: 'm1', parent_block_id: 'rec', label: 'Grand entrance', start_at: at('18:00'), end_at: at('18:30'), responsible_vendor_ids: ['v-dj'] },
  { block_id: 'm2', parent_block_id: 'rec', label: 'Dinner', start_at: at('18:30'), end_at: at('19:30'), responsible_vendor_ids: [] },
];
const names = new Map([['v-dj', 'DJ Migs'], ['v-flor', 'Petal & Co'], ['v-photo', 'Lumen Films']]);

test('1 · rows sized by content, the line between them, dashed faces and "Happening now"', () => {
  const rows = dayList({
    chapters: CH,
    moments: MO,
    names,
    vendorsOf: (id) => (id === 'cer' ? ['v-photo'] : id === 'rec' ? ['v-dj'] : []),
    pickingOf: (id) => (id === 'cer' ? ['v-flor'] : []),
    nowIso: at('18:40'),
  });
  const kinds = rows.map((r) => (r.kind === 'gap' ? `gap:${r.length}:${r.words}` : r.id));
  assert.deepEqual(kinds, ['prep', 'gap:1h:free · travel to San Vicente Parish', 'cer', 'gap:2h 30m:free', 'rec']);
  const prep = rows[0]!;
  assert.ok(prep.kind === 'chapter');
  if (prep.kind !== 'chapter') return;
  assert.equal(prep.start, '9 AM');
  assert.equal(prep.end, 'to 1:30 PM');
  assert.equal(prep.length, '4h 30m');
  const cer = rows.find((r) => r.id === 'cer');
  assert.ok(cer?.kind === 'chapter' && cer.faces.some((f) => f.picking && f.initials === 'P&'), 'a supplier who has not picked is not a dashed face');
  assert.equal(cer?.kind === 'chapter' && cer.facesWords, '1 supplier · 1 picking');
  const rec = rows.find((r) => r.id === 'rec');
  assert.ok(rec?.kind === 'chapter' && rec.now, 'the running chapter is not "now"');
  assert.equal(rec?.kind === 'chapter' && rec.nowWords, 'Happening now · 6:40 PM');
  assert.ok(rec?.kind === 'chapter' && rec.moments.find((m) => m.id === 'm2')?.now, 'the running moment is not marked');
  assert.ok(rows.filter((r) => r.kind === 'chapter' && r.now).length === 1, 'more than one chapter is "now"');
  assert.equal(facesWords([]), 'no suppliers yet');
  assert.equal(lengthWords(90), '1h 30m');
});

test('2 · with chapters the rail draws the list — no hour grid, no 👁, no monospace', () => {
  const rail = code('_components/day-rail.tsx');
  assert.match(rail, /if \(ch\) \{[\s\S]{0,2600}<DayList\s+rows=\{list\}/, 'the chapters day is still the hour grid');
  const list = code('_components/day-list.tsx');
  assert.doesNotMatch(list, /\bEye\b|EyeOff|font-mono/, 'the list shows an eye or a monospace time');
  assert.match(list, /tabular-nums/);
  assert.match(list, /<SwipeToDelete/, 'a chapter row does not swipe to remove');
});

test('3 · the pinned row, its tighter face, the chapter door and the line under the date', () => {
  const line = code('_components/schedule-one-line.tsx');
  assert.match(line, /sticky top-0 z-20/, 'the row is not pinned');
  assert.match(line, /setTight\(window\.scrollY > 24\)/, 'the row does not tighten on scroll');
  assert.match(line, /dataAttr="data-schedule-chapter-door"/, '"N chapters" is not a door');
  assert.match(line, /onPick=\{\(k\) => chapters\.setDayFilter\(k === 'all' \? null : k\)\}/);
  assert.match(line, /aria-label="Show every chapter"/, 'a narrowed day has no ✕');
  assert.match(line, /Seeing the day as <b[^>]*>\{lensOn\}<\/b>/, 'a view on is not said under the date');
  assert.match(line, /Showing <b[^>]*>\{narrowed\.label\}<\/b> only/, 'a narrowed day is not said under the date');
  const rail = code('_components/day-rail.tsx');
  assert.match(rail, /const shown = ch\.dayFilter \? rows\.filter\(\(m\) => m\.block_id === ch\.dayFilter\) : rows;/, 'the door narrows nothing');
});

test('4 · View as shows its state as a chip with ✕', () => {
  const v = code('_components/schedule-view-as.tsx');
  assert.match(v, /const chip = round && lens\.kind !== 'everyone';/);
  assert.match(v, /data-view-as-clear=""/);
  assert.match(v, /onClick=\{\(\) => onLens\(\{ kind: 'everyone' \}\)\}/);
});

test('5 · the row’s one action opens the requests sheet', () => {
  const rail = code('_components/day-rail.tsx');
  assert.match(rail, /data-schedule-need-you=\{requests\.length\}/);
  assert.match(rail, /onClick=\{\(\) => setSheet\(\{ kind: 'requests' \}\)\}\s*data-schedule-need-you/, 'need-you opens something else');
});

test('6 · who sees a chapter is in its ⓘ', () => {
  const host = code('_components/chapters-host.tsx');
  assert.match(host, /'Who sees it: guests — it is on the invitation/);
  assert.match(host, /'Who sees it: you, your coordinator and its suppliers/);
});
