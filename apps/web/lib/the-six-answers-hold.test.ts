/**
 * the-six-answers-hold.test.ts — the owner's answers to C2's six open questions (2026-11-15, specs DECISION_LOG
 * e8650540 "C2's SIX OPEN QUESTIONS — ANSWERED"), built: CYC-05 · CYC-16 · CYC-15b. (F-W2-26 · F-W2-22 · F-W2-19 were
 * answered "keep as built" — their own guards already pin them.) Run from apps/web:
 *   npx tsx --test lib/the-six-answers-hold.test.ts
 *
 * SABOTAGE — every test below was run against origin/main's files (the change reverted) and went RED before commit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { NEW_TO_SETNAYAN_LABEL, NO_REVIEWS_YET_LABEL } from '@/lib/reviews';

const WEB = join(import.meta.dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('CYC-05 · a shop found by its typed NAME passes the event-type scope; browsing still filters by what it serves', () => {
  // server-only module: read, not imported.
  const src = code('lib/wizard-recommendations.ts');
  const fn = /export function nameMatchesFilter\(safe: string\): string \{\s*return (`[^`]*`);\s*\}/.exec(src)?.[1] ?? '';
  assert.equal(fn, '`business_name.ilike.%${safe}%`', 'the name clause matches more (or less) than the shop\'s name');
  // With a typed name: event_types OR the name. Without one: event_types only — the category list is unchanged.
  assert.match(
    src,
    /safe\.length > 0\s*\?\s*`event_types\.is\.null,event_types\.cs\.\{\$\{args\.eventType\}\},\$\{nameMatchesFilter\(safe\)\}`\s*:\s*`event_types\.is\.null,event_types\.cs\.\{\$\{args\.eventType\}\}`/,
    'a weddings-only shop typed by name is still dropped from a birthday\'s results',
  );
});

test('CYC-16 · a supplier\'s reply is signed "Shop · Name"; a co-host keeps their own name', () => {
  const src = code('lib/chat-thread-receipts.server.ts');
  assert.match(src, /return shop \? `\$\{shop\} · \$\{first\}` : first;/, 'the signature is not "Shop · Name"');
  assert.match(src, /senderNames\[u\.user_id\] = senders\.has\(u\.user_id\) \? shopSignature\(args\.shopName, first\) : first;/);
  assert.match(code('app/dashboard/[eventId]/messages/[threadId]/page.tsx'), /revealed: v\.revealed,\s*shopName: v\.name,/, 'the couple page does not hand the shop name in');
});

test('CYC-15b · "New to Setnayan" only for a shop with NO bookings; bookings and no reviews says "No reviews yet"', () => {
  assert.equal(NEW_TO_SETNAYAN_LABEL, 'New to Setnayan');
  assert.equal(NO_REVIEWS_YET_LABEL, 'No reviews yet');
  const bench = code('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');
  const picks = bench.match(/v\.bookedCount === 0 \? NEW_TO_SETNAYAN_LABEL : NO_REVIEWS_YET_LABEL/g) ?? [];
  assert.equal(picks.length, 2, 'a card still says "New to Setnayan" without asking about bookings');
  assert.doesNotMatch(bench, /\{NEW_TO_SETNAYAN_LABEL\}/, 'a bare "New to Setnayan" is still drawn');
  // Both feeds count confirmed bookings, and a refused read is unknown (null), never 0 — 0 would call a shop "new".
  const page = code('app/dashboard/[eventId]/vendors/page.tsx');
  assert.match(page, /\.in\('marketplace_vendor_id', marketplaceIds\)\s*\.in\('status', \[\.\.\.CONFIRMED_VENDOR_STATUSES\]\)/);
  assert.match(page, /booked_count: bookedByProfile \? \(bookedByProfile\.get\(pid\) \?\? 0\) : null,/);
  const search = code('app/dashboard/[eventId]/vendors/_actions/category-search.ts');
  assert.match(search, /\.in\('marketplace_vendor_id', ids\)\s*\.in\('status', \[\.\.\.CONFIRMED_VENDOR_STATUSES\]\)/);
  assert.match(search, /bookedCount: bookedByVendor \? \(bookedByVendor\.get\(r\.vendor_profile_id\) \?\? 0\) : null,/);
  assert.match(code('lib/shortlist-taxonomy.ts'), /bookedCount: ext\?\.booked_count \?\? null,/);
});
