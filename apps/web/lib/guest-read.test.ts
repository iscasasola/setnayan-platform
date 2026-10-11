/**
 * guest-read.test.ts — a guest-side read that FAILED never answers as "no such
 * row". (lib/guest-read.ts has the story.)
 *
 * Behaviour, against scripted results (no database, no waiting — `sleep` is
 * injected):
 *   1 · the read ANSWERED with no row → `null`, no throw, read once;
 *   2 · the read answered with a row → the row;
 *   3 · a blip that passes on a retry → the row, and the guest never knows;
 *   4 · a blip that outlasts the window → `SchemaBlipError` — never `null`;
 *   5 · a refusal a retry cannot fix → `GuestReadError`, read ONCE — never `null`;
 *   6 · `eventAddressUnread` throws (it is the reply's "never the site's home").
 *
 * ⚠ Caveat: "transient" is `isTransientReadError`'s judgement (PostgREST's
 * PGRST000–003 and any 5xx but a statement timeout). A network-level failure
 * (`status: 0`, "fetch failed") is NOT transient to it, so it is thrown as a
 * `GuestReadError` after one read — postgrest-js has already retried a GET for
 * ~7 s by itself before this helper ever sees that error.
 *
 * Sabotage (2026-10-11): `guestRead` returning `result.data` on an error turned
 * § 4 · 5 red; dropping the retry turned § 3 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GuestReadError, eventAddressUnread, guestRead } from '@/lib/guest-read';
import { SCHEMA_RETRY_DELAYS_MS, SchemaBlipError } from '@/lib/read-retry';

type Result = { data: unknown; error: unknown; status: number };
const BLIP: Result = {
  data: null,
  error: { code: 'PGRST002', message: 'Could not query the database for the schema cache. Retrying.' },
  status: 503,
};
const REFUSED: Result = { data: null, error: { code: '42703', message: 'column events.nope does not exist' }, status: 400 };
const ok = (data: unknown): Result => ({ data, error: null, status: 200 });

function scripted(results: Result[]) {
  let calls = 0;
  return {
    read: () => Promise.resolve(results[Math.min(calls++, results.length - 1)]!),
    calls: () => calls,
  };
}
const quiet = async <T,>(fn: () => Promise<T>): Promise<T> => {
  const saved = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = saved;
  }
};
const noSleep = { sleep: async () => {} };

test('1 · the read answered with NO ROW → null, and that is all null can mean', async () => {
  const s = scripted([ok(null)]);
  assert.equal(await guestRead('t', s.read, noSleep), null);
  assert.equal(s.calls(), 1, 'a read that answered was read again');
});

test('2 · the read answered with a row → the row', async () => {
  const row = { event_id: 'e-1', slug: 'maria-and-jose' };
  assert.deepEqual(await guestRead('t', scripted([ok(row)]).read, noSleep), row);
});

test('3 · a blip that passes on a retry is never seen', async () => {
  const row = { event_id: 'e-1' };
  const s = scripted([BLIP, BLIP, ok(row)]);
  assert.deepEqual(await quiet(() => guestRead('t', s.read, noSleep)), row);
  assert.equal(s.calls(), 3);
});

test('4 · a blip that outlasts the window THROWS — it is never "no such row"', async () => {
  const s = scripted([BLIP]);
  await assert.rejects(
    () => quiet(() => guestRead('hub (event)', s.read, noSleep)),
    (err) => err instanceof SchemaBlipError && /hub \(event\)/.test((err as Error).message),
  );
  assert.equal(s.calls(), SCHEMA_RETRY_DELAYS_MS.length + 1, 'the retry is not the bounded one');
});

test('5 · a refusal a retry cannot fix THROWS, after ONE read', async () => {
  const s = scripted([REFUSED]);
  await assert.rejects(
    () => quiet(() => guestRead('everyone (event)', s.read, noSleep)),
    (err) => err instanceof GuestReadError && (err as GuestReadError).callSite === 'everyone (event)',
  );
  assert.equal(s.calls(), 1, 'a refusal was retried — that only makes it slower');
});

test('6 · the reply\'s "never the site\'s home" is a throw', () => {
  assert.throws(() => eventAddressUnread('submitRsvp · event'), GuestReadError);
});
