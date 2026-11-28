/**
 * 🪑 EVERY NEW SEAT-PLAN COLUMN HAS A WRITER AND A READER (seat plan § 6 "each with a writer and a reader";
 * migration 20271365089548). The writers ride routes that already exist (the server-action budget is full):
 *   · Kind ▾ and the table lock → `updateTableLabel`'s route (a form with `table_kind` / `table_locked`, no label);
 *   · the Speakers element and the two ⋯ switches → `saveFloorPlan`, written ONLY when the screen sends them.
 * The readers: `fetchTables` (kind, lock), `fetchFloorPlan` (speakers, switches) — see elders-tables-sit-by-the-door.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { floorPlanRowFrom, seatPlanSettingsFrom } from '@/lib/floor-plan-row';

const from = (o: Record<string, string>) => (k: string) => o[k] ?? null;

test('the settings are read only when the screen sent them, so a stage save never touches them', () => {
  assert.deepEqual(seatPlanSettingsFrom(from({ stage_x: '40' })), {});
  assert.deepEqual(seatPlanSettingsFrom(from({ speakers_enabled: 'true', speakers_x: '120', speakers_y: '-3' })), {
    speakers_enabled: true,
    speakers_x: 100,
    speakers_y: 0,
  });
  assert.deepEqual(seatPlanSettingsFrom(from({ auto_seat_rsvps: 'false', seat_suggestions: 'true' })), {
    auto_seat_rsvps: false,
    seat_suggestions: true,
  });
  assert.deepEqual(seatPlanSettingsFrom(from({ auto_seat_rsvps: 'yes', speakers_x: '5' })), {}, 'a garbled switch or half a position writes nothing');
  assert.ok(!('speakers_enabled' in floorPlanRowFrom(from({}))), 'the whole-row save never carries them');
});

test('Kind ▾ and the table lock are written through the table route, validated, under the seating lock', () => {
  const act = readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'seating', 'actions.ts'), 'utf8');
  assert.match(act, /formData\.has\('table_kind'\) \|\| formData\.has\('table_locked'\)\) && !formData\.has\('table_label'\)/);
  const fn = act.slice(act.indexOf('async function updateTableKindOrLock('), act.indexOf('// Rename a table'));
  assert.match(fn, /raw !== 'regular' && raw !== 'vip' && raw !== 'elders' && raw !== 'spare'\) throw new Error\('Invalid input'\)/);
  assert.match(fn, /patch\.is_vip = raw === 'vip';/, 'is_vip moves in step with the kind');
  assert.match(fn, /patch\.locked = raw === 'true';/);
  assert.match(fn, /await assertSeatingLockHeld\(supabase, eventId, lockIdFrom\(formData\)\);/);
  assert.match(fn, /if \(!data \|\| data\.length === 0\) throw new Error/, 'a refused write is said, never shown as saved');
  const save = act.slice(act.indexOf('export async function saveFloorPlan('), act.indexOf('// Host choice for guest PHOTOS'));
  assert.match(save, /const settings = seatPlanSettingsFrom\(\(k\) => formData\.get\(k\)\);/);
  assert.match(save, /\.update\(\{ \.\.\.settings, updated_at: updatedAt \}\)/);
});
