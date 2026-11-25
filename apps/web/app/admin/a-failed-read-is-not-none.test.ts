/**
 * Final check 25 Nov, area 8, batch 2: a failed read on an admin page is said, never drawn as "none", 0 or empty
 * (CLAUDE.md § 5 rule 4). One assertion per finding, read from the comment-stripped source, each anchored to the
 * failure flag the page must branch on BEFORE its empty line.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const code = (p: string) => strip(readFileSync(resolve(web, p), 'utf8'));

/** `failure` must appear, and must appear BEFORE `empty` (the branch that says "none"). */
function failureBeforeEmpty(file: string, failure: RegExp, empty: string) {
  const src = code(file);
  const f = src.search(failure);
  const e = src.indexOf(empty);
  assert.ok(f >= 0, `${file}: no failure branch ${failure}`);
  assert.ok(e >= 0, `${file}: empty line "${empty}" not found`);
  assert.ok(f < e, `${file}: the empty line comes before the failure branch`);
}

test('F-23 / A-24 · gifts: a refused search is not "no match"', () => {
  failureBeforeEmpty('app/admin/gifts/page.tsx', /vendorSearchFailed && !grantVendor && <ReadFailed/, 'No suppliers match');
  failureBeforeEmpty('app/admin/gifts/page.tsx', /userSearchFailed && !grantUser && <ReadFailed/, 'No user matches');
});

test('A-21 · subscriptions: a refused names read is not "Unknown supplier"', () => {
  const src = code('app/admin/subscriptions/page.tsx');
  assert.match(src, /error: vendorsErr/);
  assert.equal((src.match(/namesReadFailed \? 'Couldn’t read the supplier'/g) ?? []).length, 2);
});

test('F-19 · repost watch: no "No QR flags" / "No shop holds an allowance" over a failed read', () => {
  failureBeforeEmpty('app/admin/repost-watch/page.tsx', /\{qrError \? null : qrRows\.length === 0/, 'No QR flags');
  failureBeforeEmpty('app/admin/repost-watch/card-checks-admin.tsx', /allowRes\.error \? \(\s*<ReadFailed/, 'No shop holds an allowance');
});

test('E-11 · verification docs: a storage failure draws no shelves', () => {
  assert.match(code('app/admin/verification-docs/page.tsx'), /\{report\.listingError \? null : shelves\.map\(/);
});

test('I-7 · recommendations: counts read "—" and lists say they failed', () => {
  const src = code('app/admin/vendor-recommendations/page.tsx');
  for (const label of ['Leaves with recs', 'Active recs', 'Total recs']) {
    assert.match(src, new RegExp(`label: '${label}', value: recRes\\.error \\? '—'`));
  }
  assert.match(src, /label: 'Pending flags', value: feedbackRes\.error \? '—'/);
  failureBeforeEmpty('app/admin/vendor-recommendations/page.tsx', /recRes\.error \? \(\s*<ReadFailed/, 'No recommendations yet');
  failureBeforeEmpty('app/admin/vendor-recommendations/page.tsx', /feedbackRes\.error \? \(\s*<ReadFailed/, 'No pending flags');
});

test('I-8 · partnerships: the open-proposals heading says "not measured" on a failed read', () => {
  assert.match(code('app/admin/vendor-partnerships/page.tsx'), /right=\{proposedRowsRaw === null \? '\(not measured\)'/);
});

test('G-12 · background videos: a failed read is not an empty editor', async () => {
  assert.match(code('lib/background-videos.ts'), /if \(error\) throw new Error\(/);
  assert.match(code('app/admin/background-videos/page.tsx'), /slots === null \? <ReadFailed/);
});

test('G-9 · spotlight awards: a failed read is not "no awards" and zeroes', () => {
  const lib = code('lib/spotlight-awards.ts');
  assert.match(lib, /export async function readSpotlightAwards[\s\S]*?fetch awards failed', error\);\s*return null;/);
  failureBeforeEmpty('app/admin/studio/_surfaces/spotlight-awards-surface.tsx', /readFailed \? \(\s*<ReadFailed/, 'No awards for this month yet');
  assert.match(code('app/admin/studio/_surfaces/spotlight-awards-surface.tsx'), /value=\{readFailed \? '—' : rows\.length\}/);
});

test('F-24 · integrity watch: a refused tab count shows "—", not no badge', () => {
  const src = code('app/admin/integrity-watch/page.tsx');
  for (const n of ['openReviews', 'openListings', 'openInquiries', 'openPrices']) {
    assert.match(src, new RegExp(`\\{${n} === null \\? ' · —' :`));
  }
  assert.match(src, /r\.error \? null : r\.count/);
});
