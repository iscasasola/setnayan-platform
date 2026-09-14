/**
 * A moderator's "Hide" reaches the photograph the guest reported — in ANY
 * capture table. Step 8 of the Story found that it only ever looked in the guest
 * camera's table, so a seat photograph (the only kind the story is built from)
 * was reported, "hidden", and stayed up.
 *
 * TD-1 (2026-09-14) found the SAME absence one table further out: the two
 * supplier-owned tables were never on the list either. The owner ruled —
 * "no. we will honour the guest." — so they are, and the behaviour of each is
 * asserted below. The COMPLETENESS of the set is a different question and is
 * asked of the schema in tests/db/a-takedown-reaches-every-suppliers-copy.db.test.ts:
 * a list checked against itself can only ever agree.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  hideReportedPhoto,
  isSupplierOwned,
  supplierTakedownNotice,
  REPORTED_PHOTO_TABLES,
  SUPPLIER_OWNED_PHOTO_TABLES,
} from './hide-a-reported-photo';

type Row = Record<string, string | null>;

/** Just enough of the query builder: select/update · eq · is · maybeSingle. */
function fakeAdmin(tables: Record<string, Row[]>, failOn?: string) {
  const writes: string[] = [];
  const from = (table: string) => {
    const filters: Array<[string, 'eq' | 'is', string | null]> = [];
    let patch: Row | null = null;
    const rows = () => (tables[table] ?? []).filter((r) => filters.every(([k, , v]) => r[k] === v));
    const run = () => {
      if (failOn === table) return { data: null, error: { message: 'refused' } };
      if (patch) {
        for (const r of rows()) Object.assign(r, patch);
        writes.push(table);
        return { data: null, error: null };
      }
      return { data: rows()[0] ?? null, error: null };
    };
    const b = {
      select: () => b,
      update: (p: Row) => ((patch = p), b),
      eq: (k: string, v: string) => (filters.push([k, 'eq', v]), b),
      is: (k: string, v: null) => (filters.push([k, 'is', v]), b),
      maybeSingle: async () => run(),
      then: (res: (v: unknown) => unknown) => Promise.resolve(run()).then(res),
    };
    return b;
  };
  return { admin: { from } as unknown as SupabaseClient, writes };
}

const EV = 'ev-1';
const AT = '2026-09-11T08:00:00.000Z';

test('a reported SEAT photograph is hidden — the kind the story is built from', async () => {
  const tables = {
    papic_photos: [{ photo_id: 'p1', event_id: EV, hidden_at: null }],
    papic_guest_captures: [] as Row[],
  };
  const { admin } = fakeAdmin(tables);
  assert.equal(await hideReportedPhoto(admin, EV, 'p1', AT), 'papic_photos');
  assert.equal(tables.papic_photos[0]!.hidden_at, AT);
});

test('a reported GUEST-camera photograph is still hidden', async () => {
  const tables = {
    papic_photos: [] as Row[],
    papic_guest_captures: [{ capture_id: 'g1', event_id: EV, hidden_at: null }],
  };
  const { admin } = fakeAdmin(tables);
  assert.equal(await hideReportedPhoto(admin, EV, 'g1', AT), 'papic_guest_captures');
  assert.equal(tables.papic_guest_captures[0]!.hidden_at, AT);
});

test("another celebration's photograph with the same id is never touched", async () => {
  const tables = {
    papic_photos: [{ photo_id: 'p1', event_id: 'someone-else', hidden_at: null }],
    papic_guest_captures: [] as Row[],
  };
  const { admin, writes } = fakeAdmin(tables);
  assert.equal(await hideReportedPhoto(admin, EV, 'p1', AT), null);
  assert.equal(tables.papic_photos[0]!.hidden_at, null);
  assert.deepEqual(writes, []);
});

test('nothing found says so — null, so the report is not stamped "hidden"', async () => {
  const { admin } = fakeAdmin({ papic_photos: [], papic_guest_captures: [] });
  assert.equal(await hideReportedPhoto(admin, EV, 'nope', AT), null);
});

test('an already-hidden photograph keeps the moment it was first hidden', async () => {
  const first = '2026-09-01T00:00:00.000Z';
  const tables = { papic_photos: [{ photo_id: 'p1', event_id: EV, hidden_at: first }], papic_guest_captures: [] };
  const { admin, writes } = fakeAdmin(tables);
  assert.equal(await hideReportedPhoto(admin, EV, 'p1', AT), 'papic_photos');
  assert.equal(tables.papic_photos[0]!.hidden_at, first);
  assert.deepEqual(writes, []);
});

