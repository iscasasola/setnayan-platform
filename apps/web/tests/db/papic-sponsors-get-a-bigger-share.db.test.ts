/**
 * SPONSORS DEFAULT TO A BIGGER SHARE — and it BINDS, on a real pool event.
 *
 * Owner addition 2026-08-29. On a celebration where the couple has turned the
 * per-guest ceiling on, a principal sponsor who is not named takes three equal
 * shares and a cord, veil, coin or candle sponsor two. A named guest's own
 * number still wins; the release still opens everyone who is not named.
 *
 * 🔑 THE SAME SUSPICION AS `papic-guest-spend-ceiling.db.test.ts`. A resolver
 * that RETURNS a bigger number proves nothing if the writer never asks it — so
 * the headline test shoots, on an event whose pool applies, until a plain guest
 * is refused, and then keeps shooting as the sponsor past that point.
 *
 * Migration: 20271220526938_sponsors_get_a_bigger_share.sql
 * Run: cd apps/web && npx tsx --test tests/db/papic-sponsors-get-a-bigger-share.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import {
  ROLE_MULTIPLIER,
  allotmentRoleOf,
  splitTheRest,
  suggestedAllotment,
} from '../../lib/papic-guest-allotments';

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

type Reply = { status: string; reason?: string; total?: number; used?: number; remaining?: number };

/**
 * An event with a REAL shared pool. A fresh account every call, so the
 * account-scoped 50-credit free grant lands in full (see the twin helper in
 * papic-guest-spend-ceiling.db.test.ts for why).
 */
async function seedPoolEvent(grantPoints: number, pax: number | null = null) {
  n += 1;
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type, estimated_pax)
     VALUES ($1, 'birthday', $2) RETURNING event_id`,
    [`sponsor share ${n}`, pax],
  );
  const userId = await one<string>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`sponsor-share-${n}@test.local`],
  );
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [eventId, userId],
  );
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
     VALUES ($1, $2, 'admin', 'sponsor share test')`,
    [eventId, grantPoints],
  );
  return eventId;
}

async function seedGuest(eventId: string, role = 'guest', extraRoles: string[] | null = null) {
  n += 1;
  return one<string>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category,
                                ugc_terms_accepted_at, role, extra_roles)
     VALUES ($1, $2, 'Cruz', 'both', 'family', NOW(), $3::public.guest_role, COALESCE($4::public.guest_role[], '{}'))
     RETURNING guest_id`,
    // An array LITERAL, not a JS array — PGlite binds a JS array as its bare
    // first element, which Postgres then refuses as a malformed array.
    [eventId, `${role}-${n}`, role, extraRoles ? `{${extraRoles.join(',')}}` : null],
  );
}

const shoot = (guestId: string) =>
  one<Reply>(
    `SELECT public.papic_record_guest_capture($1, $2, false, 'photo', NULL, NULL, 1)`,
    [guestId, `r2://t/${Math.random()}`],
  );

const ceilingOf = (guestId: string) =>
  one<number | null>(`SELECT public.papic_guest_spend_ceiling($1)`, [guestId]);

const weightOf = (guestId: string) =>
  one<number | null>(`SELECT public.papic_guest_share_weight($1)`, [guestId]);

const turnOn = (eventId: string, everyoneElse: number | null = null) =>
  db.query(
    `UPDATE public.events
        SET papic_guest_spend_ceiling_on = TRUE, papic_guest_spend_ceiling_points = $2
      WHERE event_id = $1`,
    [eventId, everyoneElse],
  );

// ══ 1 · 🚨 THE HEADLINE — a sponsor's ceiling beats a plain guest's, and binds ═══

