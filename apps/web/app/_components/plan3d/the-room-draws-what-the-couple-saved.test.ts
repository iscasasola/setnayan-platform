/**
 * THE ROOM DREW FOUR OF FIVE COLOURS, SEVEN OF TEN PARTS, AND SAID NOTHING.
 *
 * `events.reception_design` and `events.role_palette` are the couple's own
 * saved design. Three things in them reached NO pixel in the 3D Seat Plan:
 *
 *   1. `role_palette.reception[4]` — the FIFTH major colour, owner-locked
 *      2026-09-03 ("themes must be 5 colors"), shipped in all 2,600 seeded
 *      themes, named "Accent 2" in `PALETTE_LIMITS.reception.slotLabels`. The
 *      room read slots 0-3 and stopped.
 *   2. The `walls` · `photo_wall` · `welcome_signage` zones — stored, offered
 *      in the reception-design editor, printed in the concept PDF, drawn
 *      nowhere. A couple who dressed their side walls and put a step-and-repeat
 *      by the door got a room byte-identical to one where they chose nothing.
 *   3. A multi-selection. The room draws ONE treatment per attribute (there is
 *      one physical ceiling band, one welcome table) — a real limit, honestly
 *      taken. It just never said so, so "we drew one of your three" looked
 *      exactly like "you picked one".
 *
 * Same disease as the guest list that told a couple with 180 names "No guests
 * yet": a silent absence rendering as a confident answer.
 *
 * ─── WHY THIS FILE MOUNTS THINGS INSTEAD OF CALLING RESOLVERS ─────────────
 * A correct resolver is not evidence. The Panood controller resolved camera
 * status correctly and still lied on screen because nothing re-ran the render.
 * So the zone tests and the colour tests below go through
 * `renderToStaticMarkup` and read the emitted tree, not `sel()` and not
 * `resolvePaletteFromRoles`.
 *
 * 🪤 ONE HOP A SERVER RENDER CANNOT SEE, AND IT IS NOT LAZINESS.
 * `BlossomInstances` paints its two tones with `mesh.setColorAt()` inside a
 * `useLayoutEffect`. Server rendering runs no layout effects, so the tones are
 * absent from the markup by construction — a render-level assertion there
 * would be VACUOUS, passing whatever the colour was. (Measured: with only
 * blossom sites in the scene, the five-colour and four-colour markup were
 * byte-identical at 1397 chars while `accent2` resolved correctly — this file
 * caught its own blind spot before it shipped.) That hop is therefore pinned
 * at the CALL SITE, with an exact count, the way
 * `the-room-dressing-knobs-dress-the-room.test.ts` pins the chair override.
 * Every OTHER accent2 site is a plain material colour and is checked in the
 * markup.
 *
 * 🪤 `globalThis.React` before the dynamic imports is required, not tidy-able:
 * tsconfig sets `"jsx": "preserve"`, so `tsx` compiles components to the
 * CLASSIC runtime — bare `React.createElement` with no import of its own. Same
 * shape as `app/dashboard/[eventId]/launch/_components/hub-stage-renders.test.ts`.
 *
 * Run from `apps/web` (`pnpm test:unit`) — the repo root breaks every `@/…`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import {
  DEFAULT_DESIGN,
  RECEPTION_PARTS,
  hiddenTreatments,
  primaryOnlyNotice,
  sanitizeReceptionDesign,
  type PartId,
  type ReceptionDesign,
} from '@/lib/reception-scene';
import { resolvePalette, resolvePaletteFromRoles } from '@/lib/seating-3d';
import { archetypeFloorColor, ROOM_DRAWN_ATTRIBUTES } from './venue-decor';
import type { RolePalette } from '@/lib/mood-board';

const HERE = dirname(fileURLToPath(import.meta.url));
const DECOR = join(HERE, 'venue-decor.tsx');
const LAB_REL = 'dashboard/[eventId]/seating/lab/_components/seating-lab-3d.tsx';
const LAB = join(HERE, '..', '..', LAB_REL);
const LIB = join(HERE, '..', '..', '..', 'lib');

/** Every surface that mounts the room. All three paint their own floor. */
const SURFACES = [
  LAB_REL,
  '_components/plan3d/plan3d-scene.tsx',
  '[slug]/venue/_components/guest-venue-3d.tsx',
] as const;