test('a refused read throws — an unanswered question is not "not found"', async () => {
  const { admin } = fakeAdmin({ papic_photos: [], papic_guest_captures: [] }, 'papic_photos');
  await assert.rejects(() => hideReportedPhoto(admin, EV, 'p1', AT), /refused/);
});

/* ─── TD-1 · the supplier's copies ────────────────────────────────────────── */

test("a supplier's own on-the-day capture comes down too", async () => {
  const tables = {
    papic_photos: [] as Row[],
    papic_guest_captures: [] as Row[],
    vendor_papic_captures: [{ capture_id: 'v1', event_id: EV, hidden_at: null }],
    vendor_papic_portfolio_photos: [] as Row[],
  };
  const { admin } = fakeAdmin(tables);
  assert.equal(await hideReportedPhoto(admin, EV, 'v1', AT), 'vendor_papic_captures');
  assert.equal(tables.vendor_papic_captures[0]!.hidden_at, AT);
});

test("the supplier's PORTFOLIO copy comes down — the one the owner used to let them keep", async () => {
  /*
    The position this overrides was, verbatim, "that's their own copy, they get
    to keep it for portfolio." The portfolio album is therefore not a
    speculative extra member of the list — it is the thing the ruling is about.
  */
  const tables = {
    papic_photos: [] as Row[],
    papic_guest_captures: [] as Row[],
    vendor_papic_captures: [] as Row[],
    vendor_papic_portfolio_photos: [{ photo_id: 'pf1', event_id: EV, hidden_at: null }],
  };
  const { admin } = fakeAdmin(tables);
  assert.equal(
    await hideReportedPhoto(admin, EV, 'pf1', AT),
    'vendor_papic_portfolio_photos',
  );
  assert.equal(tables.vendor_papic_portfolio_photos[0]!.hidden_at, AT);
});

test("another supplier's photograph with the same id is never touched", async () => {
  const tables = {
    papic_photos: [] as Row[],
    papic_guest_captures: [] as Row[],
    vendor_papic_captures: [{ capture_id: 'v1', event_id: 'someone-else', hidden_at: null }],
    vendor_papic_portfolio_photos: [] as Row[],
  };
  const { admin, writes } = fakeAdmin(tables);
  assert.equal(await hideReportedPhoto(admin, EV, 'v1', AT), null);
  assert.equal(tables.vendor_papic_captures[0]!.hidden_at, null);
  assert.deepEqual(writes, []);
});

test('every supplier-owned table is one the helper actually looks in', () => {
  const looked = REPORTED_PHOTO_TABLES.map((t) => t.table);
  for (const t of SUPPLIER_OWNED_PHOTO_TABLES) {
    assert.ok(looked.includes(t), `${t} is marked supplier-owned but is never searched.`);
    assert.ok(isSupplierOwned(t));
  }
  assert.equal(isSupplierOwned('papic_photos'), false);
  assert.equal(isSupplierOwned('papic_guest_captures'), false);
  assert.equal(isSupplierOwned(null), false);
});

test('the supplier is told what happened, and the guest is not named', () => {
  /*
    🔑 THE WORDS ARE THE HALF THAT CAN BE GOT WRONG, so they live in a pure
    function a unit test can import — the send itself is in a `server-only`
    module this file cannot load. A notice naming the person who asked would
    turn a privacy right into an introduction.
  */
  for (const table of SUPPLIER_OWNED_PHOTO_TABLES) {
    const n = supplierTakedownNotice(table);
    assert.ok(n.title.length > 0 && n.title.length <= 160, `title unusable: ${n.title}`);
    assert.match(n.body, /guest asked/i, `the body does not say why: ${n.body}`);
    assert.match(n.body, /taken down|removed/i, `the body does not say what happened: ${n.body}`);
    for (const leak of ['guest_id', 'reporter', 'report_id', 'email', '@']) {
      assert.ok(
        !`${n.title} ${n.body}`.includes(leak),
        `the notice leaks "${leak}" toward identifying the guest: ${n.body}`,
      );
    }
  }
  // The two lanes are named differently, because "where did my photo go" has
  // two different answers and a supplier should not have to guess which.
  assert.notEqual(
    supplierTakedownNotice('vendor_papic_captures').body,
    supplierTakedownNotice('vendor_papic_portfolio_photos').body,
  );
  assert.match(
    supplierTakedownNotice('vendor_papic_portfolio_photos').body,
    /portfolio/i,
  );
});
