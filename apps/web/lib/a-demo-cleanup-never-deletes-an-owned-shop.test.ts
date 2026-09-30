/**
 * A demo clean-up deletes SEEDED shops only — never a real account's shop.
 *
 * Until 2026-09-30 every row with `vendor_profiles.is_demo = true` was synthetic:
 * `scripts/seed-demo-vendors.ts` creates them with `user_id: null`, and the admin
 * "Cleanup ALL demo vendors" button deleted by the flag alone. Then the owner
 * ruled (DECISION_LOG 2026-09-29 "LANE 2 §2C" (1)) that the two trial shops —
 * SetnaProd and Saysay, both OWNED by real accounts, one with real bookings —
 * become `is_demo = true` so they leave the public shelves. From that day a
 * flag-only delete would have erased them in one click, bookings and all.
 *
 * 🔑 The flag now means "do not show this to the public", not "this row is
 * disposable". Ownerless (`user_id IS NULL`) is what disposable means.
 *
 * This reads every source file that deletes from `vendor_profiles` by
 * `is_demo` and requires the same statement to also require `user_id` null.
 * SABOTAGE: remove `.is('user_id', null)` from any one route → RED, naming it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WEB = join(__dirname, '..');
const ROOTS = ['app', 'lib', 'scripts'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

/** Every `from('vendor_profiles') … ;` statement that deletes. */
function vendorProfileDeletes(src: string): string[] {
  const out: string[] = [];
  const re = /\.from\(\s*['"]vendor_profiles['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const end = src.indexOf(';', m.index);
    const stmt = src.slice(m.index, end === -1 ? undefined : end);
    if (/\.delete\(/.test(stmt)) out.push(stmt);
  }
  return out;
}

test('every delete-by-is_demo on vendor_profiles also requires an ownerless row', () => {
  const found: string[] = [];
  const unsafe: string[] = [];
  for (const root of ROOTS) {
    for (const file of walk(join(WEB, root))) {
      const src = readFileSync(file, 'utf8');
      for (const stmt of vendorProfileDeletes(src)) {
        if (!/\.eq\(\s*['"]is_demo['"]\s*,\s*true\s*\)/.test(stmt)) continue;
        const rel = relative(WEB, file);
        found.push(rel);
        if (!/\.is\(\s*['"]user_id['"]\s*,\s*null\s*\)/.test(stmt)) unsafe.push(rel);
      }
    }
  }
  // Precondition: the four admin routes were actually read. A walker that
  // silently found nothing would pass this test forever.
  assert.ok(found.length >= 4, `expected the four demo clean-up deletes, found ${found.length}: ${found.join(', ')}`);
  assert.deepEqual(
    unsafe,
    [],
    'these delete every is_demo shop, including the real accounts\' shops marked demo on 2026-09-30 — add .is(\'user_id\', null)',
  );
});
