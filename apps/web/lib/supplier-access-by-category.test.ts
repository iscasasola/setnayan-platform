/**
 * The supplier access words must never promise more — or less — than the RPCs
 * hand over. `supplier-access-by-category.ts` is display only; these checks read
 * the LATEST migration that defines each RPC and fail when the words drift
 * from what the database enforces.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  MEAL_COUNT_CATEGORIES,
  SEAT_PLAN_CATEGORIES,
  SUPPLIER_ACCESS_AREAS,
  SUPPLIER_ACCESS_BY_PARENT,
  SUPPLIER_ACCESS_LEVELS,
  supplierAccessFor,
  supplierAccessWords,
  type SupplierAccessArea,
} from './supplier-access-by-category';
import { parentsOfCategory } from './vendor-category-parents';
import { WEDDING_FOLDER_ORDER, type WeddingFolder } from './taxonomy';
import { VENDOR_CATEGORIES, type VendorCategory } from './vendors';

const WEB = join(import.meta.dirname, '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');
const FILES = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();

/**
 * The newest definition of `public.<fn>`, up to its closing dollar-quote tag
 * (`$$` or `$function$`), with `--` comments stripped so prose cannot pass or
 * fail a check.
 */
function latestBody(fn: string): string {
  const head = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\s*\\(`, 'gi');
  for (const file of [...FILES].reverse()) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    const starts = [...sql.matchAll(head)].map((m) => m.index!);
    if (starts.length === 0) continue;
    const from = starts[starts.length - 1]!;
    const tag = sql.slice(from).match(/\bAS\s+(\$[a-z_]*\$)/i);
    assert.ok(tag, `${fn} in ${file} has no dollar-quoted body`);
    const open = from + tag.index! + tag[0].length;
    const close = tag[1]!;
    const end = sql.indexOf(close, open);
    assert.ok(end > open, `${fn} in ${file} has no closing ${close}`);
    return sql.slice(from, end).replace(/--[^\n]*/g, '');
  }
  throw new Error(`no migration defines public.${fn}`);
}

/** The quoted names inside `<anchor> && ARRAY[ ... ]`. */
function arrayAfter(body: string, anchor: RegExp): string[] {
  const m = body.match(new RegExp(`${anchor.source}\\s*&&\\s*ARRAY\\[([^\\]]*)\\]`, 'i'));
  assert.ok(m, `no ${anchor} && ARRAY[...] found`);
  return [...(m[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((x) => x[1]!).sort();
}

const has = (c: VendorCategory, area: SupplierAccessArea) =>
  supplierAccessFor(c).some((r) => r.area === area);

const BRIEF = latestBody('get_vendor_event_brief');
const SEAT = latestBody('get_vendor_seat_plan');

test('every parent family has an entry', () => {
  for (const parent of WEDDING_FOLDER_ORDER) {
    assert.ok(parent in SUPPLIER_ACCESS_BY_PARENT, `${parent} has no entry`);
    assert.ok(SUPPLIER_ACCESS_BY_PARENT[parent].length > 0, `${parent} is empty without a reason`);
  }
  for (const c of VENDOR_CATEGORIES)
    for (const p of parentsOfCategory(c))
      assert.ok(p in SUPPLIER_ACCESS_BY_PARENT, `${c} → ${p} has no entry`);
});

test('areas and levels are a closed set', () => {
  const areas = new Set<string>(SUPPLIER_ACCESS_AREAS);
  const levels = new Set<string>(SUPPLIER_ACCESS_LEVELS);
  assert.equal(areas.size, 9);
  assert.deepEqual([...levels], ['view', 'edit']);
  const rows = [
    ...Object.values(SUPPLIER_ACCESS_BY_PARENT).flat(),
    ...VENDOR_CATEGORIES.flatMap((c) => supplierAccessFor(c)),
  ];
  for (const r of rows) {
    assert.ok(areas.has(r.area), `unknown area ${r.area}`);
    assert.ok(levels.has(r.level), `unknown level ${r.level}`);
  }
  for (const parent of Object.keys(SUPPLIER_ACCESS_BY_PARENT) as WeddingFolder[]) {
    const seen = SUPPLIER_ACCESS_BY_PARENT[parent].map((r) => r.area);
    assert.equal(new Set(seen).size, seen.length, `${parent} lists an area twice`);
  }
});

// ── One assertion per RPC-backed fact ──────────────────────────────────────

test('RPC: get_vendor_seat_plan floor list = who is shown Seat plan', () => {
  assert.deepEqual(arrayAfter(SEAT, /v_floor_allowed\s*:=\s*v_booked_categories/), [...SEAT_PLAN_CATEGORIES].sort());
  for (const c of VENDOR_CATEGORIES)
    assert.equal(has(c, 'Seat plan'), SEAT_PLAN_CATEGORIES.includes(c), `Seat plan for ${c}`);
});

test('RPC: the meal-count gate (brief + seat plan) = who is shown Guest list counts', () => {
  const want = [...MEAL_COUNT_CATEGORIES].sort();
  assert.deepEqual(arrayAfter(BRIEF, /v_my_categories/), want);
  assert.deepEqual(arrayAfter(SEAT, /v_dietary_allowed\s*:=\s*v_booked_categories/), want);
  for (const c of VENDOR_CATEGORIES)
    assert.equal(has(c, 'Guest list'), MEAL_COUNT_CATEGORIES.includes(c), `Guest list for ${c}`);
});

test('RPC: the brief timeline has no category gate → Schedule for every supplier', () => {
  const timeline = BRIEF.slice(BRIEF.indexOf('INTO v_timeline'), BRIEF.indexOf('INTO v_seat_plan'));
  assert.match(timeline, /event_schedule_blocks/);
  assert.doesNotMatch(timeline, /categor/i);
  for (const c of VENDOR_CATEGORIES) assert.ok(has(c, 'Schedule'), `Schedule for ${c}`);
});

test('RLS: the booked-supplier timeline read has no category gate', () => {
  const file = [...FILES].reverse().find((f) =>
    /CREATE POLICY event_schedule_blocks_booked_vendor_read/.test(readFileSync(join(MIGRATIONS, f), 'utf8')));
  assert.ok(file, 'no booked-supplier timeline policy');
  const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
  const from = sql.lastIndexOf('CREATE POLICY event_schedule_blocks_booked_vendor_read');
  const policy = sql.slice(from, sql.indexOf(';', from));
  assert.match(policy, /current_vendor_booked_event_ids/);
  assert.doesNotMatch(policy, /categor/i);
});

test('RPC: the brief roster has no category gate → Suppliers for every supplier', () => {
  const roster = BRIEF.slice(BRIEF.indexOf('INTO v_vendor_roster'), BRIEF.indexOf('v_payload := jsonb_build_object'));
  assert.doesNotMatch(roster, /v_my_categories|v_booked_categories/);
  for (const c of VENDOR_CATEGORIES) assert.ok(has(c, 'Suppliers'), `Suppliers for ${c}`);
});

test('RPC: get_vendor_mood_board has no category gate → Mood Board for every supplier', () => {
  assert.doesNotMatch(latestBody('get_vendor_mood_board'), /categor/i);
  for (const c of VENDOR_CATEGORIES) assert.ok(has(c, 'Mood Board'), `Mood Board for ${c}`);
});

test('RPC: papic_vendor_challenge_photos has no category gate → Photos for every supplier', () => {
  const body = latestBody('papic_vendor_challenge_photos');
  assert.match(body, /consent_to_share\s*=\s*true/);
  assert.doesNotMatch(body, /categor/i);
  for (const c of VENDOR_CATEGORIES) assert.ok(has(c, 'Photos'), `Photos for ${c}`);
});

test('RPC: the budget band is the couple’s switch, so no category shows Budget & payments', () => {
  assert.match(BRIEF, /IF v_share_budget THEN/);
  for (const c of VENDOR_CATEGORIES) assert.ok(!has(c, 'Budget & payments'), `Budget for ${c}`);
});

test('no category grants Edit — editing comes from coordinator promotion, not a category', () => {
  for (const c of VENDOR_CATEGORIES)
    assert.ok(supplierAccessFor(c).every((r) => r.level === 'view'), `Edit for ${c}`);
});

test('plain words', () => {
  assert.equal(
    supplierAccessWords('catering'),
    'Guest list · Seat plan · The Day · Suppliers · Mood Board · Photos · Schedule: View',
  );
  assert.equal(supplierAccessWords('transportation'), 'The Day · Suppliers · Mood Board · Photos · Schedule: View');
  for (const c of VENDOR_CATEGORIES) assert.doesNotMatch(supplierAccessWords(c), /vendor/i);
});
