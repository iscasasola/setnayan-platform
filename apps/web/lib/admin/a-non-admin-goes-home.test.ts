/**
 * 🏠 A NON-ADMIN WHO OPENS /admin GOES HOME (Batch 0 · L1, MASTER-PLAN A8 + D6, walk 27 Nov).
 *
 *  · D6: a signed-in account that is not on the team opened `/admin` and got the 404 page, which Admin › Problems then
 *    logged as a not_found.
 *  · A8: a sign-in whose `next` was `/admin` (an account added on a phone an admin had used) landed on that same 404.
 *
 * Both are one gate: `requireAdmin` (the layout's and every admin page's) sends a signed-in non-admin to Home. A sign-in
 * still honours the named `next` as given; the gate is what turns a `next` the account cannot open into Home, so the
 * magic-link and Google returns get the same answer with no second rule.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { signInDestination } from '../sign-in-landing';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function body(src: string, name: string): string {
  const at = src.indexOf(`export async function ${name}(`);
  assert.ok(at >= 0, `${name} is exported`);
  const open = src.indexOf(' {\n', at) + 1;
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`${name}: unbalanced`);
}

const gate = strip(read('lib/admin/require-admin.ts'));

test('the page gate sends a signed-in non-admin Home, never to a 404', () => {
  const page = body(gate, 'requireAdmin');
  assert.match(page, /if \(!gate\.isAdmin\) redirect\(NOT_ADMIN_LANDING\)/);
  assert.doesNotMatch(page, /notFound\(/, 'a 404 strands the person and is logged as not_found in Problems');
  assert.match(gate, /export const NOT_ADMIN_LANDING = '\/';/, 'Home is `/`, which opens the account\'s own Home');
  assert.doesNotMatch(gate, /from 'next\/navigation';[\s\S]*notFound/, 'the gate no longer imports notFound at all');
});

test('signed out still goes to sign-in first, and a server action still refuses', () => {
  const page = body(gate, 'requireAdmin');
  assert.match(page, /if \(!gate\.userId\) redirect\(loginRedirectPath\('\/admin'\)\)/);
  assert.match(body(gate, 'requireAdminAction'), /throw new Error\('Forbidden'\)/);
});

test('the console layout asks the same gate', () => {
  assert.match(strip(read('app/admin/layout.tsx')), /await requireAdmin\(\);/);
});

test('A8: a sign-in honours next=/admin as given; the gate then turns it into Home for a non-admin', () => {
  for (const type of ['customer', 'vendor', null]) {
    assert.equal(signInDestination('/admin', type), '/admin', 'the sign-in does not guess who is on the team');
  }
});
