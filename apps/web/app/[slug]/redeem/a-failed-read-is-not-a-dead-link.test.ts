/**
 * a-failed-read-is-not-a-dead-link.test.ts — the personal link is never called
 * WRONG because a database read FAILED. (app/[slug]/redeem/route.ts has the
 * story, at `didNotLoadAnswer`.)
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * `const { data: keyRow } = await admin.from('guests')…maybeSingle()` threw the
 * error away. A failed read resolves with `data: null` — the same value as "no
 * row has this code" — so the guest was redirected to
 * `?invite_error=invalid_token`: "That invite link doesn't look right — it may
 * have been replaced". Every link and QR arrival passes through this route.
 *
 * ── What is proven, and how ────────────────────────────────────────────────
 * The REAL `GET` is driven with `globalThis.fetch` replaced, so every database
 * read answers what the test scripts for its table (the harness of
 * lib/guest-pass-hop.test.ts § 9). Asserted on the RESPONSE, not on a phrasing
 * in the source:
 *   1 · a failed `events` read ............ answered in place, never redirected
 *   2 · a failed `guests` (code) read ..... answered in place, never `invalid_token`
 *   3 · a read that ANSWERS "no row" ...... `invalid_token`, exactly as before
 *   4 · a blip that passes on a retry ..... carries on; the guest never sees it
 *   5 · a fetch that never answers ........ answered in place
 *   5b· a throw anywhere after the reads .. answered in place (no blank 500)
 *   6 · the answer's "Try again" is this very link, and echoes no raw text
 *
 * ── Caveats — read before trusting a green run ─────────────────────────────
 *   · This drives the route in Node. It cannot show what a phone's browser (or
 *     a chat app's in-app browser) DRAWS for a 503 with an HTML body, nor a
 *     platform-level 5xx/timeout that never reaches this handler. Those need a
 *     real device and a real stall.
 *   · A request that outlives the platform's function time limit is cut off by
 *     the platform, not answered by this route. No read here has a time limit
 *     of its own; the retry is bounded (`SCHEMA_RETRY_DELAYS_MS`), the single
 *     read is not.
 *   · The LINKED-guest read (third read) is fenced by the source check only:
 *     reaching it needs a pass write (`cookies()`), which has no request scope
 *     here.
 *   · The re-entry code branch (`?k=`) is NOT covered: `exchangeReentryCode`
 *     treats a failed read as a refused code and opens the Event Hub. That is a
 *     quiet miss, not a "your link is wrong" sentence, and it was left alone.
 *
 *   · A plain network failure (`TypeError: fetch failed`) is not driven here:
 *     postgrest-js retries it for 7 s by itself, then resolves with an error
 *     and takes the path § 5 covers. § 5 throws an abort instead, which the
 *     client never retries.
 *   · § 5b leans on `cookies()` throwing outside a request scope. If a later
 *     Next makes that a no-op, § 5b fails at "not answered" — it cannot pass
 *     vacuously.
 *
 * Sabotage (2026-10-11, each on the real route, restored by hash):
 *   drop the `if (keyRowError)` answer ... § 2 · 5 · 7 red (`invalid_token`)
 *   drop the `if (eventError)` answer .... § 1 · 5 · 6 · 7 red
 *   read `events` without the retry ...... § 4 · 7 red
 *   rethrow in GET's catch ............... § 5b red
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { stripComments } from '@/lib/strip-comments';

/* `server-only` shim — the route imports lib/telemetry/fault-log.ts, which
   opens with `import 'server-only'` (a bundler assertion with no runtime
   module). Same shim and reasoning as lib/guest-pass-hop.test.ts. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(__filename);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_redeem_read__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

const SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const TOKEN = 'S89G-GOODTOKEN1';
const EVENT = { event_id: 'e-1', slug: 'maria-and-jose' };

type Answer = { status: number; body: unknown } | 'throw';
/** What each table's read answers, in turn (the last answer repeats). */
type Script = { events?: Answer[]; guests?: Answer[] };

const ok = (rows: unknown[]): Answer => ({ status: 200, body: rows });
/** A refusal a retry does not fix (a phantom column) — read once, no waiting. */
const REFUSED: Answer = { status: 400, body: { code: '42703', message: 'column guests.nope does not exist' } };
/**
 * A transient failure that ONLY this app retries. ⚠ Not the 503 · PGRST002
 * schema blip: postgrest-js (2.105) retries a GET on 503/520 by itself (1 s,
 * 2 s, 4 s), so a 503 here would be read twice with or without the route's
 * `withSchemaRetry` and § 4 would prove nothing (it did exactly that on the
 * first sabotage run). 504 · PGRST003 — "timed out acquiring a connection" — is
 * transient to `isTransientReadError` and is NOT retried by the client.
 */
