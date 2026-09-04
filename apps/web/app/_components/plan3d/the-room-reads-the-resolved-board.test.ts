/**
 * MB15 · THE ROOM READS THE RESOLVED BOARD — AND ONLY WHAT IT IS ALLOWED TO.
 *
 * The mood board holds a palette STYLE (MB5: *Our colours only* / *Softer room,
 * richer people* / *Room and people*) and a six-rank visibility ladder. The 3D
 * Plan could not see any of it: `resolvePaletteFromRoles` maps five hexes onto
 * five materials and has never known a style exists, so the same wedding
 * rendered identically under all three.
 *
 * MB1 FORBADE closing that gap, in as many words, because doing it carelessly
 * "silently restyles every room already sold". Owner, 2026-09-04: auto-upgrade
 * every room, existing and new — no opt-in, no warning prompt. So the rooms DO
 * change, deliberately, and "byte-identical before and after" is no longer the
 * gate. Two things replace it, and both are in this file:
 *
 *   1 · THE DIFF REPORT (informational, printed, committed to the changelog) —
 *       every one of the 2,600 seeded theme palettes × 3 styles rendered under
 *       the old and the new derivation, counted and characterised. "We do not
 *       know what changed" is not an acceptable answer for a switch every
 *       existing room goes through.
 *   2 · THE HARD GATE (pass/fail) — the outputs MB1 delivered must NOT move:
 *       `accent2` (the fifth major reaching a pixel), the three majors with no
 *       style-derived counterpart, and the three decor zones' geometry. The
 *       zones' DRESSED surfaces may move, and exactly which ones is pinned by
 *       an exact map read out of the RENDER, so a new leak into a zone goes red.
 *
 * ─── WHY THIS FILE PAINTS INSTEAD OF CALLING RESOLVERS ─────────────────────
 * The Panood lesson, the same one MB1's sibling file opens with: a correct
 * resolver is not evidence. The zone assertions below go through
 * `renderToStaticMarkup` and read the emitted tree.
 *
 * 🪤 `globalThis.React` before the dynamic imports is required, not tidy-able:
 * tsconfig sets `"jsx": "preserve"`, so `tsx` compiles components to the CLASSIC
 * runtime — bare `React.createElement` with no import of its own.
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
  sanitizeReceptionDesign,
  type PartId,
  type ReceptionDesign,
} from '@/lib/reception-scene';
import { resolvePaletteFromRoles, type Lab3DPalette } from '@/lib/seating-3d';
import { resolveRoomPalette, resolveDisplayPalette } from '@/lib/room-palette';
import { deriveVenue, normalizeMajors, type PaletteStyle } from '@/lib/palette-styles';
import type { RolePalette } from '@/lib/mood-board';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..', '..');
const APP = join(HERE, '..', '..');

/** Every surface that mounts the room and must read the resolved board. */
const SURFACES = [
  'dashboard/[eventId]/seating/lab/_components/seating-lab-3d.tsx',
  '_components/plan3d/plan3d-scene.tsx',
  '[slug]/venue/_components/guest-venue-3d.tsx',
] as const;

const STYLES: readonly PaletteStyle[] = ['simple', 'depth', 'complex'];

(globalThis as unknown as { React: unknown }).React = React;

/* R3F element names are camelCase host tags; react-dom warns about each one. */
const realError = console.error;
console.error = (...a: unknown[]) => {
  const s = String(a[0] ?? '');
  if (/incorrect casing|does not recognize|non-boolean attribute|Received `true`/.test(s)) return;
  realError(...(a as []));
};

/* ══ the 2,600 seeded boards, read from the seed migrations themselves ═════ */

