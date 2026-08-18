/**
 * Source-scan guard: no UNDECLARED peso figure may appear in a public surface.
 *
 * This is half of a two-part guard, and it is deliberately the weaker half. It
 * runs in CI, which has no prod credentials, so it can only ask "is this literal
 * declared?" — never "is it correct?". Correctness is checked at runtime by
 * `runSeoHealthChecks`, which reads the live catalog. Splitting it this way is
 * the direct lesson from the llms.txt drift: a guard that compares two
 * hand-maintained artifacts to each other proves nothing, so CI checks the thing
 * it can see (new hardcoding) and the runtime checks the thing only it can see
 * (staleness).
 *
 * Comments are stripped before scanning — a figure inside a `WHY:` comment is
 * documentation of history, not a live claim, and onboarding-pricing.ts alone
 * carries a dozen of those while being fully catalog-driven.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

import {
  PUBLIC_PRICE_LITERALS,
  ALWAYS_ALLOWED_LITERALS,
  parsePesoLiteral,
  skuBackedLiterals,
} from './public-price-literals';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP_ROOT = join(WEB_ROOT, 'app');

/** Signed-in surfaces are out of scope — they render live catalog data. */
const EXCLUDED_TOP_LEVEL = new Set(['admin', 'dashboard', 'vendor-dashboard', 'api']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (dir === APP_ROOT && EXCLUDED_TOP_LEVEL.has(entry)) continue;
      if (entry === 'node_modules' || entry === '.next') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Strip block, JSX and line comments so only live claims remain. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:])\/\/[^\n"'`]*$/gm, '$1');
}

test('every peso figure in a public surface is declared', () => {
  const declared = new Map<string, Set<string>>();
  for (const l of PUBLIC_PRICE_LITERALS) {
    if (!declared.has(l.file)) declared.set(l.file, new Set());
    declared.get(l.file)!.add(l.literal);
  }

  const undeclared: string[] = [];
  for (const abs of walk(APP_ROOT)) {
    const rel = relative(WEB_ROOT, abs);
    // Must END on a digit — a naive `[0-9,]*` swallows the trailing comma in
    // prose like "beyond ₱100,000, only on couples…" and reports '₱100,000,'.
    const figures = new Set(
      stripComments(readFileSync(abs, 'utf8')).match(/₱[0-9](?:[0-9,]*[0-9])?/g) ?? [],
    );
    for (const fig of figures) {
      if (ALWAYS_ALLOWED_LITERALS.has(fig)) continue;
      if (declared.get(rel)?.has(fig)) continue;
      undeclared.push(`${rel} → ${fig}`);
    }
  }

  assert.deepEqual(
    undeclared,
    [],
    `Undeclared peso figure(s) in public source:\n  ${undeclared.join('\n  ')}\n\n` +
      `Prices are admin-managed and drift. Either resolve this from the catalog, ` +
      `or add it to lib/public-price-literals.ts naming the SKU it mirrors (or why ` +
      `it is not a price). SKU-backed entries are re-verified against live prod by ` +
      `the daily SEO audit.`,
  );
});

test('every declared literal is actually still present in its file', () => {
  const stale: string[] = [];
  for (const l of PUBLIC_PRICE_LITERALS) {
    const src = stripComments(readFileSync(join(WEB_ROOT, l.file), 'utf8'));
    if (!src.includes(l.literal)) stale.push(`${l.file} → ${l.literal}`);
  }
  assert.deepEqual(
    stale,
    [],
    `Declared literal(s) no longer in source — remove the stale declaration:\n  ${stale.join('\n  ')}`,
  );
});

test('every declaration is well-formed', () => {
  for (const l of PUBLIC_PRICE_LITERALS) {
    assert.ok(parsePesoLiteral(l.literal) !== null, `${l.literal} is not a parseable peso figure`);
    assert.ok(l.reason.trim().length > 12, `${l.file} → ${l.literal} needs a real reason`);
  }
});

test('SKU-backed literals are the ones the runtime audit will verify', () => {
  const backed = skuBackedLiterals();
  // Guards the split itself: if someone declares everything as sku:null the
  // runtime check silently has nothing to do and this whole guard is decorative.
  //
  // ⚠ THE FLOOR WAS 4 AND IT PUNISHED THE RIGHT FIX (2026-08-13). Three
  // SKU-backed entries were retired that day not by relabelling them but by
  // DELETING THE LITERALS — the figures were resolved from the catalog instead,
  // which is the outcome this whole file exists to push toward. A count cannot
  // tell that apart from someone quietly relabelling prices as non-prices, and
  // "lower the number until CI is green" is how a guard becomes a rubber stamp.
  // So the floor is only a smoke test now, and the real check is below it.
  assert.ok(backed.length >= 1, 'the runtime drift audit has nothing left to verify');
  for (const l of backed) assert.ok(l.sku.length > 0);
});

test('a "fallback" is never declared as a non-price', () => {
  // 🔑 THE SHAPE THE ₱499 HID IN, WRITTEN DOWN. `app/(shell)/pricing/page.tsx` declared
  // ₱499 with `sku: null` and the reason "Last-resort fallback when the Setnayan
  // AI catalog row is unreadable". `sku: null` is the category the runtime drift
  // check deliberately SKIPS, so nothing ever compared it to the live catalog —
  // and by the time it was found the real price was ₱2,499. Five times off, on
  // the page where somebody decides to pay, for weeks, with green CI.
  //
  // A fallback for a catalog row is a SKU price BY DEFINITION: it is the number
  // rendered in that SKU's place. So it can never honestly be a non-price. Name
  // the SKU (and let the runtime audit check it), or — better — delete the
  // literal and render nothing when the catalog is unreadable. A missing price
  // is recoverable; a confidently wrong one is not.
  const smell = /\b(fallback|default(s)? to|last[- ]resort)\b/i;
  const offenders = PUBLIC_PRICE_LITERALS.filter((l) => l.sku === null && smell.test(l.reason)).map(
    (l) => `${l.file} → ${l.literal}: "${l.reason}"`,
  );
  assert.deepEqual(
    offenders,
    [],
    `A literal declared as a NON-price describes itself as a fallback:\n  ` +
      offenders.join('\n  ') +
      `\n\nIf it stands in for a catalog row it IS that row's price. Name the ` +
      `sku so the runtime audit verifies it, or delete the literal and render ` +
      `no figure when the catalog cannot be read.`,
  );
});