const BLIP: Answer = {
  status: 504,
  body: { code: 'PGRST003', message: 'Timed out acquiring connection from connection pool.' },
};

async function redeem(query: string, script: Script) {
  const saved = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    fetch: globalThis.fetch,
    error: console.error,
  };
  const reads: Record<string, number> = {};
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://db.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'.repeat(64);
  console.error = () => {};
  globalThis.fetch = (async (input: unknown) => {
    const href = String(input instanceof Request ? input.url : input);
    const table = /\/rest\/v1\/(\w+)/.exec(href)?.[1] ?? 'other';
    const n = reads[table] ?? 0;
    reads[table] = n + 1;
    const list = (script as Record<string, Answer[] | undefined>)[table];
    // Anything unscripted (the Problems-log write, the rename ledger) answers
    // an empty success, so only the read under test decides the outcome.
    const answer: Answer = list ? list[Math.min(n, list.length - 1)]! : ok([]);
    // An ABORT is the one thrown fetch the client does not retry — a plain
    // network failure is retried by postgrest-js for 7 s first and then takes
    // this same path, which would only make the suite slow.
    if (answer === 'throw') throw Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
    return new Response(JSON.stringify(answer.body), {
      status: answer.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    const { GET } = nodeRequire('@/app/[slug]/redeem/route') as typeof import('@/app/[slug]/redeem/route');
    const { NextRequest } = nodeRequire('next/server') as typeof import('next/server');
    const res = await GET(
      new NextRequest(`https://setnayan.test/maria-and-jose/redeem?${query}`, { headers: { 'user-agent': SAFARI } }),
    );
    return { res, reads, html: res.status === 503 ? await res.text() : '' };
  } finally {
    globalThis.fetch = saved.fetch;
    console.error = saved.error;
    if (saved.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
    if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
  }
}

const LINK = `slug=maria-and-jose&token=${TOKEN}`;

/** The in-place answer: the guest boundary's words, no redirect, no cookie. */
function assertDidNotLoad(res: Response, html: string, why: string) {
  assert.equal(res.headers.get('location'), null, `${why}: the guest was redirected (to ${res.headers.get('location')})`);
  assert.equal(res.status, 503, `${why}: not answered as "could not load"`);
  assert.equal(res.headers.get('set-cookie'), null, `${why}: a pass was written on a failed read`);
  assert.match(res.headers.get('cache-control') ?? '', /no-store/, `${why}: the failure could be cached`);
  assert.ok(html.includes('This invitation didn&rsquo;t load.'), `${why}: the guest is not told it did not load`);
  assert.ok(html.includes('Your link is fine'), `${why}: the guest is not told their link is fine`);
  assert.ok(html.includes('>Try again</a>'), `${why}: nothing to press`);
}

test('1 · the EVENT read failed → "This invitation didn\'t load.", never a redirect', async () => {
  const { res, html, reads } = await redeem(LINK, { events: [REFUSED] });
  assertDidNotLoad(res, html, 'events read refused');
  assert.equal(reads.guests ?? 0, 0, 'the code was read although the event read had failed');
});

test('2 · the CODE read failed → "This invitation didn\'t load.", never `invalid_token`', async () => {
  const { res, html } = await redeem(LINK, { events: [ok([EVENT])], guests: [REFUSED] });
  assert.doesNotMatch(res.headers.get('location') ?? '', /invite_error/, 'a failed read was reported as a wrong link');
  assertDidNotLoad(res, html, 'guests read refused');
});

test('3 · the code read ANSWERED "no row" → `invalid_token`, exactly as before (anti-vacuity)', async () => {
  const { res, reads } = await redeem(LINK, { events: [ok([EVENT])], guests: [ok([])] });
  assert.equal(res.status, 307);
  const to = new URL(res.headers.get('location') ?? '');
  assert.equal(to.pathname, '/maria-and-jose');
  assert.equal(to.searchParams.get('invite_error'), 'invalid_token', 'a code that truly matches nothing lost its answer');
  assert.equal(reads.guests, 1, 'a read that answered was read again');
});

test('4 · a blip that passes on the retry is never seen by the guest', async () => {
  // events: blip, then the row. guests: blip, then "no row" — so the route
  // reaches its own decision (a redirect) instead of the in-place answer.
  const { res, reads } = await redeem(LINK, { events: [BLIP, ok([EVENT])], guests: [BLIP, ok([])] });
  assert.equal(reads.events, 2, 'the event read was not retried through the blip');
  assert.equal(reads.guests, 2, 'the code read was not retried through the blip');
  assert.equal(res.status, 307, 'a blip that passed still stopped the guest');
});

test('5 · a fetch that never answers (signal gone, database stalled) → answered in place', async () => {
  const first = await redeem(LINK, { events: ['throw'] });
  assertDidNotLoad(first.res, first.html, 'events fetch threw');
  const second = await redeem(LINK, { events: [ok([EVENT])], guests: ['throw'] });
  assertDidNotLoad(second.res, second.html, 'guests fetch threw');
});

test('5b · a THROW inside the route is answered in place too — never the browser\'s blank error page', async () => {
  // A good code: the route goes on to write the pass, and `cookies()` has no
  // request scope in this harness, so it THROWS — the stand-in for any throw
  // after the reads (a cookie that cannot be written, a helper that fails).
  const guest = {
    guest_id: 'g-1',
    event_id: EVENT.event_id,
    qr_token: TOKEN,
    first_name: 'Ana',
    plus_one_of_guest_id: null,
    plus_one_name_confirmed_at: null,
    entry_source: 'manual',
    deleted_at: null,
    custom_tags: null,
  };
  const { res, html } = await redeem(LINK, { events: [ok([EVENT])], guests: [ok([guest])] });
  assertDidNotLoad(res, html, 'a throw after the reads');
});

test('6 · "Try again" is this very link — same origin, built from validated parts, nothing echoed raw', async () => {
  const { html } = await redeem(LINK, { events: [REFUSED] });
  const href = /<a href="([^"]*)">Try again<\/a>/.exec(html)?.[1];
  assert.equal(href, `/maria-and-jose/redeem?slug=maria-and-jose&amp;token=${TOKEN}`, 'pressing Try again does not re-run this redeem');

  const evil = '"><script>alert(1)</script>';
  const hostile = await redeem(`slug=maria-and-jose&token=${encodeURIComponent(evil)}&to=${encodeURIComponent('//example.com')}`, {
    events: [REFUSED],
  });
  assertDidNotLoad(hostile.res, hostile.html, 'hostile token');
  assert.ok(!hostile.html.includes('<script>'), 'caller text reached the page as markup');
  assert.ok(!hostile.html.includes('example.com'), 'a caller-chosen destination was echoed');
  const hostileHref = /<a href="([^"]*)">Try again<\/a>/.exec(hostile.html)?.[1] ?? '';
  assert.ok(hostileHref.startsWith('/maria-and-jose/redeem?'), 'Try again left this route');

  // An unsafe slug reads nothing and is never answered with a page built from it.
  const unsafe = await redeem(`slug=${encodeURIComponent('/example.com')}&token=${TOKEN}`, { events: [REFUSED] });
  assert.equal(unsafe.res.status, 307);
  assert.equal(new URL(unsafe.res.headers.get('location') ?? '').pathname, '/');
});

