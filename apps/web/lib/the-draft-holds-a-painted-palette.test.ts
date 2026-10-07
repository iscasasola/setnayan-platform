/**
 * 🎨 THE DRAFT HOLDS A PAINTED PALETTE (controller 2026-10-07, step 4c addition:
 * the Mood Board's picker, ✨ Auto and the part palettes must stop writing live
 * — "Apply publishes").
 *
 * Holds: `role_palette` in the draft accepts a board the couple PAINTED, through
 * the Mood Board's own sanitizer — every colour a validated hex — while a
 * theme's seed keeps its own fill rule; the host's canvas wears the painted
 * board whole; it is compared as the Mood Board reads it, never Pro, and never
 * held back with a refused Pro theme (only a theme's FILL shares its fate);
 * Apply writes it through the Mood Board's own write shape.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eventColumnChange, eventItemIsPro, overlayHubDraftEvent, sanitizeHubDraftEventValue } from './hub-draft';
import { themeSeedPalette } from './mood-board-palette-set';

const ROOT = join(__dirname, '..');
const PAINTED = { reception: ['#102030', '#F7F2EC', '#C9A86A', '#FBFAF7', '#7A8B6F'], room_dressing: { chairs: '#ABCDEF' } };

test('a painted board is held, validated by the Mood Board’s own sanitizer', () => {
  const held = sanitizeHubDraftEventValue('role_palette', PAINTED) as Record<string, unknown>;
  assert.deepEqual(held.reception, PAINTED.reception);
  assert.deepEqual(held.room_dressing, { chairs: '#ABCDEF' });
  const dirty = sanitizeHubDraftEventValue('role_palette', { reception: ['#102030', 'red', 'javascript:x'] }) as Record<string, unknown>;
  assert.deepEqual(dirty.reception, ['#102030'], 'a non-hex is dropped, never kept');
  assert.equal(sanitizeHubDraftEventValue('role_palette', { reception: ['nope'] }), undefined, 'a board with no colour is not a palette');
  assert.deepEqual(sanitizeHubDraftEventValue('role_palette', themeSeedPalette('cyber')), themeSeedPalette('cyber'), 'a theme seed keeps its own rule');
});

test('the canvas wears it whole; compared as the Mood Board reads it; never Pro', () => {
  const live = { reception: ['#111111', '#222222', '#333333', '#444444', '#555555'], groom: ['#000000'] };
  const row = overlayHubDraftEvent({ role_palette: live, invite_theme: 'house' } as Record<string, unknown>, { events: { role_palette: PAINTED }, widgets: {} });
  assert.deepEqual((row.role_palette as { reception: string[] }).reception, PAINTED.reception);
  assert.equal(eventColumnChange('role_palette', live, PAINTED), 'change', 'a painted board over a couple’s own board still counts');
  assert.equal(eventColumnChange('role_palette', PAINTED, { ...PAINTED }), 'none');
  assert.equal(eventItemIsPro('role_palette', PAINTED, 'change'), false);
});

test('only a theme’s FILL shares a refused theme’s fate; Apply writes a painted board the Mood Board’s way', () => {
  assert.match(read('lib/hub-draft.ts'), /i\.column === 'role_palette' && Boolean\(sanitizeSeedPalette\(i\.value\)\)/);
  const act = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(act, /\.update\(\{ role_palette: painted, mood_board_updated_at: new Date\(\)\.toISOString\(\) \}\)/);
});

function read(p: string) {
  return readFileSync(join(ROOT, p), 'utf8');
}
