/**
 * 💐 BRIDAL BOUQUET AND CENTREPIECES HAVE A SLOT (controller 2026-10-07, step 4c
 * addition; DECISION_LOG 2026-10-06 "MOOD BOARD PARTS ADDED … BRIDAL BOUQUET …
 * CENTREPIECES").
 *
 * Holds: the step-4c migration widens BOTH slot gates — the board's
 * (`event_inspiration_assets_slot_key_check_v3`, same name) and the supplier
 * gallery's (`moodboard_library_assets_supplier_gallery_shape`) — keeping EVERY
 * value the latest definitions held, and adding exactly the two.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
const sql = (suffix: string) => readFileSync(join(DIR, readdirSync(DIR).find((f) => f.endsWith(suffix))!), 'utf8');
const list = (src: string, after: string) => {
  const at = src.lastIndexOf(after);
  assert.ok(at >= 0, `${after} not found`);
  const m = src.slice(at).match(/IN \(([\s\S]*?)\)/);
  return m![1]!.split(',').map((v) => v.trim().replace(/'/g, '')).filter(Boolean);
};

test('both slot gates keep every value and add exactly the two', () => {
  const ours = sql('_studio_missing_fields.sql');
  const boardBefore = list(sql('_moodboard_inspiration_slot_cake.sql'), 'ADD CONSTRAINT event_inspiration_assets_slot_key_check_v3');
  const boardNow = list(ours, 'ADD CONSTRAINT event_inspiration_assets_slot_key_check_v3');
  assert.deepEqual(boardNow, [...boardBefore, 'bridal_bouquet', 'centrepieces']);
  const galleryBefore = list(sql('_moodboard_supplier_gallery_chain.sql'), 'ADD CONSTRAINT moodboard_library_assets_supplier_gallery_shape');
  const galleryNow = list(ours, 'ADD CONSTRAINT moodboard_library_assets_supplier_gallery_shape');
  assert.deepEqual(galleryNow, [...galleryBefore, 'bridal_bouquet', 'centrepieces']);
});
