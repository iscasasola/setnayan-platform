/**
 * 🪑 THE SEAT PLAN OPENS FOR GUEST BOOTHS, PERFORMERS AND AV PRODUCTION (owner, 6 Nov 2026).
 *
 * DECISION_LOG 2026-11-06 "SUPPLIER ACCESS MAP (#6407): FOUR OWNER CALLS", call (2): "Seat plan — ADD booths
 * (`guest_booth`), performers (`performers`) and AV/lights (`av_production`) to the seat-plan read."
 * Migration `20271320476390_seat_plan_opens_for_booths_performers_and_av`.
 *
 * This reads the NEWEST migration that defines `public.get_vendor_seat_plan` (comments stripped, so prose
 * cannot pass or fail it) and pins its floor list to exactly the list below — so a later copy of the
 * function that drops one of the three, or quietly adds a fourth, fails here instead of reaching a supplier
 * as `category_not_floor`. It also pins that the three did NOT join the meal-count gate (call (3) keeps meal
 * counts to the food categories).
 *
 * The supplier access map (`lib/supplier-access-by-category.ts`, #6407) mirrors the same list as
 * `SEAT_PLAN_CATEGORIES`, and its own test reads this RPC too: whichever of the two PRs lands second
 * carries the three into that constant.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { VENDOR_CATEGORIES, type VendorCategory } from './vendors';

const MIGRATIONS = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
const FILES = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();

const ADDED_6_NOV: readonly VendorCategory[] = ['guest_booth', 'performers', 'av_production'];

/** Every category `get_vendor_seat_plan` lets onto the floor plan, after the 6 Nov ruling. */
const FLOOR: readonly VendorCategory[] = [
  'venue', 'catering', 'cake_maker', 'mobile_bar', 'photobooth',
  'led_screens', 'lights_and_sound', 'reception_decor', 'florist',
  'photographer', 'videographer', 'host_emcee', 'band_dj',
  'string_quartet', 'choir', 'planner_coordinator',
  'gown_designer', 'suit_designer', 'makeup_artist', 'hair_stylist',
  'security',
  ...ADDED_6_NOV,
];

/** Who gets meal counts per table. Unchanged by the 6 Nov ruling. */
const MEAL_COUNTS: readonly VendorCategory[] = [
  'catering', 'cake_maker', 'mobile_bar', 'venue', 'planner_coordinator',
];

/** The newest body of `public.<fn>`, up to its closing dollar-quote tag, `--` comments stripped. */
function latestBody(fn: string): { file: string; body: string } {
  const head = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\s*\\(`, 'gi');
  for (const file of [...FILES].reverse()) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    const starts = [...sql.matchAll(head)].map((m) => m.index!);
    if (starts.length === 0) continue;
    const from = starts[starts.length - 1]!;
    const tag = sql.slice(from).match(/\bAS\s+(\$[a-z_]*\$)/i);
    assert.ok(tag, `${fn} in ${file} has no dollar-quoted body`);
    const open = from + tag.index! + tag[0].length;
    const end = sql.indexOf(tag[1]!, open);
    assert.ok(end > open, `${fn} in ${file} has no closing ${tag[1]}`);
    return { file, body: sql.slice(from, end).replace(/--[^\n]*/g, '') };
  }
  throw new Error(`no migration defines public.${fn}`);
}

/** The quoted names inside `<anchor> && ARRAY[ ... ]`, sorted. */
function arrayAfter(body: string, anchor: RegExp): string[] {
  const m = body.match(new RegExp(`${anchor.source}\\s*&&\\s*ARRAY\\[([^\\]]*)\\]`, 'i'));
  assert.ok(m, `no ${anchor.source} && ARRAY[...] found`);
  return [...(m[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((x) => x[1]!).sort();
}

const SEAT = latestBody('get_vendor_seat_plan');

test('the three are real supplier categories', () => {
  for (const c of ADDED_6_NOV) assert.ok(VENDOR_CATEGORIES.includes(c), `${c} is not a VendorCategory`);
});

test('the newest get_vendor_seat_plan floor list is exactly the 6 Nov list', () => {
  const floor = arrayAfter(SEAT.body, /v_floor_allowed\s*:=\s*v_booked_categories/);
  assert.deepEqual(floor, [...FLOOR].sort(), `floor list in ${SEAT.file}`);
  for (const c of ADDED_6_NOV) assert.ok(floor.includes(c), `${c} is refused the seat plan in ${SEAT.file}`);
});

test('the three see tables and seats, never meal counts', () => {
  const meals = arrayAfter(SEAT.body, /v_dietary_allowed\s*:=\s*v_booked_categories/);
  assert.deepEqual(meals, [...MEAL_COUNTS].sort(), `meal-count gate in ${SEAT.file}`);
  for (const c of ADDED_6_NOV) assert.ok(!meals.includes(c), `${c} was handed meal counts`);
});

test('a category outside the list is still refused', () => {
  assert.match(SEAT.body, /IF NOT v_floor_allowed THEN\s+RAISE EXCEPTION 'category_not_floor'/);
});
