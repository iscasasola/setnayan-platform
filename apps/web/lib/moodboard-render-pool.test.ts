/**
 * THE POOL'S PURE HALF — paging clamps, the derived slot→part map, and the
 * refusal to invent colour.
 *
 * ⛔ NOTHING HERE PRICES ANYTHING. The original MB9 matched a brief against a
 * prior render's digest and served it back free; the owner cancelled that on
 * 2026-09-03 ("always charge for renders"). If a future edit adds a cost, a
 * discount or a `config_digest` read to this module, the last test in this file
 * goes red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  POOL_MAX_LIMIT,
  POOL_MAX_OFFSET,
  POOL_PAGE_SIZE,
  normalizeRenderPoolQuery,
  poolPartLabel,
  renderPartIdsForSlot,
  shapeRenderPoolPage,
  type RawPoolRow,
} from './moodboard-render-pool';
import { MOODBOARD_SLOT_KEYS } from './moodboard-slots';
import { RENDER_PARTS, WHOLE_LOOK_PART_ID } from './moodboard-render-parts';

/* ── the slot → part map is DERIVED ───────────────────────────────────────── */

test('every slot resolves to at least the whole look, and never to a bogus part', () => {
  const known = new Set<string>([...RENDER_PARTS.map((p) => p.id), WHOLE_LOOK_PART_ID]);
  for (const slot of MOODBOARD_SLOT_KEYS) {
    const parts = renderPartIdsForSlot(slot);
    assert.ok(parts.includes(WHOLE_LOOK_PART_ID), `${slot} lost the whole look`);
    for (const id of parts) assert.ok(known.has(id), `${slot} → unknown part ${id}`);
    assert.equal(new Set(parts).size, parts.length, `${slot} listed a part twice`);
  }
});

test('a room slot reaches its aliased zone, and an attire slot its palette role', () => {
  // 🔑 DERIVED FROM THE REGISTRY, NOT LISTED. A reception zone added later
  // becomes browsable with no edit to this module — which is the failure a
  // hand-kept IN-list would produce silently: the couple designs the zone and
  // the picker never offers renders of it.
  assert.ok(renderPartIdsForSlot('ceiling').includes('room:ceiling'));
  assert.ok(renderPartIdsForSlot('bride').includes('people:bride'));
  assert.ok(renderPartIdsForSlot('venue').includes('place:venue'));
});

test('a key that is not a slot resolves to NOTHING — not to "everything"', () => {
  // An empty array means "do not query". A fallback of "all parts" here would
  // turn a typo into a full-pool read.
  assert.deepEqual(renderPartIdsForSlot('not_a_slot'), []);
  assert.deepEqual(renderPartIdsForSlot(''), []);
});

/* ── the cap is the server's, and it is unconditional ─────────────────────── */

test('an untrusted page request is clamped, however hostile', () => {
  const cases: Array<[unknown, number]> = [
    [undefined, POOL_PAGE_SIZE],
    [1_000_000, POOL_MAX_LIMIT],
    [Infinity, POOL_PAGE_SIZE],
    [Number.NaN, POOL_PAGE_SIZE],
    [-5, 1],
    ['12', 12],
  ];
  for (const [limit, expected] of cases) {
    assert.equal(normalizeRenderPoolQuery({ slotKey: 'ceiling', limit })?.limit, expected);
  }
  assert.equal(
    normalizeRenderPoolQuery({ slotKey: 'ceiling', offset: 99_999 })?.offset,
    POOL_MAX_OFFSET,
  );
  assert.equal(normalizeRenderPoolQuery({ slotKey: 'ceiling', offset: -1 })?.offset, 0);
  assert.equal(normalizeRenderPoolQuery({ slotKey: 'ceiling', offset: Infinity })?.offset, 0);
});

test('a non-slot query is refused outright', () => {
  assert.equal(normalizeRenderPoolQuery({ slotKey: 'nope' }), null);
  assert.equal(normalizeRenderPoolQuery({ slotKey: 42 }), null);
  assert.equal(normalizeRenderPoolQuery({}), null);
});

/* ── shaping: what is shown, what is WITHHELD, and why they differ ────────── */

const row = (over: Partial<RawPoolRow> = {}): RawPoolRow => ({
  render_id: 'r1',
  part_id: 'room:ceiling',
  gallery_image_key: 'render-gallery/e/r1.jpg',
  swatches: ['#a83f2b', '#f2e6d8'],
  created_at: '2026-09-04T00:00:00Z',
  total_count: 3,
  ...over,
});

const sign = async (key: string) => `https://signed/${key}`;

test('a good row becomes six colours and a signed URL of the MARKED copy', async () => {
  const out = await shapeRenderPoolPage([row()], sign);
  assert.equal(out.withheld, 0);
  assert.equal(out.total, 3);
  const r = out.renders[0]!;
  assert.equal(r.imageUrl, 'https://signed/render-gallery/e/r1.jpg');
  assert.equal(r.partLabel, 'Ceiling');
  // Cycled to six, exactly like the template and supplier paths.
  assert.deepEqual(r.swatches, [
    '#a83f2b',
    '#f2e6d8',
    '#a83f2b',
    '#f2e6d8',
    '#a83f2b',
    '#f2e6d8',
  ]);
});

test('a render with NO palette is withheld rather than padded with invented colour', async () => {
  // A picked photo writes six NOT NULL sampled_hex_* columns. Padding with
  // cream would put colour the couple never chose on their board, and it would
  // render exactly like a real sample.
  for (const swatches of [null, [], ['not-a-hex']]) {
    const out = await shapeRenderPoolPage([row({ swatches: swatches as string[] })], sign);
    assert.equal(out.renders.length, 0);
    assert.equal(out.withheld, 1);
  }
});

test('a render whose URL cannot be minted is withheld, not shown as a grey square', async () => {
  const out = await shapeRenderPoolPage([row()], async () => null);
  assert.equal(out.renders.length, 0);
  assert.equal(out.withheld, 1);
  // 🔑 total SURVIVES the withholding, so "nobody has shared a render" and "we
  // hold renders we cannot show" stay two different sentences.
  assert.equal(out.total, 3);
});

test('an answered-empty pool is not the same shape as a withheld one', async () => {
  const empty = await shapeRenderPoolPage([], sign);
  assert.deepEqual({ n: empty.renders.length, w: empty.withheld, t: empty.total }, {
    n: 0,
    w: 0,
    t: 0,
  });
});

test('the whole look is labelled, never shown as its raw id', () => {
  assert.equal(poolPartLabel(WHOLE_LOOK_PART_ID), 'The whole look');
  assert.equal(poolPartLabel('room:ceiling'), 'Ceiling');
});

/* ── the cancelled cache stays cancelled ──────────────────────────────────── */

test('this module prices nothing and matches nothing', () => {
  const src = readFileSync(new URL('./moodboard-render-pool.ts', import.meta.url), 'utf8');
  // Strip the header, which NAMES the cancelled design in order to bury it.
  const body = src.slice(src.indexOf('*/') + 2);
  for (const forbidden of [
    'config_digest',
    'credits',
    'creditsForPart',
    'moodboard_render_config',
    'moodboard_begin_render',
    'generateRenderImage',
  ]) {
    assert.equal(
      body.includes(forbidden),
      false,
      `the pool must not reach ${forbidden} — picking a reference is not rendering`,
    );
  }
});
