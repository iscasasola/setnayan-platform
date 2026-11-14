/**
 * 💰 NO TYPED PRICE AND NO TYPED INCLUDED-CREDIT NUMBER ON A CUSTOMER SCREEN (owner 2026-11-13: the site carries
 * no typed prices — "update all pricing … so the site carries no … typed prices").
 *
 * A couple's plan price is `platform_retail_catalog_v2.retail_price_php`; the Papic credits a plan includes are
 * `platform_retail_catalog_v2.included_papic_credits`; a supplier's plan is `vendor_billing_catalog`. All three are
 * admin-managed and move (Plus went to 1,000 credits and Pro to 2,000 on the day this guard was written). A figure
 * typed into source is a promise nobody re-checks the day the row moves.
 *
 * WHAT IT READS — only the words a customer can be shown: every string literal, template piece and JSX text in the
 * customer surfaces, parsed with the TypeScript parser. Comments and identifiers are never looked at, so a history
 * note (`// was ₱2,499`) or a constant NAME cannot trip it, and a figure inside a string cannot hide from it
 * behind a stray `//`.
 *
 * WHAT IT FLAGS
 *   · a peso amount: `₱` followed by a non-zero figure (`₱0` is the free marker, the one price that never moves);
 *   · `PHP 499` / `Php 499` — the same thing spelled out;
 *   · a credit COUNT: a figure of two or more digits before "credit(s)" ("1,000 Papic credits", "150 credits left").
 *     A single "1 credit" is a unit ("1 credit = 1 photo"), not a count, so it is left alone.
 *
 * WHERE — `app/` (minus `admin` and `api`, which no customer sees, and `dev`, the owner's labs), `components/`,
 * and `lib/` minus the modules other sessions own (help, feature pages, SEO, llms.txt, blog) and `lib/admin`.
 *
 * EXEMPTIONS — each says why. The `app/` peso figures already declared in `public-price-literals.ts` (each with its
 * own reason) count as exempt here too, so there is ONE register for them — and this file pins that NONE of those
 * declarations is a catalogue price (`sku: null` for all of them): a typed Setnayan price can no longer be declared
 * away, it has to be read.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { PUBLIC_PRICE_LITERALS } from './public-price-literals';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Top-level folders scanned. */
const ROOTS = ['app', 'components', 'lib'] as const;

/** Paths (relative to apps/web, no trailing slash) never walked — and why. */
const NOT_A_CUSTOMER_SCREEN: ReadonlyArray<readonly [string, string]> = [
  ['app/admin', 'the owner’s console — explains rules to the owner, never shown to a customer'],
  ['app/api', 'routes render nothing'],
  ['app/dev', 'the owner’s labs: sample data on purpose, not reachable by a customer in production'],
  ['lib/admin', 'console-only copy and validators'],
  ['lib/ugat', 'the internal system map — claims about the schema, never shown to a customer'],
  ['lib/erasure', 'the privacy-erasure coverage register — reasons written for engineers, never rendered'],
  ['lib/public-price-literals.ts', 'the register of declared figures itself — read below as exemptions, not shown'],
  // Owned by the other truth-sweep sessions (13 Nov 2026) — guarded there (`help-no-hardcoded-prices.test.ts`, …).
  ['lib/help', 'help articles: owned by the help sweep, guarded by help-no-hardcoded-prices.test.ts'],
  ['lib/feature-pages', 'feature pages: owned by the public-content sweep'],
  ['lib/seo', 'SEO copy: owned by the public-content sweep'],
  ['lib/blog', 'blog: owned by the public-content sweep'],
];

/** Path prefixes in lib/ owned by other sessions (lib/help*, lib/llms-txt*, lib/blog*, incl. lib/blog-batches). */
const NOT_OURS_PREFIX = ['lib/help', 'lib/llms-txt', 'lib/blog'];

/**
 * Figures that may stay typed, keyed `file → figure`. Each is NOT a Setnayan price and NOT a plan's included
 * credits — say what it is instead.
 */
