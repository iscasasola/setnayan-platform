/**
 * guest-wall-unpost.test.ts — WHOSE PHOTOGRAPH IS IT?
 *
 * Owner ruling 2026-09-02: a guest can un-post her own photograph from the live
 * wall — the ones she SHOT and the ones she is TAGGED in, and nobody else's.
 *
 * ── WHY THIS FILE IS ALL ABOUT REFUSALS ────────────────────────────────────
 * The happy path is two UPDATEs. The whole risk of the feature is the sentence
 * "and nobody else's", on a surface ANY STRANGER WITH A LINK CAN REACH: an
 * event page is public and a guest has no account, so the only thing standing
 * between a passer-by and somebody else's wedding photograph is this scope. So
 * most of what follows constructs the row that each individual check alone
 * rejects, and asserts that NOTHING WAS WRITTEN — not merely that the return
 * value said no.
 *
 * 🛡 IT TESTS THE ACT, NOT THE SPELLING. Every case runs the real functions
 * against a stub client that records every `update()`. A guard that greps the
 * source for `.eq('guest_id', …)` cannot tell a live filter from a dead one —
 * this repo has shipped exactly that twice (a lookahead that could not match
 * the line it was written for; a `source='auto_face'` filter that made a button
 * do nothing). `writes.length === 0` cannot be faked by a comment.
 *
 * 🪤 AND THE STUB DELIBERATELY IGNORES `.eq()`. It returns whatever the case
 * hands it, however narrow the query claimed to be — which is exactly why these
 * tests can prove the TypeScript re-checks are real. If the module ever goes
 * back to trusting PostgREST's filters alone, "a tag belonging to another
 * guest" starts passing and this file goes red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  guestScopeForPhoto,
  takePhotoOffTheWall,
  putPhotoBackOnTheWall,
  readGuestWallStates,
  wallTileKey,
} from '@/lib/guest-wall-unpost';

const EVENT = 'E1';
const HER = 'G-her';
const SOMEBODY_ELSE = 'G-him';

type TableStub = { data?: unknown; error?: unknown; updateError?: unknown };

/**
 * Per-table stub. `from(t)` picks the canned answer for that table; every
 * filter is a no-op that returns the builder, so a case can hand back a row the
 * real query could never have matched — the point of the exercise.
 */
function stubClient(tables: Record<string, TableStub>) {
  const writes: { table: string; patch: Record<string, unknown> }[] = [];
  const make = (table: string) => {
    let isUpdate = false;
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'is', 'not', 'order', 'limit']) b[m] = () => b;
    b.update = (patch: Record<string, unknown>) => {
      isUpdate = true;
      writes.push({ table, patch });
      return b;
    };
    const answer = () => {
      const t = tables[table] ?? {};
      if (isUpdate) return { data: null, error: t.updateError ?? null };
      return { data: t.data ?? null, error: t.error ?? null };
    };
    b.maybeSingle = () => Promise.resolve(answer());
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(answer()).then(resolve);
    return b;
  };
  return {
    client: { from: (t: string) => make(t) } as unknown as SupabaseClient,
    writes,
  };
}

const capture = (over: Record<string, unknown> = {}) => ({
  event_id: EVENT,
  guest_id: HER,
  wall_hidden_at: null,
  wall_hidden_by_guest_id: null,
  ...over,
});
const seatPhoto = (over: Record<string, unknown> = {}) => ({
  event_id: EVENT,
  paparazzi_seat_id: null,
  wall_hidden_at: null,
  wall_hidden_by_guest_id: null,
  ...over,
});
const target = (over: Record<string, unknown> = {}) => ({
  eventId: EVENT,
  guestId: HER,
  sourceTable: 'papic_guest_captures' as const,
  sourceId: 'C1',
  ...over,
});

// ── SHE MAY ────────────────────────────────────────────────────────────────

test('her own guest-camera capture is hers to pull', async () => {
  const { client, writes } = stubClient({
    papic_guest_captures: { data: capture() },
  });
  const res = await takePhotoOffTheWall(client, target());
  assert.deepEqual(res, { ok: true, state: 'off_the_wall', scope: 'shot' });

  const stamp = writes.find((w) => w.table === 'papic_guest_captures');
  assert.ok(stamp, 'the capture row must carry the wall hide');
  assert.ok(stamp.patch.wall_hidden_at, 'wall_hidden_at is the kill switch');
  assert.equal(
    stamp.patch.wall_hidden_by_guest_id,
    HER,
    'who pulled it is recorded — the put-back and the hosts both need to know',
  );
  assert.ok(
    writes.some((w) => w.table === 'wall_feed'),
    'the projection mirror moves with it',
  );
});

