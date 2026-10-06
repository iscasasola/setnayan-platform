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
