/**
 * moodboard-finalization.test.ts — MB12's pure core, and the three lists it is
 * allowed to be wrong about only VISIBLY.
 *
 * Everything this module answers is DERIVED (see its docblock), which is what
 * makes it safe. The risk with a derived answer is the opposite of a stale
 * list: it shrinks quietly. A slot that loses its trades, a part that loses its
 * aliasing slot, a role that stops being derivable — each removes an Ask button
 * and each renders as "no shop does this", which is a sentence a couple
 * believes. So the parts that answer NOTHING are pinned here by name.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDesignSnapshot,
  canonicalServicesForPart,
  dressingFieldsFrozenBy,
  eligibleSuppliersForPart,
  finalizeBlocker,
  frozenNow,
  isFinalizablePartId,
  liveByPart,
  paletteKeysFrozenBy,
  partFreezesNothing,
  renderPartLabel,
  supplierCanAnswerPart,
  tradeLabelsForPart,
  type BookedSupplier,
  type PartFinalizationRecord,
} from './moodboard-finalization';
import { RENDER_PARTS, WHOLE_LOOK_PART_ID } from './moodboard-render-parts';
import { canonicalServicesForSlot } from './moodboard-gallery';
import { deriveBoard } from './palette-styles';
import type { RolePalette } from './mood-board';

/* ── 1 · which parts can be finalized at all ─────────────────────────────── */

test('every RENDER_PART is finalizable, and the whole look deliberately is not', () => {
  for (const p of RENDER_PARTS) {
    assert.equal(isFinalizablePartId(p.id), true, `${p.id} must be askable`);
  }
  // No single supplier builds the ceiling and the gowns and the cake. The
  // database refuses it too — `moodboard_part_finalizations_part_id_shape`
  // omits `whole_look`, unlike event_renders' own CHECK.
  assert.equal(isFinalizablePartId(WHOLE_LOOK_PART_ID), false);
  assert.equal(isFinalizablePartId('room:nope'), false);
});

test('a part label is never the raw key — a supplier must not be emailed "room:welcome_signage"', () => {
  assert.equal(renderPartLabel('people:bride'), 'Bride');
  assert.equal(renderPartLabel('nonsense'), 'design');
  for (const p of RENDER_PARTS) {
    assert.ok(!renderPartLabel(p.id).includes(':'), `${p.id} label leaks its namespace`);
  }
});

/* ── 2 · who may be asked — derived from MB10, never restated ────────────── */

test('a part’s services are exactly its slots’ services — one map, composed, not copied', () => {
  // 🔑 THE ANTI-DRIFT ASSERTION. If somebody ever hand-writes a part → trade
  // table, this fails: the only correct answer is the composition of MB2's
  // part → slot join and MB10's slot → trade map.
  const bride = canonicalServicesForPart('people:bride');
  assert.deepEqual([...bride].sort(), [...canonicalServicesForSlot('bride')].sort());

  const tables = canonicalServicesForPart('room:tables');
  assert.deepEqual([...tables].sort(), [...canonicalServicesForSlot('table')].sort());
});

/**
 * 🔒 THE PIN. Eight parts alias no inspiration slot, so no trade supplies them.
 * That is an ANSWER, not a gap to be filled with a guess — but it must only
 * ever change visibly, in a diff somebody reads.
 *
 * To make one of these askable, give its slot a trade in
 * `MOODBOARD_SLOT_TRADES` (or give the part an aliasing slot), where the
 * picker and MB11's upload gate learn about it too. Editing this list without
 * doing that is the change this test exists to stop.
 */
const PARTS_NO_TRADE_ANSWERS = [
  'people:bearers_flower_girl',
  'people:muslim_principals',
  'people:officiants',
  'people:secondary_sponsors',
  'room:entrance',
  'room:photo_wall',
  'room:walls',
  'room:welcome_signage',
];

test('exactly eight parts have no supplying trade, and they are these eight', () => {
  const none = RENDER_PARTS.filter((p) => canonicalServicesForPart(p.id).length === 0)
    .map((p) => p.id)
    .sort();
  assert.deepEqual(
    none,
    PARTS_NO_TRADE_ANSWERS,
    'a part gaining or losing its trades removes or adds an Ask button, and both read as "no shop does this"',
  );
});

test('every OTHER part has at least one trade and at least one human label for it', () => {
  for (const p of RENDER_PARTS) {
    if (PARTS_NO_TRADE_ANSWERS.includes(p.id)) continue;
    assert.ok(canonicalServicesForPart(p.id).length > 0, `${p.id} lost its services`);
    const labels = tradeLabelsForPart(p.id);
    assert.ok(labels.length > 0, `${p.id} has services but no trade label to name them`);
    for (const l of labels) assert.ok(l.trim().length > 0, `${p.id} has a blank trade label`);
  }
});

