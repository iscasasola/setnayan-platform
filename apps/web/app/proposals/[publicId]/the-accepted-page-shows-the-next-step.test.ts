/**
 * the-accepted-page-shows-the-next-step.test.ts
 *
 * Build plan session A4 (2026-09-10). Accepting a formal proposal only
 * shortlists the shop at a price (respond_vendor_proposal upserts
 * event_vendors, status 'shortlisted') — it does not book anything. Before
 * this fix the couple-side accepted state said only "Accepted on <date>" and
 * stopped: no line told them that booking means pressing Lock on that shop's
 * workspace page. That is a dead end on day one of the owner's live test
 * (build plan § 2 step 9).
 *
 * This is a source-scanning guard (a server component reading `auth.getUser()`
 * + several Supabase calls isn't unit-testable without a live session), so it
 * asserts on the page's SOURCE, comments stripped first — see strip-comments.ts
 * for why a naive regex strip corrupts real code.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { stripComments } from '../../../lib/strip-comments';

const PAGE_PATH = path.join(__dirname, 'page.tsx');

function source(): string {
  return stripComments(readFileSync(PAGE_PATH, 'utf8'));
}

test('the accepted couple-side state resolves a Lock link from event_vendors', () => {
  const src = source();
  // Resolved the same way accept wrote the row: by (event_id,
  // marketplace_vendor_id) — never a guessed or static route.
  assert.match(src, /from\('event_vendors'\)/);
  assert.match(src, /eq\('event_id',\s*proposal\.event_id\)/);
  assert.match(src, /eq\('marketplace_vendor_id',\s*proposal\.vendor_profile_id\)/);
  assert.match(src, /\/dashboard\/\$\{proposal\.event_id\}\/vendors\/\$\{pick\.vendor_id\}\/workspace/);
});

test('the next-step block is gated to the couple, accepted, with an event', () => {
  const src = source();
  const gate = src.match(/let lockWorkspaceHref[^;]*;\s*if \(([^)]*)\)/);
  const cond = gate?.[1];
  assert.ok(cond, 'expected the lockWorkspaceHref resolution to be gated');
  assert.match(cond, /!isVendorSide/);
  assert.match(cond, /proposal\.status === 'accepted'/);
  assert.match(cond, /proposal\.event_id/);
});

test('the next-step block only renders when a link was resolved, and only once', () => {
  const src = source();
  const occurrences = src.match(/lockWorkspaceHref \?/g) ?? [];
  // One to gate the JSX render; the read-error / not-found branches never see it.
  assert.equal(occurrences.length, 1, 'expected exactly one render gate on lockWorkspaceHref');
  assert.match(src, /You&rsquo;ve accepted\. To book \{businessName\}, ask them to lock/);
});

test('a failed event_vendors read is logged, not swallowed silent', () => {
  const src = source();
  assert.match(src, /logQueryError\('proposals\/\[publicId\]:acceptedPick'/);
});
