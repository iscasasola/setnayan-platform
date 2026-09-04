/**
 * colour-access.test.ts — the lane, and the line it cannot cross.
 *
 * These assertions are about the DISPLAY half. The gate is
 * `public.apply_colour_change`, and `tests/db/the-colour-lane-is-one-map.db.test.ts`
 * is what proves this module and that function agree. What is checked here is
 * the shape of the answer a screen gives: which switch exists, which sentence
 * is printed, and which swatches are offered.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ATTIRE_PALETTE_KEYS,
  COLOUR_DOMAINS,
  COLOUR_DOMAIN_BLURB,
  COLOUR_DOMAIN_LABEL,
  DECOR_DRESSING_FIELDS,
  describeColourChange,
  domainCovers,
  editableSwatches,
  isColourDomain,
  laneForVendorCategory,
  laneIsWide,
  scopeLine,
  targetsForDomains,
  type ColourDomain,
} from './colour-access';
import { PALETTE_LIMITS, PALETTE_ORDER, type PaletteKey, type RolePalette } from './mood-board';

/* ── 1 · the lane ─────────────────────────────────────────────────────────── */

test('the stylist is the ONE wide lane, and it is the only one that reaches the majors', () => {
  const wide = ['reception_decor', 'florist', 'gown_designer', 'suit_designer', 'catering',
    'photographer', 'planner_coordinator', 'mobile_bar', 'band_dj']
    .filter((c) => laneIsWide(laneForVendorCategory(c)));
  assert.deepEqual(
    wide,
    ['reception_decor'],
    'a change to the five majors ripples into the palette, the 3D room and every surface that reads them — exactly one trade may make it',
  );
});

test('a florist gets florals and NOTHING else', () => {
  assert.deepEqual(laneForVendorCategory('florist'), ['florals']);
  assert.equal(domainCovers('florals', 'palette', 'reception'), false);
  assert.equal(domainCovers('florals', 'room_dressing', 'linens'), false);
});

test('an attire maker gets attire, whichever half of the couple they dress', () => {
  assert.deepEqual(laneForVendorCategory('gown_designer'), ['attire']);
  assert.deepEqual(laneForVendorCategory('suit_designer'), ['attire']);
});

test('a booked coordinator has NO lane on the booking — theirs is per-person', () => {
  // 🔑 EMPTY IS AN ANSWER, NOT A GAP. A coordinator holds several independent
  // domains at once; a single per-booking switch cannot express that, so the
  // vendor card points at the hosts page instead of offering one.
  assert.deepEqual(laneForVendorCategory('planner_coordinator'), []);
});

test('every other trade has no colour lane at all', () => {
  for (const c of ['catering', 'photographer', 'videographer', 'band_dj', 'mobile_bar',
    'transportation', 'security', 'accommodation', 'rings', 'church_fees']) {
    assert.deepEqual(laneForVendorCategory(c), [], `${c} gained a colour lane`);
  }
  assert.deepEqual(laneForVendorCategory(null), []);
  assert.deepEqual(laneForVendorCategory('not_a_category'), []);
});

/* ── 2 · what a domain reaches ────────────────────────────────────────────── */

test('the ceremony palette belongs to NO domain — only the couple ever changes it', () => {
  // Listing it under `decor` to be tidy would hand a stylist the church.
  for (const d of COLOUR_DOMAINS) {
    assert.equal(domainCovers(d, 'palette', 'ceremony'), false, `${d} reaches the ceremony palette`);
  }
});

test('every palette key is reachable by AT MOST one domain — no key answers twice', () => {
  for (const key of PALETTE_ORDER) {
    const hits = COLOUR_DOMAINS.filter((d) => domainCovers(d, 'palette', key));
    assert.ok(hits.length <= 1, `${key} is inside ${hits.length} domains: ${hits.join(', ')}`);
  }
});