function seededPalettes(): string[][] {
  const sql = [
    '20271196372720_moodboard_theme_templates_2500_seed.sql',
    '20271194462267_moodboard_theme_templates.sql',
  ]
    .map((f) => readFileSync(join(ROOT, 'supabase', 'migrations', f), 'utf8'))
    .join('\n');
  return [...sql.matchAll(/"reception":\[([^\]]*)\]/g)].map((m) =>
    m[1]!.split(',').map((s) => s.replace(/"/g, '')),
  );
}

const SEEDED = seededPalettes();

test('the seed still holds the 2,600 boards this file reports on', () => {
  assert.ok(
    SEEDED.length > 2000,
    `only ${SEEDED.length} seeded palettes parsed — has the seed moved? The diff ` +
      'report below would then be describing a sample nobody chose.',
  );
});

/* ══ 1 · THE HARD GATE — WHAT MB1 DELIVERED DOES NOT MOVE ═════════════════ */

/** The four fields that have no style-derived counterpart in `deriveVenue`, so
 *  `resolveRoomPalette` must return them exactly as `resolvePaletteFromRoles`
 *  did. `accent2` is the whole of MB1's fifth-colour repair. */
const UNMOVED_FIELDS = ['accent', 'floor', 'wall', 'accent2'] as const;

test('accent, floor, wall and accent2 are byte-identical for every seeded board in every style', () => {
  let checked = 0;
  for (const reception of SEEDED) {
    for (const style of STYLES) {
      const rp = { reception, palette_style: style } as RolePalette;
      const before = resolvePaletteFromRoles(rp);
      const after = resolveRoomPalette(rp);
      for (const f of UNMOVED_FIELDS) {
        assert.equal(
          after[f],
          before[f],
          `${f} moved under style '${style}' for [${reception.join(', ')}]. Only the four ` +
            'room-dressing surfaces are style-derived; this is the restyle leaking into ' +
            "scope it must not touch. accent2 in particular IS MB1's repair.",
        );
      }
      checked++;
    }
  }
  assert.equal(checked, SEEDED.length * STYLES.length);
});

test('a four-colour board still has NO accent2 after the switch, exactly as before', () => {
  // MB1's own claim, re-asserted through the new resolver: `accent2` is
  // reception[4] verbatim or it is absent. A DERIVED fifth colour would restyle
  // every room already sold — which is the one thing the auto-upgrade decision
  // did NOT authorise.
  for (const reception of SEEDED) {
    for (const style of STYLES) {
      const four = reception.slice(0, 4);
      assert.equal(
        resolveRoomPalette({ reception: four, palette_style: style } as RolePalette).accent2,
        undefined,
      );
    }
  }
});

test('a board with no usable major is byte-identical to the pre-MB15 room', () => {
  // `normalizeMajors` throws on an empty list by design. The guard in
  // `resolveRoomPalette` is what keeps a board nobody has coloured yet on
  // exactly the render it had — and it is the reason this is not a crash.
  for (const rp of [
    {},
    { reception: [] },
    { reception: ['not-a-hex'] },
    { room_dressing: { linens: '#123456', chairs: '#654321' } },
  ] as RolePalette[]) {
    assert.deepEqual(resolveRoomPalette(rp), resolvePaletteFromRoles(rp));
  }
});

test("an explicit room-dressing override still wins — which is also MB12's freeze", () => {
  // `vendor_agree_to_part` freezes a dressing field by WRITING it into
  // role_palette.room_dressing. If the style derivation overrode it, an agreed
  // linen colour would silently follow the couple's next style switch.
  const rp = {
    reception: ['#A10001', '#A20002', '#A30003', '#A40004', '#A50005'],
    palette_style: 'complex',
    room_dressing: { linens: '#0B0C0D', chairs: '#0B0C0E', florals: '#0B0C0F', lighting_warmth: '#0B0C10' },
  } as RolePalette;
  const p = resolveRoomPalette(rp);
  assert.equal(p.table, '#0B0C0D');
  assert.equal(p.chairs, '#0B0C0E');
  assert.equal(p.florals, '#0B0C0F');
  assert.equal(p.ambient, '#0B0C10');
});

/* ══ 2 · THE DIFF REPORT — WHAT ACTUALLY CHANGED, COUNTED ═════════════════ */

const DRESSED_FIELDS = ['table', 'ambient', 'chairs', 'florals'] as const;
type DressedField = (typeof DRESSED_FIELDS)[number];

type StyleReport = {
  style: PaletteStyle;
  total: number;
  changed: number;
  byField: Record<DressedField, number>;
  /** Boards where a field went from ABSENT to a value (chairs/florals never
   *  existed unless the couple set one). */
  newlyPresent: Record<DressedField, number>;
};

function diffReport(): StyleReport[] {
  return STYLES.map((style) => {
    const byField = { table: 0, ambient: 0, chairs: 0, florals: 0 };
    const newlyPresent = { table: 0, ambient: 0, chairs: 0, florals: 0 };
    let changed = 0;
    for (const reception of SEEDED) {
      const rp = { reception, palette_style: style } as RolePalette;
      const before = resolvePaletteFromRoles(rp);
      const after = resolveRoomPalette(rp);
      let any = false;
      for (const f of DRESSED_FIELDS) {
        if (before[f] === after[f]) continue;
        any = true;
        byField[f]++;
        if (before[f] === undefined) newlyPresent[f]++;
      }
      if (any) changed++;
    }
    return { style, total: SEEDED.length, changed, byField, newlyPresent };
  });
}

test('THE DIFF REPORT — every seeded board, old vs new derivation, counted', () => {
  const report = diffReport();
  const lines = [
    '',
    `── MB15 DIFF REPORT · ${SEEDED.length} seeded theme palettes × ${STYLES.length} styles ──`,
  ];
  for (const r of report) {
    lines.push(
      `  ${r.style.padEnd(8)} changed ${r.changed}/${r.total}  ` +
        DRESSED_FIELDS.map((f) => `${f}=${r.byField[f]}(+${r.newlyPresent[f]} new)`).join(' '),
    );
  }
  // Printed, not swallowed: the number in the changelog fragment is this number.
  console.log(lines.join('\n'));

  /*
    THE CLAIMS THE REPORT MAKES, ASSERTED — otherwise the print above is a
    number nobody checks, which is exactly the shape this arc keeps finding.
  */
  const simple = report.find((r) => r.style === 'simple')!;
  const depth = report.find((r) => r.style === 'depth')!;
  const complex = report.find((r) => r.style === 'complex')!;

  // EVERY board changes: chairs and florals never existed unless the couple set
  // one, so every seeded room gains both under every style. That is the
  // auto-upgrade, stated as a number rather than as a hope.
  for (const r of report) {
    assert.equal(r.changed, r.total, `${r.style}: only ${r.changed}/${r.total} boards changed`);
    assert.equal(r.newlyPresent.chairs, r.total);
    assert.equal(r.newlyPresent.florals, r.total);
  }

  // `simple` returns the majors UNTONED, so the two fields that already had a
  // value (table ← reception[1], ambient ← reception[0]) do not move at all.
  assert.equal(simple.byField.table, 0, 'simple style moved the linen colour — deriveVenue tones nothing there');
  assert.equal(simple.byField.ambient, 0, 'simple style moved the ambient wash');

  // `depth` and `complex` share one derivation (`tone()`: +0.06 L, chroma
  // capped at 0.13), so their counts are identical by construction. A future
  // divergence between the two is a real change and should be seen, not
  // absorbed.
  assert.deepEqual(depth.byField, complex.byField);
  assert.deepEqual(depth.newlyPresent, complex.newlyPresent);
  assert.ok(
    depth.byField.table > depth.total * 0.9,
    `only ${depth.byField.table}/${depth.total} linens moved under 'depth' — the lift should ` +
      'reach almost every board; a near-zero count means the style is not reaching the room at all',
  );
});

test('the room-dressing the room draws IS deriveVenue, not a second copy of it', () => {
  // The one-mechanism claim, spot-proven against the engine itself rather than
  // against a re-typed expectation.
  for (const reception of SEEDED.slice(0, 200)) {
    for (const style of STYLES) {
      const rd = deriveVenue(normalizeMajors(reception), style).room_dressing;
      const p = resolveRoomPalette({ reception, palette_style: style } as RolePalette);
      assert.equal(p.table, rd.linens);
      assert.equal(p.ambient, rd.lighting_warmth);
      assert.equal(p.chairs, rd.chairs);
      assert.equal(p.florals, rd.florals);
    }
  }
});

/* ══ 3 · THE THREE DECOR ZONES — GEOMETRY FROZEN, DRESSING PINNED ═════════ */

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
];

