/**
 * selectors-are-pills-that-slide.test.ts — A SEGMENTED SELECTOR IS A FULL PILL WHOSE ONE THUMB TRAVELS.
 *
 * Owner, 2026-10-08 (DECISION_LOG "SELECTORS ARE PILLS THAT SLIDE"), on the Maker's Stages | Studio, its tool group
 * and its Look | Background | Arrange: *"i like this pill type instead of the rounded edges selector"* · *"and make
 * them animate"* · *"apply the same pill selector"* · *"adjust all pill selectors to this if possible"*. Rule:
 * `BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.E.
 *
 *   (1) SHAPE AND COLOUR — the app's selector (`app/_components/pill-selector.tsx`) is a full pill: a 44-px track
 *       with 3 px of padding, each choice a pill inside it, the finger's target the whole height. ONE colour for
 *       every selector (owner: *"pill selector should have a consistent color"* · *"Terracota is our color? and
 *       greyed out when off?"*): the terracotta with white words when on, grey words when off.
 *   (2) ONE THUMB — RUN against a stand-in track: it lies exactly on the picked choice on FIRST paint with no
 *       slide-in, moves when the pick changes, re-measures at a new width, lies on an icon's face, wears the
 *       choice's own fill, and steps aside when the row is not an either-or.
 *   (3) MOTION — transform and size only; it LANDS WITH A BOUNCE and PULSES ONCE ON A PICK (owner: *"a bit of bounce
 *       and a pulse to imitate it has been pressed"*), at the family's ONE speed (`--sn-pill-dur`, owner: *"in
 *       between normal and slow motion"*); nothing moves under "reduce motion"; no timer, no dependency.
 *   (4) KEYS — ← → (↑ ↓, Home, End) move focus between the choices and wrap; they never pick.
 *   (5) THE FOUR MAKER SELECTORS — Stages | Studio, Look's Background · Elements · Music, the Stages tool group
 *       (Style · Text · Animate) and `Phases` (Look | Background | Arrange · Build in | Action | Build out) all wear
 *       the ONE thumb; a row of toggles opts out; aria is as it was.
 *   (6) `PillSelector` — buttons or links, an icon-only variant, a multi-toggle; nothing in it knows any one screen.
 *   (7) FIRST LOAD — the thumb's measuring code is not in the Maker's first load.
 *   (8) THE WATCH (`INTERACTION_RULES.md` § 9, "one source per kind of control") — in the areas listed in
 *       `PILL_WATCH_SCOPE`, no file draws a segmented track by hand: it goes through the template. A later builder
 *       EXTENDS the scope area by area; it is never a repo-wide rule.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { PILL_THUMB_CLASS, createPillThumb, pillThumbLay, segIndex, segStep, type PillChoiceEl } from '../app/_components/pill-thumb';
import { SP_PHASE, SP_PHASE_INSET, SP_PHASES, STAGE_TOOL_BUTTON, STAGE_TOOL_DIVIDER, STAGE_TOOL_FACE, STAGE_TOOL_PILL } from './maker-stage-room';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const read = (rel: string) => stripComments(raw(rel));
const E = 'app/dashboard/[eventId]/website/editor/_components';
const L = 'app/dashboard/[eventId]/launch/_components';
const has = (classes: string, c: string) => classes.split(/\s+/).includes(c);
const noRect = (classes: string, what: string) => assert.doesNotMatch(classes, /(?:^|\s)rounded-(?:sm|md|lg|xl|2xl|\[)/, `${what} is a rounded rectangle`);

test('(1) the app’s selector is a full pill in ONE colour — terracotta with white words when on, grey words when off', async () => {
  const P = await import('../app/_components/pill-selector');
  const K = await import(`../${E}/inspector-kit`);
  for (const [what, track] of [['the app’s track', `${P.PILL_TRACK_CLASS} ${P.PILL_TRACK_GROUND}`], ['the Maker’s ISegmented', K.I_SEGMENTED_CLASS as string]] as const) {
    for (const c of ['rounded-full', 'relative', 'p-[3px]', 'group/seg', 'flex']) assert.ok(has(track, c), `${what} lost ${c}`);
    noRect(track, what);
  }
  // ONE colour: the app's accent with the ink that reads on it; off = grey words, no fill. (Re-aimed 2026-10-08, owner:
  // "if we change our color to blue, it will be easy to change the button colors" — the template names the accent by
  // its JOB (`--sn-accent`), which holds the terracotta today; `the-accent-is-one-token.test.ts` holds the rest.)
  assert.equal(P.PILL_ON_CLASS, 'bg-accent text-on-accent');
  assert.match(raw('app/globals.css'), /--sn-accent: var\(--color-mulberry\);/, 'the accent is no longer the terracotta token');
  assert.match(raw('app/globals.css'), /--color-mulberry: 194 78 37;\s*\/\* CTA → #C24E25/, 'anti-vacuity: the terracotta token moved');
  assert.match(P.PILL_OFF_CLASS, /^text-ink\/\d\d hover:text-ink$/);
  for (const seg of [P.pillSegClass, K.iSegClass] as ((on: boolean, tone?: 'plain' | 'wine') => string)[]) {
    for (const tone of [undefined, 'plain', 'wine'] as const) {
      // Whatever tone a caller still passes, the look is the same — there is no other colour to choose.
      assert.equal(seg(true, tone), seg(true), 'a tone still recolours the picked choice');
      assert.equal(seg(false, tone), seg(false));
      for (const on of [true, false]) {
        const cls = seg(on, tone);
        assert.ok(has(cls, 'rounded-full'), 'a choice is not a pill');
        noRect(cls, 'a choice');
        // 38 px of pill + 3 + 3 of track = 44; the target reaches the track's edges; the words sit above the thumb.
        assert.ok(has(cls, 'min-h-[38px]'), 'the track is no longer 44 px tall on a phone');
        for (const c of ['relative', 'z-[1]', 'after:absolute', 'after:-inset-y-[3px]']) assert.ok(has(cls, c), `a choice lost ${c}`);
        // The words cross-fade at the family's one speed — and not at all under reduce motion.
        for (const c of ['transition-colors', 'duration-sn-pill', 'ease-sn', 'motion-reduce:transition-none']) assert.ok(has(cls, c), `a choice lost ${c}`);
      }
    }
    assert.ok(has(seg(true), 'bg-accent') && has(seg(true), 'text-on-accent'), 'the picked choice is not the accent');
    assert.ok(!has(seg(true), 'bg-white') && !has(seg(true), 'text-ink'), 'a white selector is back');
    // The picked choice hands its fill to the thumb once the thumb is laid — and only the picked one does.
    assert.ok(has(seg(true), 'group-data-[seg-thumb]/seg:bg-transparent'), 'two pills would be drawn (the choice and the thumb)');
    assert.ok(!seg(false).includes('seg-thumb') && !/(?:^|\s)bg-/.test(seg(false)), 'an unpicked choice is filled');
    assert.ok(seg(false).includes(P.PILL_OFF_CLASS));
  }
  // The Maker's selector IS the app's: one look, drawn — never a second string.
  assert.match(read(`${E}/inspector-kit.tsx`), /export const I_SEGMENTED_CLASS = `\$\{PILL_TRACK_CLASS\} flex-wrap gap-0\.5 \$\{PILL_TRACK_GROUND\}`;/);
  assert.match(read(`${E}/inspector-kit.tsx`), /return `\$\{pillSegClass\(on, tone\)\} lg:min-h-8`;/);
  // No literal radius (scripts/lint-radius.mjs): the pill is the house token.
  for (const f of ['app/_components/pill-selector.tsx', 'app/_components/pill-thumb.tsx', `${E}/inspector-kit.tsx`]) assert.doesNotMatch(read(f), /999px|9999px/, `${f} writes a literal pill radius`);
});

/* ── a stand-in track: just the little of the DOM the thumb touches ────────── */