test('a photograph she is TAGGED in is hers to pull, even though she did not take it', async () => {
  const { client } = stubClient({
    papic_photos: { data: seatPhoto() },
    photo_tags: { data: { event_id: EVENT, guest_id: HER, removed_at: null } },
  });
  const res = await takePhotoOffTheWall(
    client,
    target({ sourceTable: 'papic_photos', sourceId: 'P1' }),
  );
  assert.deepEqual(res, { ok: true, state: 'off_the_wall', scope: 'tagged' });
});

test('a photograph shot on HER OWN Limited roll camera is hers — the seat is her personal QR', async () => {
  const { client } = stubClient({
    papic_photos: { data: seatPhoto({ paparazzi_seat_id: 'S1' }) },
    paparazzi_seats: { data: { event_id: EVENT, guest_id: HER } },
    photo_tags: { data: null },
  });
  const scope = await guestScopeForPhoto(
    client,
    target({ sourceTable: 'papic_photos', sourceId: 'P1' }),
  );
  assert.equal(scope, 'shot');
});

// ── SHE MAY NOT — one row per check, each of which alone must refuse ───────

test('somebody else’s capture: refused, and NOT ONE WRITE is issued', async () => {
  const { client, writes } = stubClient({
    papic_guest_captures: { data: capture({ guest_id: SOMEBODY_ELSE }) },
    photo_tags: { data: null },
  });
  const res = await takePhotoOffTheWall(client, target());
  assert.deepEqual(res, { ok: false, reason: 'not_yours' });
  assert.equal(writes.length, 0, 'a refusal that still writes is not a refusal');
});

test('a tag belonging to ANOTHER guest does not make the photo hers', async () => {
  // The stub hands back a row the real `.eq('guest_id', …)` would never have
  // returned. Only the TypeScript re-check can refuse this one.
  const { client, writes } = stubClient({
    papic_photos: { data: seatPhoto() },
    photo_tags: { data: { event_id: EVENT, guest_id: SOMEBODY_ELSE, removed_at: null } },
  });
  const res = await takePhotoOffTheWall(
    client,
    target({ sourceTable: 'papic_photos', sourceId: 'P1' }),
  );
  assert.deepEqual(res, { ok: false, reason: 'not_yours' });
  assert.equal(writes.length, 0);
});

test('a REMOVED tag is not a tag — "Not me" also gives up the control', async () => {
  const { client, writes } = stubClient({
    papic_photos: { data: seatPhoto() },
    photo_tags: { data: { event_id: EVENT, guest_id: HER, removed_at: '2026-09-02T00:00:00Z' } },
  });
  const res = await takePhotoOffTheWall(
    client,
    target({ sourceTable: 'papic_photos', sourceId: 'P1' }),
  );
  assert.deepEqual(res, { ok: false, reason: 'not_yours' });
  assert.equal(writes.length, 0);
});

test('a tag from a DIFFERENT celebration is refused', async () => {
  const { client, writes } = stubClient({
    papic_photos: { data: seatPhoto() },
    photo_tags: { data: { event_id: 'E2', guest_id: HER, removed_at: null } },
  });
  const res = await takePhotoOffTheWall(
    client,
    target({ sourceTable: 'papic_photos', sourceId: 'P1' }),
  );
  assert.deepEqual(res, { ok: false, reason: 'not_yours' });
  assert.equal(writes.length, 0);
});

test('her own capture at ANOTHER event is still not hers to pull from THIS one', async () => {
  // Her cookie says event E1. The photograph says E2. The guest id matches —
  // and it must still refuse, because the session is scoped to one celebration.
  const { client, writes } = stubClient({
    papic_guest_captures: { data: capture({ event_id: 'E2' }) },
    photo_tags: { data: null },
  });
  const res = await takePhotoOffTheWall(client, target());
  assert.deepEqual(res, { ok: false, reason: 'not_yours' });
  assert.equal(writes.length, 0);
});

