/**
 * THE COORDINATOR TRADE IS ONE LIST — in TypeScript, in SQL, and from the taxonomy.
 *
 * 2026-10-19: every coordinator gate asked for the tile key 'coordinator' in
 * `vendor_profiles.services`, a value no shop writer puts there (shops carry
 * 'planner_coordinator' + a canonical leaf). The fix is ONE list
 * (`COORDINATOR_TRADE_SERVICES`) and its SQL copy
 * (`public.services_make_a_coordinator`). These checks keep them one:
 *
 *   1. the TS list is exactly: the tile + every couple category whose tile is
 *      the coordinator tile + every canonical leaf under that tile;
 *   2. the LATEST SQL definition of `services_make_a_coordinator` lists the
 *      same values;
 *   3. no function's LATEST SQL definition still tests the bare tile
 *      (`'coordinator' = ANY (…services)`);
 *   4. no app/lib source tests a shop's services for the bare tile.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COORDINATOR_TRADE_SERVICES, isCoordinatorTrade } from './coordinator-trade';
import { canonicalServicesForTile } from './vendor-counts';
import { tilesForVendorCategory } from './vendor-category-taxonomy';
import { VENDOR_CATEGORIES } from './vendors';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');
const sqlFiles = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
/** The owner-approved taxonomy v2 (2026-11-06): every live key → the service it now lives in. */
const V2 = JSON.parse(
  readFileSync(join(WEB, '..', '..', 'supabase', 'data', 'taxonomy-v2-2026-11-06.json'), 'utf8'),
) as { live_key_map: Record<string, { service: string }> };

/** The body of the LAST `CREATE OR REPLACE FUNCTION public.<name>(` in filename order. */
function latestDefinitions(): Map<string, { file: string; body: string }> {
  const out = new Map<string, { file: string; body: string }>();
  for (const f of sqlFiles) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    const re = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.([a-z0-9_]+)\s*\(/gi;
    let m: RegExpExecArray | null;
    const starts: { name: string; at: number }[] = [];
    while ((m = re.exec(sql))) starts.push({ name: m[1]!.toLowerCase(), at: m.index });
    starts.forEach((s, i) => {
      const end = i + 1 < starts.length ? starts[i + 1]!.at : sql.length;
      out.set(s.name, { file: f, body: sql.slice(s.at, end) });
    });
  }
  return out;
}

test('1 · the TS list is the tile, its couple categories and its leaves — nothing more, nothing less', () => {
  const expected = new Set<string>(['coordinator']);
  for (const c of VENDOR_CATEGORIES) if (tilesForVendorCategory(c).includes('coordinator' as never)) expected.add(c);
  // Taxonomy v2 (2026-11-06): the coordinator TRADE is the Coordinator / planner service and every
  // key v2 folds into it (Day-of, Partial, Despedida, … now its specialties), plus Setnayan's own
  // concierge. Those folded keys are hidden from the picker, so the visible-leaves read below no longer
  // names them — the approved data does. The Date & feng-shui consultant sits on the same tile since
  // the Date specialist row folded into it, but it is its OWN service, not this trade: putting it on
  // the day-of gates (Run the day, the floor command) would be an access change, not a re-file.
  for (const [key, home] of Object.entries(V2.live_key_map)) {
    if (home.service === 'wedding_coordination' || home.service === 'setnayan_concierge') expected.add(key);
  }
  for (const leaf of canonicalServicesForTile('coordinator' as never)) {
    const home = V2.live_key_map[leaf];
    if (!home || home.service === 'wedding_coordination' || home.service === 'setnayan_concierge') expected.add(leaf);
  }
  assert.ok(expected.has('planner_coordinator'), 'the couple category for a coordinator is no longer planner_coordinator — re-read this file');
  assert.ok(expected.has('day_of_coordinator'), 'v2 no longer folds Day-of into the coordinator service — re-read this file');
  assert.ok(!expected.has('date_fengshui_consultant'), 'the feng-shui consultant is not the coordinator trade');
  assert.ok(expected.size > 3, `the taxonomy yielded too few coordinator names: ${[...expected].join(', ')}`);
  assert.deepEqual([...COORDINATOR_TRADE_SERVICES].sort(), [...expected].sort());
});

test('2 · the SQL copy lists exactly the same names', () => {
  const def = latestDefinitions().get('services_make_a_coordinator');
  assert.ok(def, 'public.services_make_a_coordinator is not defined in any migration');
  const arr = def!.body.match(/&&\s*ARRAY\[([\s\S]*?)\]::text\[\]/i);
  assert.ok(arr, `no ARRAY[...] literal in services_make_a_coordinator (${def!.file})`);
  const names = [...arr![1]!.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]!);
  assert.deepEqual(names.sort(), [...COORDINATOR_TRADE_SERVICES].sort(), `SQL copy in ${def!.file} drifted`);
});

test('3 · no function in its latest form still tests services for the bare tile', () => {
  const offenders: string[] = [];
  for (const [name, { file, body }] of latestDefinitions()) {
    const code = body.replace(/--[^\n]*/g, '');
    if (/'coordinator'\s*=\s*ANY\s*\(\s*[a-z_.]*services\s*\)/i.test(code)) offenders.push(`${name} (${file})`);
  }
  assert.deepEqual(offenders, [], 'these gates still ask for a value no shop carries');
});

test('4 · no app/lib source tests a shop\'s services for the bare tile', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      if (e === 'node_modules' || e === '.next') continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) {
        const src = stripComments(readFileSync(p, 'utf8'));
        if (/services[^\n;]{0,40}\.includes\(\s*(COORDINATOR_TILE|'coordinator')\s*\)/.test(src)) offenders.push(p.slice(WEB.length + 1));
      }
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  assert.deepEqual(offenders, [], 'use isCoordinatorTrade (lib/coordinator-trade.ts)');
});

test('the shops that exist are coordinators; a caterer is not', () => {
  assert.equal(isCoordinatorTrade(['planner_coordinator']), true, "a coordinator who joined from the couple's link");
  assert.equal(isCoordinatorTrade(['planner_coordinator', 'wedding_coordination']), true, 'a coordinator from /open-shop');
  assert.equal(isCoordinatorTrade(['day_of_coordinator']), true);
  assert.equal(isCoordinatorTrade(['coordinator']), true, 'the tile, as older fixtures seed it');
  assert.equal(isCoordinatorTrade(['catering']), false);
  assert.equal(isCoordinatorTrade([]), false);
  assert.equal(isCoordinatorTrade(null), false);
});
