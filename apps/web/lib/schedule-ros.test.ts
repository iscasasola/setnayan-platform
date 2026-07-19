/**
 * Unit suite for the Coordinator P2 filtered run-of-show — the audience
 * filter (couple / guest / vendor lenses over ONE master timeline) and the
 * bulk-retime span + patch math. These are the two behaviors the spec pins:
 * views are FILTERS (never copies), and a retime shifts a contiguous span
 * with durations preserved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  filterBlocksForAudience,
  countVendorTaggedBlocks,
  isBlockTaggedToVendor,
  selectRetimeSpan,
  computeRetimePatches,
  MAX_RETIME_MINUTES,
  type RosMetaMap,
  type BlockRosMeta,
} from './schedule-ros';

type TestBlock = {
  block_id: string;
  parent_block_id: string | null;
  is_public: boolean;
  start_at: string;
  end_at: string | null;
  sort_order: number;
};

const VENDOR_A = 'vendor-aaaa';
const VENDOR_B = 'vendor-bbbb';

/** A representative wedding-day master: 4 top-level blocks, 2 children under
 *  Ceremony, 1 child under Reception. Times are event-local-at-UTC ISO. */
function masterBlocks(): TestBlock[] {
  return [
    { block_id: 'prep', parent_block_id: null, is_public: false, start_at: '2026-12-12T08:00:00.000Z', end_at: '2026-12-12T12:00:00.000Z', sort_order: 100 },
    { block_id: 'ceremony', parent_block_id: null, is_public: true, start_at: '2026-12-12T14:00:00.000Z', end_at: '2026-12-12T15:30:00.000Z', sort_order: 200 },
    { block_id: 'ceremony-procession', parent_block_id: 'ceremony', is_public: false, start_at: '2026-12-12T14:00:00.000Z', end_at: '2026-12-12T14:15:00.000Z', sort_order: 10 },
    { block_id: 'ceremony-vows', parent_block_id: 'ceremony', is_public: false, start_at: '2026-12-12T14:15:00.000Z', end_at: '2026-12-12T14:45:00.000Z', sort_order: 20 },
    { block_id: 'cocktails', parent_block_id: null, is_public: true, start_at: '2026-12-12T16:00:00.000Z', end_at: '2026-12-12T17:00:00.000Z', sort_order: 300 },
    { block_id: 'reception', parent_block_id: null, is_public: true, start_at: '2026-12-12T17:00:00.000Z', end_at: '2026-12-12T22:00:00.000Z', sort_order: 400 },
    { block_id: 'reception-dinner', parent_block_id: 'reception', is_public: false, start_at: '2026-12-12T18:00:00.000Z', end_at: '2026-12-12T19:00:00.000Z', sort_order: 10 },
  ];
}

function meta(entries: Record<string, Partial<BlockRosMeta>>): RosMetaMap {
  const map: RosMetaMap = new Map();
  for (const [blockId, m] of Object.entries(entries)) {
    map.set(blockId, {
      responsible_party: m.responsible_party ?? null,
      responsible_vendor_ids: m.responsible_vendor_ids ?? [],
    });
  }
  return map;
}

function ids(blocks: readonly { block_id: string }[]): string[] {
  return blocks.map((b) => b.block_id);
}

// ───────────────────────────── audience filter ─────────────────────────────

test('couple view is the untouched master', () => {
  const blocks = masterBlocks();
  const view = filterBlocksForAudience(blocks, { kind: 'couple' });
  assert.deepEqual(ids(view), ids(blocks));
});

test('guest view keeps existing is_public semantics exactly', () => {
  const view = filterBlocksForAudience(masterBlocks(), { kind: 'guest' });
  assert.deepEqual(ids(view), ['ceremony', 'cocktails', 'reception']);
});

test('vendor view: only rows tagged to that vendor', () => {
  const m = meta({
    cocktails: { responsible_vendor_ids: [VENDOR_A] },
    reception: { responsible_vendor_ids: [VENDOR_B] },
  });
  const view = filterBlocksForAudience(
    masterBlocks(),
    { kind: 'vendor', eventVendorId: VENDOR_A },
    m,
  );
  assert.deepEqual(ids(view), ['cocktails']);
});

test('vendor view: tagged parent pulls in its child parts', () => {
  const m = meta({ reception: { responsible_vendor_ids: [VENDOR_A] } });
  const view = filterBlocksForAudience(
    masterBlocks(),
    { kind: 'vendor', eventVendorId: VENDOR_A },
    m,
  );
  assert.deepEqual(ids(view), ['reception', 'reception-dinner']);
});

test('vendor view: tagged child keeps its parent header for context', () => {
  const m = meta({ 'ceremony-vows': { responsible_vendor_ids: [VENDOR_A] } });
  const view = filterBlocksForAudience(
    masterBlocks(),
    { kind: 'vendor', eventVendorId: VENDOR_A },
    m,
  );
  assert.deepEqual(ids(view), ['ceremony', 'ceremony-vows']);
});

test('vendor view: zero tags → empty slice (caller decides the fallback)', () => {
  const view = filterBlocksForAudience(
    masterBlocks(),
    { kind: 'vendor', eventVendorId: VENDOR_A },
    meta({}),
  );
  assert.deepEqual(view, []);
});

