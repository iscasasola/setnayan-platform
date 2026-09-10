/**
 * A RENDER AND ITS DEBIT ARE ONE TRANSACTION — IN BOTH DIRECTIONS (MB8).
 *
 * MB8's brief asked for the WIRING to be guarded, not only the pieces: "find
 * the seam where a render could succeed without a debit, or a debit could
 * happen without a render, and pin THAT specifically." This is that pin.
 *
 * ── THE SEAM, AND WHY IT IS NOT A HYPOTHETICAL ────────────────────────────
 * MB2 shipped `reserve` and `release` as separate callable functions. A server
 * action that calls `reserve()`, then the model, then INSERTs a row has a gap
 * between the first and third step wide enough for both failures:
 *
 *   · reserve succeeds → the process is killed (platform timeout, deploy,
 *     OOM) → NO ROW EXISTS. The couple's credit is gone and nothing anywhere
 *     records that a render was attempted. Unrefundable, because there is
 *     nothing to refund against. Invisible, because a balance is just a
 *     smaller number.
 *   · a row is inserted with `credits_debited = 1` and no reserve ever ran →
 *     a free render that every gallery, audit and future revenue query
 *     reports as paid for.
 *
 * `moodboard_begin_render` closes both by doing the two in ONE function body,
 * i.e. one transaction. These tests prove the pair moves together — that
 * neither half is reachable alone — rather than proving each half works.
 *
 * ── AND THE REFUND IS WELDED THE SAME WAY ─────────────────────────────────
 * `moodboard_fail_render` marks the failure AND releases the credits, and is
 * the only way to do either. So a charge-for-nothing and a free-render are
 * both unrepresentable, not merely guarded against. It also refuses on a
 * DELIVERED render (otherwise "fail" is a free-render button) and is
 * idempotent on an already-failed one (otherwise a retry mints credits).
 *
 * ⚠ WHY THIS IS A `*.db.test.ts` AND NOT A UNIT TEST. Every claim here is
 * about transaction boundaries and row locks. DDL that PARSES is not DDL that
 * BEHAVES, and no amount of TypeScript can observe that an INSERT rolled back
 * with a counter bump. `ugat-schema-claims` proves these functions EXIST,
 * which is exactly why it cannot notice that one of them spends without
 * recording.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function newEvent(name: string, coupleId: string): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ($1,'celebration') RETURNING event_id`,
    [name],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1,$2,'couple')`,
    [eventId, coupleId],
  );
  return eventId;
}

/**
 * An admin, made the way `is_admin()` ACTUALLY reads it: `users.account_type`.
 *
 * 🪤 THIS TEST FIRST SET `users.is_internal = TRUE` AND TWO ASSERTIONS FAILED.
 * `is_internal` is the flag the app uses for internal accounts and the one the
 * handoff warns produces false greens; `is_admin()` (migration
 * 20260512000000_setnayan_base.sql) reads `account_type = 'admin'` and nothing
 * else. Setting the wrong flag makes an admin-gated function refuse — which,
 * had these two assertions been written the other way round (expecting a
 * refusal), would have PASSED for the wrong reason and proven nothing.
 */
async function makeAdmin(uid: string): Promise<void> {
  await db.query(
    `UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`,
    [uid],
  );
}

async function grant(eventId: string, credits: number, source = 'admin'): Promise<void> {
  await db.query(
    `INSERT INTO public.event_render_credit_grants (event_id, credits, source)
     VALUES ($1,$2,$3)`,
    [eventId, credits, source],
  );
}

async function begin(
  eventId: string,
  partId: string,
  credits: number,
  note: string | null = null,
): Promise<string | null> {
  const r = await db.query<{ id: string | null }>(
    `SELECT public.moodboard_begin_render(
       $1, $2, 'a stylist brief', '{}'::jsonb, 'v1:abc', $3, $4, '{}'::uuid[]
     ) AS id`,
    [eventId, partId, credits, note],
  );
  return r.rows[0]!.id;
}

