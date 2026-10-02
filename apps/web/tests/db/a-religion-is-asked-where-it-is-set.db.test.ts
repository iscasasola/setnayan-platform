/**
 * GUARD — THE DATABASE HALF OF "CATEGORIES & EVENT TYPES" (2026-10-02).
 *
 * Owner, DECISION_LOG "'CATEGORIES & EVENT TYPES' — ONE ADMIN PAGE … APPROVED":
 * a religion can be asked on any event type it has events for; the event
 * type's Status ▾ is one word over two columns; the religions' "What to
 * expect" covers all 17. Migration 20271260148112 holds each of those as a
 * rule the database itself enforces, so no writer — the admin page, a script,
 * a later migration — can store a state the page cannot show.
 *
 *   1. faith_vocab.asked_on_event_types: NULL = wedding only, and only ACTIVE
 *      event types may be stored
 *   2. event_type_vocab: a retired type is never in the picker, and the
 *      wedding is neither hidden nor retired
 *   3. an admin-typed search word is a legal source
 *   4. "What to expect" accepts every one of the 17 religions (+ mixed-faith)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { FAITH_REGISTRY } from '../../lib/faith-registry';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function refused(sql: string, params: unknown[] = []): Promise<string> {
  try {
    await db.query(sql, params);
  } catch (e) {
    return (e as Error).message;
  }
  assert.fail(`expected the database to refuse: ${sql}`);
}

// ── 1. Asked on ─────────────────────────────────────────────────────────────

test('every seeded religion starts as wedding-only (NULL), so nothing changes until an admin edits it', async () => {
  const r = await db.query<{ n: number; nulls: number }>(
    `SELECT count(*)::int AS n, count(*) FILTER (WHERE asked_on_event_types IS NULL)::int AS nulls FROM public.faith_vocab`,
  );
  assert.ok(r.rows[0]!.n >= 17, `only ${r.rows[0]!.n} religions seeded — the replay lost faith_vocab`);
  assert.equal(r.rows[0]!.nulls, r.rows[0]!.n, 'a religion was born asked somewhere other than the wedding');
});

test('a religion can be asked on active event types', async () => {
  await db.query(
    `UPDATE public.faith_vocab SET asked_on_event_types = ARRAY['wedding','christening'] WHERE faith_key = 'Catholic'`,
  );
  const r = await db.query<{ a: string[] }>(
    `SELECT asked_on_event_types AS a FROM public.faith_vocab WHERE faith_key = 'Catholic'`,
  );
  assert.deepEqual(r.rows[0]!.a, ['wedding', 'christening']);
  // Empty = asked on nothing, and is legal.
  await db.query(`UPDATE public.faith_vocab SET asked_on_event_types = '{}' WHERE faith_key = 'Catholic'`);
});

test('an unknown event type is refused', async () => {
  const msg = await refused(
    `UPDATE public.faith_vocab SET asked_on_event_types = ARRAY['wedding','not_a_type'] WHERE faith_key = 'Muslim'`,
  );
  assert.match(msg, /asked_on_event_types has unknown or retired event type/);
});

test('a retired event type is refused', async () => {
  await db.query(
    `INSERT INTO public.event_type_vocab (event_type, label_en, sort_order, status, enabled)
     VALUES ('old_rite', 'Old rite', 999, 'retired', false) ON CONFLICT (event_type) DO NOTHING`,
  );
  const msg = await refused(
    `UPDATE public.faith_vocab SET asked_on_event_types = ARRAY['old_rite'] WHERE faith_key = 'Muslim'`,
  );
  assert.match(msg, /old_rite/);
});

// ── 2. Event type status ────────────────────────────────────────────────────

test('the three legal states are storable on an ordinary type', async () => {
  await db.query(
    `INSERT INTO public.event_type_vocab (event_type, label_en, sort_order, status, enabled)
     VALUES ('status_probe', 'Status probe', 998, 'active', false) ON CONFLICT (event_type) DO NOTHING`,
  );
  await db.query(`UPDATE public.event_type_vocab SET enabled = true WHERE event_type = 'status_probe'`); // In the picker
  await db.query(`UPDATE public.event_type_vocab SET enabled = false WHERE event_type = 'status_probe'`); // Hidden
  await db.query(`UPDATE public.event_type_vocab SET status = 'retired' WHERE event_type = 'status_probe'`); // Retired
});

test('a retired type can never sit in the couple picker', async () => {
  const msg = await refused(`UPDATE public.event_type_vocab SET enabled = true WHERE event_type = 'status_probe'`);
  assert.match(msg, /event_type_vocab_retired_is_hidden/);
});

test('the wedding can be neither hidden nor retired', async () => {
  assert.match(
    await refused(`UPDATE public.event_type_vocab SET enabled = false WHERE event_type = 'wedding'`),
    /event_type_vocab_wedding_stays_in_picker/,
  );
  assert.match(
    await refused(`UPDATE public.event_type_vocab SET status = 'retired', enabled = false WHERE event_type = 'wedding'`),
    /event_type_vocab_wedding_stays_in_picker/,
  );
});

// ── 3. Search words ─────────────────────────────────────────────────────────

test('an admin-typed search word is a legal source; an invented one is not', async () => {
  const svc = await db.query<{ c: string }>(
    `SELECT canonical_service AS c FROM public.canonical_service_taxonomy ORDER BY canonical_service LIMIT 1`,
  );
  const canonical = svc.rows[0]!.c;
  await db.query(
    `INSERT INTO public.canonical_service_aliases (phrase, canonical_service, source) VALUES ('probe word admin', $1, 'admin')`,
    [canonical],
  );
  assert.match(
    await refused(
      `INSERT INTO public.canonical_service_aliases (phrase, canonical_service, source) VALUES ('probe word bogus', $1, 'bogus')`,
      [canonical],
    ),
    /canonical_service_aliases_source_chk/,
  );
});

// ── 4. What to expect, all 17 ───────────────────────────────────────────────

test('"What to expect" stores items for every religion the page lists, and mixed-faith', async () => {
  const keys = [...FAITH_REGISTRY.map((f) => f.key), 'civil', 'mixed'];
  assert.ok(keys.length >= 18, `only ${keys.length} ceremony keys — the registry shrank`);
  for (const k of keys) {
    await db.query(
      `INSERT INTO public.wedding_tradition_items (ceremony_type, dimension, label, note, sort_order, is_active)
       VALUES ($1, 'officiant', 'probe', '', 0, true)`,
      [k],
    );
  }
  assert.match(
    await refused(
      `INSERT INTO public.wedding_tradition_items (ceremony_type, dimension, label, note, sort_order, is_active)
       VALUES ('unknown', 'officiant', 'probe', '', 0, true)`,
    ),
    /wedding_tradition_items_ceremony_type_check/,
  );
});
