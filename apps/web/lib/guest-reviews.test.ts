/**
 * guest-reviews.test.ts — THE GUEST REVIEW CONTRACT (owner, 6 Nov 2026).
 *
 *   1. A guest reads as "Gabriel D." (first name + initial, ruling A) or "G. D." — never the full surname.
 *   2. The ONE writer turns every refusal into a sentence the screen can show; an unknown failure is never "sent".
 *   3. The read is HONEST — three states: refused → said, none → no group, rows → the group. A refused read is
 *      never turned into "no guest reviews" over a shop that has forty (the lib/guests.ts precedent).
 *   4. A guest review NEVER moves the shop's overall: no guest-review code reads or writes the hosts' trusted stats,
 *      and the hosts' overall still reads `vendor_trusted_review_stats` alone (the DB half is
 *      tests/db/host-and-guest-reviews.db.test.ts).
 *
 * Behaviour is tested against a stubbed client; the rest by source.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  guestShownName,
  refusalFromError,
  readGuestReviewsForVendor,
  submitGuestReview,
  GUEST_REVIEW_REFUSAL_LINE,
} from '@/lib/guest-reviews';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

type Result = { data: unknown; error: unknown };

/** A per-table stub: `from(table)` resolves that table's result through any chain; `rpc` resolves `rpcResult`. */
function stub(tables: Record<string, Result>, rpcResult: Result = { data: null, error: null }): SupabaseClient {
  const builderFor = (table: string) => {
    const result = tables[table] ?? { data: [], error: null };
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'is', 'order', 'not', 'in', 'limit', 'or']) b[m] = () => b;
    b.maybeSingle = () => Promise.resolve(result);
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return b;
  };
  return { from: (t: string) => builderFor(t), rpc: () => Promise.resolve(rpcResult) } as unknown as SupabaseClient;
}

const ROW = {
  review_id: 'r1',
  vendor_profile_id: 'v1',
  event_id: 'e1',
  guest_id: 'g1',
  service_id: 's1',
  rating_overall: 5,
  line: 'The aisle flowers.',
  capture_id: null,
  shown_as: 'name',
  vendor_reply: null,
  vendor_reply_at: null,
  hidden_at: null,
  created_at: '2026-11-06T00:00:00Z',
};

test('1 · a guest is "Gabriel D." or "G. D." — never the full surname, never blank', () => {
  assert.equal(guestShownName('Gabriel', 'Dela Cruz', 'name'), 'Gabriel D.');
  assert.equal(guestShownName('Gabriel', 'Dela Cruz', 'initials'), 'G. D.');
  assert.equal(guestShownName(null, null, 'name'), 'A guest');
  assert.equal(guestShownName('', '  ', 'initials'), 'A guest');
  assert.doesNotMatch(guestShownName('Gabriel', 'Dela Cruz', 'name'), /Cruz/);
});

test('2 · every refusal the writer raises has its own sentence; anything else is "unknown", never sent', async () => {
  assert.equal(refusalFromError('not_at_event'), 'not_at_event');
  assert.equal(refusalFromError('ERROR: already_reviewed (23505)'), 'already_reviewed');
  assert.equal(refusalFromError('connection reset'), 'unknown');
  for (const line of Object.values(GUEST_REVIEW_REFUSAL_LINE)) assert.ok(line.length > 0);

  const refused = await submitGuestReview(stub({}, { data: null, error: { message: 'not_at_event' } }), {
    eventId: 'e1',
    guestId: 'g1',
    vendorProfileId: 'v1',
    serviceId: null,
    stars: 5,
    line: null,
    captureId: null,
    shownAs: 'name',
  });
  assert.deepEqual(refused, { ok: false, refusal: 'not_at_event' });

  const sent = await submitGuestReview(stub({}, { data: 'r9', error: null }), {
    eventId: 'e1',
    guestId: 'g1',
    vendorProfileId: 'v1',
    serviceId: null,
    stars: 4,
    line: 'Lovely.',
    captureId: null,
    shownAs: 'initials',
  });
  assert.deepEqual(sent, { ok: true, reviewId: 'r9' });
});