test('vendor view auto-syncs: same master, new tag, no copies', () => {
  const blocks = masterBlocks();
  const before = filterBlocksForAudience(
    blocks,
    { kind: 'vendor', eventVendorId: VENDOR_A },
    meta({ cocktails: { responsible_vendor_ids: [VENDOR_A] } }),
  );
  // The couple tags one more master row; the vendor's derived view widens
  // with NO copy step — it is a filter over the same array.
  const after = filterBlocksForAudience(
    blocks,
    { kind: 'vendor', eventVendorId: VENDOR_A },
    meta({
      cocktails: { responsible_vendor_ids: [VENDOR_A] },
      prep: { responsible_vendor_ids: [VENDOR_A, VENDOR_B] },
    }),
  );
  assert.deepEqual(ids(before), ['cocktails']);
  assert.deepEqual(ids(after), ['prep', 'cocktails']);
  assert.equal(after.find((b) => b.block_id === 'prep'), blocks[0]);
});

test('countVendorTaggedBlocks counts direct tags only (no expansion)', () => {
  const m = meta({
    reception: { responsible_vendor_ids: [VENDOR_A] },
    'ceremony-vows': { responsible_vendor_ids: [VENDOR_A] },
  });
  assert.equal(countVendorTaggedBlocks(masterBlocks(), VENDOR_A, m), 2);
  assert.equal(countVendorTaggedBlocks(masterBlocks(), VENDOR_B, m), 0);
});

test('isBlockTaggedToVendor: missing meta row → false', () => {
  assert.equal(isBlockTaggedToVendor(meta({}), 'ceremony', VENDOR_A), false);
});

// ─────────────────────────────── bulk retime ───────────────────────────────

test('selectRetimeSpan: from a mid block through the end, children included', () => {
  const span = selectRetimeSpan(masterBlocks(), 'cocktails');
  assert.deepEqual(ids(span), ['cocktails', 'reception', 'reception-dinner']);
});

test('selectRetimeSpan: bounded span (from → to inclusive)', () => {
  const span = selectRetimeSpan(masterBlocks(), 'ceremony', 'cocktails');
  assert.deepEqual(ids(span), ['ceremony', 'ceremony-procession', 'ceremony-vows', 'cocktails']);
});

test('selectRetimeSpan: child anchor resolves to its parent', () => {
  const span = selectRetimeSpan(masterBlocks(), 'ceremony-vows', 'ceremony');
  assert.deepEqual(ids(span), ['ceremony', 'ceremony-procession', 'ceremony-vows']);
});

test('selectRetimeSpan: unknown anchor or inverted range selects nothing', () => {
  assert.deepEqual(selectRetimeSpan(masterBlocks(), 'nope'), []);
  assert.deepEqual(selectRetimeSpan(masterBlocks(), 'reception', 'ceremony'), []);
});

test('computeRetimePatches: +30 min cascade shifts starts AND ends, durations kept', () => {
  const patches = computeRetimePatches(masterBlocks(), 'ceremony', 30);
  const byId = new Map(patches.map((p) => [p.block_id, p]));
  // prep is BEFORE the anchor — untouched.
  assert.equal(byId.has('prep'), false);
  assert.equal(byId.size, 6);
  assert.equal(byId.get('ceremony')!.start_at, '2026-12-12T14:30:00.000Z');
  assert.equal(byId.get('ceremony')!.end_at, '2026-12-12T16:00:00.000Z');
  assert.equal(byId.get('reception-dinner')!.start_at, '2026-12-12T18:30:00.000Z');
  // Duration preserved on every patched row.
  const master = new Map(masterBlocks().map((b) => [b.block_id, b]));
  for (const p of patches) {
    const orig = master.get(p.block_id)!;
    if (orig.end_at === null) {
      assert.equal(p.end_at, null);
    } else {
      const origDur = new Date(orig.end_at).getTime() - new Date(orig.start_at).getTime();
      const newDur = new Date(p.end_at!).getTime() - new Date(p.start_at).getTime();
      assert.equal(newDur, origDur);
    }
  }
});

test('computeRetimePatches: negative delta pulls the program earlier', () => {
  const patches = computeRetimePatches(masterBlocks(), 'reception', -15);
  assert.deepEqual(ids(patches), ['reception', 'reception-dinner']);
  assert.equal(patches[0]!.start_at, '2026-12-12T16:45:00.000Z');
});

test('computeRetimePatches: null end_at stays null', () => {
  const blocks: TestBlock[] = [
    { block_id: 'open', parent_block_id: null, is_public: true, start_at: '2026-12-12T22:00:00.000Z', end_at: null, sort_order: 100 },
  ];
  const patches = computeRetimePatches(blocks, 'open', 10);
  assert.equal(patches[0]!.end_at, null);
});

test('computeRetimePatches: rejects zero, fractional, and oversized deltas', () => {
  assert.throws(() => computeRetimePatches(masterBlocks(), 'ceremony', 0));
  assert.throws(() => computeRetimePatches(masterBlocks(), 'ceremony', 7.5));
  assert.throws(() => computeRetimePatches(masterBlocks(), 'ceremony', MAX_RETIME_MINUTES + 1));
  // The boundary itself is allowed.
  assert.equal(
    computeRetimePatches(masterBlocks(), 'reception', MAX_RETIME_MINUTES).length,
    2,
  );
});

test('computeRetimePatches: empty span → empty patches (no partial shifts)', () => {
  assert.deepEqual(computeRetimePatches(masterBlocks(), 'missing-id', 30), []);
});
