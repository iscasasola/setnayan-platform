/**
 * event-hub-pro-price-is-never-typed.test.ts — no Event Hub Pro figure in code.
 *
 * ⚖ Owner, 2026-09-25: *"make it 5000 with 40% off becoming 3000 on
 * onboarding"* — ₱5,000 regular, ₱3,000 at sign-up, replacing the same-day
 * ₱3,500 regular / ₱2,100 sign-up, which had itself replaced the ₱2,000 of two
 * days earlier, which had replaced ₱3,500, which had replaced ₱4,999.
 *
 * 🔑 "EVERY LOCATION" MUST BE ONE LOCATION. The only place Event Hub Pro's price
 * may live is its catalog row (`platform_retail_catalog_v2` · COUPLE_WEBSITE_PRO),
 * read at render through `formatV2Sku` / `proPriceLabelFrom` / the services-step
 * reader, and at charge through the order-charge authority or the onboarding
 * mint. `lib/couple-website-pro.ts` records what happens otherwise: three
 * different figures for one product in one file.
 *
 * So this is the Pro twin of `papic-copy-guardrails.test.ts`: it reads the CODE
 * (comments stripped — a docblock may quote history) of every non-test app/lib
 * file that names Event Hub Pro, and fails if any of the product's past or
 * present figures is typed within reach of that name.
 *
 * ⚠ IT GUARDS THE FIGURES THIS PRODUCT HAS ACTUALLY CARRIED. A brand-new figure
 * would slip past a list; add it here in the same PR that sets it, the way the
 * catalog fixture in `llms-txt-guard-input.ts` is updated in the same PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = process.cwd();

/** Every figure Event Hub Pro has been sold at, plus today's sign-up price. */
const PRO_FIGURES = ['2000', '2100', '3000', '3500', '3999', '4999', '5000'];

/** What counts as naming the product in code. */
const PRO_NAME = /COUPLE_WEBSITE_PRO|Event Hub PRO|Event Hub Pro|'website-pro'|WebsitePro|HubPro/g;

/** How far either side of a Pro mention a typed figure counts as "next to" it. */
const REACH = 400;

/**
 * Files allowed to carry a figure, each with its reason. Keep this list short.
 */
const ALLOWED: Record<string, string> = {
  // THE deliberately hand-typed copy of the live catalog that the llms.txt
  // guards render against. It must carry the real figure — that is its job —
  // and its own docblock requires it to move in the same PR as the row.
  'lib/llms-txt-guard-input.ts': 'the catalog fixture for the llms.txt guards',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Code only — the repo's one string-aware stripper, never a local regex. */
const code = (src: string): string => stripComments(src);

/** A figure as a peso amount or a bare number, with or without a thousands comma. */
const figure = (n: string) =>
  new RegExp(`(?<![\\d.,])${n.slice(0, -3)},?${n.slice(-3)}(?![\\d])`);

function findTypedProFigures(files: readonly string[]): string[] {
  const hits: string[] = [];
  for (const abs of files) {
    const rel = relative(WEB, abs);
    if (ALLOWED[rel]) continue;
    const src = code(readFileSync(abs, 'utf8'));
    for (const m of src.matchAll(PRO_NAME)) {
      const at = m.index ?? 0;
      const window = src.slice(Math.max(0, at - REACH), at + m[0].length + REACH);
      for (const n of PRO_FIGURES) {
        if (figure(n).test(window)) hits.push(`${rel}: ${n} near "${m[0]}"`);
      }
    }
  }
  return [...new Set(hits)];
}

const FILES = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))];

test('no Event Hub Pro price is typed into app or lib code', () => {
  const hits = findTypedProFigures(FILES);
  assert.deepEqual(
    hits,
    [],
    'Event Hub Pro’s price lives in platform_retail_catalog_v2 only — read it, never type it',
  );
});

test('the guard can actually hit (a planted figure is caught, a comment is not)', () => {
  // A guard nobody has seen fail proves nothing. Plant both shapes in memory.
  const planted = code(
    `const label = 'Unlock Event Hub PRO · ₱3,500';\n// Event Hub PRO was ₱2,000\n`,
  );
  const hitsPeso = PRO_FIGURES.filter((n) => figure(n).test(planted));
  assert.deepEqual(hitsPeso, ['3500'], 'the typed figure is caught; the commented one is not');
  assert.ok(figure('2000').test('price: 2000,'), 'a bare number counts too');
  assert.ok(!figure('2000').test('20000'), 'a longer number is not a match');
  assert.ok(FILES.length > 500, `the walk found only ${FILES.length} files — wrong directory?`);
});