test('3a · a REFUSED read is said — never an empty "From guests"', async () => {
  const got = await readGuestReviewsForVendor(
    stub({ vendor_guest_reviews: { data: null, error: { message: 'permission denied', code: '42501' } } }),
    'v1',
  );
  assert.deepEqual(got, { state: 'refused' });
});

test('3b · no rows is "none" — the page then draws no guest group at all', async () => {
  const got = await readGuestReviewsForVendor(stub({ vendor_guest_reviews: { data: [], error: null } }), 'v1');
  assert.deepEqual(got, { state: 'none' });
});

test('3c · rows come back named from the seat, with the card by NAME, and the guests’ own line', async () => {
  const got = await readGuestReviewsForVendor(
    stub({
      vendor_guest_reviews: { data: [ROW], error: null },
      guests: { data: [{ guest_id: 'g1', first_name: 'Gabriel', last_name: 'Dela Cruz' }], error: null },
      vendor_services: { data: [{ vendor_service_id: 's1', title: 'Garden bridal bouquet' }], error: null },
      vendor_guest_review_stats: { data: { guest_review_count: 40, guest_avg_rating: '4.90' }, error: null },
    }),
    'v1',
  );
  assert.equal(got.state, 'rows');
  if (got.state !== 'rows') return;
  const [first] = got.rows;
  assert.ok(first);
  assert.equal(first.shown_name, 'Gabriel D.');
  assert.equal(first.service_title, 'Garden bridal bouquet');
  assert.ok(!('guest_id' in first), 'the guest id never leaves the server read');
  assert.deepEqual(got.stats, { count: 40, average: 4.9 });
});

test('3d · rows whose NAMES could not be read are refused, not shown nameless', async () => {
  const got = await readGuestReviewsForVendor(
    stub({
      vendor_guest_reviews: { data: [ROW], error: null },
      guests: { data: null, error: { message: 'timeout' } },
    }),
    'v1',
  );
  assert.deepEqual(got, { state: 'refused' });
});

test('4 · a guest review never moves the overall — guest code never touches the hosts’ stats', () => {
  for (const f of [
    'lib/guest-reviews.ts',
    'lib/guest-review-photos.server.ts',
    'app/v/[slug]/_components/review-groups.tsx',
    'app/v/[slug]/guest-review/page.tsx',
    'app/v/[slug]/guest-review/actions.ts',
  ]) {
    const src = read(f);
    assert.doesNotMatch(src, /vendor_trusted_review_stats|vendor_review_stats\b|from\('vendor_reviews'\)/, `${f} reaches the hosts' numbers`);
  }
  // The overall on the shop page is still the hosts' trusted number; the guests get their own line UNDER it.
  const page = read('app/v/[slug]/page.tsx');
  assert.match(page, /const hero = trusted\.trusted_avg_rating;/);
  assert.match(page, /<GuestStarsLine read=\{guestReviews\} \/>/);
  // And the stats the guests' line reads is its own view.
  assert.match(read('lib/guest-reviews.ts'), /from\('vendor_guest_review_stats'\)/);
});

test('5 · the one writer is the one door: no other code inserts a guest review', () => {
  const lib = read('lib/guest-reviews.ts');
  assert.equal([...lib.matchAll(/rpc\('vendor_guest_review_submit'/g)].length, 1);
  assert.doesNotMatch(lib, /from\('vendor_guest_reviews'\)\s*\.insert/);
  assert.match(read('app/v/[slug]/guest-review/actions.ts'), /submitGuestReview\(admin, \{/);
  // The guest is named by the SERVER — never a form field.
  assert.doesNotMatch(read('app/v/[slug]/guest-review/actions.ts'), /form\.get\('guest_id'\)/);
});
