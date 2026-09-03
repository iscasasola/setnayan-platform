/**
 * moodboard-make-it-real.ts — the derivation the "Make it real" tiles read.
 *
 * Two properties matter more than any single scenario:
 *
 *   1. THE PANEL DERIVES. `gridParts` must surface every RenderPart in
 *      `RENDER_PARTS` — the REAL, derived registry, not a fixture standing
 *      in for it — the moment it looks "designed". A hand-listed subset
 *      would pass every scenario test below and still hide a real zone;
 *      `no part in RENDER_PARTS is invisible to gridParts` is what would go
 *      red if this file's grid selection were quietly rewritten as a
 *      literal list. Sabotaged manually during MB7's build (swapped
 *      `eligibleParts` for a hand-typed six-item array) — confirmed red,
 *      reverted.
 *
 *   2. THE PANEL READS WHAT `buildPrompt()` READS. `designRevisionKey`
 *      closes over `receptionDesign`, `palette.reception` and the venue
 *      setting — the exact three inputs `buildPrompt` takes — so a change
 *      to any of them, and ONLY them, must flip the key.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  colorsForPart,
  colorsForWholeLook,
  designRevisionKey,
  gridParts,
  isPartDesigned,
  MIN_PART_TILES,
  renderGateForPart,
  renderGateForWholeLook,
  briefColorLine,
  briefZoneLines,
  briefWholeLookZoneLines,
  referencePhotoCount,
  buildTileViewModel,
  EMPTY_PART_STATE,
  type PartWorkState,
} from './moodboard-make-it-real';
import { RENDER_PARTS } from './moodboard-render-parts';
import { RECEPTION_PARTS, type ReceptionDesign } from './reception-scene';
import { type RolePalette } from './mood-board';

const LIB_DIR = dirname(fileURLToPath(import.meta.url));
const MAKE_IT_REAL_COMPONENT = join(
  LIB_DIR,
  '../app/dashboard/[eventId]/studio/mood-board/_components/make-it-real.tsx',
);

const EMPTY_CTX = {
  palette: {} as RolePalette,
  receptionDesign: {} as ReceptionDesign,
  inspirationPresence: new Set<string>(),
};

test('a bare board designs nothing', () => {
  for (const part of RENDER_PARTS) {
    assert.equal(isPartDesigned(part, EMPTY_CTX), false, `${part.id} should not be designed on an empty board`);
  }
});

test('a room zone is designed once ANY of its attributes holds a real selection', () => {
  const part = RENDER_PARTS.find((p) => p.id === 'room:ceiling')!;
  const ctx = {
    ...EMPTY_CTX,
    receptionDesign: { ceiling: { treatment: ['fairy_lights'] } } as ReceptionDesign,
  };
  assert.equal(isPartDesigned(part, ctx), true);
});

test('an attire role is designed once it holds a colour', () => {
  const part = RENDER_PARTS.find((p) => p.id === 'people:bride')!;
  const ctx = { ...EMPTY_CTX, palette: { bride: ['#AA0000'] } as RolePalette };
  assert.equal(isPartDesigned(part, ctx), true);
});

test('an inspiration photo on a part\'s own slot counts as designed even with no colour', () => {
  const part = RENDER_PARTS.find((p) => p.id === 'place:flowers')!;
  const ctx = { ...EMPTY_CTX, inspirationPresence: new Set(['flowers']) };
  assert.equal(isPartDesigned(part, ctx), true);
});

test('colour source: people reads that role, room/places read the reception palette', () => {
  const palette = { reception: ['#111111'], bride: ['#222222'] } as RolePalette;
  const bride = RENDER_PARTS.find((p) => p.id === 'people:bride')!;
  const ceiling = RENDER_PARTS.find((p) => p.id === 'room:ceiling')!;
  assert.deepEqual(colorsForPart(bride, palette), ['#222222']);
  assert.deepEqual(colorsForPart(ceiling, palette), ['#111111']);
  assert.deepEqual(colorsForWholeLook(palette), ['#111111']);
});

test('render gate needs BOTH a deliberate colour and a reference photo', () => {
  const part = RENDER_PARTS.find((p) => p.id === 'room:ceiling')!;
  const noColor = renderGateForPart(part, { palette: {}, inspirationPresence: new Set(['ceiling']) });
  assert.equal(noColor.ok, false);
  assert.equal(noColor.needColor, true);
  assert.equal(noColor.needPhoto, false);

  const noPhoto = renderGateForPart(part, {
    palette: { reception: ['#123456'] } as RolePalette,
    inspirationPresence: new Set(),
  });
  assert.equal(noPhoto.ok, false);
  assert.equal(noPhoto.needPhoto, true);

  const ready = renderGateForPart(part, {
    palette: { reception: ['#123456'] } as RolePalette,
    inspirationPresence: new Set(['ceiling']),
  });
  assert.equal(ready.ok, true);
});

test('a part with no dedicated inspiration slot falls back to "overall" for the render gate, never for isDesigned', () => {
  // secondary_sponsors has no SLOT_ROLE alias — moodboard-render-parts.ts.
  const part = RENDER_PARTS.find((p) => p.id === 'people:secondary_sponsors')!;
  const withOverall = renderGateForPart(part, {
    palette: { secondary_sponsors: ['#654321'] } as RolePalette,
    inspirationPresence: new Set(['overall']),
  });
  assert.equal(withOverall.ok, true, 'overall should stand in as the reference photo');

  const designedCtx = {
    palette: {} as RolePalette,
    receptionDesign: {} as ReceptionDesign,
    inspirationPresence: new Set(['overall']),
  };
  assert.equal(
    isPartDesigned(part, designedCtx),
    false,
    'a generic vibe photo alone must not make an unrelated part read as designed',
  );
});

test('whole look reads the reception palette and ANY inspiration photo', () => {
  const gate = renderGateForWholeLook({
    palette: { reception: ['#123456'] } as RolePalette,
    inspirationPresence: new Set(['flowers']),
  });
  assert.equal(gate.ok, true);
});

test('brief lines print human labels, never machine prompt text, and are honest about "not chosen yet"', () => {
  const line = briefColorLine(['#AA0000'], () => 'Rust Red');
  assert.equal(line, 'Your colours — Rust Red');
  const empty = briefColorLine([], () => null);
  assert.equal(empty, 'Your colours — none picked yet');

  const zoneLines = briefZoneLines('ceiling', {
    ceiling: { treatment: ['fairy_lights'] },
  } as ReceptionDesign);
  assert.ok(zoneLines.some((l) => l.includes('Fairy lights')));
  assert.ok(zoneLines.every((l) => !l.includes('fairy_lights')), 'must print the LABEL, never the option id');

  const untouched = briefZoneLines('stage', {} as ReceptionDesign);
  assert.ok(untouched.every((l) => l.endsWith('not chosen yet')));
});

test('the whole-look brief covers every reception zone except People', () => {
  const lines = briefWholeLookZoneLines({} as ReceptionDesign);
  assert.ok(lines.length > 0);
  assert.ok(!lines.some((l) => l.startsWith('Who')), 'People is a modifier on the room, not a treatment line');
});

test('referencePhotoCount is derived from the same slot list the gate reads', () => {
  const part = RENDER_PARTS.find((p) => p.id === 'room:ceiling')!;
  assert.equal(referencePhotoCount(part, new Set()), 0);
  assert.equal(referencePhotoCount(part, new Set(['ceiling'])), 1);
});

/* ── designRevisionKey reads exactly buildPrompt's three inputs ─────────── */