test('a seat belonging to somebody else does not make its photographs hers', async () => {
  const { client, writes } = stubClient({
    papic_photos: { data: seatPhoto({ paparazzi_seat_id: 'S1' }) },
    paparazzi_seats: { data: { event_id: EVENT, guest_id: SOMEBODY_ELSE } },
    photo_tags: { data: null },
  });
  const res = await takePhotoOffTheWall(
    client,
    target({ sourceTable: 'papic_photos', sourceId: 'P1' }),
  );
  assert.deepEqual(res, { ok: false, reason: 'not_yours' });
  assert.equal(writes.length, 0);
});

test('a missing row is refused, not treated as hers', async () => {
  const { client, writes } = stubClient({
    papic_guest_captures: { data: null },
    photo_tags: { data: null },
  });
  const res = await takePhotoOffTheWall(client, target());
  assert.deepEqual(res, { ok: false, reason: 'not_yours' });
  assert.equal(writes.length, 0);
});

// ── A REFUSED READ IS ITS OWN ANSWER ───────────────────────────────────────

test('an unreadable row refuses the action — and is DISTINGUISHABLE from "not yours"', async () => {
  const { client, writes } = stubClient({
    // PostgREST resolves a missing grant with an error and never throws, which
    // is the whole reason this failure is invisible if it is not named.
    papic_guest_captures: { error: { code: '42501', message: 'permission denied' } },
  });
  const res = await takePhotoOffTheWall(client, target());
  assert.deepEqual(res, { ok: false, reason: 'unreadable' });
  assert.equal(writes.length, 0, 'we could not tell whose it is, so we do not touch it');
});

test('an unreadable TAG read does not silently become "not yours"', async () => {
  const { client } = stubClient({
    papic_photos: { data: seatPhoto() },
    photo_tags: { error: { code: '42703', message: 'column photo_tags.nope does not exist' } },
  });
  const res = await takePhotoOffTheWall(
    client,
    target({ sourceTable: 'papic_photos', sourceId: 'P1' }),
  );
  assert.deepEqual(res, { ok: false, reason: 'unreadable' });
});

// ── THE WALL, AND ONLY THE WALL ────────────────────────────────────────────

test('the durable gallery hide is NEVER touched — this stops a projector, it does not delete', async () => {
  const { client, writes } = stubClient({ papic_guest_captures: { data: capture() } });
  await takePhotoOffTheWall(client, target());
  for (const w of writes) {
    assert.ok(
      !('hidden_at' in w.patch),
      `${w.table} must not receive hidden_at — that is the gallery/recap suppression, a different decision with a different door`,
    );
  }
});

test('already off the wall ⇒ success, and the existing pull is NOT overwritten', async () => {
  const { client, writes } = stubClient({
    papic_guest_captures: {
      data: capture({ wall_hidden_at: '2026-09-02T01:00:00Z', wall_hidden_by_guest_id: null }),
    },
  });
  const res = await takePhotoOffTheWall(client, target());
  assert.deepEqual(res, { ok: true, state: 'off_the_wall', scope: 'shot' });
  assert.equal(
    writes.length,
    0,
    're-stamping would credit her with a hide the couple may have made mid-moderation',
  );
});

test('a failed write is reported as a failure, not as a done deal', async () => {
  const { client } = stubClient({
    papic_guest_captures: { data: capture(), updateError: { message: 'nope' } },
  });
  const res = await takePhotoOffTheWall(client, target());
  assert.deepEqual(res, { ok: false, reason: 'write_failed' });
});

// ── THE PUT-BACK ───────────────────────────────────────────────────────────

test('she can reverse HER OWN pull', async () => {
  const { client, writes } = stubClient({
    papic_guest_captures: {
      data: capture({ wall_hidden_at: '2026-09-02T01:00:00Z', wall_hidden_by_guest_id: HER }),
    },
  });
  const res = await putPhotoBackOnTheWall(client, target());
  assert.deepEqual(res, { ok: true, state: 'on_the_wall', scope: 'shot' });
  const patch = writes.find((w) => w.table === 'papic_guest_captures')?.patch;
  assert.equal(patch?.wall_hidden_at, null);
  assert.equal(patch?.wall_hidden_by_guest_id, null, 'the provenance clears with the hide');
});

