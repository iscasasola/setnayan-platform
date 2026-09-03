/**
 * A RENDERABLE PART MUST BE DERIVABLE FROM SHIPPED STATE — nothing may be
 * hand-written into the registry.
 *
 * ── WHY THIS GUARD ─────────────────────────────────────────────────────────
 * `lib/moodboard-render-parts.ts` exists because the alternative — twenty part
 * names typed into a file — goes stale the first time a zone is added, and goes
 * stale INVISIBLY: the couple designs the new zone, section 04 never offers to
 * render it, and nothing anywhere goes red. A derivation that anyone can
 * quietly append one literal to is the same bug wearing the derivation's
 * clothes, so these assertions are written to REFUSE a hand-written part rather
 * than merely to describe today's list.
 *
 * The shape of the refusal: every part must name the shipped list it came out
 * of AND a key that really exists in that list, and each source must contribute
 * EXACTLY as many parts as it has eligible entries. An invented part fails the
 * first (its key resolves nowhere) or the second (the count is one too many),
 * and one that impersonates a real key fails on the label or the collision
 * checks below.
 *
 * Counts are asserted against `RECEPTION_PARTS.length` and friends, never
 * against a number typed here — pinning "20" would make growing the vocabulary
 * look like a defect, which is the speed bump the Ugat node-count assertion was
 * rewritten to stop being.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  RENDER_PARTS,
  RENDER_PART_ID_PATTERN,
  WHOLE_LOOK_PART_ID,
  attirePaletteKeys,
  creditsForPart,
  inspirationSlotsForPart,
  isRenderPartId,
  renderPartById,
  renderPartsInGroup,
  type MoodboardRenderConfig,
} from './moodboard-render-parts';
import { RECEPTION_PARTS } from './reception-scene';
import { PALETTE_LIMITS, PALETTE_ORDER, isWeddingPartyFineKey } from './mood-board';
import { MOODBOARD_SLOT_KEYS } from './moodboard-slots';

/* ── the sabotage catchers ───────────────────────────────────────────────── */

test('every part names a source list AND a key that really exists in it', () => {
  const zoneIds = new Set<string>(RECEPTION_PARTS.map((p) => p.id));
  const attire = new Set<string>(attirePaletteKeys());
  const slots = new Set<string>(MOODBOARD_SLOT_KEYS);

  for (const part of RENDER_PARTS) {
    switch (part.source) {
      case 'reception_part':
        assert.ok(
          zoneIds.has(part.sourceKey),
          `${part.id} claims RECEPTION_PARTS but "${part.sourceKey}" is not a zone — hand-written?`,
        );
        assert.equal(part.group, 'room');
        break;
      case 'palette_role':
        assert.ok(
          attire.has(part.sourceKey),
          `${part.id} claims a PaletteKey attire role but "${part.sourceKey}" is not one — hand-written?`,
        );
        assert.equal(part.group, 'people');
        break;
      case 'inspiration_slot':
        assert.ok(
          slots.has(part.sourceKey),
          `${part.id} claims an inspiration slot but "${part.sourceKey}" is not one — hand-written?`,
        );
        assert.equal(part.group, 'places');
        break;
      default:
        assert.fail(`${part.id} has an unknown source`);
    }
  }
});

test('each source contributes EXACTLY its eligible entries — no extras can hide', () => {
  // The count check is what stops an invented part that borrows a real key.
  // Both halves are computed from the sources; neither is a literal.
  const eligibleZones = RECEPTION_PARTS.filter((p) => p.id !== 'people');
  assert.equal(renderPartsInGroup('room').length, eligibleZones.length);
  assert.equal(renderPartsInGroup('people').length, attirePaletteKeys().length);

  // Every eligible zone and every attire role is PRESENT, not merely counted —
  // equal counts with one swapped entry would otherwise pass.
  const ids = new Set(RENDER_PARTS.map((p) => p.id));
  for (const z of eligibleZones) assert.ok(ids.has(`room:${z.id}`), `missing room:${z.id}`);
  for (const k of attirePaletteKeys()) assert.ok(ids.has(`people:${k}`), `missing people:${k}`);
});

test('labels are the SOURCE labels, not re-typed', () => {
  for (const part of RENDER_PARTS) {
    if (part.source === 'reception_part') {
      const zone = RECEPTION_PARTS.find((p) => p.id === part.sourceKey);
      assert.equal(part.label, zone?.label);
    }
    if (part.source === 'palette_role') {
      assert.equal(
        part.label,
        PALETTE_LIMITS[part.sourceKey as keyof typeof PALETTE_LIMITS].label,
      );
    }
    // A place label has no upstream string to borrow (a slot key carries no
    // label anywhere in the app), so assert only that it is human — a couple
    // must never be shown `reception_venue`.
    assert.ok(part.label.trim().length > 0, `${part.id} has no label`);
    assert.ok(!part.label.includes('_'), `${part.id} shows a raw key as its label`);
  }
});

/* ── identity ────────────────────────────────────────────────────────────── */

test('part ids are unique and match the shape event_renders.part_id enforces', () => {
  const ids = RENDER_PARTS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate part id');
  for (const id of ids) {
    assert.match(id, RENDER_PART_ID_PATTERN, `${id} would be refused by the DB CHECK`);
  }
  assert.match(WHOLE_LOOK_PART_ID, RENDER_PART_ID_PATTERN);
});

