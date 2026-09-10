/**
 * A NUMBER THE COUPLE TYPES FOR "EVERYONE ELSE" IS AN "AT MOST".
 *
 * The couple's sheet showed a typed number capped at the equal share; the
 * database enforced it raw. So a couple who typed 50 on a pot that divides to 6
 * was shown "6 each" while every guest could spend 50 — and the first guests
 * through the door could spend what the named guests were promised (owner 7c)
 * and what "capping everyone is the guarantee" (2026-08-28) relies on.
 *
 * 🔑 THE SAME SUSPICION AS THE CEILING'S OWN FILE: every test that matters runs
 * on an event whose pool APPLIES, and the headline SHOOTS until it is refused.
 *
 * Migration: 20271221350945_the_typed_number_is_at_most_the_fair_share.sql
 * Run: cd apps/web && npx tsx --test tests/db/papic-the-typed-number-is-at-most.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { allotmentRoleOf, splitTheRest, suggestedAllotment } from '../../lib/papic-guest-allotments';

let replay: ReplayResult;
let db: ReplayResult['db'];
let n = 0;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, T>>(sql, params);
  return Object.values(r.rows[0] ?? {})[0] as T;
}

type Reply = { status: string; reason?: string; total?: number };

/** A REAL pool; a fresh account so the 50-credit free grant lands in full. */
async function seedPoolEvent(grantPoints: number, pax: number | null = null) {
  n += 1;
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type, estimated_pax)
     VALUES ($1, 'birthday', $2) RETURNING event_id`,
    [`typed at most ${n}`, pax],
  );
  const userId = await one<string>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`typed-at-most-${n}@test.local`],
  );
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [eventId, userId],
  );
  await grant(eventId, grantPoints);
  return eventId;
}

const grant = (eventId: string, points: number) =>
  db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
     VALUES ($1, $2, 'admin', 'typed at most test')`,
    [eventId, points],
  );

async function seedGuest(eventId: string, role = 'guest') {
  n += 1;
  return one<string>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category,
                                ugc_terms_accepted_at, role)
     VALUES ($1, $2, 'Cruz', 'both', 'family', NOW(), $3::public.guest_role)
     RETURNING guest_id`,
    [eventId, `${role}-${n}`, role],
  );
}

const shoot = (guestId: string) =>
  one<Reply>(
    `SELECT public.papic_record_guest_capture($1, $2, false, 'photo', NULL, NULL, 1)`,
    [guestId, `r2://t/${Math.random()}`],
  );

const ceilingOf = (guestId: string) =>
  one<number | null>(`SELECT public.papic_guest_spend_ceiling($1)`, [guestId]);

const typeForEveryone = (eventId: string, typed: number) =>
  db.query(
    `UPDATE public.events
        SET papic_guest_spend_ceiling_on = TRUE, papic_guest_spend_ceiling_points = $2
      WHERE event_id = $1`,
    [eventId, typed],
  );

const nameGuest = (eventId: string, guestId: string, points: number) =>
  one(`SELECT public.papic_set_guest_spend_ceiling($1, $2, $3)`, [eventId, guestId, points]);

// ══ 1 · 🚨 THE HEADLINE — a typed 50 on a pot that divides to 6 binds at 6 ══

test('🚨 a typed number above the equal share binds AT the share — the 7th shot is refused, not the 51st', async () => {
  // Pot 60 (10 granted + the 50 free grant) · 10 heads → 6 each.
  const eventId = await seedPoolEvent(10, 10);
  const guest = await seedGuest(eventId);
  await typeForEveryone(eventId, 50);

  const pool = await db.query<{ applies: boolean; total_points: number }>(
    `SELECT applies, total_points FROM public.papic_event_pool_status($1)`, [eventId],
  );
  assert.equal(pool.rows[0]!.applies, true, 'PRECONDITION: the pool must apply, or this proves nothing');
  assert.equal(pool.rows[0]!.total_points, 60, 'PRECONDITION: 10 granted + the 50-credit free grant');

  assert.equal(await ceilingOf(guest), 6, 'LEAST(50 typed, 60 ÷ 10 = 6)');
  for (let i = 0; i < 6; i++) assert.equal((await shoot(guest)).status, 'ok');
  const refused = await shoot(guest);
  assert.equal(refused.status, 'quota_exhausted', 'the 7th credit must be refused — the couple was shown 6');
  assert.equal(refused.reason, 'guest_spend_ceiling', 'and by the per-guest ceiling, not the pot');
  assert.equal(refused.total, 6);
});

