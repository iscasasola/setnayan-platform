/**
 * the-palette-holds-the-boards.test.ts — PALETTE AND INSPIRATION ARE ONE LIST (owner 2026-10-19, DECISION_LOG "APPROVED —
 * PALETTE + INSPIRATION AS ONE LIST", prototype `prototypes/palette_inspiration_one_list_2026-10-19.html`; the owner's
 * answers to its three open points: *"1. yes all circles  2. yes  3. yes"*).
 *
 *   1 · every part (the room, the flowers, the cake) has a colour of its own to set, follows the main colour it says it
 *       follows until set — and the room's resolver agrees with the row, part by part;
 *   2 · every part has its own photos (a stored slot), Cake included; Venue & decor feeds Your main palette; every
 *       non-attire board in the Studio is drawn EXACTLY once (nothing lost, nothing twice) — Flowers (every flower at
 *       once) only where an event already holds its photos;
 *   3 · the app's slot list is the migration's, and the migration only widens two CHECKs;
 *   4 · drawn: the Palette is the prototype's list — the upload bar, the five as circles with their slot word and name,
 *       then one Attire-shaped block per part with its photos line; no Inspiration section; a part's photos offer
 *       "Use for <part>" and set nothing until tapped.
 *
 * Sabotaged, seen red, restored (see the commit): a part's field dropped → 1 · Ceiling's board unmapped → 2 · a key
 * missing from the migration → 3 · the Inspiration tab back → 4.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CAKE_LANE_PARTS, FLORIST_LANE_PARTS, MAIN_COLOUR_SLOTS, ROOM_LANE_PARTS, lanePartColour } from './colour-access';
import { resolveRoomDressing, type RolePalette } from './mood-board';
import { LEGACY_PALETTE_BOARDS, MAIN_PALETTE_BOARD, STUDIO_INSPIRATION_SLOTS, paletteBoardOf, paletteUploadBoards } from './inspiration-slots';
import { MOODBOARD_SLOT_KEYS } from './moodboard-slots';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request === 'next/navigation') return { ...load.call(this, request, ...rest), useRouter: () => ({ refresh() {}, push() {}, replace() {}, prefetch() {}, back() {}, forward() {} }) };
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');
const PARTS = [...ROOM_LANE_PARTS, ...FLORIST_LANE_PARTS, ...CAKE_LANE_PARTS];
const FIVE = ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F'];

test('1 · every part has its own colour, follows its main colour until set, and the room agrees with the row', () => {
  assert.deepEqual(CAKE_LANE_PARTS.map((p) => p.label), ['Cake'], 'Cake has no part of its own');
  const fields = PARTS.map((p) => p.field);
  for (const p of PARTS) assert.ok(p.field, `${p.label} has no colour of its own (owner: "yes all circles")`);
  assert.equal(new Set(fields).size, fields.length, 'two parts store one colour');
  const room = resolveRoomDressing({ reception: FIVE });
  for (const p of PARTS) {
    const c = lanePartColour(p, FIVE, { reception: FIVE });
    assert.equal(c.setByYou, false, `${p.label} is set before anyone set it`);
    assert.equal(c.hex, FIVE[p.follows], `${p.label} does not wear ${MAIN_COLOUR_SLOTS[p.follows]}`);
    assert.equal(room[p.field!], c.hex, `${p.label}: the row follows ${MAIN_COLOUR_SLOTS[p.follows]} but the room draws another colour`);
    /* Set it: the row says so, the room draws it, and nothing else moves. */
    const set: RolePalette = { reception: FIVE, room_dressing: { [p.field!]: '#0A0B0C' } };
    assert.deepEqual(lanePartColour(p, FIVE, set), { hex: '#0A0B0C', setByYou: true, followsLabel: MAIN_COLOUR_SLOTS[p.follows] });
    const after = resolveRoomDressing(set);
    for (const q of PARTS) assert.equal(after[q.field!], q === p ? '#0A0B0C' : room[q.field!], `setting ${p.label} moved ${q.label}`);
  }
});

test('2 · every part has its own photos; Venue & decor feeds the main palette; every board is drawn exactly once', () => {
  for (const p of PARTS) {
    const b = paletteBoardOf(p.field);
    assert.ok(b, `${p.label} has no photos line (owner: "2. yes")`);
    assert.ok((MOODBOARD_SLOT_KEYS as readonly string[]).includes(b!.slotKey), `${p.label} → ${b!.slotKey} is not a stored slot`);
  }
  const placed = [MAIN_PALETTE_BOARD, ...LEGACY_PALETTE_BOARDS, ...PARTS.map((p) => paletteBoardOf(p.field)!.slotKey)];
  const boards = STUDIO_INSPIRATION_SLOTS.filter((s) => !s.attire).map((s) => s.slotKey);
  assert.deepEqual([...placed].sort(), [...boards].sort(), 'a non-attire board is drawn twice, or not at all (its photos would be lost)');
  /* A new photo goes only where a block draws it — never to the Flowers board, which has no part. */
  const upload = paletteUploadBoards().map((s) => s.slotKey);
  for (const k of LEGACY_PALETTE_BOARDS) assert.ok(!upload.includes(k), `${k} still takes a new photo`);
  assert.deepEqual([...upload].sort(), [...placed.filter((k) => !LEGACY_PALETTE_BOARDS.includes(k))].sort());
});

