/**
 * verification-upload-gate-normalises-like-the-database.test.ts
 *
 * CLEANUPS bundle (D3 override, 2026-09-11) — the two app-side verification-
 * upload gates (`app/vendor-dashboard/verify/actions.ts`,
 * `app/vendor-dashboard/shop/inline-docs-actions.ts`) still gated their
 * ownership check on a plain `ref.startsWith('r2://')`: exact-case, and
 * trusting `.trim()` alone to have removed anything unusual up front. A value
 * spelled `R2://…`, or carrying a leading character `.trim()` doesn't strip,
 * made that test FALSE — which took the "not a ref, nothing to check" branch
 * of an `||` chain and wrote the value straight into `doc_uploads`. The
 * database's #5414 RESTRICTIVE policy
 * (`supabase/migrations/20271219262486_every_cleanup_delete_is_pinned.sql`)
 * normalises before judging (strip every leading non-alnum, lower-case, test
 * for `r2:`) and refused the write anyway — but as a raw
 * "new row violates row-level security policy" error, not a plain refusal.
 *
 * `looksLikeStorageRef` (lib/r2-client-ref.ts) is the SAME normalisation,
 * reused by both gates so a foreign ref is caught and refused in plain English
 * before the database ever sees it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { looksLikeStorageRef, parseClientRef, vendorVerificationDocPolicy } from './r2-client-ref';

const HERE = import.meta.dirname;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
}

/* ── 1 · looksLikeStorageRef matches the database's own normalisation ──────── */

test('looksLikeStorageRef: the canonical, lower-case form looks like a ref', () => {
  assert.equal(looksLikeStorageRef('r2://setnayan-vendor-verification/vendors/v1/verification/x.pdf'), true);
});

test('looksLikeStorageRef: an upper-cased scheme still looks like a ref', () => {
  assert.equal(looksLikeStorageRef('R2://setnayan-media/vendors/v1/x.pdf'), true);
});

test('looksLikeStorageRef: a leading tab/space/NBSP/BOM still looks like a ref', () => {
  assert.equal(looksLikeStorageRef('\t r2://setnayan-media/vendors/v1/x.pdf'), true);
  assert.equal(looksLikeStorageRef(' r2://setnayan-media/vendors/v1/x.pdf'), true);
  assert.equal(looksLikeStorageRef('﻿r2://setnayan-media/vendors/v1/x.pdf'), true);
});

test('looksLikeStorageRef: mixed case + padding together still looks like a ref', () => {
  assert.equal(looksLikeStorageRef('  \tR2://setnayan-media/vendors/v1/x.pdf'), true);
});

test('looksLikeStorageRef: a legacy https URL does not look like a ref', () => {
  assert.equal(looksLikeStorageRef('https://media.setnayan.com/vendors/v1/x.pdf'), false);
});

test('looksLikeStorageRef: a bare filename or an empty string does not look like a ref', () => {
  assert.equal(looksLikeStorageRef('x.pdf'), false);
  assert.equal(looksLikeStorageRef(''), false);
});

/* ── 2 · a foreign ref that LOOKS like a ref still fails the exact policy ──── */

test('a foreign-vendor ref padded with a BOM is refused by the exact-prefix policy', () => {
  const foreign = '﻿r2://setnayan-vendor-verification/vendors/OTHER-VENDOR/verification/id.pdf';
  assert.equal(looksLikeStorageRef(foreign), true, 'must be recognised as ref-shaped first');
  assert.equal(
    parseClientRef(foreign, vendorVerificationDocPolicy('v1')),
    null,
    'parseClientRef is strict and case/whitespace-sensitive on the actual match — the BOM is not stripped there',
  );
});

/* ── 3 · both write gates use the shared normaliser, not the old exact check ─ */

const GATES = [
  path.join(HERE, '..', 'app', 'vendor-dashboard', 'verify', 'actions.ts'),
  path.join(HERE, '..', 'app', 'vendor-dashboard', 'shop', 'inline-docs-actions.ts'),
];

for (const file of GATES) {
  const rel = path.relative(path.join(HERE, '..'), file);

  test(`${rel}: imports and calls looksLikeStorageRef`, () => {
    const src = stripComments(readFileSync(file, 'utf8'));
    assert.ok(src.includes('looksLikeStorageRef'), `${rel} no longer references looksLikeStorageRef`);
  });

  test(`${rel}: no longer gates ownership on the raw, exact-case startsWith('r2://')`, () => {
    const src = stripComments(readFileSync(file, 'utf8'));
    assert.ok(
      !/\.startsWith\('r2:\/\/'\)/.test(src),
      `${rel} still gates on a raw ref.startsWith('r2://') — a padded/upper-cased ` +
        'foreign ref would again skip the ownership check and hit the database\'s ' +
        'raw RLS error instead of a plain refusal.',
    );
  });
}
