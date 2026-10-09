/**
 * the-scrub-hand-over-plays-own-effects.test.ts — IN A SCRUB RUN THE HAND-OVER PLAYS EACH SCENE'S OWN EFFECT (owner
 * 2026-10-09, verbatim: *"build out from current element and build in on next element under it applies at the same
 * time on scrub like a cross fade for both"*). Before, a run switched the scenes' own Build in / Build out off and
 * played one fixed cross-fade.
 *
 * PLAYED IN A BROWSER when it was built (Chromium, a three-scene run and a Fade / Fade pair, 243 scroll positions,
 * the stylesheet before and after): every scene's cross-fade was identical at every position; the outgoing scene
 * travelled 0 → −26 px over exactly the span it faded out on, the incoming one −28 → 0 px while it faded in, a
 * composed one grew from 0.9 out of an 8-px blur; the Fade / Fade pair's bodies never moved and never changed
 * opacity; under "reduce motion" nothing moved and nothing faded. This file holds the stylesheet to the shape that
 * measured that way:
 *
 *   (1) THE STACKED CROSS-FADE IS REMOVED WHOLE (the cleanup, 2026-10-09 — it was "untouched, byte for byte" while
 *       the stacked run existed); the two fade keyframes Auto still plays are untouched.
 *   🔁 2026-10-09, commit 8c: rules (2)–(5) below were about the STACKED run, which is retired; the tests now hold what
 *   8c keeps of them (the scene's own keyframes in the hand-over, one fade, behind "no reduced motion"). (1) and (6) stand.
 *
 *   (2) ONE SHARED SPAN — the scene's own keyframes run on the SAME selector conditions, the same spacer's timeline
 *       and the same two ranges as its fade: out with the fade-out, in with the fade-in.
 *       Sabotage: the Build in given a span of its own → red.
 *   (3) FADE / FADE AND "NONE" LOOK AS THEY DID — the scene's own keyframe never fades a second time: `hub-run-keep`
 *       holds the opacity at 1 and is LAST in every list, and a plain fade keyframe has nothing but opacity in it.
 *       Sabotage: the keep taken off the way out → red.
 *   (4) REDUCED MOTION AND OLDER ENGINES NEVER SEE IT — the rules sit inside all three gates.
 *   (5) THE PINNED FRAME CANNOT BECOME SCROLLABLE — the keyframes ride the body's CHILD (the body of a frame that
 *       hands over is clipped), and "one part after another" scenes keep their parts' own arrival: only whole
 *       scenes take the scene-level Build in. Sabotage: the Build in on every scene → red.
 *   (6) ON A PART, "LEAVES" IS NAMED AS ITS SCENE'S — Scrub and Auto scroll are scene to scene; a part has none.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { LEAVES_OPTIONS, SCENE_LEAVES_NAME } from './animate-feel';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const CSS = stripComments(readFileSync(join(WEB, 'app/globals.css'), 'utf8'));

const LIVE = '.hub-scrub:not(:empty):not(:has(> .hub-canvas > .hub-canvas-body:empty))';
const AFTER = ':has(~ .hub-scrub:not(:empty))';
const OUT = 'cover calc(var(--hub-at) + 0.5 * var(--hub-step)) cover calc(var(--hub-at) + var(--hub-step))';
const IN = 'cover calc(var(--hub-at) - 0.6 * var(--hub-step)) cover calc(var(--hub-at) - 0.1 * var(--hub-step))';

/** The one rule with exactly this selector: its declarations as a map, and where it starts. */
function rule(selector: string): { decl: Record<string, string>; at: number } {
  const hits: Array<{ decl: Record<string, string>; at: number }> = [];
  for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1]!.trim().replace(/\s+/g, ' ') !== selector) continue;
    const decl = Object.fromEntries(
      m[2]!
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim().replace(/\s+/g, ' ')]),
    );
    hits.push({ decl, at: m.index! });
  }
  assert.equal(hits.length, 1, `“${selector}” is declared ${hits.length} times`);
  return hits[0]!;
}
/** The at-rules a position in the stylesheet sits inside. */
function gatesAt(at: number): string[] {
  const stack: string[] = [];
  let head = '';
  for (let i = 0; i < at; i++) {
    const c = CSS[i]!;
    if (c === '{') {
      stack.push(head.trim().replace(/\s+/g, ' '));
      head = '';
    } else if (c === '}') {
      stack.pop();
      head = '';
    } else if (c === ';') head = '';
    else head += c;
  }
  return stack.filter((s) => s.startsWith('@'));
}