test('3 · the app’s slot list is the latest migration’s, which only widens the two gates', () => {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  const latest = files.filter((f) => /event_inspiration_assets_slot_key_check_v3/.test(readFileSync(join(MIGRATIONS, f), 'utf8').replace(/--.*$/gm, ''))).pop()!;
  assert.match(latest, /_palette_parts_five_more_slots\.sql$/, `the latest re-listing of the slot gate is ${latest} — point this test at it`);
  const body = readFileSync(join(MIGRATIONS, latest), 'utf8').replace(/--.*$/gm, '');
  for (const gate of ['ADD CONSTRAINT event_inspiration_assets_slot_key_check_v3', 'ADD CONSTRAINT moodboard_library_assets_supplier_gallery_shape']) {
    const at = body.indexOf(gate);
    assert.ok(at > 0, `${gate} is not re-listed`);
    const open = body.indexOf('IN (', at) + 4;
    const list = [...body.slice(open, body.indexOf(')', open)).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    assert.deepEqual([...list].sort(), [...MOODBOARD_SLOT_KEYS].sort(), `${gate}: the app and the database disagree`);
  }
  assert.equal((body.match(/DROP CONSTRAINT IF EXISTS/g) ?? []).length, 2, 'not idempotent');
  assert.doesNotMatch(body, /\b(?:UPDATE|DELETE|INSERT|TRUNCATE|DROP TABLE|DROP COLUMN|ADD COLUMN|CREATE TABLE|GRANT|REVOKE|CREATE POLICY)\b/, 'the migration does more than widen two CHECKs');
});

test('4 · drawn: the prototype’s one list — the five as circles, a block per part with its photos, no Inspiration section', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MoodBoardStudio } = await import('../app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio');
  const GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  const html = renderToStaticMarkup(
    React.createElement(MoodBoardStudio as React.ComponentType<Record<string, unknown>>, {
      eventId: 'E1',
      palette: { reception: FIVE },
      fallbackFive: FIVE,
      frozenDressing: [],
      changes: [],
      attire: [],
      dressConfig: { roles: {} },
      attireStyles: [],
      inspirations: [
        { slot_key: 'table', slot_position: 1, image_url: GIF, credit: null, swatches: ['#4F7D2A', '#8FBF5E'] },
        { slot_key: 'stage', slot_position: 1, image_url: GIF, credit: 'Bloom & Vine · Stylist / Decorator', swatches: ['#5C0700'] },
      ],
      autoThemes: [],
      regions: [],
      dosLists: null,
      startTab: 'colours',
    }),
  );
  assert.doesNotMatch(html, /data-mood-board-tab="insp"|Inspiration</, 'the Inspiration section is back');
  assert.match(html, /data-mood-board-upload=""/, 'the upload bar is gone from the top');
  for (let i = 0; i < 5; i++) assert.match(html, new RegExp(`data-mood-board-colour="main-${i}"><button[\\s\\S]*?data-mood-board-dot-slot="${MAIN_COLOUR_SLOTS[i]}"`), `the five’s ${MAIN_COLOUR_SLOTS[i]} is not the circle with its slot word`);
  const blocks = [...html.matchAll(/<section[^>]*data-mood-board-part="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'));
  assert.deepEqual(blocks, PARTS.map((p) => p.label), 'the blocks are not every part, once, in the lanes’ order');
  for (const p of PARTS) {
    const at = html.indexOf(`data-mood-board-part="${p.label.replace(/&/g, '&amp;')}"`);
    const block = html.slice(at, html.indexOf('</section>', at));
    assert.match(block, /<h3 class="font-serif text-\[21px\] font-medium leading-tight text-ink">/, `${p.label}: not the Attire block’s heading`);
    assert.match(block, /Follows (?:Dominant|Supporting|Accent|Neutral|Accent 2)</, `${p.label}: no "Follows" line`);
    assert.match(block, /<button[^>]*data-mood-board-role-colour=/, `${p.label}: its circle cannot be changed`);
    assert.match(block, /data-mood-board-slot="[a-z_]+"[\s\S]*?(?:No photos yet|\d photos?)/, `${p.label}: no photos line`);
    assert.doesNotMatch(block.replace(/<[^>]*>/g, ' '), /#[0-9A-Fa-f]{6}\b/, `${p.label}: a colour code is written`);
  }
  /* Frame 3: a part's photos offer their colour for THAT part; a part with none offers nothing. */
  assert.match(html, /data-mood-board-use-slot="table"[^>]*><button[\s\S]*?Use for Table linens/, 'Table linens’ photos do not offer their colour');
  assert.doesNotMatch(html, /data-mood-board-use-slot="ceiling"/, 'a part with no photos offers a colour');
  const src = readFileSync(join(WEB, 'app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx'), 'utf8');
  assert.match(src, /use: \(colours\) => colours\[0\] && commit\(withPartColour\(palette, field, colours\[0\]\), `\$\{p\.label\} set\.`\)/, 'the offer does not set that part through the one undoable commit');
});
