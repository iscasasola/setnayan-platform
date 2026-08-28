/**
 * A BRANCH MUST BE PAID FOR — and a paid one is seen by customers.
 *
 * Owner-ruled 2026-08-28, two answers: customers SHOULD see a supplier's
 * branches, and paying for a branch IS required.
 *
 * What was true before: a supplier paid ₱1,000 per 28 days and got a label
 * only they could see. No customer met it anywhere — not the marketplace, not
 * the public shop page, not search, not the map. And every surface that read a
 * branch filtered on `status !== 'cancelled'`, so a branch nobody had ever
 * paid for was fully usable; paying flipped a chip orange → green and did
 * nothing else.
 *
 * These tests pin BOTH halves, and they pin them in the two places a rule can
 * be lost: the rule itself (pure, exhaustive over the status union) and the
 * surfaces that are supposed to call it (source-level, because a UI filter and
 * a server refusal are what a person actually meets).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  branchIsUsable,
  resolveBranchAssignment,
  deriveBranchStatus,
  fetchPublicVendorBranches,
  fetchLatestBranchOrders,
  BRANCH_NOT_ACTIVE_MESSAGE,
  BRANCH_STATUS_UNREADABLE_MESSAGE,
  type BranchStatus,
} from './vendor-branches';

const ALL_STATUSES: BranchStatus[] = ['active', 'pending_payment', 'expired', 'cancelled'];

const WEB = path.join(__dirname, '..');
const read = (rel: string) => readFileSync(path.join(WEB, rel), 'utf8');

// ── The rule ────────────────────────────────────────────────────────────────

test('exactly one status is usable, and it is the paid one', () => {
  const usable = ALL_STATUSES.filter(branchIsUsable);
  assert.deepEqual(usable, ['active']);
  // Stated as its own assertion so a future edit that adds a fifth status has
  // to decide about it rather than inherit an answer.
  assert.equal(ALL_STATUSES.length, 4);
});

test('an unpaid branch is not usable — that is the whole owner ruling', () => {
  assert.equal(branchIsUsable('pending_payment'), false);
  assert.equal(branchIsUsable('expired'), false);
  assert.equal(branchIsUsable('cancelled'), false);
});

test('nothing chosen files the card under the main location', () => {
  assert.deepEqual(
    resolveBranchAssignment({ requested: null, requestedStatus: null, current: null }),
    { ok: true, branchId: null },
  );
});

test("another shop's branch coerces to main, silently, as it always has", () => {
  assert.deepEqual(
    resolveBranchAssignment({ requested: 'someone-else', requestedStatus: null, current: null }),
    { ok: true, branchId: null },
  );
});

test('a paid, live branch is accepted', () => {
  assert.deepEqual(
    resolveBranchAssignment({ requested: 'b1', requestedStatus: 'active', current: null }),
    { ok: true, branchId: 'b1' },
  );
});

test('filing a NEW card under an unpaid branch is refused in words', () => {
  for (const status of ['pending_payment', 'expired', 'cancelled'] as BranchStatus[]) {
    const r = resolveBranchAssignment({ requested: 'b1', requestedStatus: status, current: null });
    assert.equal(r.ok, false, `${status} must be refused`);
    assert.equal(r.ok === false && r.message, BRANCH_NOT_ACTIVE_MESSAGE);
  }
  // A refusal a person can read, not a raw error.
  assert.match(BRANCH_NOT_ACTIVE_MESSAGE, /not active/i);
  assert.ok(!/branch_id|status|vendor_branches|null/.test(BRANCH_NOT_ACTIVE_MESSAGE));
});

test('a card already filed under a lapsed branch KEEPS it — no silent move', () => {
  // The alternative is worse than the hole it closes: the picker would drop
  // the option, the <select> would fall back to its first option, and the next
  // unrelated save would move the card to "main" with nothing said on screen.
  assert.deepEqual(
    resolveBranchAssignment({ requested: 'b1', requestedStatus: 'expired', current: 'b1' }),
    { ok: true, branchId: 'b1' },
  );
});

test('the keep-arm is exact — a DIFFERENT unpaid branch is still refused', () => {
  const r = resolveBranchAssignment({
    requested: 'b2',
    requestedStatus: 'pending_payment',
    current: 'b1',
  });
  assert.equal(r.ok, false);
});

// ── The derived status the gate hangs off ───────────────────────────────────

test('no order at all reads as pending payment, never as active', () => {
  assert.equal(deriveBranchStatus({ cancelled_at: null }, undefined, 1_000), 'pending_payment');
  assert.equal(
    deriveBranchStatus({ cancelled_at: null }, { reference_code: 'SN1', status: 'submitted', expires_at: null }, 1_000),
    'pending_payment',
  );
});

test('a paid order past its window reads as expired', () => {
  const paid = (expires: string | null) => ({ reference_code: 'SN1', status: 'paid', expires_at: expires });
  assert.equal(deriveBranchStatus({ cancelled_at: null }, paid('2026-01-02T00:00:00Z'), Date.parse('2026-01-01T00:00:00Z')), 'active');
  assert.equal(deriveBranchStatus({ cancelled_at: null }, paid('2026-01-01T00:00:00Z'), Date.parse('2026-01-02T00:00:00Z')), 'expired');
});

// ── The public read ─────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

/** Minimal PostgREST-shaped stub: two tables, chainable, no network. */
function stubReader(opts: {
  branches?: Row[];
  orders?: Row[];
  branchError?: boolean;
  orderError?: boolean;
}) {
  const chain = (result: { data: Row[] | null; error: unknown }) => {
    const self: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'is', 'in', 'order']) {
      self[m] = () => self;
    }
    // Awaiting the builder resolves it, exactly like the real client.
    self.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return self;
  };
  return {
    from(table: string) {
      if (table === 'vendor_branches') {
        return chain(
          opts.branchError
            ? { data: null, error: { message: 'nope' } }
            : { data: opts.branches ?? [], error: null },
        );
      }
      return chain(
        opts.orderError
          ? { data: null, error: { message: 'nope' } }
          : { data: opts.orders ?? [], error: null },
      );
    },
  } as never;
}