/* ── 3 · the blocker is a SENTENCE, never a dead button ──────────────────── */

const FLORIST: BookedSupplier = {
  vendorId: 'v-florist',
  name: 'Bloom & Vine',
  services: canonicalServicesForSlot('flowers'),
};
const CATERER: BookedSupplier = { vendorId: 'v-cater', name: 'Kusina', services: ['catering'] };

test('a part with no trade says so, rather than offering nothing and explaining nothing', () => {
  const b = finalizeBlocker('room:walls', [FLORIST]);
  assert.equal(b?.code, 'no_trade');
  assert.ok(b!.message.length > 20, 'a blocker with no sentence is a dead button');
});

test('a part with a trade but nobody booked names the trade to book', () => {
  const b = finalizeBlocker('place:flowers', [CATERER]);
  assert.equal(b?.code, 'no_booked_supplier');
  assert.ok(
    b!.message.includes('Florist'),
    'the couple has to be told WHICH trade would unlock it',
  );
});

test('a booked supplier in the trade unblocks it, and only they are offered', () => {
  assert.equal(finalizeBlocker('place:flowers', [FLORIST, CATERER]), null);
  assert.deepEqual(
    eligibleSuppliersForPart('place:flowers', [FLORIST, CATERER]).map((s) => s.vendorId),
    ['v-florist'],
  );
  assert.equal(supplierCanAnswerPart('place:flowers', CATERER), false);
});

test('a booking with no shop behind it has no services and is never eligible', () => {
  // A supplier the couple typed in themselves. Not an error — but there is no
  // trade to check against, so they cannot be asked. Failing OPEN here would
  // let any booking sign off on any part.
  const ownSupplier: BookedSupplier = { vendorId: 'v-own', name: 'Tita', services: [] };
  assert.equal(supplierCanAnswerPart('place:flowers', ownSupplier), false);
  assert.equal(finalizeBlocker('place:flowers', [ownSupplier])?.code, 'no_booked_supplier');
});

/* ── 4 · what agreeing freezes ───────────────────────────────────────────── */

test('an attire part freezes its own role', () => {
  assert.deepEqual(paletteKeysFrozenBy('people:bride'), ['bride']);
  assert.deepEqual(paletteKeysFrozenBy('people:guest'), ['guest']);
});

test('the wedding party freezes its four SPLIT keys too, because the room resolves those first', () => {
  const keys = paletteKeysFrozenBy('people:wedding_party');
  for (const fine of ['maid_of_honor', 'best_man', 'bridesmaids', 'groomsmen']) {
    assert.ok(
      keys.includes(fine as never),
      `${fine} falls back to wedding_party, so freezing only the fallback lets a change to the ` +
        'majors re-dress an entourage the supplier already agreed to',
    );
  }
});

test('officiants freeze nothing — the one role that is never derived has nothing to stop', () => {
  assert.deepEqual(paletteKeysFrozenBy('people:officiants'), []);
});

test('room and place parts freeze no ROLE — the majors are the source and are never touchable', () => {
  for (const p of RENDER_PARTS) {
    if (p.group === 'people') continue;
    assert.deepEqual(paletteKeysFrozenBy(p.id), [], `${p.id} must not claim a palette role`);
  }
});

test('the tables and the ceiling freeze the room-dressing fields their own resolver names', () => {
  assert.deepEqual(dressingFieldsFrozenBy('room:tables'), ['linens', 'chairs', 'florals']);
  assert.deepEqual(dressingFieldsFrozenBy('room:ceiling'), ['lighting_warmth']);
  assert.deepEqual(dressingFieldsFrozenBy('place:flowers'), ['florals']);
});

/**
 * 🔒 THE SECOND PIN, AND THE HONEST ONE. Some parts are RECORDED but not
 * FROZEN: their colour is the couple's five majors read directly, and the
 * majors are section 00's own — never touchable by an agreement (the
 * one-directional rule; `touched_roles` refuses `reception` as a member).
 *
 * The panel says so on the row, in words. This pin is what stops that sentence
 * silently becoming false in either direction — a part gaining a real freeze
 * and still being labelled "recorded only", or losing one and still promising
 * a stop it no longer performs.
 */
