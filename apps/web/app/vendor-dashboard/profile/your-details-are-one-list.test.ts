/**
 * YOUR DETAILS ARE ONE LIST — and nothing the profile checks fell out of it (simpler supplier dashboard step 5).
 *
 *   1 · every key `businessProfileChecklist` checks lands in exactly ONE fold — a key in none would be a field the
 *       supplier is told is missing with nowhere on the screen to fill it in;
 *   2 · the list runs in the prototype's order: Name and logo · What you do · Where you work · Contact · About ·
 *       Your documents · How clients pay you · Something wrong?;
 *   3 · the account panel's supplier rows go to pages that exist, and only owners and admins get them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { DETAILS_CHECKLIST_KEYS } from '@/lib/supplier-details';
import { scopedMemberAvatarRows, supplierAvatarRows } from '../_components/supplier-avatar-rows';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · every checklist key is in exactly one fold', () => {
  const lib = src('lib/vendor-profile.ts');
  const at = lib.indexOf('export function businessProfileChecklist(');
  const body = lib.slice(at, lib.indexOf('\n}\n', at));
  const keys = [...body.matchAll(/key: '([a-z_]+)'/g)].map((m) => m[1]!);
  assert.ok(keys.length >= 8, `found only ${keys.length} checklist keys — the scan has gone blind`);
  const folds = Object.values(DETAILS_CHECKLIST_KEYS).flat();
  for (const k of keys) {
    assert.equal(folds.filter((f) => f === k).length, 1, `checklist key "${k}" is in ${folds.filter((f) => f === k).length} folds of Your details`);
  }
});

test('2 · the list runs in the prototype’s order', () => {
  const s = src('app/vendor-dashboard/profile/_components/details-screen.tsx');
  const order = ['anchor="name"', 'anchor="what"', 'anchor="where"', 'anchor="contact"', 'data="details-about"', 'anchor="docs"', 'anchor="pay"', 'anchor="fix"'];
  let last = -1;
  for (const o of order) {
    const i = s.indexOf(o);
    assert.ok(i > last, `${o} is missing or out of order`);
    last = i;
  }
  // Each checklist fold mounts the editor with ITS keys only.
  for (const k of ['name', 'what', 'where', 'contact']) {
    assert.match(s, new RegExp(`items=\\{items\\('${k}'\\)\\}`), `the ${k} fold does not hand the editor its own rows`);
  }
});

test('3 · the account panel rows go somewhere real, and only for owners and admins', () => {
  const rows = supplierAvatarRows();
  assert.deepEqual(
    rows.map((r) => r.label),
    ['Your details', 'Your page', 'Your collections', 'Helpers', 'Plan', 'Settings'],
  );
  for (const r of rows) {
    const page = join(WEB, 'app', r.href.replace(/^\//, ''), 'page.tsx');
    assert.ok(existsSync(page), `${r.label} goes to ${r.href}, which has no page`);
  }
  // Step 6 owns the finished sheet: the owner rows go to owners and admins; a scoped member gets Settings alone;
  // Plan never in the store shell (supplier batch, 2026-10-15).
  assert.match(
    src('app/vendor-dashboard/layout.tsx'),
    /canManageVendor\(vendorRole\) \|\| !vendorRole \? supplierAvatarRows\(\{ storeShell \}\) : scopedMemberAvatarRows\(\)/,
    'the supplier rows are not gated to owners and admins',
  );
  assert.ok(!supplierAvatarRows({ storeShell: true }).some((r) => r.label === 'Plan'), 'Plan shows in the store shell');
  assert.deepEqual(scopedMemberAvatarRows().map((r) => r.label), ['Settings'], 'a scoped member sees owner rooms');
});
