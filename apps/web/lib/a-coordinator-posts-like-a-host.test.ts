/**
 * 🗣 A COORDINATOR POSTS LIKE A HOST — the 9 Nov ruling, upheld by the controller under owner delegation 20 Nov
 * (Unichat part E). The database already admits a coordinator's line (chat_messages_member_insert → current_thread_ids;
 * tg_chat_messages_derive_sender stamps 'coordinator') — proven in tests/db/a-removed-member-reads-nothing.db.test.ts.
 * This file holds the APP half, where the send core used to refuse them as `not_member` unless they whispered:
 *
 *   1 · the send core admits the event's coordinator for ANY line, on the hosts' side — not only a whisper;
 *   2 · it never asks the database for a side they do not hold (a 'couple' ask would be refused);
 *   3 · the hosts' side shares ONE pre-accept allowance — the couple's lines and the coordinator's — in the send core
 *       AND the page's mirror, so the box and the server agree;
 *   4 · `countCoordinatorMessages` counts exactly that thread's coordinator lines.
 *
 * Sabotage (20 Nov): put `input.whisper && ` back in front of the coordinator check → 1 RED; drop
 * `&& !senderIsCoordinator` → 2 RED; count only 'couple' on the page → 3 RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from './strip-comments';
import { countCoordinatorMessages } from './chat';

const HERE = dirname(fileURLToPath(import.meta.url)); // apps/web/lib
const read = (rel: string) => stripComments(readFileSync(join(HERE, '..', rel), 'utf8'));
const send = read('lib/chat-send.ts');

test('1 · the send core admits the coordinator for any line, on the hosts’ side', () => {
  assert.match(
    send,
    /\} else if \(await readIsCoordinator\(supabase, thread\.event_id, user\.id\)\) \{\s*senderRole = 'couple';\s*senderIsCoordinator = true;\s*\} else \{\s*return \{ ok: false, code: 'not_member'/,
    'the coordinator is not admitted just before not_member, on the hosts’ side',
  );
  assert.doesNotMatch(send, /input\.whisper && \(await readIsCoordinator/, 'a coordinator is admitted for a whisper ONLY');
});

test('2 · a coordinator never asks for a side they do not hold', () => {
  assert.match(send, /const sidePayload = asSide && !senderIsCoordinator\s*\?/, 'a coordinator’s line carries sent_as — the database refuses it');
});

test('3 · the hosts’ side shares one pre-accept allowance, in the core and the page', () => {
  assert.match(
    send,
    /const \[coupleLines, coordinatorLines\] = await Promise\.all\(\[\s*countCoupleMessages\(admin, thread\.thread_id\),\s*countCoordinatorMessages\(admin, thread\.thread_id\),\s*\]\);\s*priorMessageCount = coupleLines \+ coordinatorLines;/,
    'the send core counts only the couple’s lines — a coordinator could post past the allowance',
  );
  const page = read('app/dashboard/[eventId]/messages/[threadId]/page.tsx');
  assert.match(
    page,
    /const coupleMsgCount = initialMessages\.filter\(\s*\(m\) => m\.sender_role === 'couple' \|\| m\.sender_role === 'coordinator',\s*\)\.length;/,
    'the page’s mirror does not count the coordinator — the box and the server disagree',
  );
});

test('4 · countCoordinatorMessages counts one thread’s coordinator lines', async () => {
  const rows = [
    { sender_role: 'coordinator', thread_id: 't1' },
    { sender_role: 'coordinator', thread_id: 't1' },
    { sender_role: 'couple', thread_id: 't1' },
    { sender_role: 'coordinator', thread_id: 't2' },
  ];
  const filters: Record<string, unknown> = {};
  const builder: Record<string, unknown> = {
    from: () => builder,
    select: () => builder,
    eq: (col: string, val: unknown) => {
      filters[col] = val;
      return builder;
    },
    then: (resolve: (v: { count: number; error: null }) => unknown) =>
      Promise.resolve({
        count: rows.filter((r) => r.sender_role === filters.sender_role && r.thread_id === filters.thread_id).length,
        error: null,
      }).then(resolve),
  };
  assert.equal(await countCoordinatorMessages(builder as unknown as SupabaseClient, 't1'), 2);
  assert.deepEqual(filters, { thread_id: 't1', sender_role: 'coordinator' });
});
