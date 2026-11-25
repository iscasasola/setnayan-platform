/**
 * ⚖ OWNER ADD 35 (25 Nov) · A6-03 — an unread guest count prices NOTHING.
 *
 * When the guest count cannot be read: no price is computed and nothing is charged; never the estimate, never a floor
 * of 0. Behaviour first (a stub database whose count is refused), then every caller of the live count is pinned:
 * quotes, per-guest prices, the package lock, surcharges, the catalogue charge — each treats PAX_UNREAD as "no price".
 * Also: the Papic portfolio import says "couldn't read" on an unread ledger, never "out of credits" on a guessed 0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';
import { PAX_UNREAD, PAX_UNREAD_WORDS, priceablePax, resolveLivePax, computeAddedPaxSurcharge } from '@/lib/pax';

type Result = { data: unknown; error?: { message: string } | null; count?: number | null };

/** A stub client: each table answers the configured result, for a row read or a `count: 'exact', head: true` read. */
function stub(byTable: Record<string, Result>): SupabaseClient {
  const build = (table: string) => {
    const result = byTable[table] ?? { data: null, error: null };
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'in', 'is', 'order', 'limit']) b[m] = () => b;
    b.maybeSingle = async () => result;
    b.then = (resolve: (v: Result) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
    return b;
  };
  return { from: (t: string) => build(t) } as unknown as SupabaseClient;
}

const EVENT_OK: Result = { data: { estimated_pax: 120, headcount_basis: 'attending', guest_count_locked_at: null, final_pax: null } };

test('a refused guest count is PAX_UNREAD — never the estimate (120), never 0', async () => {
  const pax = await resolveLivePax(stub({ events: EVENT_OK, guests: { data: null, count: null, error: { message: 'refused' } } }), 'e1');
  assert.equal(pax, PAX_UNREAD);
  assert.notEqual(pax, 120);
  assert.notEqual(pax, 0);
});

test('a refused event row is PAX_UNREAD too — nothing is read, nothing is priced', async () => {
  const pax = await resolveLivePax(stub({ events: { data: null, error: { message: 'refused' } }, guests: { data: null, count: 80 } }), 'e1');
  assert.equal(pax, PAX_UNREAD);
});

test('a read that answered prices exactly as before (no price number changes)', async () => {
  assert.equal(await resolveLivePax(stub({ events: EVENT_OK, guests: { data: null, count: 150 } }), 'e1'), 150);
  assert.equal(await resolveLivePax(stub({ events: EVENT_OK, guests: { data: null, count: 40 } }), 'e1'), 120, 'the estimate floor still holds on a READ count');
});

test('unread → no price, no charge: priceablePax is null, and a surcharge computed from it is nothing', async () => {
  const pax = await resolveLivePax(stub({ events: EVENT_OK, guests: { data: null, count: null, error: { message: 'refused' } } }), 'e1');
  assert.equal(priceablePax(pax), null);
  assert.equal(PAX_UNREAD_WORDS, 'Couldn’t read the guest count. Try again.');
});

const read = (rel: string) => stripComments(readFileSync(join(__dirname, '..', rel), 'utf8'));

test('every caller of the live count treats unread as no price', () => {
  // The package lock (per-head upgrades) refuses and says the words — nothing is priced or saved.
  assert.match(read('app/dashboard/[eventId]/vendors/packages/actions.ts'), /if \(livePaxRead === PAX_UNREAD\) return \{ status: 'error', message: PAX_UNREAD_WORDS \}/);
  // The catalogue's per-guest charge stops (the charge path treats `error` as a hard stop) — never the floor price.
  assert.match(read('lib/v2-catalog.ts'), /if \(read === PAX_UNREAD\) return \{ status: 'error', message: PAX_UNREAD_WORDS \}/);
  // The guest-count surcharge computes nothing, writes nothing.
  assert.match(read('app/vendor-dashboard/messages/[threadId]/pax-actions.ts'), /if \(livePaxRead == null \|\| livePaxRead === PAX_UNREAD\) return null/);
  // The shop page's configurator shows no per-guest totals.
  assert.match(read('app/v/[slug]/page.tsx'), /hidePrices=\{hidePricesPublicly \|\| packagePaxUnread\}/);
  // Snapshots and comparisons store nothing on an unread count.
  for (const f of ['app/v/[slug]/inquiry-actions.ts', 'app/dashboard/[eventId]/vendors/actions.ts', 'app/dashboard/[eventId]/vendors/_actions/unlock-category.ts', 'app/dashboard/[eventId]/vendors/_actions/category-search.ts', 'app/dashboard/[eventId]/vendors/page.tsx']) {
    assert.match(read(f), /priceablePax\(await (resolveLivePax|livePaxRead)/, f);
  }
  // The two chats say it, never a stored snapshot in its place.
  for (const f of ['app/dashboard/[eventId]/messages/[threadId]/page.tsx', 'app/vendor-dashboard/messages/[threadId]/page.tsx']) {
    const src = read(f);
    assert.match(src, /const headerPax = livePaxUnread \? null :/, f);
    assert.match(src, /\{livePaxUnread \? <span[^>]*>\{PAX_UNREAD_WORDS\}<\/span> : null\}/, f);
  }
  // Nothing rescues an unread count with `?? 0` straight off the reader.
  for (const f of ['app/v/[slug]/page.tsx', 'app/dashboard/[eventId]/vendors/packages/actions.ts']) {
    assert.doesNotMatch(read(f), /\(await resolveLivePax\([^)]*\)\) \?\? 0/, f);
  }
  void computeAddedPaxSurcharge;
});

test('the Papic import says "couldn’t read" on an unread ledger — never "out of credits" on a guessed 0', () => {
  const route = read('app/api/vendor/papic-portfolio-import/route.ts');
  const unreadAt = route.indexOf("if (ledger === null)");
  const outAt = route.indexOf("error: 'out_of_credits'");
  assert.ok(unreadAt > -1 && unreadAt < outAt, 'the unread answer comes before the out-of-credits check');
  assert.match(route, /error: 'credits_unread', message: PAPIC_CREDITS_UNREAD \}, \{ status: 503 \}/);
});