type FakeChoice = PillChoiceEl & { attrs: Record<string, string>; tag: 'button' | 'a'; disabled?: boolean; focused: number; face?: { offsetLeft: number; offsetTop: number; offsetWidth: number; offsetHeight: number } };
function choice(x: number, w: number, attrs: Record<string, string> = {}, extra: Partial<FakeChoice> = {}): FakeChoice {
  const c: FakeChoice = {
    offsetLeft: x,
    offsetTop: 3,
    offsetWidth: w,
    offsetHeight: 38,
    dataset: {},
    attrs,
    tag: 'button',
    focused: 0,
    querySelector: () => c.face ?? null,
    focus: () => void (c.focused += 1),
    ...extra,
  };
  return c;
}
function fakeTrack(choices: FakeChoice[]) {
  const marks: Record<string, string> = {};
  const picked = (c: FakeChoice) => c.attrs['aria-pressed'] === 'true' || c.attrs['aria-current'] === 'page' || c.attrs['aria-selected'] === 'true' || c.attrs['aria-checked'] === 'true';
  return {
    marks,
    querySelectorAll: (sel: string) => (sel.includes('aria-pressed') ? choices.filter(picked) : choices.filter((c) => (c.tag === 'a' ? true : !c.disabled))),
    setAttribute: (n: string, v: string) => void (marks[n] = v),
    removeAttribute: (n: string) => void delete marks[n],
  };
}
/** A thumb whose `style.transition` writes are RECORDED — "no slide-in" is a fact about that order. */
function fakeThumb() {
  const log: string[] = [];
  const style: Record<string, string> = {};
  const proxy = new Proxy(style, {
    set(t, k: string, v: string) {
      if (k === 'transition' || k === 'transform') log.push(`${k}=${v}`);
      t[k] = v;
      return true;
    },
  });
  const attrs: Record<string, string> = {};
  return {
    log,
    attrs,
    el: {
      style: proxy,
      offsetWidth: 0,
      setAttribute: (n: string, v: string) => {
        log.push(`+${n}`);
        attrs[n] = v;
      },
      removeAttribute: (n: string) => {
        if (n in attrs) log.push(`-${n}`);
        delete attrs[n];
      },
    },
  };
}

