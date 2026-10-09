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
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { SCRUB, scrubLens, scrubMoment, scrubNeedsRest, scrubOwnIn, scrubPair, scrubRow, scrubThrough } from '../app/[slug]/_components/hub-scrub-math';

const WEB = join(__dirname, '..');
const B = 'app/[slug]/_components';
const read = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));
const CSS = read('app/globals.css');
const SIZES = [1548, 1608, 770, 812, 667, 384];
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
  /* Reduce motion: it returns before anything; any throw: it disarms and takes every mark off. */
  assert.match(src, /if \(typeof window === 'undefined' \|\| window\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\.matches\) return \(\) => \{\};/);
  assert.ok((src.match(/catch \{\s*stop\(\);\s*\}/g) ?? []).length >= 3, 'a throw in the engine leaves the page half-armed');
  assert.match(src, /for \(const \[el, keys\] of marked\) for \(const key of keys\.keys\(\)\) key\.startsWith\('--'\) \? el\.style\.removeProperty\(key\) : el\.removeAttribute\(key\);/);
  /* It reads the browser's own sticky back (a rect), never a position of its own. */
  assert.match(src, /h\.pair\.top - h\.cell\.getBoundingClientRect\(\)\.top/);
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
  for (const r of rules) for (const s of r.sel.split(',')) assert.ok(s.trim().startsWith('.hub-scenes[data-hub-scrub-on]'), `a Scrub rule applies without the engine: ${s.trim()}`);
  const of = (sel: string) => rules.find((r) => r.sel === sel)?.body ?? '';
  /* THE HOLD — the stage is the browser's own sticky; its length is INSIDE the cell's content box. */
  assert.equal(of('.hub-scenes[data-hub-scrub-on] .hub-stage'), 'position: sticky; top: var(--hub-top, 0px);');
  assert.equal(of('.hub-scenes[data-hub-scrub-on] .hub-cell::after'), "content: ''; display: block; height: var(--hub-len, 0px);");
  assert.equal(of('.hub-scenes[data-hub-scrub-on] .hub-cell'), '', 'the hold is padding — a sticky box cannot move into its parent’s padding, and never holds');
  /* THE SAME PLACE — a margin, in the flow. */
  assert.equal(of('.hub-scenes[data-hub-scrub-on] .hub-stage > .hub-after'), 'margin-top: var(--hub-up, 1rem);');
  /* NO TRANSFORM on anything that holds scenes (it would capture a scene's `position: fixed` sheets). */
  for (const r of rules) if (!/hub-canvas-body/.test(r.sel)) assert.doesNotMatch(r.body, /transform|translate|will-change/, `${r.sel} is transformed`);
  /* Not there until its turn, and gone after it. */
  assert.equal(of('.hub-scenes[data-hub-scrub-on] .hub-scene[data-hub-fx][data-hub-away]'), 'visibility: hidden;');
});

test('(6) the Maker’s first load is not touched, and the check in a browser is the five sizes', () => {
  const L = 'app/dashboard/[eventId]/launch/_components';
  for (const f of [`${L}/maker-shell.tsx`, `${L}/details-workspace.tsx`, 'lib/hub-draft.ts', 'lib/hub-canvas.ts', 'lib/hub-scenes.ts']) {
    assert.doesNotMatch(readFileSync(join(WEB, f), 'utf8'), /hub-scrub-(?:engine|math)|\/hub-scrub'|data-hub-fx|hub-cell|hub-stage/, `${f} knows about the guest page’s Scrub`);
  }
  const check = join(WEB, 'scripts', 'scrub-browser-check.mjs');
  assert.ok(existsSync(check));
  assert.match(readFileSync(check, 'utf8'), /const SIZES = \[\[890, 1548\], \[940, 1608\], \[1280, 770\], \[375, 812\], \[375, 667\]\];/);
});
