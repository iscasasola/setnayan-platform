/**
 * 🔒 NO HUB TOOL BORROWS THE SHOT LIST (controller, DECISION_LOG 23 Nov 2026: every new hub tool lives in ONE home,
 * `vendor_hub_tool_entries`).
 *
 * `event_shot_list_items` is the Shot list's own table — the photographer's must-get shots, which the couple reads on
 * their supplier workspace. A hub tool that put its rows there (a `tool_key` column, a second reader) would hand the
 * couple a supplier's working notes and give one tool two homes. So: the only code in app/ and lib/ that names the
 * table is the Shot list's own, and that code never names another hub tool nor a `tool_key`.
 *
 * A SOURCE SCAN, comments stripped (`lib/strip-comments.ts`): a comment may say the table's name; only code counts.
 * Tests are skipped — they name the table to assert on it.
 * SABOTAGE: add `.from('event_shot_list_items')` to `lib/hub-tool-entries.server.ts` → RED (an unlisted file); put
 * `tool_key: 'paperwork_checklist'` in `shot-list-actions.ts` → RED (a listed file names another tool).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { stripComments } from './strip-comments';
import { HUB_TOOL_LIBRARY } from './hub-tools';

const WEB = join(__dirname, '..');
const TABLE = 'event_shot_list_items';

/** The Shot list's own code — the only files whose code may name the table. Each must really use it (floor below). */
const SHOT_LIST_FILES = [
  // The supplier's reads and writes (the one writer).
  'app/vendor-dashboard/on-the-day/shot-list-actions.ts',
  // The couple's read on their supplier workspace — the Shot list only.
  'app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx',
] as const;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const rel = (p: string) => relative(WEB, p).split(sep).join('/');
const code = new Map<string, string>();
for (const root of ['app', 'lib']) {
  for (const p of walk(join(WEB, root))) {
    const raw = readFileSync(p, 'utf8');
    if (!raw.includes(TABLE)) continue;
    code.set(rel(p), stripComments(raw));
  }
}
const usesTable = [...code].filter(([, src]) => src.includes(TABLE)).map(([f]) => f).sort();

test('only the Shot list’s own code reads or writes event_shot_list_items', () => {
  assert.deepEqual(
    usesTable,
    [...SHOT_LIST_FILES].sort(),
    'a file outside the Shot list names its table — a hub tool keeps its rows in vendor_hub_tool_entries, never here',
  );
});

test('the Shot list’s code names no other hub tool and no tool_key', () => {
  const others = HUB_TOOL_LIBRARY.map((t) => t.key).filter((k) => k !== 'shot_list');
  assert.ok(others.length >= 40, 'the library was read');
  for (const f of SHOT_LIST_FILES) {
    const src = code.get(f) ?? '';
    assert.ok(!/\btool_key\b/.test(src), `${f}: a tool_key on the Shot list's rows`);
    for (const k of others) {
      assert.ok(!new RegExp(`['"\`]${k}['"\`]`).test(src), `${f}: names the hub tool '${k}' — its rows belong in vendor_hub_tool_entries`);
    }
  }
});

test('the one home never touches the Shot list’s table', () => {
  for (const f of ['lib/hub-tool-entries.ts', 'lib/hub-tool-entries.server.ts', 'app/vendor-dashboard/on-the-day/actions.ts']) {
    const src = stripComments(readFileSync(join(WEB, f), 'utf8'));
    assert.ok(!src.includes(TABLE), `${f} names ${TABLE}`);
  }
  assert.match(
    stripComments(readFileSync(join(WEB, 'lib/hub-tool-entries.server.ts'), 'utf8')),
    /\.from\('vendor_hub_tool_entries'\)/,
    'the one reader reads the one home',
  );
});

test('the anchor: the scan really sees the Shot list’s reads and writes (never vacuous)', () => {
  const actions = code.get('app/vendor-dashboard/on-the-day/shot-list-actions.ts') ?? '';
  assert.ok((actions.match(/\.from\('event_shot_list_items'\)/g) ?? []).length >= 3, 'the Shot list writer was not found');
  assert.match(code.get('app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx') ?? '', /\.from\('event_shot_list_items'\)/);
});
