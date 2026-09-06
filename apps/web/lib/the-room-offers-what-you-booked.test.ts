/**
 * the-room-offers-what-you-booked.test.ts — RV2's NEGATIVE invariant.
 *
 * Owner ruling 2026-09-06 (Q9): when a couple has booked a supplier whose trade
 * reaches a reception zone, that zone SUGGESTS the treatment and one click makes
 * it theirs. Their `reception_design` is never written without that click. The
 * owner's reason, in their own framing: a room that changes without them
 * touching it is a room they cannot trust.
 *
 * ── WHAT THIS FILE IS FOR, AND WHY THE ASSERTIONS LOOK BACKWARDS ───────────
 * Almost everything here asserts that NOTHING HAPPENED. That is the feature.
 * The failure this guards against does not throw, does not log and does not
 * look wrong on screen: the couple's room simply contains selections they never
 * made, indistinguishable from ones they did, because `sel()` falls back to
 * `DEFAULT_DESIGN` and a written suggestion reads exactly like a choice. They
 * would delete one and find it back on the next load.
 *
 * So the assertions are byte-identity on `JSON.stringify` of the whole stored
 * document, not "the zone is still none". A test that checked one zone would
 * pass while a suggestion wrote a different one.
 *
 * ⚠ AND BYTE-IDENTITY IS ASSERTED ON A ROOM THAT HAS REAL CONTENT, not on `{}`.
 * An empty design is the one input for which almost any bug is invisible —
 * every wrong write to it still leaves something that looks like a fresh room.
 * The fixture below is a couple who have already dressed four zones.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  bookedZoneCandidates,
  renderPartIdForZone,
  zonesThatSuggest,
  assertOptionTilesBelongToTheirZone,
} from '@/lib/reception-booked-suggestions';
import {
  suggestionsToShow,
  dismissKeyFor,
  sanitizeDismissedSuggestions,
  type BookedZoneCandidate,
} from '@/lib/reception-suggestion-chips';
import {
  RECEPTION_PARTS,
  sanitizeReceptionDesign,
  selAll,
  type PartId,
  type ReceptionDesign,
} from '@/lib/reception-scene';
import {
  eligibleSuppliersForPart,
  supplierCanAnswerPart,
  type BookedSupplier,
} from '@/lib/moodboard-finalization';
import { MOODBOARD_PART_TRADES } from '@/lib/moodboard-slots';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');

/* ── the fixtures ──────────────────────────────────────────────────────────
   Real canonical service keys from lib/taxonomy.ts, not invented ones: a made-up
   service matches nothing, so every test built on one passes vacuously. */

const LIVE_BAND: BookedSupplier = {
  vendorId: 'vendor-band',
  name: 'The Manila Sessions',
  services: ['live_band'],
};
/** A photographer. The brief's own named negative: their trade reaches NO
 *  reception zone, so they must produce no chip anywhere. */
const PHOTOGRAPHER: BookedSupplier = {
  vendorId: 'vendor-photo',
  name: 'Ilaya Studios',
  services: ['photographer', 'photo_video_package'],
};
/** A coordinator — the brief's other named negative. */
const COORDINATOR: BookedSupplier = {
  vendorId: 'vendor-coord',
  name: 'Kasal Co.',
  services: ['coordinator'],
};
const CATERER: BookedSupplier = {
  vendorId: 'vendor-cater',
  name: 'Hapag Catering',
  services: ['catering'],
};

/** A couple who have already dressed their room — NOT an empty design. */
const DRESSED_ROOM: ReceptionDesign = Object.freeze({
  ceiling: { treatment: 'draped' },
  backdrop: { style: 'floral_wall', florals: ['corner', 'full'] },
  tables: { shape: 'long', chairs: 'ghost', linen: 'sequin', centerpiece: 'low', place: 'silver' },
  people: { who: 'couple_party' },
}) as ReceptionDesign;

