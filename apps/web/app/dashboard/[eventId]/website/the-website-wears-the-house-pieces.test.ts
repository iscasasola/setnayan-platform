/**
 * the-website-wears-the-house-pieces.test.ts — THE WEBSITE EDITOR WEARS THE HOUSE PIECES (themes audit 27 Nov, Group B1).
 *
 * `/dashboard/[eventId]/website/**` was moved onto the one button, the one chip and the colour and speed tokens:
 *   (1) no legacy `.button-primary` (or any `.button-*` look) in a website file — the shared button's class
 *       (`actionButtonClass` / `ActionButton`) in its place;
 *   (2) the Sections panel draws its actions with `ActionButton` and its choices with the ONE chip (`chipClass`) —
 *       no hand-typed button look is back;
 *   (3) no Tailwind palette colour (`bg-amber-400`, `text-red-800`) and no hand `dark:` colour twin — the `warn` /
 *       `danger` ramps flip with the mode by themselves;
 *   (4) no raw speed or easing (`duration-300`, `ease-in-out`) in a `.tsx` — the house speeds (`duration-sn-*`, `ease-sn`).
 * Exempt: tests, and `photo-moments-editor.tsx` (open in another lane on 27 Nov).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const ROOT = __dirname;
const EXEMPT = new Set(['photo-moments/_components/photo-moments-editor.tsx']);

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsxFiles(p));
    else if (name.endsWith('.tsx') && !EXEMPT.has(relative(ROOT, p))) out.push(p);
  }
  return out;
}

const files = tsxFiles(ROOT).map((p) => ({ rel: relative(ROOT, p), src: stripComments(readFileSync(p, 'utf8')) }));

function offenders(re: RegExp): string[] {
  return files.filter((f) => re.test(f.src)).map((f) => f.rel);
}

test('anti-vacuity: the website files were read', () => {
  assert.ok(files.length > 50, `only ${files.length} files were read`);
  assert.ok(files.some((f) => f.rel === 'editor/_components/sections-panel.tsx'));
});

test('(1) no legacy .button-* look in a website file', () => {
  assert.deepEqual(offenders(/\bbutton-(?:primary|secondary|ghost|danger|tertiary)\b/), []);
});

test('(2) the Sections panel: actions are ActionButton, choices are the one chip — no hand-typed button look', () => {
  const src = files.find((f) => f.rel === 'editor/_components/sections-panel.tsx')!.src;
  assert.match(src, /from '@\/components\/action-button'/);
  assert.match(src, /from '@\/app\/_components\/chip-classes'/);
  assert.ok((src.match(/<ActionButton\b/g) ?? []).length >= 5, 'the panel’s actions are no longer the shared button');
  assert.ok((src.match(/chipClass\(/g) ?? []).length >= 10, 'the panel’s choices are no longer the one chip');
  /* The hand looks that were here: a chip filled ink, a quiet chip washed ink/5, a hand danger pill. */
  assert.doesNotMatch(src, /'border-ink bg-ink text-cream'/);
  assert.doesNotMatch(src, /'border-ink\/60 bg-ink\/5 font-semibold text-ink'/);
  assert.doesNotMatch(src, /bg-danger-600 px-3/);
});

test('(3) no Tailwind palette colour and no hand dark: colour twin', () => {
  assert.deepEqual(offenders(/\b(?:bg|text|border)-(?:red|amber|yellow|orange|green|blue)-\d{2,3}\b/), []);
  assert.deepEqual(offenders(/dark:(?:bg|text|border)-\[rgb\(var\(--color-(?:warn|danger)\)/), []);
});

test('(4) no raw speed or easing class — the house speeds', () => {
  assert.deepEqual(offenders(/\bduration-\d+\b/), []);
  assert.deepEqual(offenders(/\bease-in-out\b/), []);
});
