/**
 * animate-is-four-rows.test.ts — THE TOOLBAR'S ANIMATE (`TOOLBAR-SPEC-2026-10-09.md` § ANIMATE + decision 8; the
 * approved prototype's `animRows`). It was one column of eleven rows — 364–416 px in a 210-px box, scrolling.
 *
 *   (1) FOUR ROWS, RENDERED, NOTHING SCROLLING — in every phase, with every effect on and everything a caller can
 *       hand in (Rows, Delay, Next scene, an error), the pane's direct children are rows 1–4 of the ONE grid, each
 *       at most once, and nothing in it scrolls; each row's control is 44 px, the short phone's row.
 *       Sabotage: row 3 drawn as a fifth row → red.
 *   (2) ROW 4 BY PHASE — Build in: Movement ◆ + Rows + Delay · Action: Movement ◆ · Build out: Movement ◆ + Next
 *       scene ◆ and NO Delay (decision 8). Sabotage: Delay drawn in Build out → red.
 *   (3) NO DURATION, NO TIMING — not drawn in any phase, not a prop, and neither caller writes a `speed`, a
 *       `duration` or (a scene) a `timeline` from here; what was stored is left alone. Sabotage: Delay named
 *       Duration → red.
 *   (4) ROW 2 — Build in / Build out: Fade · Blur · Move · Size as the app's CHIPS (never a selector's track — a
 *       different kind looks different), four on one line, each on or off, the pressed ones the ON ones, and a
 *       press writes the shipped four-effect value (EXECUTED: Move on takes the phase's first way, the last one off
 *       stores nothing). Action: the caller's two words, the picked one pressed. Sabotage: Move's first way → red.
 *   (5) ROW 3 IS ONLY WHAT THE ON ONES NEED — nothing while Move and Size are off; From / To ▾ for Move, Grow |
 *       Shrink for Size, each in its own HALF of the row. Sabotage: a need stretching to the whole row → red.
 *   (6) A PART'S BUILD OUT AND THE SCROLL — the first one switched on makes the part follow the scroll (shipped);
 *       the last one switched off puts it back to playing once (Timing ▾ is not drawn, so nothing else could).
 *       Sabotage: the way back removed → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { SP_ANIMATE_CHIPS, SP_ANIMATE_HALF, SP_DD_STACKED, SP_DD_STACKED_BUTTON, SP_DD_STACKED_LABEL } from './maker-animate-rows';
import { SP_PHASES, SP_ROWS, stageBarRow } from './maker-stage-room';

/* The panel's pieces are compiled with the classic JSX runtime under `tsx` — they read `React` off the scope. */
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const PANEL = `../${L}/stage-panel`;
const read = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));
const has = (cls: string, c: string) => cls.split(/\s+/).includes(c);

type Fx = Record<string, unknown> | null;
type Phase = 'in' | 'act' | 'out';
const how = { value: 'auto', options: [{ key: 'auto', label: 'Auto' }, { key: 'calm', label: 'Calm' }], onPick: () => {} };
const rows = { value: 'auto', options: [{ key: 'auto', label: 'Auto' }, { key: 'together', label: 'All at once' }], onPick: () => {} };
const delay = { value: 0.3, steps: [0, 0.3, 0.8], onPick: () => {} };
const does = { value: 'drift', options: [{ key: 'still', label: 'Still' }, { key: 'drift', label: 'Drift' }], onPick: () => {} };
const next = { value: 'scroll', options: [{ key: 'scroll', label: 'Scroll' }], onPick: () => {} };
const ALL: Fx = { fade: true, blur: true, move: 'below', size: 'grow' };

async function draw(phase: Phase, fx: Fx, more: Record<string, unknown> = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StageAnimate } = await import(`${PANEL}/stage-animate`);
  const { setStageAnimatePhase } = await import(`${PANEL}/store`);
  setStageAnimatePhase(phase);
  const html = renderToStaticMarkup(React.createElement(StageAnimate, { how, inFx: fx, outFx: fx, onIn: () => {}, onOut: () => {}, rows, delay, does, next, ...more }));
  setStageAnimatePhase('in');
  return html;
}

