/**
 * 🧾 WHO NEVER CARRIES A FEE, SAID TRUTHFULLY (owner 2026-11-16, "yes change the wording"; walk EB-289).
 *
 * The client card and the For Suppliers / For Coordinators pages said "imported and returning clients never carry a
 * fee". Untrue: a client who first came through Setnayan pays on the first booking AND every repeat
 * (Vendor_Monetization_Model_LOCKED_2026-07-25 §3). The line is now "Clients who found you outside Setnayan never
 * carry a fee." This guard keeps the old wording from coming back anywhere in the app's copy.
 *
 * Run: cd apps/web && npx tsx --test lib/no-fee-wording.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { bookingFeeForecast } from './booking-fee-disclosure';

const ROOT = join(__dirname, '..');
const NEW = 'Clients who found you outside Setnayan never carry a fee.';
// "returning" next to "never carry a fee" in any order — the claim the owner retired.
const OLD = /(imported\s+(and|or)\s+returning|returning\s+clients)[^.]{0,40}never\s+carry\s+a\s+fee/i;

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
  const f = bookingFeeForecast({ kind: 'not_sourced' } as Parameters<typeof bookingFeeForecast>[0]);
  assert.ok(f && 'detail' in f && typeof f.detail === 'string');
  assert.ok((f as { detail: string }).detail.includes(NEW), (f as { detail: string }).detail);
});

test('both public pages say it too', () => {
  for (const p of ['app/for-suppliers/_components/supplier-front-page.tsx', 'app/(shell)/for-coordinators/page.tsx']) {
    const s = readFileSync(join(ROOT, p), 'utf8').replace(/\s+/g, ' ');
    assert.ok(s.includes(NEW), p);
  }
});
