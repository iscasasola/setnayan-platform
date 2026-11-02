/**
 * a-moment-picks-a-march.test.ts — 🚶 "THIS IS A MARCH" ON A MOMENT (owner 2026-11-01: *"When we say this is a march.
 * It picks which march. So in march we can create a march similar to schedule"* · *"And pick guests to add to the
 * march."*; DECISION_LOG "A MOMENT PICKS WHICH MARCH"; migration 20271301571290).
 *
 * Held here, as properties (the database's half is tests/db/a-moment-picks-a-march.db.test.ts):
 *   1 · THE DROPDOWN LISTS THE MARCHES: Not a march · the Wedding March · every own march (made in Guests › March) ·
 *       + New march — the same list for every moment, so two moments can pick one march. A failed read of the marches
 *       never hides a march a moment already is: that moment keeps its line, never "Not a march".
 *   2 · IT REACHES THE ROW: the sheet draws the dropdown, its pick posts `march_set` with the key, and the Schedule's
 *       update door hands both march ops to `runMomentMarch` before any block patch.
 *   3 · NOT A MARCH NEVER DELETES THE MARCH: the link writer touches the moment's own row and nothing else — no
 *       `march_groups` delete anywhere on this path; + New march makes its march with the writer Guests › March uses
 *       (`addMarchGroup`), never a second one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { NEW_MARCH, NOT_A_MARCH, WHOLE_MARCH, isMarchKey, marchNameFrom, marchPickOptions } from '@/lib/schedule-chapters';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const code = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));
const SHEET = 'app/dashboard/[eventId]/schedule/_components/moment-sheets.tsx';
const ACTIONS = 'app/dashboard/[eventId]/schedule/actions.ts';
const STEP = 'app/dashboard/[eventId]/schedule/moment-march-step.ts';
const SERVER = 'lib/schedule-chapters.server.ts';
const MIGRATION = '../../supabase/migrations/20271301571290_a_moment_picks_a_march.sql';

/** The body of `function <name>(…) {…}` in `src`, brace-matched. */
function body(src: string, name: string): string {
  const at = src.search(new RegExp(`function\\s+${name}\\s*[(<]`));
  assert.ok(at >= 0, `${name} not found — this guard is pointed at nothing`);
  let i = src.indexOf('(', at);
  for (let d = 0; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')' && --d === 0) break;
  }
  const open = src.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(open, j + 1);
  }
  throw new Error(`${name} never closes`);
}

const OWN = [
  { key: 'own_grandentr01', label: 'Grand Entrance' },
  { key: 'own_parade00001', label: 'Flower girls’ parade' },
];

test('1 · the dropdown lists every march, plus Not a march and + New march', () => {
  const opts = marchPickOptions({ ok: true, marches: OWN }, 'Wedding March', null);
  assert.deepEqual(
    opts.map((o) => o.key),
    [NOT_A_MARCH, WHOLE_MARCH, 'own_grandentr01', 'own_parade00001', NEW_MARCH],
  );
  assert.equal(opts[1]!.label, 'Wedding March');
  assert.equal(opts.at(-1)!.label, '+ New march');
  // Every key the dropdown can save is one the database accepts (its CHECK) — and its two words are not marches.
  for (const o of opts) assert.equal(isMarchKey(o.key), o.key !== NOT_A_MARCH && o.key !== NEW_MARCH, o.key);
  // Two moments: the same list — a march one moment picked is still offered to the next.
  const second = marchPickOptions({ ok: true, marches: OWN }, 'Wedding March', 'own_grandentr01');
  assert.ok(second.some((o) => o.key === 'own_grandentr01'), 'a march in use was taken off the other moments’ list');
});