test('🚨 on one real pool event, a principal sponsor keeps shooting after a plain guest is refused', async () => {
  // Pot 60 (10 granted + the 50 free grant) · 10 heads · one ninang.
  // She counts as 3 heads: 60 ÷ (10 + 2) = 5 a share. Plain guest 5, ninang 15.
  const eventId = await seedPoolEvent(10, 10);
  const plain = await seedGuest(eventId, 'guest');
  const ninang = await seedGuest(eventId, 'principal_sponsor');
  await turnOn(eventId);

  const pool = await db.query<{ applies: boolean; total_points: number }>(
    `SELECT applies, total_points FROM public.papic_event_pool_status($1)`, [eventId],
  );
  assert.equal(pool.rows[0]!.applies, true, 'PRECONDITION: the pool must apply, or this proves nothing');
  assert.equal(pool.rows[0]!.total_points, 60, 'PRECONDITION: 10 granted + the 50-credit free grant');

  assert.equal(await ceilingOf(plain), 5, '60 ÷ (10 heads + 2 extra for the ninang) = 5');
  assert.equal(await ceilingOf(ninang), 15, 'and the ninang takes three of those shares');

  for (let i = 0; i < 5; i++) assert.equal((await shoot(plain)).status, 'ok');
  const refused = await shoot(plain);
  assert.equal(refused.status, 'quota_exhausted', 'the plain guest is refused at her 6th credit');
  assert.equal(refused.reason, 'guest_spend_ceiling');

  // Same event, same moment — the sponsor is still shooting, all the way to 15.
  for (let i = 0; i < 15; i++) {
    assert.equal((await shoot(ninang)).status, 'ok', `the ninang's capture ${i + 1} of 15 must land`);
  }
  const sponsorRefused = await shoot(ninang);
  assert.equal(sponsorRefused.status, 'quota_exhausted', 'and she too is refused — at HER 15, not the pot');
  assert.equal(sponsorRefused.reason, 'guest_spend_ceiling');
  assert.equal(sponsorRefused.total, 15);

  // The writer does not debit the pot (the route's reservation does), so this
  // only proves the pot never came into it: both refusals named the CEILING.
  assert.ok(
    (await one<number>(`SELECT remaining_points FROM public.papic_event_pool_status($1)`, [eventId])) > 0,
    'the pot still holds credits — it was the per-guest ceilings that refused, not the money',
  );
});

test('a cord, veil, coin or candle sponsor takes two shares', async () => {
  const eventId = await seedPoolEvent(10, 10);
  const plain = await seedGuest(eventId, 'guest');
  const secondary = await Promise.all(
    ['cord_sponsor', 'veil_sponsor', 'coin_sponsor', 'candle_sponsor'].map((r) => seedGuest(eventId, r)),
  );
  await turnOn(eventId);

  // 60 ÷ (10 + 4 extra) = 4 a share.
  assert.equal(await ceilingOf(plain), 4);
  for (const g of secondary) assert.equal(await ceilingOf(g), 8);
});

// ══ 2 · WEIGHTED, NOT MULTIPLIED ON TOP — the shares still add up to the pot ══

test('⚖ everybody\'s ceilings together never promise more than the pot — capping everyone is the guarantee', async () => {
  // No pax, so the headcount IS the list: 2 principal + 3 secondary + 5 plain.
  const eventId = await seedPoolEvent(5000, null);
  const roles = [
    'principal_sponsor', 'principal_sponsor',
    'cord_sponsor', 'veil_sponsor', 'candle_sponsor',
    'guest', 'guest', 'guest', 'guest', 'guest',
  ];
  const guests = await Promise.all(roles.map((r) => seedGuest(eventId, r)));
  await turnOn(eventId);

  const ceilings = await Promise.all(guests.map((g) => ceilingOf(g)));
  const total = ceilings.reduce<number>((s, c) => s + (c ?? 0), 0);
  // 5050 ÷ (10 heads + 2×2 + 3×1 extra = 17 shares) = 297 → 297 × 17 = 5049.
  assert.equal(ceilings[0], 891, 'a principal sponsor: 3 × 297');
  assert.equal(ceilings[2], 594, 'a secondary sponsor: 2 × 297');
  assert.equal(ceilings[9], 297, 'a plain guest: 297');
  assert.ok(
    total <= 5050,
    `every guest's ceiling together is ${total} against a pot of 5,050 — a sponsor's extra shares must come ` +
      'OUT of the one division, or somebody\'s share is promised twice',
  );
});

