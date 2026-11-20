/**
 * 🤫 A WHISPER HAS TWO SIDES — Unichat part E. Owner, 19 Nov: *"supplier whispers to co suppliers on the chat. and
 * coordinators and hosts do not see it."* ("Own shop team".) Owner, 20 Nov: *"host and coordinator can whisper to each
 * other."*
 *
 * The database half (who can read and write a whisper, a removed member reading nothing) is
 * `tests/db/a-whisper-stays-on-its-side.db.test.ts`. This file holds the APP half:
 *
 *   1 · the hosts' list carries the coordinator and never a shop login; the team's list is the shop's own people;
 *   2 · the reach line ("Only you, Ana and your coordinator" · "Only your team") and the strip, by side;
 *   3 · a line's side is the STORED one; only a line from before the column is inferred, and only on the hosts' side;
 *   4 · a failed read is said as a failure on both sides — never "no one" — in words distinct from the empty case;
 *   5 · the page reads (stubbed clients): a coordinator gets the hosts' whisper; a team member the team's; a stranger none;
 *   6 · the composer: the sky Private chip and who it reaches, with the dispute ⓘ; the team's box says "Only your team".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  WHISPER_DISPUTE_NOTE,
  WHISPER_NOBODY_LINE,
  WHISPER_NO_TEAM_LINE,
  WHISPER_TEAM_REACH,
  WHISPER_TEAM_UNREAD_LINE,
  WHISPER_UNREAD_LINE,
  hostsWhisperReach,
  WHISPER_COORDINATOR_REACH,
  leftWhisperAskBody,
  teamSideOf,
  teamWhisperRecipients,
  whisperBlockedLine,
  whisperRecipients,
  whisperSideOf,
  whisperSideOfLine,
  whisperStrip,
} from './chat-whisper';

/* ── `server-only` shim (the shape of lib/a-failed-whisper-read-is-not-nobody.test.ts) ── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub_whisper_sides__.js');
{
  const stub = new CjsModule(SERVER_ONLY_STUB);
  stub.filename = SERVER_ONLY_STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[SERVER_ONLY_STUB] = stub;
  const originalResolve = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return SERVER_ONLY_STUB;
    return originalResolve.call(this, request, ...rest);
  };
}

(globalThis as unknown as { React: unknown }).React = React;
const h = React.createElement;

type Res = { data: unknown; error: unknown };
function stubClient(tables: Record<string, Res>): SupabaseClient {
  return {
    from(table: string) {
      const result = tables[table] ?? { data: [], error: null };
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit', 'maybeSingle']) b[m] = () => b;
      b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
      return b;
    },
    // The ONE team rule is an RPC (`chat_shop_team_user_ids`, migration 20271355512715): stubbed as `rpc:<name>`.
    rpc(name: string) {
      return Promise.resolve(tables[`rpc:${name}`] ?? { data: [], error: null });
    },
  } as unknown as SupabaseClient;
}
const REFUSED = { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } };

test('1 · the hosts’ list carries the coordinator, never a shop login; the team’s list is the shop’s own people', () => {
  // A host whispers: the other host AND the coordinator; never the shop, never the sender.
  assert.deepEqual(whisperRecipients({ hostMemberIds: ['ana', 'ben'], coordinatorIds: ['liza'], shopUserIds: ['sol'], senderUserId: 'ana' }), ['ben', 'liza']);
  // The coordinator whispers: the hosts.
  assert.deepEqual(whisperRecipients({ hostMemberIds: ['ana', 'ben'], coordinatorIds: ['liza'], shopUserIds: ['sol'], senderUserId: 'liza' }), ['ana', 'ben']);
  // A coordinator who is ALSO on the shop's team is the supplier here — never on the hosts' list.
  assert.deepEqual(whisperRecipients({ hostMemberIds: ['ana'], coordinatorIds: ['sol'], shopUserIds: ['sol'], senderUserId: 'ana' }), []);
  // The team: everyone on the shop's side but the sender, once each.
  assert.deepEqual(teamWhisperRecipients({ teamUserIds: ['sol', 'mara', 'mara', ''], senderUserId: 'sol' }), ['mara']);
  assert.deepEqual(teamWhisperRecipients({ teamUserIds: ['sol'], senderUserId: 'sol' }), [], 'alone on the team — the caller must refuse');
  assert.equal(whisperSideOf('hosts'), 'hosts');
  assert.equal(whisperSideOf('team'), 'team');
  for (const raw of [null, undefined, '', 'everyone', 'HOSTS']) assert.equal(whisperSideOf(raw), null);
});

test('2 · the reach line and the strip, by side', () => {
  assert.equal(hostsWhisperReach({ names: ['Ana'], coordinators: 1 }), 'Only you, Ana and your coordinator');
  assert.equal(hostsWhisperReach({ names: ['Ana'], coordinators: 0 }), 'Only you and Ana');
  assert.equal(hostsWhisperReach({ names: [], coordinators: 1 }), 'Only you and your coordinator');
  assert.equal(hostsWhisperReach({ names: ['Ana', 'Ben'], coordinators: 2 }), 'Only you, Ana, Ben and your coordinators');
  assert.equal(hostsWhisperReach({ names: [], coordinators: 0 }), null, 'nobody is said as somebody');
  // A coordinator writing: the drawing's words exactly — "You and the hosts" (controller, under owner delegation 20 Nov).
  assert.equal(WHISPER_COORDINATOR_REACH, 'You and the hosts');
  assert.equal(hostsWhisperReach({ names: ['Ana', 'Ben'], coordinators: 0, viewerIsCoordinator: true }), 'You and the hosts');
  assert.equal(hostsWhisperReach({ names: ['Ana'], coordinators: 1, viewerIsCoordinator: true }), 'You and the hosts');
  assert.equal(hostsWhisperReach({ names: [], coordinators: 0, viewerIsCoordinator: true }), null, 'a coordinator alone is told nobody, not "the hosts"');
  assert.equal(WHISPER_TEAM_REACH, 'Only your team');
  assert.equal(whisperStrip('team', 'Lumina'), 'Whisper · your team only');
  assert.equal(whisperStrip('hosts', 'Lumina'), 'Whisper · Lumina can’t see');
  assert.match(WHISPER_DISPUTE_NOTE, /dispute/, 'the ⓘ does not say staff read it in a dispute (safety review F7)');
  assert.equal(leftWhisperAskBody('the hosts'), 'The hosts will see it.');
});

test('3 · the STORED side decides; only a line from before the column is inferred, and only on the hosts’ side', () => {
  const legacyHost = { viewerRole: 'couple' as const, coHostIds: ['ben'], viewerUserId: 'ana' };
  const legacyShop = { viewerRole: 'vendor' as const, coHostIds: null, viewerUserId: 'sol' };
  // Stored → that side, whatever the list looks like now (a co-host removed since does not drop the label).
  assert.equal(whisperSideOfLine({ sender_user_id: 'ana', recipient_user_ids: ['liza'], whisper_side: 'hosts' }, legacyHost), 'hosts');
  assert.equal(whisperSideOfLine({ sender_user_id: 'sol', recipient_user_ids: ['mara'], whisper_side: 'team' }, legacyShop), 'team');
  // Before the column: exactly the co-hosts, on the host's side → hosts; anywhere else → not a whisper.
  assert.equal(whisperSideOfLine({ sender_role: 'couple', sender_user_id: 'ana', recipient_user_ids: ['ben'] }, legacyHost), 'hosts');
  assert.equal(whisperSideOfLine({ sender_role: 'vendor', sender_user_id: 'sol', recipient_user_ids: ['mara'] }, legacyShop), null);
  assert.equal(whisperSideOfLine({ sender_role: 'couple', sender_user_id: 'ana', recipient_user_ids: null, whisper_side: null }, legacyHost), null);
});

test('4 · a failed read is a failure on BOTH sides — never "no one" — and differs from the empty case', () => {
  const teamFailed = whisperBlockedLine({ coHosts: 0, unread: true, side: 'team' });
  const teamEmpty = whisperBlockedLine({ coHosts: 0, side: 'team' });
  assert.equal(teamFailed, WHISPER_TEAM_UNREAD_LINE);
  assert.equal(teamEmpty, WHISPER_NO_TEAM_LINE);
  assert.notEqual(teamFailed, teamEmpty, 'a failed team read renders identically to an empty team');
  assert.doesNotMatch(WHISPER_TEAM_UNREAD_LINE, /no one|nobody/i);
  assert.equal(whisperBlockedLine({ coHosts: 3, unread: true, side: 'team' }), WHISPER_TEAM_UNREAD_LINE, 'the count beat the failure');
  // The hosts' side keeps its 19 Nov words.
  assert.equal(whisperBlockedLine({ coHosts: 0, unread: true, side: 'hosts' }), WHISPER_UNREAD_LINE);
  assert.equal(whisperBlockedLine({ coHosts: 0, side: 'hosts' }), WHISPER_NOBODY_LINE);
});

test('5 · the page reads: a coordinator gets the hosts’ whisper; a team member the team’s; a stranger none; a failure is unread', async () => {
  const { readHostsWhisper, readTeamWhisper } = await import('./chat-whisper.server');
  const SHOP_OK = {
    vendor_profiles: { data: { user_id: 'sol' }, error: null },
    // The ONE team rule answers from the database: a deactivated 'gone' is never in it.
    'rpc:chat_shop_team_user_ids': { data: ['sol', 'mara'], error: null },
  };
  const HOSTS = {
    chat_thread_members: { data: [{ user_id: 'ana', left_at: null }, { user_id: 'ben', left_at: null }], error: null },
    event_members: { data: [{ user_id: 'ana', member_type: 'couple' }, { user_id: 'ben', member_type: 'couple' }, { user_id: 'liza', member_type: 'coordinator' }], error: null },
    users: { data: [{ user_id: 'ben', first_name: 'Ben', display_name: null }], error: null },
  };
  const at = { threadId: 't', eventId: 'e', vendorProfileId: 'v' };

  const host = await readHostsWhisper(stubClient({ ...SHOP_OK, ...HOSTS }), { ...at, viewerId: 'ana' });
  assert.deepEqual(host?.ids, ['ben', 'liza']);
  assert.equal(host?.reach, 'Only you, Ben and your coordinator');
  assert.deepEqual(host?.legacyCoHostIds, ['ben'], 'old whispers are labelled from the co-hosts, never the coordinator');

  const coordinator = await readHostsWhisper(stubClient({ ...SHOP_OK, ...HOSTS, users: { data: [{ user_id: 'ana', first_name: 'Ana', display_name: null }, { user_id: 'ben', first_name: 'Ben', display_name: null }], error: null } }), { ...at, viewerId: 'liza' });
  assert.deepEqual(coordinator?.ids, ['ana', 'ben'], 'the coordinator cannot whisper with the hosts');
  assert.equal(coordinator?.reach, 'You and the hosts', 'the coordinator’s line is the drawing’s');

  assert.equal(await readHostsWhisper(stubClient({ ...SHOP_OK, ...HOSTS }), { ...at, viewerId: 'stranger' }), null);
  assert.equal(await readHostsWhisper(stubClient({ ...SHOP_OK, ...HOSTS }), { ...at, viewerId: 'sol' }), null, 'the shop gets the hosts’ whisper');
  const hostsFailed = await readHostsWhisper(stubClient({ ...SHOP_OK, ...HOSTS, 'rpc:chat_shop_team_user_ids': REFUSED }), { ...at, viewerId: 'ana' });
  assert.equal(hostsFailed?.unread, true, 'a failed shop read on the hosts’ side is not said as a failure');

  const team = await readTeamWhisper(stubClient(SHOP_OK), { eventId: 'e', vendorProfileId: 'v', viewerId: 'sol' });
  assert.deepEqual(team, { side: 'team', ids: ['mara'], unread: false, reach: 'Only your team', legacyCoHostIds: [] }, 'a deactivated member is on the team list');
  assert.equal(await readTeamWhisper(stubClient(SHOP_OK), { eventId: 'e', vendorProfileId: 'v', viewerId: 'gone' }), null, 'a deactivated member can team-whisper');
  assert.equal(await readTeamWhisper(stubClient(SHOP_OK), { eventId: 'e', vendorProfileId: 'v', viewerId: 'ana' }), null, 'a host gets the team’s whisper');
  const teamFailed = await readTeamWhisper(stubClient({ ...SHOP_OK, 'rpc:chat_shop_team_user_ids': REFUSED }), { eventId: 'e', vendorProfileId: 'v', viewerId: 'sol' });
  assert.deepEqual(teamFailed, { side: 'team', ids: [], unread: true, reach: null, legacyCoHostIds: [] }, 'a failed team read is said as "no one"');
  const hostsReadFailed = await readTeamWhisper(stubClient({ ...SHOP_OK, event_members: REFUSED }), { eventId: 'e', vendorProfileId: 'v', viewerId: 'sol' });
  assert.equal(hostsReadFailed?.unread, true, 'a failed read of the event’s hosts is not said as a failure on the team’s side');
});

test('5b · ONE TEAM RULE: a host who is ALSO on the shop’s team whispers as a host (controller ruling on #8060, 20 Nov)', async () => {
  const { readHostsWhisper, readTeamWhisper } = await import('./chat-whisper.server');
  // Ana hosts the event AND is on the shop's team (a junior member serving it, or its admin — the DB rule says which).
  const ANA_ON_TEAM = {
    vendor_profiles: { data: { user_id: 'sol' }, error: null },
    'rpc:chat_shop_team_user_ids': { data: ['sol', 'mara', 'ana'], error: null },
    chat_thread_members: { data: [{ user_id: 'ana', left_at: null }, { user_id: 'ben', left_at: null }], error: null },
    event_members: { data: [{ user_id: 'ana', member_type: 'couple' }, { user_id: 'ben', member_type: 'couple' }, { user_id: 'liza', member_type: 'coordinator' }], error: null },
    users: { data: [{ user_id: 'ana', first_name: 'Ana', display_name: null }, { user_id: 'ben', first_name: 'Ben', display_name: null }], error: null },
  };
  const at = { threadId: 't', eventId: 'e', vendorProfileId: 'v' };
  const ana = await readHostsWhisper(stubClient(ANA_ON_TEAM), { ...at, viewerId: 'ana' });
  assert.deepEqual(ana?.ids, ['ben', 'liza'], 'a host on the shop’s team is refused the hosts’ whisper');
  const ben = await readHostsWhisper(stubClient(ANA_ON_TEAM), { ...at, viewerId: 'ben' });
  assert.deepEqual(ben?.ids, ['ana', 'liza'], 'a co-host on the shop’s team is left off the hosts’ whisper');
  // …and never on the shop's side here: not offered the team's whisper, never on the team's list.
  assert.equal(await readTeamWhisper(stubClient(ANA_ON_TEAM), { eventId: 'e', vendorProfileId: 'v', viewerId: 'ana' }), null, 'a host is offered the team’s whisper');
  const sol = await readTeamWhisper(stubClient(ANA_ON_TEAM), { eventId: 'e', vendorProfileId: 'v', viewerId: 'sol' });
  assert.deepEqual(sol?.ids, ['mara'], 'a host is on the team’s whisper list');
  assert.deepEqual(teamSideOf({ teamUserIds: ['sol', 'mara', 'ana', 'ana', ''], eventHostIds: ['ana', 'ben'] }), ['sol', 'mara']);
});

test('6 · the composer: the sky Private chip, who it reaches, and the dispute ⓘ — on both sides', async () => {
  const { ChatSendForm } = await import('@/app/_components/chat-send-form');
  const { setWhisper } = await import('@/app/_components/chat/whisper-mode');
  const { setPrivateTo } = await import('@/app/_components/chat/private-to');
  const send = async () => {};
  const T = 'thread-whisper-sides';
  setPrivateTo(T, null);
  setWhisper(T, true);
  const hosts = renderToStaticMarkup(
    h(ChatSendForm, { threadId: T, sendAction: send, whisper: { supplierName: 'Lumina', coHosts: 2, side: 'hosts', reach: 'Only you, Ana and your coordinator' } }),
  );
  const team = renderToStaticMarkup(
    h(ChatSendForm, { threadId: T, sendAction: send, sentAs: 'vendor', whisper: { supplierName: 'the hosts', coHosts: 1, side: 'team', reach: 'Only your team' } }),
  );
  setWhisper(T, false);
  for (const [name, m, reach] of [['hosts', hosts, 'Only you, Ana and your coordinator'], ['team', team, 'Only your team']] as const) {
    assert.match(m, /data-chat-private-chip=""/, `${name}: no Private chip while whispering`);
    assert.ok(m.includes(reach), `${name}: the line does not say who it reaches`);
    assert.match(m, /color-private/, `${name}: the chip is not the sky private look`);
    assert.match(m, new RegExp(`data-chat-whisper-reach="${name}"`));
    // 🔒 The lock on Private — the 20 Nov drawing wins over the 19 Nov "not a lock" (controller, owner delegation 20 Nov):
    // its icon (lucide Lock), inside the sky chip, before the word.
    assert.match(m, /data-chat-private-chip=""[^>]*><svg[^>]*lucide-lock[^>]*>[\s\S]*?<\/svg>Private<\/span>/, `${name}: no lock on Private`);
  }
  assert.match(team, /Whisper to your team only/);
});
