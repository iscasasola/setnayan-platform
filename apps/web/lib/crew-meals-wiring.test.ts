/**
 * Regression guard for the Crew-Meal Provider Marketplace wiring (shipped
 * 2026-07-08 across repo PRs #2868/#2870/#2878/#2881). The feature spans THREE
 * vocabularies — the legacy `VendorCategory` (`crew_meals`), the plan-group id
 * (`crew_meals`), and the taxonomy tile/canonical (`crew_meals` / `crew_meal_supply`)
 * — bridged by six separate maps. Nothing else asserts they stay in lockstep, so
 * a future edit to any one map could silently make crew-meal vendors
 * undiscoverable or mis-priced. These tests pin the load-bearing links.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PLAN_GROUPS } from './wedding-plan-groups';
import { TILE_PARENT, WEDDING_TILE_LABEL, TAXONOMY_MAP } from './taxonomy';
import { canonicalServicesForTile } from './vendor-counts';
import { VENDOR_CATEGORIES, VENDOR_CATEGORY_LABEL, serviceGroupOf } from './vendors';
import {
  VENDOR_CATEGORY_CANONICAL,
  tilesForVendorCategory,
} from './vendor-category-taxonomy';

// ── The taxonomy tile + canonical exist and are bridged ──────────────────────

test('crew_meals tile lives under Feast with a Crew Meals label', () => {
  assert.equal(TILE_PARENT.crew_meals, 'feast');
  assert.equal(WEDDING_TILE_LABEL.crew_meals, 'Crew Meals');
});

test('crew_meal_supply canonical maps to the crew_meals tile under Feast', () => {
  const e = TAXONOMY_MAP.crew_meal_supply;
  assert.ok(e, 'crew_meal_supply must exist in TAXONOMY_MAP');
  assert.equal(e.folder, 'feast');
  assert.equal(e.tile, 'crew_meals');
});

// ── THE load-bearing discovery link ──────────────────────────────────────────
// The couple's nearby-search resolves the plan group's tile/subcategoryHint to a
// canonical, then matches vendors whose `services` array overlaps it. If this
// chain breaks, couples can never find crew-meal vendors.

test('the crew_meals plan group resolves to the crew_meal_supply canonical', () => {
  const g = PLAN_GROUPS.find((p) => p.id === 'crew_meals');
  assert.ok(g, 'a crew_meals plan group must exist');
  assert.equal(g.catalogFolder, 'feast');
  assert.equal(g.catalogTile, 'crew_meals');
  assert.equal(g.subcategoryHint, 'crew_meal_supply');
  assert.equal(g.tier, 'extras');
  assert.ok(
    g.categories.includes('crew_meals'),
    'the group must bucket the crew_meals VendorCategory',
  );
  // The tile the group points at must actually contain the canonical discovery
  // matches on — the exact link that surfaces crew-meal vendors by proximity.
  assert.ok(
    canonicalServicesForTile(g.catalogTile!).includes('crew_meal_supply'),
    'crew_meals tile must expose the crew_meal_supply canonical',
  );
});

// ── The legacy VendorCategory is fully wired ─────────────────────────────────

test('crew_meals is a first-class VendorCategory', () => {
  assert.ok(VENDOR_CATEGORIES.includes('crew_meals'));
  assert.equal(VENDOR_CATEGORY_LABEL.crew_meals, 'Crew Meals');
  // Must resolve to a service group (else serviceGroupOf returns undefined and
  // the couple's grouped vendor views drop it).
  assert.equal(serviceGroupOf('crew_meals'), 'reception');
});

test('the crew_meals VendorCategory bridges to the crew_meals tile', () => {
  const m = VENDOR_CATEGORY_CANONICAL.crew_meals;
  assert.deepEqual(m, { kind: 'tile', tile: 'crew_meals' });
  assert.ok(tilesForVendorCategory('crew_meals').includes('crew_meals'));
});
