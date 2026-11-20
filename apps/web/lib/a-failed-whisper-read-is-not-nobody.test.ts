/**
 * 🤫 A FAILED WHISPER READ IS NOT "NOBODY IS HERE" — the follow-up to PR #8040 (a removed co-host reads no chat).
 *
 * `readThreadHostPeople` reads who is in a supplier chat. When either of its two reads was refused it returned empty
 * lists — safe for who is TOLD about a message (narrower, never wider), but then the whisper box and the send core
 * SAID it: "No co-host is in this chat to whisper to" — to a host whose co-hosts were all there. A failure rendered
 * identically to emptiness, the disease this repo's honest-read guards exist for (the pattern is `lib/guests.ts` +
 * `lib/guests-read-is-honest.test.ts`).
 *
 * Proven here, against a stubbed client (behaviour, not only source):
 *   1 · a refused read reports `measured: false`; an honest empty chat reports `measured: true`;
 *   2 · the page's read turns the failure into `unread`, the empty chat into `{ ids: [] }` — two different states;
 *   3 · the box says DIFFERENT words for the two, and the failure wins over the count;
 *   4 · the send core refuses a whisper on a failed read with its own words, before "no co-host";
 *   5 · the page hands `unread` to the box and never labels whispers from a list it did not read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path, { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from './strip-comments';
import {
  WHISPER_NOBODY_LINE,
  WHISPER_NO_COHOSTS_MESSAGE,
  WHISPER_UNREAD_LINE,
  WHISPER_UNREAD_MESSAGE,
  whisperBlockedLine,
} from './chat-whisper';

/* ── `server-only` shim (the shape of lib/a-booking-freezes-the-plan-it-agreed-to.test.ts) ── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub_whisper_read__.js');
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

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

type Res = { data: unknown; error: unknown };
/** A client whose every table answers what `tables` says; chained filters return the same builder. */
function stubClient(tables: Record<string, Res>): SupabaseClient {
  return {
    from(table: string) {
      const result = tables[table] ?? { data: [], error: null };
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit', 'maybeSingle']) b[m] = () => b;
      b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
      return b;
    },
  } as unknown as SupabaseClient;
}

const REFUSED = { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } };
const T = { threadId: 't1', eventId: 'e1' };
const WHO = { ...T, vendorProfileId: 'v1', viewerId: 'ana' };
const SHOP = { vendor_profiles: { data: { user_id: 'sol' }, error: null }, vendor_team_members: { data: [], error: null } };

test('1 · a refused read is measured:false — an honest empty chat is measured:true', async () => {
  const { readThreadHostPeople } = await import('./chat-shop-people.server');

  for (const failing of ['chat_thread_members', 'event_members']) {
    const out = await readThreadHostPeople(stubClient({ [failing]: REFUSED }), T);
    assert.equal(out.measured, false, `a refused ${failing} read reports itself as measured`);
    assert.deepEqual(out.members, [], 'and still lists nobody — narrower, never wider');
  }

  const alone = await readThreadHostPeople(
    stubClient({
      chat_thread_members: { data: [{ user_id: 'ana', left_at: null }], error: null },
      event_members: { data: [{ user_id: 'ana', member_type: 'couple' }], error: null },
    }),
    T,
  );
  assert.equal(alone.measured, true);
  assert.deepEqual(alone.members, ['ana']);
});

test('2 · the page read: a failure is `unread`, an empty chat is `{ ids: [] }` — two states, never one', async () => {
  const { readWhisperCoHostIds } = await import('./chat-whisper.server');

  const failed = await readWhisperCoHostIds(stubClient({ ...SHOP, event_members: REFUSED }), WHO);
  assert.deepEqual(failed, { ids: [], unread: true }, 'a failed read is reported as unread');

  const empty = await readWhisperCoHostIds(
    stubClient({
      ...SHOP,
      chat_thread_members: { data: [{ user_id: 'ana', left_at: null }], error: null },
      event_members: { data: [{ user_id: 'ana', member_type: 'couple' }], error: null },
    }),
    WHO,
  );
  assert.deepEqual(empty, { ids: [], unread: false }, 'a host alone in the chat is an honest empty list');

  const two = await readWhisperCoHostIds(
    stubClient({
      ...SHOP,
      chat_thread_members: { data: [{ user_id: 'ana', left_at: null }, { user_id: 'bea', left_at: null }], error: null },
      event_members: { data: [{ user_id: 'ana', member_type: 'couple' }, { user_id: 'bea', member_type: 'couple' }], error: null },
    }),
    WHO,
  );
  assert.deepEqual(two, { ids: ['bea'], unread: false });
});

