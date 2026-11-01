/**
 * 🔒 THE MEMORIES RULES (owner 2026-10-30, DECISION_LOG "MEMORIES ⚙ HOLDS THE MEMORIES RULES — HOSTS + COORDINATORS
 * MANAGE THEM; DEFAULT "ONLY TAGGED""). Three properties, each executed or anchored on the code that does it:
 *
 *   1 · the DEFAULT is Only tagged — the pure mapping, the dropdown's order, and the column's own DEFAULT FALSE;
 *   2 · WHO MANAGES is decided on the SERVER — the rule's whole table executed (host · co-host · coordinator yes;
 *       guest · other supplier · limited helper · removed/expired coordinator · failed read no), and the write
 *       action asks it (and the helper gate, area null) before its one UPDATE;
 *   3 · the GUEST READ honours it — "Everyone's photos" exists only while the switch is explicitly TRUE, "Photos of
 *       you" is the tagged read, and the pool RPC re-checks the switch on every read.
 *
 * Sabotage (2026-10-30, each reverted): `whoSeesOf` → `open !== false ? 'all'` → 1 red · `memoriesManagerRoleOf`
 * admitting `memberType === 'coordinator'` → 2 red (the limited-helper row) · the action's gate deleted → 1 red ·
 * `everyoneHref={guest.qr_token ? …}` (no `poolGalleryOpen`) → 3 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  DEFAULT_MEMORIES_WHO_SEES,
  WHO_SEES_OPTIONS,
  memoriesManagerRoleOf,
  poolGalleryOpenFor,
  whoSeesOf,
} from '@/lib/memories-rules';
import { memoriesManagerRole } from '@/lib/memories-rules.server';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(WEB, '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ── 1 · the default is Only tagged ─────────────────────────────────────────────────────────────────────── */

test('1 · the default is Only tagged — mapping, dropdown order and the column default agree', () => {
  assert.equal(DEFAULT_MEMORIES_WHO_SEES, 'tagged');
  for (const v of [null, undefined, false]) assert.equal(whoSeesOf(v), 'tagged', `${String(v)} must read as Only tagged`);
  assert.equal(whoSeesOf(true), 'all');
  assert.equal(poolGalleryOpenFor('tagged'), false);
  assert.equal(poolGalleryOpenFor('all'), true);
  assert.deepEqual(
    WHO_SEES_OPTIONS.map((o) => [o.key, o.label]),
    [
      ['tagged', 'Only tagged'],
      ['all', 'Share all memories'],
    ],
    'the owner’s two names, the default first',
  );
  // The column the choice is stored in starts FALSE for every event — so no live event changed what its guests see.
  const mig = readFileSync(join(REPO, 'supabase/migrations/20270917300000_papic_pool_gallery.sql'), 'utf8');
  assert.match(mig, /ADD COLUMN IF NOT EXISTS pool_gallery_open BOOLEAN NOT NULL DEFAULT FALSE/);
  for (const f of readdirSync(join(REPO, 'supabase/migrations'))) {
    const sql = readFileSync(join(REPO, 'supabase/migrations', f), 'utf8');
    assert.ok(!/pool_gallery_open\s+SET\s+DEFAULT\s+TRUE/i.test(sql), `${f} flips the default to Share all`);
    assert.ok(!/SET\s+pool_gallery_open\s*=\s*TRUE\s*(;|WHERE\s+TRUE|$)/im.test(sql), `${f} opens every event's Memories at once`);
  }
});

/* ── 2 · who manages — the rule's whole table, executed ─────────────────────────────────────────────────── */