const NO_FROZEN: ReadonlySet<string> = new Set<string>();
function tilesByZone(design: ReceptionDesign): Map<PartId, ReadonlySet<string>> {
  const out = new Map<PartId, ReadonlySet<string>>();
  for (const part of RECEPTION_PARTS) {
    const tiles = new Set<string>();
    for (const attr of part.attributes) {
      for (const id of selAll(design, part.id, attr.id)) {
        const tile = attr.options.find((o) => o.id === id)?.tile;
        if (tile) tiles.add(tile);
      }
    }
    out.set(part.id, tiles);
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   1 · THE NEGATIVE — THE SAVED ROOM DOES NOT MOVE
   ══════════════════════════════════════════════════════════════════════════ */

test('rendering the chips leaves the saved room byte-identical', () => {
  const before = JSON.stringify(DRESSED_ROOM);
  const candidates = bookedZoneCandidates([LIVE_BAND, CATERER], 'banquet_hall');
  assert.ok(candidates.length > 0, 'fixture must actually produce offers, or this proves nothing');

  const shown = suggestionsToShow(candidates, {
    dismissedKeys: [],
    frozenZones: NO_FROZEN,
    selectedTilesByZone: tilesByZone(DRESSED_ROOM),
  });
  assert.ok(shown.length > 0, 'fixture must actually SHOW offers, or this proves nothing');

  assert.equal(JSON.stringify(DRESSED_ROOM), before, 'deriving the chips mutated the design');
  // And the design that would be SAVED from it is byte-identical too — the
  // sanitizer is the boundary every writer passes through, so a suggestion that
  // leaked in anywhere upstream would show up here.
  assert.equal(JSON.stringify(sanitizeReceptionDesign(DRESSED_ROOM)), before);
});

test('an untouched room stays untouched — no zone gains a key from a booking', () => {
  const EMPTY: ReceptionDesign = {};
  const candidates = bookedZoneCandidates([LIVE_BAND, CATERER], 'banquet_hall');
  suggestionsToShow(candidates, {
    dismissedKeys: [],
    frozenZones: NO_FROZEN,
    selectedTilesByZone: tilesByZone(EMPTY),
  });
  assert.equal(JSON.stringify(EMPTY), '{}');
  // The zones the chips are about are still absent, so `sel()` still answers
  // `none` — the RV1 default the whole ruling turns on.
  for (const zone of zonesThatSuggest()) {
    assert.equal(EMPTY[zone], undefined, `${zone} gained a key nobody clicked`);
  }
});

test('dismissing changes ONLY the dismissed list — structurally, not by care', () => {
  // The strongest form of this assertion is not a diff; it is that the dismissal
  // writer CANNOT reach the design. `dismissRoomSuggestion` takes an event id
  // and a string, writes one column, and never mentions reception_design.
  // Stripped: the function's own comments NAME `saveReceptionDesign` while
  // explaining that it must not call it. A raw scan accuses the sentence that
  // states the rule — the same trap the editor guard below carries.
  const actions = stripComments(
    readFileSync(join(REPO, 'app/dashboard/[eventId]/seating/actions.ts'), 'utf8'),
  );
  const fn = actions.slice(
    actions.indexOf('export async function dismissRoomSuggestion'),
  );
  // to the next top-level declaration — `\n}\n` also closes inner blocks
  const body = fn.slice(0, fn.indexOf('\nexport ', 1));
  assert.ok(body.length > 100, 'could not isolate dismissRoomSuggestion');
  assert.match(body, /dismissed_room_suggestions/);
  assert.doesNotMatch(
    body,
    /reception_design|saveReceptionDesign|sanitizeReceptionDesign/,
    'dismissing must not be able to touch the design at all',
  );
  // It also must not stamp the board as changed — waving away an offer is not
  // an edit, and saying it was is the same false claim in miniature.
  assert.doesNotMatch(body, /mood_board_updated_at/);

  // And the pure half is a filter: dismissing removes a chip, nothing else.
  const candidates = bookedZoneCandidates([LIVE_BAND], 'banquet_hall');
  const one = candidates[0]!;
  const after = suggestionsToShow(candidates, {
    dismissedKeys: [one.dismissKey],
    frozenZones: NO_FROZEN,
    selectedTilesByZone: tilesByZone(DRESSED_ROOM),
  });
  assert.ok(!after.some((c) => c.dismissKey === one.dismissKey));
  assert.equal(JSON.stringify(DRESSED_ROOM), JSON.stringify(DRESSED_ROOM));
});

test('the suggestion modules cannot produce a design — they never import one', () => {
  for (const f of ['lib/reception-booked-suggestions.ts', 'lib/reception-suggestion-chips.ts']) {
    const src = readFileSync(join(REPO, f), 'utf8');
    const imports = src
      .split('\n')
      .filter((l) => /^import /.test(l) || /^\s+(DEFAULT_DESIGN|sanitizeReceptionDesign)[,;]/.test(l))
      .join('\n');
    // A VALUE import of the design shape or its defaults is the edge that would
    // let a later edit "just apply it". A type-only import is inert.
    assert.doesNotMatch(imports, /\bDEFAULT_DESIGN\b/, `${f} imports DEFAULT_DESIGN`);
    assert.doesNotMatch(imports, /\bsanitizeReceptionDesign\b/, `${f} imports the design writer`);
    assert.doesNotMatch(
      imports,
      /^import \{[^}]*\bReceptionDesign\b(?![^}]*\btype ReceptionDesign\b)/m,
      `${f} value-imports ReceptionDesign`,
    );
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   2 · THE CLICK WRITES EXACTLY ONE ZONE
   ══════════════════════════════════════════════════════════════════════════ */

/** The editor's own `commit` shape, reproduced here so the assertion is about
 *  the WRITE, not about React. `the editor routes accept through choose()` below
 *  is what ties this to the real component. */
function applyLikeTheEditor(
  design: ReceptionDesign,
  zone: PartId,
  attr: string,
  optionId: string,
): ReceptionDesign {
  const part = RECEPTION_PARTS.find((p) => p.id === zone)!;
  const attrDef = part.attributes.find((a) => a.id === attr)!;
  const current = selAll(design, zone, attr);
  const isExclusive = (id: string) => attrDef.options.find((o) => o.id === id)?.exclusive === true;
  const value = attrDef.multi
    ? (() => {
        const kept = current.filter((id) => !isExclusive(id));
        const next = [...kept, optionId];
        return next.length === 1 ? next[0]! : next;
      })()
    : optionId;
  const cur = (design[zone] ?? {}) as Record<string, unknown>;
  return { ...design, [zone]: { ...cur, [attr]: value } } as ReceptionDesign;
}

test('accepting one offer writes exactly one zone; every other key is byte-identical', () => {
  const candidates = bookedZoneCandidates([LIVE_BAND], 'banquet_hall');
  const sg = candidates.find((c) => c.zone === 'program');
  assert.ok(sg, 'a live band must reach the program zone');
  assert.equal(sg.optionId, 'live_band');

  const after = applyLikeTheEditor(DRESSED_ROOM, sg.zone, sg.attr, sg.optionId);

  // exactly one key differs, and it is the zone the chip named
  const changed = Object.keys({ ...DRESSED_ROOM, ...after }).filter(
    (k) =>
      JSON.stringify((DRESSED_ROOM as Record<string, unknown>)[k]) !==
      JSON.stringify((after as Record<string, unknown>)[k]),
  );
  assert.deepEqual(changed, ['program'], `the click changed ${changed.join(', ')}`);

  // and every untouched key is byte-identical, not merely "equal-looking"
  for (const k of Object.keys(DRESSED_ROOM)) {
    assert.equal(
      JSON.stringify((after as Record<string, unknown>)[k]),
      JSON.stringify((DRESSED_ROOM as Record<string, unknown>)[k]),
      `${k} changed and should not have`,
    );
  }
  // the option really landed, so this is not passing on a no-op
  assert.deepEqual(selAll(after, 'program', 'performers'), ['live_band']);
  // and it survives the trust boundary unchanged — per key, because the
  // sanitizer emits in RECEPTION_PARTS order and a whole-string compare would
  // be asserting key ORDER rather than content.
  const clean = sanitizeReceptionDesign(after) as Record<string, unknown>;
  assert.deepEqual(
    Object.keys(clean).sort(),
    Object.keys(after).sort(),
    'the trust boundary dropped or added a zone',
  );
  for (const k of Object.keys(after)) {
    assert.equal(
      JSON.stringify(clean[k]),
      JSON.stringify((after as Record<string, unknown>)[k]),
      `${k} did not survive sanitizeReceptionDesign unchanged`,
    );
  }
});

test('the editor routes accept through choose(), so it adds no second writer', () => {
  const src = stripComments(
    readFileSync(
      join(REPO, 'app/dashboard/[eventId]/seating/lab/_components/reception-design-editor.tsx'),
      'utf8',
    ),
  );
  const fn = src.slice(src.indexOf('function acceptSuggestion'));
  const body = fn.slice(0, fn.indexOf('\n  }\n') + 5);
  assert.ok(body.length > 50, 'could not isolate acceptSuggestion');
  assert.match(body, /choose\(sg\.zone, attrDef, sg\.optionId\)/);
  // It must not build a design or call the writer itself: `choose` already
  // refuses a finalized zone, an over-cap selection and an exclusive collision,
  // and a parallel path would inherit none of that.
  assert.doesNotMatch(body, /saveReceptionDesign|commit\(|onChange\(/);
  // ONE call, so it cannot write a second zone in the same handler.
  assert.equal((body.match(/choose\(/g) ?? []).length, 1);
});

/* ══════════════════════════════════════════════════════════════════════════
   3 · WHO GETS NO CHIP AT ALL
   ══════════════════════════════════════════════════════════════════════════ */

test('a photographer reaches no reception zone, so renders no chip', () => {
  // First the premise, so this cannot pass because the fixture is inert: the
  // shared bridge must genuinely say a photographer answers no zone.
  for (const zone of zonesThatSuggest()) {
    assert.equal(
      supplierCanAnswerPart(renderPartIdForZone(zone), PHOTOGRAPHER),
      false,
      `a photographer should not answer ${zone}`,
    );
  }
  assert.deepEqual(bookedZoneCandidates([PHOTOGRAPHER], 'banquet_hall'), []);
});

test('a coordinator renders no chip either', () => {
  assert.deepEqual(bookedZoneCandidates([COORDINATOR], 'banquet_hall'), []);
});

test('a booking with no marketplace shop behind it renders no chip', () => {
  // `BookedSupplier.services` is empty when the couple booked their own
  // supplier. Empty must mean silence, not "matches everything".
  const OWN: BookedSupplier = { vendorId: 'v-own', name: "Tita's lechon", services: [] };
  assert.deepEqual(bookedZoneCandidates([OWN], 'banquet_hall'), []);
});

test('a frozen zone renders no chip', () => {
  const candidates = bookedZoneCandidates([LIVE_BAND], 'banquet_hall');
  assert.ok(candidates.some((c) => c.zone === 'program'));
  const shown = suggestionsToShow(candidates, {
    dismissedKeys: [],
    frozenZones: new Set(['program']),
    selectedTilesByZone: tilesByZone(DRESSED_ROOM),
  });
  assert.ok(
    !shown.some((c) => c.zone === 'program'),
    'a zone a supplier agreed to build must not be re-offered',
  );
});

test('a zone that already reflects the shop’s trade renders no chip', () => {
  // A caterer matches buffet / plated / family_style. The couple chose PLATED —
  // not the suggested option, which is `buffet` (first, most characteristic).
  // The offer must still be suppressed: they have answered their caterer.
  const withPlated: ReceptionDesign = { ...DRESSED_ROOM, feast: { service: 'plated' } };
  const candidates = bookedZoneCandidates([CATERER], 'banquet_hall');
  const feast = candidates.find((c) => c.zone === 'feast');
  assert.ok(feast);
  assert.equal(feast.optionId, 'buffet', 'the suggested option is the first, not the chosen one');

  const shown = suggestionsToShow(candidates, {
    dismissedKeys: [],
    frozenZones: NO_FROZEN,
    selectedTilesByZone: tilesByZone(withPlated),
  });
  assert.ok(
    !shown.some((c) => c.zone === 'feast'),
    'a couple who chose Plated has answered their caterer; offering Buffet nags them to undo it',
  );
  // ...and with the zone still untouched, the chip IS there.
  assert.ok(
    suggestionsToShow(candidates, {
      dismissedKeys: [],
      frozenZones: NO_FROZEN,
      selectedTilesByZone: tilesByZone(DRESSED_ROOM),
    }).some((c) => c.zone === 'feast'),
  );
});

test('a shop eligible for the zone with no option in its trade renders no chip', () => {
  // `MOODBOARD_PART_TRADES['room:program']` claims `av_production`, and no
  // program option IS an AV company. They genuinely reach the zone — they can
  // be asked to agree to it — and there is still nothing honest to name.
  const AV: BookedSupplier = {
    vendorId: 'v-av',
    name: 'Signal AV',
    services: ['av_production'],
  };
  assert.equal(
    eligibleSuppliersForPart('room:program', [AV]).length,
    1,
    'premise: an AV shop must be eligible for the program zone',
  );
  assert.deepEqual(bookedZoneCandidates([AV], 'banquet_hall'), []);
});

/* ══════════════════════════════════════════════════════════════════════════
   4 · THE TWO VOCABULARIES CANNOT DRIFT
   ══════════════════════════════════════════════════════════════════════════ */

test('every option trade is one its own zone already claims', () => {
  assert.doesNotThrow(assertOptionTilesBelongToTheirZone);
  for (const zone of zonesThatSuggest()) {
    const claimed = MOODBOARD_PART_TRADES[renderPartIdForZone(zone)] ?? [];
    const part = RECEPTION_PARTS.find((p) => p.id === zone)!;
    for (const attr of part.attributes) {
      for (const opt of attr.options) {
        if (!opt.tile) continue;
        assert.ok(
          (claimed as readonly string[]).includes(opt.tile),
          `${zone}.${attr.id}.${opt.id} names "${opt.tile}", which room:${zone} does not claim`,
        );
      }
    }
  }
});

test('a candidate is always a supplier the SHARED bridge agrees reaches the zone', () => {
  const booked = [LIVE_BAND, CATERER, PHOTOGRAPHER, COORDINATOR];
  for (const c of bookedZoneCandidates(booked, 'banquet_hall')) {
    const supplier = booked.find((b) => b.vendorId === c.vendorId)!;
    assert.equal(
      supplierCanAnswerPart(renderPartIdForZone(c.zone), supplier),
      true,
      `${c.vendorName} was offered ${c.zone} but the shared bridge says they do not reach it`,
    );
  }
});

test('the suggested option is the vocabulary’s first match, not an alphabetical one', () => {
  // The vocabularies are written "most characteristic first" and that editorial
  // order is the entire basis of the pick. A sort would silently replace it with
  // an alphabet.
  //
  // 🪤 THE FIXTURE HAS TO BE ABLE TO TELL THE TWO APART, AND THE FIRST ONE HERE
  // COULD NOT. A plain caterer resolves to `buffet` under BOTH rules — `buffet`
  // is the vocabulary's first catering option AND alphabetically first among
  // {buffet, family_style, plated} — so inserting a `.sort()` into the picker
  // left this test green. That is the same "cheaper proxy that cannot see the
  // sabotage" this repo has now paid for five times.
  //
  // A band that also DJs separates them: `live_band` is first in the program
  // vocabulary, `dj` is first alphabetically.
  const BAND_AND_DJ: BookedSupplier = {
    vendorId: 'v-both',
    name: 'Two Left Feet',
    services: ['live_band', 'dj'],
  };
  const program = RECEPTION_PARTS.find((p) => p.id === 'program')!;
  const performers = program.attributes.find((a) => a.id === 'performers')!;
  const ids = performers.options.filter((o) => o.tile).map((o) => o.id);
  assert.ok(
    ids.indexOf('live_band') < ids.indexOf('dj'),
    'premise: the vocabulary puts the band before the DJ',
  );
  assert.ok(
    'dj'.localeCompare('live_band') < 0,
    'premise: the alphabet puts the DJ before the band — the two rules disagree',
  );
  const c = bookedZoneCandidates([BAND_AND_DJ], 'banquet_hall').find((x) => x.zone === 'program')!;
  assert.equal(c.optionId, 'live_band', 'the pick followed the alphabet, not the vocabulary');
  // both trades are still reported, so the "already answered" test stays honest
  assert.deepEqual([...c.matchedTiles].sort(), ['dj', 'live_band']);

  // and the plain caterer still resolves to the first catering option
  const cater = bookedZoneCandidates([CATERER], 'banquet_hall').find((x) => x.zone === 'feast')!;
  assert.equal(cater.optionId, 'buffet');
});

test('a zone the venue lacks offers nothing', () => {
  // Through the SAME `venueZoneApplies` predicate the rail and hotspots use.
  // (No celebration zone is venue-gated today; the assertion is that the gate
  // is CONSULTED, so a future gating cannot silently bypass the chips.)
  const src = readFileSync(join(REPO, 'lib/reception-booked-suggestions.ts'), 'utf8');
  assert.match(src, /venueZoneApplies\(venueSetting, zone\)/);
});

/* ══════════════════════════════════════════════════════════════════════════
   5 · THE DISMISSAL LIST
   ══════════════════════════════════════════════════════════════════════════ */

test('a dismissal is keyed on the BOOKING, so a new booking gets a fresh chip', () => {
  const first: BookedSupplier = { ...LIVE_BAND, vendorId: 'booking-1' };
  const second: BookedSupplier = { ...LIVE_BAND, vendorId: 'booking-2', name: 'Another Band' };
  const dismissed = [dismissKeyFor('booking-1', 'program')];

  const shown = suggestionsToShow(bookedZoneCandidates([first, second], 'banquet_hall'), {
    dismissedKeys: dismissed,
    frozenZones: NO_FROZEN,
    selectedTilesByZone: tilesByZone(DRESSED_ROOM),
  });
  assert.deepEqual(
    shown.filter((c) => c.zone === 'program').map((c) => c.vendorId),
    ['booking-2'],
    'the dismissed booking must stay dismissed and the new one must be offered',
  );
});

test('the stored dismissal list is read through a total boundary', () => {
  assert.deepEqual(sanitizeDismissedSuggestions(null), []);
  assert.deepEqual(sanitizeDismissedSuggestions('nope'), []);
  assert.deepEqual(sanitizeDismissedSuggestions({ a: 1 }), []);
  assert.deepEqual(sanitizeDismissedSuggestions([1, null, 'a:b', 'a:b']), ['a:b']);
  assert.deepEqual(sanitizeDismissedSuggestions(['x'.repeat(500)]), []);
  // An unrecognised key is KEPT — it is inert, and dropping it would resurrect
  // the chip if that booking ever came back.
  assert.deepEqual(sanitizeDismissedSuggestions(['ghost:program']), ['ghost:program']);
});

/* ══════════════════════════════════════════════════════════════════════════
   6 · THE WIRE IS REALLY CONNECTED
   ══════════════════════════════════════════════════════════════════════════
   A correct module and a correct component both pass their own tests while the
   line between them is cut — the exact failure `a-finalized-part-never-re-derives`
   exists for. Three seams live in TypeScript, and each renders as SUCCESS:
   the page never resolves candidates; it resolves them and never passes them;
   the editor takes the prop and never draws it. */

test('the lab page loads bookings the way the finalization panel does', () => {
  const page = readFileSync(join(REPO, 'app/dashboard/[eventId]/seating/lab/page.tsx'), 'utf8');
  const panel = readFileSync(
    join(REPO, 'app/dashboard/[eventId]/studio/mood-board/page.tsx'),
    'utf8',
  );
  const SELECT = "'vendor_id, vendor_name, shop:vendor_profiles ( services )'";
  assert.ok(panel.includes(SELECT), 'premise: the finalization panel selects this shape');
  assert.ok(page.includes(SELECT), 'the lab must read bookings with the SAME select');
  // Same status filter, or the two surfaces disagree the first time a status is
  // added — invisibly, as a shorter list.
  assert.match(page, /\.in\('status', CONFIRMED_VENDOR_STATUSES as unknown as string\[\]\)/);
  assert.match(panel, /\.in\('status', CONFIRMED_VENDOR_STATUSES as unknown as string\[\]\)/);
  // and it must actually resolve + pass the candidates
  assert.match(page, /bookedZoneCandidates\(bookedSuppliers, venueSetting\)/);
  assert.match(page, /dismissedSuggestions=\{dismissedSuggestions\}/);
  assert.match(page, /dismissed_room_suggestions/);
});

test('the editor draws the chip and suppresses it through the shared filter', () => {
  // 🔑 STRIPPED, THROUGH THE REPO'S ONE STRING-AWARE STRIPPER. This file's own
  // docblock argues AGAINST the words banned below ("no 'we picked this for
  // you'"), so a raw scan accuses the very comment that states the rule — and a
  // hand-rolled regex stripper silently blanks real code (see strip-comments.ts).
  const src = stripComments(
    readFileSync(
      join(REPO, 'app/dashboard/[eventId]/seating/lab/_components/reception-design-editor.tsx'),
      'utf8',
    ),
  );
  assert.match(src, /suggestionsToShow\(bookedSuggestions \?\? \[\]/);
  // the frozen set really is passed, or a frozen zone would still offer
  assert.match(src, /frozenZones: new Set\(Object\.keys\(finalizedByPart \?\? \{\}\)\)/);
  // the copy names the shop and the option, and claims nothing
  assert.match(src, /You&rsquo;ve booked <span[^>]*>\{sg\.vendorName\}<\/span>/);
  assert.match(src, /\{sg\.optionLabel\}/);
  assert.doesNotMatch(src, /recommended|Recommended|we picked|chosen for you/);
  // it imports the CLIENT-SAFE half only: the server module reaches next/headers
  // and would fail the production build, which nothing before it can see.
  assert.doesNotMatch(src, /from ['"][^'"]*reception-booked-suggestions['"]/);
});

test('no client component imports the server-only suggestion module', () => {
  // The MB12 failure verbatim: a `'use client'` file that imports a VALUE from a
  // module reaching `next/headers` fails the PRODUCTION BUILD and nothing else —
  // `tsc` is not a bundler and `tsx --test` resolves it happily in node.
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name)) {
        const src = readFileSync(full, 'utf8');
        if (!/^['"]use client['"]/m.test(src)) continue;
        if (/from ['"][^'"]*reception-booked-suggestions['"]/.test(src)) out.push(full);
      }
    }
  };
  walk(join(REPO, 'app'));
  walk(join(REPO, 'components'));
  assert.deepEqual(out, [], `client components importing the server-only module: ${out.join(', ')}`);
});
