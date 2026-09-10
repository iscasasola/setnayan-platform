/**
 * ONLY THE COUPLE (AND SETNAYAN ADMINS) SPEND THE COUPLE'S RENDER CREDITS OR
 * GIVE SHARE CONSENT — the APP half of migration 20271221631865.
 *
 * Owner ruling 2026-09-11 (DECISION_LOG). The database is the fence (proven as a
 * real `authenticated` session in tests/db/only-the-couple-spends-render-
 * credits.db.test.ts). This file pins the half that decides what a person SEES:
 *
 *   · the page asks the SAME gate the spend functions use, and hands the answer
 *     to the surface — so a guest is never offered a button the database will
 *     refuse, and never told "buy a pack" for credits they could not spend;
 *   · the consent checkbox, every render tile and the pack purchase honour it;
 *   · `requestRender` asks the gate BEFORE `moodboard_begin_render`, because a
 *     NULL from begin is otherwise reported as "insufficient";
 *   · the migration keeps READS on the wide gate (balance, pool) and narrows
 *     only the act gate.
 *
 * Every needle is matched against comment-stripped source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(import.meta.dirname, '..');
const DIR = join(WEB, 'app', 'dashboard', '[eventId]', 'studio', 'mood-board');
const read = (p: string) => stripComments(readFileSync(p, 'utf8'));
const PAGE = read(join(DIR, 'page.tsx'));
const SURFACE = read(join(DIR, '_components', 'make-it-real.tsx'));
const ACTIONS = read(join(DIR, 'render-actions.ts'));
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');
const LOCK = '20271221631865';

test('the page asks the database’s own ACT gate and hands the answer to the surface', () => {
  assert.match(PAGE, /supabase\.rpc\(\s*'moodboard_render_caller_may_act',\s*\{\s*p_event_id:\s*eventId\s*\}\s*\)/);
  assert.match(PAGE, /const mayStartRenders = !mayActRes\.error && mayActRes\.data === true;/, 'a refused check must read as "no"');
  assert.match(PAGE, /<MakeItReal[\s\S]*?mayStartRenders=\{mayStartRenders\}[\s\S]*?\/>/, 'the answer never reaches MakeItReal');
});

test('the surface honours it: consent, every tile, and the pack purchase', () => {
  assert.match(SURFACE, /disabled=\{consentPending \|\| !mayStartRenders\}/, 'the consent checkbox is live for a non-couple member');
  const tiles = SURFACE.match(/coupleOnly=\{!mayStartRenders\}/g) ?? [];
  const mounts = SURFACE.match(/<(?:WholeLookTile|PartTile)\b/g) ?? [];
  assert.ok(mounts.length >= 3, `only ${mounts.length} tile mounts found — the scan is blind`);
  assert.equal(tiles.length, mounts.length, `${mounts.length} tiles mounted, ${tiles.length} told who may render`);
  assert.match(SURFACE, /\{coupleOnly \? null : !state\.generated \?/, 'a coupleOnly tile still shows its render controls');
  assert.match(SURFACE, /state\.briefOpen && !state\.locked && !coupleOnly/, 'a coupleOnly tile can still open the Generate brief');
  assert.match(SURFACE, /\{packPlan && mayStartRenders \?/, 'a non-couple member is offered a pack they could never spend');
  assert.match(SURFACE, /Only the couple can start a render or choose to share one\./);
});

test('requestRender asks the gate BEFORE it can reach moodboard_begin_render', () => {
  const gate = ACTIONS.indexOf("'moodboard_render_caller_may_act'");
  const begin = ACTIONS.indexOf("rpc('moodboard_begin_render'");
  assert.ok(gate > 0 && begin > 0, 'one of the two calls is gone');
  assert.ok(gate < begin, 'the gate is asked after begin — a guest would be told "insufficient"');
  assert.match(
    ACTIONS.slice(gate, begin),
    /if \(mayActError \|\| mayAct !== true\) \{\s*return \{ status: 'failed', code: 'unavailable', renderId: null \};/,
  );
});

test('the migration narrows only the ACT gate; the two READS keep the member rule', () => {
  const file = readdirSync(MIGRATIONS).find((f) => f.startsWith(LOCK));
  assert.ok(file, `migration ${LOCK} is missing`);
  const sql = readFileSync(join(MIGRATIONS, file), 'utf8').replace(/--[^\n]*/g, '');
  const body = (name: string) => {
    const m = sql.match(new RegExp(`FUNCTION public\\.${name}\\([\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;`));
    assert.ok(m, `${name} is not (re)defined in ${file}`);
    return m[1]!;
  };
  const act = body('moodboard_render_caller_may_act');
  assert.match(act, /current_couple_event_ids\(\)/, 'the act gate is not the couple rule');
  assert.doesNotMatch(act, /event_members/, 'the act gate still admits any member');
  assert.match(body('moodboard_render_caller_may_view'), /event_members/, 'the read gate lost the member rule');
  for (const reader of ['moodboard_render_balance', 'moodboard_inspiration_pool']) {
    const b = body(reader);
    assert.match(b, /moodboard_render_caller_may_view\(p_event_id\)/, `${reader} is not on the read gate`);
    assert.doesNotMatch(b, /moodboard_render_caller_may_act/, `${reader} still uses the narrowed act gate — members lose READ`);
  }
});

test('no LATER migration re-widens the act gate', () => {
  const later = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && f > `${LOCK}_`);
  const bad = later.filter((f) => {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8').replace(/--[^\n]*/g, '');
    const m = sql.match(/FUNCTION public\.moodboard_render_caller_may_act\([\s\S]*?AS \$\$([\s\S]*?)\$\$;/);
    return m ? /event_members/.test(m[1]!) || !/current_couple_event_ids\(\)/.test(m[1]!) : false;
  });
  assert.deepEqual(bad, [], `these migrations redefine the act gate without the couple rule: ${bad.join(', ')}`);
});
