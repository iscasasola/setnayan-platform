/**
 * people-group-rows.test.ts — 🔒 THE GROUP ROWS ON PEOPLE ARE ONE BATCHED READ, AND THEY SAY ONLY WHAT IS STORED.
 *
 * Owner 2026-10-28 (DECISION_LOG "USER DASHBOARD PART 1 — PEOPLE & GROUPS — APPROVED", "Group rows read like chats").
 * Held here, executed on a REAL supabase-js client whose `fetch` is a fake that counts requests:
 *   1 · ONE request for every row's activity, whatever the number of groups — newest message, live stories and the
 *       next event embedded per group (`communities?select=…samahan_messages(…)…`), with the per-group limits;
 *   2 · ONE names read for the last lines' authors (names only), and none when there is nobody to name;
 *   3 · the shapes: "You:" for your own line, the first name otherwise; the ring counts live stories; a refused read is
 *       NOT a quiet group (no row says "No messages yet" over it); a past or archived event is no "next event";
 *   4 · the reader never asks per row (no `await` inside a loop over the groups).
 *
 * Sabotage (2026-10-28, each reverted): the activity read moved into a `for (const g of groups)` loop → 1 and 4 red;
 * `.limit(1, { referencedTable: 'samahan_messages' })` dropped → 1 red; `activity === null` handed as `[]` → 3 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path, { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';
import { shapeGroupRows, type GroupBase } from '@/lib/people-group-rows-shape';

/* ── `server-only` shim (same as a-fee-lock-failure-keeps-its-reason.test.ts) ── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = path.join(process.cwd(), '__server_only_stub_people_group_rows__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

function fakeSupabase(body: (url: URL) => unknown, status = 200) {
  const urls: URL[] = [];
  const client = createClient('http://lab.invalid', 'lab-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (async (input: RequestInfo | URL) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        urls.push(url);
        return new Response(JSON.stringify(status === 200 ? body(url) : { message: 'permission denied', code: '42501' }), {
          status,
          headers: { 'content-type': 'application/json' },
        });
      }) as typeof fetch,
    },
  }) as unknown as SupabaseClient;
  return { client, urls };
}

const NOW = new Date('2026-10-28T04:00:00Z');

test('1 · every row’s activity is ONE request, with the per-group limits', async () => {
  const { readGroupActivity } = await import('@/lib/people-group-rows');
  const { client, urls } = fakeSupabase(() => []);
  await readGroupActivity(client, ['g1', 'g2', 'g3', 'g4', 'g5'], NOW);
  assert.equal(urls.length, 1, `${urls.length} requests for five groups — the rows are read one by one`);
  const u = urls[0]!;
  assert.match(u.pathname, /\/rest\/v1\/communities$/);
  const sel = u.searchParams.get('select') ?? '';
  for (const embed of ['samahan_messages(', 'samahan_stories(', 'events(']) assert.ok(sel.includes(embed), `the one read does not embed ${embed}`);
  assert.equal(u.searchParams.get('community_id'), 'in.(g1,g2,g3,g4,g5)');
  assert.equal(u.searchParams.get('samahan_messages.limit'), '1', 'the newest message is not limited to one PER GROUP');
  assert.equal(u.searchParams.get('samahan_messages.order'), 'created_at.desc');
  assert.equal(u.searchParams.get('samahan_messages.deleted_at'), 'is.null', 'a taken-down message can be the last line');
  assert.equal(u.searchParams.get('samahan_stories.expires_at'), `gt.${NOW.toISOString()}`, 'an expired story can draw the ring');
  assert.equal(u.searchParams.get('events.limit'), '1');
  assert.equal(u.searchParams.get('events.event_date'), 'gte.2026-10-28', 'the next event is not counted from Manila’s today');
  assert.equal(u.searchParams.get('events.archived'), 'eq.false');
  // No groups → no request at all.
  const none = fakeSupabase(() => []);
  assert.deepEqual(await readGroupActivity(none.client, [], NOW), []);
  assert.equal(none.urls.length, 0);
});

test('1b · a refused activity read is null — never []', async () => {
  const { readGroupActivity } = await import('@/lib/people-group-rows');
  const { client } = fakeSupabase(() => null, 403);
  const orig = console.error;
  console.error = () => {};
  try {
    assert.equal(await readGroupActivity(client, ['g1'], NOW), null);
  } finally {
    console.error = orig;
  }
});

test('2 · the authors’ names are ONE read, names only', async () => {
  const { readSpeakerNames } = await import('@/lib/people-group-rows');
  const { client, urls } = fakeSupabase(() => [{ user_id: 'u2', display_name: 'Mika Santos' }]);
  const names = await readSpeakerNames(client, ['u2', 'u3']);
  assert.equal(urls.length, 1);
  assert.equal(urls[0]!.searchParams.get('select'), 'user_id,display_name', 'the names read asks for more than names');
  assert.equal(names.get('u2'), 'Mika Santos');
  const none = fakeSupabase(() => []);
  await readSpeakerNames(none.client, []);
  assert.equal(none.urls.length, 0, 'a names read with nobody to name');
});

const BASE: GroupBase[] = [
  { community_id: 'g1', name: 'Barkada ni Ice', role: 'organizer', member_count: 12, archived: false },
  { community_id: 'g2', name: 'Sison family', role: 'member', member_count: 0, archived: false },
  { community_id: 'g3', name: 'Old', role: 'member', member_count: 3, archived: true },
];

test('3 · the rows say what is stored — and a refusal is not a quiet group', () => {
  const rows = shapeGroupRows(
    BASE,
    [
      {
        community_id: 'g1',
        samahan_messages: [{ user_id: 'u2', body: 'Sino may\n sasakyan?', created_at: '2026-10-28T03:58:00Z' }],
        samahan_stories: [{ story_id: 's1' }, { story_id: 's2' }],
        events: [
          { event_id: 'e0', display_name: 'Past', event_date: '2026-10-01', archived: false },
          { event_id: 'e1', display_name: 'Liga ng Barangay', event_date: '2026-11-15', archived: false },
        ],
      },
      { community_id: 'g2', samahan_messages: [{ user_id: 'me', body: 'Hi', created_at: '2026-10-27T04:00:00Z' }], samahan_stories: [], events: [{ event_id: 'e2', display_name: 'Hidden', event_date: '2026-12-01', archived: true }] },
    ],
    new Map([['u2', 'Mika Santos']]),
    'me',
    NOW,
  );
  assert.equal(rows.length, 2, 'an archived group is drawn');
  assert.deepEqual(rows[0]!.last, { who: 'Mika', body: 'Sino may sasakyan?', when: '2m' });
  assert.equal(rows[0]!.stories, 2);
  assert.deepEqual(rows[0]!.nextEvent, { label: '15 Nov · Liga ng Barangay' }, 'a past event is the "next" one');
  assert.equal(rows[1]!.last!.who, 'You');
  assert.equal(rows[1]!.nextEvent, null, 'an archived event is the next one');
  assert.equal(rows[1]!.memberCount, null, 'a refused member count is printed as 0');

  const refused = shapeGroupRows(BASE, null, new Map(), 'me', NOW);
  assert.ok(refused.every((r) => r.last === null && r.stories === 0), 'a refused read invented activity');
});

test('4 · the reader never asks per row', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'lib', 'people-group-rows.ts'), 'utf8'));
  const reader = src.slice(src.indexOf('export const readPeopleGroupRows'));
  assert.ok(reader.length > 100, 'the reader moved — re-anchor this guard');
  assert.doesNotMatch(reader, /for\s*\(|\.map\(\s*async|\.forEach\(\s*async/, 'the reader loops over the groups with a read inside');
  assert.equal((reader.match(/await readGroupActivity\(/g) ?? []).length, 1, 'the activity is not read exactly once');
  assert.equal((reader.match(/await readSpeakerNames\(/g) ?? []).length, 1, 'the names are not read exactly once');
});
