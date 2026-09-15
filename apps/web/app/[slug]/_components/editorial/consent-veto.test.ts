/**
 * Unit suite for the editorial RA 10173 consent veto (gap audit B3), and for
 * the FaceBlock arm added 2026-09-16 (PAP-7).
 *
 * Proves that the DB reads translate into the right veto set / fail-closed
 * signal:
 *   - nobody opted out and no FaceBlock guest → empty veto, not failed;
 *   - an opted-out guest → every papic_photos capture tagging them is vetoed;
 *   - a FaceBlock event → EVERY capture on the event is vetoed, both tables;
 *   - a DB error on ANY read, the FaceBlock RPC included → failed=true.
 *
 * ⚠ WHAT A GREEN HERE DOES AND DOES NOT MEAN. Production carries **0 FaceBlock
 * guests** (measured 2026-09-16: 118 live guests, 0 `faceblock_enabled`, 0
 * `face_recognition_excluded`), so nothing in production exercises this arm and
 * a suite driven by production data would pass without running a line of it.
 * These tests seed the FaceBlock guest themselves. A green therefore means
 * **"the recap's gate gives the same answer the wall's predicate gives"** — it
 * does NOT mean any real guest is protected today, because there is not yet a
 * real guest to protect. The positive control below exists so that a green also
 * cannot mean "the fixture can never show anything anyway".
 *
 * Uses a chainable stub client (thenable builder) so no live DB is needed. The
 * SQL half of the same property — that `papic_capture_needs_blur` and
 * `papic_event_blurs_every_capture` cannot disagree — is pinned against a real
 * replayed schema in `tests/db/the-recap-and-the-wall-cannot-disagree.db.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { createAdminClient } from '@/lib/supabase/admin';

import { loadConsentVetoedPapicIds, publicKeyForCapture } from './consent-veto';

type Result = { data: unknown; error?: unknown };
type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Chainable stub: every query method returns the builder, and the builder is a
 * thenable that resolves to the table's configured result — so `await` at ANY
 * point in the chain (`.is(...)`, `.in(...)`, `.not(...)`) yields
 * `{ data, error }`, exactly like a supabase-js PostgrestFilterBuilder.
 *
 * `rpc` answers `papic_event_blurs_every_capture`. It defaults to FALSE — no
 * FaceBlock guest — so every pre-existing assertion below still describes the
 * event it always described.
 */
function stubClient(byTable: Record<string, Result>, rpc: Result = { data: false }): AdminClient {
  const build = (table: string) => {
    const result = byTable[table] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'is', 'not', 'order', 'limit', 'neq']) {
      builder[m] = () => builder;
    }
    builder.then = (resolve: (r: Result) => unknown) => resolve(result);
    return builder;
  };
  return {
    from: (t: string) => build(t),
    rpc: async () => rpc,
  } as unknown as AdminClient;
}

/** A baked, blurred still — the only shape this gate may serve as a stand-in. */
function baked(id: string, idCol = 'photo_id', typeCol = 'photo_type') {
  return {
    [idCol]: id,
    [typeCol]: 'photo',
    faceblock_baked_at: '2026-09-16T00:00:00Z',
    safe_display_r2_key: `r2://safe/${id}.avif`,
    wall_safe_r2_key: `r2://safe/${id}.jpg`,
  };
}

test('nobody opted out → empty veto, not failed', async () => {
  const c = stubClient({ guests: { data: [] } });
  const v = await loadConsentVetoedPapicIds(c, 'e1');
  assert.equal(v.failed, false);
  assert.equal(v.ids.size, 0);
});

test('an opted-out guest → every papic_photos capture tagging them is vetoed', async () => {
  const c = stubClient({
    guests: { data: [{ guest_id: 'g-out' }] },
    photo_tags: { data: [{ source_id: 'p1' }, { source_id: 'p2' }, { source_id: 'p1' }] },
  });
  const v = await loadConsentVetoedPapicIds(c, 'e1');
  assert.equal(v.failed, false);
  assert.deepEqual([...v.ids].sort(), ['p1', 'p2']);
});

test('opted-out guest but no tagged captures → empty veto, not failed', async () => {
  const c = stubClient({
    guests: { data: [{ guest_id: 'g-out' }] },
    photo_tags: { data: [] },
  });
  const v = await loadConsentVetoedPapicIds(c, 'e1');
  assert.equal(v.failed, false);
  assert.equal(v.ids.size, 0);
});

test('guests read error → failed (callers withhold ALL papic)', async () => {
  const c = stubClient({ guests: { data: null, error: { message: 'boom' } } });
  const v = await loadConsentVetoedPapicIds(c, 'e1');
  assert.equal(v.failed, true);
  assert.equal(v.ids.size, 0);
});

test('photo_tags read error → failed (fail closed on the second read too)', async () => {
  const c = stubClient({
    guests: { data: [{ guest_id: 'g-out' }] },
    photo_tags: { data: null, error: { message: 'boom' } },
  });
  const v = await loadConsentVetoedPapicIds(c, 'e1');
  assert.equal(v.failed, true);
  assert.equal(v.ids.size, 0);
});

// ── THE FACEBLOCK ARM (PAP-7, 2026-09-16) ───────────────────────────────────

