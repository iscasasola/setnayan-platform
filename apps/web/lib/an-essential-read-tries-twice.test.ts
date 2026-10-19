/**
 * an-essential-read-tries-twice.test.ts — A DATABASE STALL THAT IS OVER BEFORE
 * THE PAGE'S BUDGET IS SPENT DOES NOT TAKE THE INVITATION DOWN — and one that
 * is not over still says "didn't load". (`lib/read-limit.ts`, 2026-10-20.)
 *
 * Production 2026-10-19 21:15:04Z: the owner's live invitation threw
 * `GuestPageDidNotLoad` because `rpc/event_public_stamp` ran out its own
 * READ_LIMIT_MS (6 s) during a 5–10 s instance stall — while a read sent at
 * 21:15:11.8 answered in 1.9 s, inside the 10 s PAGE_BUDGET_MS.
 *
 * Run on FAKE TIMERS with the REAL limits (6 s / 10 s) through the REAL service
 * client (postgrest-js → `createLoggingFetch` → `fetchWithinReadLimit`), against
 * a stand-in database whose every answer is scripted per attempt. What is held:
 *
 *   1 · an ESSENTIAL read that does not answer once and answers on the second
 *       try RENDERS the page — and the retry is logged as `read-limit:retry`;
 *   2 · one that does not answer twice still throws `GuestPageDidNotLoad`;
 *   3 · a DECORATION read is never retried;
 *   4 · the guest never waits past PAGE_BUDGET_MS — the retry's wait is cut to
 *       what is left of the budget, and a read cut short by the budget (not
 *       its own limit) is not retried at all;
 *   5 · only our own limit is retried: a real error, an HTTP error answer, the
 *       caller's own abort are sent once; and a POST to an `/rpc/…` not proven
 *       unable to write (RETRIED_RPCS) is never sent twice.
 */
import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';

import { createAdminClient } from './supabase/admin';
import {
  GuestPageDidNotLoad,
  PAGE_BUDGET_MS,
  READ_LIMIT_MS,
  RETRIED_RPCS,
  isRetriedRead,
  readName,
  withGuestReadLimit,
} from './read-limit';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

/** One scripted answer: answer after N ms · never answer · a network error · an HTTP status. */
type Answer = number | 'stall' | 'network-error' | { status: number };
type Sent = { what: string; method: string; at: number };

/**
 * A database whose answers are scripted PER ATTEMPT for each read name; the last
 * entry repeats. Unscripted reads answer at once. A stalled read waits until it
 * is given up on, as a real fetch does with its signal.
 */
function database(script: Record<string, Answer[]>) {
  const sent: Sent[] = [];
  const attempts = new Map<string, number>();
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const what = readName(url);
    sent.push({ what, method: init?.method ?? 'GET', at: Date.now() });
    const n = attempts.get(what) ?? 0;
    attempts.set(what, n + 1);
    const plan = script[what] ?? [0];
    const answer = plan[Math.min(n, plan.length - 1)]!;
    return new Promise<Response>((resolve, reject) => {
      const aborted = () => {
        const e = new Error('This operation was aborted');
        e.name = 'AbortError';
        reject(e);
      };
      if (init?.signal?.aborted) return aborted();
      init?.signal?.addEventListener('abort', aborted);
      if (answer === 'stall') return;
      if (answer === 'network-error') return reject(new TypeError('fetch failed'));
      if (typeof answer === 'object') {
        return resolve(new Response(JSON.stringify({ code: 'XX000', message: 'boom' }), { status: answer.status, headers: { 'content-type': 'application/json' } }));
      }
      setTimeout(
        () => resolve(new Response(JSON.stringify([{ event_id: 'e1', rev: 1 }]), { status: 200, headers: { 'content-type': 'application/json' } })),
        answer,
      );
    });
  }) as typeof fetch;
  return sent;
}

let logged: string[] = [];
let consoleError: typeof console.error;
beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  logged = [];
  consoleError = console.error;
  console.error = (...args: unknown[]) => logged.push(args.map(String).join(' '));
});
afterEach(() => {
  console.error = consoleError;
  mock.timers.reset();
});

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setImmediate(r));
};

/** Run a page on the fake clock: advance it 10 ms at a time until the page settles. */
async function drive<T>(page: () => Promise<T>): Promise<{ out: T | unknown; took: number }> {
  const started = Date.now();
  let done = false;
  let out: T | unknown;
  page().then(
    (v) => ((done = true), (out = v)),
    (e: unknown) => ((done = true), (out = e)),
  );
  for (let t = 0; !done && t <= 60_000; t += 10) {
    await flush();
    if (done) break;
    mock.timers.tick(10);
  }
  await flush();
  assert.ok(done, 'the page never settled — something waited past every timer');
  return { out, took: Date.now() - started };
}