/** The opening tags of the root's DIRECT children. */
function directChildren(html: string): string[] {
  const VOID = new Set(['input', 'img', 'br', 'hr', 'meta', 'link']);
  const out: string[] = [];
  let depth = 0;
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|[^>"])*?)(\/?)>/g)) {
    const [tag, close, name, , selfClose] = m;
    if (close) {
      depth--;
      continue;
    }
    if (depth === 1) out.push(tag);
    if (!selfClose && !VOID.has(name!.toLowerCase())) depth++;
  }
  return out;
}
/** One row of the pane: its markup, from its opening tag to the next row's (or the end). */
function rowOf(html: string, n: number): string {
  const at = html.search(new RegExp(`<(?:div|p)[^>]*row-start-${n}\\b`));
  if (at < 0) return '';
  const rest = html.slice(at + 1).search(/<(?:div|p)[^>]*row-start-\d\b/);
  return rest < 0 ? html.slice(at) : html.slice(at, at + 1 + rest);
}
const smalls = (row: string) => [...row.matchAll(/data-dd-label="">([^<]*)</g)].map((m) => m[1]);

test('(1) four rows of the one grid in every phase — nothing is a fifth row and nothing scrolls', async () => {
  let seen = 0;
  for (const phase of ['in', 'act', 'out'] as const) {
    for (const fx of [null, { fade: true }, { move: 'left' }, { size: 'shrink' }, ALL] as Fx[]) {
      for (const more of [{}, { error: 'Could not save. Try again.' }, { rows: null, delay: null, next: null }]) {
        const html = await draw(phase, fx, more);
        const root = /^<div class="([^"]*)"[^>]*data-stage-animate-rows=""/.exec(html)?.[1] ?? '';
        for (const c of SP_ROWS.split(' ')) assert.ok(has(root, c), `${phase}: the pane is not the four-row grid (no “${c}”)`);
        assert.ok(!/overflow-y-auto|overflow-auto|overflow-y-scroll/.test(html), `${phase}: something in Animate scrolls`);
        const kids = directChildren(html);
        const at = kids.map((k) => /\brow-start-(\d)\b/.exec(k)?.[1] ?? null);
        assert.ok(kids.length >= 2 && kids.length <= 4, `${phase}: ${kids.length} rows`);
        assert.ok(at.every((n) => n !== null && Number(n) >= 1 && Number(n) <= 4), `${phase}: a child of the pane is not one of rows 1–4 — ${kids.join(' ')}`);
        assert.equal(new Set(at).size, at.length, `${phase}: two children share a row — ${at.join(',')}`);
        assert.ok(at.includes('1') && at.includes('4'), `${phase}: row 1 or row 4 is missing`);
        seen++;
      }
    }
  }
  assert.equal(seen, 45, 'anti-vacuity: every phase × effects × hand-ins was drawn');
  /* Every control a row holds is 44 px — the SHORT phone's row; a taller phone's row (48) centres it. */
  assert.equal(stageBarRow(667).row, 44);
  assert.ok(stageBarRow(812).row >= 44);
  for (const [name, cls] of [['Phases', SP_PHASES], ['the two-line dropdown', SP_DD_STACKED], ['its button', SP_DD_STACKED_BUTTON]] as const) assert.ok(has(cls, 'h-11'), `${name} is not 44 px`);
  const P = await import('../app/_components/pill-selector');
  assert.match(P.pillSegClass(true), /\bmin-h-\[38px\]/, 'a pill selector’s choice is no longer 38 px');
  assert.ok(has(P.PILL_TRACK_CLASS, 'p-[3px]'), 'a pill selector’s track is no longer 3 px round its choices (38 + 6 = 44)');
  /* 🔤 THE TWO-LINE PILL IS READABLE: its name is never under the Form row's small line (12 px; the template's smallest
     type is 11) and its value is the Form row's pill (14 px) — and the two lines with their margins ARE the 44 px. */
  const px = (cls: string, re: RegExp) => Number(re.exec(cls)?.[1] ?? Number.NaN);
  const name = { top: px(SP_DD_STACKED_LABEL, /\btop-\[(\d+)px\]/), size: px(SP_DD_STACKED_LABEL, /\btext-\[([\d.]+)px\]/), line: px(SP_DD_STACKED_LABEL, /\bleading-\[(\d+)px\]/) };
  const value = { size: px(SP_DD_STACKED_BUTTON, /!text-\[([\d.]+)px\]/), line: px(SP_DD_STACKED_BUTTON, /!leading-\[(\d+)px\]/), foot: px(SP_DD_STACKED_BUTTON, /!pb-\[(\d+)px\]/) };
  assert.ok(name.size >= 12, `the pill’s name is ${name.size} px — under the Form row’s small line`);
  assert.ok(value.size >= 14 && value.size > name.size, `the pill’s value is ${value.size} px`);
  assert.ok(name.line >= name.size && value.line >= value.size, 'a line is shorter than its letters');
  assert.ok(name.top + name.line <= 44 - value.foot - value.line, `the name (to ${name.top + name.line}px) runs into the value (from ${44 - value.foot - value.line}px)`);
  assert.match(read('app/_components/form-row.tsx'), /data-form-row-where="" className="block text-\[12px\]/, 'anti-vacuity: the Form row’s small line is no longer 12 px');
  /* …and no control of Animate is taller: the source names no height above 44 px and no text row of its own. */
  const src = read(`${L}/stage-panel/stage-animate.tsx`);
  assert.doesNotMatch(src, /\bh-(?:1[2-9]|[2-9]\d)\b|\bmin-h-\[(?:4[5-9]|[5-9]\d|\d{3,})px\]/, 'a control taller than a row');
  assert.doesNotMatch(src, /SP_PANE|<TimeRow|<PanelSwitch|<About\b|<Slider\b/, 'a piece of the eleven-row column is back');
  /* 📦 Its own classes cost the Maker's first load nothing: only the toolbar's lazy pieces import their module. */
  const users: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const f = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(f);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && /from '@\/lib\/maker-animate-rows'/.test(readFileSync(join(WEB, f), 'utf8'))) users.push(f);
    }
  };
  for (const d of ['app', 'lib', 'components']) if (existsSync(join(WEB, d))) walk(d);
  assert.deepEqual(users.sort(), [`${L}/stage-panel/kit.tsx`, `${L}/stage-panel/stage-animate.tsx`], 'Animate’s classes are imported by a file that may load first');
});

