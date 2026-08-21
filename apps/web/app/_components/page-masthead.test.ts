/**
 * page-masthead.test.ts — the page header draws nothing you did not ask for.
 *
 * Owner 2026-08-18, on three screenshots of the eyebrow + title + paragraph
 * stack: *"we do not need these. it just eats up space and we want it to be
 * simpler to understand on each page without too much side comments. if you
 * need description for what that part does you can add the (i)"*.
 *
 * Owner 2026-08-21, pointing at what was LEFT of that row — a back chevron and
 * a 36px "Alaala": *"i still see this across most of pages"* — and choosing, of
 * the options put to him, to remove the back arrow and the big page name
 * entirely so each page starts straight at its content.
 *
 * 🛑 THIS FILE PREVIOUSLY ASSERTED THE OPPOSITE. Its last test was called "the
 * title is never invisible" and it pinned the 22px→36px step as the reason the
 * h1 survived on a phone. That argument was sound and it was OVERRULED by the
 * person who uses the product. The assertion is inverted rather than deleted, so
 * that a future session cannot restore the title by accident and call it a fix.
 *
 * Every regression here is SILENT — a page that hand-rolls the old stack renders
 * perfectly, and a lede that goes back to being a <p> just looks like a page
 * with more words on it.
 *
 * 🛡 EVERY ASSERTION HERE WAS MUTATION-CHECKED: each rule was broken on purpose,
 * the OCCURRENCE COUNT printed before and after to prove the sabotage landed,
 * and the test confirmed RED before being trusted. This repo has had guards pass
 * while the thing they guard was gone; an unmeasured mutation proves nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(HERE, 'page-masthead.tsx'), 'utf8');

/** Comments describe the rules; they must never satisfy them. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

test('the masthead has no eyebrow prop, at any width', () => {
  assert.equal(/\beyebrow\b/i.test(CODE), false,
    'An eyebrow prop is 24px of layout for 10.5px of type repeating the nav.');
  assert.equal(CODE.includes('sn-eye'), false,
    '.sn-eye is the TILE eyebrow — its own spec comment says so. Not a page identity.');
});

test('the lede renders ONLY inside the (i), never as a paragraph', () => {
  const uses = CODE.match(/\{lede\}|\{children\}/g) ?? [];
  assert.ok(uses.length > 0, 'the lede has to render somewhere');
  assert.equal(/<p[^>]*>\s*\{lede\}/.test(CODE), false,
    'A lede paragraph is the "side comment" the owner asked us to remove.');
  assert.ok(CODE.includes('<details'),
    'the (i) is a native <details>: zero client JS, and these pages are server components');
  assert.ok(/lede && <MastheadInfo/.test(CODE),
    'no lede means no (i) — an (i) that opens onto nothing is worse than none');
});

test('the (i) is reachable by touch and named for a screen reader', () => {
  assert.ok(/aria-label=\{title \? `What \$\{title\} is for`/.test(CODE),
    'the (i) no longer sits beside a title, so its accessible name is the ONLY thing saying what it opens');
  assert.ok(/h-7 w-7/.test(CODE),
    '28px clears the 24px WCAG 2.2 target-size floor — a hover tooltip is unreachable on a phone');
});

test('the (i) never wears the gold slot', () => {
  // In this repo the Tailwind slot named `terracotta` IS the atelier gold
  // #A9834B — 3.37:1 on cream, under the 4.5:1 AA floor, with 0.29 of headroom,
  // so any tint under it fails too. design#6 shipped that exact bug publicly.
  assert.equal(/text-terracotta(?![\w-])/.test(CODE), false,
    'text-terracotta is the GOLD slot and fails AA. Use text-mulberry or text-ink.');
});

test('the page name is in the document and takes NO space', () => {
  assert.ok(/<h1\b/.test(CODE),
    'hiding the title is not deleting the element: a screen reader, a skip link and heading order all still need it');
  assert.ok(/<h1[^>]*className="sr-only"/.test(CODE),
    'the h1 must be sr-only — that is the whole ask: the page starts at its content');
  assert.equal(/text-\[22px\]|lg:text-\[36px\]|sn-h1/.test(CODE), false,
    'no visible type step on the h1. The 36px title is what the owner pointed at twice.');
  assert.ok(/id=\{id\}/.test(CODE),
    'aria-labelledby and skip-link targets point at this h1; keep the id on it');
});

test('the masthead has no back chevron and cannot grow one back', () => {
  assert.equal(/\bback\b/.test(CODE), false,
    'the back arrow was removed app-wide on 2026-08-21 — a `back` prop here puts the row back on 28 pages');
  assert.equal(/ChevronLeft|ArrowLeft/.test(CODE), false, 'no back icon lives in the masthead');
  assert.equal(/<Link\b|href=/.test(CODE), false,
    'the masthead renders no navigation of its own; `actions` carries whatever a page needs');
});

test('a page with nothing to show renders NO strip at all', () => {
  assert.ok(/if \(!lede && !actions\) return heading;/.test(CODE),
    'without the early return, an empty flex box plus a mb-6 leaves the same gap the row used to occupy');
  assert.ok(/className=\{`flex flex-wrap items-center[^`]*\$\{className\}`\}/.test(CODE),
    'the strip, when it exists, is one row — actions and the (i), nothing else');
});

test('actions survive — 25 old headers held the ONLY doorway to another surface', () => {
  assert.ok(/\{actions\}/.test(CODE),
    '`orders` holds the only link to /orders/new; `guests` the only desktop links to invite and seating');
  assert.ok(/sm:ml-auto/.test(CODE),
    'with no title to push against, actions need ml-auto to stay right-aligned');
});