test('3 · the box says different words for a failed read and an empty chat', () => {
  const failed = whisperBlockedLine({ coHosts: 0, unread: true });
  const empty = whisperBlockedLine({ coHosts: 0 });
  assert.equal(failed, WHISPER_UNREAD_LINE);
  assert.equal(empty, WHISPER_NOBODY_LINE);
  assert.notEqual(failed, empty, 'a failure renders identically to emptiness');
  assert.doesNotMatch(WHISPER_UNREAD_LINE, /no co-host/i, 'the failure line claims nobody is here');
  // The failure wins over whatever count rode along with it; a real count with a good read lets the drag through.
  assert.equal(whisperBlockedLine({ coHosts: 2, unread: true }), WHISPER_UNREAD_LINE);
  assert.equal(whisperBlockedLine({ coHosts: 2 }), null);
  assert.equal(whisperBlockedLine({ coHosts: 2, unread: false }), null);

  // The send core's words differ too.
  assert.notEqual(WHISPER_UNREAD_MESSAGE, WHISPER_NO_COHOSTS_MESSAGE);
  assert.doesNotMatch(WHISPER_UNREAD_MESSAGE, /no co-host/i);
  assert.match(WHISPER_UNREAD_MESSAGE, /not sent/, 'the failure still says the whisper was not sent');

  // The box asks the one rule (sabotage: put back `if (whisper.coHosts <= 0)` and this goes red).
  const form = read('app/_components/chat-send-form.tsx');
  const sw = form.slice(form.indexOf('const switchWhisper = () => {'), form.indexOf('const hasPrivateTo'));
  assert.match(sw, /const blocked = whisperBlockedLine\(whisper\);\s*if \(blocked\) \{\s*sayForAMoment\(blocked\);/);
  assert.doesNotMatch(sw, /whisper\.coHosts <= 0/, 'a second, count-only check is back beside the rule');
});

test('4 · the send core refuses a whisper on a failed read with its own words — before "no co-host"', () => {
  const core = read('lib/chat-send.ts');
  const at = core.indexOf('if (input.whisper) {');
  const block = core.slice(at, core.indexOf('const privateList = (', at));
  const unread = block.indexOf("if (!hostPeople.measured) {\n      return { ok: false, code: 'whisper_refused', message: WHISPER_UNREAD_MESSAGE };");
  assert.ok(unread > 0, 'a failed read is not refused with its own words');
  assert.ok(unread < block.indexOf('whisperTo = whisperRecipients('), 'the failed read is checked before the list is built');
});

test('5 · the page hands `unread` to the box and labels whispers only from a list it read', () => {
  const page = read('app/dashboard/[eventId]/messages/[threadId]/page.tsx');
  assert.match(page, /\.catch\(\(e: unknown\) => \{\s*console\.error\('\[couple thread\] whisper co-hosts read failed', e\);\s*return WHISPER_CO_HOSTS_UNREAD;/,
    'a thrown read is dropped as "no whisper" instead of said as a failure');
  assert.match(page, /const whisperCoHostIds = whisperCoHosts && !whisperCoHosts\.unread \? whisperCoHosts\.ids : null;/);
  assert.match(page, /whisper=\{whisperCoHosts \? \{ supplierName: vendorLabel, coHosts: whisperCoHosts\.ids\.length, unread: whisperCoHosts\.unread \} : null\}/);
  const server = read('lib/chat-whisper.server.ts');
  assert.match(server, /if \(!hostPeople\.measured\) return WHISPER_CO_HOSTS_UNREAD;/);
  const people = read('lib/chat-shop-people.server.ts');
  assert.match(people, /measured: !membersRes\.error && !peopleRes\.error/);
});