const SLOT = {
  out: `${LIVE}${AFTER}`,
  in: `${LIVE} ~ ${LIVE}`,
  both: `${LIVE} ~ ${LIVE}${AFTER}`,
};
const OWN = {
  out: `${SLOT.out} > .hub-canvas > .hub-canvas-body > *`,
  in: `${SLOT.in} > .hub-canvas.hub-seq-whole > .hub-canvas-body > *`,
  both: `${SLOT.both} > .hub-canvas.hub-seq-whole > .hub-canvas-body > *`,
};

/* 🔁 RE-AIMED 2026-10-09 (the cleanup). (1) held the stacked run's cross-fade byte for byte — the promise 8a made
   while it added the scenes' own effects inside it. 8c replaced that cross-fade (the leaving scene's Build out, then
   the arrival at 80 %, in the same place) and the cleanup REMOVED its three rules, so "untouched" would now be a
   lie. What it still holds: the three rules are gone WHOLE (not one left to fade a scene on a spacer nobody draws),
   and the two keyframes they shared with the Auto run are exactly as they were. */
test('(1) the stacked cross-fade is removed whole — and the fade keyframes Auto still plays are untouched', () => {
  const declared = (selector: string) => [...CSS.matchAll(/([^{}]+)\{[^{}]*\}/g)].filter((m) => m[1]!.trim().replace(/\s+/g, ' ') === selector).length;
  for (const sel of [SLOT.out, SLOT.in, SLOT.both]) assert.equal(declared(sel), 0, `“${sel}” — a rule of the stacked run is back`);
  assert.ok(!CSS.includes(OUT) && !CSS.includes(IN), 'a spacer-timeline range is back');
  assert.match(CSS, /@keyframes hub-scene-in \{\s*from \{ opacity: 0; visibility: hidden; pointer-events: none; \}\s*to\s+\{ opacity: 1; visibility: visible; pointer-events: auto; \}\s*\}/);
  assert.match(CSS, /@keyframes hub-scene-out \{\s*from \{ opacity: 1; visibility: visible; pointer-events: auto; \}\s*to\s+\{ opacity: 0; visibility: hidden; pointer-events: none; \}\s*\}/);
  assert.match(CSS, /\.hub-arun\[data-armed\][^{]*\{[^}]*animation: hub-scene-in var\(--hub-fade\) linear both;/, 'the Auto run lost its fade');
});

/* 🔁 RE-AIMED 2026-10-09 (commit 8c — `lib/scrub-is-a-held-hand-over.test.ts`): Scrub is no longer a stacked run, so
   the three rules of 8a that rode the run's cross-fade are RETIRED with it (nothing draws `.hub-run` › `.hub-scrub`
   for a Scrub scene any more). What 8a established is kept by 8c on the new shape, and held here:
     · the scene's OWN keyframes play in the hand-over (`--hub-in-kf` / `--hub-out-kf`);
     · there is only ONE fade — `hub-run-keep` holds the keyframe's opacity, LAST in the list;
     · every rule sits behind "no reduced motion" (and, now, the engine's mark instead of a scroll timeline). */
const BODY = '.hub-scenes[data-hub-scrub-on] .hub-scene[data-hub-fx] > .hub-canvas > .hub-canvas-body';

test('(2) the stacked run’s own-effect rules are retired — the scene’s own keyframes play in the held hand-over instead', () => {
  for (const sel of Object.values(OWN)) assert.equal([...CSS.matchAll(/([^{}]+)\{/g)].filter((m) => m[1]!.trim().replace(/\s+/g, ' ') === sel).length, 0, `8a’s rule is still in the stylesheet: ${sel}`);
  const body = rule(BODY).decl;
  assert.equal(body.animation, 'var(--hub-in-kf, none) 1s linear both paused, var(--hub-out-kf, none) 1s linear forwards paused, hub-run-keep 1s linear both paused');
  /* Under the thumb: a paused animation's delay is its place — set from the engine's two numbers. */
  assert.equal(body['animation-delay'], 'calc(var(--hub-pbin, 1) * -1s), calc(var(--hub-pout, 0) * -1s), 0s');
  assert.equal(body['animation-timeline'], 'auto');
});

test('(3) one fade only — the scene’s own keyframe never fades a second time', () => {
  assert.match(CSS, /@keyframes hub-run-keep \{ from, to \{ opacity: 1; \} \}/);
  const list = rule(BODY).decl.animation!.split(', ');
  assert.equal(list.at(-1), 'hub-run-keep 1s linear both paused', 'the keep is not last — the scene’s keyframe fades over the hand-over’s fade');
  /* THE fade is the hand-over's, on the scene itself. */
  assert.equal(rule('.hub-scenes[data-hub-scrub-on] .hub-scene[data-hub-fx]').decl.opacity, 'var(--hub-o, 1)');
  /* A plain fade is ONLY an opacity: with that held there is nothing left for it to play. */
  assert.match(CSS, /@keyframes hub-in-fade\s*\{ from \{ opacity: 0; \} \}/);
  assert.match(CSS, /@keyframes hub-out-fade\s*\{ to\s*\{ opacity: 0; \} \}/);
  /* The other keyframes keep what is NOT opacity — the travel, the size, the blur. */
  assert.match(CSS, /@keyframes hub-out-movefade-above \{ to\s*\{ opacity: 0; transform: translate3d\(0, -26px, 0\); \} \}/);
  assert.match(CSS, /@keyframes hub-in-mix\s*\{ from \{ opacity: var\(--hub-in-o, 1\); transform: var\(--hub-in-t, none\); filter: var\(--hub-in-f, none\); \} \}/);
});

test('(4) a guest who asked for less motion, and a printed page, never see it', () => {
  for (const sel of [BODY, '.hub-scenes[data-hub-scrub-on] .hub-scene[data-hub-fx]', '.hub-scenes[data-hub-scrub-on] .hub-stage']) {
    assert.deepEqual(gatesAt(rule(sel).at), ['@media screen and (prefers-reduced-motion: no-preference)'], `${sel}: outside the Scrub block’s gate`);
  }
});

test('(5) "one part after another" scenes keep their parts’ own arrival: the scene-level Build in is not theirs', () => {
  assert.equal(rule(`${BODY.replace('> .hub-canvas >', '> .hub-canvas.hub-seq-parts >')}`).decl['animation-name'], 'none, var(--hub-out-kf, none), hub-run-keep');
});

test('(6) on a part, "Leaves" is named as its scene’s', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StageAnimate } = await import(`../${L}/stage-panel/stage-animate`);
  const { setStageAnimatePhase } = await import(`../${L}/stage-panel/store`);
  const noop = () => {};
  const draw = (leaves: Record<string, unknown>) => {
    setStageAnimatePhase('out');
    const html = renderToStaticMarkup(
      React.createElement(StageAnimate, { move: { in: null, out: { value: 'calm', onPick: noop } }, plays: { value: 'scroll', onPick: noop }, inFx: null, outFx: { fade: true }, onIn: noop, onOut: noop, does: null, leaves }),
    );
    setStageAnimatePhase('in');
    return html;
  };
  const scene = draw({ value: 'scroll', options: LEAVES_OPTIONS, onPick: noop });
  const part = draw({ value: 'scrub', options: LEAVES_OPTIONS, onPick: noop, small: SCENE_LEAVES_NAME });
  assert.match(scene, /data-dd-label="">Leaves ◆<[\s\S]*?aria-label="How it leaves: As it scrolls away"/);
  assert.match(part, /data-dd-label="">Scene leaves ◆<[\s\S]*?aria-label="How its scene leaves: Scrub out ◆"/);
  assert.equal(SCENE_LEAVES_NAME, 'Scene leaves ◆');
  const read = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));
  assert.match(read(`${E}/element-sheet.tsx`), /leaves=\{\{\s*small: SCENE_LEAVES_NAME,\s*value: canvas\.transition \?\? 'scroll',/);
  assert.doesNotMatch(read(`${E}/scene-animate-tab.tsx`), /SCENE_LEAVES_NAME/, 'a scene’s own Leaves is named as somebody else’s');
});
