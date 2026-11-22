/**
 * ⏰ NO DUE REMINDER IS LOST (#8071 review, controller 21 Nov 2026). `claim_my_due_chat_reminders` marks EVERY due
 * reminder delivered; the delivery read only the first 20, so with 21 or more due the rest were claimed and never told.
 * The real `deliverDueChatReminders` against an in-memory table: 25 due → 25 told; one that falls due between the read
 * and the claim → told too; a refused message read → nothing claimed.
 * Run from apps/web: npx tsx --test lib/no-due-reminder-is-lost.test.ts
 *
 * Sabotage, run 21 Nov: skipping the late read turns test 3 red; capping the due read at 20 again turns the source
 * guard in lib/a-chat-reminder-stays-in-the-app.test.ts red (the late read alone would still tell all 25).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { SupabaseClient } from '@supabase/supabase-js';

/* ── `server-only` shim (the shape of lib/a-crew-tag-reaches-the-suppliers-day.test.ts) ── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub_due_reminders__.js');
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

type Rem = { reminder_id: string; message_id: string; thread_id: string; side: 'vendor'; delivered: boolean };

function fake(n: number, opts: { lateOne?: boolean; refuseMessages?: boolean } = {}) {
  const rems: Rem[] = Array.from({ length: n }, (_, i) => ({ reminder_id: `r${i}`, message_id: `m${i}`, thread_id: 't1', side: 'vendor', delivered: false }));
  const msg = (id: string) => ({ message_id: id, thread_id: 't1', event_id: 'e1', vendor_profile_id: 'v1', body: `hello ${id}`, attachment_name: null, attachment_mime: null, voice_seconds: null, unsent_at: null });
  let claims = 0;
  const client = {
    from(table: string) {
      if (table === 'chat_message_reminders') {
        const q = {
          select: () => q,
          eq: () => q,
          is: () => q,
          lte: () => q,
          order: () => q,
          limit: (k: number) => Promise.resolve({ data: rems.filter((r) => !r.delivered).slice(0, k), error: null }),
          range: (a: number, b: number) => Promise.resolve({ data: rems.filter((r) => !r.delivered).slice(a, b + 1), error: null }),
        };
        return q;
      }
      return {
        select: () => ({
          in: (_c: string, ids: string[]) =>
            Promise.resolve(opts.refuseMessages ? { data: null, error: { message: 'refused' } } : { data: ids.map(msg), error: null }),
        }),
      };
    },
    rpc(name: string) {
      assert.equal(name, 'claim_my_due_chat_reminders');
      claims += 1;
      // One more falls due between the read and the claim — the claim takes it too.
      if (opts.lateOne) rems.push({ reminder_id: 'late', message_id: 'm-late', thread_id: 't1', side: 'vendor', delivered: false });
      const due = rems.filter((r) => !r.delivered);
      for (const r of due) r.delivered = true;
      return Promise.resolve({ data: due.map(({ delivered: _d, ...r }) => r), error: null });
    },
  } as unknown as SupabaseClient;
  const told: string[] = [];
  const deps = {
    notify: (async (n: { body?: string | null }) => {
      told.push(String(n.body));
    }) as unknown as import('./chat-reminders.server').ReminderDeps['notify'],
    admin: () => client,
  };
  return { client, deps, told, claimsOf: () => claims, rems };
}

test('1 · 25 due reminders: every one is told, none is claimed unread', async () => {
  const f = fake(25);
  const n = await server.deliverDueChatReminders(f.client, 'u1', f.deps);
  assert.equal(n, 25, `told ${n} of 25 — the rest were claimed and lost`);
  assert.equal(f.told.length, 25);
  assert.ok(f.rems.every((r) => r.delivered));
});

test('2 · more than one page (450 due) is read whole', async () => {
  const f = fake(450);
  assert.equal(await server.deliverDueChatReminders(f.client, 'u1', f.deps), 450);
});

test('3 · one that falls due between the read and the claim is still told', async () => {
  const f = fake(3, { lateOne: true });
  assert.equal(await server.deliverDueChatReminders(f.client, 'u1', f.deps), 4);
  assert.ok(f.told.some((t) => t.includes('m-late')), 'the late reminder was claimed and never told');
});

test('4 · a refused message read claims nothing — every reminder stays due', async () => {
  const f = fake(25, { refuseMessages: true });
  assert.equal(await server.deliverDueChatReminders(f.client, 'u1', f.deps), 0);
  assert.equal(f.claimsOf(), 0, 'a refused read ate the reminders');
  assert.ok(f.rems.every((r) => !r.delivered));
});
