/**
 * 🔔 THE BELL COUNTS BESIDE THE REMINDERS (speed audit L1, 24 Nov 2026 · build-sessions/SPEED-AUDIT-2026-11-24.md).
 *
 * What it caught: every signed-in shell ran `deliverDueChatReminders(…).then(() => countUnread(…))`. The count waited
 * for the delivery, so an open with nothing due (nearly every open) paid two trips in a row before the bell could draw,
 * on all the event pages, the account pages and the signed-in public pages. A due reminder then cost one more trip per
 * reminder, told one after another. And the public shell's bell and switcher only started after the rail's own reads.
 *
 * What is held:
 *   1 · nothing due → the count is asked BESIDE the due read (before it answers), once, and the bell shows it;
 *   2 · reminders told → the count is asked again AFTER every notice, so the bell includes them;
 *   3 · that second ask refused → the first measured count plus the notices this request added (never a bare 0);
 *   4 · the notices go out together, not one after another, and one that fails is not counted;
 *   5 · the shell uses the one-round helper, and the helper's re-ask is the UNCACHED count (`countUnread` is a
 *       per-render `cache()`: asking it again would hand back the answer from before the notices);
 *   6 · the public shell starts the signed-in cluster's reads beside its own (`preloadSignedInCluster`).
 *
 * Sabotage (each seen red, then restored): the helper awaiting the delivery before the count (1) · the re-ask through
 * `countUnread` (5) · `getDashboardShell` back on the `.then` chain (5) · the notices back in a `for … await` loop (4) ·
 * the preload removed from `app/(shell)/layout.tsx` (6).
 *
 * Run from apps/web: npx tsx --test lib/the-bell-counts-beside-the-reminders.test.ts
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from './strip-comments';

/* ── `server-only` shim (the shape of lib/no-due-reminder-is-lost.test.ts) ── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub_bell_beside__.js');
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

let server: typeof import('./chat-reminders.server');
before(async () => {
  server = await import('./chat-reminders.server');
});

const tick = () => new Promise((r) => setImmediate(r));

/** An in-memory client that writes down the order things happen in. */
function fake(opts: { due: number; counts: Array<number | 'refused'>; failNotice?: number }) {
  const log: string[] = [];
  const rems = Array.from({ length: opts.due }, (_, i) => ({ reminder_id: `r${i}`, message_id: `m${i}`, thread_id: 't1', side: 'vendor' as const }));
  let countAsks = 0;
  const client = {
    from(table: string) {
      if (table === 'chat_message_reminders') {
        const q = {
          select: () => q,
          eq: () => q,
          is: () => q,
          lte: () => q,
          order: () => q,
          range: async () => {
            log.push('due:asked');
            await tick();
            await tick();
            log.push('due:answered');
            return { data: rems, error: null };
          },
        };
        return q;
      }
      if (table === 'notifications') {
        const q = {
          select: () => q,
          eq: () => q,
          is: async () => {
            const n = countAsks++;
            log.push(`count:${n}`);
            const v = opts.counts[n];
            return v === 'refused' || v === undefined ? { count: null, error: { message: 'refused' } } : { count: v, error: null };
          },
        };
        return q;
      }
      return {
        select: () => ({
          in: async (_c: string, ids: string[]) => ({
            data: ids.map((id) => ({ message_id: id, thread_id: 't1', event_id: 'e1', vendor_profile_id: 'v1', body: `hi ${id}`, attachment_name: null, attachment_mime: null, voice_seconds: null, unsent_at: null })),
            error: null,
          }),
        }),
      };
    },
    async rpc(name: string) {
      assert.equal(name, 'claim_my_due_chat_reminders');
      log.push('claim');
      return { data: rems, error: null };
    },
  } as unknown as SupabaseClient;
  let inFlight = 0;
  let maxInFlight = 0;
  let notices = 0;
  const deps = {
    notify: (async (n: { body?: string | null }) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      log.push(`notice:start ${n.body}`);
      await tick();
      inFlight -= 1;
      notices += 1;
      if (opts.failNotice !== undefined && notices === opts.failNotice) throw new Error('notice refused');
      log.push(`notice:done ${n.body}`);
    }) as unknown as import('./chat-reminders.server').ReminderDeps['notify'],
    admin: () => client,
  };
  return { client, deps, log, maxInFlight: () => maxInFlight, countAsks: () => countAsks };
}

