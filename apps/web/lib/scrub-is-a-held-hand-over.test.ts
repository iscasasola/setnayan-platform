/**
 * scrub-is-a-held-hand-over.test.ts — SCRUB ON THE GUEST PAGE (owner 2026-10-09, approved on the prototype
 * `review/scrub-prototype.html`: *"centered and at the line both looks good"* → Centred · *"them must be on the same
 * position to create that keynote like transistion"* · *"let it enter on the last 20% of the build out"* · *"it
 * entered when the previous element is not yet done"* · *"it never completed the schedule"* · *"if no build out, then
 * animation will be under it"* · *"element run completely normal. we only control the effect"*).
 *
 * 🧪 THE BEHAVIOUR ITSELF IS PLAYED IN A BROWSER, not here: `scripts/scrub-browser-check.mjs` runs the real renderer,
 * stylesheet and engine in Chromium at the five window sizes the owner tried (890 × 1548 · 940 × 1608 · 1280 × 770 ·
 * 375 × 812 · 375 × 667) against his seven pictures — back == down, no overlap outside a pair, never two readable at
 * once, every row complete in order before a list leaves, nothing of the scene before once the rows begin, every
 * hand-over finished before the page ends, the page standing still while one plays, the plain page with no script and
 * with reduce motion — and that the script never sets the scroll position or prevents a default. It needs a browser,
 * so it is run by hand. THIS file holds, in the unit suite, what makes that true and can be executed without one:
 *
 *   (1) THE TIMING, EXECUTED — the Build out over 55 % of a screen; the arrival begins when it is 80 % done and not a
 *       pixel sooner; a list's rows may begin only once the leaving one has completely gone; the hold is long enough
 *       for all of it. Sabotage: the arrival entering with the Build out → red.
 *   (2) THE PLACE, EXECUTED over every pairing of heights and window sizes — a list is scrolled through at ANY window
 *       height (the tall-window fault); the arrival never reaches above the leaving one's frame and never ends above
 *       the centre line (so nothing after it can reach the centre first); what follows starts under the lower of the
 *       two. Sabotage: "long" decided by the window's height → red.
 *   (3) ROWS, EXECUTED — in order, never before the gate, and every one complete by the time its list's bottom is on
 *       the centre line. Sabotage: the last row keeping the full span → red.
 *   (4) THE ENGINE MAY ONLY MEASURE AND SET — it never sets a scroll position, prevents a default, listens to wheel /
 *       touch, or writes a style that is not a custom property; it disarms on any throw and never arms under reduce
 *       motion. Sabotage: one `scrollTo` → red.
 *   (5) FAIL-VISIBLE — the island draws nothing and fetches the engine after hydration; the renderer mounts it only
 *       for a page with a Scrub scene; every rule needs the engine's mark; the hold is page LENGTH inside the cell's
 *       content box (`::after`, never padding — a sticky box cannot move into padding) and no transform is put on a
 *       box that holds scenes. Sabotage: the hold as padding → red.
 *   (6) THE MAKER'S FIRST LOAD IS NOT TOUCHED — none of it is imported by a Maker first-load file.
 *   (7) DURING A HOLD THE PAGE STANDS STILL (owner, his first sentence about Scrub: "the page will not scroll";
 *       2026-10-09 on the first build: "as a guest nothing scrubbed" — the scene above a held one went on scrolling
 *       at thumb speed, which reads as ordinary scrolling). Rendered: the ordinary scenes before a hand-over are
 *       INSIDE its stage, the leaving scene is the one right before the stage's rest-of-the-page, and what follows
 *       an arrival is one box. The engine sticks the stage above its scene's line by exactly what it holds before
 *       the scene, and reads layout without the hold and without the rises. Played in a browser at the five sizes
 *       ("what a guest can see above a held scene stands still too"). Sabotage: the scenes before a hand-over left
 *       outside its stage → red (and red in the browser).
 *   (8) THE WHOLE PAGE STANDS STILL — THE PAGE'S OWN HOLD. A hand-over's cell can only hold its scenes block; the
 *       cover and whatever else a page draws went on scrolling. A page wraps its whole column in one plain pair a
 *       hand-over (`HubPageHold`), and the engine gives hand-over k the k-th pair from the outside. Executed: no
 *       hand-over → NOTHING is wrapped (every page today is byte-identical); N → N nested pairs; the count a page
 *       asks for is never less than what its scenes draw. Both trees of the guest page wrap their article. Played
 *       in a browser at the six sizes ("the page before the scenes stands still during a hold"), and under
 *       `html { overflow-x: clip }`. Sabotage: the engine holding only the block → red here and in the browser.
 *   (9) THE TOP OF THE ROOM IS ONE NUMBER, THE STYLESHEET'S (2026-10-09: the engine kept its own — 76 px, or 9 % —
 *       while the stylesheet's line under the invitation's pinned bar is 100 px, so a long arrival began 24 px above
 *       the line, its first words under the progress mark). `--hub-pin` is declared once for a page with the bar and
 *       once for a page without, in the PLAIN BASE (Scrub also runs where the scroll-timeline gates do not); the
 *       armed scenes block carries it as a length and the engine reads that back — it has no number of its own, and
 *       does not play a page that does not say its line. Played in a browser under a pinned bar at three phone
 *       sizes and a desktop one ("a long arrival under the pinned top bar"). Sabotage: the engine's own number
 *       back → red here and in the browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SCRUB, scrubLens, scrubMoment, scrubNeedsRest, scrubOwnIn, scrubPair, scrubRow, scrubThrough } from '../app/[slug]/_components/hub-scrub-math';
import { HubPageHold, HubScenes, hubScrubHolds, hubScrubHoldsAtMost } from '../app/[slug]/_components/hub-scenes';
import { HUB_PAGE_HOLD_CLASSES } from '../app/[slug]/_components/hub-scrub-math';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const B = 'app/[slug]/_components';
const read = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));
const CSS = read('app/globals.css');
const SIZES = [1548, 1608, 770, 812, 667, 882, 384];
const view = (V: number) => {
  const topLine = Math.max(76, V * 0.09);
  return { centre: V / 2, topLine, room: V - topLine - 24, lens: scrubLens(V) };
};

test('(1) the timing: the arrival begins when the Build out is 80 % done; a list’s rows only once the leaving one has gone', () => {
  assert.deepEqual([SCRUB.out, SCRUB.enter, SCRUB.in, SCRUB.rest], [0.55, 0.8, 0.22, 0.3], 'the owner’s numbers');
  for (const V of SIZES) {
    const lens = scrubLens(V);
    const pair = scrubPair({ h: 180, oneByOne: false }, { h: 700, oneByOne: true }, view(V));
    assert.ok(pair.len >= lens.out && pair.len >= lens.enter + lens.in && pair.len >= lens.out + lens.in / 2, `${V}: the hold is too short for the hand-over`);
    let last = { out: -1, in: -1, rows: -1 };
    for (let t = 0; t <= pair.len; t += 1) {
      const m = scrubMoment(t, pair, lens);
      /* THE ORDER: nothing of the arrival until the Build out is at its last fifth; no row until it has finished. */
      if (m.in > 0) assert.ok(m.out >= SCRUB.enter - 0.005, `${V} @${t}: the arrival is in (${m.in}) with the Build out at ${m.out}`);
      if (m.rows > 0) assert.equal(m.out, 1, `${V} @${t}: a row may begin with the leaving one at ${m.out}`);
      if (m.rows > 0) assert.ok(m.in >= 0.5 - 0.005, `${V} @${t}: a row before its heading`);
      /* Under the thumb: nothing ever runs backwards as the page goes forward (so back == down). */
      assert.ok(m.out >= last.out && m.in >= last.in && m.rows >= last.rows);
      last = m;
    }
    assert.deepEqual(scrubMoment(pair.len, pair, lens), { out: 1, in: 1, rows: 1, below: 0 }, `${V}: the hand-over does not finish inside its hold`);
    assert.deepEqual(scrubMoment(0, pair, lens), { out: 0, in: 0, rows: 0, below: 1 });
    /* A rest first: nothing moves until it has passed. */
    assert.deepEqual(scrubMoment(lens.rest, pair, lens, lens.rest), { out: 0, in: 0, rows: 0, below: 1 });
    assert.ok(scrubMoment(lens.rest + lens.out, pair, lens, lens.rest).out === 1);
  }
});