const open = { coordinatorWindowClosed: false };
const ROWS: Array<[string, Parameters<typeof memoriesManagerRoleOf>[0], 'host' | 'coordinator' | null]> = [
  ['the couple (creator)', { memberType: 'couple', coordinatorSeat: false, ...open }, 'host'],
  ['a co-host (a couple member)', { memberType: 'couple', coordinatorSeat: false, ...open }, 'host'],
  ['a full-access coordinator (co-host seat)', { memberType: 'couple', coordinatorSeat: true, ...open }, 'host'],
  ['the coordinator (booked or by hand)', { memberType: 'coordinator', coordinatorSeat: true, ...open }, 'coordinator'],
  ['a coordinator after the window', { memberType: 'coordinator', coordinatorSeat: true, coordinatorWindowClosed: true }, null],
  ['a limited helper (coordinator member, viewer seat)', { memberType: 'coordinator', coordinatorSeat: false, ...open }, null],
  ['a guest', { memberType: 'guest', coordinatorSeat: false, ...open }, null],
  ['another booked supplier', { memberType: 'vendor', coordinatorSeat: false, ...open }, null],
  ['a stranger', { memberType: null, coordinatorSeat: false, ...open }, null],
];

test('2 · who manages: hosts + co-hosts + the coordinator, never a guest, another supplier or a helper', () => {
  for (const [who, facts, want] of ROWS) assert.equal(memoriesManagerRoleOf(facts), want, who);
});

type Res = { data: unknown; error: { message: string } | null };
function fakeClient(answers: { member?: Res; seat?: Res; event?: Res }) {
  const asked: string[] = [];
  const chain = (table: string): Record<string, unknown> => {
    const res: Res =
      table === 'event_members'
        ? answers.member ?? { data: null, error: null }
        : table === 'event_moderators'
          ? answers.seat ?? { data: [], error: null }
          : answers.event ?? { data: { event_date: null }, error: null };
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'not', 'is', 'in', 'neq']) {
      q[m] = (...args: unknown[]) => {
        asked.push(`${table}.${m}(${args.map((a) => JSON.stringify(a)).join(',')})`);
        return q;
      };
    }
    q.maybeSingle = async () => res;
    q.limit = async () => res;
    return q;
  };
  return { client: { from: (t: string) => chain(t) } as never, asked };
}

test('2 · the server read: a coordinator seat is the live, accepted COORDINATOR seat; a failed read refuses', async () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    const coord = fakeClient({ member: { data: { member_type: 'coordinator' }, error: null }, seat: { data: [{ moderator_id: 'm' }], error: null } });
    assert.equal(await memoriesManagerRole(coord.client, 'ev', 'u'), 'coordinator');
    const seatAsk = coord.asked.filter((a) => a.startsWith('event_moderators')).join(' ');
    assert.match(seatAsk, /eq\("role_subtype","wedding_planner_external"\)/, 'the coordinator seat, not any seat');
    assert.match(seatAsk, /not\("accepted_at","is",null\)/, 'accepted');
    assert.match(seatAsk, /is\("removed_at",null\)/, 'not removed');

    const host = fakeClient({ member: { data: { member_type: 'couple' }, error: null } });
    assert.equal(await memoriesManagerRole(host.client, 'ev', 'u'), 'host');

    const helper = fakeClient({ member: { data: { member_type: 'coordinator' }, error: null }, seat: { data: [], error: null } });
    assert.equal(await memoriesManagerRole(helper.client, 'ev', 'u'), null, 'a limited helper holds no coordinator seat');

    for (const broken of ['member', 'seat', 'event'] as const) {
      const c = fakeClient({
        member: { data: { member_type: 'couple' }, error: null },
        [broken]: { data: null, error: { message: 'boom' } },
      });
      assert.equal(await memoriesManagerRole(c.client, 'ev', 'u'), null, `a failed ${broken} read must refuse, never pass`);
    }
  } finally {
    console.error = quiet;
  }
});

