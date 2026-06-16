/**
 * Unit suite for the free-Papic-sampler retention sweep (Node built-in test
 * runner, run via tsx — `pnpm test:unit`; CI runs it in the "unit tests" step).
 *
 * The load-bearing invariant: the locked "connect Drive OR upgrade = permanent"
 * rule must hold even if a convert-moment hook missed. sweepExpiredSamplerPhotos
 * is the last line of defense — a CONVERTED event must be SELF-HEALED (its
 * expiry cleared) and never deleted, while an un-converted event's expired
 * sampler rows are cleaned up (R2 bytes + DB rows). Permanent rows
 * (expires_at IS NULL) are never even fetched, so they can't be touched.
 *
 * The sweep takes injectable seams (SweepDeps) so we exercise the real control
 * flow with fakes — no live DB / R2.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sweepExpiredSamplerPhotos } from './papic-retention';

const EVENT = 'event-1';

test('converted event (Drive grant / upgrade): self-heals, deletes nothing', async () => {
  let healed: string | null = null;
  let fetched = false;
  let deletedIds: string[] | null = null;
  let objectsDeleted = 0;

  const removed = await sweepExpiredSamplerPhotos(EVENT, {
    isKept: async () => true,
    makePermanent: async (id) => {
      healed = id;
      return 4;
    },
    fetchExpired: async () => {
      fetched = true;
      return { rows: [], readError: false };
    },
    deleteRows: async (ids) => {
      deletedIds = ids;
    },
    deleteObject: async () => {
      objectsDeleted += 1;
    },
  });

  assert.equal(removed, 0, 'a kept event sweeps nothing');
  assert.equal(healed, EVENT, 'expires_at is self-healed to NULL for the event');
  assert.equal(fetched, false, 'kept event short-circuits before the expired-rows query');
  assert.equal(deletedIds, null, 'no rows deleted');
  assert.equal(objectsDeleted, 0, 'no R2 bytes deleted');
});

test('un-converted event with expired rows: deletes bytes + rows, returns the count', async () => {
  const deletedObjects: Array<{ bucket: string; key: string }> = [];
  let deletedIds: string[] | null = null;
  let healed = false;

  const removed = await sweepExpiredSamplerPhotos(EVENT, {
    isKept: async () => false,
    makePermanent: async () => {
      healed = true;
      return 0;
    },
    fetchExpired: async (id, limit) => {
      assert.equal(id, EVENT);
      assert.equal(limit, 25, 'the sweep stays bounded');
      return {
        rows: [
          { photo_id: 'p1', r2_object_key: 'r2://media/a.jpg', poster_r2_key: null },
          { photo_id: 'p2', r2_object_key: 'r2://media/b.webm', poster_r2_key: 'r2://media/b.jpg' },
        ],
        readError: false,
      };
    },
    deleteRows: async (ids) => {
      deletedIds = ids;
    },
    deleteObject: async (ref) => {
      deletedObjects.push(ref);
    },
  });

  assert.equal(removed, 2, 'returns the number of rows removed');
  assert.equal(healed, false, 'an un-converted event is NOT self-healed');
  assert.deepEqual(deletedIds, ['p1', 'p2'], 'both expired rows deleted by id');
  // R2 refs parsed correctly; the null poster is skipped (not a ref).
  assert.deepEqual(
    deletedObjects,
    [
      { bucket: 'media', key: 'a.jpg' },
      { bucket: 'media', key: 'b.webm' },
      { bucket: 'media', key: 'b.jpg' },
    ],
    'each r2://bucket/key ref is deleted; non-refs are skipped',
  );
});

test('un-converted event with no expired rows: no-op', async () => {
  let deletedIds: string[] | null = null;
  const removed = await sweepExpiredSamplerPhotos(EVENT, {
    isKept: async () => false,
    fetchExpired: async () => ({ rows: [], readError: false }),
    deleteRows: async (ids) => {
      deletedIds = ids;
    },
    deleteObject: async () => {},
  });
  assert.equal(removed, 0);
  assert.equal(deletedIds, null, 'nothing to delete → delete is never called');
});

test('read error (e.g. pre-migration column missing): no-op, never deletes', async () => {
  let deletedIds: string[] | null = null;
  const removed = await sweepExpiredSamplerPhotos(EVENT, {
    isKept: async () => false,
    fetchExpired: async () => ({ rows: [], readError: true }),
    deleteRows: async (ids) => {
      deletedIds = ids;
    },
    deleteObject: async () => {},
  });
  assert.equal(removed, 0);
  assert.equal(deletedIds, null, 'a read error must not trigger a delete');
});

test('a failing R2 object delete never aborts the row cleanup', async () => {
  let deletedIds: string[] | null = null;
  const removed = await sweepExpiredSamplerPhotos(EVENT, {
    isKept: async () => false,
    fetchExpired: async () => ({
      rows: [{ photo_id: 'p1', r2_object_key: 'r2://media/a.jpg', poster_r2_key: null }],
      readError: false,
    }),
    deleteRows: async (ids) => {
      deletedIds = ids;
    },
    deleteObject: async () => {
      throw new Error('R2 unavailable');
    },
  });
  assert.equal(removed, 1, 'the row is still removed despite the R2 delete throwing');
  assert.deepEqual(deletedIds, ['p1']);
});
