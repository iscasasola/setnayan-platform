/**
 * a-connection-that-never-opened-is-tried-again.test.ts — ONE RETRY, AT ONCE, AND ONLY WHERE SENDING
 * TWICE CANNOT DO ANYTHING TWICE (stability sweep 2, 2026-10-16).
 *
 * Production recorded `TypeError: fetch failed (ECONNRESET: Client network socket disconnected before
 * secure TLS connection was established)` on `rpc/record_app_fault` — a POST, which postgrest-js never
 * retries — and `write ETIMEDOUT` / `other side closed` beside it. The fetch layer every server Supabase
 * client rides (`createLoggingFetch`) now tries once more, on a fresh connection, when:
 *   · the request never left (refused · DNS · connect timeout · reset before TLS) — any method;
 *   · the connection dropped after it may have been sent — a READ only.
 * The failure is recorded only when the retry fails too.
 *
 * SABOTAGE (2026-10-16): retry a dropped POST → RED; drop the retry → RED; record a failure the retry
 * absorbed → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoggingFetch, worthOneRetry, type DbFaultSink } from './db-error-log';

const URL_RPC = 'https://x.supabase.co/rest/v1/rpc/record_app_fault';
const URL_READ = 'https://x.supabase.co/rest/v1/events?select=event_id';

function transport(code: string, message: string): TypeError {
  const e = new TypeError('fetch failed');
  (e as { cause?: unknown }).cause = Object.assign(new Error(message), { code });
  return e;
}
const TLS_RESET = () => transport('ECONNRESET', 'Client network socket disconnected before secure TLS connection was established');
const DROPPED = () => transport('UND_ERR_SOCKET', 'other side closed');

/** A network that fails the first `failures` sends with `make()`, then answers 200. */
async function over(failures: number, make: () => Error, url: string, init: RequestInit) {
  const real = globalThis.fetch;
  const realWarn = console.warn;
  let sends = 0;
  const recorded: string[] = [];
  const sink: DbFaultSink = { verdict: () => {}, unreachable: (target) => recorded.push(target) };
  globalThis.fetch = (async () => {
    sends += 1;
    if (sends <= failures) throw make();
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  console.warn = () => {};
  try {
    const res = await createLoggingFetch(`retry-${Math.random()}`, sink)(url, init).then(
      (r) => r.status,
      (e: unknown) => (e as Error).message,
    );
    return { res, sends, recorded };
  } finally {
    globalThis.fetch = real;
    console.warn = realWarn;
  }
}

test('a reset BEFORE TLS is retried for any method — the server never saw it — and nothing is recorded', async () => {
  const r = await over(1, TLS_RESET, URL_RPC, { method: 'POST', body: '{"p_kind":"x"}' });
  assert.equal(r.res, 200, 'the recorder’s own POST was lost to a connection that never opened');
  assert.equal(r.sends, 2);
  assert.deepEqual(r.recorded, [], 'a failure the retry absorbed was filed as a fault');
});

test('a connection dropped after sending is retried for a READ, never for a POST', async () => {
  const read = await over(1, DROPPED, URL_READ, { method: 'GET' });
  assert.equal(read.res, 200);
  assert.equal(read.sends, 2);
  const write = await over(1, DROPPED, URL_RPC, { method: 'POST', body: '{}' });
  assert.equal(write.sends, 1, 'a POST that may already have landed was sent twice');
  assert.equal(write.res, 'fetch failed');
  assert.deepEqual(write.recorded, ['rpc/record_app_fault']);
});

test('ONE retry only — a second failure is recorded and thrown', async () => {
  const r = await over(5, TLS_RESET, URL_READ, { method: 'GET' });
  assert.equal(r.sends, 2, 'more than one immediate retry');
  assert.equal(r.res, 'fetch failed');
  assert.deepEqual(r.recorded, ['events']);
});

test('never an abort, never a stream body', async () => {
  const abort = new Error('This operation was aborted');
  abort.name = 'AbortError';
  assert.equal(worthOneRetry(abort, 'GET'), false, 'a read limit or a caller’s abort was retried');
  assert.equal(worthOneRetry(TLS_RESET(), 'PATCH'), true);
  assert.equal(worthOneRetry(transport('ECONNREFUSED', 'connect ECONNREFUSED'), 'DELETE'), true);
  assert.equal(worthOneRetry(transport('ETIMEDOUT', 'write ETIMEDOUT'), 'POST'), false);
  assert.equal(worthOneRetry(transport('ETIMEDOUT', 'write ETIMEDOUT'), 'GET'), true);
  const stream = await over(1, TLS_RESET, URL_RPC, { method: 'POST', body: new ReadableStream() as unknown as BodyInit });
  assert.equal(stream.sends, 1, 'a body that cannot be re-read was sent again');
});
