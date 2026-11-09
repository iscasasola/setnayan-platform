/**
 * `openDecision` — the one door to `chat_decision_open()`. Holds: an empty title sends nothing; a refusal
 * (42501) reads "not allowed", any other error or a missing id reads "failed" (never a silent ok).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { openDecision } from './chat-decisions';

function stub(answer: { data: unknown; error: { code: string } | null }) {
  const calls: unknown[] = [];
  const client = { rpc: async (name: string, args: unknown) => { calls.push([name, args]); return answer; } };
  return { client: client as unknown as SupabaseClient, calls };
}

test('an empty title sends nothing', async () => {
  const s = stub({ data: 'x', error: null });
  assert.deepEqual(await openDecision(s.client, 't1', '   '), { ok: false, reason: 'empty' });
  assert.equal(s.calls.length, 0);
});

test('the title is trimmed and capped, and the topic id comes back', async () => {
  const s = stub({ data: 'topic-1', error: null });
  assert.deepEqual(await openDecision(s.client, 't1', `  ${'a'.repeat(200)}  `), { ok: true, topicId: 'topic-1' });
  assert.deepEqual(s.calls[0], ['chat_decision_open', { p_thread_id: 't1', p_title: 'a'.repeat(120) }]);
});

test('a refusal is "not allowed"; anything else is "failed"', async () => {
  assert.deepEqual(await openDecision(stub({ data: null, error: { code: '42501' } }).client, 't', 'Venue'), { ok: false, reason: 'not_allowed' });
  assert.deepEqual(await openDecision(stub({ data: null, error: { code: 'XX000' } }).client, 't', 'Venue'), { ok: false, reason: 'failed' });
  assert.deepEqual(await openDecision(stub({ data: null, error: null }).client, 't', 'Venue'), { ok: false, reason: 'failed' });
});
