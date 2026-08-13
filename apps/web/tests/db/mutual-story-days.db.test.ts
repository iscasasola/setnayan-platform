/**
 * "The days you were both there" — the both-visible rule, against the REAL
 * schema, with data seeded on purpose.
 *
 * ⚠ WHY THIS TEST EXISTS AT ALL. Measured in production on 2026-08-13:
 * `person_story_items` holds ZERO rows, zero of them consented, and zero guests
 * are linked to a person node. There is nothing live to check this against and
 * there will not be until somebody is a guest at somebody else's celebration.
 * A "verified against prod" claim here would be a false green — the query would
 * return nothing for the same reason a broken one would. So this seeds two
 * accounts and one shared event and drives the rule for real.
 *
 * It asserts BOTH directions. A test that only proves "the day appears" passes
 * happily against an implementation that has never heard of hiding, which is
 * the exact failure that would turn this feature into an attendance-disclosure
 * engine.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db.close();
});

let n = 0;
/**
 * An account + the person node it claims — the two halves a story hangs off.
 *
 * 🔑 THE PERSON NODE IS NOT CREATED HERE, IT IS READ. Signing up already mints
 * one, and `people.claimed_by_user_id` is UNIQUE — a fixture that inserts its
 * own collides with the trigger, and (worse) would be testing a row shape the
 * product never produces. Found by that collision, then confirmed against
 * production 2026-08-13: 9 accounts, 9 claimed person nodes, ZERO accounts
 * without one. That is also why the resolver's "one person per account" lookup
 * is a fact and not a guess.
 */
async function account(label: string): Promise<{ userId: string; personId: string }> {
  n += 1;
  const userId = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  // `on_auth_user_created` creates the public.users row AND the person node.
  await db.query(`INSERT INTO auth.users (id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [
    userId,
    `${label}${n}@t.invalid`,
  ]);
  const p = await db.query<{ person_id: string }>(
    `SELECT person_id FROM public.people WHERE claimed_by_user_id = $1`,
    [userId],
  );
  assert.equal(p.rows.length, 1, 'signing up must mint exactly one person node');
  return { userId, personId: p.rows[0]!.person_id };
}

async function publicEvent(name: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    // A wedding must carry ceremony_type + venue_setting together
    // (events_wedding_fields_consistency) — seeding a shape the product cannot
    // produce would be testing nothing.
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, slug, landing_page_visibility, event_date)
     VALUES ($1, 'wedding', 'catholic', 'banquet_hall', $2, 'public', DATE '2026-05-02') RETURNING event_id`,
    [name, `ev-${++n}`],
  );
  return r.rows[0]!.event_id;
}

/** A consented, live presence — the person is ALREADY VISIBLE in that day. */
async function seePresence(personId: string, eventId: string) {
  await db.query(
    `INSERT INTO public.person_story_items
       (person_id, event_id, item_kind, source_table, source_id, origin, consented_at)
     VALUES ($1, $2, 'photo', 'papic_photos', gen_random_uuid(), 'individual_qr', now())`,
    [personId, eventId],
  );
}

/**
 * The rule as SQL — the same predicate `mutualStoryEventIds` applies in TS:
 * both people live + consented, on a publicly-visible event. Deliberately
 * written from the two person ids in the order given, so a caller can swap them
 * and prove the answer does not move.
 */
async function mutualDays(personA: string, personB: string): Promise<string[]> {
  const r = await db.query<{ event_id: string }>(
    `SELECT e.event_id
       FROM public.events e
      WHERE e.slug IS NOT NULL
        AND e.landing_page_visibility = 'public'
        AND EXISTS (SELECT 1 FROM public.person_story_items s
                     WHERE s.event_id = e.event_id AND s.person_id = $1
                       AND s.hidden_at IS NULL AND s.removed_at IS NULL
                       AND s.consented_at IS NOT NULL)
        AND EXISTS (SELECT 1 FROM public.person_story_items s
                     WHERE s.event_id = e.event_id AND s.person_id = $2
                       AND s.hidden_at IS NULL AND s.removed_at IS NULL
                       AND s.consented_at IS NOT NULL)
      ORDER BY e.event_id`,
    [personA, personB],
  );
  return r.rows.map((x) => x.event_id);
}