test('designRevisionKey changes on a reception colour edit', () => {
  const a = designRevisionKey({ reception: ['#111111'] } as RolePalette, {} as ReceptionDesign, null);
  const b = designRevisionKey({ reception: ['#222222'] } as RolePalette, {} as ReceptionDesign, null);
  assert.notEqual(a, b);
});

test('designRevisionKey changes on an attire colour edit (the prototype bumps globally, not per-part)', () => {
  const a = designRevisionKey({ bride: ['#111111'] } as RolePalette, {} as ReceptionDesign, null);
  const b = designRevisionKey({ bride: ['#222222'] } as RolePalette, {} as ReceptionDesign, null);
  assert.notEqual(a, b);
});

test('designRevisionKey changes on a reception design edit', () => {
  const a = designRevisionKey({} as RolePalette, {} as ReceptionDesign, null);
  const b = designRevisionKey({} as RolePalette, { ceiling: { treatment: ['fairy_lights'] } } as ReceptionDesign, null);
  assert.notEqual(a, b);
});

test('designRevisionKey changes on a venue correction', () => {
  const a = designRevisionKey({} as RolePalette, {} as ReceptionDesign, 'banquet_hall');
  const b = designRevisionKey({} as RolePalette, {} as ReceptionDesign, 'garden');
  assert.notEqual(a, b);
});