test('1 · a failed read never turns a march into "Not a march"', () => {
  const opts = marchPickOptions({ ok: false }, 'Wedding March', 'own_grandentr01');
  const mine = opts.find((o) => o.key === 'own_grandentr01');
  assert.ok(mine, 'the moment’s own march vanished from its dropdown when the list could not be read');
  assert.notEqual(mine!.label, 'Not a march');
  assert.ok(opts.some((o) => o.key === WHOLE_MARCH), 'the Wedding March needs no read and stays pickable');
  assert.ok(opts.some((o) => o.key === NEW_MARCH));
  // The sheet says the read failed, on the row.
  const row = body(code(SHEET), 'MarchRow');
  assert.match(row, /marches\.ok\s*\?\s*undefined\s*:\s*'[^']+couldn’t be read/, 'a failed march read is not said on the row');
});

test('1 · a new march needs a name, within the stored bound', () => {
  assert.equal(marchNameFrom('  ').ok, false);
  assert.deepEqual(marchNameFrom('  Grand Entrance '), { ok: true, name: 'Grand Entrance' });
  assert.equal(marchNameFrom('x'.repeat(65)).ok, false);
  const sql = readFileSync(join(WEB, '../../supabase/migrations/20271296703339_march_own_groups.sql'), 'utf8');
  assert.match(sql, /BETWEEN 1 AND 64/, 'premise: march_groups.label is 1–64 letters');
});

test('2 · the sheet draws the dropdown, and its pick reaches the moment’s row', () => {
  const sheet = code(SHEET);
  assert.match(body(sheet, 'MomentSheet'), /<MarchRow\b/, 'the moment sheet has no "This is a march"');
  const row = body(sheet, 'MarchRow');
  assert.match(row, /<ChosenRow\b[\s\S]*?name="This is a march"/, '"This is a march" is not the house dropdown');
  assert.match(row, /doors\.march\('march_set',\s*m\.block_id,\s*\{\s*march_key:\s*k\s*\}/, 'a pick never posts its march');
  assert.match(row, /doors\.march\('march_new',/, '+ New march makes nothing');
  assert.match(sheet, /moment_op:\s*op/, 'the real march door does not post moment_op');
  const actions = code(ACTIONS);
  const at = actions.search(/export async function updateScheduleBlock/);
  const door = actions.slice(at);
  const march = door.search(/runMomentMarch\(/);
  const patch = door.search(/type Patch\b/);
  assert.ok(march > 0 && patch > 0 && march < patch, 'the update door does not hand march ops to runMomentMarch before its block patch');
  assert.match(door, /momentOp === 'march_set' \|\| momentOp === 'march_new'/);
});

test('3 · Not a march writes only the moment; + New march uses Guests › March’s own writer', () => {
  const server = code(SERVER);
  const link = body(server, 'linkMomentMarch');
  assert.match(link, /\.from\('event_schedule_blocks'\)\s*\.update\(\{\s*march_key:\s*key\s*\}\)/);
  assert.match(link, /\.select\('block_id'\)/, 'the link write is not read back (a zero-row update looks saved)');
  const step = code(STEP);
  for (const src of [link, step]) {
    assert.doesNotMatch(src, /from\('march_groups'\)\s*\.delete/, 'unlinking a moment deletes a march');
    assert.doesNotMatch(src, /from\('march_walks'\)/, 'unlinking a moment touches who walks');
  }
  assert.match(step, /addMarchGroup\(/, '+ New march has a second march writer');
  assert.doesNotMatch(step, /from\('march_groups'\)\s*\.(insert|upsert)/, '+ New march writes march_groups itself');
  assert.doesNotMatch(step, /['"]use server['"]/, 'the march step became an endpoint');
  // The database's own half: deleting a march clears its links and never cascades into the moment.
  const sql = readFileSync(join(WEB, MIGRATION), 'utf8');
  assert.match(sql, /AFTER DELETE ON public\.march_groups/);
  assert.doesNotMatch(sql, /REFERENCES public\.march_groups[^;]*ON DELETE CASCADE/, 'deleting a march would delete its moments');
});
