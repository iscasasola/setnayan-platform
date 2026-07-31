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
  assert.ok(backed.length >= 4, 'expected the real SKU prices to stay SKU-backed');
  for (const l of backed) assert.ok(l.sku.length > 0);
});
