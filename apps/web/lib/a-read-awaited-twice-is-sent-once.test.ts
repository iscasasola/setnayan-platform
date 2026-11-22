/**
 * a-read-awaited-twice-is-sent-once.test.ts — ⚡ A SUPABASE BUILDER IS NOT A PROMISE.
 *
 * Opus review of the wave 5 speed pass (2026-11-18). `readPostEventForMaker` started the `events` row as a bare
 * query builder and then consumed it TWICE — once to chain the back cover, once inside the `Promise.all`. A builder
 * sends a NEW request every time its `then` is called, so the "read once, used twice" row was read twice: the speed
 * pass added a database trip to the page it set out to make faster. Wrapping it in `Promise.resolve` sends it once.
 *
 * The first test proves the mechanism with the real client and a counting `fetch`; the second holds the file.
 * The third holds the supplier Files section: the filed-ids promise derived from the files read must carry its own
 * rejection handler, or a files read that throws also leaves an unhandled rejection behind it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const WEB = join(__dirname, '..');

function countingClient() {
  let sent = 0;
  const fetchCounting: typeof fetch = async () => {
    sent += 1;
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const client = createClient('http://127.0.0.1:1', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchCounting },
  });
  return { client, sent: () => sent };
}

test('a bare builder consumed twice is sent twice; Promise.resolve sends it once', async () => {
  const bare = countingClient();
  const builder = bare.client.from('events').select('event_id').eq('event_id', 'x');
  await Promise.all([Promise.resolve(builder).then(() => null), builder]);
  assert.equal(bare.sent(), 2, 'the mechanism this test guards against: each `then` is a request');

  const once = countingClient();
  const started = Promise.resolve(once.client.from('events').select('event_id').eq('event_id', 'x'));
  await Promise.all([started.then(() => null), started]);
  assert.equal(once.sent(), 1);
});

test('readPostEventForMaker starts its events row ONCE (it is consumed twice)', () => {
  const src = readFileSync(join(WEB, 'lib/post-event-compile.server.ts'), 'utf8');
  const m = /const eventRead = ([\s\S]*?);\n/.exec(src);
  assert.ok(m, '`eventRead` is still declared in readPostEventForMaker');
  assert.match(m![1]!.trimStart(), /^(Promise\.resolve|startAhead|startRead)\(/, 'eventRead must be a started promise, not a bare builder');
});

test('the Files section: the filed ids derived from the files read cannot reject unhandled', () => {
  const src = readFileSync(join(WEB, 'app/vendor-dashboard/clients/[eventId]/_pages/event-files.tsx'), 'utf8');
  const m = /const filedIds = filesRead\.then\(([\s\S]*?)\n\s*\);\n/.exec(src);
  assert.ok(m, 'the filed ids are derived from `filesRead`');
  assert.match(m![1]!, /,\s*\(\)\s*=>\s*new Set<string>\(\)\s*,?\s*$/, 'the derived promise carries its own rejection handler');
});
