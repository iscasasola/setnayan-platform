/**
 * THE ARRANGEMENT'S READS AND ITS ONE WRITE — against a stand-in for the admin client.
 *
 * What the pure tests cannot see: that the POOL really goes through the consent veto (S14),
 * that a reader the guests' layer refuses is never even sent the captures (S3), and that a
 * refused save never reaches the write.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  ARRANGEMENT_CONFLICT_MESSAGE,
  loadArrangementPool,
  loadStoryArrangement,
  saveStoryArrangement,
} from './story-arrangement-store';
import type { StoredArrangement } from './story-arrangement';
import { STRANGER } from './who-can-see-your-story';

const EVENT = 'e0000000-0000-4000-8000-000000000001';
const P = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

type Call = { table: string; ops: Array<[string, unknown[]]> };
type Reply = { data: unknown; error: unknown };

/**
 * A stand-in whose every query is recorded and answered by `answer`. A refusal is `{ data:
 * null, error }` — never a throw — because that is what a missing grant, an RLS refusal or a
 * phantom column look like from here. ⚠ The cast is the house pattern (`story-cover.test.ts`).
 */
function stub(answer: (c: Call) => Reply, rpc?: (name: string, args: unknown) => Reply) {
  const calls: Call[] = [];
  const rpcs: Array<{ name: string; args: unknown }> = [];
  const api = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'is', 'in', 'gte', 'lte', 'lt', 'order', 'limit', 'not', 'or']) {
        chain[m] = (...args: unknown[]) => {
          call.ops.push([m, args]);
          return chain;
        };
      }
      chain.maybeSingle = async () => {
        const r = answer(call);
        return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error };
      };
      chain.then = (resolve: (v: unknown) => unknown) => resolve(answer(call));
      return chain;
    },
    async rpc(name: string, args: unknown) {
      rpcs.push({ name, args });
      return rpc ? rpc(name, args) : { data: null, error: { message: 'no rpc' } };
    },
  };
  return { client: api as unknown as SupabaseClient, calls, rpcs };
}

const has = (c: Call, op: string, first?: unknown) =>
  c.ops.some(([m, a]) => m === op && (first === undefined || a[0] === first));

function papicRow(n: number, over: Record<string, unknown> = {}) {
  return {
    photo_id: P(n),
    photo_type: 'photo',
    captured_at: `2026-08-20T0${n}:00:00Z`,
    r2_object_key: `papic/${n}.jpg`,
    display_r2_key: null,
    thumb_r2_key: null,
    poster_r2_key: null,
    clip_web_r2_key: null,
    full_res_dropped_at: null,
    moderation_state: 'clean',
    ...over,
  };
}

/** A celebration: three photos and a snippet; the guest in P2 and in the snippet P4 opted out. */
function world(opts: { vetoFails?: boolean; bakedFor?: string[]; status?: string; arrangement?: unknown } = {}) {
  return (c: Call): Reply => {
    if (c.table === 'guests') {
      if (opts.vetoFails) return { data: null, error: { message: 'refused' } };
      return { data: [{ guest_id: 'g-out' }], error: null };
    }
    if (c.table === 'photo_tags') {
      return { data: [{ source_id: P(2) }, { source_id: P(4) }], error: null };
    }
    if (c.table === 'papic_photos') {
      // The veto's blurred-copy read.
      if (has(c, 'or')) {
        return {
          data: (opts.bakedFor ?? []).map((id) => ({ photo_id: id, safe_display_r2_key: `safe/${id}.jpg` })),
          error: null,
        };
      }
      return {
        data: [
          papicRow(1),
          papicRow(2),
          papicRow(3),
          papicRow(4, { photo_type: 'clip', r2_object_key: 'papic/4.mp4', poster_r2_key: 'papic/4-poster.jpg' }),
        ],
        error: null,
      };
    }
    if (c.table === 'event_editorial') {
      return {
        data: { status: opts.status ?? 'published', arrangement: opts.arrangement ?? null, arrangement_version: 3 },
        error: null,
      };
    }
    if (c.table === 'events') return { data: { event_date: '2026-08-20', event_end_date: null }, error: null };
    if (c.table === 'event_schedule_blocks') {
      return {
        data: [
          { public_id: 'S89B-MARCH00001', label: 'The march', start_at: '2026-08-20T08:00:00+00:00', sort_order: 1 },
        ],
        error: null,
      };
    }
    return { data: null, error: null };
  };
}