test('(2) the place: a list is scrolled through at any window height; the arrival is inside the frame and never ends above the centre line', () => {
  let n = 0;
  for (const V of SIZES) {
    const v = view(V);
    for (const hA of [60, 120, 180, 320, 520, 760, 1200, 2400]) {
      for (const hB of [60, 120, 180, 320, 520, 760, 1200, 2400]) {
        for (const listA of [false, true]) {
          for (const listB of [false, true]) {
            const A = { h: hA, oneByOne: listA };
            const Bv = { h: hB, oneByOne: listB };
            const p = scrubPair(A, Bv, v);
            const bottom = p.top + hA;
            /* HELD — a list, and anything taller than the room: bottom on the centre line. Else centred. */
            if (listA || hA > v.room) assert.equal(bottom, v.centre, `V${V} A${hA}: scrolled through, it hands over at bottom-at-centre`);
            else assert.equal(p.top + hA / 2, v.centre, `V${V} A${hA}: a short element is held centred`);
            /* 🧨 THE TALL-WINDOW FAULT: a list that "fits" the window is STILL scrolled through. */
            if (listA) assert.equal(scrubThrough(A, v.room), true);
            /* THE ARRIVAL — never above the leaving one's top (nothing before the pair is covered) … */
            assert.ok(p.arrivalTop >= p.top - 1e-6, `V${V} A${hA} B${hB}: the arrival reaches above the leaving element`);
            assert.ok(p.up <= 0 && p.up >= -hA - 1e-6, 'the arrival is drawn over the leaving element, not past it');
            /* … and never ending above the centre line: what follows it has not reached the centre yet. */
            assert.ok(p.arrivalTop + hB >= v.centre - 1e-6, `V${V} A${hA} B${hB} list ${listA}/${listB}: the arrival ends above the centre line — what follows could enter first`);
            /* WHAT FOLLOWS starts under the LOWER of the two, and rises to the arrival. */
            assert.equal(p.rise, Math.max(0, bottom - (p.arrivalTop + hB)));
            assert.ok(p.arrivalTop + hB + p.rise >= bottom - 1e-6);
            /* A long arrival: tops together (its rows then build as the page goes on). */
            if (!listA && hA <= v.room && hB > hA) assert.equal(p.arrivalTop, p.top, 'a taller arrival is not top to top');
            if (!listA && hA <= v.room && hB <= hA && !listB) assert.equal(p.arrivalTop + hB / 2, v.centre, 'a shorter arrival is not centre to centre');
            n++;
          }
        }
      }
    }
  }
  assert.equal(n, SIZES.length * 8 * 8 * 4);
  /* Back to back: an arrival already where IT is held gets a rest before its own hand-over. */
  const v = view(812);
  const p = scrubPair({ h: 180, oneByOne: false }, { h: 160, oneByOne: false }, v);
  assert.equal(scrubNeedsRest(p.arrivalTop, { h: 160, oneByOne: false }, v), true);
  const long = scrubPair({ h: 180, oneByOne: false }, { h: 900, oneByOne: true }, v);
  assert.equal(scrubNeedsRest(long.arrivalTop, { h: 900, oneByOne: true }, v), false, 'a list has to be scrolled through first');
});

