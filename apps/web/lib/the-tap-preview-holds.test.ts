/**
 * the-tap-preview-holds.test.ts — ▶ TAPPED, IT HOLDS (owner 1 Nov 2026, from a screen recording in the iOS app;
 * `Maker_Animate_Preview_Scrub_LOCKED_2026-10-09.md` §4, amended): after a TAP the phase plays, then holds on its
 * finished look with "Exit preview" until a tap or that button. It used to return to editing by itself about a second
 * later on a part with no Action or Build out, which read as "tapping does not work".
 *
 *   (1) THE CANVAS HOLDS THE END — EXECUTED: ▶'s one phase, asked to hold, is left standing where it ended after
 *       `rest` is reported, and only the returned stop puts it back; a Motion pick's replay (no hold) rests at once.
 *       Sabotage: `rest()` run whatever `holdAtEnd` says → red.
 *   (2) THE BRIDGE ASKS FOR THE HOLD on ▶'s single phase and keeps the stop past `rest`, so `playStop` can settle it.
 *       Sabotage: `seqStop = null` back on `rest` → red.
 *   (3) THE MAKER DOES NOT LEAVE ON `rest` — it marks the play over and shows "Exit preview" (the whole-page
 *       preview's own pill, now also `stopPlay`), and a tap on the page lands on a catch, never on a part.
 *       Sabotage: `setPlaying(false)` back on `rest` → red.
 *   (4) THE "Build in · Action · Build out" CHIP lives only while ▶ plays or holds — never after the return — and is
 *       drawn in the Maker's shell, lifted over the app's bottom nav (`--maker-lift`), not on `<body>` where the shell's
 *       measures never resolve (it sat on Home · Guests · Hub in the recording). Sabotage: the old
 *       `playing || seq.skipped.length > 0` condition, or the portal back on `document.body` → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { playSequence } from '../app/[slug]/_components/play-sequence';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));

type Fake = { style: { setProperty(k: string, v: string): void; removeProperty(k: string): void }; set: string[]; offsetWidth: number; classList: { contains(c: string): boolean }; querySelector(): null; scrollIntoView(): void; cs: Record<string, string> };
function part(): Fake {
  const set: string[] = [];
  return {
    set,
    cs: { animationName: 'el-in-mix', animationDuration: '0.6s', animationTimeline: 'auto' },
    offsetWidth: 1,
    style: { setProperty: (_k, v) => void set.push(v), removeProperty: () => void set.push('(removed)') },
    classList: { contains: () => false },
    querySelector: () => null,
    scrollIntoView: () => {},
  };
}
const g = globalThis as unknown as { getComputedStyle: unknown; window: unknown };
g.getComputedStyle = (n: Fake) => ({ ...n.cs, getPropertyValue: (k: string) => n.cs[k] ?? '' });

/** Plays one phase to its end on a hand-run clock; returns what the part was left with, what was said, and the stop. */
function playToEnd(holdAtEnd: boolean) {
  const queue: Array<() => void> = [];
  g.window = { matchMedia: () => ({ matches: false }), setTimeout: (fn: () => void) => (queue.push(fn), queue.length), clearTimeout: () => {} };
  const p = part();
  const said: string[] = [];
  const stop = playSequence(p as unknown as HTMLElement, false, (r) => said.push(r.phase), 'in', holdAtEnd);
  while (queue.length) queue.shift()!();
  return { p, said, stop };
}

test('(1) the canvas holds ▶’s phase on its finished look until the stop — a replay with no hold rests at once', () => {
  const held = playToEnd(true);
  assert.deepEqual(held.said, ['in', 'rest'], 'anti-vacuity: the phase played and ended');
  assert.match(held.p.set.at(-1) ?? '', /^el-in-mix 600ms /, 'the part went back to rest at the end — the hold shows nothing of the phase');
  held.stop();
  assert.equal(held.p.set.at(-1), '(removed)', 'Exit preview did not put the part back at rest');

  const replay = playToEnd(false);
  assert.deepEqual(replay.said, ['in', 'rest']);
  assert.equal(replay.p.set.at(-1), '(removed)', 'a Motion pick’s one replay now holds — the part stays mid-motion while editing');
});