/* ── THE POOL — through the consent veto ─────────────────────────────────── */

test('S14 — a photo a guest took back is NOT in the pool, so it can reach no page', async () => {
  const { client } = stub(world());
  const pool = await loadArrangementPool(client, { eventId: EVENT, window: null });
  assert.equal(pool.failed, false);
  const refs = pool.items.map((i) => i.ref);
  assert.equal(refs.includes(P(2)), false, 'a vetoed photo reached the pool');
  assert.deepEqual(refs.sort(), [P(1), P(3)].sort());
});

test('S14 — where a blurred copy was baked, the photo stays, BLURRED (owner 2026-08-17)', async () => {
  const { client } = stub(world({ bakedFor: [P(2), P(4)] }));
  const pool = await loadArrangementPool(client, { eventId: EVENT, window: null });
  const p2 = pool.items.find((i) => i.ref === P(2));
  assert.ok(p2, 'a vetoed photo WITH a blurred copy should be shown blurred');
  assert.equal(p2.stillKey, `safe/${P(2)}.jpg`, 'the ORIGINAL of a vetoed photo reached the pool');
  // A snippet has no blurred playable copy — it is dropped, not turned into a still.
  assert.equal(pool.items.some((i) => i.ref === P(4)), false);
});

test('S14 — a veto that cannot be resolved withholds EVERY capture', async () => {
  const { client } = stub(world({ vetoFails: true }));
  const pool = await loadArrangementPool(client, { eventId: EVENT, window: null });
  assert.equal(pool.failed, true);
  assert.equal(pool.items.length, 0);
});

test('the pool asks for screened-clean, unhidden captures of THIS celebration only', async () => {
  const { client, calls } = stub(world());
  await loadArrangementPool(client, { eventId: EVENT, window: null });
  const read = calls.find((c) => c.table === 'papic_photos' && !has(c, 'or'))!;
  assert.ok(has(read, 'eq', 'event_id'));
  assert.ok(has(read, 'is', 'hidden_at'));
  assert.ok(read.ops.some(([m, a]) => m === 'eq' && a[0] === 'moderation_state' && a[1] === 'clean'));
});

test('an unscreened row that slips past the query is still dropped', async () => {
  const { client } = stub((c) =>
    c.table === 'papic_photos' && !has(c, 'or')
      ? { data: [papicRow(1), papicRow(3, { moderation_state: 'unscreened' })], error: null }
      : world()(c),
  );
  const pool = await loadArrangementPool(client, { eventId: EVENT, window: null });
  assert.deepEqual(pool.items.map((i) => i.ref), [P(1)]);
});

/* ── THE ONE READ ────────────────────────────────────────────────────────── */

const placedP2: StoredArrangement = {
  shape: 1,
  mode: 'hand',
  handTouched: true,
  moments: [
    {
      id: 'ros:S89B-MARCH00001',
      objects: [
        { id: 'photo:1', kind: 'photo', ref: P(1), x: 20, y: 16, w: 146, h: 100 },
        { id: 'photo:2', kind: 'photo', ref: P(2), x: 178, y: 16, w: 146, h: 100 },
      ],
    },
  ],
  sets: [],
};

test('the service-role read drops a taken-back photo from the saved page it was placed on', async () => {
  const { client } = stub(world({ arrangement: placedP2 }));
  const r = await loadStoryArrangement(client, EVENT, STRANGER);
  assert.equal(r.withheld, false);
  assert.deepEqual(r.unreadable, []);
  assert.equal(r.version, 3);
  const refs = r.moments.flatMap((m) => m.objects).map((o) => (o.kind === 'photo' ? o.ref : o.id));
  assert.deepEqual(refs, [P(1)], 'the taken-back P2 is still on the page');
});

test('S3 — before publish a stranger gets nothing, and the captures are never even read', async () => {
  const { client, calls } = stub(world({ status: 'draft', arrangement: placedP2 }));
  const r = await loadStoryArrangement(client, EVENT, STRANGER);
  assert.equal(r.withheld, true);
  assert.equal(r.moments.length, 0);
  assert.equal(calls.some((c) => c.table === 'papic_photos'), false, 'captures were read for a refused reader');
});

test('an unreadable story row fails CLOSED — a stranger is refused, and the editor is told', async () => {
  const { client } = stub((c) =>
    c.table === 'event_editorial' ? { data: null, error: { message: 'refused' } } : world()(c),
  );
  const r = await loadStoryArrangement(client, EVENT, STRANGER);
  assert.equal(r.withheld, true);
  assert.ok(r.unreadable.includes('arrangement'));
});