test('a shared day appears once BOTH people are visible in it — and not before', async () => {
  const a = await account('ana');
  const b = await account('ben');
  const ev = await publicEvent('Ana & Ben at Maria’s wedding');

  // Nobody visible yet.
  assert.deepEqual(await mutualDays(a.personId, b.personId), []);

  // One side alone is NOT a shared day — this is the whole point.
  await seePresence(a.personId, ev);
  assert.deepEqual(await mutualDays(a.personId, b.personId), []);
  assert.deepEqual(await mutualDays(b.personId, a.personId), []);

  // Both sides visible ⇒ the day appears, and appears the same either way round.
  await seePresence(b.personId, ev);
  assert.deepEqual(await mutualDays(a.personId, b.personId), [ev]);
  assert.deepEqual(await mutualDays(b.personId, a.personId), [ev]);
});

test('when EITHER person hides, the day leaves BOTH pages', async () => {
  for (const [who, column] of [
    ['the one whose page you opened', 'hidden_at'],
    ['the one looking', 'hidden_at'],
    ['the one whose page you opened', 'removed_at'],
    ['the one looking', 'removed_at'],
  ] as const) {
    const a = await account('ana');
    const b = await account('ben');
    const ev = await publicEvent('shared day');
    await seePresence(a.personId, ev);
    await seePresence(b.personId, ev);
    assert.deepEqual(await mutualDays(a.personId, b.personId), [ev], 'precondition');

    const hider = who === 'the one looking' ? a.personId : b.personId;
    await db.query(
      `UPDATE public.person_story_items SET ${column} = now() WHERE person_id = $1 AND event_id = $2`,
      [hider, ev],
    );

    assert.deepEqual(
      await mutualDays(a.personId, b.personId),
      [],
      `${column} set by ${who}: the day must leave the page you opened`,
    );
    assert.deepEqual(
      await mutualDays(b.personId, a.personId),
      [],
      `${column} set by ${who}: the day must leave the OTHER page in the same instant`,
    );
  }
});

test('an unconsented presence is never a shared day, even when both were there', async () => {
  const a = await account('ana');
  const b = await account('ben');
  const ev = await publicEvent('unconsented');
  await seePresence(a.personId, ev);
  // B was tagged, but never cleared the photo-consent gate ⇒ no stamp. The row
  // still exists — B keeps it in their OWN story — it just cannot surface.
  await db.query(
    `INSERT INTO public.person_story_items
       (person_id, event_id, item_kind, source_table, source_id, origin, consented_at)
     VALUES ($1, $2, 'photo', 'papic_photos', gen_random_uuid(), 'individual_qr', NULL)`,
    [b.personId, ev],
  );
  assert.deepEqual(await mutualDays(a.personId, b.personId), []);
  assert.deepEqual(await mutualDays(b.personId, a.personId), []);
  // …and it really is in B's own archive, so nothing was lost, only withheld.
  const own = await db.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.person_story_items WHERE person_id = $1 AND event_id = $2`,
    [b.personId, ev],
  );
  assert.equal(own.rows[0]!.c, '1');
});

test('a private event is never a shared day, however visible both people are', async () => {
  const a = await account('ana');
  const b = await account('ben');
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, slug, landing_page_visibility, event_date)
     VALUES ('private one', 'wedding', 'catholic', 'banquet_hall', $1, 'private', DATE '2026-05-02') RETURNING event_id`,
    [`ev-priv-${++n}`],
  );
  const ev = r.rows[0]!.event_id;
  await seePresence(a.personId, ev);
  await seePresence(b.personId, ev);
  assert.deepEqual(await mutualDays(a.personId, b.personId), []);

  // Made public later ⇒ it becomes a shared day. Proves the emptiness above was
  // the visibility gate doing its job, not the seed failing to land.
  await db.query(`UPDATE public.events SET landing_page_visibility = 'public' WHERE event_id = $1`, [ev]);
  assert.deepEqual(await mutualDays(a.personId, b.personId), [ev]);
});

test('nobody else can read a person’s story rows — RLS keeps the raw presence private', async () => {
  // The mutual-days read runs through the service-role client BECAUSE of this:
  // the only policy is `is_admin() OR the person is claimed by auth.uid()`, so
  // one signed-in account can never see the other's rows, and the intersection
  // could never be computed from a normal session.
  const r = await db.query<{ qual: string }>(
    `SELECT pg_get_expr(polqual, polrelid) AS qual
       FROM pg_policy WHERE polrelid = 'public.person_story_items'::regclass`,
  );
  assert.equal(r.rows.length, 1, 'exactly one policy is expected on person_story_items');
  const qual = r.rows[0]!.qual;
  assert.match(qual, /claimed_by_user_id = auth\.uid\(\)/);
  assert.match(qual, /is_admin\(\)/);
});