test('the parts that freeze nothing are exactly the ones the UI says so about', () => {
  const nothing = RENDER_PARTS.filter((p) => partFreezesNothing(p.id))
    .map((p) => p.id)
    .sort();
  assert.deepEqual(nothing, [
    'people:officiants',
    'room:backdrop',
    'room:entrance',
    'room:photo_wall',
    'room:stage',
    'room:tunnel',
    'room:walls',
    'room:welcome_signage',
    'place:cake',
    'place:cocktail',
    'place:reception_venue',
    'place:venue',
  ].sort());
});

/* ── 5 · the snapshot is what the couple is LOOKING AT ───────────────────── */

const MAJORS = ['#8C3B2E', '#C9A227', '#2F4858', '#EDE6DA', '#6B8F71'];

test('the snapshot records the DERIVED colours a couple can see, not empty arrays', () => {
  const palette: RolePalette = { reception: MAJORS };
  const derived = deriveBoard(MAJORS, 'depth');
  const snap = buildDesignSnapshot('people:bride', palette, derived, {});
  assert.ok(
    (snap.palette.bride ?? []).length > 0,
    'a role that has never been hand-edited still HAS colours on screen — writing [] here would ' +
      'blank the swatches the instant the supplier agreed',
  );
  assert.deepEqual(snap.palette.bride, derived.bride);
});

test('a touched role snapshots the couple’s OWN colours, not a re-derivation', () => {
  const palette: RolePalette = {
    reception: MAJORS,
    bride: ['#FFFFFF'],
    touched_roles: ['bride'],
  };
  const snap = buildDesignSnapshot('people:bride', palette, deriveBoard(MAJORS, 'depth'), {});
  assert.deepEqual(snap.palette.bride, ['#FFFFFF']);
});

test('a room part snapshots the resolved dressing and the reception design it is about', () => {
  const palette: RolePalette = { reception: MAJORS };
  const design = { tables: { linen: ['plain'] } } as never;
  const snap = buildDesignSnapshot('room:tables', palette, deriveBoard(MAJORS, 'depth'), design);
  assert.deepEqual(Object.keys(snap.room_dressing).sort(), ['chairs', 'florals', 'linens']);
  assert.equal(snap.palette.bride, undefined, 'a room part must not claim an attire role');
  assert.deepEqual(snap.reception_design, design, 'the treatments agreed to are part of the record');
});

test('a part with no colours at all produces an empty palette, not a fabricated one', () => {
  // No majors chosen yet: `derivedBoardFor` returns null upstream, and every
  // role is honestly empty. The snapshot must say so rather than invent cream.
  const snap = buildDesignSnapshot('people:bride', {}, null, {});
  assert.deepEqual(snap.palette, {});
});

/* ── 6 · reading the rows ────────────────────────────────────────────────── */

function row(over: Partial<PartFinalizationRecord>): PartFinalizationRecord {
  return {
    finalization_id: 'f1',
    part_id: 'people:bride',
    vendor_id: 'v1',
    state: 'agreed',
    expires_at: null,
    agreed_at: '2026-09-04T00:00:00Z',
    declined_at: null,
    decline_reason: null,
    reopen_state: null,
    reopen_expires_at: null,
    reopen_decline_reason: null,
    frozen_palette_keys: ['bride'],
    frozen_dressing_fields: [],
    ...over,
  };
}

test('only pending and agreed rows are live — a closed round does not hold the part', () => {
  const live = liveByPart([
    row({ finalization_id: 'old', state: 'declined' }),
    row({ finalization_id: 'now', state: 'pending' }),
  ]);
  assert.equal(live.get('people:bride')?.finalization_id, 'now');
});

test('only AGREED rows freeze anything', () => {
  assert.deepEqual([...frozenNow([row({ state: 'pending' })]).paletteKeys], []);
  assert.deepEqual([...frozenNow([row({})]).paletteKeys], ['bride']);
  assert.deepEqual(
    [...frozenNow([row({ frozen_dressing_fields: ['linens'] })]).dressingFields],
    ['linens'],
  );
});

test('the frozen set comes from the ROW, so a re-open cannot release the couple’s own edit', () => {
  // The agreement froze only `wedding_party`; `bride` was already the couple's.
  // Re-deriving the answer from `paletteKeysFrozenBy('people:wedding_party')`
  // would claim five keys, and releasing them would delete an edit nobody
  // agreed to on the couple's behalf.
  const frozen = frozenNow([
    row({ part_id: 'people:wedding_party', frozen_palette_keys: ['wedding_party'] }),
  ]);
  assert.deepEqual([...frozen.paletteKeys], ['wedding_party']);
  assert.equal(frozen.paletteKeys.has('bridesmaids'), false);
});