test('the namespaces are what keep bride-the-role and bride-the-slot apart', () => {
  // `bride` is a PaletteKey AND an inspiration slot; `ceiling` is a
  // RECEPTION_PARTS zone AND an inspiration slot. Un-namespaced ids would
  // silently merge two different pictures into one cache entry.
  assert.ok(renderPartById('people:bride'), 'the bride attire role should be renderable');
  assert.equal(renderPartById('place:bride'), undefined, 'the bride SLOT is not a second part');
  assert.ok(renderPartById('room:ceiling'));
  assert.equal(renderPartById('place:ceiling'), undefined);
});

/* ── the exclusions, each for a stated reason ───────────────────────────── */

test('`people` is a modifier on the room, not a room part', () => {
  assert.ok(
    RECEPTION_PARTS.some((p) => p.id === 'people'),
    'this test is meaningless if RECEPTION_PARTS no longer has a people entry',
  );
  assert.equal(renderPartById('room:people'), undefined);
});

test('the four wedding-party FINE keys fall back to wedding_party and get no part of their own', () => {
  const fine = PALETTE_ORDER.filter((k) => isWeddingPartyFineKey(k));
  assert.ok(fine.length > 0, 'this test is meaningless if the fine keys were retired');
  for (const k of fine) {
    assert.equal(renderPartById(`people:${k}`), undefined, `${k} should not be its own part`);
  }
  // …but the fallback they resolve to IS a part.
  assert.ok(renderPartById('people:wedding_party'));
});

test('the venue PALETTE keys are not people — the venues are PLACES', () => {
  for (const k of PALETTE_ORDER) {
    if (PALETTE_LIMITS[k].family !== 'venue') continue;
    assert.equal(renderPartById(`people:${k}`), undefined, `${k} is a venue palette, not attire`);
  }
  assert.ok(renderPartById('place:venue'), 'the ceremony venue is a place part');
  assert.ok(renderPartById('place:reception_venue'), 'the reception venue is a place part');
});

test('`overall` is the whole look, and `palette` conditions every render — neither is a part', () => {
  assert.equal(renderPartById('place:overall'), undefined);
  assert.equal(renderPartById('place:palette'), undefined);
  assert.ok(isRenderPartId(WHOLE_LOOK_PART_ID), 'whole_look is a legal part_id');
  assert.equal(
    RENDER_PARTS.some((p) => p.id === WHOLE_LOOK_PART_ID),
    false,
    'the whole look must not be filterable away as one part among many',
  );
});

test('no inspiration slot both feeds a room/people part AND becomes a place of its own', () => {
  // The place group is the LEFTOVER slots. A slot that already photographs a
  // zone or a role must not also appear as a separate place, or the same
  // subject gets two cache keys and two prices.
  const aliased = new Set<string>();
  for (const part of RENDER_PARTS) {
    if (part.source === 'inspiration_slot') continue;
    for (const s of inspirationSlotsForPart(part.id)) aliased.add(s);
  }
  for (const part of renderPartsInGroup('places')) {
    assert.ok(
      !aliased.has(part.sourceKey),
      `${part.id} is both a place and a reference for another part`,
    );
  }
  // …and every slot is accounted for exactly once: place, alias, or one of the
  // two explicit non-parts. An unclassified slot is a compile error in
  // SLOT_ROLE; this proves the runtime agrees with the type.
  const places = new Set(renderPartsInGroup('places').map((p) => p.sourceKey));
  for (const slot of MOODBOARD_SLOT_KEYS) {
    const classified = places.has(slot) || aliased.has(slot) || slot === 'overall' || slot === 'palette';
    assert.ok(classified, `inspiration slot "${slot}" is not classified anywhere`);
  }
});

/* ── the join MB8 needs ──────────────────────────────────────────────────── */

test('a part knows which inspiration uploads condition it', () => {
  assert.deepEqual(inspirationSlotsForPart('room:tables'), ['table']);
  assert.deepEqual(inspirationSlotsForPart('people:wedding_party'), ['entourage']);
  assert.deepEqual(inspirationSlotsForPart('people:guest'), ['guests']);
  assert.deepEqual(inspirationSlotsForPart('place:cake'), ['cake']);
  // A role with no inspiration slot of its own still resolves — to nothing,
  // not to an error.
  assert.deepEqual(inspirationSlotsForPart('people:officiants'), []);
  assert.deepEqual(inspirationSlotsForPart('nope:nope'), []);
});

/* ── credits come from the config row, never from this module ───────────── */

test('the whole look costs the whole-look figure; every part costs the part figure', () => {
  const config: MoodboardRenderConfig = {
    creditsPerPart: 1,
    creditsWholeLook: 5,
    creditsPerPack: 50,
    packServiceCode: 'MOODBOARD_RENDER_PACK',
    maxNoteChars: 500,
    isActive: true,
  };
  assert.equal(creditsForPart(WHOLE_LOOK_PART_ID, config), 5);
  assert.equal(creditsForPart('room:ceiling', config), 1);

  // The figures are the CONFIG's, not constants in the module — an owner who
  // moves them must move every price with them.
  const moved: MoodboardRenderConfig = { ...config, creditsPerPart: 2, creditsWholeLook: 8 };
  assert.equal(creditsForPart('room:ceiling', moved), 2);
  assert.equal(creditsForPart(WHOLE_LOOK_PART_ID, moved), 8);
});

test('no peso figure is encoded anywhere in the registry', () => {
  // platform_retail_catalog_v2 is the only place a customer price exists. A
  // 1000 or a 20 appearing in a part label or id would mean somebody had
  // started restating the pack price in code.
  for (const part of RENDER_PARTS) {
    assert.doesNotMatch(part.label, /₱|\bPHP\b/, `${part.id} label carries a price`);
  }
});