async function used(eventId: string): Promise<number> {
  const r = await db.query<{ credits_used: number }>(
    `SELECT credits_used FROM public.event_render_credit_usage WHERE event_id = $1`,
    [eventId],
  );
  return Number(r.rows[0]?.credits_used ?? 0);
}

async function renderCount(eventId: string): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_renders WHERE event_id = $1`,
    [eventId],
  );
  return Number(r.rows[0]!.n);
}

async function boolRpc(sql: string, params: unknown[]): Promise<boolean> {
  const r = await db.query<{ ok: boolean | null }>(sql, params);
  return r.rows[0]!.ok === true;
}

/* ── direction 1: no debit without a render row ──────────────────────────── */

test('a refused begin_render spends NOTHING and leaves NO row', async () => {
  const u = await newUser('mb8-broke@example.com');
  const e = await newEvent('Broke wedding', u);
  await setAuthUid(db, u);

  // No grant at all — the event cannot pay.
  const id = await begin(e, 'room:ceiling', 1);
  assert.equal(id, null, 'begin_render must return NULL when the event cannot pay');
  assert.equal(await used(e), 0, 'a refused render must spend nothing');
  assert.equal(
    await renderCount(e),
    0,
    'a refused render must leave no row — a row with credits_debited on an unpaid render ' +
      'is a free render every audit reports as paid',
  );
});

test('a partial overdraw is refused whole — never a partial debit', async () => {
  const u = await newUser('mb8-partial@example.com');
  const e = await newEvent('Partial wedding', u);
  await setAuthUid(db, u);
  await grant(e, 3);

  // The whole look costs 5; the event holds 3.
  assert.equal(await begin(e, 'whole_look', 5), null);
  assert.equal(await used(e), 0, 'nothing may be taken toward a render that was refused');
  assert.equal(await renderCount(e), 0);

  // And the 3 are still spendable, one part at a time.
  assert.notEqual(await begin(e, 'room:ceiling', 1), null);
  assert.equal(await used(e), 1);
});

test('a successful begin_render debits AND records, in the same breath', async () => {
  const u = await newUser('mb8-paid@example.com');
  const e = await newEvent('Paid wedding', u);
  await setAuthUid(db, u);
  await grant(e, 50);

  const id = await begin(e, 'room:tables', 1);
  assert.ok(id, 'begin_render must return a render_id when the event can pay');
  assert.equal(await used(e), 1, 'the credit must be spent');
  assert.equal(await renderCount(e), 1, 'and the row must exist');

  const row = await db.query<{
    credits_debited: number;
    image_key: string | null;
    failed_at: string | null;
  }>(
    `SELECT credits_debited, image_key, failed_at FROM public.event_renders WHERE render_id = $1`,
    [id],
  );
  assert.equal(Number(row.rows[0]!.credits_debited), 1, 'the row must record what it cost');
  // 🔑 IN FLIGHT, NOT SUCCESSFUL. The row is the receipt for the reservation,
  // written BEFORE the model is called — so a provider call that never returns
  // leaves something a human can find and refund.
  assert.equal(row.rows[0]!.image_key, null, 'the row must start with no image');
  assert.equal(row.rows[0]!.failed_at, null);
});

/* ── direction 2: the debit is unrepresentable without the row ───────────── */

test('THE WELD: a failing INSERT rolls the debit back with it', async () => {
  const u = await newUser('mb8-weld@example.com');
  const e = await newEvent('Weld wedding', u);
  await setAuthUid(db, u);
  await grant(e, 50);

  // 🔑 THE ACTUAL PROOF THAT THIS IS ONE TRANSACTION. An illegal `part_id`
  // passes every check `begin_render` performs and is refused by the
  // `event_renders_part_id_shape` CHECK at INSERT time — i.e. AFTER the
  // counter has already been bumped inside the function body. If the reserve
  // and the insert were two transactions, the credit would be gone and no row
  // would exist: the exact invisible loss this design forbids.
  // 🪤 THE MONEY IS ASSERTED FIRST, AND THE REJECTION SEPARATELY.
  //
  // Written as a single `assert.rejects(...)` followed by the balance check,
  // this test failed on "missing expected rejection" and NEVER REACHED the
  // balance assertion when sabotaged with an `EXCEPTION WHEN others` handler
  // around the INSERT. It still went red, so the guard worked — but it
  // reported the wrong fact, and the wrong fact is the one a future reader
  // would try to fix (by loosening the rejection matcher, which would leave
  // the money leak green). Both halves are now independent.
  let threw: unknown = null;
  try {
    await begin(e, 'not a legal part id', 1);
  } catch (err) {
    threw = err;
  }

  assert.equal(
    await used(e),
    0,
    'THE WELD FAILED: the debit survived an INSERT that did not. reserve and insert are not ' +
      'in one transaction, and a killed render can now eat a credit invisibly.',
  );
  assert.equal(await renderCount(e), 0, 'and no row may be left behind');
  assert.ok(
    threw,
    'an illegal part_id must be refused LOUDLY — a swallowed constraint violation returns ' +
      'NULL, which the action reads as "could not pay" and shows the couple the wrong sentence',
  );
  assert.match(
    String((threw as Error)?.message ?? threw),
    /event_renders_part_id_shape|violates check constraint/i,
  );
});

/* ── the failure path: mark and refund, or neither ───────────────────────── */

test('fail_render refunds exactly what the row took, and records the failure', async () => {
  const u = await newUser('mb8-fail@example.com');
  const e = await newEvent('Fail wedding', u);
  await setAuthUid(db, u);
  await grant(e, 50);

  const id = await begin(e, 'whole_look', 5);
  assert.ok(id);
  assert.equal(await used(e), 5);

  assert.equal(
    await boolRpc(`SELECT public.moodboard_fail_render($1,$2) AS ok`, [id, 'timeout: no response']),
    true,
  );
  assert.equal(await used(e), 0, 'the credits must come back — all five of them');

  const row = await db.query<{
    failed_at: string | null;
    failure_reason: string | null;
    credits_debited: number;
  }>(
    `SELECT failed_at, failure_reason, credits_debited FROM public.event_renders WHERE render_id=$1`,
    [id],
  );
  assert.ok(row.rows[0]!.failed_at, 'the failure must be RECORDED, not only refunded');
  assert.match(String(row.rows[0]!.failure_reason), /timeout/);
  // Zeroed so no reader totals a refunded row into "credits spent on images".
  assert.equal(Number(row.rows[0]!.credits_debited), 0);
});

test('fail_render is IDEMPOTENT — a second call cannot mint credits', async () => {
  const u = await newUser('mb8-twice@example.com');
  const e = await newEvent('Twice wedding', u);
  await setAuthUid(db, u);
  await grant(e, 50);

  const id = await begin(e, 'room:backdrop', 1);
  assert.equal(await used(e), 1);
  assert.equal(await boolRpc(`SELECT public.moodboard_fail_render($1,'x') AS ok`, [id]), true);
  assert.equal(await used(e), 0);

  // A retry, a double-submit, or a watchdog racing the action.
  assert.equal(
    await boolRpc(`SELECT public.moodboard_fail_render($1,'again') AS ok`, [id]),
    false,
    'a second fail must refuse',
  );
  assert.equal(await used(e), 0, 'and must not push the counter below what was spent');

  // The counter is clamped at zero, so even a successful double-release could
  // not go negative — but "cannot be called twice" is the stronger property
  // and is the one asserted.
  const r = await db.query<{ n: number }>(
    `SELECT credits_used::int AS n FROM public.event_render_credit_usage WHERE event_id=$1`,
    [e],
  );
  assert.equal(Number(r.rows[0]!.n), 0);
});

test('fail_render REFUSES a delivered render — it is not a free-render button', async () => {
  const u = await newUser('mb8-delivered@example.com');
  const e = await newEvent('Delivered wedding', u);
  await setAuthUid(db, u);
  await grant(e, 50);

  const id = await begin(e, 'room:stage', 1);
  assert.equal(
    await boolRpc(`SELECT public.moodboard_finish_render($1,$2) AS ok`, [
      id,
      'renders/x/y.png',
    ]),
    true,
  );
  assert.equal(await used(e), 1);

  // 🔑 Without this refusal, anyone who could reach the action could render a
  // photograph and then take the credit back for it, indefinitely.
  assert.equal(
    await boolRpc(`SELECT public.moodboard_fail_render($1,'give it back') AS ok`, [id]),
    false,
    'a render that HAS an image must never be refundable through fail_render',
  );
  assert.equal(await used(e), 1, 'and the credit must stay spent');
});

test('finish_render cannot revive a failed render, nor overwrite a delivered one', async () => {
  const u = await newUser('mb8-finish@example.com');
  const e = await newEvent('Finish wedding', u);
  await setAuthUid(db, u);
  await grant(e, 50);

  // Refunded, then "succeeding" — that would be a free render.
  const failed = await begin(e, 'room:tunnel', 1);
  await db.query(`SELECT public.moodboard_fail_render($1,'x')`, [failed]);
  assert.equal(
    await boolRpc(`SELECT public.moodboard_finish_render($1,'renders/a.png') AS ok`, [failed]),
    false,
    'a refunded render must not accept an image afterwards',
  );

  // Delivered, then delivered again — that would orphan the first object.
  const ok = await begin(e, 'room:ceiling', 1);
  assert.equal(
    await boolRpc(`SELECT public.moodboard_finish_render($1,'renders/b.png') AS ok`, [ok]),
    true,
  );
  assert.equal(
    await boolRpc(`SELECT public.moodboard_finish_render($1,'renders/c.png') AS ok`, [ok]),
    false,
    'a second finish must refuse rather than repoint the row at a new object',
  );
  const r = await db.query<{ image_key: string }>(
    `SELECT image_key FROM public.event_renders WHERE render_id=$1`,
    [ok],
  );
  assert.equal(r.rows[0]!.image_key, 'renders/b.png');
});

test('a blank image_key is refused — an absent image must be ABSENT', async () => {
  const u = await newUser('mb8-blank@example.com');
  const e = await newEvent('Blank wedding', u);
  await setAuthUid(db, u);
  await grant(e, 50);
  const id = await begin(e, 'room:tables', 1);

  // An empty string here would read as "delivered" to every `image_key ?`
  // check in the app while there is nothing to show — a success that renders
  // as a broken image.
  assert.equal(
    await boolRpc(`SELECT public.moodboard_finish_render($1,'   ') AS ok`, [id]),
    false,
  );
  const r = await db.query<{ image_key: string | null }>(
    `SELECT image_key FROM public.event_renders WHERE render_id=$1`,
    [id],
  );
  assert.equal(r.rows[0]!.image_key, null);
});

/* ── the note normalisation that guards the reuse pool ───────────────────── */

test('begin_render normalises a whitespace-only note to NULL, keeping `reusable` honest', async () => {
  const u = await newUser('mb8-note@example.com');
  const e = await newEvent('Note wedding', u);
  await setAuthUid(db, u);
  await grant(e, 50);

  // `reusable` is GENERATED on `note IS NULL`. A note of spaces is not a note,
  // and letting one through would withhold a perfectly reusable render from
  // the pool — or, read the other way, put a note-shaped row in it.
  const blank = await begin(e, 'room:ceiling', 1, '   ');
  const r1 = await db.query<{ note: string | null; reusable: boolean }>(
    `SELECT note, reusable FROM public.event_renders WHERE render_id=$1`,
    [blank],
  );
  assert.equal(r1.rows[0]!.note, null);

  // And a real note keeps the render out of the pool, per the owner's rule.
  const noted = await begin(e, 'room:tables', 1, "my lola's veil on the chair");
  await db.query(`SELECT public.moodboard_finish_render($1,'renders/n.png')`, [noted]);
  const r2 = await db.query<{ reusable: boolean }>(
    `SELECT reusable FROM public.event_renders WHERE render_id=$1`,
    [noted],
  );
  assert.equal(
    r2.rows[0]!.reusable,
    false,
    'a note-bearing render must never be offered to another couple',
  );
});

/* ── consent: +1 render, once, ever ──────────────────────────────────────── */

test('consenting grants the bonus ONCE, and a second consent cannot mint another', async () => {
  const u = await newUser('mb8-consent@example.com');
  const e = await newEvent('Consent wedding', u);
  await setAuthUid(db, u);

  assert.equal(await boolRpc(`SELECT public.moodboard_set_share_consent($1,TRUE) AS ok`, [e]), true);

  const bonus = await db.query<{ n: number; total: number }>(
    `SELECT count(*)::int AS n, COALESCE(SUM(credits),0)::int AS total
       FROM public.event_render_credit_grants
      WHERE event_id=$1 AND source='consent_bonus'`,
    [e],
  );
  assert.equal(Number(bonus.rows[0]!.n), 1, 'consenting must grant the bonus render');
  // Denominated in config (`credits_per_part`), never hardcoded — asserted
  // against the config row rather than against the literal 1, so an owner
  // repricing a part render does not make this test wrong.
  const cfg = await db.query<{ credits_per_part: number }>(
    `SELECT credits_per_part FROM public.moodboard_render_config WHERE config_key='default'`,
  );
  assert.equal(Number(bonus.rows[0]!.total), Number(cfg.rows[0]!.credits_per_part));

  // Two clicks, a retry, a racing toggle.
  await db.query(`SELECT public.moodboard_set_share_consent($1,TRUE)`, [e]);
  await db.query(`SELECT public.moodboard_set_share_consent($1,TRUE)`, [e]);
  const again = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_render_credit_grants
      WHERE event_id=$1 AND source='consent_bonus'`,
    [e],
  );
  assert.equal(
    Number(again.rows[0]!.n),
    1,
    'the partial UNIQUE index must make a second consent bonus impossible — a check-then-insert ' +
      'would let two concurrent toggles both pass',
  );
});