(globalThis as unknown as { React: unknown }).React = React;

/* R3F element names are camelCase host tags; react-dom warns loudly about each
   one. The warnings are noise here — the markup is what is under test. */
const realError = console.error;
console.error = (...a: unknown[]) => {
  const s = String(a[0] ?? '');
  if (/incorrect casing|does not recognize|non-boolean attribute|Received `true`/.test(s)) return;
  realError(...(a as []));
};

/** Five sentinel hexes that appear nowhere else in the scene, one per slot, so
 *  "did slot N reach a pixel" is answerable by a substring search. */
const MAJORS = ['#a10001', '#a20002', '#a30003', '#a40004', '#a50005'] as const;

const FLOOR = {
  venueWidthM: 16,
  venueLengthM: 20,
  stage: { xPct: 50, yPct: 12, wPct: 30, hPct: 12 },
  entrance: { enabled: true, xPct: 50, yPct: 96, kind: 'door' as const, depthM: 2 },
  dance: { enabled: true, xPct: 50, yPct: 55, wPct: 26, hPct: 18 },
  published: true,
};
const TABLES = [
  { id: 't1', label: 'T1', type: 'guest', shape: 'round', capacity: 8, removedSeats: [], xPct: 30, yPct: 55, rotationDeg: 0, linkGroupId: null },
  { id: 't2', label: 'T2', type: 'guest', shape: 'round', capacity: 8, removedSeats: [], xPct: 70, yPct: 55, rotationDeg: 0, linkGroupId: null },
];

/** The design a board holds when the couple has touched none of MB1's inputs:
 *  DEFAULT_DESIGN, which puts all three new zones at "nothing here". */
const LEGACY_DESIGN: ReceptionDesign = sanitizeReceptionDesign(DEFAULT_DESIGN);

/** Mount VenueDecor for real and return the emitted tree. */
async function paint(
  design: ReceptionDesign,
  reception: string[],
  archetype = 'banquet_hall',
): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { VenueDecor } = await import('./venue-decor');
  return renderToStaticMarkup(
    React.createElement(VenueDecor, {
      design,
      floor: FLOOR,
      tables: TABLES,
      room: { w: 16, d: 20 },
      palette: resolvePaletteFromRoles({ reception } as RolePalette),
      quality: 'high',
      archetype,
    } as never),
  );
}

/** The three zones this session taught the room to draw, and the one option in
 *  each that legitimately draws nothing (its DEFAULT_DESIGN value). */
const ZONES: ReadonlyArray<{ part: PartId; attr: string; anchor: string }> = [
  { part: 'walls', attr: 'treatment', anchor: 'decor-walls-' },
  { part: 'photo_wall', attr: 'style', anchor: 'decor-photo-wall-' },
  { part: 'welcome_signage', attr: 'style', anchor: 'decor-welcome-' },
];

function optionsOf(part: PartId, attr: string): string[] {
  const p = RECEPTION_PARTS.find((x) => x.id === part)!;
  const a = p.attributes.find((x) => x.id === attr)!;
  return a.options.map((o) => o.id);
}

/* ══ 1 · THE THREE ZONES REACH THE RENDER ═════════════════════════════════ */

