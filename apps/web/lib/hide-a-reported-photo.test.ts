/**
 * A moderator's "Hide" reaches the photograph the guest reported — in either
 * capture table. Step 8 of the Story found that it only ever looked in the guest
 * camera's table, so a seat photograph (the only kind the story is built from)
 * was reported, "hidden", and stayed up. Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import { hideReportedPhoto } from './hide-a-reported-photo';

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