/** The three zones MB1 taught the room to draw, and the attribute that drives
 *  each. Identical to MB1's own list — deliberately, so the two files cannot
 *  disagree about which zones are under protection. */
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

async function paint(design: ReceptionDesign, palette: Lab3DPalette): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { VenueDecor } = await import('./venue-decor');
  return renderToStaticMarkup(
    React.createElement(VenueDecor, {
      design,
      floor: FLOOR,
      tables: TABLES,
      room: { w: 16, d: 20 },
      palette,
      quality: 'high',
      archetype: 'banquet_hall',
    } as never),
  );
}

/** Everything except the colour VALUES — tags, geometry args, group names. */
function skeleton(html: string): string {
  return html.replace(/(color|emissive)="[^"]*"/g, '$1="\u00b7"');
}

const MAJORS = ['#a10001', '#a20002', '#a30003', '#a40004', '#a50005'];
const BASE_PALETTE = resolvePaletteFromRoles({ reception: MAJORS } as RolePalette);
const NEW_PALETTE = resolveRoomPalette({ reception: MAJORS, palette_style: 'complex' } as RolePalette);

function designFor(part: PartId, attr: string, id: string): ReceptionDesign {
  return sanitizeReceptionDesign({ ...DEFAULT_DESIGN, [part]: { [attr]: id } });
}

