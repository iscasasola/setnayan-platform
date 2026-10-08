/**
 * switching-stage-or-page-never-navigates.test.ts — 🧭 A STAGE OR A PAGE IS
 * CLIENT STATE: NO NAVIGATION, NO SERVER ROUND TRIP, AND A WARM STAGE SHOWS AT
 * ONCE.
 *
 * Owner, 2026-09-28: *"a lot of times. it reloads the whole page. which
 * shouldn't"* · *"is it possible to load everything so it runs smoothly?"*.
 *
 * Measured in the code: the Maker's stage and its made-once pages were already
 * client state (`MakerShell`'s `setStage` / `select`, remembered for the tab in
 * sessionStorage) — no `router.*`, no search param. Two costs remained, and
 * this holds both fixed:
 *
 *   1. NO NAVIGATION, EVER, ON A SWITCH — the bar's buttons, the one picker
 *      (`PickMenu`) and the tour all run the same `onPress` → `setStage` /
 *      `select`; nothing in the shell or the work area pushes, replaces,
 *      refreshes or reloads the document. ⚠ Nor does the switch write the
 *      stage into the address: a changed search param is a new page KEY, so the
 *      next save's redirect would remount the whole Maker (`lib/maker-stay.ts`).
 *   2. NO RELOAD OF A STAGE ALREADY LOADED — a stage held warm behind the canvas
 *      (`buffered-canvas-frame.tsx`) is SHOWN, the same frame, and the stage
 *      left stays warm; a page opened over the work area no longer unmounts
 *      the canvas, so coming back is instant too.
 *
 * 🧯 2026-10-08 (production incident) — WHAT "WARM" MEANS NOW: a stage the couple
 * has OPENED and left. Until then the Maker also fetched the stages nobody had
 * opened, hidden, on idle and again after every save — full server renders of
 * the guest page — and that multiplied one person's editing into the load that
 * exhausted the database's connection pool. Section 2 holds the new rule: a
 * frame exists only because its stage was on screen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  MAX_WARM_FRAMES,
  canvasFrameId,
  dropWarmFrames,
  planCanvasFrames,
  trimWarmFrames,
  warmCanvasBudget,
  type CanvasFrame,
  type CanvasFrames,
} from '../app/dashboard/[eventId]/website/editor/_components/buffered-canvas-frame';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SHELL = read('app/dashboard/[eventId]/launch/_components/maker-shell.tsx');
const WORK = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');

/* ═══ 1 · NO NAVIGATION ON A SWITCH ══════════════════════════════════════ */

