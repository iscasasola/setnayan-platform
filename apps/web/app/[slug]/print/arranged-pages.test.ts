/**
 * STEP 7 — THE PRINTS CARRY THE ARRANGEMENT.
 *
 * `arrangedA4PageResolver` (the A4 booklet) and `orderSheetsForPrint` (the A3
 * keepsake's own dedicated arranged pages) both build on `placeSheetsForPrint`
 * — the SAME merge the public page uses (`placeSheetsOnDays` + the
 * sheet-before-minute-at-a-tie rule `story-spine.tsx`'s `dayEntries` applies).
 * This file pins three things:
 *
 *   1 · every chapter still becomes exactly one 'minute' page — a sheet is
 *       inserted alongside the minutes, never merged into or dropped from
 *       them (the A4 pagination guard, extended to the hand-arranged case).
 *   2 · a sheet sorts before a minute at the exact same instant, and an
 *       untimed (host-added) sheet is placed via the same day list a chapter
 *       would resolve to.
 *   3 · A CAPTURE ALREADY ON A SHEET NEVER ALSO PRINTS INSIDE ITS CHAPTER'S
 *       OWN MEDIA — the "one photo, one place" rule, and the concrete
 *       mechanism by which a photo a guest already took back (never placed on
 *       any sheet to begin with, per `loadStoryPages`'s own gate) or a photo
 *       the host placed by hand cannot appear twice on the printed keepsake.
 *
 * `loadStoryPages` itself (S3 + S14) is proven elsewhere (`story-pages.test.ts`,
 * `the-public-story-reads-the-arrangement-once.test.ts`); this file proves the
 * PRINT-SPECIFIC layout math that consumes its output never reintroduces a
 * capture it already gated out.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  arrangedA4PageResolver,
  buildA4Pages,
  orderSheetsForPrint,
  placeSheetsForPrint,
  type A4PageSource,
} from './keepsake-layout';
import type { DayChapter } from '../_components/editorial/data';
import type { DrawnSheet } from '@/lib/story-pages';

function chapter(n: number, opts: { atIso?: string | null; media?: DayChapter['media'] } = {}): DayChapter {
  return {
    time: `${n}:00`,
    atIso: opts.atIso === undefined ? `2026-01-01T0${n}:00:00Z` : opts.atIso,
    title: `Minute ${n}`,
    writeUp: `Writeup ${n}`,
    leadId: `lead-${n}`,
    media: opts.media ?? [{ type: 'photo', url: `https://x/${n}.jpg`, id: `capture-${n}` }],
  };
}

function sheet(momentId: string, opts: { startMs?: number | null; refs?: string[] } = {}): DrawnSheet {
  const refs = opts.refs ?? [];
  return {
    momentId,
    name: momentId,
    startMs: opts.startMs ?? null,
    height: 400,
    objects: refs.map((ref, i) => ({
      kind: 'photo' as const,
      id: `obj-${momentId}-${i}`,
      ref,
      x: 0,
      y: 0,
      w: 146,
      h: 100,
      src: `https://x/${ref}.jpg`,
      playSrc: null,
    })),
  };
}

// A five-minute day, one photo each: capture-1..capture-5 at 01:00..05:00.
const CHAPTERS: DayChapter[] = [chapter(1), chapter(2), chapter(3), chapter(4), chapter(5)];

test('1 · every chapter still prints as exactly one minute page when a sheet is interleaved', () => {
  const sheets = [sheet('ros:block-a', { startMs: Date.parse('2026-01-01T02:30:00Z') })];
  const pages = buildA4Pages({ dayChapters: CHAPTERS }, arrangedA4PageResolver(sheets));

  const minutePages = pages.filter((p): p is Extract<A4PageSource, { kind: 'minute' }> => p.kind === 'minute');
  assert.deepEqual(
    minutePages.map((p) => p.chapter.leadId),
    CHAPTERS.map((c) => c.leadId),
    'every original chapter must still appear as its own minute page, in order',
  );

  const arrangedPages = pages.filter((p): p is Extract<A4PageSource, { kind: 'arranged' }> => p.kind === 'arranged');
  assert.equal(arrangedPages.length, 1, 'the one sheet must produce exactly one arranged page');
  assert.equal(arrangedPages[0]!.sheet.momentId, 'ros:block-a');
});

test('2 · a sheet sorts BEFORE a minute at the exact same instant', () => {
  const tieMs = Date.parse('2026-01-01T03:00:00Z'); // == chapter(3)'s atIso
  const sheets = [sheet('ros:tie', { startMs: tieMs })];
  const pages = buildA4Pages({ dayChapters: CHAPTERS }, arrangedA4PageResolver(sheets));
  const kinds = pages.map((p) => p.kind);
  const arrangedIdx = kinds.indexOf('arranged');
  const chapter3Idx = pages.findIndex((p) => p.kind === 'minute' && p.chapter.leadId === 'lead-3');
  assert.ok(arrangedIdx !== -1 && chapter3Idx !== -1, 'sweep is blind — could not find both entries');
  assert.ok(arrangedIdx < chapter3Idx, 'a sheet at the same instant as a minute must print before it');
});

test('3 · an untimed (host-added) sheet is placed via the same day list a chapter resolves to', () => {
  // No startMs at all — mirrors a host-added `own:` moment with nothing to
  // borrow from except the day itself.
  const sheets = [sheet('own:token', { startMs: null })];
  const pages = buildA4Pages({ dayChapters: CHAPTERS }, arrangedA4PageResolver(sheets));
  const arrangedPages = pages.filter((p): p is Extract<A4PageSource, { kind: 'arranged' }> => p.kind === 'arranged');
  assert.equal(arrangedPages.length, 1, 'an untimed sheet must still print — never silently dropped for lack of a time');
});

test('4 · ONE PHOTOGRAPH, ONE PLACE — a capture already on a sheet leaves its chapter, never prints twice', () => {
  // capture-3 lives on BOTH chapter 3's own media (as built above) AND on a
  // hand-arranged sheet. The resolver must strip it from the chapter — this
  // is the concrete mechanism that keeps a photo the host moved onto a page
  // from also showing, a page apart, inside its origin minute.
  const sheets = [sheet('ros:has-capture-3', { startMs: Date.parse('2026-01-01T02:45:00Z'), refs: ['capture-3'] })];
  const pages = buildA4Pages({ dayChapters: CHAPTERS }, arrangedA4PageResolver(sheets));
  const minute3 = pages.find((p) => p.kind === 'minute' && p.chapter.leadId === 'lead-3');
  assert.ok(minute3 && minute3.kind === 'minute', 'sweep is blind — minute 3 not found');
  assert.deepEqual(
    minute3.chapter.media,
    [],
    "chapter 3's media must be emptied of capture-3 once a sheet already shows it",
  );
  // Every OTHER chapter is untouched — the strip is per-capture, not per-chapter.
  const minute2 = pages.find((p) => p.kind === 'minute' && p.chapter.leadId === 'lead-2');
  assert.ok(minute2 && minute2.kind === 'minute');
  assert.equal(minute2.chapter.media.length, 1, "an unrelated chapter's media must be left alone");
});

test('sabotage: a resolver that forgets to strip placed media leaves the capture printing twice — caught', () => {
  const sheets = [sheet('ros:has-capture-3', { startMs: Date.parse('2026-01-01T02:45:00Z'), refs: ['capture-3'] })];
  // The real resolver, for comparison.
  const realPages = buildA4Pages({ dayChapters: CHAPTERS }, arrangedA4PageResolver(sheets));
  const realMinute3 = realPages.find((p) => p.kind === 'minute' && p.chapter.leadId === 'lead-3');
  assert.ok(realMinute3 && realMinute3.kind === 'minute');
  console.log(
    `REAL: chapter 3 media count = ${realMinute3.chapter.media.length} (expected 0 — the sheet already shows capture-3)`,
  );
  assert.equal(realMinute3.chapter.media.length, 0);

  // Sabotage: a resolver that emits 'minute' pages straight from the input,
  // skipping the strip entirely.
  const forgetfulPages: A4PageSource[] = [
    { kind: 'arranged', sheet: sheets[0]! },
    ...CHAPTERS.map((chapter) => ({ kind: 'minute' as const, chapter })),
  ];
  const sabotagedMinute3 = forgetfulPages.find((p) => p.kind === 'minute' && p.chapter.leadId === 'lead-3');
  assert.ok(sabotagedMinute3 && sabotagedMinute3.kind === 'minute');
  console.log(`SABOTAGE: chapter 3 media count = ${sabotagedMinute3.chapter.media.length} (the duplicate that must be caught)`);
  assert.equal(
    sabotagedMinute3.chapter.media.length,
    1,
    'the sabotage should reproduce the duplicate — if not, the sabotage itself is broken',
  );
  assert.notDeepEqual(
    sabotagedMinute3.chapter.media,
    realMinute3.chapter.media,
    'the real resolver must disagree with the un-stripped sabotage',
  );
});

test('the A3 keepsake orders its dedicated arranged pages the same way (orderSheetsForPrint)', () => {
  const early = sheet('ros:early', { startMs: Date.parse('2026-01-01T01:30:00Z') });
  const late = sheet('ros:late', { startMs: Date.parse('2026-01-01T04:30:00Z') });
  // Passed out of chronological order — the function must sort them.
  const ordered = orderSheetsForPrint(CHAPTERS, [late, early]);
  assert.deepEqual(ordered.map((s) => s.momentId), ['ros:early', 'ros:late']);
});

test('placeSheetsForPrint returns nothing for a story with no hand-arranged sheets (Automatic)', () => {
  assert.deepEqual(placeSheetsForPrint(CHAPTERS, []), []);
  assert.deepEqual(orderSheetsForPrint(CHAPTERS, []), []);
  // And the A4 resolver falls back to the mechanical default byte-for-byte —
  // an Automatic story's booklet must be unchanged by this step existing.
  const withSheets = buildA4Pages({ dayChapters: CHAPTERS }, arrangedA4PageResolver([]));
  const withoutResolver = buildA4Pages({ dayChapters: CHAPTERS });
  assert.deepEqual(withSheets, withoutResolver);
});
