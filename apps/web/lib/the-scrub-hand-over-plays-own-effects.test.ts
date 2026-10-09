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
 *   (1) THE CROSS-FADE IS UNTOUCHED — its three rules, byte for byte.
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

test('(1) the cross-fade is untouched — its three rules, byte for byte', () => {
  assert.deepEqual(rule(SLOT.out).decl, { animation: 'hub-scene-out linear forwards', 'animation-timeline': 'var(--hub-tl)', 'animation-range': OUT });
  assert.deepEqual(rule(SLOT.in).decl, { animation: 'hub-scene-in linear both', 'animation-timeline': 'var(--hub-tl)', 'animation-range': IN });
  assert.deepEqual(rule(SLOT.both).decl, { animation: 'hub-scene-in linear both, hub-scene-out linear forwards', 'animation-timeline': 'var(--hub-tl), var(--hub-tl)', 'animation-range': `${IN}, ${OUT}` });
  assert.match(CSS, /@keyframes hub-scene-in \{\s*from \{ opacity: 0; visibility: hidden; pointer-events: none; \}\s*to\s+\{ opacity: 1; visibility: visible; pointer-events: auto; \}\s*\}/);
  assert.match(CSS, /@keyframes hub-scene-out \{\s*from \{ opacity: 1; visibility: visible; pointer-events: auto; \}\s*to\s+\{ opacity: 0; visibility: hidden; pointer-events: none; \}\s*\}/);
});

test('(2) one shared span — the scene’s own keyframes run with its fade: the same conditions, timeline and ranges', () => {
  /* OUT rides the fade-out; IN the fade-in; a middle scene both — each on the selector of the fade it rides. */
  assert.deepEqual(rule(OWN.out).decl, {
    animation: 'var(--hub-out-kf, none) linear forwards, hub-run-keep linear both',
    'animation-timeline': 'var(--hub-tl), var(--hub-tl)',
    'animation-range': `${OUT}, ${OUT}`,
  });
  assert.deepEqual(rule(OWN.in).decl, {
    animation: 'var(--hub-in-kf, none) linear both, hub-run-keep linear both',
    'animation-timeline': 'var(--hub-tl), var(--hub-tl)',
    'animation-range': `${IN}, ${IN}`,
  });
  assert.deepEqual(rule(OWN.both).decl, {
    animation: 'var(--hub-in-kf, none) linear both, var(--hub-out-kf, none) linear forwards, hub-run-keep linear both',
    'animation-timeline': 'var(--hub-tl), var(--hub-tl), var(--hub-tl)',
    'animation-range': `${IN}, ${OUT}, ${IN}`,
  });
  /* The spans ARE the fade's own — read off the fade's rules, not off this file's constants. */
  assert.ok(rule(OWN.out).decl['animation-range']!.startsWith(rule(SLOT.out).decl['animation-range']!));
  assert.ok(rule(OWN.in).decl['animation-range']!.startsWith(rule(SLOT.in).decl['animation-range']!));
  assert.equal(rule(OWN.both).decl['animation-range']!.split(', ').slice(0, 2).join(', '), rule(SLOT.both).decl['animation-range']);
  /* The same fill as the fade it rides: the way out holds its end (the scene is gone), the way in both ends. */
  assert.match(rule(OWN.out).decl.animation!, /^var\(--hub-out-kf, none\) linear forwards,/);
  assert.match(rule(OWN.in).decl.animation!, /^var\(--hub-in-kf, none\) linear both,/);
});