test('(3) rows: in order, never before their turn, and every one complete by the time the list’s bottom is on the centre line', () => {
  const C = 400;
  /* A list of 8 rows, 64 px apart, the last one 70 px above the list's bottom; scrolled from below to bottom-at-centre. */
  const rows = Array.from({ length: 8 }, (_, i) => 100 + i * 64);
  const height = rows[7]! + 70;
  for (let top = 900; top >= C - height; top -= 1) {
    const p = rows.map((y) => scrubRow(top + y, C, 1, height - y));
    for (let i = 1; i < p.length; i++) assert.ok(p[i]! <= p[i - 1]! + 1e-9, `row ${i + 1} is ahead of row ${i}`);
    if (top === C - height) assert.deepEqual(p, [1, 1, 1, 1, 1, 1, 1, 1], 'the list’s bottom is on the centre line and a row is not complete');
  }
  /* The gate: no row before its turn, however far past the line it is. */
  assert.equal(scrubRow(0, C, 0, 500), 0);
  assert.equal(scrubRow(0, C, 0.4, 500), 0.4);
  /* An element nobody hands over to: its Build in runs from its top reaching the centre line. */
  assert.equal(scrubOwnIn(C + 1, C, 100), 0);
  assert.equal(scrubOwnIn(C - 50, C, 100), 0.5);
  assert.equal(scrubOwnIn(C - 500, C, 100), 1);
});