test('7 · source fence: no read in the route throws its error away, and each failed read is answered before any "invalid" verdict', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'app/[slug]/redeem/route.ts'), 'utf8'));
  // Every `admin.from(` read in this file is destructured WITH its error.
  const reads = src.match(/admin\s*\.from\(/g) ?? [];
  const withError = src.match(/const \{ data: \w+, error: \w+ \} = await withSchemaRetry\(\(\) =>\s*admin\s*\.from\(/g) ?? [];
  assert.ok(reads.length >= 3, `anti-vacuity: the route's reads moved (found ${reads.length})`);
  assert.equal(withError.length, reads.length, `${reads.length - withError.length} read(s) in the redeem discard their error or skip the retry`);
  assert.doesNotMatch(src, /const \{ data(?:: \w+)? \} = await/, 'a read in the redeem discards its error again');
  // Each bound error is consulted, and answered in place.
  for (const name of ['eventError', 'keyRowError', 'joinedError']) {
    assert.match(
      src,
      // (bounded, lazy: the block holds a `{ … }` log argument, so `[^}]*` cannot span it)
      new RegExp(`if \\(${name}\\) \\{[\\s\\S]{0,240}?return didNotLoadAnswer\\(tryAgainHref\\);\\s*\\}`),
      `${name} is bound but a failed read is not answered with "didn't load"`,
    );
  }
  // …and the code read's check comes BEFORE the first `invalid_token`.
  assert.ok(
    src.indexOf('if (keyRowError)') > -1 && src.indexOf('if (keyRowError)') < src.indexOf("'invalid_token'"),
    'the "wrong link" verdict is reached before the failed read is ruled out',
  );
});