const NAVIGATES = /\buseRouter\b|router\.(push|replace|refresh|back|forward|prefetch)\(|location\.(assign|replace|reload)\(|location\.href\s*=|history\.(pushState|replaceState)\(|redirect\(/;

test('the shell switches stage and page as state — nothing in it navigates', () => {
  assert.doesNotMatch(SHELL, NAVIGATES, 'the Maker shell must never navigate: a switch is state');
  // ✂ The Maker in 4 (2026-10-02): Page ▾ picks a stage's page, and Look · Details open doors — all state.
  const press = SHELL.slice(SHELL.indexOf('const pressDoor = '), SHELL.indexOf('const playHref = '));
  assert.ok(press.length > 200, 'the bar’s handlers moved — re-anchor this test');
  assert.match(press, /setStage\(pick\.stage\)/);
  assert.match(press, /select\(\{ kind: 'tool', key: 'rsvp-stage' \}\)/);
  assert.match(press, /select\(\{ kind: 'tool', key: 'details' \}\)/);
  // The stage is never written into the address — it would re-key the page.
  assert.doesNotMatch(SHELL, /searchParams\.set\(|[?&]stage=/);
});

test('the work area follows the stage by props alone — no router, no document reload on a switch', () => {
  // The only router in the work area is a save's refresh inside makerSave (and the
  // std-lead switch's own, same), never a push/replace, and never on a stage change.
  assert.doesNotMatch(WORK, /router\.(push|replace|back|forward|prefetch)\(/);
  assert.doesNotMatch(WORK, /location\.(assign|replace)\(|location\.href\s*=|history\.(pushState|replaceState)\(/);
  const stageEffect = WORK.slice(WORK.indexOf('/* A new stage has its own bar'), WORK.indexOf('}, [stage]);') + 12);
  assert.doesNotMatch(stageEffect, /router|location|fetch\(/);
  // The canvas is keyed by stage — a switch changes an iframe, not the page.
  assert.match(WORK, /group=\{`\$\{stage\}:\$\{maker\.seeAs \?\? ''\}`\}/);
});

test('a page opened over the work area HIDES the canvas — never unmounts it', () => {
  assert.match(
    WORK,
    /<div className=\{workHidden \? 'hidden' : 'contents'\} data-maker-work-area="">/,
  );
  // Since Details parts 2b and 3 the one page over the work area is Details
  // (every made-once page is an item of it), drawn by the shell.
  assert.match(WORK, /const workHidden = selection\?\.kind === 'tool' && isShellPage\(selection\.key\);/);
  assert.doesNotMatch(WORK, /\{pageView \?\? \(/, 'the page must not REPLACE the work area — that unmounts every loaded stage');
  // …and the canvas's own `ready` still ignores any other frame.
  assert.match(WORK, /if \(event\.source && event\.source !== frameRef\.current\?\.contentWindow\) return;/);
});

/* ═══ 2 · A WARM STAGE SHOWS AT ONCE ═════════════════════════════════════ */

const SRC = (s: string) => `/ana-ben?phase=${s}&editor=1`;
const fr = (stage: string, stamp = '1'): CanvasFrame => ({ key: `${stage}:${stamp}:`, group: `${stage}:`, src: SRC(stage) });

test('a stage the couple has opened is SHOWN again — the same frame, nothing loads — and the stage left stays warm', () => {
  const wanted = (shown: string) => ['save_the_date', 'rsvp', 'event', 'editorial'].filter((x) => x !== shown).map((x) => fr(x));
  // The Maker opens on the Invitation; the couple picks On the Day. It was never
  // opened, so it loads — and the Invitation is kept behind it.
  let s: CanvasFrames = { shown: fr('rsvp'), loading: null };
  const rsvpFrame = s.shown;
  s = trimWarmFrames(planCanvasFrames(s, fr('event')), wanted('event'), MAX_WARM_FRAMES);
  assert.equal(canvasFrameId(s.shown), canvasFrameId(fr('event')));
  assert.deepEqual(s.warm, [rsvpFrame], 'the Invitation stays warm behind it');
  const eventFrame = s.shown;
  // …and back again is instant: the kept frame itself, same identity, so React keeps its iframe.
  const u = trimWarmFrames(planCanvasFrames(s, fr('rsvp')), wanted('rsvp'), MAX_WARM_FRAMES);
  assert.equal(u.shown, rsvpFrame, 'the kept frame itself is shown');
  assert.equal(u.loading, null, 'nothing loads');
  assert.deepEqual(u.warm, [eventFrame], 'On the Day stays warm in turn');
});

test('🧯 a stage nobody opened is never loaded — opening the Maker fetches ONE guest page', () => {
  // Incident 2026-10-08: the other three stages were fetched hidden as soon as the
  // Maker idled, and again after every save — four full server renders of the
  // guest page per open and per edit. The only way a frame comes to exist now is
  // `planCanvasFrames` being handed the frame ON SCREEN.
  const wanted = [fr('save_the_date'), fr('event'), fr('editorial')];
  let s: CanvasFrames = { shown: fr('rsvp'), loading: null };
  // However many renders, saves and idle moments pass while the Invitation is shown…
  for (const stamp of ['1', '2', '3']) {
    s = trimWarmFrames(planCanvasFrames(s, fr('rsvp', stamp)), wanted.map((f) => fr(f.group.slice(0, -1), stamp)), MAX_WARM_FRAMES);
    const every = [s.shown, s.loading, ...(s.warm ?? [])].filter((f): f is CanvasFrame => f !== null);
    assert.ok(every.every((f) => f.group === 'rsvp:'), `a frame for a stage nobody opened exists after render ${stamp}: ${every.map((f) => f.key).join(' · ')}`);
    assert.ok(every.length <= 2, 'at most the page shown and the newest render of it loading');
  }
  // …and the module has no way to add one: the only exports that return frames are these.
  const buffer = read('app/dashboard/[eventId]/website/editor/_components/buffered-canvas-frame.tsx');
  assert.doesNotMatch(buffer, /nextWarmFrame|requestIdleCallback|WARM_AFTER_MS/, 'the fetch-ahead of unopened stages is back');
  assert.equal(trimWarmFrames({ shown: fr('rsvp'), loading: null }, wanted, MAX_WARM_FRAMES).warm, undefined, 'the trim never adds');
  // 🔎 Positive control — a frame IS created the moment its stage is shown, so the
  // "none" above is the rule holding, not a planner that cannot make frames.
  const opened = planCanvasFrames({ shown: fr('rsvp'), loading: null }, fr('event'));
  assert.equal(canvasFrameId(opened.shown), canvasFrameId(fr('event')));
});

test('a kept stage OLDER than the canvas is shown at once and the fresh one loads behind it', () => {
  const s: CanvasFrames = { shown: fr('rsvp', '2'), loading: null, warm: [fr('event', '1')] };
  const t = planCanvasFrames(s, fr('event', '2'));
  assert.equal(canvasFrameId(t.shown), canvasFrameId(fr('event', '1')), 'never a blank wait');
  assert.equal(canvasFrameId(t.loading!), canvasFrameId(fr('event', '2')), 'never a stale page kept');
  // A stale kept frame is NOT refreshed behind the couple's back after a save: it stays as it is until shown.
  const w = trimWarmFrames({ shown: fr('rsvp', '2'), loading: null, warm: [fr('event', '1')] }, [fr('event', '2')], 3);
  assert.deepEqual(w.warm, [fr('event', '1')]);
});

test('keeping is capped, lets go of what is no longer wanted, and drops a frame that missed a pick', () => {
  const s: CanvasFrames = { shown: fr('rsvp'), loading: null, warm: [fr('event'), fr('editorial'), fr('save_the_date')] };
  // A budget of 1: only the first wanted stays.
  assert.deepEqual(trimWarmFrames(s, [fr('event'), fr('editorial'), fr('save_the_date')], 1).warm, [fr('event')]);
  // "View as" wants none: every kept frame goes.
  assert.equal(trimWarmFrames(s, [], 3).warm, undefined);
  // The extras go.
  assert.deepEqual(trimWarmFrames(s, [fr('event')], 3).warm, [fr('event')]);
  assert.equal(trimWarmFrames({ shown: fr('rsvp'), loading: null, warm: [fr('event')] }, [fr('event')], 0).warm, undefined, 'a device with no budget keeps no stage behind — at once');
  // A kept frame still loading when a pick was drawn cannot show it: dropped; its stage loads again when opened.
  const d = dropWarmFrames(s, new Set([canvasFrameId(fr('editorial'))]));
  assert.deepEqual(d.warm, [fr('event'), fr('save_the_date')]);
});

test('the warm budget: 3 frames; none on a phone with ≤ 4 GB, none on save-data', () => {
  assert.equal(warmCanvasBudget({ phone: false }), MAX_WARM_FRAMES);
  assert.equal(MAX_WARM_FRAMES, 3, 'brief 2026-09-28: at most the current stage plus 3 warm frames');
  assert.equal(warmCanvasBudget({ phone: true, deviceMemory: 4 }), 0);
  assert.equal(warmCanvasBudget({ phone: true, deviceMemory: 2 }), 0);
  assert.equal(warmCanvasBudget({ phone: true, deviceMemory: 8 }), MAX_WARM_FRAMES);
  assert.equal(warmCanvasBudget({ phone: false, deviceMemory: 4 }), MAX_WARM_FRAMES, 'a laptop is not a phone');
  assert.equal(warmCanvasBudget({ phone: false, saveData: true }), 0);
  assert.equal(warmCanvasBudget({ phone: true, deviceMemory: 8, saveData: true }), 0);
});

test('the buffer never re-orders a mounted iframe (moving one reloads it), and hears every frame’s ready', () => {
  const buffer = read('app/dashboard/[eventId]/website/editor/_components/buffered-canvas-frame.tsx');
  assert.match(buffer, /const order = mountOrder\.current\.filter\(\(id\) => byId\.has\(id\)\)/);
  assert.match(buffer, /const list = order\.map\(\(id\) => byId\.get\(id\)!\)/);
  // Warm frames are invisible and untappable; the shown one is untouched.
  assert.match(buffer, /role === 'warm' \? 'pointer-events-none invisible' : ''/);
  // The shell wires it: the other stages it may keep, keyed as the shown frame would be.
  assert.match(WORK, /key: `\$\{s\}:\$\{canvasStamp\}:`/);
  assert.match(WORK, /warm=\{warmStages\}/);
  assert.match(WORK, /warmMax=\{warmBudget\}/);
});
