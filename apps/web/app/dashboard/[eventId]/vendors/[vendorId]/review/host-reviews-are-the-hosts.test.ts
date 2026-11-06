/**
 * GUARD — 🔒 A HOST REVIEW IS THE HOSTS' (owner, 6 Nov 2026): the couple and their co-hosts write it; a coordinator —
 * a supplier on the same event — does NOT. Refused in three places, so no single one is the only fence:
 *
 *   1. the rule itself — `isHostReviewer` is true for member_type 'couple' only;
 *   2. the server action — a coordinator who posts the form is sent back to the refusal, BEFORE any write;
 *   3. the page — a coordinator who opens it reads "The couple reviews …", never the form;
 *   4. the database — the INSERT policy admits current_couple_event_ids() only (tests/db/host-and-guest-reviews.db.test.ts
 *      proves a coordinator's insert lands nothing).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isHostReviewer } from '@/lib/reviews';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIONS = stripComments(readFileSync(join(HERE, 'actions.ts'), 'utf8'));
const PAGE = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
const REFUSAL = stripComments(readFileSync(join(HERE, '_components', 'coordinator-refused-state.tsx'), 'utf8'));
const MIGRATION = readFileSync(
  join(HERE, '..', '..', '..', '..', '..', '..', '..', '..', 'supabase', 'migrations', '20271316933967_host_and_guest_reviews.sql'),
  'utf8',
).replace(/--.*$/gm, '');

test('1 · the couple and co-hosts are hosts; a coordinator is not', () => {
  assert.equal(isHostReviewer('couple'), true);
  assert.equal(isHostReviewer('coordinator'), false);
  assert.equal(isHostReviewer('helper'), false);
  assert.equal(isHostReviewer(null), false);
});

test('2 · the action refuses a coordinator before it writes anything', () => {
  const body = ACTIONS.slice(ACTIONS.indexOf('export async function submitCoupleReview'), ACTIONS.indexOf('export async function submitReviewAppeal'));
  const refuse = body.indexOf('if (!isHostReviewer(');
  const write = body.indexOf('createReview(supabase');
  assert.ok(refuse > 0, 'the coordinator refusal is gone from submitCoupleReview');
  assert.ok(write > refuse, 'the review is written before the coordinator is refused');
  assert.match(body.slice(refuse, refuse + 200), /redirect\(`\/dashboard\/\$\{eventId\}\/vendors\/\$\{eventVendorId\}\/review\?refused=coordinator`\)/);
});

test('3 · the page shows a coordinator the refusal, not the form', () => {
  assert.match(PAGE, /<CoordinatorRefusedState/);
  assert.match(REFUSAL, /The couple reviews \{vendorName\}/);
  const gate = PAGE.indexOf('<CoordinatorRefusedState');
  const form = PAGE.indexOf('action={submitCoupleReview}');
  assert.ok(gate > 0 && form > gate, 'the refusal must return before the form is drawn');
});

test('4 · the database admits the hosts only — insert and delete', () => {
  const insert = MIGRATION.slice(MIGRATION.indexOf('CREATE POLICY vendor_reviews_couple_insert'));
  assert.match(insert.slice(0, 600), /current_couple_event_ids\(\)/);
  assert.doesNotMatch(insert.slice(0, 600), /coordinator/);
  const del = MIGRATION.slice(MIGRATION.indexOf('CREATE POLICY vendor_reviews_couple_delete'));
  assert.match(del.slice(0, 300), /current_couple_event_ids\(\)/);
});
