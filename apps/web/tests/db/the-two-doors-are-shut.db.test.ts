/**
 * THE TWO DOORS THE DATABASE LEFT OPEN — both now shut, and both CONTROLS still open.
 *
 * Found by a verification pass over the Story build (2026-09-10) and re-measured by hand
 * against production before anything was written:
 *
 *  · A signed-in host could PATCH `event_editorial.status='published'` straight through
 *    PostgREST with NO consent tick. `authenticated` holds UPDATE on both `status` and
 *    `publish_consent_at`, the policy is PERMISSIVE FOR ALL to the couple, and the only
 *    triggers were the edition stamp and updated_at. The app refused; nothing else did.
 *  · A guest's WITHDRAWN wish or letter could be put back to 'approved'. `photo_messages`
 *    had no triggers at all.
 *
 * 🔑 EVERY REFUSAL HERE HAS A CONTROL BESIDE IT. A guard that only proves something is
 * refused cannot tell "the door is shut" from "the room is bricked up" — and this repo has
 * shipped exactly that (a forward primitive with no inverse, a rule that made a legitimate
 * act impossible). So each door asserts the dishonest act FAILS **and** the honest one still
 * SUCCEEDS.
 *
 * ⚠ THE REPLAY RUNS AS SUPERUSER, so it cannot prove the GRANT half. It proves the TRIGGERS
 * fire, which is what this migration adds. The grant reality was measured against production
 * directly, and the whole migration was dry-run there inside BEGIN…ROLLBACK:
 *   DOOR1_FORCED=REFUSED | DOOR1_WITH_CONSENT=ACCEPTED
 *   DOOR2_REAPPROVE=REFUSED | DOOR2_REJECT_STILL_OK=ACCEPTED
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

let n = 0;

/** A real auth row — `event_members.user_id` carries an FK, so an invented uuid is refused. */
async function newHost(): Promise<string> {
  n += 1;
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`doors-host-${n}@example.test`],
  );
  return r.rows[0]!.id;
}

async function newEventWithStory(): Promise<{ eventId: string; hostUid: string }> {
  n += 1;
  const hostUid = await newHost();
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Doors test ${n}', 'birthday', CURRENT_DATE - 1) RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  // The couple policy is `event_id IN (SELECT current_couple_event_ids())`, which reads
  // `event_members`. Without this row an authenticated UPDATE matches nothing and the
  // trigger never runs — the vacuous pass this suite exists to avoid.
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [eventId, hostUid],
  );
  /*
   * ⚠ DO NOT INSERT THE STORY ROW. A trigger on `events` creates an
   * `event_editorial` row for EVERY event — the first cut of this helper
   * inserted one and every test died on the unique key. That auto-creation is
   * also the reason an unpublished story was once readable by anybody: the row
   * exists long before anyone decides to publish. Take the row that is there.
   */
  await db.query(`UPDATE public.event_editorial SET status='draft' WHERE event_id=$1`, [eventId]);
  const check = await db.query(`SELECT 1 FROM public.event_editorial WHERE event_id=$1`, [eventId]);
  assert.equal(check.rows.length, 1, 'expected the auto-created story row to exist');
  return { eventId, hostUid };
}

/**
 * 🔴 DOOR 1 IS ENFORCED AGAINST `authenticated` ONLY — so a test that does not become
 * `authenticated` PASSES VACUOUSLY. The replay runs as superuser, the trigger returns early for
 * it, and the forced publish would simply succeed while the test reported green.
 *
 * That is this repo's most expensive shape (a guard that cannot fire), so every door-1 assertion
 * goes through here, and test 1b below proves the role actually changes.
 */
