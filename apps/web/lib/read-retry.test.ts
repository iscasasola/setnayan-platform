/**
 * read-retry.test.ts — a schema-cache BLIP retries; it never errors, redirects
 * or shows empty. (lib/read-retry.ts has the story.)
 *
 * Three behaviours, each mutation-checked when it shipped:
 *   1. PGRST002 once, then success → the read's rows, no error, no throw.
 *   2. PGRST002 past the retry window → `SchemaBlipError` (the honest error
 *      state, via app/error.tsx's "Reconnecting…") — NEVER `[]`.
 *      (sabotage: return [] on a blip → red)
 *   3. A refusal (RLS 42501, a 4xx, a phantom column, a statement timeout) is
 *      read ONCE and keeps its caller's path. (sabotage: retry everything → red)
 * Then the call sites: each gate throws on a blip BEFORE its notFound/redirect.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  RECONNECT_DELAYS_MS,
  RECONNECT_RUN_MS,
  SCHEMA_BLIP_DIGEST,
  SCHEMA_RETRY_DELAYS_MS,
  SchemaBlipError,
  isNetworkReadFailure,
  isSchemaBlip,
  isTransientReadError,
  nextReconnect,
  withSchemaRetry,
  type ReconnectRun,
} from '@/lib/read-retry';
import { fetchUserEvents, fetchUserEventsOrReconnect } from '@/lib/events';
import { stripComments } from '@/lib/strip-comments';

type Result = { data: unknown; error: unknown; status: number };

const BLIP: Result = {
  data: null,
  error: {
    code: 'PGRST002',
    message: 'Could not query the database for the schema cache. Retrying.',
  },
  status: 503,
};
const RLS: Result = { data: null, error: { code: '42501', message: 'permission denied for table event_members' }, status: 403 };
const ok = (data: unknown): Result => ({ data, error: null, status: 200 });

/** A read that answers each result in turn, counting its calls. */
function scripted(results: Result[]) {
  let calls = 0;
  const read = () => {
    const r = results[Math.min(calls, results.length - 1)]!;
    calls += 1;
    return Promise.resolve(r);
  };
  return { read, calls: () => calls };
}

const noSleep = { sleep: async () => {} };

// ── 1 · the helper ─────────────────────────────────────────────────────────

test('PGRST002 once, then success → the success, after one retry', async () => {
  const s = scripted([BLIP, ok({ member_type: 'couple' })]);
  const got = await withSchemaRetry(s.read, noSleep);
  assert.equal(got.error, null, 'the blip was handed back instead of retried');
  assert.deepEqual(got.data, { member_type: 'couple' });
  assert.equal(s.calls(), 2);
});

test('a blip that never ends → the blip, after the whole window (and no more)', async () => {
  const s = scripted([BLIP]);
  const waits: number[] = [];
  const got = await withSchemaRetry(s.read, { sleep: async (ms) => void waits.push(ms) });
  assert.equal(s.calls(), SCHEMA_RETRY_DELAYS_MS.length + 1);
  assert.deepEqual(waits, [...SCHEMA_RETRY_DELAYS_MS], 'the backoff is not the declared one');
  assert.ok(isTransientReadError(got.error, got.status), 'the caller can no longer tell it was a blip');
});

test('the window is SHORT — a real outage still reports in a few seconds', () => {
  const total = SCHEMA_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
  assert.ok(total >= 1000 && total <= 5000, `server retry window is ${total} ms`);
});