test('(2) row 4 by phase — Build in: Movement ◆ + Rows + Delay; Action: Movement ◆; Build out: Movement ◆ + Next scene ◆, no Delay', async () => {
  assert.deepEqual(smalls(rowOf(await draw('in', ALL), 4)), ['Movement ◆', 'Rows', 'Delay']);
  assert.deepEqual(smalls(rowOf(await draw('in', ALL, { rows: null }), 4)), ['Movement ◆', 'Delay'], 'a part: Movement ◆ + Delay');
  assert.deepEqual(smalls(rowOf(await draw('in', ALL, { delay: null }), 4)), ['Movement ◆', 'Rows'], 'a scene of rows: Movement ◆ + Rows');
  assert.deepEqual(smalls(rowOf(await draw('act', ALL), 4)), ['Movement ◆'], 'Action needs no Next scene, no Rows, no Delay');
  assert.deepEqual(smalls(rowOf(await draw('out', ALL), 4)), ['Movement ◆', 'Next scene ◆'], 'Build out has NO Delay (decision 8)');
  assert.deepEqual(smalls(rowOf(await draw('out', ALL, { next: null }), 4)), ['Movement ◆'], 'the stage’s last scene has no next one');
  /* Delay ▾ offers the shipped steps and says the stored one. */
  const d = rowOf(await draw('in', ALL), 4);
  assert.match(d, /aria-label="Delay: 0\.3 s"/);
  /* Movement says "Custom" when the caller says the switches were moved by hand. */
  assert.match(rowOf(await draw('in', ALL, { how: { ...how, buttonText: 'Custom' } }), 4), /aria-label="Movement: Custom"/);
});