test('🔑 the couple\'s sheet draws the SAME numbers the database enforces', async () => {
  const eventId = await seedPoolEvent(5000, 12);
  const roles = ['principal_sponsor', 'coin_sponsor', 'guest', 'guest'];
  const guests = await Promise.all(roles.map((r) => seedGuest(eventId, r)));
  const named = await seedGuest(eventId, 'guest');
  await turnOn(eventId);
  await one(`SELECT public.papic_set_guest_spend_ceiling($1, $2, 200)`, [eventId, named]);

  const headcount = await one<number>(`SELECT public.papic_event_guest_headcount($1)`, [eventId]);
  const pot = await one<number>(`SELECT total_points FROM public.papic_event_pool_status($1)`, [eventId]);
  const sponsors = roles.map((r) => allotmentRoleOf(r, null)).filter((r) => r !== 'guest');
  const split = splitTheRest({ pot, guestCount: headcount, named: [200], everyoneElse: null, sponsors });

  // (5050 − 200) ÷ (12 − 1 named + 2 + 1 extra = 14) = 346.
  assert.equal(split.perHead, 346, 'PRECONDITION: the sheet\'s own share');
  for (let i = 0; i < roles.length; i++) {
    assert.equal(
      await ceilingOf(guests[i]!),
      suggestedAllotment(allotmentRoleOf(roles[i], null), split.perHead),
      `${roles[i]}: the number on the couple's sheet must be the number the writer refuses against`,
    );
  }
});

// ══ 3 · THE RULES THAT STILL WIN ═══════════════════════════════════════════

test('the couple\'s typed number for everyone else is ONE ordinary share — a sponsor gets her multiple of it', async () => {
  const eventId = await seedPoolEvent(5000, 10);
  const plain = await seedGuest(eventId, 'guest');
  const ninong = await seedGuest(eventId, 'principal_sponsor');
  const cord = await seedGuest(eventId, 'cord_sponsor');
  await turnOn(eventId, 4);

  assert.equal(await ceilingOf(plain), 4);
  assert.equal(await ceilingOf(ninong), 12);
  assert.equal(await ceilingOf(cord), 8);
});

test('a NAMED sponsor gets the couple\'s number, not a sponsor\'s share — and leaves the division', async () => {
  const eventId = await seedPoolEvent(5000, 10);
  const plain = await seedGuest(eventId, 'guest');
  const ninong = await seedGuest(eventId, 'principal_sponsor');
  await turnOn(eventId);

  assert.equal(await ceilingOf(plain), 420, 'PRECONDITION: 5050 ÷ (10 + 2) = 420 while he is un-named');
  assert.equal(await weightOf(ninong), 3);

  await one(`SELECT public.papic_set_guest_spend_ceiling($1, $2, 5)`, [eventId, ninong]);
  assert.equal(await ceilingOf(ninong), 5, 'a default must never overrule a number the couple typed');
  assert.equal(await weightOf(ninong), null, 'and his counter must not call 5 a sponsor\'s share');
  // (5050 − 5) ÷ (10 − 1 named) = 560 — his two extra heads left with him.
  assert.equal(await ceilingOf(plain), 560);
});

test('the release — the button and the late one — opens a sponsor like everyone else who is not named', async () => {
  const eventId = await seedPoolEvent(5000, 10);
  const ninong = await seedGuest(eventId, 'principal_sponsor');
  await turnOn(eventId, 4);
  assert.equal(await ceilingOf(ninong), 12);

  await one(`SELECT public.papic_set_guest_spend_ceiling_release($1, TRUE)`, [eventId]);
  assert.equal(await ceilingOf(ninong), null, 'the button');
  await one(`SELECT public.papic_set_guest_spend_ceiling_release($1, FALSE)`, [eventId]);
  assert.equal(await ceilingOf(ninong), 12);

  await db.query(
    `UPDATE public.events SET papic_window_end = NOW() + INTERVAL '1 hour' WHERE event_id = $1`, [eventId],
  );
  assert.equal(await ceilingOf(ninong), null, 'the late release');
});