async function asAuthenticated<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  /*
   * 🪤 BECOMING THE ROLE IS NOT ENOUGH — the first cut did only `SET ROLE` and the
   * forced publish came back ACCEPTED. With no `auth.uid()` the couple policy matched
   * ZERO ROWS, so the UPDATE touched nothing, no trigger fired, and nothing threw.
   * *An RLS refusal and a successful no-op are the same value.* The uid has to be set
   * too, so the row is genuinely reachable and the TRIGGER is what refuses it.
   */
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role','authenticated',false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role','',false)`).catch(() => {});
  }
}

async function refuses(fn: () => Promise<unknown>, marker: string): Promise<void> {
  let threw = false;
  try {
    await fn();
  } catch (e) {
    threw = true;
    assert.match(
      String(e),
      new RegExp(marker),
      `refused, but not by the guard under test — got: ${String(e)}`,
    );
  }
  assert.ok(threw, `expected a refusal carrying "${marker}", but the write was ACCEPTED`);
}

test('1 · the two triggers exist at all — this guard is watching something', async () => {
  const res = await db.query<{ tgname: string }>(
    `SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE NOT t.tgisinternal
        AND tgname IN ('event_editorial_publish_needs_consent',
                       'photo_messages_withdrawn_stays_withdrawn',
                       'guest_columns_withdrawn_stays_withdrawn')`,
  );
  assert.equal(res.rows.length, 3, `expected all three triggers, found ${res.rows.length}`);
});

test('2 · DOOR 1 — publishing without the consent tick is REFUSED', async () => {
  const { eventId, hostUid } = await newEventWithStory();
  await asAuthenticated(hostUid, () =>
    refuses(
      () =>
        db.query(
          `UPDATE public.event_editorial SET status='published', publish_consent_at=NULL WHERE event_id=$1`,
          [eventId],
        ),
      'publish_needs_consent',
    ),
  );
});

test('2b · CONTROL — publishing WITH the tick still succeeds', async () => {
  const { eventId, hostUid } = await newEventWithStory();
  await db.query(
    `UPDATE public.event_editorial SET status='published', publish_consent_at=now() WHERE event_id=$1`,
    [eventId],
  );
  const res = await db.query<{ status: string }>(
    `SELECT status FROM public.event_editorial WHERE event_id=$1`,
    [eventId],
  );
  assert.equal(res.rows[0]!.status, 'published', 'an honest publish must not be blocked');
});

test('2c · a story ALREADY published is not re-guarded — the invariant is the TRANSITION', async () => {
  const { eventId, hostUid } = await newEventWithStory();
  await db.query(
    `UPDATE public.event_editorial SET status='published', publish_consent_at=now() WHERE event_id=$1`,
    [eventId],
  );
  // Clearing the tick on an already-published row must not brick every later write to it.
  await db.query(
    `UPDATE public.event_editorial SET publish_consent_at=NULL, edited_by_couple=true WHERE event_id=$1`,
    [eventId],
  );
});

test('1b · SET ROLE really takes — otherwise every door-1 assertion here is vacuous', async () => {
  const { hostUid } = await newEventWithStory();
  const before = await db.query<{ u: string }>(`SELECT current_user AS u`);
  const during = await asAuthenticated(hostUid, () =>
    db.query<{ u: string }>(`SELECT current_user AS u`),
  );
  assert.notEqual(during.rows[0]!.u, before.rows[0]!.u, 'the role never changed');
  assert.equal(during.rows[0]!.u, 'authenticated');
});

test('2d · the SERVICE ROLE may still publish without the tick — it already sets it, and restores need this', async () => {
  const { eventId, hostUid } = await newEventWithStory();
  // Superuser here stands for the service role: the trigger deliberately does not
  // police a caller the browser cannot become. Four shipped edition-stamping tests
  // seed exactly this state, and policing it broke all of them.
  await db.query(
    `UPDATE public.event_editorial SET status='published', publish_consent_at=NULL WHERE event_id=$1`,
    [eventId],
  );
  const res = await db.query<{ status: string }>(
    `SELECT status FROM public.event_editorial WHERE event_id=$1`,
    [eventId],
  );
  assert.equal(res.rows[0]!.status, 'published');
});

test('3 · DOOR 2 — a withdrawn wish cannot be approved back onto the story', async () => {
  const { eventId, hostUid } = await newEventWithStory();
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category) VALUES ($1,'Probe','Guest','both','friends') RETURNING guest_id`,
    [eventId],
  );
  const m = await db.query<{ message_id: string }>(
    `INSERT INTO public.photo_messages
       (event_id, source_table, source_id, guest_id, body_text, status, moderation_state,
        consent_captured_at, user_deleted_at)
     VALUES ($1,'papic_photos',gen_random_uuid(),$2,'withdrawn words','user_deleted','clean',now(),now())
     RETURNING message_id`,
    [eventId, g.rows[0]!.guest_id],
  );
  await refuses(
    () =>
      db.query(`UPDATE public.photo_messages SET status='approved' WHERE message_id=$1`, [
        m.rows[0]!.message_id,
      ]),
    'withdrawn_stays_withdrawn',
  );
});

test('3b · CONTROL — a host may still REJECT a withdrawn wish, and a live one still approves', async () => {
  const { eventId, hostUid } = await newEventWithStory();
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category) VALUES ($1,'Probe','Guest','both','friends') RETURNING guest_id`,
    [eventId],
  );
  const gid = g.rows[0]!.guest_id;

  const withdrawn = await db.query<{ message_id: string }>(
    `INSERT INTO public.photo_messages
       (event_id, source_table, source_id, guest_id, body_text, status, moderation_state,
        consent_captured_at, user_deleted_at)
     VALUES ($1,'papic_photos',gen_random_uuid(),$2,'withdrawn','user_deleted','clean',now(),now())
     RETURNING message_id`,
    [eventId, gid],
  );
  await db.query(`UPDATE public.photo_messages SET status='rejected' WHERE message_id=$1`, [
    withdrawn.rows[0]!.message_id,
  ]);

  const live = await db.query<{ message_id: string }>(
    `INSERT INTO public.photo_messages
       (event_id, source_table, source_id, guest_id, body_text, status, moderation_state,
        consent_captured_at)
     VALUES ($1,'papic_photos',gen_random_uuid(),$2,'a live wish','pending','clean',now())
     RETURNING message_id`,
    [eventId, gid],
  );
  await db.query(`UPDATE public.photo_messages SET status='approved' WHERE message_id=$1`, [
    live.rows[0]!.message_id,
  ]);
  const res = await db.query<{ status: string }>(
    `SELECT status FROM public.photo_messages WHERE message_id=$1`,
    [live.rows[0]!.message_id],
  );
  assert.equal(res.rows[0]!.status, 'approved', 'an ordinary approval must still work');
});