const NOW = Date.parse('2026-08-29T00:00:00Z');
const branchRow = (id: string, label: string, city: string) => ({
  branch_id: id,
  branch_label: label,
  branch_city: city,
  cancelled_at: null,
  created_at: '2026-08-01T00:00:00Z',
});
const paidOrder = (id: string, expires: string) => ({
  service_key: `vendor_additional_branch__${id}`,
  reference_code: 'SN1',
  status: 'paid',
  expires_at: expires,
  created_at: '2026-08-02T00:00:00Z',
});

test('only paid, in-window branches reach a customer', async () => {
  const out = await fetchPublicVendorBranches(
    stubReader({
      branches: [branchRow('b1', 'Cebu studio', 'Cebu City'), branchRow('b2', 'Davao studio', 'Davao City')],
      orders: [paidOrder('b1', '2026-12-01T00:00:00Z')], // b2 has never been paid
    }),
    'vendor-1',
    NOW,
  );
  assert.deepEqual(out, [{ branchId: 'b1', branchLabel: 'Cebu studio', branchCity: 'Cebu City' }]);
});

test('a lapsed branch stops being public the day its window ends', async () => {
  const out = await fetchPublicVendorBranches(
    stubReader({ branches: [branchRow('b1', 'Cebu studio', 'Cebu City')], orders: [paidOrder('b1', '2026-08-28T00:00:00Z')] }),
    'vendor-1',
    NOW,
  );
  assert.deepEqual(out, []);
});

test('the public projection is name + city ONLY', async () => {
  const out = await fetchPublicVendorBranches(
    stubReader({
      branches: [
        {
          ...branchRow('b1', 'Cebu studio', 'Cebu City'),
          branch_address: '12 Secret St',
          branch_latitude: 10.3,
          branch_longitude: 123.9,
          branch_radius_km: 100,
          parent_vendor_profile_id: 'vendor-1',
          branch_subscription_active: true,
        },
      ],
      orders: [paidOrder('b1', '2026-12-01T00:00:00Z')],
    }),
    'vendor-1',
    NOW,
  );
  const only = out[0];
  assert.ok(only, 'the paid branch should be published');
  assert.deepEqual(Object.keys(only).sort(), ['branchCity', 'branchId', 'branchLabel']);
});

test('an unreadable order read THROWS instead of reading as "never paid"', async () => {
  // The two produce the same empty result, and the difference decides whether
  // a live branch is called unpaid. Each caller must choose, not inherit.
  await assert.rejects(
    () => fetchLatestBranchOrders(stubReader({ orderError: true }), ['b1']),
    /fetchLatestBranchOrders failed/,
  );
});

test('the public read FAILS CLOSED on either read erroring', async () => {
  assert.deepEqual(await fetchPublicVendorBranches(stubReader({ branchError: true }), 'v', NOW), []);
  const out = await fetchPublicVendorBranches(
    stubReader({ branches: [branchRow('b1', 'Cebu studio', 'Cebu City')], orderError: true }),
    'v',
    NOW,
  );
  // A public page must never make a claim it could not check.
  assert.deepEqual(out, []);
});

