/**
 * THE SUPPLIER KEEPS THE CLOCK. THE COUPLE KEEPS THE WORDS.
 *
 * Owner, 2026-08-24: keep the clock, throw away the words.
 *
 * "Usually responds in 2h" is a PUBLIC badge on every marketplace card, and it
 * is computed from `chat_threads` — NOT NULL on `event_id`, CASCADE. So a couple
 * deleting their celebration silently erased part of a supplier's reputation
 * (measured against prod: threads 1 → 0, replied 1 → 0).
 *
 * ⚖ The classification calls this "the one most likely to be got wrong in BOTH
 * directions at once": sparing the table would hand the supplier the couple's
 * private negotiation forever. So both directions are asserted here — the timing
 * survives, and nothing else does.
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
  await db?.close();
});

async function seed(tag: string, opts: { replied?: boolean; accepted?: boolean } = {}) {
  const vu = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`clock-vendor-${tag}@example.com`],
  );
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1,'Clock Test Studio','Manila',ARRAY['photography']::text[],'verified',NOW())
     RETURNING vendor_profile_id`,
    [vu.rows[0]!.id],
  );
  const vendorProfileId = vp.rows[0]!.vendor_profile_id;

  const cu = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`clock-couple-${tag}@example.com`],
  );
  const coupleUserId = cu.rows[0]!.id;

  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Clock Test Day','birthday') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUserId],
  );

  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads
       (event_id, vendor_profile_id, created_by_user_id, created_at,
        vendor_first_reply_at, inquiry_status, pax_at_inquiry, agreed_price_centavos)
     VALUES ($1,$2,$3, NOW() - INTERVAL '3 hours', $4, $5, 120, 15000000)
     RETURNING thread_id`,
    [
      eventId,
      vendorProfileId,
      coupleUserId,
      opts.replied === false ? null : new Date(Date.now() - 2 * 3600_000).toISOString(),
      opts.accepted === false ? 'pending' : 'accepted',
    ],
  );
  return { vendorProfileId, coupleUserId, eventId, threadId: t.rows[0]!.thread_id };
}

test('the timing survives the celebration', async () => {
  const s = await seed('survives');
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [s.eventId]);

  const kept = await db.query<{
    n: number;
    opened_at: string | null;
    first_replied_at: string | null;
    was_accepted: boolean | null;
  }>(
    `SELECT count(*)::int AS n, min(opened_at) AS opened_at,
            min(first_replied_at) AS first_replied_at, bool_or(was_accepted) AS was_accepted
       FROM public.vendor_reply_times WHERE vendor_profile_id = $1`,
    [s.vendorProfileId],
  );
  const row = kept.rows[0]!;
  assert.equal(row.n, 1, 'THE REGRESSION: the supplier’s reply record died with the celebration');
  assert.ok(row.opened_at, 'when the couple asked must survive');
  assert.ok(row.first_replied_at, 'and when the supplier answered');
  assert.equal(row.was_accepted, true, 'and whether it was accepted — the rate’s numerator');
});

test('the WORDS do not survive — and neither does anything that identifies the couple', async () => {
  const s = await seed('words');
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [s.eventId]);

  const threads = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.chat_threads WHERE thread_id = $1`,
    [s.threadId],
  );
  assert.equal(threads.rows[0]!.n, 0, 'the conversation itself must go with the celebration');

  // The preserved row must be incapable of answering anything but "how fast".
  const cols = await db.query<{ attname: string }>(
    `SELECT a.attname FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relname='vendor_reply_times'
        AND a.attnum > 0 AND NOT a.attisdropped`,
  );
  const names = cols.rows.map((r) => r.attname);
  for (const forbidden of [
    'event_id',
    'created_by_user_id',
    'couple_user_id',
    'pax_at_inquiry',
    'agreed_price_centavos',
    'decline_reason',
    'body',
    'message',
  ]) {
    assert.ok(
      !names.includes(forbidden),
      `vendor_reply_times grew "${forbidden}" — this table may answer "how fast does ` +
        `this supplier reply" and nothing else. Adding a field here is an owner decision.`,
    );
  }
});

test('a conversation the supplier NEVER answered is kept as exactly that', async () => {
  // The response RATE needs the unanswered ones; dropping them would silently
  // improve a supplier's rate every time a couple deleted a celebration.
  const s = await seed('silent', { replied: false, accepted: false });
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [s.eventId]);

  const kept = await db.query<{ n: number; first_replied_at: string | null; was_accepted: boolean }>(
    `SELECT count(*)::int AS n, min(first_replied_at) AS first_replied_at,
            bool_or(was_accepted) AS was_accepted
       FROM public.vendor_reply_times WHERE vendor_profile_id = $1`,
    [s.vendorProfileId],
  );
  assert.equal(kept.rows[0]!.n, 1, 'an unanswered inquiry must still be counted');
  assert.equal(kept.rows[0]!.first_replied_at, null, 'with no reply time invented for it');
  assert.equal(kept.rows[0]!.was_accepted, false);
});

test('the public internet cannot read or write the kept clocks', async () => {
  // A new table is born granted to anon/authenticated by the default privilege.
  const r = await db.query<{ acl: string | null; rls: boolean }>(
    `SELECT c.relacl::text AS acl, c.relrowsecurity AS rls
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relname='vendor_reply_times'`,
  );
  const acl = r.rows[0]!.acl ?? '';
  assert.ok(!acl.includes('anon='), `anon must hold nothing here: ${acl}`);
  assert.ok(!acl.includes('authenticated='), `authenticated must hold nothing here: ${acl}`);
  assert.equal(r.rows[0]!.rls, true, 'row level security must be on');
});
