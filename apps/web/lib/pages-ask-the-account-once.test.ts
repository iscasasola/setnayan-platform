/**
 * 🔒 A PAGE OR LAYOUT ASKS FOR THE ACCOUNT THROUGH `getCurrentUser()` — NEVER `supabase.auth.getUser()` ITSELF
 * (speed pass 2026-11-18).
 *
 * `getCurrentUser()` (`lib/auth.ts`) is `React.cache()`d: every reader in one render shares ONE Auth-server round
 * trip. A page that called `supabase.auth.getUser()` directly paid its own — measured 18 Nov 2026 on da4a079: 137
 * pages did, each on top of the layout's own call. All were moved by one codemod; this guard keeps them moved.
 *
 * Equivalent, not merely close: the direct call and the cached one read the same cookie-scoped client, and on the
 * cached hub/shop routes (`lib/hub-request.ts`) — the one place `getCurrentUser` answers without the request — the
 * middleware only sends requests that carry NO session, so the direct call would have answered null as well.
 *
 * A page that truly needs a second, fresh read in one render (none does today) adds itself to `FRESH` with the reason.
 * Route handlers and server actions are out of scope: `cache()` memoizes nothing there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const ROOT = join(__dirname, '..');
const APP = join(ROOT, 'app');

/** file (relative to apps/web) → why it needs its own fresh read. */
const FRESH: Record<string, string> = {};

function directAuthReads(source: string): number {
  return (stripComments(source).match(/\.auth\s*\.\s*getUser\s*\(/g) ?? []).length;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === 'page.tsx' || name === 'layout.tsx') out.push(p);
  }
  return out;
}

test('the detector sees a direct call and ignores one named in a comment', () => {
  assert.equal(directAuthReads('const { data: { user } } = await supabase.auth.getUser();'), 1);
  assert.equal(directAuthReads('const r = await (await createClient()).auth\n  .getUser();'), 1);
  assert.equal(directAuthReads('// this used a bare `supabase.auth.getUser()`\nconst user = await getCurrentUser();'), 0);
});

test('no page or layout calls supabase.auth.getUser() itself', () => {
  const files = walk(APP);
  assert.ok(files.length > 400, `anti-vacuity: walked ${files.length} pages and layouts`);
  const offenders = files
    .map((f) => relative(ROOT, f))
    .filter((f) => !(f in FRESH) && directAuthReads(readFileSync(join(ROOT, f), 'utf8')) > 0);
  assert.deepEqual(offenders, [], `use getCurrentUser() from '@/lib/auth' (one Auth round trip per render): ${offenders.join(', ')}`);
  for (const f of Object.keys(FRESH)) assert.ok(directAuthReads(readFileSync(join(ROOT, f), 'utf8')) > 0, `${f} is listed in FRESH but no longer reads fresh`);
});
