/**
 * events-write-grants.db.test.ts — a column the COUPLE'S OWN SESSION writes to
 * `events` must be granted to it. Otherwise the write is refused in silence.
 *
 * ── THE DEFECT, MEASURED IN PROD 2026-08-13 ───────────────────────────────
 * `finalizeVendor` forms the couple's date when they lock a supplier, in ONE
 * UPDATE naming six columns. Five were grantable to `authenticated`; the sixth,
 * `date_forced_by_lock_of`, was not. **Postgres checks privileges against the
 * columns NAMED, not the values changed**, so the entire statement was rejected
 * 42501 — every time, since the day it shipped. A rejected query is not a thrown
 * error, so nothing surfaced: the code read "no rows updated" and moved on.
 *
 * Prod confirmed it: **zero events have ever had a date formed by locking a
 * supplier.** The owner's own rule — "when locking a service, the date options
 * shrink … until a date forms" — had a dead final step.
 *
 * 🔑 THE CAUSE IS A TRAP, NOT A DECISION. `public.events` has NO table-level
 * UPDATE for `authenticated`; 188 of 202 columns are granted one by one, by a
 * baseline migration that computed its allow-list from the LIVE catalog at that
 * moment. **Any column added afterwards inherits nothing**, and the migration
 * that added this one carries no GRANT at all.
 *
 * ── WHY THIS TEST RESOLVES THE CLIENT ─────────────────────────────────────
 * SEVEN columns are written by app code and lack the grant — and SIX of them are
 * CORRECT: five are `createAdminClient()` writes (service role bypasses grants)
 * and `std_media_nsfw` is deliberately revoked and held by a trigger. A guard
 * that ignored the client would raise six false alarms beside the one real
 * defect, and **a guard that cries wolf teaches you to skim past the time it is
 * right.**
 *
 * 🪤 The resolver's FIRST version could not fire: it read a character `index`
 * that `SelectSite` does not carry, so every write classified as RLS and the
 * admin count was 0. Caught by printing the counts, not by a green run — which
 * is why this file asserts the counts below before it asserts anything else.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import {
  collectEventsWrites,
  rlsWrittenColumns,
  type EventsWrite,
} from '@/lib/security/events-write-grants';

let replay: ReplayResult;
let db: PGlite;
let writes: EventsWrite[];

const WEB_ROOT = process.cwd();

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  writes = collectEventsWrites(WEB_ROOT);
});

after(async () => {
  if (!db) return;
  await db.close?.();
});

/**
 * Columns the service role writes and NO RLS client does. They need no grant,
 * and demanding one would be wrong. Named individually so that a column moving
 * between the two buckets is a visible diff rather than a silent reclassify.
 */
const SERVICE_ROLE_ONLY_EXPECTED = [
  'face_tagging_declined_by_couple',
  'kwento_flash_auto_wall',
  'last_kwento_notify_at',
  'panood_manual_on_air_at',
  'papic_guest_capture_early',
  // Deliberately REVOKED and held by guard_events_std_media_nsfw_trg — a
  // trigger no GRANT can undo. See tests/db/std-media-nsfw-verdict.db.test.ts.
  'std_media_nsfw',
] as const;

test('the scan and the client resolver both actually did something', () => {
  // NON-VACUITY FIRST. Every assertion below is meaningless if the scan found
  // nothing, and the resolver reporting zero admin writes is exactly the bug
  // its own first version had.
  assert.ok(writes.length > 100, `expected many events writes, found ${writes.length}`);
  const adminCount = new Set(writes.filter((w) => w.viaAdminClient).map((w) => w.column)).size;
  const rlsCount = rlsWrittenColumns(writes).length;
  assert.ok(adminCount > 20, `client resolver found only ${adminCount} admin-written columns — it is not resolving`);
  assert.ok(rlsCount > 20, `client resolver found only ${rlsCount} RLS-written columns — it is not resolving`);
});

test('every column the couple’s own session writes is granted to it', async () => {
  const failures: string[] = [];
  for (const column of rlsWrittenColumns(writes)) {
    const { rows } = await db.query<{ exists: boolean; allowed: boolean }>(
      `select
         exists(select 1 from pg_attribute
                 where attrelid = 'public.events'::regclass
                   and attname = $1 and attnum > 0 and not attisdropped) as exists,
         coalesce(has_column_privilege('authenticated','public.events',$1,'UPDATE'), false) as allowed`,
      [column],
    );
    const row = rows[0];
    if (!row?.exists) {
      failures.push(`${column} — named in an UPDATE but ABSENT from public.events`);
    } else if (!row.allowed) {
      const where = writes.find((w) => w.column === column && !w.viaAdminClient)?.file ?? '?';
      failures.push(`${column} — written by an RLS client (${where}) with no UPDATE grant`);
    }
  }
  assert.deepEqual(
    failures,
    [],
    'These columns are named in an UPDATE run on the COUPLE\'S OWN session but are not ' +
      'granted to `authenticated`. Postgres checks privileges against the columns NAMED, ' +
      'so the ENTIRE statement is rejected 42501 — silently, because a rejected query is ' +
      'not a thrown error. Grant the column, or move the write to the service role:\n  ' +
      failures.join('\n  '),
  );
});

test('the service-role-only columns stay service-role-only', () => {
  // The other direction of the same rule: if one of these acquires an RLS write
  // path, it needs a grant too — and this list is where a reviewer finds out.
  const rls = new Set(rlsWrittenColumns(writes));
  const leaked = SERVICE_ROLE_ONLY_EXPECTED.filter((c) => rls.has(c));
  assert.deepEqual(
    leaked,
    [],
    `These are written only by the service role today and are therefore ungranted. ` +
      `An RLS write path just appeared for them, which will be rejected 42501 in silence: ${leaked.join(', ')}`,
  );
});

test('the date-lock column specifically is writable — the feature it powers was dead without it', async () => {
  // Named on its own because the generic failure above reads like a list, and
  // this one has a product consequence a person can state: locking a supplier
  // could never form the couple's date.
  const { rows } = await db.query<{ allowed: boolean }>(
    `select has_column_privilege('authenticated','public.events','date_forced_by_lock_of','UPDATE') as allowed`,
  );
  assert.equal(
    rows[0]?.allowed,
    true,
    'events.date_forced_by_lock_of is not writable by a couple session again. It is named ' +
      'in the same UPDATE as event_date in finalizeVendor, so losing it does not lose one ' +
      'field — it rejects the whole statement, and locking a supplier stops forming the date.',
  );
});
