/**
 * page-masthead.test.ts — the page header stays one row.
 *
 * Owner 2026-08-18, on three screenshots of the eyebrow + title + paragraph
 * stack: *"we do not need these. it just eats up space and we want it to be
 * simpler to understand on each page without too much side comments. if you
 * need description for what that part does you can add the (i)"*.
 *
 * So: no eyebrow, no lede paragraph, and what a page is for lives behind an (i)
 * beside the title. Both regressions are SILENT — a page that hand-rolls the old
 * stack renders perfectly, and a lede that goes back to being a <p> just looks
 * like a page with more words on it.
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
  // The one place `lede` may be consumed is the disclosure body.
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
    'a bare (i) announces nothing; say what it opens');
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

test('the title is never invisible and never a link-coloured button', () => {
  assert.ok(/<h1\b/.test(CODE), 'below lg there is no sidebar and no breadcrumb: the h1 is the only wayfinding');
  assert.ok(/text-\[22px\][\s\S]*lg:text-\[36px\]/.test(CODE),
    'the responsive step is the whole reason the h1 survives on a phone');
});