test('(2) the bridge asks for the hold on ▶’s one phase and keeps the stop past `rest`', () => {
  const bridge = read('app/[slug]/_components/editor-bridge.tsx');
  const at = bridge.indexOf("if (data.t === 'playSeq')");
  const seq = bridge.slice(at, bridge.indexOf("if (data.t === 'playCover')", at));
  assert.ok(at > 0 && seq.includes('seqStop = playSequence('), 'anti-vacuity: the ▶ playSeq handler was found');
  assert.match(seq, /only === 'in' \|\| only === 'act' \|\| only === 'out' \? only : undefined,\s*only === 'in' \|\| only === 'act' \|\| only === 'out',\s*\);/, '▶’s one phase is not asked to hold');
  assert.doesNotMatch(seq, /seqStop = null/, '`rest` drops the stop — `playStop` can no longer put the held part back');
  /* …and playStop still runs it. */
  assert.match(bridge, /if \(data && data\.source === 'setnayan-editor' && \(data\.t === 'playStage' \|\| data\.t === 'playStop'\)\) \{[\s\S]{0,600}seqStop\?\.\(\);/);
});

const tools = read(`${L}/stage-tools.tsx`);

test('(3) the Maker holds on `rest`: Exit preview shows, and a tap on the page is only the way back', () => {
  const at = tools.indexOf("else if (d.t === 'playSeq' && typeof d.phase === 'string')");
  const onSeq = tools.slice(at, tools.indexOf('}', tools.indexOf("d.phase === 'rest'", at)) + 1);
  assert.ok(at > 0 && onSeq.includes("d.phase === 'rest'"), 'anti-vacuity: the Maker’s playSeq listener was found');
  assert.doesNotMatch(onSeq, /setPlaying\(false\)/, '`rest` returns to editing by itself again');
  assert.match(onSeq, /if \(d\.phase === 'rest'\) setPlayRested\(true\);/);
  /* Exit preview: the preview's own pill, drawn for the hold too, and it leaves the hold by `stopPlay`. */
  assert.match(tools, /\{\(previewing \|\| \(playing && playRested\)\) && shellEl\s*\? createPortal\(\s*<div\s+data-stage-exit-preview=""/);
  assert.match(tools, /label="Exit preview" onClick=\{previewing \? exitPreview : stopPlay\}/);
  /* stopPlay ends the hold and the chip with it. */
  const stop = /const stopPlay = useCallback\(\(\) => \{([\s\S]*?)\}, \[\]\);/.exec(tools)?.[1] ?? '';
  assert.match(stop, /t: 'playStop'[\s\S]*setPlaying\(false\);[\s\S]*setPlayRested\(false\);[\s\S]*setSeq\(null\);/);
  /* A tap on the page (inside the canvas's frame, which this document never hears) lands on the catch while ▶ plays. */
  assert.match(tools, /\{playing && shellEl \? createPortal\(<div data-stage-play-catch="" aria-hidden className="absolute inset-0 z-\[30\]" \/>, shellEl\) : null\}/);
  const exitZ = Number(/data-stage-exit-preview=""[\s\S]{0,1200}?className="[^"]*z-\[(\d+)\]/.exec(tools)?.[1]);
  assert.ok(exitZ > 30, `Exit preview (z ${exitZ}) is under the catch — its press would never reach it`);
  assert.match(tools, /if \(e\.key === 'Escape'\) stopPlay\(\);/, 'Esc does not leave the hold');
});

test('(4) the status chip lives only while ▶ plays or holds, in the shell, over the app’s nav', () => {
  const draw = /\{(seq && [^?]*)\? <StagePlayStatus /.exec(tools)?.[1] ?? '';
  assert.ok(draw.includes('playing'), `anti-vacuity: the chip’s condition was read (${draw})`);
  assert.match(draw, /^seq && playing && /, 'the chip outlives ▶ — it stayed on screen after the return to editing');
  assert.doesNotMatch(draw, /\|\|/, 'the chip is drawn on something besides ▶ playing or holding');
  assert.doesNotMatch(tools, /setTimeout\(\(\) => setSeq\(null\)/, 'a timer keeps the chip past the return');

  const chip = read(`${L}/stage-panel/play-status.tsx`);
  assert.match(chip, /const host = document\.querySelector<HTMLElement>\('\[data-maker-shell\]'\) \?\? document\.body;/);
  assert.match(chip, /<\/div>,\s*host,\s*\);/, 'the chip is drawn on <body>, where the shell’s measures never resolve');
  assert.match(chip, /className="[^"]*\bfixed\b/, 'anti-vacuity: the chip is placed from the screen’s foot');
  assert.match(chip, /bottom: 'calc\([^']*var\(--maker-lift, 0px\)\)'/, 'the chip stands on the app’s bottom nav');
  assert.doesNotMatch(chip, /--maker-lt-h/, 'the chip is placed on the toolbar’s height, which is 0 while ▶ plays');
});