test('every zone option the couple can pick draws something in the room', async () => {
  const base = await paint(LEGACY_DESIGN, MAJORS.slice(0, 4) as unknown as string[]);
  for (const { part, attr, anchor } of ZONES) {
    const nothing = DEFAULT_DESIGN[part][attr]!;
    for (const id of optionsOf(part, attr)) {
      const design = sanitizeReceptionDesign({ ...DEFAULT_DESIGN, [part]: { [attr]: id } });
      const html = await paint(design, MAJORS.slice(0, 4) as unknown as string[]);
      if (id === nothing) {
        assert.equal(
          html.includes(anchor),
          false,
          `${part}.${attr}='${id}' is the "nothing here" default — it must mount no geometry, ` +
            'or every untouched board gets decor nobody asked for',
        );
        continue;
      }
      // The group exists…
      assert.ok(
        html.includes(`name="${anchor}${id}"`),
        `${part}.${attr}='${id}' is in the catalogue, is saved, is printed in the concept PDF — ` +
          'and reaches NO geometry in the room. That is the bug this file exists against.',
      );
      // …and it actually contains something. A named-but-empty group would
      // satisfy the line above while drawing exactly as much as before.
      assert.ok(
        html.length > base.length,
        `${part}.${attr}='${id}' mounts a group that renders nothing — an empty ` +
          'named group passes the anchor check and still shows the couple no change',
      );
    }
  }
});

test('a board that never touched the three zones mounts none of them', async () => {
  const html = await paint(LEGACY_DESIGN, MAJORS.slice(0, 4) as unknown as string[]);
  for (const { anchor } of ZONES) {
    assert.equal(html.includes(anchor), false, `${anchor}* mounted for a default board`);
  }
});

test('open-air rooms keep the wall choice and simply have no wall to dress', async () => {
  // A garden has no side wall (VenueShell replaces them with perimeter
  // greenery), exactly as it has no ceiling to hang a chandelier from. The
  // choice is preserved in the data; it just cannot be built.
  const design = sanitizeReceptionDesign({ ...DEFAULT_DESIGN, walls: { treatment: 'fabric_drape' } });
  assert.ok((await paint(design, MAJORS.slice(0, 4) as unknown as string[], 'banquet_hall')).includes('decor-walls-fabric_drape'));
  assert.equal((await paint(design, MAJORS.slice(0, 4) as unknown as string[], 'garden')).includes('decor-walls-'), false);
});

/* ══ 2 · ALL FIVE MAJORS REACH THE RENDER ═════════════════════════════════ */

/** A design that exercises every surface the majors paint, INCLUDING the
 *  photo wall and the seating chart, which are where `accent2` lands as a
 *  plain material colour a server render can see. */
const FIVE_SLOT_DESIGN = sanitizeReceptionDesign({
  ...DEFAULT_DESIGN,
  ceiling: { treatment: 'chandeliers' },
  backdrop: { style: 'draped', florals: 'corner' },
  tunnel: { style: 'floral' },
  walls: { treatment: 'floral_garland' },
  photo_wall: { style: 'step_repeat' },
  welcome_signage: { style: 'framed_seating_chart' },
});

/** Mount the shell AND the decor — the two halves of the room's materials. */
async function paintRoom(design: ReceptionDesign, reception: string[]): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { VenueDecor, VenueShell } = await import('./venue-decor');
  const palette = resolvePaletteFromRoles({ reception } as RolePalette);
  return renderToStaticMarkup(
    React.createElement(
      'group' as never,
      null,
      React.createElement(VenueShell, { archetype: 'banquet_hall', room: { w: 16, d: 20 }, palette, quality: 'high' } as never),
      React.createElement(VenueDecor, {
        design, floor: FLOOR, tables: TABLES, room: { w: 16, d: 20 }, palette, quality: 'high', archetype: 'banquet_hall',
      } as never),
    ),
  );
}