const EXEMPT: ReadonlyArray<{ file: string; figure: string; reason: string }> = [
  {
    file: 'app/dashboard/[eventId]/launch/_components/stage-panel/camera-face.tsx',
    figure: '150 credits',
    reason:
      'a DRAWING of the guest camera in the Maker (“150 credits left” on its status chip, from the approved ' +
      'prototype) — an illustrative balance on a picture, not what any plan includes or costs',
  },
  {
    file: 'lib/empty-look-samples.ts',
    figure: '₱312,000',
    reason: 'the greyed sample Home a brand-new couple sees (“this is how it will look”): a made-up budget, not a price',
  },
  { file: 'lib/empty-look-samples.ts', figure: '₱288,000', reason: 'same sample budget (paid so far)' },
  { file: 'lib/empty-look-samples.ts', figure: '₱600,000', reason: 'same sample budget (the total)' },
  { file: 'lib/empty-look-samples.ts', figure: '₱180,000', reason: 'sample venue booking on the same greyed sample' },
  { file: 'lib/empty-look-samples.ts', figure: '₱85,000', reason: 'sample photo booking on the same greyed sample' },
  {
    file: 'lib/hiring-guide/alert-engine.ts',
    figure: '₱50,000',
    reason: 'a market salary range for a role a supplier is hiring — somebody else’s pay, not a Setnayan price',
  },
  { file: 'lib/hiring-guide/alert-engine.ts', figure: '₱45,000', reason: 'same — market salary range' },
  { file: 'lib/hiring-guide/alert-engine.ts', figure: '₱60,000', reason: 'same — market salary range' },
  {
    file: 'lib/admin-approvals.ts',
    figure: '₱25,000',
    reason: 'the label of a two-admin approval rule (refunds above the line) — console copy, not a price',
  },
  {
    file: 'lib/tours.ts',
    figure: '₱100',
    reason: 'the admin console tour (“refunds > ₱100K need a second admin”) — a rule threshold, not a price',
  },
  {
    file: 'lib/checklist-event-type-defs.ts',
    figure: '18 credits',
    reason: 'academic units (a thesis defence’s “18 credits”) — a school term, not Papic credits',
  },
  {
    file: 'lib/onboarding/specialty-option-labels.ts',
    figure: '18 credits',
    reason: 'academic units in an event-type option label — a school term, not Papic credits',
  },
];

const PESO = /₱\s?[1-9](?:[0-9,]*[0-9])?/g;
const PHP_WORD = /\b(?:PHP|Php)\s[1-9](?:[0-9,]*[0-9])?/g;
const CREDIT_COUNT = /\b[1-9][0-9]?(?:,?[0-9]{3})*[0-9]?\s+(?:Papic\s+)?(?:photo\s+)?credits?\b/gi;

function skipped(rel: string): boolean {
  if (NOT_A_CUSTOMER_SCREEN.some(([p]) => rel === p || rel.startsWith(`${p}/`))) return true;
  return NOT_OURS_PREFIX.some((p) => rel.startsWith(p));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    const rel = relative(WEB_ROOT, full);
    if (skipped(rel)) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry) && !entry.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

/** Every piece of text the file can put in front of somebody: string literals, template pieces, JSX text. */
function shownText(file: string, src: string): string[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, false, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      out.push(node.text);
    } else if (ts.isJsxText(node)) {
      out.push(node.text.replace(/\s+/g, ' '));
    } else if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      return; // module paths are not words on a screen
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function findings(): string[] {
  const exempt = new Map<string, Set<string>>();
  const allow = (file: string, figure: string) => {
    if (!exempt.has(file)) exempt.set(file, new Set());
    exempt.get(file)!.add(figure);
  };
  for (const e of EXEMPT) allow(e.file, e.figure);
  for (const l of PUBLIC_PRICE_LITERALS) allow(l.file, l.literal);

  const out: string[] = [];
  for (const root of ROOTS) {
    for (const abs of walk(join(WEB_ROOT, root))) {
      const src = readFileSync(abs, 'utf8');
      if (!/₱|credit|PHP\s|Php\s/i.test(src)) continue;
      const rel = relative(WEB_ROOT, abs);
      const seen = new Set<string>();
      for (const text of shownText(abs, src)) {
        for (const re of [PESO, PHP_WORD, CREDIT_COUNT]) {
          for (const m of text.match(re) ?? []) {
            const figure = m.replace(/\s+/g, ' ').trim();
            if (/^1 /.test(figure)) continue; // "1 credit" — a unit, not a count
            if (exempt.get(rel)?.has(figure)) continue;
            seen.add(figure);
          }
        }
      }
      for (const f of seen) out.push(`${rel} → ${f}`);
    }
  }
  return out.sort();
}

