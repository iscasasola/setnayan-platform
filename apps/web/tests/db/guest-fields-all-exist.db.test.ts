/**
 * EVERY NAME IN `GUEST_FIELDS` MUST BE A REAL COLUMN — AND THE PENALTY FOR A
 * TYPO IS A 404, NOT AN ERROR.
 *
 * 🔴 THIS IS THE SIXTH COSTUME OF ONE FAMILY. A phantom COLUMN in a select · a
 * phantom ENUM VALUE in a filter · a phantom ARGUMENT in an `.rpc()` · a blocked
 * iframe · an unresolved `r2://` — every one of them is REJECTED, never THROWN,
 * and the only symptom is an absence.
 *
 * Here the absence is worse than usual. `fetchGuestById` hands a missing-relation
 * error to `logQueryError` and then RETURNS NULL, whose call site answers with
 * `notFound()`. So one mistyped name in this string does not produce a stack
 * trace or a red test — it turns EVERY guest detail page in the product into a
 * "not found" page and empties the roster, silently, with green CI. Nothing else
 * in the repo can catch that: typecheck sees a string, the unit suite never
 * touches a database, and the page renders perfectly for a developer who never
 * opens a guest.
 *
 * So the check is: read the select string out of the shipped source, split it,
 * and ask the migration-replayed schema whether each name exists.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

/** The literal the app ships — never a copy, or this guards the copy. */
function guestFields(): string[] {
  const src = readFileSync(join(__dirname, '..', '..', 'lib', 'guests.ts'), 'utf8');
  const m = /const GUEST_FIELDS =\s*\n?\s*'([^']+)'/.exec(src);
  assert.ok(m, 'GUEST_FIELDS is no longer a single-quoted literal — re-point this guard');
  return m![1].split(',').map((f) => f.trim()).filter(Boolean);
}

test('the guard actually reads a non-trivial field list', () => {
  // A regex that silently matched nothing would make every assertion below
  // vacuous, and a loop that skips everything passes.
  const fields = guestFields();
  assert.ok(fields.length >= 30, `only ${fields.length} fields parsed — the regex is matching the wrong literal`);
  assert.ok(fields.includes('guest_id'), 'the parse produced a list without guest_id in it');
});

test('🔴 every column the guest pages select exists on public.guests', async () => {
  const fields = guestFields();
  const { rows } = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'guests'`,
  );
  const real = new Set(rows.map((r) => r.column_name));
  const phantom = fields.filter((f) => !real.has(f));
  assert.deepEqual(
    phantom,
    [],
    `GUEST_FIELDS names ${phantom.length} column(s) that do not exist: ${phantom.join(', ')}. ` +
      'PostgREST rejects the whole query, fetchGuestById returns null, and every guest ' +
      'detail page becomes a 404 with nothing logged to the user.',
  );
});

test('the query the app issues is actually accepted by the database', async () => {
  // The set check above proves each NAME exists. This proves the assembled
  // SELECT parses — the thing PostgREST is really asked to do.
  const fields = guestFields();
  await assert.doesNotReject(
    db.query(`SELECT ${fields.join(',')} FROM public.guests WHERE false`),
    'the select list the app ships is refused by the database',
  );
});

test('rsvp_responded_at is a real instant column, not a bare date', async () => {
  // It is rendered through a timezone-pinned formatter that assumes an instant.
  // A DATE here would mean the formatter is lifting midnight UTC and can print
  // the previous day — the 2026-08-04 family, in a new position.
  const { rows } = await db.query<{ data_type: string; is_nullable: string }>(
    `SELECT data_type, is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name='guests' AND column_name='rsvp_responded_at'`,
  );
  assert.equal(rows.length, 1, 'rsvp_responded_at is gone — the render would 404 every guest page');
  assert.match(rows[0]!.data_type, /timestamp with time zone/, 'it is no longer an instant');
  // Nullable is load-bearing: the writers CLEAR it on pending and maybe.
  assert.equal(rows[0]!.is_nullable, 'YES', 'the column stopped being nullable — the writers null it');
});