test('designRevisionKey is stable across re-derivation of the identical state (no false staleness)', () => {
  const palette = { reception: ['#111111'], bride: ['#AA0000'] } as RolePalette;
  const design = { ceiling: { treatment: ['fairy_lights'] } } as ReceptionDesign;
  assert.equal(designRevisionKey(palette, design, 'garden'), designRevisionKey(palette, design, 'garden'));
});

/* ── gridParts: derives from RENDER_PARTS, never a hand list ────────────── */

test('no part in RENDER_PARTS is invisible to gridParts once every part is designed', () => {
  // A ctx under which EVERY real part reads as designed: every attire role
  // gets a colour, every room zone gets its first attribute's first option
  // selected, every place gets its slot photographed.
  const palette: RolePalette = {};
  for (const part of RENDER_PARTS) {
    if (part.group === 'people') {
      (palette as Record<string, string[]>)[part.sourceKey] = ['#123456'];
    }
  }
  const receptionDesign: ReceptionDesign = {};
  const inspirationPresence = new Set<string>();
  for (const part of RENDER_PARTS) {
    if (part.group === 'places') inspirationPresence.add(part.sourceKey);
  }
  // Room zones: give every zone SOME selection via the reception-scene shape,
  // reading its own attribute ids rather than hand-typing option ids.
  for (const p of RECEPTION_PARTS) {
    if (p.id === 'people') continue;
    const attrs: Record<string, string[]> = {};
    for (const a of p.attributes) attrs[a.id] = [a.options[0]!.id];
    (receptionDesign as Record<string, Record<string, string[]>>)[p.id] = attrs;
  }

  const ctx = { palette, receptionDesign, inspirationPresence };
  const { own, suggested } = gridParts(RENDER_PARTS, ctx, new Map<string, PartWorkState>(), new Set());
  const shown = new Set([...own, ...suggested].map((p) => p.id));

  for (const part of RENDER_PARTS) {
    assert.ok(shown.has(part.id), `${part.id} is designed but gridParts hid it — a hand list would fail here`);
  }
});

test('an untouched board shows exactly the four-tile floor from the real registry, never all of it', () => {
  const { own, suggested } = gridParts(RENDER_PARTS, EMPTY_CTX, new Map(), new Set());
  assert.equal(own.length, 0);
  assert.equal(suggested.length, MIN_PART_TILES);
});

test('a dismissed suggestion does not return on its own', () => {
  const dismissed = new Set(['room:backdrop']);
  const { own, suggested } = gridParts(RENDER_PARTS, EMPTY_CTX, new Map(), dismissed);
  assert.ok(!own.some((p) => p.id === 'room:backdrop'));
  assert.ok(!suggested.some((p) => p.id === 'room:backdrop'));
});

test('a tile with committed work never vanishes even if its underlying design reverts', () => {
  const work = new Map<string, PartWorkState>([['room:walls', { hasWork: true, committed: true }]]);
  const { own } = gridParts(RENDER_PARTS, EMPTY_CTX, work, new Set());
  assert.ok(own.some((p) => p.id === 'room:walls'));
});

/* ── buildTileViewModel: the stale marker must reach what gets rendered ─── */