test('(4) the engine may only measure and set: no scroll position, no prevented default, no wheel / touch listener, no style but a custom property', () => {
  const src = read(`${B}/hub-scrub-engine.ts`);
  assert.doesNotMatch(src, /\bscrollTo\b|\bscrollBy\b|scrollIntoView|scrollTop\s*=|scrollLeft\s*=|\.scroll\(/, 'the engine sets a scroll position');
  assert.doesNotMatch(src, /preventDefault|stopPropagation/, 'the engine takes an event away from the browser');
  const listens = [...src.matchAll(/addEventListener\('(\w+)', \w+(?:, ([^)]*))?\)/g)].map((m) => `${m[1]}${m[2] ? ` ${m[2]}` : ''}`);
  assert.deepEqual(listens.sort(), ['load true', 'orientationchange', 'resize', 'scroll { passive: true }'], 'the engine listens to more than the scroll (passively), the screen changing and pictures loading');
  /* Every write: a custom property (`--…`) or a `data-hub-…` mark, through the one `put`. */
  const styleWrites = [...src.matchAll(/\.style\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(styleWrites)].sort(), ['removeProperty', 'setProperty']);
  assert.doesNotMatch(src, /\.style\.\w+\s*=|classList\.(?:add|remove|toggle)|innerHTML|appendChild|insertBefore/, 'the engine changes the page beyond properties and marks');
  const puts = [...src.matchAll(/put\(\w+(?:\.\w+)?, '([^']+)'/g)].map((m) => m[1]!);
  assert.ok(puts.length >= 10, 'anti-vacuity: the engine’s writes were found');
  for (const key of puts) assert.match(key, /^(?:--hub-[a-z]+|data-hub-[a-z-]+)$/, `the engine writes ${key}`);
  /* A name the engine writes is the engine's ALONE (the cleanup, 2026-10-09: its Build-in number was `--hub-pin`,
     which the stylesheet also declares — a LENGTH, the pin line an Auto run sizes itself by. Nothing read both inside
     one scene, so nothing broke; one rule reading the line inside a Scrub scene would have got a number). */
  for (const key of puts.filter((k) => k.startsWith('--'))) assert.doesNotMatch(CSS, new RegExp(`${key}\\s*:`), `the stylesheet declares ${key} — the engine’s number would mean two things`);
  /* Reduce motion: it returns before anything; any throw: it disarms and takes every mark off. */
  /* 🔁 RE-AIMED 2026-10-09 (8d — the page says WHY it is off, `the-lab-plays-the-scrub-chain` (5)): under reduce
     motion it still returns before it measures or listens — having said so on the scenes block; and a throw still
     disarms (`fail` = `stop`, then the reason), through every `catch`. */
  assert.match(src, /if \(window\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\.matches\) \{\s*say\('reduce motion'\);\s*return \(\) => say\(null\);\s*\}/);
  assert.ok(src.indexOf("say('reduce motion')") < src.indexOf('const marked = ') && src.indexOf("say('reduce motion')") < src.indexOf('const pages'), 'under reduce motion the engine goes on to measure');
  assert.equal((src.match(/catch \(e\) \{\s*fail\(e\);\s*\}/g) ?? []).length, 3, 'a throw in the engine leaves the page half-armed');
  assert.match(src, /function fail\(e: unknown\) \{\s*stop\(\);/);
  /* The reason is the ONE thing it writes outside `put` — a `data-hub-…` mark like the rest. */
  assert.deepEqual([...new Set([...src.matchAll(/\.(?:set|remove)Attribute\((\w+)/g)].map((m) => m[1]))].sort(), ['HUB_SCRUB_OFF', 'key']);
  /* 🪤 A length is never left unset while armed (it would INHERIT: a cell in a stage in a cell) — `null` is for the
     mark, the page's end and disarming only. Measured: four inner cells each drew the page pair's hold. */
  assert.deepEqual([...src.matchAll(/put\([\w.]+, '(--hub-[a-z]+)', null\)/g)].map((m) => m[1]), ['--hub-end']);
  assert.match(src, /for \(const \[el, keys\] of marked\) for \(const key of keys\.keys\(\)\) key\.startsWith\('--'\) \? el\.style\.removeProperty\(key\) : el\.removeAttribute\(key\);/);
  /* It reads the browser's own sticky back (a rect), never a position of its own. */
  /* (2026-10-09, "the page stands still": against where the STAGE stands — `stick`, see (7) — not the scene's own line.) */
  assert.match(src, /h\.stick - h\.cell\.getBoundingClientRect\(\)\.top/);
});

test('(5) fail-visible: the island draws nothing and loads the engine late; every rule needs the engine’s mark; the hold is length, not a transform', () => {
  const island = read(`${B}/hub-scrub.tsx`);
  assert.match(island, /return null;/);
  assert.doesNotMatch(island, /return\s*\(?\s*<|<(?:span|div|i|template)\b/, 'the island draws an element');
  /* Re-aimed 2026-10-09 (the lab commit): the engine is now fetched beside the Maker-only place-keeping
     (`Promise.all([import('./hub-scrub-engine'), …])`) — still inside the effect, still its own chunk. */
  assert.match(island, /useEffect\(\(\) => \{[\s\S]*void Promise\.all\(\[import\('\.\/hub-scrub-engine'\)/, 'the engine is not fetched after the page is interactive');
  assert.doesNotMatch(island, /^import .*hub-scrub-engine/m, 'the engine is in the page’s own bundle');
  const scenes = read(`${B}/hub-scenes.tsx`);
  assert.match(scenes, /const scrubbed = widgets\.some\(\(w\) => motionOf\.get\(w\)!\.transition === 'scrub'\);/);
  assert.match(scenes, /\{scrubbed \? <HubScrub \/> : null\}/);
  assert.doesNotMatch(scenes, /hub-scrub-engine/, 'the renderer pulls the engine into every page');
  /* THE STYLESHEET — one block, at the end, behind `screen` + "no reduced motion"; every rule needs the mark. */
  const at = CSS.lastIndexOf('@media screen and (prefers-reduced-motion: no-preference) {');
  const block = CSS.slice(at);
  assert.ok(at > 0 && CSS.indexOf('[data-hub-scrub-on]') > at, 'the engine’s mark is used outside the Scrub block');
  const rules = [...block.slice(block.indexOf('{') + 1).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1]!.trim().replace(/\s+/g, ' '), body: m[2]!.replace(/\s+/g, ' ').trim() }));
  assert.ok(rules.length >= 10);
  for (const r of rules) for (const s of r.sel.split(',')) assert.ok(/^\.hub-scenes\[data-hub-scrub-on\]|^\.hub-page-cell\[data-hub-page-on\]/.test(s.trim()), `a Scrub rule applies without the engine: ${s.trim()}`);
  const of = (sel: string) => rules.find((r) => r.sel === sel)?.body ?? '';
  /* THE HOLD — the stage is the browser's own sticky; its length is INSIDE the cell's content box. */
  assert.equal(of('.hub-scenes[data-hub-scrub-on] .hub-stage'), 'position: sticky; top: var(--hub-top, 0px);');
  assert.equal(of('.hub-scenes[data-hub-scrub-on] .hub-cell::after'), "content: ''; display: block; height: var(--hub-len, 0px);");
  assert.equal(of('.hub-scenes[data-hub-scrub-on] .hub-cell'), '', 'the hold is padding — a sticky box cannot move into its parent’s padding, and never holds');
  /* THE SAME PLACE — a margin, in the flow. */
  assert.equal(of('.hub-scenes[data-hub-scrub-on] .hub-scene + .hub-after'), 'margin-top: var(--hub-up, 1rem);');
  /* NO TRANSFORM on anything that holds scenes (it would capture a scene's `position: fixed` sheets). */
  for (const r of rules) if (!/hub-canvas-body/.test(r.sel)) assert.doesNotMatch(r.body, /transform|translate|will-change/, `${r.sel} is transformed`);
  /* Not there until its turn, and gone after it. */
  assert.equal(of('.hub-scenes[data-hub-scrub-on] .hub-scene[data-hub-fx][data-hub-away]'), 'visibility: hidden;');
});

test('(6) the Maker’s first load is not touched, and the check in a browser is the five sizes and the owner’s pane', () => {
  const L = 'app/dashboard/[eventId]/launch/_components';
  for (const f of [`${L}/maker-shell.tsx`, `${L}/details-workspace.tsx`, 'lib/hub-draft.ts', 'lib/hub-canvas.ts', 'lib/hub-scenes.ts']) {
    assert.doesNotMatch(readFileSync(join(WEB, f), 'utf8'), /hub-scrub-(?:engine|math)|\/hub-scrub'|data-hub-fx|hub-cell|hub-stage/, `${f} knows about the guest page’s Scrub`);
  }
  const check = join(WEB, 'scripts', 'scrub-browser-check.mjs');
  assert.ok(existsSync(check));
  assert.match(readFileSync(check, 'utf8'), /const SIZES = \[\[890, 1548\], \[940, 1608\], \[1280, 770\], \[375, 812\], \[375, 667\], \[441, 882\]\];/);
});

test('(7) during a hold the page stands still: the scenes before a hand-over are inside its stage, and the stage sticks above its scene’s line by what it holds', () => {
  const draw = (plan: string) => {
    /* One letter a scene: UPPER = Leaves by Scrub with a Build out (it hands over), lower = an ordinary scene. */
    const widgets = [...plan].map((c, i) => ({ widget_id: `w${i}`, widget_type: 'custom_1', config_json: c === c.toUpperCase() ? { canvas: { transition: 'scrub' } } : null }));
    /* 🌑 Through the lab's door: "Scrub out" ships dark (`lib/scrub-out-offered.ts`); this is the renderer WHEN it is drawn. */
    const Scenes = HubScenes as unknown as React.FC<{ widgets: unknown; scrubAllowed: boolean; scrubOut: boolean }>;
    const html = renderToStaticMarkup(React.createElement(Scenes, { widgets, scrubAllowed: true, scrubOut: true }, ...[...plan].map((c, i) => React.createElement('section', { key: i }, c))));
    /* The shape, as nested brackets: [ a stage … ] · ( the rest of the page … ) · { one box of what follows … } */
    return html
      .slice(html.indexOf('</div>', html.indexOf('hub-prog')) + 6)
      .replace(/<div class="hub-cell"><div class="hub-stage">/g, '[')
      .replace(/<div class="hub-after">/g, '(')
      .replace(/<div class="hub-below">/g, '{')
      .replace(/<div class="hub-scene hub-scroll"[^>]*><section>(\w)<\/section><\/div>/g, '$1');
  };
  const letters = (s: string) => s.replace(/<\/div>/g, '').replace(/[^\w[({]/g, '');
  /* A hand-over with nothing before it: the scene, then the rest of the page (as it was). */
  assert.equal(letters(draw('Ab')), '[A(b');
  /* Ordinary scenes BEFORE a hand-over are in its stage: the first, then ONE box with the others, the scene and the rest. */
  assert.equal(letters(draw('abCd')), '[a{bC(d');
  assert.equal(letters(draw('aBc')), '[a{B(c');
  /* Between two hand-overs: the scene that arrives from the first opens the second's stage — it stands still for both. */
  assert.equal(letters(draw('AbCd')), '[A([b{C(d');
  assert.equal(letters(draw('ABc')), '[A([B(c');
  /* What follows a plain arrival is one box; nothing after the last hand-over is held by anything but it. */
  assert.equal(letters(draw('Abcd')), '[A(b{cd');
  /* The page order never changes, and the leaving scene is ALWAYS the one right before its rest-of-the-page. */
  for (const plan of ['abCd', 'AbCdEf', 'aBcDe', 'ABCd', 'abCD']) {
    const shape = letters(draw(plan));
    assert.equal(shape.replace(/[[({]/g, ''), plan, `${plan}: the page order changed`);
    assert.deepEqual([...shape.matchAll(/(\w)\(/g)].map((m) => m[1]), [...plan.slice(0, -1)].filter((c) => c === c.toUpperCase()), `${plan}: a scene that hands over is not the one before its rest-of-the-page`);
  }
  /* The page's last scene has nothing to hand over to, whatever it is set to. */
  assert.equal(letters(draw('abCD')), '[a{bC(D');
  assert.doesNotMatch(draw('abcD'), /hub-cell|\[/);
  /* THE ENGINE — finds the pair by that shape, and sticks the stage where the SCENE is on its line. */
  const engine = read(`${B}/hub-scrub-engine.ts`);
  assert.match(engine, /const after = stage\?\.querySelector<HTMLElement>\(':scope > \.hub-after, :scope > \.hub-below > \.hub-after'\) \?\? null;\s*const scene = after\?\.previousElementSibling as HTMLElement \| null;/);
  assert.match(engine, /const stick = pair\.top - \(docTop\(scene\) - docTop\(hold\.stage\)\);\s*put\(hold\.stage, '--hub-top', px\(stick\)\);/);
  assert.match(engine, /const next = arrival\?\.nextElementSibling \?\? null;\s*const below = next\?\.matches\('\.hub-below, \.hub-after'\) \? \(next as HTMLElement\) : null;/);
  /* …the arrival is put in its place whatever lies between it and the top of the rest of the page… */
  assert.match(engine, /put\(after, '--hub-up', arrival \? px\(pair\.up - \(docTop\(arrival\) - docTop\(after\)\)\) : '1rem'\);/);
  /* …and layout is read without the hold (a standing stage reports where it stands) and without the rises. */
  assert.match(engine, /y \+= \(n\.matches\('\.hub-stage, \.hub-page-stage'\) \? \(n\.parentElement as HTMLElement\) : n\)\.offsetTop;/);
  assert.match(engine, /for \(const h of was\) if \(h\.below\) put\(h\.below, '--hub-rise', '0px'\);/);
  /* THE STYLESHEET — the new boxes are plain blocks with the page's rhythm until the engine arms. */
  assert.match(CSS, /\.hub-stage > \.hub-after,\s*\.hub-stage > \.hub-below,\s*\.hub-after > \.hub-below,\s*\.hub-below > \* \+ \* \{ margin-top: 1rem; \}/);
});

test('(8) the whole page stands still: a page wraps its column in one pair a hand-over, and the engine holds THAT', () => {
  const row = (canvas: Record<string, unknown> | null, i: number) => ({ widget_id: `w${i}`, widget_type: 'custom_1', config_json: canvas ? { canvas } : null });
  const SCRUB = { transition: 'scrub' };
  const STAYS = { transition: 'scrub', out: 'none' };
  const page = (holds: number) => renderToStaticMarkup(React.createElement(HubPageHold, { holds }, React.createElement('article', null, 'the page')));
  /* No hand-over: nothing is wrapped — the page is exactly the page (every page today). */
  assert.equal(page(0), '<article>the page</article>');
  /* N hand-overs: N plain pairs, nested, the page inside the innermost. */
  assert.equal(page(2), '<div class="hub-page-cell"><div class="hub-page-stage"><div class="hub-page-cell"><div class="hub-page-stage"><article>the page</article></div></div></div></div>');
  for (const c of HUB_PAGE_HOLD_CLASSES) assert.ok(page(1).includes(`class="${c}"`), `${c} is not emitted`);
  /* The count: what the scenes DRAW, and what a page may ask for at most — never fewer than drawn. */
  const plans: Array<Array<Record<string, unknown> | null>> = [[SCRUB, null, SCRUB, null], [SCRUB, SCRUB, SCRUB], [null, null], [STAYS, null], [null, SCRUB], [SCRUB, STAYS, SCRUB, null]];
  const drawn = (w: unknown[]) => (renderToStaticMarkup(React.createElement(HubScenes as unknown as React.FC<{ widgets: unknown; scrubAllowed: boolean; scrubOut: boolean }>, { widgets: w, scrubAllowed: true, scrubOut: true }, ...w.map((_, i) => React.createElement('section', { key: i })))).match(/class="hub-cell"/g) ?? []).length;
  for (const plan of plans) {
    const w = plan.map(row);
    assert.equal(hubScrubHolds(w as never, true, true), drawn(w), `${JSON.stringify(plan)}: the count is not what is drawn`);
    assert.ok(hubScrubHoldsAtMost(w as never, true, true) >= drawn(w), `${JSON.stringify(plan)}: the page would ask for fewer pairs than its scenes need`);
    assert.equal(hubScrubHoldsAtMost(w as never, false, true), 0, 'without Event Hub Pro a page wraps itself');
  }
  assert.equal(hubScrubHoldsAtMost([null, null].map(row) as never, true, true), 0);
  /* BOTH TREES of the guest page wrap their article, with the one count. */
  const body = read(`${B}/site-body.tsx`);
  assert.match(body, /const pageHolds = hubScrubHoldsAtMost\(widgets, proWatermarkHidden\);/);
  assert.equal((body.match(/<HubPageHold holds=\{pageHolds\}>\s*<article data-pahina-chapters/g) ?? []).length, 2, 'a tree of the guest page is not inside the page’s own hold');
  assert.equal((body.match(/<\/article>\s*<\/HubPageHold>/g) ?? []).length, 2);
  /* THE ENGINE: the page's pairs from the outside in; hand-over k gets pair k, else its own cell; a spare pair holds nothing. */
  const engine = read(`${B}/hub-scrub-engine.ts`);
  assert.match(engine, /for \(let cell: HTMLElement \| null = root\.matches\(PAGE\) \? root : null; cell; \) \{[\s\S]*?pages\.push\(\{ cell, stage \}\);\s*cell = stage\.querySelector<HTMLElement>\(`:scope > \$\{PAGE\}`\);\s*\}/);
  assert.match(engine, /const hold = pages\[held\.length\] \?\? \{ cell, stage \};/);
  assert.match(engine, /for \(const spare of pages\.slice\(held\.length\)\) \{\s*put\(spare\.stage, '--hub-top', '0px'\);\s*put\(spare\.cell, '--hub-len', '0px'\);\s*\}/);
  /* …armed before it measures: where a stage stands depends on the arrivals before it being in place. */
  assert.ok(engine.indexOf("for (const s of scopes) put(s, 'data-hub-scrub-on', '');") < engine.indexOf('for (const cell of root.querySelectorAll<HTMLElement>(CELL))'));
  /* THE ISLAND arms the page's outermost pair when the page has one — one engine for every scenes block. */
  assert.match(read(`${B}/hub-scrub.tsx`), /const page = document\.querySelector<HTMLElement>\('\.hub-page-cell'\);\s*for \(const root of page\?\.querySelector\('\[data-hub-fx\]'\) \? \[page\] : document\.querySelectorAll<HTMLElement>\('\.hub-scenes'\)\)/);
  /* THE STYLESHEET: the same two rules as a hand-over's own cell — length and the browser's sticky — behind the engine's mark. */
  assert.match(CSS, /\.hub-page-cell\[data-hub-page-on\]::after,\s*\.hub-page-cell\[data-hub-page-on\] \.hub-page-cell::after \{ content: ''; display: block; height: var\(--hub-len, 0px\); \}/);
  assert.match(CSS, /\.hub-page-cell\[data-hub-page-on\] \.hub-page-stage \{ position: sticky; top: var\(--hub-top, 0px\); \}/);
  for (const m of CSS.matchAll(/([^{}]+)\{[^{}]*\}/g)) for (const sel of m[1]!.split(',')) if (/\.hub-page-(?:cell|stage)/.test(sel)) assert.match(sel, /\[data-hub-page-on\]/, `the page’s pairs are styled without the engine — the plain page would change: ${sel.trim()}`);
});

test('(9) the top of the room is one number, the stylesheet’s: the engine reads `--hub-pin` back and has none of its own', () => {
  /* THE STYLESHEET — one line for a page with the invitation's pinned bar, one for a page without; nowhere else. */
  const decls = [...CSS.matchAll(/([^{}]+)\{\s*--hub-pin:\s*([^;]+);\s*\}/g)].map((m) => `${m[1]!.trim()} → ${m[2]!.trim()}`);
  assert.deepEqual(decls, ['.hub-scenes → calc(max(4.75rem, 9vh) + env(safe-area-inset-top, 0px))', 'html:has([data-sticky-top]) .hub-scenes → calc(6.25rem + env(safe-area-inset-top, 0px))']);
  assert.equal((CSS.match(/--hub-pin\s*:/g) ?? []).length, 2, 'the line is declared a third time');
  /* …in the PLAIN BASE: behind no gate. (It sat behind `@supports (animation-timeline: view())`, which an iPhone
     before iOS 26 does not pass — there the line would not exist, and the engine would not play.) */
  const gate = CSS.indexOf('@supports (animation-timeline: view())');
  assert.ok(gate > 0 && CSS.lastIndexOf('--hub-pin:') < gate, 'the line is declared behind the scroll-timeline gate');
  const before = CSS.slice(0, CSS.indexOf('--hub-pin:'));
  assert.equal((before.match(/\{/g) ?? []).length - (before.match(/\}/g) ?? []).length, 1, 'the line is declared inside an at-rule');
  /* …and the armed scenes block carries it as a length the engine can read in pixels — on a box that does not scroll. */
  assert.match(CSS, /\.hub-scenes\[data-hub-scrub-on\] \{ scroll-padding-top: var\(--hub-pin\); \}/);
  /* THE ENGINE — reads it, after arming (the rule needs the mark); no number of its own; no line, no play. */
  const engine = read(`${B}/hub-scrub-engine.ts`);
  assert.match(engine, /const topLine = parseFloat\(getComputedStyle\(scopes\[0\] \?\? root\)\.scrollPaddingTop\);\s*if \(!\(topLine > 0\)\) throw new Error\('the page does not say where its top line is'\);\s*const view = \{ centre: C, topLine, room: V - topLine - 24, lens \};/);
  assert.equal((engine.match(/topLine\b/g) ?? []).length, 4, 'the engine sets the top line a second way');
  assert.doesNotMatch(engine, /Math\.max\(76|\* 0\.09|4\.75|6\.25/, 'the engine has a number of its own for the top of the room');
  assert.ok(engine.indexOf("for (const s of scopes) put(s, 'data-hub-scrub-on', '');") < engine.indexOf('const topLine ='), 'the engine reads the line before it arms — the rule that carries it needs the mark');
});