test('a paid branch is NOT published when the order read fails — proved by contrast', async () => {
  const branches = [branchRow('b1', 'Cebu studio', 'Cebu City')];
  const orders = [paidOrder('b1', '2026-12-01T00:00:00Z')];
  // Readable: published.
  assert.equal((await fetchPublicVendorBranches(stubReader({ branches, orders }), 'v', NOW)).length, 1);
  // Same rows, unreadable orders: nothing published.
  assert.equal(
    (await fetchPublicVendorBranches(stubReader({ branches, orders, orderError: true }), 'v', NOW)).length,
    0,
  );
});

test('"could not check" is a different sentence from "not paid"', () => {
  const unknown = resolveBranchAssignment({ requested: 'b1', requestedStatus: 'unknown', current: null });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.ok === false && unknown.message, BRANCH_STATUS_UNREADABLE_MESSAGE);
  assert.notEqual(BRANCH_STATUS_UNREADABLE_MESSAGE, BRANCH_NOT_ACTIVE_MESSAGE);
  // Telling a vendor whose branch is live that it is unpaid is a false claim
  // about their money, and they would go and pay for it again.
  assert.ok(!/not active|unpaid|pay its fee/i.test(BRANCH_STATUS_UNREADABLE_MESSAGE));
  // An unknown status still never lets an unpaid branch through.
  assert.equal(
    resolveBranchAssignment({ requested: 'b1', requestedStatus: 'unknown', current: 'b1' }).ok,
    true,
  );
});

test('renewals win: the newest order decides', async () => {
  const latest = await fetchLatestBranchOrders(
    stubReader({
      orders: [
        { service_key: 'vendor_additional_branch__b1', reference_code: 'NEW', status: 'paid', expires_at: '2026-12-01T00:00:00Z', created_at: '2026-08-20T00:00:00Z' },
        { service_key: 'vendor_additional_branch__b1', reference_code: 'OLD', status: 'paid', expires_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z' },
      ],
    }),
    ['b1'],
  );
  assert.equal(latest.get('b1')?.reference_code, 'NEW');
});

test('no branches means no order round-trip at all', async () => {
  const latest = await fetchLatestBranchOrders(stubReader({}), []);
  assert.equal(latest.size, 0);
});

// ── The surfaces that must call the rule ────────────────────────────────────

test('the branch picker offers only branches the rule calls usable', () => {
  const src = read('app/vendor-dashboard/services/_components/services-manager.tsx');
  assert.match(src, /const branches = allBranches\.filter\(\(b\) => branchIsUsable\(b\.status\)\)/);
  // The labels must still come from ALL branches, or a card filed under a
  // lapsed branch silently starts reading "assigned to You".
  assert.match(src, /branchLabelById = new Map\(allBranches\.map/);
});

test('the server refuses an unpaid branch at every one of the three write paths', () => {
  const src = read('app/vendor-dashboard/services/actions.ts');
  const resolves = src.match(/await resolveBranchId\(/g) ?? [];
  assert.equal(resolves.length, 3, 'a fourth write path must be gated too');
  const refusals = src.match(/if \(!branchPick\.ok\)/g) ?? [];
  assert.equal(refusals.length, 3, 'every resolve must act on a refusal');
  // The gate reads the paid status with a client that can see every payer's
  // order — the session client cannot, so a shop's second manager would be
  // refused a branch that is live.
  assert.match(src, /fetchLatestBranchOrders\(createAdminClient\(\), \[t\]\)/);
  // …and an unreadable answer is 'unknown', never 'unpaid'.
  assert.match(src, /status = 'unknown'/);
});

test('the dashboard reads branch status through a service-role order reader', () => {
  for (const rel of [
    'app/vendor-dashboard/shop/page.tsx',
    'app/vendor-dashboard/services/_components/services-manager.tsx',
  ]) {
    const src = read(rel);
    assert.match(src, /fetchVendorBranches\([\s\S]{0,200}?createAdminClient\(\)/, rel);
  }
});

test('the public shop page shows paid branches, and claims nothing about them', () => {
  const src = read('app/v/[slug]/page.tsx');
  assert.match(src, /fetchPublicVendorBranches\(\s*admin,/);
  assert.match(src, /publicBranches\.length > 0/);
  // Deliberately NOT in the structured data or the sitemap: those are claims
  // Google republishes, and a lapsed branch would leave one standing.
  const jsonLd = src.slice(src.indexOf('areaServed'), src.indexOf('areaServed') + 400);
  assert.ok(!/publicBranches/.test(jsonLd), 'branches must stay out of the JSON-LD');
});

test('the table hands `anon` nothing, and the paid flag is not born privileged', () => {
  const sql = read('../../supabase/migrations/20271179754895_a_branch_must_be_paid_for.sql');
  assert.match(sql, /REVOKE ALL ON TABLE public\.vendor_branches FROM anon;/);
  assert.match(sql, /ALTER COLUMN branch_subscription_active SET DEFAULT FALSE/);
});
