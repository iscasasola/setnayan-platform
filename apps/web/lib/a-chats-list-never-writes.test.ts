/**
 * 🛡 RW-305 (14 Nov, live 02c3b18) — A PAGE LOAD NEVER WRITES.
 *
 * Just OPENING a couple's Chats list created an empty "General" group (and every role group), with no press: the
 * list's server component called `chat_group_open` / `chat_group_open_role` on every render. A group now opens on a
 * TAP — a form posting `openGroupChat` — and rendering the list only READS.
 *
 * Two halves, both needed:
 *   1. BEHAVIOUR — `groupsToOpen` (what the list calls on render) makes no RPC and no insert/upsert/update/delete.
 *   2. SOURCE — the list's component (comments stripped) names no opener and no write; the only place an opener is
 *      reachable from it is the server action, behind a POST.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from './strip-comments';
import { groupsToOpen, unopenedGroups, openOneGroup } from './chat-groups';

type Call = { kind: string; name: string };

function fakeClient(calls: Call[]) {
  const guests = [{ role: 'principal_sponsor', extra_roles: null }, { role: null, extra_roles: null }];
  const chain = (table: string) => {
    const result = table === 'guests' ? { data: guests, error: null } : { data: { role_names: null }, error: null };
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'is', 'in', 'order', 'limit']) q[m] = () => q;
    for (const m of ['insert', 'upsert', 'update', 'delete']) {
      q[m] = () => {
        calls.push({ kind: 'write', name: `${table}.${m}` });
        return q;
      };
    }
    q.maybeSingle = async () => result;
    q.single = async () => result;
    q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej);
    return q;
  };
  return {
    from: (t: string) => chain(t),
    rpc: async (name: string) => {
      calls.push({ kind: 'rpc', name });
      return { data: 'thread-1', error: null };
    },
  };
}

test('rendering the list (groupsToOpen) makes no RPC and no write', async () => {
  const calls: Call[] = [];
  const wanted = await groupsToOpen(fakeClient(calls) as unknown as SupabaseClient, 'event-1');
  assert.deepEqual(calls, [], `a render wrote or called a function: ${JSON.stringify(calls)}`);
  assert.ok(wanted, 'the guest list was readable');
  assert.equal(wanted?.[0]?.kind, 'general', 'General is offered — as a row to tap, not a thread made on sight');
  assert.ok(wanted?.some((g) => g.kind === 'role'), 'a role held on the guest list is offered too');
});

test('an opened group is not offered again; an unopened one is', () => {
  const wanted = [
    { kind: 'general' as const, key: null, name: 'General' },
    { kind: 'role' as const, key: 'principal_sponsors', name: 'Principal sponsors' },
  ];
  assert.deepEqual(unopenedGroups(wanted, []).map((g) => g.kind), ['general', 'role']);
  assert.deepEqual(
    unopenedGroups(wanted, [{ group_kind: 'general', group_key: null }]).map((g) => g.key),
    ['principal_sponsors'],
  );
  assert.deepEqual(
    unopenedGroups(wanted, [
      { group_kind: 'general', group_key: null },
      { group_kind: 'role', group_key: 'principal_sponsors' },
    ]),
    [],
  );
});

test('a tap (openOneGroup) is the one place the opener runs', async () => {
  const calls: Call[] = [];
  const id = await openOneGroup(fakeClient(calls) as unknown as SupabaseClient, 'event-1', 'general', null);
  assert.equal(id, 'thread-1');
  assert.deepEqual(calls.map((c) => c.name), ['chat_group_open']);
});

test('the Chats list component names no opener and no write — only a form posting openGroupChat', () => {
  const file = join(__dirname, '../app/dashboard/[eventId]/messages/_components/event-groups.tsx');
  const src = stripComments(readFileSync(file, 'utf8'));
  for (const banned of [/chat_group_open/, /\bopenOneGroup\b/, /\bopenEventGroups\b/, /\.(insert|upsert|update|delete)\(/]) {
    assert.equal(banned.test(src), false, `event-groups.tsx must not call ${banned} while rendering`);
  }
  assert.match(src, /<form action=\{openGroupChat\}>/, 'an unopened group opens on a tap — a POST, never a link (a link is prefetched)');
  const lib = stripComments(readFileSync(join(__dirname, 'chat-groups.ts'), 'utf8'));
  assert.equal(/export async function openEventGroups\b/.test(lib), false, 'the open-everything-on-render helper stays gone');
});