test('a refused pool is reported as unreadable, never passed off as a day with no photos', async () => {
  const { client } = stub(world({ vetoFails: true, arrangement: placedP2 }));
  const r = await loadStoryArrangement(client, EVENT, { isHost: true, belongsToEvent: true });
  assert.ok(r.unreadable.includes('pool'), 'an editor would save "no photos" over this story');
});

/* ── THE ONE WRITE ───────────────────────────────────────────────────────── */

const saved = (outcome: string, version: number) => () => ({
  data: [{ outcome, saved_version: version }],
  error: null,
});

test('a save with one photo in two moments is refused BEFORE anything is written', async () => {
  const doc = structuredClone(placedP2);
  doc.moments.push({
    id: 'own:x1',
    name: 'Again',
    objects: [{ id: 'photo:9', kind: 'photo', ref: P(1), x: 20, y: 16, w: 146, h: 100 }],
  });
  const { client, rpcs } = stub(world(), saved('saved', 4));
  const r = await saveStoryArrangement(client, { eventId: EVENT, input: doc, expectedVersion: 3 });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.reason === 'invalid' && r.problem === 'photo_in_two_places');
  assert.equal(rpcs.length, 0, 'the refused document reached the write');
});

test('a capture from somebody else\'s celebration is never stored against this one', async () => {
  const doc = structuredClone(placedP2);
  doc.moments[0]!.objects.push({ id: 'photo:3', kind: 'photo', ref: P(9), x: 336, y: 16, w: 146, h: 100 });
  const { client, rpcs } = stub(
    (c) =>
      c.table === 'papic_photos'
        ? { data: [{ photo_id: P(1) }, { photo_id: P(2) }], error: null }
        : world()(c),
    saved('saved', 4),
  );
  const r = await saveStoryArrangement(client, { eventId: EVENT, input: doc, expectedVersion: 3 });
  assert.ok(r.ok);
  assert.equal(r.ok && r.adjusted, true);
  const written = JSON.stringify((rpcs[0]!.args as { p_doc: unknown }).p_doc);
  assert.equal(written.includes(P(9)), false);
  assert.ok(written.includes(P(2)), 'a taken-back capture of THIS day is kept — the read drops it');
});

test('the write names the version it was built on; a stale one comes back as a conflict', async () => {
  const { client, rpcs } = stub(
    (c) => (c.table === 'papic_photos' ? { data: [{ photo_id: P(1) }, { photo_id: P(2) }], error: null } : world()(c)),
    saved('conflict', 8),
  );
  const r = await saveStoryArrangement(client, { eventId: EVENT, input: placedP2, expectedVersion: 7 });
  assert.equal((rpcs[0]!.args as { p_expected: number }).p_expected, 7);
  assert.deepEqual(r, { ok: false, reason: 'conflict', version: 8, message: ARRANGEMENT_CONFLICT_MESSAGE });
});

test('the same save sent twice is not a conflict — an autosave is safe to retry', async () => {
  const { client } = stub(
    (c) => (c.table === 'papic_photos' ? { data: [{ photo_id: P(1) }, { photo_id: P(2) }], error: null } : world()(c)),
    saved('unchanged', 8),
  );
  const r = await saveStoryArrangement(client, { eventId: EVENT, input: placedP2, expectedVersion: 7 });
  assert.deepEqual(r, { ok: true, version: 8, adjusted: false });
});

test('a capture check that is refused refuses the save — an id we could not check is not stored', async () => {
  const { client, rpcs } = stub(
    (c) => (c.table === 'papic_photos' ? { data: null, error: { message: 'refused' } } : world()(c)),
    saved('saved', 4),
  );
  const r = await saveStoryArrangement(client, { eventId: EVENT, input: placedP2, expectedVersion: 3 });
  assert.ok(!r.ok && r.reason === 'failed');
  assert.equal(rpcs.length, 0);
});

test('a version that is not a whole number is refused', async () => {
  const { client, rpcs } = stub(world(), saved('saved', 4));
  for (const v of [-1, 1.5, 'x', null]) {
    const r = await saveStoryArrangement(client, { eventId: EVENT, input: placedP2, expectedVersion: v });
    assert.ok(!r.ok && r.reason === 'invalid');
  }
  assert.equal(rpcs.length, 0);
});