test('every zone draws the SAME geometry under the old and the new derivation', async () => {
  /*
    THE HARD HALF. Colours may move where a zone dresses a surface from the
    room-dressing fields; the SHAPE of the room may not. A restyle that changed
    which groups mount, or how many meshes are in one, would be MB1's repair
    coming undone under the cover of a colour change.
  */
  for (const { part, attr } of ZONES) {
    for (const id of optionsOf(part, attr)) {
      const design = designFor(part, attr, id);
      const before = await paint(design, BASE_PALETTE);
      const after = await paint(design, NEW_PALETTE);
      assert.equal(
        skeleton(after),
        skeleton(before),
        `${part}.${attr}='${id}': the room's GEOMETRY moved under the new derivation. ` +
          'Only the dressed material colours are allowed to change.',
      );
    }
  }
});

/**
 * The subtree of ONE named decor group, extracted from the emitted markup.
 *
 * 🪤 MEASURED WHOLE-FILE FIRST, AND IT WAS USELESS. `VenueDecor` draws the
 * entire room — centrepieces, backdrop florals, the tunnel — so perturbing
 * `florals` changes the markup for EVERY zone, including the ones that mount
 * nothing. The first draft of this test reported "every zone reads florals",
 * which is true of the room and says nothing about the zone. The window has to
 * face the zone, or the measurement answers a different question than the one
 * asked.
 */
function zoneSubtree(html: string, name: string): string | null {
  const open = html.indexOf(`<group name="${name}"`);
  if (open < 0) return null;
  const tag = /<(\/?)([a-zA-Z][\w]*)\b[^>]*?(\/?)>/g;
  tag.lastIndex = open;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(html)) !== null) {
    if (m[2] !== 'group') continue;
    if (m[1] === '/') {
      depth--;
      if (depth === 0) return html.slice(open, tag.lastIndex);
    } else if (m[3] !== '/') {
      depth++;
    }
  }
  return null;
}

/**
 * WHICH dressed fields ONE zone option actually reads, measured at the render
 * by perturbing one field at a time and looking only inside that zone's own
 * group. Pinned as an exact map below: a zone that starts reading a new dressed
 * field, or stops reading one, changes this and goes red. That is the
 * allow-list the "geometry frozen" gate above is paired with — a blanket
 * byte-compare could only ever say "something moved".
 */