test('a REFUSAL is read once — RLS, 4xx, phantom column, statement timeout', async () => {
  const refusals: Result[] = [
    RLS,
    { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, status: 406 },
    { data: null, error: { code: '42703', message: 'column events.nope does not exist' }, status: 400 },
    { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.nope' in the schema cache" }, status: 404 },
    { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' }, status: 500 },
  ];
  for (const r of refusals) {
    const s = scripted([r, ok('never')]);
    const got = await withSchemaRetry(s.read, noSleep);
    assert.equal(s.calls(), 1, `${(r.error as { code: string }).code} was retried`);
    assert.equal(got, r);
    assert.equal(isTransientReadError(r.error, r.status), false);
  }
});

test('transient: every PGRST00x, and a bare 5xx', () => {
  for (const code of ['PGRST000', 'PGRST001', 'PGRST002', 'PGRST003']) {
    assert.equal(isTransientReadError({ code, message: '' }, 503), true, code);
  }
  assert.equal(isTransientReadError({ code: '', message: 'Bad gateway' }, 502), true);
  assert.equal(isTransientReadError({ message: 'Could not query the database for the schema cache. Retrying.' }), true);
  assert.equal(isTransientReadError(null, 503), false, 'no error is never a blip');
});

// ── 1b · a read that never reached the database (owner 2026-10-11: "make sure requests does not cause a crash") ──

/** What postgrest-js resolves with when the fetch itself failed (after its own three GET retries): no HTTP answer. */
const NO_ANSWER: Result = { data: null, error: { code: '', message: 'TypeError: fetch failed', details: 'Caused by: Error: read ECONNRESET', hint: '' }, status: 0 };
const ABORTED: Result = { data: null, error: { code: '', message: 'AbortError: This operation was aborted', hint: 'Request was aborted (timeout or manual cancellation)' }, status: 0 };

test('THE TABLE — what each read outcome is, to the gate that must not say "this page does not exist"', async () => {
  type Row = { name: string; result: Result; transient: boolean; network: boolean; reads: number };
  const again = SCHEMA_RETRY_DELAYS_MS.length + 1;
  const table: Row[] = [
    // No HTTP answer: transient (never "no such row") — and NOT run again by the helper (the library already did, for 7 s).
    { name: 'status 0 · fetch failed', result: NO_ANSWER, transient: true, network: true, reads: 1 },
    { name: 'status 0 · aborted / timed out', result: ABORTED, transient: true, network: true, reads: 1 },
    // The database could not answer just now: transient, and retried for the window.
    { name: '500', result: { data: null, error: { code: '', message: 'Internal Server Error' }, status: 500 }, transient: true, network: false, reads: again },
    { name: '502', result: { data: null, error: { code: '', message: 'Bad gateway' }, status: 502 }, transient: true, network: false, reads: again },
    { name: '503 PGRST002', result: BLIP, transient: true, network: false, reads: again },
    { name: '503 PGRST001', result: { data: null, error: { code: 'PGRST001', message: 'Database connection error' }, status: 503 }, transient: true, network: false, reads: again },
    { name: '503 PGRST000', result: { data: null, error: { code: 'PGRST000', message: 'Could not connect with the database' }, status: 503 }, transient: true, network: false, reads: again },
    { name: '504 PGRST003', result: { data: null, error: { code: 'PGRST003', message: 'Timed out acquiring connection from connection pool' }, status: 504 }, transient: true, network: false, reads: again },
    // The database ANSWERED, with a refusal: read once, and the caller's own path (a 404, a redirect) stands.
    { name: '500 · 57014 statement timeout', result: { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' }, status: 500 }, transient: false, network: false, reads: 1 },
    { name: '403 · 42501 RLS', result: RLS, transient: false, network: false, reads: 1 },
    { name: '400 · 42703 phantom column', result: { data: null, error: { code: '42703', message: 'column events.nope does not exist' }, status: 400 }, transient: false, network: false, reads: 1 },
    { name: '404 · PGRST205 no such table', result: { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.nope' in the schema cache" }, status: 404 }, transient: false, network: false, reads: 1 },
    { name: '406 · PGRST116 .single() found no row', result: { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, status: 406 }, transient: false, network: false, reads: 1 },
    // A REAL "no such row": `.maybeSingle()` answers 200, no error, no data. Never a blip — the page truly is not there.
    { name: '200 · no row', result: ok(null), transient: false, network: false, reads: 1 },
    { name: '200 · the row', result: ok({ member_type: 'couple' }), transient: false, network: false, reads: 1 },
  ];
  for (const row of table) {
    assert.equal(isTransientReadError(row.result.error, row.result.status), row.transient, `${row.name}: transient`);
    assert.equal(isNetworkReadFailure(row.result.error, row.result.status), row.network, `${row.name}: network-level`);
    const s = scripted([row.result]);
    const got = await withSchemaRetry(s.read, noSleep);
    assert.equal(s.calls(), row.reads, `${row.name}: read ${s.calls()} times`);
    assert.equal(got, row.result, `${row.name}: the result was changed on its way back`);
  }
});

test('a read with no HTTP answer is told by its status — or, where the caller has none, by the fetch error’s own words', () => {
  for (const message of ['TypeError: fetch failed', 'TypeError: Failed to fetch', 'TypeError: Load failed', 'TypeError: NetworkError when attempting to fetch resource.', 'FetchError: fetch failed', 'fetch failed']) {
    assert.equal(isNetworkReadFailure({ message }), true, message);
    assert.equal(isNetworkReadFailure({ message }, null), true, `${message} (status null)`);
    assert.equal(isTransientReadError({ message }, null), true, message);
  }
  // A thrown read, as EventLayout hands it on.
  assert.equal(isTransientReadError(new TypeError('fetch failed'), 0), true);
  assert.equal(isTransientReadError(new Error('anything at all'), 0), true, 'status 0 is no answer, whatever the words');
  // A real status always wins over the words: the database DID answer.
  assert.equal(isNetworkReadFailure({ message: 'TypeError: fetch failed' }, 403), false);
  assert.equal(isNetworkReadFailure({ message: 'permission denied for table event_members' }), false);
  assert.equal(isNetworkReadFailure({ message: 'the prefetch failed to warm' }), false, 'the words are anchored, not found anywhere');
  // No error is never a failure — `status: 0` with data would be a client bug, not a blip.
  assert.equal(isNetworkReadFailure(null, 0), false);
  assert.equal(isTransientReadError(null, 0), false);
  assert.equal(isTransientReadError(undefined), false);
});

test('the blip error carries its digest to the browser', () => {
  const e = new SchemaBlipError('x', BLIP.error);
  assert.equal(e.digest, SCHEMA_BLIP_DIGEST);
  assert.equal(isSchemaBlip(e), true);
  // What app/error.tsx receives in production: a plain object with the digest.
  assert.equal(isSchemaBlip({ message: 'An error occurred', digest: SCHEMA_BLIP_DIGEST }), true);
  assert.equal(isSchemaBlip({ message: 'x', digest: '3284377371' }), false);
  assert.equal(isSchemaBlip(new Error('x')), false);
});

// ── 2 · fetchUserEvents, through a stubbed client ─────────────────────────

function stubClient(results: Result[]) {
  let calls = 0;
  const client = {
    from() {
      const r = results[Math.min(calls, results.length - 1)]!;
      calls += 1;
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'is']) b[m] = () => b;
      b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(r).then(resolve, reject);
      return b;
    },
  };
  return { client: client as unknown as SupabaseClient, calls: () => calls };
}

const MEMBERSHIP = [
  {
    member_type: 'couple',
    auto_surfaced: false,
    guest_id: null,
    seat: null,
    events: { event_id: 'e1', is_primary: true, event_date: '2027-01-01' },
  },
];

test('fetchUserEventsOrReconnect: PGRST002 once, then the person’s events', async () => {
  const s = stubClient([BLIP, ok(MEMBERSHIP)]);
  const got = await fetchUserEventsOrReconnect(s.client, 'u-once', 'couple');
  assert.deepEqual(got.map((e) => e.event_id), ['e1'], 'a blip became an empty board');
  assert.equal(s.calls(), 2);
});

test('fetchUserEventsOrReconnect: a blip past the window THROWS — never []', async () => {
  const s = stubClient([BLIP]);
  await assert.rejects(
    fetchUserEventsOrReconnect(s.client, 'u-forever', 'couple'),
    (e: unknown) => isSchemaBlip(e),
    'a blip that outlasted the retry was degraded to an empty list',
  );
  assert.equal(s.calls(), SCHEMA_RETRY_DELAYS_MS.length + 1);
});

test('fetchUserEventsOrReconnect: a refusal is read once and degrades as before', async () => {
  const s = stubClient([RLS, ok(MEMBERSHIP)]);
  const got = await fetchUserEventsOrReconnect(s.client, 'u-refused', 'couple');
  assert.deepEqual(got, []);
  assert.equal(s.calls(), 1, 'a refusal was retried');
});

test('fetchUserEvents keeps its contract (never throws) and still retries a blip', async () => {
  const once = stubClient([BLIP, ok(MEMBERSHIP)]);
  assert.deepEqual((await fetchUserEvents(once.client, 'u-plain', 'couple')).map((e) => e.event_id), ['e1']);
  const refused = stubClient([RLS]);
  assert.deepEqual(await fetchUserEvents(refused.client, 'u-plain-refused', 'couple'), []);
});

test('fetchUserEventsOrReconnect: a read that never reached the database THROWS the blip — never [] (Home must not say "nothing is yours")', async () => {
  const s = stubClient([NO_ANSWER, ok(MEMBERSHIP)]);
  await assert.rejects(fetchUserEventsOrReconnect(s.client, 'u-no-answer', 'couple'), (e: unknown) => isSchemaBlip(e));
  assert.equal(s.calls(), 1, 'the library already retried this read — the helper must not multiply it');
  // …and the degrading fetcher keeps its contract: it never throws.
  const plain = stubClient([NO_ANSWER]);
  assert.deepEqual(await fetchUserEvents(plain.client, 'u-no-answer-plain', 'couple'), []);
});

// ── 3 · the browser's reconnect ────────────────────────────────────────────

test('the browser reconnects a few times, then gives up to the honest error', () => {
  let run: ReconnectRun | null = null;
  const t0 = 1_000_000;
  const delays: number[] = [];
  for (let i = 0; i < RECONNECT_DELAYS_MS.length; i += 1) {
    const step = nextReconnect(run, t0 + i * 1000);
    assert.ok(step, `attempt ${i + 1} was refused`);
    delays.push(step.delayMs);
    run = step.run;
  }
  assert.deepEqual(delays, [...RECONNECT_DELAYS_MS]);
  assert.equal(nextReconnect(run, t0 + 20_000), null, 'the reconnect never ends — a real outage would spin forever');
  assert.ok(nextReconnect(run, t0 + RECONNECT_RUN_MS + 1), 'a later blip is refused because of an old one');
});

// ── 4 · the call sites: a blip throws BEFORE the gate's notFound/redirect ───

const WEB = join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function throwsBefore(file: string, read: RegExp, callSite: string, gate: string) {
  const s = src(file);
  const at = s.search(read);
  assert.ok(at > -1, `${file}: the ${callSite} read no longer goes through withSchemaRetry`);
  const thrown = s.indexOf(`throw schemaBlipError('${callSite}'`, at);
  assert.ok(thrown > at, `${file}: a blip on ${callSite} is not thrown`);
  const gateAt = s.indexOf(gate, at);
  assert.ok(gateAt > -1, `${file}: re-anchor — ${gate} moved`);
  assert.ok(thrown < gateAt, `${file}: ${gate} fires before a ${callSite} blip is thrown`);
}

test('EventLayout: membership, co-host and event reads throw a blip before notFound()', () => {
  const f = 'app/dashboard/[eventId]/layout.tsx';
  throwsBefore(f, /withSchemaRetry\(\(\) =>\s*supabase\s*\.from\('event_members'\)/, 'EventLayout (event_members)', 'notFound()');
  throwsBefore(f, /withSchemaRetry\(\(\) =>\s*supabase\s*\.from\('event_moderators'\)/, 'EventLayout (event_moderators)', 'notFound()');
  throwsBefore(f, /withSchemaRetry\(\(\) =>\s*supabase\.from\('events'\)\.select\(fullSelect\)/, 'EventLayout (events)', 'if (!event) notFound()');
  assert.match(src(f), /fetchUserEventsOrReconnect\(supabase, user\.id, 'guest'\)\.catch\(\(err: unknown\) => \{\s*rethrowIfSchemaBlip\(err\);/);
});

test('EventLayout: an event read that THREW is handed on as "no answer" (status 0), never as "no row"', () => {
  const s = src('app/dashboard/[eventId]/layout.tsx');
  const read = s.indexOf(".from('events').select(fullSelect)");
  const caught = s.indexOf('} catch (caught) {', read);
  const gate = s.indexOf('if (!event) notFound()', read);
  assert.ok(read > -1 && caught > read && gate > caught, 're-anchor — the event read moved');
  const handler = s.slice(caught, s.indexOf('})();', caught));
  assert.match(handler, /return \{ data: null, error: thrown, status: 0 as const \};/, 'a thrown read is not reported as no answer');
  assert.doesNotMatch(handler, /error: null/, 'a thrown read comes back as "no error, no row" — the gate would 404 on it');
});

test('the Maker: its membership read throws a blip before the redirect out', () => {
  throwsBefore(
    'app/dashboard/[eventId]/launch/page.tsx',
    /withSchemaRetry\(\(\) =>\s*supabase\.from\('event_members'\)/,
    'LaunchPage.membership',
    'redirect(`/dashboard/${eventId}`)',
  );
});

test('Home: all three board reads re-throw a blip instead of an empty board', () => {
  const s = src('app/dashboard/(launcher)/page.tsx');
  for (const mt of ['couple', 'guest', 'coordinator']) {
    assert.match(
      s,
      new RegExp(`fetchUserEventsOrReconnect\\(supabase, user\\.id, '${mt}'\\)\\.catch\\(\\(err: unknown\\) => \\{\\s*rethrowIfSchemaBlip\\(err\\);`),
      `the ${mt} read swallows a blip into []`,
    );
  }
  assert.doesNotMatch(s, /\bfetchUserEvents\(supabase/, 'a board read went back to the degrading fetcher');
});

test('app/error.tsx: a blip shows Reconnecting… before the honest error', () => {
  const s = src('app/error.tsx');
  const blip = s.indexOf('if (isSchemaBlip(error) && !reconnectSpent)');
  assert.ok(blip > -1, 'the boundary no longer tells a blip apart');
  assert.ok(blip < s.indexOf('Something on our end'), 'the honest error renders before the reconnect');
  assert.match(src('app/_components/reconnecting.tsx'), /Reconnecting…/);
});