const retryLines = () => logged.filter((l) => l.includes('"call_site":"read-limit:retry"'));

/** The layout's first read, exactly as `eventStampBySlug` sends it. */
const stamp = () => createAdminClient().rpc('event_public_stamp', { p_slug: 'cale-ice' });
const eventRow = () => createAdminClient().from('events').select('event_id,slug').eq('slug', 'cale-ice').maybeSingle();

test('the limits are the real ones — this file measures production’s numbers, not shrunken ones', () => {
  assert.equal(READ_LIMIT_MS, 6_000);
  assert.equal(PAGE_BUDGET_MS, 10_000);
});

test('1 · 2026-10-19 21:15 — the stamp does not answer in 6 s, answers in 1.9 s on the retry: the page RENDERS', async () => {
  const sent = database({ 'rpc/event_public_stamp': ['stall', 1_900] });
  const { out, took } = await drive(() =>
    withGuestReadLimit('slug', async () => {
      const { data, error } = await stamp();
      return error ? `failed: ${error.message}` : `the page (${JSON.stringify(data)})`;
    }),
  );
  assert.equal(out, 'the page ([{"event_id":"e1","rev":1}])', `the guest was shown: ${String(out)}`);
  assert.equal(sent.length, 2, `the stamp was sent ${sent.length} times — expected once, then ONE retry`);
  assert.equal(sent[1]!.at - sent[0]!.at, READ_LIMIT_MS, 'the retry did not leave the moment the first wait ran out');
  assert.ok(took <= PAGE_BUDGET_MS, `the guest waited ${took} ms — past the page budget`);
  const lines = retryLines();
  assert.equal(lines.length, 1, 'the retry was not logged on its own call site');
  assert.match(lines[0]!, /"recovered":true/);
  assert.match(lines[0]!, /"severity":"graceful_degrade"/);
  assert.match(lines[0]!, /rpc\/event_public_stamp/);
});

test('1b · a plain GET of the event row gets the same one retry', async () => {
  const sent = database({ 'events(event_id,slug)': ['stall', 500] });
  const { out } = await drive(() =>
    withGuestReadLimit('slug', async () => {
      const { data } = await eventRow();
      return data ? 'the page' : 'NOT_FOUND';
    }),
  );
  assert.equal(out, 'the page');
  assert.equal(sent.length, 2);
});

test('2 · it does not answer on the retry either: the page still says it DID NOT LOAD — inside the budget', async () => {
  const sent = database({ 'rpc/event_public_stamp': ['stall'] });
  const { out, took } = await drive(() =>
    withGuestReadLimit('slug', async () => {
      const { data } = await stamp();
      // What a page would do with a read that came back with nothing:
      return Array.isArray(data) && data.length ? 'the page' : 'NOT_FOUND';
    }),
  );
  assert.ok(out instanceof GuestPageDidNotLoad, `a read that never answered, twice, was shown as: ${String(out)}`);
  assert.deepEqual(out.lapsed.map((l) => l.what), ['rpc/event_public_stamp'], 'one read, one lapse — the retry is not a second lapse');
  assert.equal(sent.length, 2, `sent ${sent.length} times — once, plus exactly ONE retry`);
  assert.equal(took, PAGE_BUDGET_MS, `the retry's wait was not cut to the budget left (took ${took} ms)`);
  const lines = retryLines();
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /"recovered":false/);
  assert.match(lines[0]!, /"severity":"will_throw"/);
});

test('3 · a decoration read is never retried — it already leaves its part out honestly', async () => {
  const sent = database({ event_recaps: ['stall', 10] });
  const { out } = await drive(() =>
    withGuestReadLimit('slug', async () => {
      const { data } = await createAdminClient().from('event_recaps').select('status').eq('event_id', 'e').maybeSingle();
      return data ? 'album door shown' : 'album door left out';
    }),
  );
  assert.equal(out, 'album door left out');
  assert.equal(sent.length, 1, 'a decoration read was sent twice');
  assert.equal(retryLines().length, 0);
});

