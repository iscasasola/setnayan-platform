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
  /* ✏️ EVOLVED 2026-09-19 (AREA-CHAT). This asserted the WORKSPACE route —
     `/vendors/${pick.vendor_id}/workspace` — on the belief that Lock lives
     there. It does not: the one lock path mounts on the Vendors page (bench +
     "Your team"), and since #5614 a bare workspace landing redirects to the
     conversation. The destination is now the shared rule in lib/lock-door.ts,
     fed the pick's own category so the bench opens on the right tile. */
  assert.match(src, /lockDoorHref = coupleLockDoorHref\(\s*proposal\.event_id,/);
  assert.match(src, /\.select\('vendor_id, category'\)/, 'the pick is read without its category — the door cannot pick a tile');
  assert.doesNotMatch(src, /lockDoorHref = `[^`]*\/workspace`/, 'the lock link points at the workspace, which holds no Lock');
});

test('the next-step block is gated to the couple, accepted, with an event', () => {
  const src = source();
  const gate = src.match(/let lockDoorHref[^;]*;\s*if \(([^)]*)\)/);
  const cond = gate?.[1];
  assert.ok(cond, 'expected the lockDoorHref resolution to be gated');
  assert.match(cond, /!isVendorSide/);
  assert.match(cond, /proposal\.status === 'accepted'/);
  assert.match(cond, /proposal\.event_id/);
});

test('the next-step block only renders when a link was resolved, and only once', () => {
  const src = source();
  const occurrences = src.match(/lockDoorHref \?/g) ?? [];
  // One to gate the JSX render; the read-error / not-found branches never see it.
  assert.equal(occurrences.length, 1, 'expected exactly one render gate on lockDoorHref');
  assert.match(src, /You&rsquo;ve accepted\. To book \{businessName\}, ask them to lock/);
});

test('a failed event_vendors read is logged, not swallowed silent', () => {
  const src = source();
  assert.match(src, /logQueryError\('proposals\/\[publicId\]:acceptedPick'/);
});