test('withdrawing consent un-features the renders but does NOT claw back the bonus', async () => {
  const u = await newUser('mb8-withdraw@example.com');
  const e = await newEvent('Withdraw wedding', u);
  const admin = await newUser('mb8-admin@example.com');
  await makeAdmin(admin);

  await setAuthUid(db, u);
  await grant(e, 50);
  await db.query(`SELECT public.moodboard_set_share_consent($1,TRUE)`, [e]);
  const id = await begin(e, 'room:backdrop', 1);
  await db.query(`SELECT public.moodboard_finish_render($1,'renders/f.png')`, [id]);

  // Featuring is an ADMIN act — a couple must never feature its own creation.
  await setAuthUid(db, admin);
  assert.equal(
    await boolRpc(`SELECT public.moodboard_set_render_featured($1,TRUE) AS ok`, [id]),
    true,
  );

  await setAuthUid(db, u);
  assert.equal(await boolRpc(`SELECT public.moodboard_set_share_consent($1,FALSE) AS ok`, [e]), true);

  const after = await db.query<{ featured_at: string | null }>(
    `SELECT featured_at FROM public.event_renders WHERE render_id=$1`,
    [id],
  );
  assert.equal(
    after.rows[0]!.featured_at,
    null,
    'withdrawing consent must un-feature — otherwise we keep publishing a creation whose ' +
      'permission was taken back, and the couple cannot tell',
  );

  const bonus = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_render_credit_grants
      WHERE event_id=$1 AND source='consent_bonus'`,
    [e],
  );
  assert.equal(
    Number(bonus.rows[0]!.n),
    1,
    'the bonus must survive withdrawal — it was earned by a consent that really was given, and ' +
      'withdrawal must not cost money',
  );
});

/* ── featured is consent-clean at the WRITE, so no read must remember ───── */

test('a non-consented render CANNOT be featured, even by an admin', async () => {
  const u = await newUser('mb8-noconsent@example.com');
  const e = await newEvent('No-consent wedding', u);
  const admin = await newUser('mb8-admin2@example.com');
  await makeAdmin(admin);

  await setAuthUid(db, u);
  await grant(e, 50);
  const id = await begin(e, 'room:ceiling', 1);
  await db.query(`SELECT public.moodboard_finish_render($1,'renders/g.png')`, [id]);

  await setAuthUid(db, admin);
  assert.equal(
    await boolRpc(`SELECT public.moodboard_set_render_featured($1,TRUE) AS ok`, [id]),
    false,
    'the featured set must be consent-clean BY CONSTRUCTION — refused at the write, so no read ' +
      'path anywhere has to remember to filter',
  );
  const r = await db.query<{ featured_at: string | null }>(
    `SELECT featured_at FROM public.event_renders WHERE render_id=$1`,
    [id],
  );
  assert.equal(r.rows[0]!.featured_at, null);
});

test('a COUPLE cannot feature its own creation', async () => {
  const u = await newUser('mb8-selffeature@example.com');
  const e = await newEvent('Self-feature wedding', u);
  await setAuthUid(db, u);
  await grant(e, 50);
  await db.query(`SELECT public.moodboard_set_share_consent($1,TRUE)`, [e]);
  const id = await begin(e, 'room:tables', 1);
  await db.query(`SELECT public.moodboard_finish_render($1,'renders/h.png')`, [id]);

  // Consent is given and the image exists — the ONLY thing standing between
  // this couple and a featured slot is that curation is an admin act.
  assert.equal(
    await boolRpc(`SELECT public.moodboard_set_render_featured($1,TRUE) AS ok`, [id]),
    false,
    'featuring must require is_admin(), not merely event membership',
  );
});

/* ── the admin feed shows everything, consent or not ─────────────────────── */

test('the admin feed returns NON-consented renders, and zero rows to a non-admin', async () => {
  const u = await newUser('mb8-adminfeed@example.com');
  const e = await newEvent('Admin feed wedding', u);
  const admin = await newUser('mb8-admin3@example.com');
  await makeAdmin(admin);

  await setAuthUid(db, u);
  await grant(e, 50);
  const id = await begin(e, 'room:stage', 1);
  await db.query(`SELECT public.moodboard_finish_render($1,'renders/i.png')`, [id]);
  // Deliberately NO consent.

  // A couple gets nothing from this function.
  const asCouple = await db.query(`SELECT * FROM public.moodboard_admin_all_renders(200,0)`);
  assert.equal(
    asCouple.rows.length,
    0,
    'the all-creations feed must return zero rows to a non-admin',
  );

  await setAuthUid(db, admin);
  const asAdmin = await db.query<{ render_id: string; share_consented: boolean }>(
    `SELECT render_id, share_consented FROM public.moodboard_admin_all_renders(200,0)`,
  );
  const mine = asAdmin.rows.find((r) => r.render_id === id);
  assert.ok(
    mine,
    '🔒 LOCKED DECISION: the admin sees EVERY render regardless of consent — this feed is how ' +
      "Setnayan compiles its own content database. If this went red because somebody added a " +
      'consent filter, that filter is undoing an owner decision, not closing a leak.',
  );
  assert.equal(mine!.share_consented, false, 'and the consent state rides along as a BADGE');
});

/* ── anon can reach none of it ───────────────────────────────────────────── */

test('anon holds EXECUTE on none of the MB8 spending functions', async () => {
  // `CREATE FUNCTION` grants EXECUTE to PUBLIC, which anon inherits, and
  // `moodboard_render_caller_may_act` reads a NULL auth.uid() as "the server
  // is asking" — exactly what an anonymous caller has. Without the REVOKEs,
  // anyone with curl and the publishable key could burn a couple's credits or
  // refund at will.
  const fns = [
    'moodboard_begin_render',
    'moodboard_finish_render',
    'moodboard_fail_render',
    'moodboard_set_share_consent',
    'moodboard_set_render_featured',
    'moodboard_admin_all_renders',
  ];
  for (const fn of fns) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')) AS ok
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = $1`,
      [fn],
    );
    assert.equal(r.rows[0]?.ok, false, `anon must not hold EXECUTE on ${fn}`);
  }
});