async function dressedFieldsRead(design: ReceptionDesign, anchor: string, id: string): Promise<DressedField[] | null> {
  const name = `${anchor}${id}`;
  const base = zoneSubtree(await paint(design, NEW_PALETTE), name);
  if (base === null) return null; // the "nothing here" default mounts no group
  const out: DressedField[] = [];
  for (const f of DRESSED_FIELDS) {
    const perturbed: Lab3DPalette = { ...NEW_PALETTE, [f]: '#0b0c0d' };
    if (zoneSubtree(await paint(design, perturbed), name) !== base) out.push(f);
  }
  return out;
}

test('exactly which zone surfaces the restyle reaches is pinned, option by option', async () => {
  /*
    null = the option mounts NO geometry (its "nothing here" default), so the
    restyle cannot reach it at all. Every other entry is what the zone reads
    TODAY, measured. The three MB1 zones are the ones under protection, and this
    is the exhaustive statement of how far into them the auto-upgrade goes.
  */
  const EXPECTED: Record<string, DressedField[] | null> = {
    // Side walls. `bare` is the untouched default and mounts no geometry.
    'walls.treatment=bare': null,
    'walls.treatment=fabric_drape': [],
    'walls.treatment=floral_garland': [],
    'walls.treatment=greenery_wall': [],
    'walls.treatment=uplighting_only': ['ambient'],
    // The photo wall. The balloons are plain meshes and take the floral colour;
    // the step-and-repeat and the neon rig are lit from `accent`/`accent2`,
    // which this switch does not touch at all.
    'photo_wall.style=none': null,
    'photo_wall.style=step_repeat': [],
    'photo_wall.style=neon_backdrop': [],
    'photo_wall.style=balloon_garland': ['florals'],
    'photo_wall.style=floral_wall': [],
    'photo_wall.style=greenery_wall': [],
    // The welcome table. `chairs` reaching the guestbook plinth is the
    // auto-upgrade arriving on a surface that had no colour of its own before
    // MB15: the couple never set `room_dressing.chairs`, so it fell back to a
    // linen mix, and now it takes the derived chair colour.
    'welcome_signage.style=minimal': null,
    'welcome_signage.style=easel_sign': ['table'],
    'welcome_signage.style=framed_seating_chart': ['table'],
    'welcome_signage.style=floral_guestbook': ['table', 'chairs'],
  };

  const actual: Record<string, DressedField[] | null> = {};
  for (const { part, attr, anchor } of ZONES) {
    for (const id of optionsOf(part, attr)) {
      actual[`${part}.${attr}=${id}`] = await dressedFieldsRead(designFor(part, attr, id), anchor, id);
    }
  }
  assert.deepEqual(
    actual,
    EXPECTED,
    'A decor zone started (or stopped) reading a style-derived surface. That is not ' +
      'automatically wrong — it is exactly the thing that must never happen by accident, ' +
      'so it is pinned. If you meant it, say why in the map above.',
  );
});