test('a sponsor takes her weight in the CAPPED share, not in the raw typed number', async () => {
  // 60 ÷ (10 heads + 2 extra for the ninang) = 5. Typed 50 is capped to 5.
  const eventId = await seedPoolEvent(10, 10);
  const plain = await seedGuest(eventId);
  const ninang = await seedGuest(eventId, 'principal_sponsor');
  await typeForEveryone(eventId, 50);

  assert.equal(await ceilingOf(plain), 5);
  assert.equal(await ceilingOf(ninang), 15, 'three shares of 5 — not three of 50');
});

// ══ 2 · THE GUARANTEE THIS PROTECTS ════════════════════════════════════════

test('⚖ a typed number can no longer let un-named guests spend a named guest’s shots (owner 7c)', async () => {
  // Pot 60 · 3 on the list · Ana named at 30 · typed 50 for everyone else.
  // Before the fix the two un-named guests could spend 50 each — 100 of a pot
  // that holds 60, so Ana's 30 was reachable by whoever shot first.
  const eventId = await seedPoolEvent(10, null);
  const ana = await seedGuest(eventId);
  const b = await seedGuest(eventId);
  const c = await seedGuest(eventId);
  await typeForEveryone(eventId, 50);
  await nameGuest(eventId, ana, 30);

  assert.equal(await ceilingOf(b), 15, '(60 − 30) ÷ 2 = 15, not 50');
  assert.equal(await ceilingOf(c), 15);
  assert.equal(await ceilingOf(ana), 30, 'her number is hers');
  const all = (await ceilingOf(ana))! + (await ceilingOf(b))! + (await ceilingOf(c))!;
  assert.ok(all <= 60, `every ceiling together is ${all} of a pot of 60 — nobody can reach Ana's`);
});

test('a top-up lifts every guest TOWARD the typed number — and never past it', async () => {
  const eventId = await seedPoolEvent(10, 10);
  const guest = await seedGuest(eventId);
  await typeForEveryone(eventId, 20);
  assert.equal(await ceilingOf(guest), 6, 'the pot reaches 6 each');

  await grant(eventId, 1000);
  assert.equal(await ceilingOf(guest), 20, '1,060 ÷ 10 = 106 — but the couple said at most 20');
});

// ══ 3 · WHAT DID NOT CHANGE ════════════════════════════════════════════════

test('a typed number BELOW the share is obeyed exactly, sponsors included', async () => {
  const eventId = await seedPoolEvent(5000, 10);
  const plain = await seedGuest(eventId);
  const cord = await seedGuest(eventId, 'cord_sponsor');
  await typeForEveryone(eventId, 4);
  assert.equal(await ceilingOf(plain), 4);
  assert.equal(await ceilingOf(cord), 8);
});

test('with nothing to divide — everybody still coming is named — the typed number stands on its own', async () => {
  // Ana is named and coming; Ben has declined, so the headcount is Ana alone and
  // no equal share exists. Ben is still resolved against the couple's number.
  const eventId = await seedPoolEvent(10, null);
  const ana = await seedGuest(eventId);
  const ben = await seedGuest(eventId);
  await typeForEveryone(eventId, 7);
  await nameGuest(eventId, ana, 10);
  await db.query(`UPDATE public.guests SET rsvp_status = 'declined' WHERE guest_id = $1`, [ben]);

  assert.equal(await ceilingOf(ben), 7, 'no share to compare with, so the typed number is the ceiling');
});

// ══ 4 · 🔑 ONE RULE — the sheet and the database now give the same number ══

test('🔑 the couple’s sheet and the database agree, above AND below the share', async () => {
  const eventId = await seedPoolEvent(10, 10);
  const plain = await seedGuest(eventId);
  const cord = await seedGuest(eventId, 'cord_sponsor');

  for (const typed of [50, 3]) {
    await typeForEveryone(eventId, typed);
    const headcount = await one<number>(`SELECT public.papic_event_guest_headcount($1)`, [eventId]);
    const pot = await one<number>(`SELECT total_points FROM public.papic_event_pool_status($1)`, [eventId]);
    const split = splitTheRest({
      pot,
      guestCount: headcount,
      named: [],
      everyoneElse: typed,
      sponsors: [allotmentRoleOf('cord_sponsor', null)],
    });
    assert.equal(await ceilingOf(plain), split.perHead, `typed ${typed}: the plain guest's number on the sheet`);
    assert.equal(
      await ceilingOf(cord),
      suggestedAllotment('cord', split.perHead),
      `typed ${typed}: the cord sponsor's number on the sheet`,
    );
  }
});