test('every room-dressing field is reachable by EXACTLY one domain — none is orphaned', () => {
  for (const field of ['linens', 'chairs', 'florals', 'lighting_warmth']) {
    const hits = COLOUR_DOMAINS.filter((d) => domainCovers(d, 'room_dressing', field));
    assert.equal(hits.length, 1, `${field} is inside ${hits.length} domains: ${hits.join(', ')}`);
  }
});

test('ATTIRE_PALETTE_KEYS is DERIVED from the family, never listed', () => {
  assert.deepEqual(
    [...ATTIRE_PALETTE_KEYS],
    PALETTE_ORDER.filter((k) => PALETTE_LIMITS[k].family !== 'venue'),
  );
  // Floor: an empty derivation would make `attire` reach nothing and read as a
  // grant that silently permits no write.
  assert.ok(ATTIRE_PALETTE_KEYS.length >= 10);
});

test('DECOR_DRESSING_FIELDS is the dressing minus the floral one, so the two never overlap', () => {
  assert.ok(!DECOR_DRESSING_FIELDS.includes('florals'));
  assert.deepEqual([...DECOR_DRESSING_FIELDS].sort(), ['chairs', 'lighting_warmth', 'linens']);
});

/* ── 3 · the copy ─────────────────────────────────────────────────────────── */

test('every domain has a label and a blurb, and no blurb is the raw key', () => {
  for (const d of COLOUR_DOMAINS) {
    assert.ok(COLOUR_DOMAIN_LABEL[d]?.trim().length, `${d} has no label`);
    assert.ok(COLOUR_DOMAIN_BLURB[d]?.trim().length, `${d} has no blurb`);
    assert.ok(!COLOUR_DOMAIN_BLURB[d].includes('_'), `${d}'s blurb is the raw key`);
  }
});

test('the decor blurb does NOT promise the walls — there is no per-zone colour to change', () => {
  // 🔴 THE PROTOTYPE SAID "Walls, ceiling, tables, ambient zones." A wall, a
  // backdrop and a welcome sign are all drawn from palette.reception directly,
  // so "change the backdrop's colour" is not a thing the schema can express
  // for anybody. Promising it and delivering the linens is the exact shape of
  // failure this session exists to stop.
  const blurb = COLOUR_DOMAIN_BLURB.decor.toLowerCase();
  assert.ok(!blurb.includes('wall'), 'the decor blurb promises walls it cannot deliver');
  assert.ok(!blurb.includes('ceiling'), 'the decor blurb promises the ceiling it cannot deliver');
  assert.ok(blurb.includes('linen'), 'the decor blurb should name what it CAN change');
});

test('the scope sentence names the wide lane as wide, in the couple’s own words', () => {
  const wide = scopeLine(laneForVendorCategory('reception_decor'));
  assert.ok(wide.includes('5 main wedding colours'), wide);
  assert.ok(wide.includes('whole look'), wide);
  const narrow = scopeLine(laneForVendorCategory('florist'));
  assert.ok(!narrow.includes('main'), narrow);
  assert.equal(scopeLine([]), '', 'no lane, no sentence');
});

/* ── 4 · the swatches a holder is offered ─────────────────────────────────── */

const MAJORS = ['#8C3B2E', '#C9A227', '#2F4858', '#EDE6DA', '#6B8F71'];

test('a palette role expands to the slots it ALREADY has, and no further', () => {
  const palette: RolePalette = { reception: MAJORS, bride: ['#FFFFFF'] };
  const s = editableSwatches(['main_colours'], palette);
  assert.equal(s.length, 5, 'the five majors, one swatch each');
  assert.deepEqual(s.map((x) => x.index), [0, 1, 2, 3, 4]);
  assert.deepEqual(s.map((x) => x.current), MAJORS);
});

test('a role with no colours contributes NOTHING — adding a slot is the couple’s act', () => {
  // `apply_colour_change` refuses an index that holds no colour, so offering
  // one here would be a control that always fails.
  const s = editableSwatches(['attire'], { reception: MAJORS } as RolePalette);
  assert.deepEqual(s, [], 'an empty role must not be offered as an editable swatch');
});

