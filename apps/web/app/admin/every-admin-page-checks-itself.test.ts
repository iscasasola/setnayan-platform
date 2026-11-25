/**
 * A8·L-1 / A8·L-2 (final check 25 Nov) — every /admin page asks for an admin ITSELF.
 *
 * `lib/admin/require-admin.ts` states the rule: a Next.js layout is NOT a safe auth boundary, so a
 * page under /admin calls `requireAdmin()`. Five pages leaned on the layout alone (the government-ID
 * shelf among them, read with the service role). This test derives the page list from the folder,
 * so a new admin page is covered the day it ships.
 *
 * A page that only forwards to another address (`redirect(...)` and nothing else rendered) has no
 * content of its own and is exempt BY SHAPE, not by a hand list: it contains no JSX and no
 * Supabase client.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const adminDir = dirname(fileURLToPath(import.meta.url));
const web = resolve(adminDir, '..', '..');

function pages(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...pages(p));
    else if (name === 'page.tsx') out.push(p);
  }
  return out;
}

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function isForwardOnly(src: string): boolean {
  const code = strip(src);
  const forwards = /\b(redirect|permanentRedirect)\(/.test(code);
  const renders = /(return|=>)\s*\(?\s*<[A-Za-z]/.test(code);
  const reads = /createAdminClient\(|createClient\(/.test(code);
  return forwards && !renders && !reads;
}

const all = pages(adminDir);

test('the scan finds the admin pages (not vacuous)', () => {
  assert.ok(all.length > 60, `expected the admin tree, found ${all.length} pages`);
  const forwardOnly = all.filter((p) => isForwardOnly(readFileSync(p, 'utf8')));
  assert.ok(forwardOnly.length < all.length / 2, 'most admin pages render something');
});

test('every admin page that renders or reads calls requireAdmin() itself', () => {
  const missing = all
    .filter((p) => {
      const src = readFileSync(p, 'utf8');
      if (isForwardOnly(src)) return false;
      return !/\brequireAdmin\(\)/.test(strip(src));
    })
    .map((p) => relative(web, p));
  assert.deepEqual(missing, [], `these admin pages lean on the layout gate alone:\n${missing.join('\n')}`);
});