test('(3) no Duration and no Timing — not drawn, not a prop, and nothing stored for them is written from here', async () => {
  for (const phase of ['in', 'act', 'out'] as const) {
    const html = await draw(phase, ALL);
    assert.doesNotMatch(html, /Duration|Timing|Speed|data-stage-time=/, `${phase}: Duration or Timing is drawn`);
  }
  const src = read(`${L}/stage-panel/stage-animate.tsx`);
  assert.doesNotMatch(src, /\bduration\b|\btiming\b|Duration|Timing/, 'StageAnimate still takes or names a Duration / Timing');
  /* The part's caller: no writer of its speed; its timeline is touched only by the Build-out rule ((6)). */
  const sheet = read(`${E}/element-sheet.tsx`);
  const part = sheet.slice(sheet.indexOf('<StageAnimate'), sheet.indexOf('/>', sheet.indexOf('next={{', sheet.indexOf('<StageAnimate'))));
  assert.ok(part.length > 400, 'anti-vacuity: the part’s Animate was found');
  assert.doesNotMatch(part, /moveTo\('speed'|duration=|timing=|PART_SPEED_S/, 'the part’s Animate writes a speed');
  assert.equal((part.match(/moveTo\('timeline'/g) ?? []).length, 2, 'the part’s timeline is written by something other than the Build-out rule');
  /* The scene's caller, the new Maker's branch only (the older editor keeps its rows). */
  const tab = read(`${E}/scene-animate-tab.tsx`);
  const from = tab.indexOf('if (ss) {');
  const ss = tab.slice(from, tab.indexOf('<div data-scene-tab="animate" aria-busy={pending}>', from));
  assert.ok(ss.includes('<StageAnimate'), 'anti-vacuity: the scene’s Animate was found');
  assert.doesNotMatch(ss, /c\.duration\b|c\.timeline\b|duration=|timing=/, 'the scene’s Animate writes a duration or a timeline');
});

test('(4) row 2 — four that are each on or off, and a press writes the shipped value; Action is the caller’s two', async () => {
  const { toggleMotionFx } = await import(`${PANEL}/stage-animate`);
  const C = await import('../app/_components/chips');
  for (const end of ['in', 'out'] as const) {
    const row = rowOf(await draw(end, { fade: true, move: 'left' }), 2);
    /* 🧩 A DIFFERENT KIND LOOKS DIFFERENT (seen on the review copy 2026-10-09: four on/offs in one grey track read as a
       single choice with nothing picked): they are the app's CHIPS — each its own bordered pill, filled when on —
       and never a pill selector's segments. */
    assert.match(row, new RegExp(`role="group" aria-label="Build ${end}" data-chips="${end}-effects"`));
    assert.doesNotMatch(row, /data-pill-selector|data-seg=|sn-pill-thumb|data-seg-thumb/, 'row 2 is a selector’s track again');
    const chips = [...row.matchAll(/<button type="button" aria-pressed="(true|false)" data-chip="(\w+)" class="([^"]*)"><span[^>]*>([^<]*)</g)];
    assert.deepEqual(chips.map((m) => `${m[4]}:${m[1]}`), ['Fade:true', 'Blur:false', 'Move:true', 'Size:false']);
    for (const m of chips) assert.equal(m[3]!.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim(), C.chipClass(m[1] === 'true'), `${m[4]} does not wear the app’s chip`);
    /* Four even chips on ONE line — the set is told so; it does not measure itself into three across and a second line. */
    const group = /<div role="group"[^>]*class="([^"]*)"/.exec(row)?.[1] ?? '';
    for (const c of SP_ANIMATE_CHIPS.split(' ')) assert.ok(has(group, c), `the chips’ row lost ${c}`);
    assert.doesNotMatch(row, /data-chips-columns|grid-template-columns/, 'the chips lay themselves out in fewer columns');
  }
  for (const c of ['!grid', '!grid-cols-4', 'flex-1']) assert.ok(has(SP_ANIMATE_CHIPS, c), `four chips on one line: no ${c}`);
  /* 375-px phone: the pane's 355 px less three gaps leaves each chip its 84-px minimum — and a chip is 40 px with a 44-px tap. */
  const gap = Number(/!gap-(\d+(?:\.\d+)?)\b/.exec(SP_ANIMATE_CHIPS)?.[1]) * 4;
  assert.ok(gap > 0 && (355 - 3 * gap) / 4 >= 84, `a chip is narrower than the kind's 84 px (gap ${gap})`);
  assert.match(C.CHIP_CLASS, /\bh-10\b[\s\S]*\bmin-w-\[84px\]/);
  /* EXECUTED — what a press stores. */
  assert.deepEqual(toggleMotionFx(null, 'in', 'fade'), { fade: true });
  assert.deepEqual(toggleMotionFx(null, 'in', 'move'), { move: 'below' }, 'Build in’s Move starts from the bottom');
  assert.deepEqual(toggleMotionFx(null, 'out', 'move'), { move: 'above' }, 'Build out’s Move starts to the top');
  assert.deepEqual(toggleMotionFx(null, 'in', 'size'), { size: 'grow' });
  assert.deepEqual(toggleMotionFx({ fade: true, move: 'left' }, 'in', 'move'), { fade: true });
  assert.deepEqual(toggleMotionFx({ fade: true, blur: true }, 'out', 'blur'), { fade: true });
  assert.equal(toggleMotionFx({ fade: true }, 'in', 'fade'), null, 'the last one off stores nothing');
  assert.equal(toggleMotionFx({ size: 'shrink' }, 'out', 'size'), null);
  /* Action. */
  const act = rowOf(await draw('act', null), 2);
  const two = [...act.matchAll(/<button type="button" aria-pressed="(true|false)" class="[^"]*" data-seg="(\w+)"[^>]*>([^<]*)</g)].map((m) => `${m[3]}:${m[1]}`);
  assert.deepEqual(two, ['Still:false', 'Drift:true']);
  assert.doesNotMatch(rowOf(await draw('act', null, { does: { ...does, value: 'kenburns' } }), 2), /aria-pressed="true"/, 'a stored word that is neither presses one of the two');
  assert.equal(rowOf(await draw('act', ALL), 3), '', 'Action has a row 3');
});

test('(5) row 3 is only what the ON ones need — a half each', async () => {
  for (const end of ['in', 'out'] as const) {
    assert.equal(rowOf(await draw(end, null), 3), '', `${end}: row 3 is drawn with nothing on`);
    assert.equal(rowOf(await draw(end, { fade: true, blur: true }), 3), '', `${end}: Fade and Blur need nothing`);
    const move = rowOf(await draw(end, { move: 'below' }), 3);
    assert.deepEqual(smalls(move), [end === 'in' ? 'From' : 'To']);
    assert.match(move, /the bottom/i, 'the way is not said in words');
    assert.doesNotMatch(move, /data-pill-selector/);
    const size = rowOf(await draw(end, { size: 'shrink' }), 3);
    assert.deepEqual(smalls(size), []);
    assert.match(size, new RegExp(`data-pill-selector="${end}-size"`));
    assert.match(size, /aria-pressed="true" class="[^"]*" data-seg="shrink"/);
    const both = rowOf(await draw(end, ALL), 3);
    const halves = [...both.matchAll(/<span class="([^"]*)" data-stage-need="(\w+)"/g)];
    assert.deepEqual(halves.map((h) => h[2]), ['move', 'size']);
    for (const h of halves) assert.equal(h[1]!.replace(/&amp;/g, '&'), SP_ANIMATE_HALF, 'a need is not laid in its half');
    assert.doesNotMatch(rowOf(await draw(end, { size: 'settle' }), 3), /aria-pressed="true"/, 'a stored “Settle back” presses Grow or Shrink');
  }
  /* A half is a HALF: fixed at 50 % less half the 8 px gap — one need never stretches to the row. */
  assert.ok(has(SP_ANIMATE_HALF, 'flex-[0_0_calc(50%_-_4px)]'), 'a need’s half is not half the row');
  assert.ok(!has(SP_ANIMATE_HALF, 'flex-1'));
});

test('(6) a part’s Build out follows the scroll — and the last one switched off puts it back to playing once', () => {
  const sheet = read(`${E}/element-sheet.tsx`);
  const at = sheet.indexOf('onOut={(fx) => {');
  const body = sheet.slice(at, sheet.indexOf('}}', at));
  assert.ok(at > 0 && body.length > 80, 'anti-vacuity: the part’s Build out was found');
  assert.match(body, /if \(fx && motion\.timeline !== 'scroll'\) moveTo\('timeline', 'scroll'\);\s*moveTo\('out', fx\);/);
  assert.match(body, /if \(!fx && motion\.out && motion\.timeline === 'scroll'\) moveTo\('timeline', null\);/, 'a part that tried a Build out can never get its Delay back');
  /* Delay is offered only where it plays: a Build in that is on, and not following the scroll. */
  assert.match(sheet, /delay=\{\s*motionFxOn\(motion\.in\) && motion\.timeline !== 'scroll'/);
});
