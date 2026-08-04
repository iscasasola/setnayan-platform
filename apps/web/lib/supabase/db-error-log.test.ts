/**
 * Tests for the PostgREST failure logger.
 *
 * This wrapper sits on the hot path of EVERY database call in the app, so the
 * load-bearing assertions here are the negative ones: it must not consume the
 * response body, must not alter status or payload, and must never throw — a
 * logger that breaks the query it is observing is worse than no logger.
 *
 * The other half is RA 10173: the log line must not carry PII. A PostgREST URL
 * puts filter values in its query string and the error envelope's `details` can
 * echo row values, so both are asserted absent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLoggingFetch } from './db-error-log';

const REST = 'https://x.supabase.co/rest/v1/';

/** Swap in a stub `fetch`, capture console.error, and always restore both. */
async function withStubs(
  response: () => Response,
  run: (f: ReturnType<typeof createLoggingFetch>) => Promise<void>,
): Promise<string[]> {
  const realFetch = globalThis.fetch;
  const realError = console.error;
  const lines: string[] = [];
  globalThis.fetch = (async () => response()) as typeof fetch;
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  try {
    // A fresh label each call keeps the module-level dedupe from bleeding
    // between tests.
    await run(createLoggingFetch(`t${lines.length}-${Math.random()}`));
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
  }
  return lines;
}

test('a successful response is passed through untouched, body still readable', async () => {
  const lines = await withStubs(
    () => new Response(JSON.stringify([{ id: 1 }]), { status: 200 }),
    async (f) => {
      const res = await f(`${REST}events?select=id`);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), [{ id: 1 }]);
    },
  );
  assert.deepEqual(lines, [], 'a 200 must not log');
});

test('a failed response is logged AND its body is still readable by the caller', async () => {
  const body = JSON.stringify({
    code: '42P01',
    message: 'relation "public.schedule_blocks" does not exist',
  });
  const lines = await withStubs(
    () => new Response(body, { status: 404 }),
    async (f) => {
      const res = await f(`${REST}schedule_blocks?select=label`);
      // The whole point of clone(): the caller's body must be unconsumed.
      assert.deepEqual(await res.json(), JSON.parse(body));
    },
  );
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /404/);
  assert.match(lines[0]!, /42P01/);
  assert.match(lines[0]!, /schedule_blocks/);
});

test('RA 10173 — the query string is stripped and `details` is never logged', async () => {
  const lines = await withStubs(
    () =>
      new Response(
        JSON.stringify({
          code: '42703',
          message: 'column events.venue does not exist',
          details: 'Row: (maria.santos@example.com, 09171234567)',
        }),
        { status: 400 },
      ),
    async (f) => {
      await f(`${REST}events?email=eq.maria.santos%40example.com&phone=eq.09171234567`);
    },
  );
  assert.equal(lines.length, 1);
  const line = lines[0]!;
  assert.ok(!line.includes('maria.santos'), 'no PII from the query string or details');
  assert.ok(!line.includes('09171234567'), 'no phone number');
  assert.ok(!line.includes('Row:'), '`details` must not be logged');
  // The useful part — which relation and which column — must survive.
  assert.match(line, /\/rest\/v1\/events/);
  assert.match(line, /column events\.venue does not exist/);
});

test('auth failures are not logged — an expired refresh token is an ordinary path', async () => {
  const lines = await withStubs(
    () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }),
    async (f) => {
      await f('https://x.supabase.co/auth/v1/token?grant_type=refresh_token');
    },
  );
  assert.deepEqual(lines, []);
});

test('identical failures collapse to one line', async () => {
  const realFetch = globalThis.fetch;
  const realError = console.error;
  const lines: string[] = [];
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ code: '42703', message: 'boom' }), {
      status: 400,
    })) as typeof fetch;
  console.error = (...args: unknown[]) => lines.push(args.map(String).join(' '));
  try {
    const f = createLoggingFetch('dedupe-probe');
    await f(`${REST}events?select=a`);
    await f(`${REST}events?select=a`);
    await f(`${REST}events?select=a`);
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
  }
  assert.equal(lines.length, 1, 'the same failure repeats once per render tree; log it once');
});

test('a non-JSON error body does not throw, and is capped', async () => {
  const lines = await withStubs(
    () => new Response('<html>' + 'x'.repeat(5000) + '</html>', { status: 502 }),
    async (f) => {
      const res = await f(`${REST}events`);
      assert.equal(res.status, 502);
    },
  );
  assert.equal(lines.length, 1);
  assert.ok(lines[0]!.length < 700, 'a huge HTML error page must not flood the log');
});

test('a logger failure never propagates to the caller', async () => {
  const realFetch = globalThis.fetch;
  const realError = console.error;
  globalThis.fetch = (async () =>
    new Response('{}', { status: 400 })) as typeof fetch;
  console.error = () => {
    throw new Error('logging sink exploded');
  };
  try {
    const res = await createLoggingFetch('throwing-sink')(`${REST}events`);
    assert.equal(res.status, 400, 'the caller still gets its response');
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
  }
});
