/**
 * GUARD — "ONE PER EVENT" HAS ONE SOURCE: the category's switch (owner 2026-10-29, Admin › Categories panels
 * approved: "build them, with the One per event switch"; "remove LED Background. we can book multiple for that as
 * well").
 *
 * ── THE DEFECT THIS EXISTS FOR ──────────────────────────────────────────────
 * Which suppliers a couple may book only one of per event was written down TWICE, by hand: `HARD_SINGLE_PICK_GROUPS`
 * in lib/wedding-plan-groups.ts, and a CASE in the generated `event_vendors.hard_single_group` column. Taking LED out
 * meant editing both, in two languages, and nothing said when they disagreed — the app would offer "add another" for
 * a category the database then refused, or the reverse. Now it is `service_categories.one_per_event`, read by the app
 * (`lib/one-per-event.ts`) and by the database lock guard (migration 20271296971721).
 *
 * 🔑 So the rule is: NO LIST. This guard fails when a list of those groups comes back anywhere in app code, when a
 * caller stops reading the switch, or when a later migration re-generates the column from a literal CASE.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { onePerEventGroupsFrom, isOnePerEventGroup } from './one-per-event';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

/** The six groups the old list held — any array of three or more of them is that list come back. */
const OLD_LIST = ['ceremony_venue', 'reception_venue', 'officiant', 'coordinator', 'host_mc', 'led_background'];

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/**
 * Array / Set literals (no nesting) that ARE the old list: four or more of its ids, making up most of the literal.
 * (Other lists legitimately name a venue or the officiant among many groups — the wedding essentials, the wizard's
 * order — and are not the one-per-event list.)
 */
export function listsOfTheOldSet(code: string): string[] {
  const hits: string[] = [];
  for (const m of code.matchAll(/\[[^[\]]*\]/g)) {
    const quoted = new Set([...m[0].matchAll(/['"`]([a-z_]+)['"`]/g)].map((q) => q[1]!));
    const mine = OLD_LIST.filter((id) => quoted.has(id)).length;
    if (mine >= 4 && mine / quoted.size >= 2 / 3) hits.push(m[0].replace(/\s+/g, ' ').slice(0, 120));
  }
  return hits;
}

test('the guard can see a list come back (sabotage proof, in memory)', () => {
  assert.equal(listsOfTheOldSet(`const X = new Set(['ceremony_venue', 'reception_venue', 'officiant', 'host_mc']);`).length, 1);
  assert.equal(listsOfTheOldSet(`const E = ['ceremony_venue', 'reception_venue', 'officiant', 'catering'];`).length, 0);
  assert.equal(listsOfTheOldSet(`const Y = ['catering', 'photography'];`).length, 0);
});

test('🚨 no app or lib code holds a list of the one-per-event groups', () => {
  const offenders: string[] = [];
  for (const file of [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))]) {
    const code = stripComments(readFileSync(file, 'utf8'));
    if (/\bHARD_SINGLE_PICK_GROUPS\b|\bisHardSinglePickGroup\b/.test(code)) offenders.push(`${relative(WEB, file)} — the retired name`);
    for (const hit of listsOfTheOldSet(code)) offenders.push(`${relative(WEB, file)} — ${hit}`);
  }
  assert.deepEqual(
    offenders,
    [],
    'One per event is the category switch (service_categories.one_per_event) — read it with lib/one-per-event.ts, never list the groups:\n' +
      offenders.join('\n'),
  );
});

test('every place that decides "one per event" reads the switch', () => {
  const finalize = stripComments(read('app/dashboard/[eventId]/vendors/actions.ts'));
  assert.match(finalize, /const onePerEvent = await readOnePerEventGroups\(supabase\);/, 'finalizeVendor must read the switch');
  assert.match(finalize, /const isHardSingle = isOnePerEventGroup\(groupId, onePerEvent\.groups\);/, 'finalizeVendor must decide from what it read');
  assert.match(finalize, /if \(!onePerEvent\.ok\)\s*\{\s*return \{ status: 'error'/, 'an unreadable switch must refuse the lock, not allow it as if "none"');
  const page = stripComments(read('app/dashboard/[eventId]/vendors/page.tsx'));
  assert.match(page, /readOnePerEventGroups\(supabase\)/, 'the Suppliers page must read the switch');
  assert.match(page, /onePerEventGroups,/, 'the plan model must be handed the switch');
  assert.match(page, /onePerEventGroups=\{\[\.\.\.onePerEventGroups\]\}/, 'the shortlist must be handed the switch');
  const model = stripComments(read('lib/vendors-plan-budget.ts'));
  assert.match(model, /isOnePerEventGroup\(group\.id, onePerEventGroups/, 'the plan model must decide from the switch');
});

test('the database reads the switch too, and no later migration brings the literal CASE back', () => {
  const files = readdirSync(MIGRATIONS).filter((f) => /^\d{14}_.*\.sql$/.test(f)).sort();
  const at = files.indexOf('20271296971721_one_per_event_is_a_category_switch.sql');
  assert.ok(at >= 0, 'the switch migration is missing');
  const sw = readFileSync(join(MIGRATIONS, files[at]!), 'utf8');
  assert.match(sw, /NEW\.hard_single_group := public\.one_per_event_category\(NEW\.category\)/);
  assert.match(sw, /AND sc\.one_per_event\b/);
  for (const f of files.slice(at + 1)) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    assert.doesNotMatch(sql, /hard_single_group[\s\S]{0,200}GENERATED ALWAYS AS/i, `${f} re-generates hard_single_group from a literal list`);
  }
});

test('the plan groups follow the filed categories — LED off, five on', () => {
  const rows = [
    { coarse_category: 'religious_venue', one_per_event: true },
    { coarse_category: 'venue', one_per_event: true },
    { coarse_category: 'officiant', one_per_event: true },
    { coarse_category: 'planner_coordinator', one_per_event: true },
    { coarse_category: 'host_emcee', one_per_event: true },
    { coarse_category: 'led_screens', one_per_event: false },
    { coarse_category: null, one_per_event: true },
  ];
  const g = onePerEventGroupsFrom(rows);
  for (const id of ['ceremony_venue', 'reception_venue', 'officiant', 'coordinator', 'host_mc']) assert.ok(g.has(id as never), id);
  assert.equal(g.has('led_background' as never), false, 'LED is multi (owner 2026-10-29)');
  assert.equal(g.has('catering' as never), false);
  assert.equal(isOnePerEventGroup(null, g), false);
  assert.equal(onePerEventGroupsFrom([]).size, 0);
});