test('a dressing field always appears, showing the colour it is actually painting', () => {
  const palette: RolePalette = { reception: MAJORS };
  const decor = editableSwatches(['decor'], palette);
  assert.equal(decor.length, DECOR_DRESSING_FIELDS.length);
  for (const s of decor) {
    assert.match(s.current, /^#[0-9A-Fa-f]{6}$/, `${s.key} showed no colour`);
    assert.equal(s.index, null);
  }
});

test('a florist is offered the floral field and nothing that belongs to decor', () => {
  const s = editableSwatches(['florals'], { reception: MAJORS } as RolePalette);
  assert.deepEqual(s.map((x) => x.key), ['florals']);
});

test('every offered swatch is inside a domain the holder was granted', () => {
  const palette: RolePalette = { reception: MAJORS, bride: ['#FFF8F0', '#E8D9C5'] };
  for (const lane of [['florals'], ['decor', 'main_colours'], ['attire']] as ColourDomain[][]) {
    for (const s of editableSwatches(lane, palette)) {
      assert.ok(
        lane.includes(s.domain) && domainCovers(s.domain, s.kind, s.key),
        `offered ${s.kind}:${s.key} under ${s.domain}, which does not cover it`,
      );
    }
  }
});

test('targetsForDomains is stable in domain order, so a checklist does not reshuffle', () => {
  const a = targetsForDomains(['attire', 'decor']).map((t) => `${t.domain}:${t.key}`);
  const b = targetsForDomains(['decor', 'attire']).map((t) => `${t.domain}:${t.key}`);
  assert.deepEqual(a, b);
});

/* ── 5 · the log line ─────────────────────────────────────────────────────── */

test('a major slot reads by its own name, not as an index', () => {
  const said = describeColourChange({
    target_kind: 'palette',
    target_key: 'reception',
    target_index: 1,
    old_value: '#C9A227',
    new_value: '#6E4B26',
  });
  // The five majors carry per-slot labels ("Dominant", "Supporting", …); a
  // couple must never be shown "reception[1]".
  assert.ok(!said.what.includes('['), said.what);
  assert.ok(said.what.toLowerCase().includes('reception'), said.what);
  assert.equal(said.from, '#C9A227');
  assert.equal(said.to, '#6E4B26');
});

test('a dressing field reads as a thing in the room, never as its column name', () => {
  const said = describeColourChange({
    target_kind: 'room_dressing',
    target_key: 'lighting_warmth',
    target_index: null,
    old_value: null,
    new_value: '#FFD9A0',
  });
  assert.ok(!said.what.includes('_'), said.what);
  assert.equal(said.from, null, 'a field with no override had genuinely nothing before');
});

test('isColourDomain refuses anything not in the union', () => {
  for (const d of COLOUR_DOMAINS) assert.ok(isColourDomain(d));
  for (const junk of ['', 'colours', 'MAIN_COLOURS', null, undefined, 3, {}]) {
    assert.equal(isColourDomain(junk), false, String(junk));
  }
});

test('a PaletteKey the domain map has never heard of is refused, not guessed', () => {
  assert.equal(domainCovers('attire', 'palette', 'ring_bearers_dog'), false);
  assert.equal(domainCovers('decor', 'room_dressing', 'confetti'), false);
});

test('an unknown palette key still produces a readable line rather than throwing', () => {
  const said = describeColourChange({
    target_kind: 'palette',
    target_key: 'ring_bearers_dog',
    target_index: 0,
    old_value: '#000000',
    new_value: '#FFFFFF',
  });
  assert.equal(said.what, 'ring_bearers_dog');
});

test('the attire keys really are PaletteKeys the limits table knows', () => {
  for (const k of ATTIRE_PALETTE_KEYS) {
    assert.ok(PALETTE_LIMITS[k as PaletteKey], `${k} is not a real palette key`);
  }
});
