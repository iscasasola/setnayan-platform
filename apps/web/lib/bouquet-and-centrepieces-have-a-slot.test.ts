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
import { MOODBOARD_SLOT_KEYS } from './moodboard-slots';
import { MOODBOARD_SLOT_TRADES } from './moodboard-gallery';
import { AWAITING_A_SLOT, STUDIO_INSPIRATION_SLOTS } from './inspiration-slots';

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

test('the app carries them: the vocabulary, their trades, a Studio card and a board tile each', () => {
  for (const k of ['bridal_bouquet', 'centrepieces'] as const) {
    assert.ok((MOODBOARD_SLOT_KEYS as readonly string[]).includes(k), `${k} is not in MOODBOARD_SLOT_KEYS`);
    assert.ok(MOODBOARD_SLOT_TRADES[k].length > 0, `${k} has no supplying trade`);
    assert.ok(STUDIO_INSPIRATION_SLOTS.some((s) => s.slotKey === k), `${k} has no Studio card`);
  }
  assert.deepEqual([...MOODBOARD_SLOT_TRADES.bridal_bouquet], ['florist']);
  assert.deepEqual([...MOODBOARD_SLOT_TRADES.centrepieces], ['florist', 'stylist_decorator', 'catering']);
  /* The two are no longer waiting (the owner's attire boards wait there since 2026-10-08). */
  assert.ok(!AWAITING_A_SLOT.some((a) => ['Bridal bouquet', 'Centrepieces'].includes(a.label)), 'a part with a slot still waits for one');
  const board = readFileSync(join(__dirname, '../app/dashboard/[eventId]/studio/mood-board/_components/inspiration-board.tsx'), 'utf8');
  assert.match(board, /\{ k: 'bridal_bouquet', label: 'Bridal bouquet' \}/);
  assert.match(board, /\{ k: 'centrepieces', label: 'Centrepieces' \}/);
  // …and the app list is exactly the DB's list (the three gates agree).
  const ours = sql('_studio_missing_fields.sql');
  assert.deepEqual([...list(ours, 'ADD CONSTRAINT event_inspiration_assets_slot_key_check_v3')].sort(), [...MOODBOARD_SLOT_KEYS].sort());
});