test('1 · nothing due: the count is asked beside the due read, once, and the bell shows it', async () => {
  const f = fake({ due: 0, counts: [7] });
  const n = await server.unreadCountWithDueReminders(f.client, 'u1', f.deps);
  assert.equal(n, 7);
  assert.equal(f.countAsks(), 1, 'the count was asked twice with nothing told');
  assert.ok(f.log.indexOf('count:0') < f.log.indexOf('due:answered'), `the count waited for the delivery: ${f.log.join(' → ')}`);
});

test('2 · reminders told: the count is asked again after every notice, and the bell includes them', async () => {
  const f = fake({ due: 2, counts: [7, 9] });
  const n = await server.unreadCountWithDueReminders(f.client, 'u1', f.deps);
  assert.equal(n, 9, 'the bell drew the count from before the notices');
  const recount = f.log.indexOf('count:1');
  const lastNotice = Math.max(...f.log.map((e, i) => (e.startsWith('notice:done') ? i : -1)));
  assert.ok(recount > lastNotice, `the second count ran before the notices: ${f.log.join(' → ')}`);
});

test('3 · the second count refused: the first measured count plus the notices this request added', async () => {
  const f = fake({ due: 2, counts: [7, 'refused'] });
  assert.equal(await server.unreadCountWithDueReminders(f.client, 'u1', f.deps), 9);
});

test('4 · the notices go out together, and one that fails is not counted', async () => {
  const f = fake({ due: 3, counts: [0, 0] });
  assert.equal(await server.deliverDueChatReminders(f.client, 'u1', f.deps), 3);
  assert.equal(f.maxInFlight(), 3, 'the notices went out one after another');

  const g = fake({ due: 3, counts: [0, 0], failNotice: 2 });
  assert.equal(await server.deliverDueChatReminders(g.client, 'u1', g.deps), 2, 'a failed notice was counted, or stopped the rest');
});

const WEB = process.cwd();
const src = (...p: string[]) => stripComments(readFileSync(join(WEB, ...p), 'utf8'));

test('5 · the shell asks in one round, and the helper re-asks the UNCACHED count', () => {
  const shell = src('lib', 'dashboard-shell.ts');
  assert.match(shell, /unreadCountWithDueReminders\(supabase, userId\)/, 'getDashboardShell no longer uses the one-round bell count');
  assert.doesNotMatch(shell, /\.then\(\(\) => countUnread\(/, 'getDashboardShell waits for the delivery before it counts again');

  const lib = src('lib', 'chat-reminders.server.ts');
  const helper = lib.slice(lib.indexOf('export async function unreadCountWithDueReminders('));
  assert.ok(helper.length > 0, 'the helper moved — this guard is blind');
  assert.match(helper, /await Promise\.all\(\[deliverDueChatReminders\(supabase, userId, deps\), countUnread\(supabase, userId\)\]\)/, 'the count no longer starts beside the delivery');
  assert.match(helper, /if \(told === 0\) return counted;/);
  assert.match(helper, /await readUnreadNotificationCount\(supabase, userId\)/, 'the re-ask is not the uncached count');
  assert.doesNotMatch(helper.slice(helper.indexOf('if (told === 0)')), /countUnread\(/, 'the re-ask goes through the per-render cache and returns the stale count');
});

test('6 · the public shell starts the signed-in cluster beside its own reads', () => {
  const layout = src('app', '(shell)', 'layout.tsx');
  assert.match(layout, /\n {2}preloadSignedInCluster\(\);\n {2}return <AppRailShell variant="doorway">/, 'the cluster waits for the rail again');
  const cluster = src('app', '_components', 'frontdoor', 'signed-in-cluster.tsx');
  const preload = cluster.slice(cluster.indexOf('export function preloadSignedInCluster('), cluster.indexOf('export async function SignedInCluster('));
  assert.match(preload, /getCurrentUser\(\)/);
  assert.match(preload, /if \(!user\) return;/, 'the preload reads for a signed-out visitor');
  assert.match(preload, /getDashboardShell\(user\.id\)/, 'the preload no longer starts the bell');
  assert.match(preload, /getSwitcherData\(user\.id\)/, 'the preload no longer starts the switcher');
  // The cluster must read the SAME per-request promises the preload started.
  assert.match(cluster, /getDashboardShell\(user\.id\)\.catch/);
  assert.match(cluster, /getSwitcherData\(user\.id\)\.catch/);
});