test('2 · the write action asks the helper gate (area null) and the managers rule BEFORE its one UPDATE', () => {
  const s = code('app/dashboard/[eventId]/studio/papic/_components/pool-gallery-actions.ts');
  const helper = s.indexOf('limitedHelperRefusal(eventId, null)');
  const rule = s.indexOf('memoriesManagerRole(supabase, clean, user.id)');
  const write = s.indexOf('.update({ pool_gallery_open');
  console.log(`# pool-gallery-actions: helper @${helper} · rule @${rule} · write @${write}`);
  assert.ok(helper > -1 && rule > -1 && write > -1, 'gate, rule and write are all in the action');
  assert.ok(helper < rule && rule < write, 'the gates come before the write');
  assert.match(s.slice(rule - 30, rule + 120), /if \(!\(await memoriesManagerRole[\s\S]{0,80}return \{ ok: false, error: 'forbidden' \}/);
  assert.ok(!s.includes("member_type !== 'couple'"), 'the old couple-only lock is back — the owner widened it to the coordinator');
  assert.equal((s.match(/\.update\(/g) ?? []).length, 1, 'one write, behind the gate');
});

test('2 · the ⚙ is drawn for exactly the people the action admits, and a coordinator gets the rules only', () => {
  const page = code('app/dashboard/[eventId]/memories/page.tsx');
  assert.match(page, /const managerRole[^=]*= host \? 'host' : await memoriesManagerRole\(supabase, eventId, user\.id\)/);
  assert.match(page, /settings=\{\s*managerRole \? \(\s*<MemoriesSettings[^>]*role=\{managerRole\}/);
  const settings = code('app/dashboard/[eventId]/memories/_components/memories-settings.tsx');
  assert.match(
    settings,
    /if \(role === 'coordinator'\) return <PoolGalleryCard eventId=\{eventId\} variant="row" \/>;/,
    'a coordinator sees Who sees what — not the hosts’ purchases or their Google Drive',
  );
});

/* ── 3 · the guest read honours the setting ─────────────────────────────────────────────────────────────── */

test('3 · a guest sees everyone’s photos only while the switch is explicitly TRUE; otherwise tagged + their own', () => {
  const loaders = code('app/[slug]/_lib/loaders.ts');
  assert.match(loaders, /return !poolErr && poolRow\?\.pool_gallery_open === true;/, 'only an explicit TRUE shares all; a failed read is Only tagged');
  assert.match(loaders, /getGuestLiveGallery\(event\.event_id, guest\.guest_id\)/, '"Photos of you" is THIS guest’s tagged read');
  const tagged = code('lib/guest-live-gallery.ts');
  assert.match(tagged, /\.from\('photo_tags'\)[\s\S]{0,200}\.eq\('guest_id', guestId\)/, 'the tagged read asks this guest’s tags');

  const body = code('app/[slug]/_components/site-body.tsx');
  const doors = body.match(/everyoneHref=\{[^}]*\}/g) ?? [];
  console.log(`# site-body everyoneHref: ${doors.join(' | ')}`);
  assert.ok(doors.length >= 1, 'the Gallery draws a door to everyone’s photos somewhere');
  for (const d of doors) {
    assert.ok(d === 'everyoneHref={null}' || /^everyoneHref=\{poolGalleryOpen && /.test(d), `an ungated door to everyone's photos: ${d}`);
  }

  // The pool itself re-checks the switch on every read — the LATEST definition of the RPC, whichever file it is in.
  const dir = join(REPO, 'supabase/migrations');
  const defs = readdirSync(dir)
    .sort()
    .filter((f) => /FUNCTION public\.guest_pool_gallery\(/.test(readFileSync(join(dir, f), 'utf8')));
  const latest = defs[defs.length - 1]!;
  console.log(`# guest_pool_gallery latest: ${latest}`);
  assert.match(readFileSync(join(dir, latest), 'utf8'), /e\.pool_gallery_open/, `${latest} no longer asks the switch`);
  assert.match(code('app/papic/pool/page.tsx'), /if \(!ev\?\.pool_gallery_open\) notFound\(\);/, 'the shared page is closed while Only tagged');
});