test('anon holds no grant on the share-consent table', async () => {
  for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege('anon','public.event_render_share_consent',$1) AS ok`,
      [priv],
    );
    assert.equal(r.rows[0]!.ok, false, `anon must not hold ${priv} on event_render_share_consent`);
  }
  // And `authenticated` may READ (that is how a couple sees their own consent)
  // but never WRITE — writing it also grants credits.
  const read = await db.query<{ ok: boolean }>(
    `SELECT has_table_privilege('authenticated','public.event_render_share_consent','SELECT') AS ok`,
  );
  assert.equal(read.rows[0]!.ok, true);
  for (const priv of ['INSERT', 'UPDATE', 'DELETE']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege('authenticated','public.event_render_share_consent',$1) AS ok`,
      [priv],
    );
    assert.equal(r.rows[0]!.ok, false, `authenticated must not hold ${priv} — the RPC writes it`);
  }
});

/* ── a session may READ a render and write NOTHING ───────────────────────── */

test('authenticated holds no INSERT/UPDATE/DELETE on event_renders', async () => {
  // 🛑 THIS WAS A REAL, REACHABLE HOLE, CAUGHT BY THE EXPOSURE FREEZE.
  //
  // MB2 revoked anon and stopped, leaving `authenticated` with Supabase's
  // default write grants on every column, policed only by row policies. Inert
  // while nothing used the table — and MB8 is the first reader AND writer, so
  // MB8 is what made all three of these reachable with curl and a couple's own
  // login:
  //
  //   · SET featured_at  → feature your own creation, no consent, no admin
  //   · SET image_key    → point your row at any key in the PRIVATE bucket,
  //                        which also holds payment screenshots, and have the
  //                        gallery mint you a presigned URL for it
  //   · SET credits_debited = 0, or INSERT a finished row → a free render
  //
  // 🔑 RLS IS ROW-LEVEL: it decides WHICH ROW, never WHICH VALUE. Only the
  // grant can refuse this, which is why the capability is gone rather than
  // policed.
  for (const priv of ['INSERT', 'UPDATE', 'DELETE']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege('authenticated','public.event_renders',$1) AS ok`,
      [priv],
    );
    assert.equal(
      r.rows[0]!.ok,
      false,
      `authenticated must not hold ${priv} on event_renders — every write goes through a ` +
        `SECURITY DEFINER function`,
    );
  }

  // Column-level too: a table-level revoke can be undone one column at a time,
  // and featured_at is the column that matters most.
  for (const col of ['featured_at', 'image_key', 'credits_debited']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_column_privilege('authenticated','public.event_renders',$1,'UPDATE') AS ok`,
      [col],
    );
    assert.equal(r.rows[0]!.ok, false, `authenticated must not hold UPDATE on ${col}`);
  }

  // READ is still granted — that is how a couple sees their own gallery at all.
  const read = await db.query<{ ok: boolean }>(
    `SELECT has_table_privilege('authenticated','public.event_renders','SELECT') AS ok`,
  );
  assert.equal(read.rows[0]!.ok, true, 'members must still be able to READ their own renders');
});