test('the floral hop no server render can see is pinned at the call site', () => {
  /*
    🪤 THE BLIND SPOT, INHERITED FROM MB1 AND NAMED RATHER THAN HIDDEN.
    `BlossomInstances` paints with `mesh.setColorAt()` inside a
    `useLayoutEffect`. Server rendering runs no layout effects, so a bloom's
    colour is ABSENT from the markup by construction — which is why the map
    above reports `[]` for `floral_garland`, `floral_wall` and `greenery_wall`
    rather than `florals`. Those zones DO take the couple's floral colour; a
    render-level assertion there would be vacuous, passing whatever it was.

    So it is pinned where MB1 pins its own half: at the source, on the one
    function every bloom's primary tone comes from.
  */
  const src = stripComments(readFileSync(join(HERE, 'venue-decor.tsx'), 'utf8'));
  const fn = src.slice(src.indexOf('function bloomColor'), src.indexOf('\n}', src.indexOf('function bloomColor')));
  assert.match(
    fn,
    /palette\.florals \?\?/,
    "bloomColor stopped reading the couple's floral colour — after MB15 that colour is " +
      'derived for every board, so this is the line that carries the restyle into every bloom ' +
      'in the room.',
  );
  const mounts = [...src.matchAll(/<BlossomInstances[\s\S]*?\/>/g)].map((m) => m[0]);
  assert.equal(
    mounts.length,
    8,
    `expected 8 <BlossomInstances> mounts, found ${mounts.length}. A COUNT, not a spot-check: ` +
      'the markup cannot say which bloom still hard-codes a tone, and a new mount that does is ' +
      'exactly the regression. If you added one deliberately, wire it and raise this number.',
  );
  for (const m of mounts) {
    assert.match(
      m,
      /colorA=\{(?:bloom|archBloom|leaf|greeneryOnly \? leaf : bloom)\}/,
      'a blossom cloud whose primary tone bypasses bloomColor ignores the derived floral ' +
        'colour, and no render can tell you:\n' + m,
    );
  }
});

/* ══ 4 · ONE DIRECTION — THE ROOM READS, IT NEVER WRITES ══════════════════ */

