/**
 * AN UNVERIFIED SHOP IS FINDABLE UNTIL ITS FIRST INQUIRY — proved against the
 * replayed schema (DECISION_LOG 2026-11-07, migration 20271320303985).
 *
 * What this pins, each case asserting a VALUE in both directions:
 *   · the one rule (`vendor_profiles.is_findable`) over every verification ×
 *     visibility corner, fraud and the lock — and that its verified half is
 *     EXACTLY the old live rule;
 *   · the TypeScript twin (`isShopFindable`, lib/findable-shop.ts) agrees with
 *     the column on every one of those rows — two definitions that cannot drift;
 *   · a couple's first message stamps the lock once; a vendor's message does not;
 *   · an imported customer (event_vendors.source = 'vendor_invite') stamps it
 *     too; a couple saving the shop ('host_manual') does not;
 *   · deleting the inquiry does NOT unlock the shop ("whether the inquiry
 *     books, ends or is deleted");
 *   · an admin lift makes it findable again, and the NEXT inquiry re-locks it;
 *   · the views carry the column (the Explore grid reads vendor_market_stats);
 *   · the shop's OWN signed-in session cannot clear or forge its lock
 *     (guard_vendor_profiles_find_lock) — and can still edit its own row.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { isShopFindable } from '../../lib/findable-shop';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

let n = 0;
async function shop(fields: Record<string, unknown> = {}): Promise<string> {
  n += 1;
  // vendor_profiles_verified_requires_stamp: a verified row carries last_verified_at.
  const all = fields.verification_state === 'verified' ? { last_verified_at: '2026-11-01T00:00:00Z', ...fields } : fields;
  const cols = ['business_name', ...Object.keys(all)];
  const vals = [`Findable Test Shop ${n}`, ...Object.values(all)];
  const r = await db.query<{ id: string }>(
    `INSERT INTO public.vendor_profiles (${cols.join(', ')})
     VALUES (${cols.map((c, i) => (c === 'public_visibility' ? `$${i + 1}::vendor_public_visibility` : c === 'verification_state' ? `$${i + 1}::vendor_verification_state` : `$${i + 1}`)).join(', ')})
     RETURNING vendor_profile_id AS id`,
    vals,
  );
  return r.rows[0]!.id;
}

type Row = {
  is_findable: boolean;
  find_locked_at: string | null;
  find_lock_reason: string | null;
  public_visibility: string;
  verification_state: string;
  fraud_suspended_at: string | null;
  fraud_banned_at: string | null;
  fraud_tombstoned: boolean;
};
async function row(id: string): Promise<Row> {
  const r = await db.query<Row>(
    `SELECT is_findable, find_locked_at::text, find_lock_reason, public_visibility::text,
            verification_state::text, fraud_suspended_at::text, fraud_banned_at::text, fraud_tombstoned
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [id],
  );
  return r.rows[0]!;
}

async function eventWithThread(vendorId: string): Promise<{ eventId: string; threadId: string }> {
  const eventId = (
    await db.query<{ id: string }>(
      `INSERT INTO public.events (display_name, event_type) VALUES ('Findable test event', 'birthday') RETURNING event_id AS id`,
    )
  ).rows[0]!.id;
  const threadId = (
    await db.query<{ id: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id) VALUES ($1, $2) RETURNING thread_id AS id`,
      [eventId, vendorId],
    )
  ).rows[0]!.id;
  return { eventId, threadId };
}

async function message(vendorId: string, t: { eventId: string; threadId: string }, role: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_role, body)
     VALUES ($1, $2, $3, $4::chat_sender_role, 'Hello, are you free on our date?') RETURNING message_id AS id`,
    [t.threadId, t.eventId, vendorId, role],
  );
  return r.rows[0]!.id;
}

test('the one rule: verified always, undecided until locked, never rejected/demoted/archived/frozen', async () => {
  const cases: Array<{ name: string; fields: Record<string, unknown>; expect: boolean }> = [
    { name: 'verified + verified', fields: { public_visibility: 'verified', verification_state: 'verified' }, expect: true },
    { name: 'verified + verified + an old lock', fields: { public_visibility: 'verified', verification_state: 'verified', find_locked_at: '2026-11-01T00:00:00Z' }, expect: true },
    { name: 'unverified, resting hidden', fields: { public_visibility: 'hidden', verification_state: 'unverified' }, expect: true },
    { name: 'pending_review, resting hidden', fields: { public_visibility: 'hidden', verification_state: 'pending_review' }, expect: true },
    { name: 'unverified + locked', fields: { public_visibility: 'hidden', verification_state: 'unverified', find_locked_at: '2026-11-01T00:00:00Z' }, expect: false },
    { name: 'unverified + archived', fields: { public_visibility: 'archived', verification_state: 'unverified' }, expect: false },
    { name: 'rejected', fields: { public_visibility: 'hidden', verification_state: 'rejected' }, expect: false },
    { name: 'demoted', fields: { public_visibility: 'hidden', verification_state: 'demoted' }, expect: false },
    { name: 'listed, documents not yet approved — the undecided half', fields: { public_visibility: 'verified', verification_state: 'unverified' }, expect: true },
    { name: 'approved but hidden by Setnayan', fields: { public_visibility: 'hidden', verification_state: 'verified' }, expect: false },
    { name: 'unverified + fraud suspended', fields: { public_visibility: 'hidden', verification_state: 'unverified', fraud_suspended_at: '2026-11-01T00:00:00Z' }, expect: false },
    { name: 'unverified + fraud banned', fields: { public_visibility: 'hidden', verification_state: 'unverified', fraud_banned_at: '2026-11-01T00:00:00Z' }, expect: false },
    { name: 'unverified + tombstoned', fields: { public_visibility: 'hidden', verification_state: 'unverified', fraud_tombstoned: true }, expect: false },
  ];
  for (const c of cases) {
    const id = await shop(c.fields);
    const r = await row(id);
    assert.equal(r.is_findable, c.expect, `${c.name}: is_findable`);
    // 🔑 THE TWIN: the TypeScript rule answers the same on the same row.
    assert.equal(isShopFindable(r), c.expect, `${c.name}: isShopFindable disagrees with the column`);
  }
});

test('the verified half is exactly the old live rule (public_visibility AND verification_state verified)', async () => {
  const r = await db.query<{ bad: string }>(
    `SELECT count(*)::text AS bad FROM public.vendor_profiles
      WHERE (public_visibility = 'verified' AND verification_state = 'verified') AND is_findable IS NOT TRUE`,
  );
  assert.equal(r.rows[0]!.bad, '0', 'a verified shop is not findable');
});

test('a couple’s first message locks an unverified shop, once; a vendor’s message does not', async () => {
  const id = await shop({ public_visibility: 'hidden', verification_state: 'unverified' });
  const t = await eventWithThread(id);

  await message(id, t, 'vendor');
  let r = await row(id);
  assert.equal(r.find_locked_at, null, 'the shop’s own message locked it');
  assert.equal(r.is_findable, true);

  await message(id, t, 'couple');
  r = await row(id);
  assert.ok(r.find_locked_at, 'the couple’s first message did not stamp the lock');
  assert.equal(r.find_lock_reason, 'inquiry');
  assert.equal(r.is_findable, false, 'a locked unverified shop is still findable');

  const firstStamp = r.find_locked_at;
  await message(id, t, 'couple');
  assert.equal((await row(id)).find_locked_at, firstStamp, 'a second message moved the stamp');
});

test('deleting the inquiry does not unlock the shop', async () => {
  const id = await shop({ public_visibility: 'hidden', verification_state: 'pending_review' });
  const t = await eventWithThread(id);
  const msg = await message(id, t, 'coordinator');
  assert.equal((await row(id)).is_findable, false, 'a coordinator’s message is an inquiry too');
  await db.query(`DELETE FROM public.chat_messages WHERE message_id = $1`, [msg]);
  await db.query(`DELETE FROM public.chat_threads WHERE thread_id = $1`, [t.threadId]);
  const r = await row(id);
  assert.ok(r.find_locked_at, 'the lock went away with the thread');
  assert.equal(r.is_findable, false);
});

test('an imported customer locks it; a couple saving the shop does not', async () => {
  const saved = await shop({ public_visibility: 'hidden', verification_state: 'unverified' });
  const imported = await shop({ public_visibility: 'hidden', verification_state: 'unverified' });
  const eventId = (
    await db.query<{ id: string }>(
      `INSERT INTO public.events (display_name, event_type) VALUES ('Import test', 'birthday') RETURNING event_id AS id`,
    )
  ).rows[0]!.id;

  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, source)
     VALUES ($1, 'photographer', 'Saved', 'considering', $2, 'host_manual')`,
    [eventId, saved],
  );
  assert.equal((await row(saved)).is_findable, true, 'a save locked the shop — the ruling says "not a save"');

  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, source)
     VALUES ($1, 'catering', 'Imported', 'considering', $2, 'vendor_invite')`,
    [eventId, imported],
  );
  const r = await row(imported);
  assert.equal(r.find_lock_reason, 'import');
  assert.equal(r.is_findable, false, 'an imported customer did not lock the shop');
});

test('an admin lift makes it findable; the next inquiry locks it again', async () => {
  const id = await shop({ public_visibility: 'hidden', verification_state: 'unverified' });
  const t = await eventWithThread(id);
  await message(id, t, 'couple');
  assert.equal((await row(id)).is_findable, false);

  // The lift exactly as app/admin/verify/actions.ts `liftFindLock` writes it.
  await db.query(
    `UPDATE public.vendor_profiles
        SET find_locked_at = NULL, find_lock_reason = NULL, find_lock_lifted_at = NOW()
      WHERE vendor_profile_id = $1`,
    [id],
  );
  assert.equal((await row(id)).is_findable, true, 'the lift did not make the shop findable');

  await message(id, t, 'couple');
  const r = await row(id);
  assert.equal(r.is_findable, false, 'the next inquiry after a lift did not lock it again');
});

test('verifying a locked shop brings it back; nothing writes is_findable by hand', async () => {
  const id = await shop({ public_visibility: 'hidden', verification_state: 'unverified', find_locked_at: '2026-11-01T00:00:00Z' });
  assert.equal((await row(id)).is_findable, false);
  await db.query(
    `UPDATE public.vendor_profiles SET public_visibility = 'verified', verification_state = 'verified', last_verified_at = NOW() WHERE vendor_profile_id = $1`,
    [id],
  );
  assert.equal((await row(id)).is_findable, true, 'verification did not bring the shop back');

  let refusal: string | null = null;
  try {
    await db.query(`UPDATE public.vendor_profiles SET is_findable = true WHERE vendor_profile_id = $1`, [id]);
  } catch (e) {
    refusal = (e as Error).message;
  }
  assert.ok(refusal, 'is_findable accepted a hand-written value — it must be generated');
});

test('the marketplace view and the shop’s own view carry the rule', async () => {
  const cols = await db.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('vendor_market_stats', 'vendor_profiles_self')
        AND column_name IN ('is_findable', 'find_locked_at', 'find_lock_reason')`,
  );
  const has = (t: string, c: string) => cols.rows.some((r) => r.table_name === t && r.column_name === c);
  assert.ok(has('vendor_market_stats', 'is_findable'), 'vendor_market_stats lost is_findable');
  assert.ok(has('vendor_profiles_self', 'find_locked_at'), 'vendor_profiles_self lost find_locked_at');
  assert.ok(has('vendor_profiles_self', 'find_lock_reason'), 'vendor_profiles_self lost find_lock_reason');
});

test('a shop’s own session cannot unlock itself — and can still edit its own row', async () => {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('findable-owner@example.test', jsonb_build_object('account_type','customer')) RETURNING id`,
  );
  const uid = u.rows[0]!.id;
  // A 'customer' account, so the sign-up trigger does not make a shop of its own (vendor_profiles.user_id is UNIQUE);
  // the shop below is then this user's one shop, owned by user_id exactly as a real one is.
  const id = await shop({ verification_state: 'unverified', public_visibility: 'hidden', user_id: uid });
  const t = await eventWithThread(id);
  await message(id, t, 'couple');
  assert.ok((await row(id)).find_locked_at, 'precondition: the first inquiry locked it');

  const asOwner = async () => {
    await db.exec(`RESET ROLE`).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
    await setAuthUid(db, uid);
    await db.exec(`SET ROLE authenticated`);
  };
  const reset = async () => {
    await db.exec(`RESET ROLE`).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
    await setAuthUid(db, null);
  };
  const attempt = async (sql: string): Promise<string | null> => {
    await asOwner();
    try {
      await db.query(sql, [id]);
      return null;
    } catch (e) {
      return (e as Error).message;
    } finally {
      await reset();
    }
  };

  // The owner's row IS visible and writable to them — so a refusal below is the guard, not RLS hiding the row.
  assert.equal(await attempt(`UPDATE public.vendor_profiles SET tagline = 'still mine to edit' WHERE vendor_profile_id = $1`), null);
  assert.equal((await db.query<{ tagline: string }>(`SELECT tagline FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [id])).rows[0]!.tagline, 'still mine to edit');

  for (const set of [
    'find_locked_at = NULL',
    'find_lock_reason = NULL',
    'find_lock_lifted_at = NOW()',
    `find_lock_lifted_by = '${uid}'`,
  ]) {
    const refusal = await attempt(`UPDATE public.vendor_profiles SET ${set} WHERE vendor_profile_id = $1`);
    assert.match(refusal ?? '', /cannot change its own find lock/, `the shop's own session wrote ${set}`);
  }
  const after = await row(id);
  assert.ok(after.find_locked_at, 'the lock survived every attempt');
  assert.equal(after.is_findable, false);
});
