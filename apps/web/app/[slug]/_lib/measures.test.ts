/**
 * THE EVENT HUB HAS FOUR MEASURES, AND THIS IS WHAT KEEPS IT AT FOUR.
 *
 * The guest tree had EIGHT content widths. A convention is not a control — the
 * repo has recorded that four times — so the sanctioned set is enforced here
 * rather than described in a docblock.
 *
 * ── WHAT IT CHECKS ──────────────────────────────────────────────────────────
 * PAGE-LEVEL columns only: an element carrying BOTH `mx-auto` and a `max-w-*`
 * is deciding the width of a column. An inner `max-w-xs` on a badge is not a
 * column and is none of this file's business — scoping it that way is why this
 * guard does not cry wolf, and a guard that cries wolf teaches you to skim past
 * the one time it is right.
 *
 * ── THE BILL IS EXACT-MATCH, IN BOTH DIRECTIONS ─────────────────────────────
 * `KNOWN_DRIFT` lists every page-level column still outside the set, one line
 * each, with the reason it has not been moved. A NEW one fails. FIXING one also
 * fails, until its line is deleted. That is the shape the doors guard already
 * uses in this repo, and it is deliberate: **a baseline is a bill, not a
 * decision** — every line below is a page that does not yet match its siblings,
 * and the list is meant to shrink.
 *
 * ⚠ THE ONES BELOW ARE TYPOGRAPHIC, NOT COLUMNS, AND THAT IS WHY THEY ARE NOT
 * SWEPT. Moving a standfirst or a pull-quote to the reading measure changes its
 * LINE LENGTH, and because the reading measure is `ch`-based it would make a
 * large italic standfirst physically WIDER, not narrower. That is a typographic
 * decision to be made while looking at the page, not a mechanical rename — and
 * nobody has looked at these since the July redesign shipped.
 *
 * Run from inside this directory: `npx tsx --test ./measures.test.ts`
 * 🪤 Running it as `npx tsx --test "app/[slug]/_lib/measures.test.ts"` prints
 * "# tests 0" AND EXITS GREEN — the brackets are a glob character class.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MEASURES, STAGE, PLATE, READING, PHONE } from './measures';

const TREE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...tsxFiles(p));
    else if (/\.tsx$/.test(entry) && !/\.test\./.test(entry)) out.push(p);
  }
  return out;
}

/** Every page-level column in the guest tree: `mx-auto` + `max-w-*` on one element. */
function pageColumns(): Array<{ file: string; line: number; width: string }> {
  const found: Array<{ file: string; line: number; width: string }> = [];
  for (const file of tsxFiles(TREE)) {
    const rel = file.slice(TREE.length + 1);
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((ln, i) => {
        if (!ln.includes('mx-auto')) return;
        for (const m of ln.matchAll(/\bmax-w-(prose|5xl|4xl|3xl|2xl|xl|lg|md|sm|xs|full|none)\b/g)) {
          found.push({ file: rel, line: i + 1, width: `max-w-${m[1]}` });
        }
      });
  }
  return found;
}

/**
 * The bill. `file` only — line numbers churn on every unrelated edit and would
 * make this guard a nuisance rather than a control.
 * Each entry: how many page-level columns in that file are still off-measure.
 */
const KNOWN_DRIFT: Record<string, { count: number; why: string }> = {
  'editorial/editorial-content.tsx': {
    count: 4,
    why: 'A standfirst, a pull-quote, a caption and a figure. TYPOGRAPHIC, not columns — the reading measure is ch-based and would widen the standfirst. Decide while looking at the page.',
  },
  'recap/page.tsx': {
    count: 1,
    why: 'The centred notice column on the unpublished-recap state. Between reading and plate; nobody has seen this state on a real event.',
  },
  'empty-states.tsx': {
    count: 1,
    why: 'The teaser plate. Mounts only on the open-browse path, which is off for every production event.',
  },
  'site-body.tsx': {
    count: 2,
    why: 'One narrow notice plate and one full-width media row. The full-width one is deliberate (a cover plate), so this line will not go to zero.',
  },
  'error.tsx': {
    count: 1,
    why: 'The crash screen. Narrow on purpose; arguably the phone measure, but it is not worth a visual change to a screen nobody should see.',
  },
  'save-the-date-film.tsx': {
    count: 1,
    why: 'Inside the film overlay, which is its own art-directed surface. BUCKET 1 — wedding-only, and not to be swept.',
  },
};

test('the sanctioned set is exactly four, and they are distinct', () => {
  assert.equal(MEASURES.length, 4);
  assert.equal(new Set(MEASURES).size, 4, 'two measures resolve to the same width');
  // Pinned literally: these are the widths every room agreed on. Changing one
  // is a design decision and must fail here first.
  assert.equal(STAGE, 'max-w-5xl');
  assert.equal(PLATE, 'max-w-3xl');
  assert.equal(READING, 'max-w-prose');
  assert.equal(PHONE, 'max-w-md');
});

test('the reading measure stays character-based, never a rem width', () => {
  // If this ever becomes max-w-2xl or similar, line length stops tracking type
  // size and the editorial's large standfirsts get a 100-character line.
  assert.equal(READING, 'max-w-prose');
});

test('the phone column survives — retiring it would stretch the bottom bar', () => {
  // The study recommended three measures and retiring the other five. max-w-md
  // is the bar's own tab group; the bar is fixed at every width.
  assert.ok(MEASURES.includes(PHONE));
  const bar = readFileSync(join(TREE, '_components/site-menu-bar.tsx'), 'utf8');
  assert.ok(
    bar.includes(PHONE),
    'the bottom bar no longer carries the phone measure — its tabs will stretch across a desktop',
  );
});

test('the gift page uses the same column as every other room', () => {
  // It was the one genuine inconsistency: max-w-xl (36rem) while every sibling
  // room used the plate (48rem), so it read as a narrower, lesser page.
  const pabuya = readFileSync(join(TREE, 'pabuya/page.tsx'), 'utf8');
  assert.ok(pabuya.includes(PLATE), 'the gift page lost the plate measure');
  assert.ok(
    !/mx-auto[^"']*max-w-xl/.test(pabuya),
    'the gift page is back on its own private width',
  );
});

test('no page-level column uses a width outside the sanctioned four', () => {
  const offMeasure = pageColumns().filter(
    (c) => !(MEASURES as readonly string[]).includes(c.width),
  );

  // Group by file and compare to the bill — EXACT match in both directions.
  const actual: Record<string, number> = {};
  for (const c of offMeasure) {
    const key = Object.keys(KNOWN_DRIFT).find((k) => c.file.endsWith(k)) ?? c.file;
    actual[key] = (actual[key] ?? 0) + 1;
  }

  const unexpected = Object.entries(actual).filter(([f]) => !KNOWN_DRIFT[f]);
  assert.deepEqual(
    unexpected,
    [],
    `a NEW off-measure page column appeared: ${JSON.stringify(unexpected)}. ` +
      `Use one of ${MEASURES.join(' · ')}, or add a line to KNOWN_DRIFT saying why not.`,
  );

  for (const [file, { count, why }] of Object.entries(KNOWN_DRIFT)) {
    assert.equal(
      actual[file] ?? 0,
      count,
      `${file}: expected ${count} off-measure column(s), found ${actual[file] ?? 0}. ` +
        `If you FIXED one, delete or decrement its KNOWN_DRIFT line — the bill is meant to shrink. (${why})`,
    );
  }
});