test('(2) the thumb, RUN: on the picked choice at first paint with no slide-in, moving on a pick, re-measured on a resize', () => {
  // Three choices of UNEQUAL width; the middle one is picked.
  const a = choice(3, 96);
  const b = choice(101, 71, { 'aria-pressed': 'true' });
  const c = choice(174, 120);
  const track = fakeTrack([a, b, c]);
  const { el, log, attrs } = fakeThumb();
  const thumb = createPillThumb(track, el);

  // FIRST PAINT: laid exactly on the picked choice, with the transition OFF — then handed back for later moves.
  thumb.place();
  assert.equal(el.style.transform, 'translate(101px, 3px)');
  assert.equal(el.style.width, '71px');
  assert.equal(el.style.height, '38px');
  assert.equal(el.style.opacity, '1');
  assert.deepEqual(log, ['transition=none', 'transform=translate(101px, 3px)', 'transition='], 'the first placement can slide in from the left');
  assert.equal(track.marks['data-seg-thumb'], '', 'the picked choice is never told to drop its fill — two pills are drawn');
  assert.equal('data-pulse' in attrs, false, 'the thumb pulses on mount — nothing was pressed');

  // A PICK: the thumb travels (its transition is NOT switched off again) and resizes to the label it lands on.
  log.length = 0;
  delete b.attrs['aria-pressed'];
  c.attrs['aria-pressed'] = 'true';
  thumb.place();
  assert.equal(el.style.transform, 'translate(174px, 3px)');
  assert.equal(el.style.width, '120px');
  assert.deepEqual(log, ['transform=translate(174px, 3px)', '+data-pulse'], 'a pick does not travel (its transition was switched off) — or does not pulse');
  // …and PULSES once — and again, from its start, at the next pick (taken off, the move committed, put back).
  log.length = 0;
  delete c.attrs['aria-pressed'];
  b.attrs['aria-pressed'] = 'true';
  thumb.place();
  assert.deepEqual(log, ['-data-pulse', 'transform=translate(101px, 3px)', '+data-pulse'], 'a second pick does not restart the pulse');
  delete b.attrs['aria-pressed'];
  c.attrs['aria-pressed'] = 'true';
  thumb.place();

  // A RESIZE (876 px wide, three equal segments): measured again — never one cached width — and NO pulse (nothing was pressed).
  for (const [i, ch] of [a, b, c].entries()) Object.assign(ch, { offsetLeft: 3 + i * 290, offsetWidth: 290 });
  log.length = 0;
  thumb.place();
  assert.equal(el.style.transform, 'translate(583px, 3px)');
  assert.equal(el.style.width, '290px');
  assert.ok(!log.includes('-data-pulse') && !log.includes('+data-pulse'), 'a resize pulses the thumb');

  // NOT AN EITHER-OR: several pressed, or none — the thumb steps aside and the choices keep their own fills.
  a.attrs['aria-pressed'] = 'true';
  thumb.place();
  assert.equal(el.style.opacity, '0');
  assert.equal('data-seg-thumb' in track.marks, false, 'a row of toggles lost its fills to a thumb that is not there');
  delete a.attrs['aria-pressed'];
  delete c.attrs['aria-pressed'];
  thumb.place();
  assert.equal(el.style.opacity, '0');
  // …and when ONE is picked again it is laid in place — not slid in from wherever it was.
  log.length = 0;
  a.attrs['aria-pressed'] = 'true';
  thumb.place();
  assert.equal(log[0], 'transition=none', 'a thumb that comes back slides in from its old place');
  assert.equal(el.style.transform, 'translate(3px, 3px)');

  // LINKS say they are picked with aria-current="page" — the same thumb.
  const view = choice(3, 80, { 'aria-current': 'page' }, { tag: 'a' });
  const links = fakeTrack([view, choice(85, 110, {}, { tag: 'a' })]);
  const t2 = fakeThumb();
  createPillThumb(links, t2.el).place();
  assert.equal(t2.el.style.transform, 'translate(3px, 3px)');

  // A RADIO GROUP says it with aria-checked="true" (role="radio" choices: Edit | Off | View) — the same thumb.
  const radios = [choice(3, 60, { 'aria-checked': 'false' }), choice(65, 50, { 'aria-checked': 'true' }), choice(117, 64, { 'aria-checked': 'false' })];
  const t5 = fakeThumb();
  const radioThumb = createPillThumb(fakeTrack(radios), t5.el);
  radioThumb.place();
  assert.equal(t5.el.style.transform, 'translate(65px, 3px)', 'a radio group’s picked choice has no thumb');
  assert.equal(t5.el.style.width, '50px');
  radios[1]!.attrs['aria-checked'] = 'false';
  radios[2]!.attrs['aria-checked'] = 'true';
  radioThumb.place();
  assert.equal(t5.el.style.transform, 'translate(117px, 3px)');

  // AN ICON'S FACE: the thumb lies on the 46 × 38 face inside the 44-px button.
  const tool = choice(47, 46, { 'aria-pressed': 'true' }, { offsetTop: 0, offsetHeight: 44, face: { offsetLeft: 0, offsetTop: 3, offsetWidth: 46, offsetHeight: 38 } });
  const t3 = fakeThumb();
  createPillThumb(fakeTrack([choice(0, 46), tool]), t3.el).place();
  assert.equal(t3.el.style.transform, 'translate(47px, 3px)');
  assert.equal(t3.el.style.height, '38px');
  // ONE colour: the thumb never takes a fill from a choice.
  assert.equal(t3.el.style.background, undefined, 'a choice recoloured the thumb');

  // A CLEAR MARGIN: a 44-px segment whose pill is clipped 3 px inside (Phases) — the thumb lies inside the same 3 px.
  const phase = choice(292, 292, { 'aria-pressed': 'true' }, { offsetTop: 0, offsetHeight: 44 });
  phase.dataset.segInset = '3';
  const t4 = fakeThumb();
  createPillThumb(fakeTrack([choice(0, 292, {}, { offsetTop: 0, offsetHeight: 44 }), phase]), t4.el).place();
  assert.equal(t4.el.style.transform, 'translate(295px, 3px)');
  assert.equal(t4.el.style.width, '286px');
  assert.equal(t4.el.style.height, '38px');

  // Leaving: the choices get their fills back.
  thumb.leave();
  assert.equal('data-seg-thumb' in track.marks, false);

  // The pure lay.
  assert.deepEqual(pillThumbLay([{ x: 3, y: 43, w: 120, h: 38 }]), { transform: 'translate(3px, 43px)', width: '120px', height: '38px' });
  assert.equal(pillThumbLay([{ x: 0, y: 0, w: 0, h: 0 }]), null, 'a choice not laid out yet (a hidden panel) drew a thumb at 0 × 0');

  // The component wires that behaviour to a pick and to a resize — and to nothing else.
  const src = read('app/_components/pill-thumb.tsx');
  assert.match(src, /const PICKED = ':scope > \[aria-pressed="true"\], :scope > \[aria-current="page"\], :scope > \[aria-selected="true"\], :scope > \[aria-checked="true"\]';/);
  assert.match(src, /useLayoutEffect\(/, 'the thumb is placed after paint — a frame in the wrong place');
  assert.match(src, /thumb\.place\(\);\s*const picks = new MutationObserver\(thumb\.place\);/);
  assert.match(src, /attributeFilter: \['aria-pressed', 'aria-current', 'aria-selected', 'aria-checked'\]/, 'the thumb watches more — or fewer — than the four ways a choice says it is picked');
  assert.match(src, /new ResizeObserver\(thumb\.place\)/, 'a rotated phone leaves the thumb where it was');
  assert.match(src, /return \(\) => \{[\s\S]*?thumb\.leave\(\);\s*\};/);
});

test('(3) it lands with a bounce and pulses once on a pick — transform, size, scale and opacity only, at ONE speed; nothing under “reduce motion”', () => {
  for (const c of ['sn-pill-thumb', 'absolute', 'rounded-full', 'pointer-events-none', 'bg-accent', 'transition-[transform,width,height]', 'duration-sn-pill', 'ease-sn-spring', 'motion-reduce:transition-none']) {
    assert.ok(has(PILL_THUMB_CLASS, c), `the thumb lost ${c}`);
  }
  assert.doesNotMatch(PILL_THUMB_CLASS, /transition-all|transition-\[[^\]]*(?:left|top|margin|padding|background)/, 'the thumb animates layout or paint');
  assert.doesNotMatch(PILL_THUMB_CLASS, /bg-white|data-\[tone/, 'the thumb has a second colour');
  const src = read('app/_components/pill-thumb.tsx');
  assert.match(src, /className=\{PILL_THUMB_CLASS\}/);
  assert.doesNotMatch(src, /setTimeout|setInterval|requestAnimationFrame|framer-motion|@radix-ui/, 'a timer or an animation library');
  assert.doesNotMatch(raw('package.json'), /"framer-motion"|"@radix-ui\/react-toggle-group"/, 'a dependency was added for the selector');

  // ONE SPEED for the family, in ONE place: the thumb's travel, the words, the pulse; the ring is a multiple of it.
  const css = raw('app/globals.css');
  assert.equal((css.match(/--sn-pill-dur:/g) ?? []).length, 1, 'the family’s speed is declared more than once');
  const ms = Number(/--sn-pill-dur:\s*(\d+)ms;/.exec(css)?.[1]);
  assert.equal(ms, 700, `the speed (${ms} ms) is not the owner’s “0.7 seconds” (after trying normal · in between · slow on the gallery)`);
  const tw = raw('tailwind.config.ts');
  assert.match(tw, /'sn-pill': 'var\(--sn-pill-dur\)'/, '`duration-sn-pill` does not read the token');
  assert.match(tw, /'sn-spring': 'var\(--sn-pill-spring\)'/);
  // The landing overshoots (a control point above 1) — a bounce.
  const spring = (/--sn-pill-spring:\s*cubic-bezier\(([^)]+)\);/.exec(css)?.[1] ?? '').split(',').map(Number);
  assert.ok(spring.length === 4 && spring[1]! > 1, `the thumb's landing does not overshoot (${spring.join(', ')})`);
  // ⚠ Never an arbitrary `duration-[…]`: with tailwindcss-animate loaded Tailwind emits NOTHING for it (seen in the
  //   review copy: the thumb ran at the 150 ms default while its class said 220).
  assert.match(tw, /plugins: \[tailwindcssAnimate\]/, 'anti-vacuity: the animate plugin left — arbitrary durations may be safe again');
  for (const f of ['app/_components/pill-selector.tsx', 'app/_components/pill-thumb.tsx', `${E}/inspector-kit.tsx`]) assert.doesNotMatch(read(f), /duration-\[/, `${f}: an arbitrary duration is never emitted`);
  for (const [name, cls] of Object.entries({ SP_PHASE, STAGE_TOOL_FACE, STAGE_TOOL_DIVIDER })) {
    assert.ok(has(cls, 'duration-sn-pill'), `${name} does not move at the family's speed`);
    assert.doesNotMatch(cls, /duration-\[/, `${name}: an arbitrary duration is never emitted`);
  }

  // THE PULSE: a dip in scale and back, and one ring that widens and fades — scale and opacity only.
  const frames = (name: string) => new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`).exec(css)?.[1] ?? '';
  assert.match(frames('sn-pill-press'), /0% \{ scale: 1; \}\s*35% \{ scale: 0\.9\d*; \}\s*100% \{ scale: 1; \}/);
  assert.match(frames('sn-pill-ring'), /0% \{ opacity: 0\.\d+; scale: 1; \}\s*100% \{ opacity: 0; scale: [\d. ]+; \}/);
  for (const name of ['sn-pill-press', 'sn-pill-ring']) {
    const props = [...frames(name).matchAll(/([a-z-]+):/g)].map((m) => m[1]);
    assert.ok(props.length >= 3 && props.every((p) => p === 'scale' || p === 'opacity'), `${name} animates ${[...new Set(props)].join(', ')}`);
  }
  assert.match(css, /\.sn-pill-thumb\[data-pulse\] \{\s*animation: sn-pill-press var\(--sn-pill-dur\) var\(--sn-ease\);\s*\}/);
  assert.match(css, /\.sn-pill-thumb\[data-pulse\]::after \{\s*animation: sn-pill-ring calc\(var\(--sn-pill-dur\) \* 1\.3\) ease-out;\s*\}/);
  // The ring is the thumb's own colour and shape — and under "reduce motion" there is no pulse, no ring, no travel.
  assert.match(css, /\.sn-pill-thumb::after \{[^}]*border-radius: inherit;[^}]*background: inherit;[^}]*opacity: 0;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.sn-pill-thumb,\s*\.sn-pill-thumb::after \{\s*animation: none !important;\s*transition: none !important;\s*\}\s*\}/);
  // It pulses on a PICK only (the RUN above): the attribute is the thumb's own, set when the picked choice changed.
  assert.match(src, /const pick = laid && last !== null && last !== on;/);
});

test('(4) ← → (↑ ↓, Home, End) move focus between the choices and wrap; they never pick; every other key is the button’s', () => {
  assert.deepEqual(['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].map(segStep), [1, 1, -1, -1, 'first', 'last']);
  for (const k of ['Enter', ' ', 'Tab', 'a', 'Escape']) assert.equal(segStep(k), null, `${k} was taken from the button`);
  assert.deepEqual([segIndex(0, 1, 3), segIndex(2, 1, 3), segIndex(0, -1, 3), segIndex(1, 'first', 5), segIndex(1, 'last', 5)], [1, 0, 2, 0, 4]);
  // RUN: focus on the first of three, the last disabled.
  const a = choice(3, 80, { 'aria-pressed': 'true' });
  const b = choice(85, 80);
  const c = choice(167, 80, {}, { disabled: true });
  let active: unknown = a;
  const thumb = createPillThumb(fakeTrack([a, b, c]), fakeThumb().el, () => active);
  assert.equal(thumb.key('ArrowRight'), true);
  assert.equal(b.focused, 1, '→ did not move focus to the next choice');
  active = b;
  assert.equal(thumb.key('ArrowRight'), true);
  assert.equal(a.focused, 1, '→ on the last enabled choice does not wrap (or a disabled one took focus)');
  assert.equal(c.focused, 0, 'a disabled choice took focus');
  assert.equal(a.attrs['aria-pressed'], 'true', 'an arrow key picked');
  assert.equal(thumb.key('Enter'), false, 'Enter is the button’s own');
  // Focus is somewhere else on the page: the key is not the selector's.
  active = null;
  assert.equal(thumb.key('ArrowLeft'), false);
  assert.doesNotMatch(read('app/_components/pill-thumb.tsx'), /\.click\(\)/, 'an arrow key picks');
});

test('(5) the four Maker selectors wear the ONE thumb — Stages | Studio, Look’s bar, the tool group, Phases; a row of toggles opts out', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const K = await import(`../${E}/inspector-kit`);
  const html = renderToStaticMarkup(
    React.createElement(K.ISegmented, { label: 'Look' }, [
      React.createElement(K.ISeg, { key: 'a', on: true, data: 'background', onClick: () => {} }, 'Background'),
      React.createElement(K.ISeg, { key: 'b', on: false, data: 'elements', onClick: () => {} }, 'Elements'),
    ]),
  );
  // A named group of pressed-or-not buttons — as it was. No tablist (the lower third's rule).
  assert.match(html, /^<div role="group" aria-label="Look" class="[^"]*\brounded-full\b[^"]*">/);
  assert.match(html, /<button type="button" aria-pressed="true"[^>]*data-seg="background"/);
  assert.match(html, /<button type="button" aria-pressed="false"[^>]*data-seg="elements"/);
  assert.doesNotMatch(html, /role="tab/);
  // The server's paint: the picked choice paints the pill itself, and nothing says a thumb is laid — nothing to jump.
  assert.match(html, /aria-pressed="true"[^>]*class="[^"]*\bbg-accent\b/);
  // …and Look's bar is the SAME terracotta as Stages | Studio — no white selector.
  assert.doesNotMatch(html, /\bbg-white\b|data-seg-tone|data-seg-fill/);
  assert.doesNotMatch(html, /data-seg-thumb=""/);

  const kit = read(`${E}/inspector-kit.tsx`);
  assert.match(kit, /\{slide \? <PillThumb \/> : null\}\s*\{children\}/, 'the thumb is not the first child of the track');
  assert.match(kit, /slide = true,/);
  assert.match(kit, /className=\{`\$\{iSegClass\(on, tone\)\} \$\{className\}`\}/);
  // 1 · Stages | Studio, in its wine. 2 · Look's Background · Elements · Music.
  assert.match(read(`${L}/stages-studio-parts.tsx`), /<ISegmented label="Stages or Studio">\s*\{\(\['stages', 'studio'\] as const\)\.map\(\(k\) => \(\s*<ISeg key=\{k\} tone="wine"/);
  assert.match(read(`${L}/studio-tools.tsx`), /<ISegmented label="Look">\s*\{LOOK_SECTION_ITEM_KEYS\.map\(\(k\) => \(\s*<ISeg /);

  // 3 · PHASES (Look | Background | Arrange · Build in | Action | Build out) — every use: the thumb is in the component.
  for (const c of ['group/seg', 'relative', 'rounded-full', 'h-11', 'w-full']) assert.ok(has(SP_PHASES, c), `Phases’ track lost ${c}`);
  noRect(SP_PHASES, 'Phases’ track');
  // A real 44-px button (the panel's own rule) whose pill is clipped 3 px inside — and the thumb is laid inside the same 3 px.
  for (const c of ['rounded-full', 'relative', 'z-[1]', 'h-11', 'border-[3px]', 'border-transparent', 'bg-clip-padding', 'flex-1', 'duration-sn-pill', 'motion-reduce:transition-none', 'aria-pressed:bg-accent', 'aria-pressed:text-on-accent', 'group-data-[seg-thumb]/seg:aria-pressed:bg-transparent']) {
    assert.ok(has(SP_PHASE, c), `a Phases segment lost ${c}`);
  }
  noRect(SP_PHASE, 'a Phases segment');
  assert.doesNotMatch(SP_PHASE, /aria-pressed:bg-white|aria-pressed:text-\[var\(--sp-ink\)\]/, 'Phases is still the white selector');
  const stageKit = read(`${L}/stage-panel/kit.tsx`);
  assert.match(stageKit, /<div role="group" aria-label=\{label\} className=\{SP_PHASES\} data-stage-phases=\{data\}>\s*(?:\{\s*\}\s*)?<PillThumb \/>\s*\{options\.map\(/, 'Phases does not wear the thumb');
  assert.match(stageKit, /<button key=\{k\} type="button" aria-pressed=\{k === value\} data-stage-phase=\{k\} data-seg-inset=\{SP_PHASE_INSET\} onClick=\{\(\) => onPick\(k\)\} className=\{SP_PHASE\}>/);
  assert.equal(SP_PHASE_INSET, 3);
  assert.ok(has(SP_PHASE, `border-[${SP_PHASE_INSET}px]`), 'the thumb’s inset is not the segment’s own clear margin');
  const phasesUses = [`${L}/stage-panel/stage-style.tsx`, `${L}/stage-panel/stage-animate.tsx`].filter((f) => /<Phases\b/.test(read(f)));
  assert.equal(phasesUses.length, 2, 'anti-vacuity: Phases is used somewhere else now');

  // 4 · THE TOOL GROUP (Style · Text · Animate): the dark face TRAVELS — one thumb, on each tool's 46 × 38 face.
  for (const c of ['group/seg', 'relative', 'rounded-full', 'h-11']) assert.ok(has(STAGE_TOOL_PILL, c), `the tool group’s track lost ${c}`);
  for (const c of ['relative', 'z-[1]', 'h-11', 'w-[46px]']) assert.ok(has(STAGE_TOOL_BUTTON, c), `a tool lost ${c}`);
  for (const c of ['h-[38px]', 'w-[46px]', 'rounded-full', 'duration-sn-pill', 'motion-reduce:transition-none', 'group-aria-pressed:bg-accent', 'group-aria-pressed:text-on-accent', 'group-data-[seg-thumb]/seg:group-aria-pressed:bg-transparent']) {
    assert.ok(has(STAGE_TOOL_FACE, c), `a tool’s face lost ${c}`);
  }
  const tools = read(`${L}/stage-tools.tsx`);
  const group = tools.slice(tools.indexOf('data-stage-tpill=""'), tools.indexOf('data-stage-play=""'));
  assert.match(group, /^data-stage-tpill="">\s*(?:\{\s*\}\s*)?<PillThumb \/>\s*\{MAKER_PART_TOOLS\.map\(\(t, i\) => \(\s*<Fragment key=\{t\}>/, 'the tool group does not wear the thumb, or its tools are not the track’s direct children');
  assert.doesNotMatch(group, /className="contents"/, 'a wrapper hides the tools from the thumb');
  assert.doesNotMatch(group, /data-seg-fill|--sp-ink\)/, 'the tool group still has a colour of its own');
  assert.match(group, /<span data-seg-face="" className=\{STAGE_TOOL_FACE\}>/, 'the thumb fills the whole 44-px button, not the 38-px face');
  // ONE ICON PER TOOL (owner 2026-10-08, the "Bolder" set S5 · T4 · A5): swatch book · A-large-small · orbit — 18 px, stroke 2.
  for (const [tool, icon] of [['style', 'SwatchBook'], ['text', 'ALargeSmall'], ['animate', 'Orbit']] as const) {
    assert.match(group, new RegExp(`<${icon} aria-hidden className="h-\\[18px\\] w-\\[18px\\]" strokeWidth=\\{2\\} />`), `${tool} lost its icon (${icon})`);
  }
  assert.match(group, /t === 'style' \? \(\s*<SwatchBook [^>]*\/>\s*\) : t === 'text' \? \(\s*<ALargeSmall [^>]*\/>\s*\) : \(\s*<Orbit [^>]*\/>/, 'a tool wears another tool’s icon');
  assert.doesNotMatch(group, /<Brush\b|<Diamond\b|<Zap\b|>Aa</, 'an old tool icon is still drawn');
  // The names a screen reader hears are unchanged.
  assert.match(group, /aria-label=\{MAKER_PART_TOOL_LABEL\[t\]\}/);
  // The hairline beside the picked tool fades — the thumb is never cut by a line (as iOS draws it).
  assert.match(group, /\{i > 0 \? <span aria-hidden data-stage-tool-divider="" className=\{STAGE_TOOL_DIVIDER\} \/> : null\}/);
  for (const c of ['has-[+[aria-pressed=true]]:opacity-0', '[[aria-pressed=true]+&]:opacity-0', 'transition-opacity', 'duration-sn-pill', 'motion-reduce:transition-none']) {
    assert.ok(has(STAGE_TOOL_DIVIDER, c), `the hairline lost ${c}`);
  }

  // A row where several may be on at once is not an either-or: no thumb.
  assert.match(read(`${E}/part-inspector.tsx`), /<ISegmented label="Bold, italic, underline" grow=\{false\} slide=\{false\}>/);
  // Every other use takes the default (the thumb) — none restyles the track by hand.
  const uses = [`${E}/scene-background-row.tsx`, `${E}/scene-style-row.tsx`, `${E}/scene-inspector.tsx`, `${E}/element-sheet.tsx`, `${E}/part-inspector.tsx`, 'app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx'];
  let seen = 0;
  for (const f of uses) for (const m of read(f).matchAll(/<ISegmented\b[^>]*>/g)) {
    seen++;
    assert.doesNotMatch(m[0], /className=/, `${f}: ${m[0]} restyles the selector by hand`);
  }
  assert.ok(seen >= 12, `anti-vacuity: only ${seen} selectors read`);
});

test('(6) PillSelector — buttons or links, an icon-only variant, a row of toggles; nothing in it knows any one screen', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const P = await import('../app/_components/pill-selector');
  const paint = (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(P.PillSelector as never, props as never));
  // Buttons: a named group, the picked one pressed and painting its own pill before the thumb arrives.
  const buttons = paint({ label: 'Look', value: 'elements', options: [{ key: 'background', label: 'Background' }, { key: 'elements', label: 'Elements' }, { key: 'music', label: 'Music', disabled: true }], onPick: () => {} });
  assert.match(buttons, /^<div role="group" aria-label="Look" data-pill-selector="" class="[^"]*\brounded-full\b[^"]*\bbg-ink\/\[0\.06\]/);
  assert.equal((buttons.match(/<button /g) ?? []).length, 3);
  assert.match(buttons, /<button type="button" aria-pressed="true"[^>]*class="[^"]*\bbg-accent\b[^"]*"[^>]*data-seg="elements"/);
  assert.match(buttons, /<button type="button" aria-pressed="false" disabled=""[^>]*data-seg="music"/);
  // Links: each view has its own address — the picked one is aria-current, in the wine.
  const links = paint({ label: 'Schedule view', value: 'day', options: [{ key: 'day', label: 'Day', href: '/s?view=day' }, { key: 'prep', label: 'Preparation', href: '/s?view=prep' }] });
  assert.match(links, /<a href="\/s\?view=day" class="[^"]*\bbg-accent\b[^"]*"[^>]*data-seg="day" aria-current="page">Day<\/a>/);
  assert.match(links, /<a href="\/s\?view=prep" class="[^"]*"[^>]*>Preparation<\/a>/);
  assert.doesNotMatch(links, /<button/);
  assert.equal((links.match(/aria-current/g) ?? []).length, 1);
  // Icon-only: fixed faces, each named for a screen reader — in the same one colour.
  const icons = paint({ label: 'Edit with', value: 'style', icon: true, grow: false, options: [{ key: 'style', label: '🖌', ariaLabel: 'Style' }, { key: 'text', label: 'Aa', ariaLabel: 'Text' }] });
  assert.match(icons, /class="[^"]*\bbg-accent\b[^"]*\bw-\[46px\] flex-none px-0"[^>]*data-seg="style" aria-label="Style"/);
  // No caller chooses a colour: the selector takes no tone and no fill.
  assert.doesNotMatch(read('app/_components/pill-selector.tsx'), /\bfill\?:|tone = '|data-seg-fill|data-seg-tone/, 'a pill selector can be recoloured per use');
  assert.match(icons, /class="[^"]*\binline-flex\b[^"]*"/);
  // The caller's own ground replaces the house one.
  assert.doesNotMatch(paint({ label: 'x', value: null, className: 'bg-white ring-1', options: [{ key: 'a', label: 'A' }] }), /bg-ink\/\[0\.06\]/);
  // A row of toggles: several pressed — and no thumb is even mounted.
  const src = read('app/_components/pill-selector.tsx');
  assert.match(src, /\{slide && !several \? <PillThumb \/> : null\}/);
  const toggles = paint({ label: 'Bold, italic', value: ['b', 'i'], options: [{ key: 'b', label: 'B' }, { key: 'i', label: 'I' }, { key: 'u', label: 'U' }] });
  assert.equal((toggles.match(/aria-pressed="true"/g) ?? []).length, 2);
  // The app's, not one screen's: React, next/dynamic and its own thumb — no Maker file, no Maker token.
  const imports = (f: string) => [...read(f).matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(imports('app/_components/pill-selector.tsx').sort(), ['next/dynamic', 'react']);
  assert.deepEqual(imports('app/_components/pill-thumb.tsx'), ['react']);
  for (const f of ['app/_components/pill-selector.tsx', 'app/_components/pill-thumb.tsx']) assert.doesNotMatch(read(f), /--sp-|\/dashboard\/|maker/i, `${f} knows the Maker`);
  // It says when NOT to use it, in the house rule's own words.
  const doc = raw('app/_components/pill-selector.tsx');
  assert.match(doc, /never used to pick a value \(values are dropdowns\)/);
  assert.match(doc, /PickMenu/);
  assert.match(doc, /an on \/ off → a switch/);
});

test('(7) the thumb’s measuring code is not in the Maker’s first load — it arrives after first paint', () => {
  const sel = raw('app/_components/pill-selector.tsx');
  assert.match(sel, /export const PillThumb = dynamic\(\(\) => import\('\.\/pill-thumb'\)\.then\(\(m\) => m\.PillThumb\), \{ ssr: false \}\);/);
  for (const f of ['app/_components/pill-selector.tsx', `${E}/inspector-kit.tsx`]) {
    assert.doesNotMatch(read(f), /import \{[^}]*\} from '[^']*pill-thumb'/, `${f} imports the thumb statically`);
    assert.doesNotMatch(read(f), /useLayoutEffect|ResizeObserver|MutationObserver/, `${f} measures`);
  }
});

/* ── (8) the watch: one source per kind of control ───────────────────────── */

/**
 * WHERE THE WATCH LOOKS. One area per line; a builder who migrates another area to the template ADDS its folder
 * here in the same PR (owner 2026-10-08: *"so when we decide to pill selector, it willuse our tempalte"*). Never the
 * whole repo — another branch's screen must not go red because of a rule it has not been migrated to.
 */
const PILL_WATCH_SCOPE: readonly string[] = [
  'app/dashboard/[eventId]/launch/_components', // the Maker's shell, Studio and Stages
  'app/dashboard/[eventId]/website/editor/_components', // the Maker's work area and inspectors
  'app/dashboard', // AREA 1 (2026-10-08, rd/pills-everywhere): the couple's whole dashboard — its converted selectors are held one by one in pills-are-everywhere.test.ts
  'app/_components', // AREA 1: the shared pieces (a thread's views, the two-sided workspace tabs)
  'app/vendor-dashboard', // AREA 2: the supplier's dashboard
  'app/onboarding', // AREA 3: onboarding
  'app/signup', // AREA 3: sign-up
  'app/login', // AREA 3: sign-in
  'app/(shell)', // AREA 3: the public pages (home, explore, pricing, help)
  'app/for-suppliers', // AREA 3
  'app/realstories', // AREA 3
  'app/v', // AREA 3: a supplier's public shop
  'app/admin', // AREA 4: admin (selector shape only)
];
/** The files that ARE the template's drawers — they hold the track on purpose. */
const PILL_TEMPLATE_DRAWERS: readonly string[] = [`${E}/inspector-kit.tsx`, `${L}/stage-panel/kit.tsx`];
/**
 * Hand-drawn tracks that were there BEFORE the template (2026-10-08) and are not migrated yet — each named by the
 * words on its track, with why it is still by hand. Converting one removes its line; a NEW one is never added here.
 */
const PILL_WATCH_BASELINE: readonly { file: string; has: string; why: string }[] = [
  { file: `${L}/maker-logo.tsx`, has: 'aria-label="Logo panels"', why: 'the Logo studio’s Layers · Logo · Tools tabs (a tablist with panels) — the selector audit’s lane, not converted in the commit that made the template' },
  { file: `${E}/editor-shell.tsx`, has: 'aria-label="What opens your Save the Date"', why: 'the shipped Maker’s Save the Date opener (two values — a toggle by the house rule) — the selector audit’s lane' },
  // ── Already there when AREA 1 widened the scope to the couple's dashboard (2026-10-08). Each picks one of THREE
  //    VALUES, which the house rule makes a dropdown, not a pill selector (INTERACTION_RULES § 2) — so it was LISTED
  //    for the controller's decision instead of being converted. Deciding one removes its line.
  { file: 'app/dashboard/[eventId]/studio/save-the-date/_components/StdBuilderClient.tsx', has: 'inline-flex rounded-xl border border-ink/15 bg-cream p-1', why: 'LISTED: Save the Date › Readability picks one of 3 values (Auto · Lighten · Darken) — a dropdown by the house rule; the controller’s decision' },
  { file: 'app/dashboard/[eventId]/schedule/_components/prep-kind-picker.tsx', has: 'aria-label="Item type"', why: 'LISTED: a preparation item’s Type picks one of 3 values (a radio group) — a dropdown by the house rule; the controller’s decision' },
  { file: 'app/dashboard/[eventId]/guests/_components/chip-editors.tsx', has: 'flex items-center gap-1 rounded-lg bg-ink/[0.04] p-0.5', why: 'NOT A SELECTOR ROW: an either-or pair of roles INSIDE the role menu (menuitemradio, “or” between them) — a menu’s own items, left as the menu draws them' },
];

/**
 * A SEGMENTED TRACK DRAWN BY HAND: an element that is a rounded, padded, grounded box (the track) whose content,
 * just after it, is choices that say which one is picked (`aria-pressed|selected|checked={…}`).
 */
function handDrawnTracks(source: string): string[] {
  const hits: string[] = [];
  for (const m of source.matchAll(/<(?:div|span|nav|ul)\b[^>]*className=(?:"[^"]*"|\{`[^`]*`\})[^>]*>/g)) {
    const tag = m[0];
    if (!/(?:^|[\s"`])rounded-(?:md|lg|xl|2xl|full|\[)/.test(tag)) continue;
    if (!/(?:^|[\s"`])p-(?:0\.5|1|\[\dpx\])/.test(tag)) continue;
    if (!/(?:^|[\s"`])bg-(?:ink\/|white\/|cream|\[rgba)/.test(tag)) continue;
    if (!/aria-(?:pressed|selected|checked)=\{/.test(source.slice(m.index!, m.index! + 900))) continue;
    hits.push(tag.replace(/\s+/g, ' ').slice(0, 200));
  }
  return hits;
}

test('(8) THE WATCH — in the Maker and every area since migrated, a segmented track is drawn through the template, never by hand', () => {
  const walk = (dir: string): string[] =>
    readdirSync(join(WEB, dir)).flatMap((name) => {
      const rel = `${dir}/${name}`;
      return statSync(join(WEB, rel)).isDirectory() ? walk(rel) : /\.tsx$/.test(name) && !/\.test\./.test(name) ? [rel] : [];
    });
  const files = PILL_WATCH_SCOPE.flatMap(walk);
  assert.ok(files.length >= 100, `anti-vacuity: only ${files.length} files were read`);
  const strays: string[] = [];
  const stillThere = new Set<string>();
  for (const f of files) {
    if (PILL_TEMPLATE_DRAWERS.includes(f)) continue;
    for (const tag of handDrawnTracks(read(f))) {
      const known = PILL_WATCH_BASELINE.find((b) => b.file === f && tag.includes(b.has));
      if (known) stillThere.add(`${known.file}|${known.has}`);
      else strays.push(`${f}: ${tag}`);
    }
  }
  assert.deepEqual(
    strays,
    [],
    `a segmented selector is drawn by hand — draw it with <PillSelector> or <ISegmented> (app/_components/pill-selector.tsx):\n  ${strays.join('\n  ')}`,
  );
  // A baseline line whose track is gone (converted, or deleted) must be removed — the list only shrinks.
  for (const b of PILL_WATCH_BASELINE) assert.ok(stillThere.has(`${b.file}|${b.has}`), `${b.file} no longer draws “${b.has}” by hand — remove its line from PILL_WATCH_BASELINE`);
  // The scan SEES a hand-drawn track (the shape this rule replaced), and does not accuse the template's own.
  assert.equal(handDrawnTracks('<div role="group" className="flex rounded-lg bg-ink/[0.06] p-0.5">{xs.map((x) => <button aria-pressed={x.on} />)}</div>').length, 1, 'the watch is blind');
  assert.equal(handDrawnTracks('<ISegmented label="Look">{xs.map((x) => <ISeg on={x.on} />)}</ISegmented>').length, 0);
  assert.equal(handDrawnTracks('<div className="rounded-lg bg-white/70 p-1"><p>Just a box</p></div>').length, 0, 'the watch accuses a plain box');
});
