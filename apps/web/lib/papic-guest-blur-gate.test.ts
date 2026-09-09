/**
 * lib/papic-guest-blur-gate.test.ts
 *
 * The decision walked exhaustively, plus the loader's two failure directions.
 *
 * ── WHAT THIS IS DEFENDING ─────────────────────────────────────────────────
 * Ana withdraws her photo consent. Ben, at the same table, opens "photos of
 * you". Before this gate he saw her unblurred face and could download it at
 * full resolution — the venue wall, the public event page and the shared pool
 * all blurred her, and the six per-guest reads plus the two file routes and the
 * story maker did not.
 *
 * The load-bearing property is MONOTONICITY: this can only ever show LESS than
 * the caller would have shown on its own. `originalCanNeverEscape` walks every
 * input combination and asserts the original key is returned ONLY when no blur
 * is required — so a future edit that adds a "helpful" fallback fails here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  blurGateKey,
  emptyBlurGate,
  failedBlurGate,
  guestMustWithhold,
  guestSafeKeyForCapture,
  loadGuestBlurGate,
  type GuestBlurGate,
  type SafeStandIn,
} from './papic-guest-blur-gate';

const REF = { sourceTable: 'papic_photos' as const, sourceId: 'p1' };
const ORIGINAL = 'r2://media/p1.display.avif';

function gateWith(standIn: Partial<SafeStandIn> | null): GuestBlurGate {
  const key = blurGateKey(REF.sourceTable, REF.sourceId);
  const standIns = new Map<string, SafeStandIn>();
  if (standIn) {
    standIns.set(key, {
      thumb: null,
      tile: null,
      display: null,
      baked: false,
      isStill: true,
      ...standIn,
    });
  }
  return { needsBlur: new Set([key]), standIns, failed: false };
}

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------

test('no blur required → the original key, untouched', () => {
  assert.equal(guestSafeKeyForCapture(emptyBlurGate(), REF, ORIGINAL), ORIGINAL);
});

test('a capture with no key at all is withheld, blur or no blur', () => {
  assert.equal(guestSafeKeyForCapture(emptyBlurGate(), REF, null), null);
  assert.equal(guestSafeKeyForCapture(emptyBlurGate(), REF, ''), null);
});

test('the gate could not answer → EVERYTHING is withheld, including unblurred rows', () => {
  assert.equal(guestSafeKeyForCapture(failedBlurGate(), REF, ORIGINAL), null);
});

test('needs a blur, no stand-in row at all → withheld, never the original', () => {
  assert.equal(guestSafeKeyForCapture(gateWith(null), REF, ORIGINAL), null);
});

test('needs a blur, a safe key but NO bake behind it → withheld', () => {
  const gate = gateWith({ display: 'r2://media/p1.safe-display.avif', baked: false });
  assert.equal(guestSafeKeyForCapture(gate, REF, ORIGINAL), null);
});

test('needs a blur, baked but every safe key missing → withheld', () => {
  assert.equal(guestSafeKeyForCapture(gateWith({ baked: true }), REF, ORIGINAL), null);
});

test('a CLIP that needs a blur is dropped even when a still was baked', () => {
  const gate = gateWith({
    baked: true,
    isStill: false,
    display: 'r2://media/p1.safe-display.avif',
    thumb: 'r2://media/p1.safe-thumb.avif',
  });
  assert.equal(guestSafeKeyForCapture(gate, REF, ORIGINAL, 'display'), null);
  assert.equal(guestSafeKeyForCapture(gate, REF, ORIGINAL, 'thumb'), null);
});

test('needs a blur and is baked → the blurred stand-in at the size asked for', () => {
  const gate = gateWith({
    baked: true,
    thumb: 'r2://media/p1.safe-thumb.avif',
    tile: 'r2://media/p1.safe-tile.avif',
    display: 'r2://media/p1.safe-display.avif',
  });
  assert.equal(guestSafeKeyForCapture(gate, REF, ORIGINAL, 'thumb'), 'r2://media/p1.safe-thumb.avif');
  assert.equal(
    guestSafeKeyForCapture(gate, REF, ORIGINAL, 'display'),
    'r2://media/p1.safe-tile.avif',
  );
});

test('the fallback chain only ever reaches another BLURRED copy', () => {
  // Only the projector-sized JPEG exists (a row baked before the safe_* columns).
  const projectorOnly = gateWith({ baked: true, display: 'r2://media/p1.wallsafe-1.jpg' });
  assert.equal(
    guestSafeKeyForCapture(projectorOnly, REF, ORIGINAL, 'thumb'),
    'r2://media/p1.wallsafe-1.jpg',
  );
  assert.equal(
    guestSafeKeyForCapture(projectorOnly, REF, ORIGINAL, 'display'),
    'r2://media/p1.wallsafe-1.jpg',
  );
});

test('MONOTONE: the original escapes only when no blur is required', () => {
  const combos: Array<{ baked: boolean; isStill: boolean; hasKey: boolean }> = [];
  for (const baked of [true, false]) {
    for (const isStill of [true, false]) {
      for (const hasKey of [true, false]) combos.push({ baked, isStill, hasKey });
    }
  }
  for (const c of combos) {
    for (const size of ['thumb', 'display'] as const) {
      const gate = gateWith({
        baked: c.baked,
        isStill: c.isStill,
        display: c.hasKey ? 'r2://media/p1.safe-display.avif' : null,
        thumb: c.hasKey ? 'r2://media/p1.safe-thumb.avif' : null,
      });
      const out = guestSafeKeyForCapture(gate, REF, ORIGINAL, size);
      assert.notEqual(
        out,
        ORIGINAL,
        `the unblurred original escaped for ${JSON.stringify({ ...c, size })}`,
      );
    }
  }
  // And an unrelated capture on the same gate is untouched.
  const other = { sourceTable: 'papic_guest_captures' as const, sourceId: 'c9' };
  assert.equal(guestSafeKeyForCapture(gateWith(null), other, ORIGINAL), ORIGINAL);
});

test('guestMustWithhold answers the same question as the resolver', () => {
  assert.equal(guestMustWithhold(emptyBlurGate(), REF), false);
  assert.equal(guestMustWithhold(gateWith(null), REF), true);
  assert.equal(guestMustWithhold(failedBlurGate(), REF), true);
});

// ---------------------------------------------------------------------------
// The loader
// ---------------------------------------------------------------------------

type StubCall = { fn: string; args: Record<string, unknown> };

function stubAdmin(opts: {
  rpc?: { data?: unknown; error?: unknown };
  rows?: unknown[];
  rowsError?: unknown;
  calls?: StubCall[];
}) {
  return {
    rpc(fn: string, args: Record<string, unknown>) {
      opts.calls?.push({ fn, args });
      return Promise.resolve({ data: opts.rpc?.data ?? [], error: opts.rpc?.error ?? null });
    },
    from() {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => Promise.resolve({ data: opts.rows ?? [], error: opts.rowsError ?? null }),
      };
      return chain;
    },
  } as never;
}

test('no refs → an empty gate and NO query at all', async () => {
  const calls: StubCall[] = [];
  const gate = await loadGuestBlurGate(stubAdmin({ calls }), 'e1', []);
  assert.equal(gate.failed, false);
  assert.equal(gate.needsBlur.size, 0);
  assert.equal(calls.length, 0);
});

test('the predicate is asked by its real argument names', async () => {
  const calls: StubCall[] = [];
  await loadGuestBlurGate(stubAdmin({ calls }), 'e1', [REF]);
  assert.equal(calls.length, 1);
  const only = calls[0];
  assert.ok(only, 'the predicate was never asked at all');
  assert.equal(only.fn, 'papic_captures_needing_blur');
  assert.deepEqual(Object.keys(only.args).sort(), [
    'p_event_id',
    'p_source_ids',
    'p_source_table',
  ]);
  assert.equal(only.args.p_source_table, 'papic_photos');
});

test('a REFUSED predicate query fails the whole gate (withhold everything)', async () => {
  const gate = await loadGuestBlurGate(
    stubAdmin({ rpc: { error: { message: 'nope' } } }),
    'e1',
    [REF],
  );
  assert.equal(gate.failed, true);
  assert.equal(guestSafeKeyForCapture(gate, REF, ORIGINAL), null);
});

test('a refused STAND-IN read withholds only the rows that need a blur', async () => {
  const gate = await loadGuestBlurGate(
    stubAdmin({ rpc: { data: [{ source_id: 'p1' }] }, rowsError: { message: 'nope' } }),
    'e1',
    [REF, { sourceTable: 'papic_photos', sourceId: 'p2' }],
  );
  assert.equal(gate.failed, false);
  assert.equal(guestSafeKeyForCapture(gate, REF, ORIGINAL), null, 'p1 needs a blur ⇒ withheld');
  assert.equal(
    guestSafeKeyForCapture(gate, { sourceTable: 'papic_photos', sourceId: 'p2' }, ORIGINAL),
    ORIGINAL,
    'p2 needs no blur ⇒ untouched',
  );
});

test('a needing capture with a baked stand-in resolves to the blurred copy', async () => {
  const gate = await loadGuestBlurGate(
    stubAdmin({
      rpc: { data: [{ source_id: 'p1' }] },
      rows: [
        {
          photo_id: 'p1',
          photo_type: 'photo',
          faceblock_baked_at: '2026-09-01T00:00:00Z',
          safe_display_r2_key: 'r2://media/p1.safe-display.avif',
          safe_tile_r2_key: null,
          safe_thumb_r2_key: 'r2://media/p1.safe-thumb.avif',
          wall_safe_r2_key: 'r2://media/p1.wallsafe-1.jpg',
        },
      ],
    }),
    'e1',
    [REF],
  );
  assert.equal(
    guestSafeKeyForCapture(gate, REF, ORIGINAL, 'thumb'),
    'r2://media/p1.safe-thumb.avif',
  );
  assert.equal(
    guestSafeKeyForCapture(gate, REF, ORIGINAL, 'display'),
    'r2://media/p1.safe-display.avif',
  );
});
