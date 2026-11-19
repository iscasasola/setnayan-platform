/**
 * 🧾 WHO NEVER CARRIES A FEE, SAID TRUTHFULLY (owner 2026-11-16, "yes change the wording"; walk EB-289).
 *
 * The client card and the For Suppliers / For Coordinators pages said "imported and returning clients never carry a
 * fee". Untrue: a client who first came through Setnayan pays on the first booking AND every repeat
 * (Vendor_Monetization_Model_LOCKED_2026-07-25 §3). The line is now "Clients who found you outside Setnayan never
 * carry a fee." ⟲ The same day the owner closed the outside door too (answer 3, after d4899cd5 · 9fe95ebe · 1abf35b):
 * a booking is free only as the first supplier to bring an event, or for a year with a couple the supplier brought onto
 * Setnayan — so "found you outside Setnayan" and "your own clients never carry a fee" are retired as well, and every page
 * quotes the ONE rule in `lib/booking-fee-who-words.ts`. This guard keeps all three old promises from coming back.
 *
 * Run: cd apps/web && npx tsx --test lib/no-fee-wording.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { bookingFeeForecast } from './booking-fee-disclosure';
import { FEE_FREE_RULE } from './booking-fee-who-words';

const ROOT = join(__dirname, '..');
const NEW = FEE_FREE_RULE;
// The three retired promises: "returning clients…", "…found you outside Setnayan…" and "own clients…" next to
// "never carry a fee" / "always free" / "stay free".
const OLD =
  /(imported\s+(and|or)\s+returning|returning\s+clients|outside\s+Setnayan|own\s+clients)[^.]{0,60}(never\s+carr(y|ies)\s+(a|the)\s+(booking\s+)?fee|(are|is)\s+always\s+free|stay\s+free)/i;

function* files(dir: string): Generator<string> {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.next' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(tsx?|mdx?|json)$/.test(n) && !/\.test\.tsx?$/.test(n)) yield p;
  }
}

test('the retired "returning clients never carry a fee" wording is nowhere in app/, lib/ or components/', () => {
  const hits: string[] = [];
  let scanned = 0;
  for (const d of ['app', 'lib', 'components']) {
    try {
      statSync(join(ROOT, d));
    } catch {
      continue;
    }
    for (const f of files(join(ROOT, d))) {
      scanned++;
      const s = readFileSync(f, 'utf8').replace(/\s+/g, ' ');
      if (OLD.test(s)) hits.push(relative(ROOT, f));
    }
  }
  assert.ok(scanned > 500, `scanned only ${scanned} files — the walk is not reaching the app`);
  assert.deepEqual(hits, []);
});

test('the client card says the owner-approved sentence', () => {
  const f = bookingFeeForecast({ kind: 'not_sourced' } as Parameters<typeof bookingFeeForecast>[0], null);
  assert.ok(f && 'detail' in f && typeof f.detail === 'string');
  assert.ok((f as { detail: string }).detail.includes(NEW), (f as { detail: string }).detail);
});

test('both public pages quote the one rule', () => {
  for (const p of ['app/for-suppliers/_components/supplier-front-page.tsx', 'app/(shell)/for-coordinators/page.tsx']) {
    const s = readFileSync(join(ROOT, p), 'utf8');
    assert.ok((s.match(/\{FEE_FREE_RULE\}/g) ?? []).length >= 2, `${p} no longer quotes FEE_FREE_RULE`);
    assert.ok(s.includes('{FEE_FREE_CHIP}'), `${p} lost the owner's chip words`);
  }
});
