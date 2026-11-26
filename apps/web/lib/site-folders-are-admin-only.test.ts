/**
 * A8·G-4 (final check 25 Nov) — the site's own upload folders are an admin's.
 *
 * Measured on the staging copy: a signed-in COUPLE asked `/api/upload` for `homepage-bg/slot-0`
 * and got a 200 with an upload URL; `hub-music/` (the one folder that was guarded) gave a 403.
 * This holds the claim three ways: the rule names every flat site folder an ADMIN screen presigns,
 * the rule refuses nothing it should not, and the route asks the admin question for it BEFORE any
 * URL is signed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_ONLY_UPLOAD_ROOTS, isAdminOnlyUploadPrefix } from './upload-prefix-tenancy';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(resolve(web, p), 'utf8');

test('the two admin screens that presign a site folder are covered', () => {
  // Derived from the screens themselves, not typed twice.
  const bg = read('app/admin/background-videos/background-videos-manager.tsx');
  const ob = read('app/admin/ugat/_surfaces/onboarding-surface.tsx');
  const bgRoot = /`(homepage-bg)\/slot-/.exec(bg)?.[1];
  const obRoot = /pathPrefix="([a-z-]+)\//.exec(ob)?.[1];
  assert.equal(bgRoot, 'homepage-bg');
  assert.equal(obRoot, 'onboarding');
  for (const root of [bgRoot!, obRoot!]) {
    assert.ok(ADMIN_ONLY_UPLOAD_ROOTS.has(root), `${root}/ must be admin-only`);
    assert.equal(isAdminOnlyUploadPrefix(`${root}/slot-0`), true);
  }
});

test('the rule reads the FIRST segment only and ignores case', () => {
  assert.equal(isAdminOnlyUploadPrefix('Homepage-BG/slot-1'), true);
  assert.equal(isAdminOnlyUploadPrefix('/onboarding/background-music'), true);
  // A couple's own folders are not touched by this rule.
  assert.equal(isAdminOnlyUploadPrefix('events/00000000-0000-4000-8000-000000000000/homepage-bg'), false);
  assert.equal(isAdminOnlyUploadPrefix('papic/onboarding'), false);
  assert.equal(isAdminOnlyUploadPrefix('locked-qr-proof'), false);
  assert.equal(isAdminOnlyUploadPrefix(''), false);
});

test('the route refuses a non-admin for these folders before it signs anything', () => {
  const route = read('app/api/upload/route.ts');
  const gate = route.indexOf('isAdminOnlyUploadPrefix(pathPrefix)');
  const sign = route.indexOf('presignUploadUrl(');
  assert.ok(gate > 0, 'the route must call isAdminOnlyUploadPrefix');
  assert.ok(sign > gate, 'the admin question must come before the presign');
  const block = route.slice(gate, gate + 700);
  assert.match(block, /isAdminProfile\(me\)/);
  assert.match(block, /status: 403/);
});