test('a sponsor who declines or is removed stops taking extra shares from everyone else', async () => {
  const eventId = await seedPoolEvent(5000, null);
  const plain = await seedGuest(eventId, 'guest');
  const ninang = await seedGuest(eventId, 'principal_sponsor');
  await turnOn(eventId);

  assert.equal(await ceilingOf(plain), 1262, '5050 ÷ (2 heads + 2 extra) = 1262');
  await db.query(`UPDATE public.guests SET rsvp_status = 'declined' WHERE guest_id = $1`, [ninang]);
  assert.equal(await ceilingOf(plain), 5050, '5050 ÷ 1 once she has declined');
  await db.query(`UPDATE public.guests SET rsvp_status = 'attending', deleted_at = NOW() WHERE guest_id = $1`, [ninang]);
  assert.equal(await ceilingOf(plain), 5050, 'same for a sponsor removed from the list');
});

test('a plain list divides exactly as it did before — no sponsor, no change', async () => {
  // The twin file's own worked number: (5050 − 0) ÷ 10 = 505.
  const eventId = await seedPoolEvent(5000, 10);
  const plain = await seedGuest(eventId, 'guest');
  const bridesmaid = await seedGuest(eventId, 'bridesmaid');
  await turnOn(eventId);
  assert.equal(await ceilingOf(plain), 505);
  assert.equal(await ceilingOf(bridesmaid), 505, 'only the five sponsor roles earn more');
  assert.equal(await weightOf(plain), 1);
});

// ══ 4 · ONE RULE, TWO LANGUAGES — held together over the WHOLE enum ═════════

test('🚨 every guest_role weighs the same in SQL as in the sheet — walked over the live enum', async () => {
  // Derived from the database, not typed: a sponsor role added to the enum
  // tomorrow is checked here without anybody remembering to list it.
  const labels = (
    await db.query<{ enumlabel: string }>(
      `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'guest_role' ORDER BY e.enumsortorder`,
    )
  ).rows.map((r) => r.enumlabel);
  assert.ok(labels.length > 20, `PRECONDITION: the enum was read (${labels.length} values)`);
  assert.ok(labels.includes('principal_sponsor'));

  let sponsors = 0;
  for (const label of labels) {
    const sqlAlone = await one<number>(`SELECT public.papic_share_weight($1::public.guest_role, NULL)`, [label]);
    assert.equal(sqlAlone, ROLE_MULTIPLIER[allotmentRoleOf(label, null)], `${label} as a guest's role`);

    const sqlExtra = await one<number>(
      `SELECT public.papic_share_weight('guest', ARRAY[$1]::public.guest_role[])`, [label],
    );
    assert.equal(sqlExtra, ROLE_MULTIPLIER[allotmentRoleOf('guest', [label])], `${label} as an extra role`);
    if (sqlAlone > 1) sponsors += 1;
  }
  assert.equal(sponsors, 5, 'exactly the five sponsor roles earn more than one share');
});

test('the biggest role wins — a cord sponsor who is also a principal sponsor is a principal sponsor', async () => {
  const eventId = await seedPoolEvent(5000, null);
  const both = await seedGuest(eventId, 'cord_sponsor', ['principal_sponsor']);
  const viaExtra = await seedGuest(eventId, 'guest', ['veil_sponsor']);
  assert.equal(await weightOf(both), 3);
  assert.equal(await weightOf(viaExtra), 2);
  assert.equal(allotmentRoleOf('cord_sponsor', ['principal_sponsor']), 'principal');
  assert.equal(allotmentRoleOf('guest', ['veil_sponsor']), 'veil');
});

// ══ 5 · THE FENCE ══════════════════════════════════════════════════════════

test('neither weight function is reachable from a browser', async () => {
  for (const fn of [
    'public.papic_guest_share_weight(uuid)',
    'public.papic_share_weight(public.guest_role, public.guest_role[])',
  ]) {
    for (const role of ['anon', 'authenticated']) {
      assert.equal(
        await one<boolean>(`SELECT has_function_privilege($1, $2, 'EXECUTE')`, [role, fn]),
        false,
        `${role} must not execute ${fn}`,
      );
    }
    assert.equal(await one<boolean>(`SELECT has_function_privilege('service_role', $1, 'EXECUTE')`, [fn]), true);
  }
});