test('no 3D surface writes role_palette or reception_design', () => {
  /*
    The rule that has held through every session in this arc. The mood board is
    where colour and design are decided; two writers for one fact is a defect
    that takes months to surface and always surfaces in front of a customer.

    Checked as an ABSENCE OF WRITE VERBS against the two column names, not as a
    ban on the identifiers — every one of these files legitimately READS both.
  */
  const WRITE = /(?:\.update\(|\.upsert\(|\.insert\(|saveRolePalette|saveReceptionDesign)/;
  for (const rel of SURFACES) {
    const src = stripComments(readFileSync(join(APP, rel), 'utf8'));
    assert.doesNotMatch(
      src,
      WRITE,
      `${rel} contains a write. The 3D Plan reads the mood board and never writes back — ` +
        'a room that could change role_palette or reception_design would be a second author ' +
        'of the couple\'s design, and the two would disagree forever.',
    );
  }
  // …and the resolver they all read through writes nothing either.
  const lib = stripComments(readFileSync(join(APP, '..', 'lib', 'room-palette.ts'), 'utf8'));
  assert.doesNotMatch(lib, WRITE);
  assert.doesNotMatch(lib, /supabase/i, 'lib/room-palette.ts must stay pure — it takes a palette and returns colours');
});

/* ══ 5 · THE WIRING — IT REACHES THE RENDER, NOT JUST A RESOLVER ══════════ */

test('all three surfaces resolve their materials through resolveRoomPalette', () => {
  for (const rel of SURFACES) {
    const src = stripComments(readFileSync(join(APP, rel), 'utf8'));
    assert.match(
      src,
      /resolveRoomPalette\(/,
      `${rel} no longer resolves the room through the palette-style engine — it is back on ` +
        'the flat colour list and the couple\'s style reaches nothing.',
    );
    assert.doesNotMatch(
      src,
      /\bresolvePaletteFromRoles\(/,
      `${rel} still calls resolvePaletteFromRoles directly. Two paths from one palette to one ` +
        'room is how the couple ends up looking at two different rooms.',
    );
  }
});

test('all three surfaces dress their people from the palette section 02 shows', () => {
  for (const rel of SURFACES) {
    const src = stripComments(readFileSync(join(APP, rel), 'utf8'));
    assert.match(
      src,
      /resolveDisplayPalette\(/,
      `${rel}: attire is resolved from the RAW palette again. An untouched role is absent ` +
        'there, so the chain falls through to the side colour and dresses a bridesmaid in a ' +
        'colour the board never showed anybody.',
    );
  }
});

test('the raw palette never reaches the attire chain in the couple lab or the guest walk', () => {
  // The wiring defect this arc keeps finding: a correct resolver and a correct
  // component, with the one line joining them free to break silently. So the
  // CALL SITES are pinned, not merely the presence of the import.
  const lab = stripComments(
    readFileSync(join(APP, 'dashboard/[eventId]/seating/lab/_components/seating-lab-3d.tsx'), 'utf8'),
  );
  assert.match(lab, /bride: hudDisplayPalette\.bride\?\.\[0\]/);
  assert.match(lab, /guestPalette: hudDisplayPalette\.guest \?\? \[\]/);
  assert.doesNotMatch(lab, /guestPalette: rolePalette\.guest/);

  const walk = stripComments(readFileSync(join(APP, '[slug]/venue/_components/guest-venue-3d.tsx'), 'utf8'));
  assert.match(walk, /guestAttireColor\(attirePalette,/);
  assert.doesNotMatch(walk, /guestAttireColor\(scene\.rolePalette,/);

  const page = stripComments(
    readFileSync(join(APP, 'dashboard/[eventId]/seating/lab/page.tsx'), 'utf8'),
  );
  assert.match(page, /resolveAttirePaletteColor\(g\.role, displayPalette, sideAttireColor\(displayPalette, g\.side\)\)/);
});

test('resolveDisplayPalette shows what 02 shows, and invents nothing where 02 shows nothing', () => {
  const rp = { reception: MAJORS, palette_style: 'depth' } as RolePalette;
  const out = resolveDisplayPalette(rp);
  // Every derivable role gains a colour — that is the disagreement being closed.
  for (const key of ['bride', 'groom', 'bridesmaids', 'guest', 'wedding_party'] as const) {
    assert.ok((out[key] ?? []).length > 0, `${key} is still absent — the room would fall through`);
  }
  // A TOUCHED role keeps the couple's own colour, exactly as 02 does.
  const touched = resolveDisplayPalette({
    ...rp,
    bride: ['#0B0C0D'],
    touched_roles: ['bride'],
  } as RolePalette);
  assert.deepEqual(touched.bride, ['#0B0C0D']);
  // The majors are never rewritten — the one-directional rule, in the resolver.
  assert.deepEqual(out.reception, MAJORS);
  // No majors → the board is returned unchanged rather than emptied.
  const bare = { bride: ['#123456'] } as RolePalette;
  assert.deepEqual(resolveDisplayPalette(bare), bare);
  // Couple-authored roles are carried across untouched — the engine derives
  // none of them, and inventing one would be worse than the name they typed.
  const custom = resolveDisplayPalette({
    ...rp,
    custom_roles: [{ key: 'ring-bearers-dog', label: "Ring bearer's dog", colors: ['#AABBCC'] }],
  } as RolePalette);
  assert.deepEqual(custom.custom_roles, [
    { key: 'ring-bearers-dog', label: "Ring bearer's dog", colors: ['#AABBCC'] },
  ]);
});

test('neither resolver throws on any seeded board, at any length, in any style', () => {
  /*
    🔑 THIS IS A NEW BLAST RADIUS, NOT A REPEAT OF 02'S. `deriveBoard` used to
    run only on the couple's own mood board. After MB15 it runs on the PUBLIC
    guest walk too, on whatever palette that event happens to hold — and a throw
    there is a white screen for a guest on the day, not a broken editor for one
    couple. `normalizeMajors` throws on an empty list BY DESIGN, so the guard in
    each resolver is load-bearing rather than defensive tidiness.

    Walked at every length the limits allow, because a 1-colour board and a
    5-colour board take different paths through the ladder.

    ⚠ SAMPLED, AND THE NUMBER IS MEASURED. `deriveBoard` builds the whole
    six-rank ladder: ~11 ms a call on an idle machine, and ~50 ms while another
    suite is running — so all 2,600 boards × 3 styles × 6 lengths is ~47,000 of
    them, and the exhaustive version really did run for NINE AND A HALF MINUTES
    in this one file. That is a CI cost nobody would keep, and a test people
    delete is worth less than a smaller one they run.

    What this test is actually for is narrow: does each resolver's own guard stop
    `normalizeMajors` from throwing at every length? Twenty real boards answer
    that. The engine's exhaustive robustness is
    `palette-styles-fuzz-never-throws-or-duplicates.test.ts`'s job, and
    `resolveRoomPalette` — which is ~0.05 ms, a thousandth of the other — is
    walked over all 2,600 × 3 in the diff report above.
  */
  for (const reception of SEEDED.slice(0, 20)) {
    for (const style of STYLES) {
      for (let n = 0; n <= reception.length; n++) {
        const rp = { reception: reception.slice(0, n), palette_style: style } as RolePalette;
        assert.doesNotThrow(() => resolveRoomPalette(rp), `resolveRoomPalette threw at n=${n}`);
        assert.doesNotThrow(() => resolveDisplayPalette(rp), `resolveDisplayPalette threw at n=${n}`);
      }
    }
  }
});

/* ══ 6 · THE CONTRACT DOCUMENT IS A CHECKABLE THING, NOT PROSE ═══════════ */

test('every symbol the contract document names still exists in the tree', () => {
  /*
    MB15's brief asked for the contract to be written down FIRST: every field the
    3D Plan reads, who writes it, what breaks if the shape changes. A document
    nothing checks is the thing this repo's own CLAUDE.md opens by warning about
    — "a handoff is not evidence". So the load-bearing symbols it cites are
    resolved against the tree here, and a rename takes the document with it.

    🔑 SYMBOLS, NOT LINE NUMBERS. The document deliberately cites no line
    numbers; rule 7 in CLAUDE.md is why, and a citation that moved from :1719 to
    :1533 — where the second number was the wrong one — is the worked example.
  */
  const doc = readFileSync(join(ROOT, 'docs', '03-REFERENCE', 'contracts.md'), 'utf8');
  const CITED: ReadonlyArray<[string, string]> = [
    ['resolveRoomPalette', 'lib/room-palette.ts'],
    ['resolveDisplayPalette', 'lib/room-palette.ts'],
    ['resolvePaletteFromRoles', 'lib/seating-3d.ts'],
    ['deriveVenue', 'lib/palette-styles.ts'],
    ['sanitizePaletteStyle', 'lib/mood-board.ts'],
    ['displayColorsFor', 'lib/mood-board-derive.ts'],
    ['resolveAttirePaletteColor', 'lib/mood-board.ts'],
    ['guestAttireColor', 'lib/seating-3d.ts'],
    ['isPartFinalized', 'lib/lock-request-state.ts'],
    ['finalizedPartsNow', 'lib/moodboard-finalization-rows.ts'],
    ['partFinalizationStateOf', 'lib/lock-request-state.ts'],
    ['renderPartById', 'lib/moodboard-render-parts.ts'],
    ['INSPIRATION_SLOT_FOR_PART', 'lib/moodboard-slots.ts'],
    ['ROOM_DRAWN_ATTRIBUTES', 'app/_components/plan3d/venue-decor.tsx'],
    ['primaryOnlyNotice', 'lib/reception-scene.ts'],
    ['venueZoneApplies', 'lib/reception-scene.ts'],
    ['archetypeFor', 'app/_components/plan3d/venue-decor.tsx'],
    ['resolveDecorLayer', 'lib/reception-decor-layers.ts'],
  ];
  for (const [symbol, rel] of CITED) {
    assert.ok(doc.includes(symbol), `the contract no longer names ${symbol}`);
    const src = readFileSync(join(APP, '..', rel), 'utf8');
    assert.ok(
      new RegExp(`\\b(?:function|const|type)\\s+${symbol}\\b`).test(src),
      `the contract cites ${symbol} in ${rel}, where it no longer exists`,
    );
  }
  // The four columns the contract is ABOUT, and the migration behind the freeze.
  for (const anchor of [
    'events.role_palette',
    'events.reception_design',
    'event_inspiration_assets',
    'moodboard_part_finalizations',
    '20271203855754',
    'events_hold_part_finalization_design',
  ]) {
    assert.ok(doc.includes(anchor), `the contract no longer names ${anchor}`);
  }
});