test('no customer screen types a peso amount or a credit count', () => {
  const found = findings();
  assert.deepEqual(
    found,
    [],
    `Typed money / credit figure(s) on a customer screen:\n  ${found.join('\n  ')}\n\n` +
      'Read it instead: a couple price from platform_retail_catalog_v2 (fetchV2CustomerCatalog → retail_price_php), ' +
      'a plan’s Papic credits from included_papic_credits, a supplier price from vendor_billing_catalog ' +
      '(lib/supplier-billing*), an App Store price from StoreKit (lib/iap/use-app-store-prices). When the read ' +
      'fails, show no figure — never a remembered one. If the figure is genuinely not a Setnayan price (a sample, ' +
      'somebody else’s money, a rule threshold), add it to EXEMPT in this file with the reason.',
  );
});

test('every exemption still exists — a stale exemption is a hole nobody sees', () => {
  const stale: string[] = [];
  for (const e of EXEMPT) {
    const src = readFileSync(join(WEB_ROOT, e.file), 'utf8');
    const text = shownText(e.file, src).join('\n').replace(/\s+/g, ' ');
    if (!text.includes(e.figure)) stale.push(`${e.file} → ${e.figure}`);
  }
  assert.deepEqual(stale, [], `Exemption(s) whose figure is gone — delete them:\n  ${stale.join('\n  ')}`);
});

test('every exemption gives a reason', () => {
  for (const e of EXEMPT) assert.ok(e.reason.trim().length > 20, `${e.file} → ${e.figure} has no real reason`);
  for (const [p, why] of NOT_A_CUSTOMER_SCREEN) assert.ok(why.trim().length > 10, `${p} is skipped with no reason`);
});

test('no declared peso figure in public-price-literals.ts is a catalogue price', () => {
  const priced = PUBLIC_PRICE_LITERALS.filter((l) => l.sku !== null).map((l) => `${l.file} → ${l.literal} (${l.sku})`);
  assert.deepEqual(
    priced,
    [],
    `These are Setnayan catalogue prices typed into source. Read the row instead of declaring the figure:\n  ${priced.join('\n  ')}`,
  );
});

test('the guard can see: a typed price, a PHP figure and a credit count are each caught; ₱0, comments and "1 credit" are not', () => {
  const sample = [
    `// was ₱2,499 and 1,000 credits — history, ignored`,
    `/* ₱799 */`,
    `const a = 'Event Plus ₱1,499';`,
    `const b = \`only PHP 999 today\`;`,
    `const c = <p>Includes 2,000 Papic credits</p>;`,
    `const d = 'Free · ₱0';`,
    `const e = '1 Papic credit = 1 photo';`,
    `const f = \`\${n} credits\`;`,
  ].join('\n');
  const hits = shownText('sample.tsx', sample).flatMap((t) =>
    [PESO, PHP_WORD, CREDIT_COUNT].flatMap((re) => t.match(re) ?? []).filter((m) => !/^1 /.test(m)),
  );
  assert.deepEqual(hits.sort(), ['2,000 Papic credits', 'PHP 999', '₱1,499'].sort());
});

test('the scan reaches the surfaces it is for', () => {
  const rels = ROOTS.flatMap((r) => walk(join(WEB_ROOT, r))).map((f) => relative(WEB_ROOT, f));
  for (const must of [
    'app/_components/frontdoor/front-door-landing-data.ts',
    'app/onboarding/wedding/_components/onboarding-pricing.ts',
    'lib/iap/products.ts',
  ]) {
    assert.ok(rels.includes(must), `${must} is not scanned`);
  }
  assert.ok(rels.some((r) => r.startsWith('app/(shell)/pricing/')), 'the pricing page is not scanned');
  assert.ok(!rels.some((r) => r.startsWith('app/admin/')), 'app/admin must stay out');
});