test('4 · a read cut short by the BUDGET, not its own limit, is not retried — and nothing waits past the budget', async () => {
  // The first read takes 5 s; the second leaves with 5 s of budget left, so its
  // wait is the budget's (5 s), not its own (6 s). When that runs out there is
  // nothing left to retry in.
  const sent = database({ 'events(event_id,slug)': [5_000], guests: ['stall', 10] });
  const { out, took } = await drive(() =>
    withGuestReadLimit('slug', async () => {
      await eventRow();
      await createAdminClient().from('guests').select('guest_id').eq('guest_id', 'g').maybeSingle();
      return 'the page';
    }),
  );
  assert.ok(out instanceof GuestPageDidNotLoad, String(out));
  assert.equal(sent.filter((s) => s.what === 'guests').length, 1, 'a read the budget had already cut short was retried');
  assert.ok(took <= PAGE_BUDGET_MS, `took ${took} ms`);
});

test('4b · reads stalled side by side each retry once — and the page still ends at the budget', async () => {
  const sent = database({ 'rpc/event_public_stamp': ['stall'], 'events(event_id,slug)': ['stall'], guests: ['stall'] });
  const { out, took } = await drive(() =>
    withGuestReadLimit('slug', async () => {
      await Promise.all([stamp(), eventRow(), createAdminClient().from('guests').select('guest_id').eq('guest_id', 'g')]);
      return 'the page';
    }),
  );
  assert.ok(out instanceof GuestPageDidNotLoad, String(out));
  assert.equal(sent.length, 6, `${sent.length} sends — each of three reads once, plus one retry each`);
  assert.ok(took <= PAGE_BUDGET_MS, `three stalled reads took ${took} ms — past the budget`);
});

test('5 · a real error is not our limit: sent once, not retried here', async () => {
  const sent = database({ 'rpc/event_public_stamp': ['network-error', 10] });
  const { out } = await drive(() =>
    withGuestReadLimit('slug', async () => {
      const { error } = await stamp();
      return error ? 'the caller’s own error path' : 'the page';
    }),
  );
  assert.equal(out, 'the caller’s own error path');
  assert.equal(sent.length, 1, 'a read that FAILED (not one that lapsed) was sent again by the read limit');
  assert.equal(retryLines().length, 0);
});

test('5b · an HTTP error answer is an answer — sent once', async () => {
  const sent = database({ 'events(event_id,slug)': [{ status: 500 }, 10] });
  await drive(() => withGuestReadLimit('slug', async () => (await eventRow()).error?.code ?? 'none'));
  assert.equal(sent.length, 1);
  assert.equal(retryLines().length, 0);
});

test('5c · the caller’s own abort is not our limit — sent once', async () => {
  const sent = database({ 'events(event_id,slug)': ['stall', 10] });
  const callers = new AbortController();
  setTimeout(() => callers.abort(), 1_000);
  await drive(() =>
    withGuestReadLimit('slug', async () => {
      const { error } = await createAdminClient().from('events').select('event_id,slug').eq('slug', 'x').abortSignal(callers.signal).maybeSingle();
      return error ? 'aborted' : 'answered';
    }),
  );
  assert.equal(sent.length, 1);
});

test('5d · a POST to an rpc NOT proven unable to write is never sent twice', async () => {
  const sent = database({ 'rpc/bump_views': ['stall', 10] });
  const { out } = await drive(() =>
    withGuestReadLimit('slug', async () => {
      await createAdminClient().rpc('bump_views', { id: 1 });
      return 'the page';
    }),
  );
  assert.ok(out instanceof GuestPageDidNotLoad, String(out));
  assert.equal(sent.length, 1, 'a POST that might write was sent a second time');
});

test('5e · who may be retried: essential GET/HEAD, and only the named rpc reads — never decoration, never a table write', () => {
  assert.equal(isRetriedRead('events(event_id,slug)', 'GET'), true);
  assert.equal(isRetriedRead('event_wish_items', 'HEAD'), false, 'decoration');
  assert.equal(isRetriedRead('guests', 'HEAD'), true);
  for (const fn of RETRIED_RPCS) assert.equal(isRetriedRead(`rpc/${fn}`, 'POST'), true, fn);
  assert.equal(isRetriedRead('rpc/bump_views', 'POST'), false);
  assert.equal(isRetriedRead('rpc/event_host_is_internal', 'POST'), false, 'decoration');
  assert.equal(isRetriedRead('guests', 'POST'), false);
  assert.equal(isRetriedRead('guests', 'PATCH'), false);
  assert.ok(RETRIED_RPCS.includes('event_public_stamp'), 'the read that lapsed on 2026-10-19 is not in the list');
});
