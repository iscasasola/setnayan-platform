/**
 * Test helper — WHAT THE DATABASE ACCEPTS AS A PHOTO'S SLOT, read from the migrations (no database).
 *
 * Since step ② of PLAN `admin_inspiration_groups_2026-10-25` the two photo gates are no longer IN-lists:
 *   · `event_inspiration_assets.slot_key` is an FK into `inspiration_parts(slot_key)`;
 *   · a supplier_gallery row's `asset_subtype` is held by the trigger `moodboard_library_assets_subtype_is_a_part`.
 * So "the keys the database accepts" = the keys `inspiration_parts` is seeded with (the GENERATED SEED block
 * of migration `…_inspiration_parts_on_the_taxonomy.sql`), provided the gate migration really points both
 * tables there. `tests/db/inspiration-parts-seed-equals-the-consts.db.test.ts` proves the same against a
 * replayed Postgres; this is the fast, source-level half the unit suites lean on.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, '../../../supabase/migrations');
const file = (suffix: string) => {
  const f = readdirSync(DIR).find((n) => n.endsWith(suffix));
  assert.ok(f, `no migration ends with ${suffix}`);
  return readFileSync(join(DIR, f), 'utf8');
};

/** The slot keys `inspiration_parts` is seeded with, in seed order. */
export function seededPartKeys(): string[] {
  const sql = file('_inspiration_parts_on_the_taxonomy.sql');
  const a = sql.indexOf('INSERT INTO public.inspiration_parts');
  const b = sql.indexOf('ON CONFLICT (slot_key) DO NOTHING', a);
  assert.ok(a >= 0 && b > a, 'the inspiration_parts seed block is not there');
  return [...sql.slice(a, b).matchAll(/^\s+\('([a-z_]+)',/gm)].map((m) => m[1]!);
}

/** The gate migration, comments stripped — so a commented-out line cannot pass for the real one. */
export function photoGateSql(): string {
  return file('_inspiration_parts_are_the_photo_keys.sql').replace(/--.*$/gm, '');
}

/**
 * The keys the database accepts on BOTH photo tables — the seeded parts — after asserting that the gate
 * migration really drops the board's IN-list CHECK, adds the FK, and puts the supplier gallery behind the
 * part trigger with no IN-list left in its shape CHECK.
 */
export function dbAcceptedSlotKeys(): string[] {
  const gate = photoGateSql();
  assert.match(gate, /DROP CONSTRAINT IF EXISTS event_inspiration_assets_slot_key_check_v3/);
  assert.match(gate, /FOREIGN KEY \(slot_key\) REFERENCES public\.inspiration_parts\(slot_key\)/);
  assert.match(gate, /CREATE TRIGGER moodboard_library_assets_subtype_is_a_part/);
  const shape = gate.slice(gate.indexOf('ADD CONSTRAINT moodboard_library_assets_supplier_gallery_shape'));
  assert.doesNotMatch(shape.slice(0, shape.indexOf(');')), /asset_subtype/, 'the supplier_gallery_shape CHECK still lists slots');
  return seededPartKeys();
}