test('all five reception colours reach the emitted room, not just the resolver', async () => {
  /*
    BY PERTURBATION, NOT BY SUBSTRING. Most slots are mixed before they are
    painted (`mix(palette.accent, '#ffffff', 0.55)`), so searching for the raw
    hex would report "slot 0 never reaches a pixel" about a colour that drives
    every chandelier in the room — measured, and it is why this is written this
    way. Changing one slot must change the emitted room; that is the claim.
  */
  const base = await paintRoom(FIVE_SLOT_DESIGN, [...MAJORS]);
  const baseFloor = archetypeFloorColor('banquet_hall', resolvePaletteFromRoles({ reception: [...MAJORS] } as RolePalette));
  for (let i = 0; i < MAJORS.length; i++) {
    const swapped: string[] = [...MAJORS];
    swapped[i] = '#0b0c0d';
    const why =
      `reception[${i}] changes nothing in the room. The couple picked it, the swatch strip ` +
      'shows it, and the room ignores it — which for slot 4 was true for every event on ' +
      'the platform until MB1.';
    if (i === 2) {
      // The ONE major that is not painted by VenueShell/VenueDecor: the floor
      // mesh belongs to each surface (see the next test), tinted here.
      assert.notEqual(
        archetypeFloorColor('banquet_hall', resolvePaletteFromRoles({ reception: swapped } as RolePalette)),
        baseFloor,
        why,
      );
      continue;
    }
    assert.notEqual(await paintRoom(FIVE_SLOT_DESIGN, swapped), base, why);
  }
});

test('the floor slot is fed the palette at all three surfaces that paint it', () => {
  /*
    reception[2] → `archetypeFloorColor` → each surface's own floor mesh. The
    value half is asserted above; this is the half that says the surfaces still
    call it with the couple's palette rather than a constant.
  */
  for (const rel of SURFACES) {
    const src = stripComments(readFileSync(join(HERE, '..', '..', rel), 'utf8'));
    assert.match(
      src,
      /archetypeFloorColor\(archetype, palette\)/,
      `${rel}: the floor no longer takes its tint from the couple's palette`,
    );
  }
});

test('a four-colour board renders no fifth colour and no accent2 at all', async () => {
  const four = MAJORS.slice(0, 4) as unknown as string[];
  assert.equal(
    resolvePaletteFromRoles({ reception: four } as RolePalette).accent2,
    undefined,
    'accent2 must be ABSENT below five colours, never derived — a derived value ' +
      'restyles every room already sold',
  );
  const html = await paint(FIVE_SLOT_DESIGN, four);
  assert.equal(html.includes(MAJORS[4]), false);
});

test('accent2 is reception[4] verbatim, and nothing invents one', () => {
  const p = resolvePaletteFromRoles({ reception: [...MAJORS] } as RolePalette);
  assert.equal(p.accent2, MAJORS[4]);
  // The two paths into Lab3DPalette must agree about slot 4.
  assert.equal(resolvePalette([...MAJORS]).accent2, MAJORS[4]);
  assert.equal(resolvePalette([]).accent2, undefined, 'the warm default must invent no fifth colour');
});