test('POSITIVE CONTROL — with no FaceBlock guest this fixture SHOWS the original', async () => {
  // Without this, every assertion below could be passing because the fixture
  // can never produce a visible photo at all. Same event, same capture, same
  // code path; the ONLY difference in the FaceBlock test that follows is the
  // answer to `papic_event_blurs_every_capture`.
  const c = stubClient(
    { guests: { data: [] }, papic_photos: { data: [baked('p1')] } },
    { data: false },
  );
  const v = await loadConsentVetoedPapicIds(c, 'e1');
  assert.equal(v.failed, false);
  assert.equal(v.ids.size, 0, 'nothing is vetoed on an event with no FaceBlock guest');
  assert.equal(
    publicKeyForCapture(v, 'p1', 'r2://media/p1.jpg'),
    'r2://media/p1.jpg',
    'the ORIGINAL is served — so a later null is caused by FaceBlock, not by the fixture',
  );
});

test('a FaceBlock guest vetoes EVERY capture on the event — including untagged ones', async () => {
  const c = stubClient(
    {
      guests: { data: [] }, // nobody withdrew consent: this is FaceBlock alone
      papic_photos: { data: [baked('p1'), baked('p2')] },
      papic_guest_captures: { data: [baked('c1', 'capture_id', 'media_type')] },
    },
    { data: true },
  );
  const v = await loadConsentVetoedPapicIds(c, 'e1');
  assert.equal(v.failed, false);
  assert.deepEqual(
    [...v.ids].sort(),
    ['c1', 'p1', 'p2'],
    'FaceBlock is EVENT-WIDE — a capture nobody is tagged in is vetoed too',
  );
  // And the answer reaches the gate, in both tables.
  assert.equal(publicKeyForCapture(v, 'p1', 'r2://media/p1.jpg'), 'r2://safe/p1.avif');
  assert.equal(publicKeyForCapture(v, 'c1', 'r2://media/c1.jpg'), 'r2://safe/c1.avif');
});

test('a FaceBlock capture with NO bake is withheld, never served unblurred', async () => {
  const c = stubClient(
    {
      guests: { data: [] },
      papic_photos: {
        data: [
          { photo_id: 'p1', photo_type: 'photo', faceblock_baked_at: null,
            safe_display_r2_key: null, wall_safe_r2_key: null },
        ],
      },
      papic_guest_captures: { data: [] },
    },
    { data: true },
  );
  const v = await loadConsentVetoedPapicIds(c, 'e1');
  assert.ok(v.ids.has('p1'));
  assert.equal(publicKeyForCapture(v, 'p1', 'r2://media/p1.jpg'), null);
});

test('wall_safe_r2_key WITHOUT a bake is the ORIGINAL and must not be served as a blur', async () => {
  // `wall_ingest` stamps wall_safe_r2_key = COALESCE(wall_safe_r2_key,
  // r2_object_key), so on a capture that needed no blur at ingest it holds the
  // unblurred original. Measured in prod 2026-09-16: 1 of 25 papic_photos rows
  // is exactly this. Accepting it would hand the original back while calling it
  // blurred — the one failure mode a blur gate cannot have.
  const c = stubClient(
    {
      guests: { data: [] },
      papic_photos: {
        data: [
          { photo_id: 'p1', photo_type: 'photo', faceblock_baked_at: null,
            safe_display_r2_key: null, wall_safe_r2_key: 'r2://media/p1.jpg' },
        ],
      },
      papic_guest_captures: { data: [] },
    },
    { data: true },
  );
  const v = await loadConsentVetoedPapicIds(c, 'e1');
  assert.equal(publicKeyForCapture(v, 'p1', 'r2://media/p1.jpg'), null);
});

test('a CLIP under FaceBlock is dropped — there is no video blur to fall back to', async () => {
  const c = stubClient(
    {
      guests: { data: [] },
      papic_photos: {
        data: [
          { photo_id: 'v1', photo_type: 'clip', faceblock_baked_at: '2026-09-16T00:00:00Z',
            safe_display_r2_key: 'r2://safe/v1.avif', wall_safe_r2_key: null },
        ],
      },
      papic_guest_captures: { data: [] },
    },
    { data: true },
  );
  const v = await loadConsentVetoedPapicIds(c, 'e1');
  assert.ok(v.ids.has('v1'));
  assert.equal(publicKeyForCapture(v, 'v1', 'r2://media/v1.mp4'), null);
});

test('the FaceBlock RPC erroring → failed (an unanswerable blur question withholds)', async () => {
  const c = stubClient({ guests: { data: [] } }, { data: null, error: { message: 'no such function' } });
  const v = await loadConsentVetoedPapicIds(c, 'e1');
  assert.equal(v.failed, true);
  assert.equal(v.ids.size, 0);
  assert.equal(publicKeyForCapture(v, 'p1', 'r2://media/p1.jpg'), null);
});

test('a FaceBlock enumeration read erroring → failed, not a partial veto', async () => {
  // A partial id set is worse than none: the captures we failed to enumerate
  // would be served UNBLURRED while the page looked like it had blurred.
  const c = stubClient(
    { guests: { data: [] }, papic_photos: { data: null, error: { message: 'boom' } } },
    { data: true },
  );
  const v = await loadConsentVetoedPapicIds(c, 'e1');
  assert.equal(v.failed, true);
  assert.equal(v.ids.size, 0);
});