test('(3) Fade / Fade and "none" look as they did — the scene’s own keyframe never fades a second time', () => {
  /* The keep holds the opacity at 1 and nothing else … */
  assert.match(CSS, /@keyframes hub-run-keep \{ from, to \{ opacity: 1; \} \}/);
  /* … and it is LAST in every list, so it wins that one property over the keyframe before it. */
  for (const k of ['out', 'in', 'both'] as const) {
    const list = rule(OWN[k]).decl.animation!.split(', ');
    assert.equal(list.at(-1), 'hub-run-keep linear both', `${k}: the keep is not last — the scene’s keyframe fades over the cross-fade`);
    assert.equal(list.filter((a) => a.startsWith('hub-run-keep')).length, 1);
  }
  /* A plain fade is ONLY an opacity: with that held there is nothing left for it to play — the old look, exactly. */
  assert.match(CSS, /@keyframes hub-in-fade\s*\{ from \{ opacity: 0; \} \}/);
  assert.match(CSS, /@keyframes hub-out-fade\s*\{ to\s*\{ opacity: 0; \} \}/);
  /* "None" plays nothing: the keyframe's name is `none` (`hubInKeyframe` / `hubOutKeyframe`), the var's own fallback too. */
  for (const k of ['out', 'in', 'both'] as const) assert.doesNotMatch(rule(OWN[k]).decl.animation!, /var\(--hub-(?:in|out)-kf\)(?!,)/);
  /* The other keyframes keep what is NOT opacity — the travel, the size, the blur. */
  assert.match(CSS, /@keyframes hub-out-movefade-above \{ to\s*\{ opacity: 0; transform: translate3d\(0, -26px, 0\); \} \}/);
  assert.match(CSS, /@keyframes hub-out-settle \{ to\s*\{ opacity: 0; transform: scale\(0\.965\); \} \}/);
  assert.match(CSS, /@keyframes hub-in-mix\s*\{ from \{ opacity: var\(--hub-in-o, 1\); transform: var\(--hub-in-t, none\); filter: var\(--hub-in-f, none\); \} \}/);
});

test('(4) reduced motion and older engines never see it — inside all three gates', () => {
  for (const k of ['out', 'in', 'both'] as const) {
    const gates = gatesAt(rule(OWN[k]).at);
    assert.ok(gates.includes('@supports (animation-timeline: view())'), `${k}: outside the scroll-timeline gate — ${gates.join(' | ')}`);
    assert.ok(gates.includes('@media (prefers-reduced-motion: no-preference)'), `${k}: plays for a guest who asked for less motion`);
    assert.ok(gates.includes('@supports (animation-range: entry 0% exit 100%) and (timeline-scope: none)'), `${k}: outside the scenes’ gate`);
    /* …the very gates the cross-fade itself is in. */
    assert.deepEqual(gates, gatesAt(rule(SLOT[k]).at));
  }
});

test('(5) the pinned frame cannot become scrollable — the keyframes ride the body’s child; only whole scenes take the scene-level Build in', () => {
  /* The body of a frame that hands over is clipped, and its own animation stays off (the reset the run always had). */
  assert.equal(rule('.hub-scrub:not(:empty):has(~ .hub-scrub:not(:empty)) > .hub-canvas > .hub-canvas-body').decl['overflow-y'], 'clip');
  assert.match(CSS, /\.hub-scrub > \.hub-canvas > \.hub-canvas-body,\s*\.hub-scrub > \.hub-canvas\.pahina-in > \.hub-canvas-body \{ animation: none; \}/);
  for (const k of ['out', 'in', 'both'] as const) assert.ok(OWN[k].endsWith(' > .hub-canvas-body > *'), `${k}: the keyframes are on the body itself`);
  /* "One part after another": the parts arrive by themselves while pinned — no scene-level Build in over them. */
  assert.ok(OWN.in.includes('.hub-canvas.hub-seq-whole') && OWN.both.includes('.hub-canvas.hub-seq-whole'));
  assert.ok(!OWN.out.includes('hub-seq-'), 'every scene leaves whole — the hand-off is the scene’s');
  assert.match(CSS, /\.hub-scrub > \.hub-seq-parts > \.hub-canvas-body > \* > \*:nth-child\(n \+ 2\) \{\s*--hub-part-in: var\(--hub-in-kf, none\);/, 'anti-vacuity: the parts’ own arrival in a run');
  /* Nothing else in the stylesheet animates a body's child, so nothing fights these rules. */
  const others = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /\.hub-canvas-body > \*\s*$/.test(m[1]!.trim()) && /animation/.test(m[2]!)).map((m) => m[1]!.trim().replace(/\s+/g, ' '));
  assert.deepEqual(others.sort(), [OWN.both, OWN.in, OWN.out].sort());
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