test('every seeded theme palette, cut to four, still resolves accent2 as absent', async () => {
  // The blind spot named at the top of this file, closed analytically: the
  // blossom tones are `palette.accent2 ?? <the old expression>`, so proving
  // accent2 is undefined for every pre-MB1 board proves the old expression is
  // what those rooms still get — including the hop no server render can see.
  const sql = [
    '20271196372720_moodboard_theme_templates_2500_seed.sql',
    '20271194462267_moodboard_theme_templates.sql',
  ]
    .map((f) => readFileSync(join(LIB, '..', '..', '..', 'supabase', 'migrations', f), 'utf8'))
    .join('\n');
  const palettes = [...sql.matchAll(/"reception":\[([^\]]*)\]/g)].map((m) =>
    m[1]!.split(',').map((s) => s.replace(/"/g, '')),
  );
  assert.ok(palettes.length > 2000, `only ${palettes.length} seeded palettes parsed — has the seed moved?`);
  for (const full of palettes) {
    assert.equal(resolvePaletteFromRoles({ reception: full.slice(0, 4) } as RolePalette).accent2, undefined);
  }
});

/* ══ 3 · THE ONE HOP THE MARKUP CANNOT SHOW — PINNED AT THE CALL SITE ═════ */

test('every blossom mount takes its second tone from bloomSecondary', () => {
  const src = stripComments(readFileSync(DECOR, 'utf8'));
  const mounts = [...src.matchAll(/<BlossomInstances[\s\S]*?\/>/g)].map((m) => m[0]);
  assert.equal(
    mounts.length,
    8,
    `expected 8 <BlossomInstances> mounts, found ${mounts.length}. A COUNT, not a spot-check: ` +
      'a file-level match cannot say which mount still hard-codes its second tone, and a new ' +
      'mount that does is exactly the regression. If you added one deliberately, wire it and ' +
      'raise this number.',
  );
  for (const m of mounts) {
    assert.match(
      m,
      /colorB=\{bloomSecondary\(/,
      'a blossom cloud whose second tone is hard-coded ignores the couple\'s fifth colour:\n' + m,
    );
  }
});

test('bloomSecondary falls back to the EXACT pre-MB1 expression', () => {
  const src = stripComments(readFileSync(DECOR, 'utf8'));
  const fn = src.slice(src.indexOf('function bloomSecondary'), src.indexOf('\n}', src.indexOf('function bloomSecondary')));
  assert.match(fn, /palette\.accent2 \?\?/, 'bloomSecondary ignores the fifth colour');
  assert.match(
    fn,
    /mix\(bloom, palette\.table, t\)/,
    'the no-fifth-colour fallback must stay `mix(bloom, palette.table, t)` — the exact ' +
      'expression every call site used before. Changing it restyles every existing room.',
  );
});

/* ══ 4 · THE MULTI-SELECT IS DRAWN ONCE AND SAID OUT LOUD ═════════════════ */

test('the disclosure list is exactly what the room actually draws', () => {
  /*
    THE FAILURE THIS BLOCKS, WHICH THIS FILE'S OWN AUTHOR SHIPPED FIRST DRAFT:
    a notice that walked every catalogue part told a couple "Stage (showing
    Arch)" about a stage `VenueDecor` does not draw at all — a brand-new false
    claim inside the fix for false claims. `ROOM_DRAWN_ATTRIBUTES` is what the
    legend is allowed to speak about, so it must equal the set of `sel()` calls
    in the file, no more and no less.
  */
  const src = stripComments(readFileSync(DECOR, 'utf8'));
  const called = new Set(
    [...src.matchAll(/\bsel\(design,\s*'([a-z_]+)',\s*'([a-z_]+)'\)/g)].map((m) => `${m[1]}.${m[2]}`),
  );
  const declared = new Set(ROOM_DRAWN_ATTRIBUTES.map(([p, a]) => `${p}.${a}`));
  assert.deepEqual(
    [...declared].sort(),
    [...called].sort(),
    'ROOM_DRAWN_ATTRIBUTES has drifted from the room. Extra entries let the legend claim ' +
      'something is on screen that never renders; missing entries silence a disclosure the ' +
      'couple is owed.',
  );
  assert.ok(called.size >= 7, `only ${called.size} attributes read — has VenueDecor been gutted?`);
});

test('the legend never speaks about a part the room does not draw', () => {
  // `stage.florals` and `entrance.runner` are multi-select and render NOWHERE
  // in 3D. A couple who combined three stage florals must not be told the room
  // is "showing Arch" — the room is showing no stage florals to anybody.
  const design = sanitizeReceptionDesign({
    ...DEFAULT_DESIGN,
    stage: { setup: 'sweetheart', florals: ['arch', 'pedestals'] },
    entrance: { runner: ['fabric', 'petals'] },
  });
  assert.deepEqual(hiddenTreatments(design, ROOM_DRAWN_ATTRIBUTES), []);
  assert.equal(primaryOnlyNotice(design, ROOM_DRAWN_ATTRIBUTES), null);
  // The helper is not lying about the data — asked about those attributes
  // directly, it reports them. It is the SURFACE that decides what it drew.
  assert.equal(hiddenTreatments(design, [['stage', 'florals']]).length, 1);
});

test('a single-selection board discloses nothing at all', () => {
  assert.deepEqual(hiddenTreatments(LEGACY_DESIGN, ROOM_DRAWN_ATTRIBUTES), []);
  assert.equal(
    primaryOnlyNotice(LEGACY_DESIGN, ROOM_DRAWN_ATTRIBUTES),
    null,
    'null, not an empty string — a board with nothing to disclose must render no node',
  );
});

test('a multi-selection names the primary AND every pick left off screen', () => {
  const design = sanitizeReceptionDesign({
    ...DEFAULT_DESIGN,
    ceiling: { treatment: ['draped', 'fairy_lights'] },
    welcome_signage: { style: ['easel_sign', 'framed_seating_chart', 'floral_guestbook'] },
  });
  const hidden = hiddenTreatments(design, ROOM_DRAWN_ATTRIBUTES);
  assert.equal(hidden.length, 2);
  const ceiling = hidden.find((h) => h.part === 'ceiling')!;
  assert.equal(ceiling.primaryLabel, 'Draped canopy');
  assert.deepEqual(ceiling.hiddenLabels, ['Fairy lights']);
  const welcome = hidden.find((h) => h.part === 'welcome_signage')!;
  assert.deepEqual(welcome.hiddenLabels, ['Framed seating chart', 'Floral guestbook table']);

  const notice = primaryOnlyNotice(design, ROOM_DRAWN_ATTRIBUTES)!;
  assert.match(notice, /3 of your picks are not on screen/);
  assert.match(notice, /Ceiling \(showing Draped canopy\)/);
  assert.match(notice, /Welcome & signage \(showing Easel welcome sign\)/);
});

test('the label the legend prints is the option the room actually drew', async () => {
  // The failure this blocks: the notice says "showing Draped canopy" while the
  // room draws fairy lights. `sel()` and `hiddenTreatments()` must agree, so
  // the primary is read back out of the RENDER, not out of the helper.
  const design = sanitizeReceptionDesign({
    ...DEFAULT_DESIGN,
    photo_wall: { style: ['neon_backdrop', 'floral_wall'] },
  });
  const html = await paint(design, MAJORS.slice(0, 4) as unknown as string[]);
  assert.ok(html.includes('name="decor-photo-wall-neon_backdrop"'), 'the room drew the primary');
  assert.equal(html.includes('decor-photo-wall-floral_wall'), false, 'and only the primary');
  assert.match(primaryOnlyNotice(design, ROOM_DRAWN_ATTRIBUTES)!, /Photo wall \(showing Neon sign\)/);
});

test('the notice reaches the room legend — not just the resolver', () => {
  const src = stripComments(readFileSync(LAB, 'utf8'));
  assert.match(
    src,
    /import \{[^}]*\bprimaryOnlyNotice\b[^}]*\} from '@\/lib\/reception-scene'/,
    'seating-lab-3d no longer imports the disclosure',
  );
  const at = src.indexOf('{primaryOnlyNotice(receptionDesign, ROOM_DRAWN_ATTRIBUTES) ?');
  assert.ok(at > 0, 'the legend no longer renders primaryOnlyNotice — a resolver nobody paints is the bug');
  // It must sit in the legend block, i.e. beside the RSVP swatches.
  const legend = src.indexOf('SIDE_COLOR.both');
  assert.ok(
    legend > at && legend - at < 2000,
    'the disclosure has drifted away from the room legend it is supposed to be part of',
  );
});

test("the notice's promise about the concept PDF is true", () => {
  // "your concept PDF lists every one" is a checkable claim. Both sheets build
  // their part lists from selAll; if either moves to sel, the sentence lies.
  for (const f of ['concept-pdf.ts', 'moodboard-printable.ts']) {
    const src = stripComments(readFileSync(join(LIB, f), 'utf8'));
    assert.match(
      src,
      /selAll\(design, pid, a\.id\)/,
      `${f} no longer lists every selection — the room's legend promises it does`,
    );
  }
});
