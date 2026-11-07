/**
 * 📷 PAPIC SHOOTS INTO A CHAPTER — the pure rules, the card, and the wiring of both capture lanes (owner 2026-11-01,
 * DECISION_LOG "THE PAPIC CARD ON HOME SHOOTS INTO A CHAPTER" · "A CHAPTER'S PHOTOS: WHO + WHEN").
 *
 * The database half (the window and the people, enforced at the link) is tests/db/papic-shoots-into-a-chapter.db.test.ts.
 * This file holds the three asked-for guards where they meet code:
 *   1 · a capture OUTSIDE the chapter's window is refused — when the chapter was the camera's only way in, the
 *       capture decision refuses with the database's reason; both lanes ask the database BEFORE the spend;
 *   2 · a person NOT IN the chapter can't shoot into it — the decision never puts their shot "into" it;
 *   3 · the CARD NAMES THE CURRENT CHAPTER — the real `PapicChapterRow` inside the real `PapicHomeCard`, rendered.
 *
 * SABOTAGE, each seen red before this shipped:
 *   a  `papicChapterCaptureDecision` answers `into` whatever the verdict      → "a refused chapter took the shot in"
 *   b  `papicChapterCaptureDecision` answers `unsorted` when the lane is shut → "a shot outside the window was let in"
 *   c  the guest route stops asking `chapterGate` on record                    → "the guest record never asks"
 *   d  the card stops drawing `chapter`                                         → "the card does not name the chapter"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { stripComments } from '@/lib/strip-comments';
import {
  PAPIC_WHOLE_EVENT_WORDS,
  papicChapterCaptureDecision,
  papicChapterCountWords,
  papicChapterState,
  papicChapterTarget,
  papicChapterWindowWords,
  papicChaptersFromRows,
  readChapterId,
  type PapicChapter,
} from './papic-chapter';

(globalThis as unknown as { React: unknown }).React = React;

type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(__filename);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_papic_chapter__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// Tue 10 Nov 2026, 3 PM Manila.
const NOW = Date.parse('2026-11-10T07:00:00Z');
const ch = (over: Partial<PapicChapter>): PapicChapter => ({
  blockId: '00000000-0000-4000-8000-000000000001',
  label: 'Meeting with caterer',
  startAt: '2026-11-10T14:00:00Z',
  photoWho: 'chapter',
  opensAt: '2026-11-10T06:00:00Z', // 2 PM Manila
  closesAt: '2026-11-10T08:00:00Z', // 4 PM Manila
  openedEarlyAt: null,
  picked: false,
  captures: 0,
  ...over,
});

test('a chapter window: not open before it opens, open inside, closed after; no time and no Start now = not open', () => {
  const c = ch({});
  assert.equal(papicChapterState(c, Date.parse('2026-11-10T05:59:00Z')), 'not_open_yet');
  assert.equal(papicChapterState(c, NOW), 'open');
  assert.equal(papicChapterState(c, Date.parse('2026-11-10T08:01:00Z')), 'closed');
  assert.equal(papicChapterState(ch({ opensAt: null, closesAt: null }), NOW), 'not_open_yet');
  assert.equal(papicChapterWindowWords(c, NOW), 'On now · until 4 PM');
  assert.equal(papicChapterWindowWords(c, Date.parse('2026-11-10T03:00:00Z')), 'Starts 2 PM');
  assert.equal(papicChapterWindowWords(c, Date.parse('2026-11-09T03:00:00Z')), 'Starts Tue, Nov 10, 2 PM');
  assert.equal(papicChapterWindowWords(c, Date.parse('2026-11-10T09:00:00Z')), 'Ended 4 PM');
});

test('the chapter Papic shoots into: the host’s pick until it ends, else the latest one on now, else the whole event', () => {
  const meeting = ch({});
  const tasting = ch({ blockId: '00000000-0000-4000-8000-000000000002', label: 'Tasting', opensAt: '2026-11-10T06:30:00Z', closesAt: '2026-11-10T09:00:00Z' });
  const fitting = ch({ blockId: '00000000-0000-4000-8000-000000000003', label: 'Fitting', opensAt: '2026-11-11T02:00:00Z', closesAt: '2026-11-11T04:00:00Z' });
  assert.equal(papicChapterTarget([meeting, tasting, fitting], NOW)?.chapter.label, 'Tasting', 'two on now → the latest to open');
  assert.equal(papicChapterTarget([meeting, tasting, { ...fitting, picked: true }], NOW)?.chapter.label, 'Fitting', 'the pick wins, even before it opens');
  assert.equal(papicChapterTarget([meeting, { ...fitting, picked: true }], Date.parse('2026-11-11T05:00:00Z')), null, 'an ended pick stops holding');
  assert.equal(papicChapterTarget([fitting], NOW), null, 'nothing on now, nothing picked → the whole event');
});

test('GUARD 1+2 — what a capture does: into only on the database’s yes; never lost when the camera was open; refused when the chapter was the only way in', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  assert.deepEqual(papicChapterCaptureDecision({ chapterId: null, verdict: null, laneOpen: false }), { kind: 'lane' }, 'no chapter → the lane decides, unchanged');
  assert.deepEqual(papicChapterCaptureDecision({ chapterId: id, verdict: null, laneOpen: false }), { kind: 'into', blockId: id }, 'a meeting before the day opens the camera');
  for (const verdict of ['chapter_not_open', 'chapter_closed', 'not_in_chapter', 'not_a_chapter', 'chapter_unread'] as const) {
    const open = papicChapterCaptureDecision({ chapterId: id, verdict, laneOpen: true });
    assert.notEqual(open.kind, 'into', `a refused chapter took the shot in (${verdict})`);
    assert.equal(open.kind, 'unsorted', `${verdict} with the camera open anyway → event-wide, never lost`);
    assert.deepEqual(
      papicChapterCaptureDecision({ chapterId: id, verdict, laneOpen: false }),
      { kind: 'refuse', error: verdict },
      `a shot outside the window was let in (${verdict}, the chapter was its only way in)`,
    );
  }
});

test('a chapter id is a uuid or nothing; a row reads honestly', () => {
  assert.equal(readChapterId('00000000-0000-4000-8000-000000000001'), '00000000-0000-4000-8000-000000000001');
  assert.equal(readChapterId("'; drop table"), null);
  assert.equal(readChapterId(undefined), null);
  const [c] = papicChaptersFromRows([{ block_id: 'b', label: '  ', photo_who: 'nonsense', opens_at: new Date(NOW), closes_at: null, picked: true, captures: '3' }]);
  assert.equal(c!.label, 'Untitled chapter');
  assert.equal(c!.photoWho, 'chapter');
  assert.equal(c!.opensAt, new Date(NOW).toISOString());
  assert.equal(c!.captures, 3);
  assert.equal(papicChapterCountWords(1), 'This chapter: 1 photo');
  assert.equal(papicChapterCountWords(12), 'This chapter: 12 photos');
});

test('GUARD 1 — both lanes ask the database before the spend, and link only on its yes', () => {
  const route = read('app/api/papic/guest-capture/route.ts');
  const sign = route.slice(route.indexOf('async function handleSign'), route.indexOf('async function rowNeedsRaw'));
  const record = route.slice(route.indexOf('async function handleRecord'), route.indexOf('async function afterVisible'));
  assert.match(sign, /chapterGate\(/, 'the guest sign never asks the chapter');
  assert.match(record, /chapterGate\(/, 'the guest record never asks');
  assert.ok(record.indexOf('chapterGate(') < record.indexOf("rpc('papic_record_guest_capture_and_spend'"), 'the guest record asks after the spend');
  assert.match(record, /linkCaptureToChapter\(/, 'the guest record never links');
  const gate = route.slice(route.indexOf('async function chapterGate'), route.indexOf('async function moderationRefusal'));
  assert.match(gate, /papicChapterRefusal\(/);
  assert.match(gate, /papicChapterCaptureDecision\(/);

  const actions = read('app/papic/actions.ts');
  const seat = actions.slice(actions.indexOf('export async function recordSeatCapture'), actions.indexOf('export async function persistSeatClipWebCopy'));
  const asks = seat.indexOf('papicChapterRefusal(');
  const spends = seat.indexOf("'papic_record_seat_capture'");
  assert.ok(asks > -1 && spends > -1 && asks < spends, 'the seat camera asks the chapter after the spend (or not at all)');
  assert.match(seat, /papicChapterCaptureDecision\(/);
  assert.match(seat, /linkCaptureToChapter\(/, 'the seat camera never links');
});

async function renderCard(chapters: PapicChapter[] | null) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { PapicHomeCard } = await import('@/app/dashboard/[eventId]/_components/papic-home-card');
  const { PapicChapterRow } = await import('@/app/dashboard/[eventId]/_components/papic-chapter-row');
  const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };
  const card = React.createElement(PapicHomeCard, {
    name: 'Papic',
    icon: null,
    phase: null,
    settings: null,
    counts: { total: 2000, left: 1240 },
    chapter: React.createElement(PapicChapterRow, { eventId: '00000000-0000-4000-8000-00000000e1ab', chapters, nowMs: NOW, standIn: 'ok' }),
  });
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, card));
}

test('GUARD 3 — the Home card names the chapter it shoots into, with its window and "This chapter: N photos"; counts stay event-wide', async () => {
  const html = await renderCard([ch({ captures: 12 }), ch({ blockId: '00000000-0000-4000-8000-000000000003', label: 'Fitting', opensAt: '2026-11-11T02:00:00Z', closesAt: '2026-11-11T04:00:00Z' })]);
  assert.match(html, /data-papic-chapter="00000000-0000-4000-8000-000000000001"/, 'the card does not name the chapter');
  assert.match(html, /Meeting with caterer/);
  assert.match(html, /On now · until 4 PM/);
  assert.match(html, /This chapter: 12 photos/);
  assert.match(html, /data-papic-card-count="total"/, 'the event-wide counts went away');
  assert.doesNotMatch(html, /data-papic-chapter-start/, 'Start now on a chapter that is already on');

  const picked = await renderCard([ch({ blockId: '00000000-0000-4000-8000-000000000003', label: 'Fitting', opensAt: '2026-11-11T02:00:00Z', closesAt: '2026-11-11T04:00:00Z', picked: true })]);
  assert.match(picked, />Fitting</);
  assert.match(picked, /data-papic-chapter-start/, 'a picked chapter that has not opened offers Start now');

  const whole = await renderCard([ch({ opensAt: '2026-11-11T02:00:00Z', closesAt: '2026-11-11T04:00:00Z' })]);
  assert.match(whole, new RegExp(`data-papic-chapter="whole"`));
  assert.match(whole, new RegExp(PAPIC_WHOLE_EVENT_WORDS));

  const unread = await renderCard(null);
  assert.match(unread, /data-papic-chapter="unread"/, 'a failed read drew a chapter (or the whole event)');
  assert.doesNotMatch(unread, new RegExp(`>${PAPIC_WHOLE_EVENT_WORDS}<`));

  const none = await renderCard([]);
  assert.doesNotMatch(none, /data-papic-chapter=/, 'no chapters → no row, as before chapters');
});
