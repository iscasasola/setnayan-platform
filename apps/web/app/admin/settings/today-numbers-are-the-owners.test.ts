/**
 * 🔒 TODAY'S FIVE NUMBERS ARE THE OWNER'S (Today v3 part 5 — owner 19 Nov 2026, "Yes, all your picks"; DECISION_LOG
 * 2026-11-19 "TODAY v3 RULED AS A WHOLE" — "The five numbers · each an admin setting").
 *   1 · each of the five is a field on Admin › Settings, locked when the row could not be read;
 *   2 · the save takes each one, blank = not set, with its own range;
 *   3 · the ruled values fill a field only where it is still blank — an admin's number is never overwritten.
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-19): a field removed from the surface (red: 1) · COALESCE dropped
 *   from the seed (red: 3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const SURFACE = readFileSync(join(root, 'app/admin/settings/_surfaces/settings-surface.tsx'), 'utf8');
const ACTION = readFileSync(join(root, 'app/admin/settings/actions.ts'), 'utf8');
const MIG_DIR = join(root, '../../supabase/migrations');
const SEED = readFileSync(join(MIG_DIR, readdirSync(MIG_DIR).find((f) => f.endsWith('_today_admin_windows.sql'))!), 'utf8');
const FIVE = ['grow_few_inquiries_28d', 'grow_few_bookings_month', 'story_photo_silence_days', 'today_soon_ask_hours', 'today_soon_event_days'];

test('1 · each number is a field, locked when unread', () => {
  for (const f of FIVE) {
    assert.match(SURFACE, new RegExp(`id="${f}"\\s+name="${f}"[\\s\\S]{0,160}disabled=\\{!growLines\\.read\\}`), `${f} is not an admin field (or is not locked when unread)`);
  }
});

test('2 · the save takes each one, with its range', () => {
  for (const f of FIVE) assert.match(ACTION, new RegExp(`\\['${f}', '[^']+', \\d+\\]`), `${f} is not saved`);
});

test('3 · the ruled values fill only blanks', () => {
  for (const [f, v] of [['grow_few_inquiries_28d', 3], ['grow_few_bookings_month', 1], ['story_photo_silence_days', 7], ['today_soon_ask_hours', 24], ['today_soon_event_days', 7]] as const) {
    assert.match(SEED, new RegExp(`${f}\\s*= COALESCE\\(${f}, ${v}\\)`), `${f} is not seeded with its ruled ${v} only where blank`);
  }
});
