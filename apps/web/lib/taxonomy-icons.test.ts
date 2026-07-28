/**
 * Icon-coverage guard for the Explore bench + the /explore folder strip.
 *
 * WHY THIS EXISTS (2026-07-28): the bench now draws an icon on EVERY folder row
 * and EVERY leaf row. Production has only WEDDING events today
 * (`project_setnayan_prod_is_prelaunch_empty`), so a category that resolves to
 * no icon on a debut / christening / corporate / travel / tournament event
 * would ship silently and nobody would see it — there is no live page to look
 * at. This file is the substitute for that missing pair of eyes.
 *
 * The guarantee it locks, in two halves:
 *
 *   (A) EXHAUSTIVE over the taxonomy. `WEDDING_TILE_ICON` / `WEDDING_FOLDER_ICON`
 *       are `Record<WeddingTile|WeddingFolder, LucideIcon>` with no index
 *       signature, so a NEW tile or folder is already a COMPILE error until it
 *       gets an icon. These tests are the runtime half of that same fence —
 *       they catch a map that was widened to `Partial<>`/`string` in a refactor,
 *       which would silently re-open the hole.
 *
 *   (B) TOTAL as functions. `tileIcon()` / `folderIcon()` must return a real
 *       component for ANY string, because the bench can render from a DB-driven
 *       `TaxonomySnapshot` (`lib/taxonomy-snapshot.ts`) whose tile ids come from
 *       `service_categories` rows, NOT from the TypeScript union. An admin
 *       adding a category in the Taxonomy Studio must never produce a blank row.
 *
 * Note on scope: `WeddingTile` / `WeddingFolder` are LEGACY NAMES for the FULL
 * cross-event taxonomy, not the wedding subset — the unions already carry the
 * non-wedding families (`experience`, `dining`, `logistics_safety`,
 * `insurance`, `specialty`; `tour_activity`, `event_medic`,
 * `restaurant_reservation`, `reveal_element`, the three insurance leaves, …).
 * Per-event-type scoping happens in `buildShortlistFolders` via
 * `passesEventTypeFilter`, which only ever REMOVES tiles from that union. So
 * exhaustiveness over the union is strictly stronger than per-type coverage —
 * the per-type test below states that explicitly rather than leaving it implied.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TILE_PARENT, WEDDING_FOLDER_ORDER, WEDDING_TILE_ORDER } from './taxonomy';
import { passesEventTypeFilter } from './taxonomy-filters';
import { ANCHOR_BY_TYPE } from './event-anchor';
import {
  WEDDING_FOLDER_ICON,
  WEDDING_TILE_ICON,
  folderIcon,
  tileIcon,
} from './taxonomy-icons';

/** The canonical CODE roster of event types — the same one
 *  `event-type-coverage.test.ts` treats as authoritative. */
const EVENT_TYPE_ROSTER = Object.keys(ANCHOR_BY_TYPE);

test('every taxonomy FOLDER has a Lucide icon (no iconless folder row)', () => {
  const missing = WEDDING_FOLDER_ORDER.filter((f) => !WEDDING_FOLDER_ICON[f]);
  assert.deepEqual(
    missing,
    [],
    `folders with no icon (their bench row would render blank): ${missing.join(', ')}`,
  );
});

test('every taxonomy TILE has a Lucide icon (no iconless leaf row)', () => {
  const missing = WEDDING_TILE_ORDER.filter((t) => !WEDDING_TILE_ICON[t]);
  assert.deepEqual(
    missing,
    [],
    `tiles with no icon (their bench row would render blank): ${missing.join(', ')}`,
  );
});

test('the icon maps cover the taxonomy exactly — no orphan keys', () => {
  // Guards the other direction: a tile renamed in taxonomy.ts but left behind
  // in the icon map is dead weight that hides the fact the NEW name has none.
  const tileOrder = new Set<string>(WEDDING_TILE_ORDER);
  const orphanTiles = Object.keys(WEDDING_TILE_ICON).filter((k) => !tileOrder.has(k));
  assert.deepEqual(orphanTiles, [], `icon keys not in WEDDING_TILE_ORDER: ${orphanTiles.join(', ')}`);

  const folderOrder = new Set<string>(WEDDING_FOLDER_ORDER);
  const orphanFolders = Object.keys(WEDDING_FOLDER_ICON).filter((k) => !folderOrder.has(k));
  assert.deepEqual(
    orphanFolders,
    [],
    `icon keys not in WEDDING_FOLDER_ORDER: ${orphanFolders.join(', ')}`,
  );
});

test('EVERY event type renders an icon on every row it can show', () => {
  // Walks the roster explicitly rather than trusting the union argument on
  // paper. `applicableEventTypes` is the tile's `applicable_event_types`; the
  // constant taxonomy leaves it null, which `passesEventTypeFilter` treats as
  // UNIVERSAL (fail-open), so every type sees the full union here. A future
  // taxonomy that narrows a tile to certain types only ever REMOVES rows — it
  // can never introduce one this loop has not already asserted an icon for.
  assert.ok(EVENT_TYPE_ROSTER.length > 1, 'event-type roster should not be empty');

  const iconless: string[] = [];
  for (const eventType of EVENT_TYPE_ROSTER) {
    for (const tile of WEDDING_TILE_ORDER) {
      if (!passesEventTypeFilter(null, eventType)) continue;
      if (!tileIcon(tile)) iconless.push(`${eventType}/tile:${tile}`);
      const folder = TILE_PARENT[tile];
      if (!folder || !folderIcon(folder)) iconless.push(`${eventType}/folder:${folder}`);
    }
  }
  assert.deepEqual(
    iconless,
    [],
    `rows that would render with no icon on a non-wedding event: ${iconless.join(', ')}`,
  );
});

test('every tile maps to a folder that exists (no row under a phantom parent)', () => {
  const folders = new Set<string>(WEDDING_FOLDER_ORDER);
  const orphans = WEDDING_TILE_ORDER.filter((t) => !folders.has(TILE_PARENT[t]));
  assert.deepEqual(orphans, [], `tiles whose TILE_PARENT is not a real folder: ${orphans.join(', ')}`);
});

test('the resolvers are TOTAL — an admin-authored DB category never blanks a row', () => {
  // The DB-driven `TaxonomySnapshot` path can hand the bench ids that are not
  // in the TypeScript union at all. Those must fall back, never return undefined.
  for (const unknown of ['', 'not_a_real_tile', 'brand_new_admin_category', 'ZZZ']) {
    assert.ok(tileIcon(unknown), `tileIcon(${JSON.stringify(unknown)}) returned nothing`);
    assert.ok(folderIcon(unknown), `folderIcon(${JSON.stringify(unknown)}) returned nothing`);
  }
});