test('the stranded write policies are gone with the grant', async () => {
  // Leaving couple_insert/update/delete in the catalog after revoking the
  // capability they govern would strand three rules that can never fire —
  // and the next person to hit the resulting permission error would restore
  // the grant and silently reopen all three holes above.
  const r = await db.query<{ policyname: string }>(
    `SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename='event_renders'`,
  );
  const names = r.rows.map((x) => x.policyname);
  for (const gone of [
    'event_renders_couple_insert',
    'event_renders_couple_update',
    'event_renders_couple_delete',
  ]) {
    assert.ok(!names.includes(gone), `${gone} must be dropped alongside the grant, not stranded`);
  }
  assert.ok(
    names.includes('event_renders_member_read'),
    'the READ policy must remain — it is the one that still has a grant behind it',
  );
});

/* ── the reuse pool's quarantine handle ──────────────────────────────────── */

test('an admin can block a render from the reuse pool, and `reusable` follows', async () => {
  // `event_renders.reusable` is GENERATED and refuses every direct write —
  // deliberately, because a settable flag drifts from the note it encodes.
  // `reuse_blocked` is its one handle, and MB2 recorded it in
  // gates-have-handles.baseline.txt as a gate with NO CONTROL, naming MB8 as
  // the change that owed one. A quarantine switch nobody can reach is the same
  // as no quarantine.
  const u = await newUser('mb8-quarantine@example.com');
  const e = await newEvent('Quarantine wedding', u);
  const admin = await newUser('mb8-admin4@example.com');
  await makeAdmin(admin);

  await setAuthUid(db, u);
  await grant(e, 50);
  const id = await begin(e, 'room:ceiling', 1); // no note → pool-eligible
  await db.query(`SELECT public.moodboard_finish_render($1,'renders/q.png')`, [id]);

  const before = await db.query<{ reusable: boolean }>(
    `SELECT reusable FROM public.event_renders WHERE render_id=$1`, [id]);
  assert.equal(before.rows[0]!.reusable, true, 'a note-free delivered render is in the pool');

  // A couple must not be able to touch the pool.
  assert.equal(
    await boolRpc(`SELECT public.moodboard_set_render_reuse_blocked($1,TRUE) AS ok`, [id]),
    false,
    'quarantine is an admin act',
  );

  await setAuthUid(db, admin);
  assert.equal(
    await boolRpc(`SELECT public.moodboard_set_render_reuse_blocked($1,TRUE) AS ok`, [id]),
    true,
  );
  const after = await db.query<{ reusable: boolean; reuse_blocked: boolean }>(
    `SELECT reusable, reuse_blocked FROM public.event_renders WHERE render_id=$1`, [id]);
  assert.equal(after.rows[0]!.reuse_blocked, true);
  assert.equal(
    after.rows[0]!.reusable,
    false,
    'reusable is GENERATED from reuse_blocked — there is one flag, so the two cannot disagree',
  );

  // And it is reversible without touching the couple's own copy.
  assert.equal(
    await boolRpc(`SELECT public.moodboard_set_render_reuse_blocked($1,FALSE) AS ok`, [id]),
    true,
  );
  const back = await db.query<{ reusable: boolean; image_key: string }>(
    `SELECT reusable, image_key FROM public.event_renders WHERE render_id=$1`, [id]);
  assert.equal(back.rows[0]!.reusable, true);
  assert.equal(back.rows[0]!.image_key, 'renders/q.png', 'the couple keeps their photograph');
});

test('anon holds no EXECUTE on the quarantine handle either', async () => {
  const r = await db.query<{ ok: boolean }>(
    `SELECT bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')) AS ok
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname='moodboard_set_render_reuse_blocked'`,
  );
  assert.equal(r.rows[0]?.ok, false);
});