test('a never-generated tile is never stale, and its tag reflects colour presence', () => {
  const vm = buildTileViewModel({
    id: 'room:ceiling',
    label: 'Ceiling',
    cost: 1,
    hexes: [],
    gate: { ok: false, needColor: true, needPhoto: true },
    briefLines: [],
    state: EMPTY_PART_STATE,
    currentRevisionKey: 'v1',
  });
  assert.equal(vm.isStale, false);
  assert.equal(vm.staleBannerText, null);
  assert.equal(vm.tag, 'No colours yet');
});

test('a render generated under the CURRENT revision is not stale', () => {
  const vm = buildTileViewModel({
    id: 'room:ceiling',
    label: 'Ceiling',
    cost: 1,
    hexes: ['#123456'],
    gate: { ok: true, needColor: false, needPhoto: false },
    briefLines: [],
    state: { ...EMPTY_PART_STATE, generated: { revisionKey: 'v1', hexes: ['#123456'] } },
    currentRevisionKey: 'v1',
  });
  assert.equal(vm.isStale, false);
  assert.equal(vm.staleBannerText, null);
  assert.equal(vm.tag, '✦ Photoreal — simulated');
});

test('a render generated under an OLDER revision is stale, and staleBannerText carries the fact', () => {
  const vm = buildTileViewModel({
    id: 'room:ceiling',
    label: 'Ceiling',
    cost: 1,
    hexes: ['#123456'],
    gate: { ok: true, needColor: false, needPhoto: false },
    briefLines: [],
    state: { ...EMPTY_PART_STATE, generated: { revisionKey: 'v1-old', hexes: ['#123456'] } },
    currentRevisionKey: 'v2-new',
  });
  assert.equal(vm.isStale, true);
  assert.equal(typeof vm.staleBannerText, 'string');
  assert.ok(vm.staleBannerText!.length > 0);
});

test('the cost label is singular for one credit, plural otherwise', () => {
  assert.equal(
    buildTileViewModel({
      id: 'x', label: 'X', cost: 1, hexes: [], gate: { ok: true, needColor: false, needPhoto: false },
      briefLines: [], state: EMPTY_PART_STATE, currentRevisionKey: 'v1',
    }).costLabel,
    '1 credit',
  );
  assert.equal(
    buildTileViewModel({
      id: 'x', label: 'X', cost: 5, hexes: [], gate: { ok: true, needColor: false, needPhoto: false },
      briefLines: [], state: EMPTY_PART_STATE, currentRevisionKey: 'v1',
    }).costLabel,
    '5 credits',
  );
});

test('SABOTAGE-PROVED GUARD: make-it-real.tsx actually renders staleBannerText, not merely computes it', () => {
  const src = readFileSync(MAKE_IT_REAL_COMPONENT, 'utf8');
  assert.match(
    src,
    /staleBannerText/,
    'the component must read tile.staleBannerText — the stale marker must reach the render, not just the state',
  );
  // It must appear inside JSX output, not only be destructured and discarded —
  // a destructure-and-drop would still match the bare-name assertion above.
  assert.match(
    src,
    /\{[a-zA-Z]+\.staleBannerText\}/,
    'staleBannerText must be interpolated into the rendered output, not just read',
  );
});

test('SABOTAGE-PROVED GUARD: never a peso sign in the render-surface derivation or its component', () => {
  const libSrc = readFileSync(join(LIB_DIR, 'moodboard-make-it-real.ts'), 'utf8');
  const componentSrc = readFileSync(MAKE_IT_REAL_COMPONENT, 'utf8');
  assert.ok(!libSrc.includes('₱'), 'moodboard-make-it-real.ts must never state a cost in pesos');
  assert.ok(
    !componentSrc.includes('₱'),
    'make-it-real.tsx must never state a render/part cost in pesos — credits only. ' +
      'The pack PRICE (a real purchase) is formatted server-side in page.tsx and handed to ' +
      'ChoosePlanSheet, which is out of this guard\'s scope on purpose.',
  );
});