test('she CANNOT reverse the hosts’ moderation — and is told which it was', async () => {
  const { client, writes } = stubClient({
    papic_guest_captures: {
      data: capture({
        wall_hidden_at: '2026-09-02T01:00:00Z',
        // No recorded guest: the couple, a coordinator or an admin pulled it.
        wall_hidden_by_guest_id: null,
      }),
    },
  });
  const res = await putPhotoBackOnTheWall(client, target());
  assert.deepEqual(res, { ok: false, reason: 'not_your_pull' });
  assert.equal(writes.length, 0);
});

test('she cannot reverse ANOTHER GUEST’s pull either', async () => {
  const { client, writes } = stubClient({
    papic_guest_captures: {
      data: capture({
        wall_hidden_at: '2026-09-02T01:00:00Z',
        wall_hidden_by_guest_id: SOMEBODY_ELSE,
      }),
    },
  });
  const res = await putPhotoBackOnTheWall(client, target());
  assert.deepEqual(res, { ok: false, reason: 'not_your_pull' });
  assert.equal(writes.length, 0);
});

test('a stranger cannot put back a photograph that was never hers', async () => {
  const { client, writes } = stubClient({
    papic_guest_captures: {
      data: capture({
        guest_id: SOMEBODY_ELSE,
        wall_hidden_at: '2026-09-02T01:00:00Z',
        wall_hidden_by_guest_id: HER,
      }),
    },
    photo_tags: { data: null },
  });
  const res = await putPhotoBackOnTheWall(client, target());
  assert.deepEqual(res, { ok: false, reason: 'not_yours' });
  assert.equal(writes.length, 0);
});

// ── WHAT THE TILE IS TOLD ──────────────────────────────────────────────────

const TILE = { sourceTable: 'papic_guest_captures' as const, sourceId: 'C1' };
const KEY = wallTileKey('papic_guest_captures', 'C1');

test('a photograph the wall never held says nothing at all', async () => {
  const { client } = stubClient({ wall_feed: { data: [] } });
  const states = await readGuestWallStates(client, EVENT, HER, [TILE]);
  assert.equal(states.get(KEY), 'off');
});

test('on the wall now ⇒ posted', async () => {
  const { client } = stubClient({
    wall_feed: { data: [{ source_table: 'papic_guest_captures', source_id: 'C1' }] },
    papic_guest_captures: {
      data: [{ capture_id: 'C1', wall_hidden_at: null, wall_hidden_by_guest_id: null }],
    },
  });
  const states = await readGuestWallStates(client, EVENT, HER, [TILE]);
  assert.equal(states.get(KEY), 'posted');
});

test('her own pull and the hosts’ pull are told apart — one offers a put-back, the other does not', async () => {
  const hers = stubClient({
    wall_feed: { data: [{ source_table: 'papic_guest_captures', source_id: 'C1' }] },
    papic_guest_captures: {
      data: [{ capture_id: 'C1', wall_hidden_at: 'x', wall_hidden_by_guest_id: HER }],
    },
  });
  const theirs = stubClient({
    wall_feed: { data: [{ source_table: 'papic_guest_captures', source_id: 'C1' }] },
    papic_guest_captures: {
      data: [{ capture_id: 'C1', wall_hidden_at: 'x', wall_hidden_by_guest_id: null }],
    },
  });
  assert.equal(
    (await readGuestWallStates(hers.client, EVENT, HER, [TILE])).get(KEY),
    'pulled_by_me',
  );
  assert.equal(
    (await readGuestWallStates(theirs.client, EVENT, HER, [TILE])).get(KEY),
    'pulled_by_host',
  );
});

test('a FAILED wall read leaves the control offered, never silently removed', async () => {
  // 🔑 The direction matters. A privacy control that vanishes when a secondary
  // read breaks is the failure-renders-as-emptiness defect this codebase has
  // paid for repeatedly — and the un-post is safe to press on a photograph that
  // is not projecting anyway.
  const { client } = stubClient({
    wall_feed: { error: { code: '42501', message: 'permission denied' } },
  });
  const states = await readGuestWallStates(client, EVENT, HER, [TILE]);
  assert.equal(states.get(KEY), 'unknown');
  assert.notEqual(states.get(KEY), 'off', 'unknown must not read as "there is no wall"');
});

test('no tiles ⇒ no queries, no answers', async () => {
  const { client } = stubClient({});
  const states = await readGuestWallStates(client, EVENT, HER, []);
  assert.equal(states.size, 0);
});
