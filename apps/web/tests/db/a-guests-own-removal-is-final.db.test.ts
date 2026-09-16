/**
 * A GUEST'S OWN REMOVAL IS FINAL — asserted against the REPLAYED FUNCTION, not
 * its source text, because the thing that can be wrong is a branch.
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * `wall_unhide` authorised couple/coordinator/admin and then cleared BOTH
 * `wall_hidden_at` AND `wall_hidden_by_guest_id`. So a guest took her own
 * photograph off the wall, the couple pressed un-hide, and:
 *   • it went back up in front of the room, and
 *   • the column recording THAT SHE REMOVED IT was erased.
 * The second half is the worse half — it destroyed the evidence of the first,
 * so nothing afterwards could tell her removal from a moderator's.
 *
 * ⚖ Owner, asked whether the couple may put it back: "correct" — they may not.
 *
 * ── What is pinned ─────────────────────────────────────────────────────────
 * 1. a guest-hidden photograph REFUSES the couple;
 * 2. a moderator-hidden one still un-hides — the couple keep every power they
 *    had over their OWN moderation, which is what makes this a rule and not a
 *    removal of a feature;
 * 3. the refusal is not a permission error — she is allowed to moderate this
 *    wall; this one photograph is not hers to restore.
 *
 * 🔑 Property 2 is the one that makes property 1 meaningful. A guard that only
 * checked the refusal would pass a function that refused EVERYTHING — the
 * cheapest way to satisfy "the couple cannot restore this" is to let them
 * restore nothing, and that is a different product.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const EVENT = '33333333-3333-4333-8333-333333333331';
const GUEST = '55555555-5555-4555-8555-555555555551';
const BY_GUEST = '66666666-6666-4666-8666-666666666661';
const BY_MOD = '66666666-6666-4666-8666-666666666662';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  // ⚠ `events_wedding_fields_consistency`: a wedding MUST carry ceremony_type and
  // venue_setting; anything else must carry NEITHER. The first fixture omitted
  // all three with event_type defaulting to 'wedding' and was refused — the
  // constraint is doing its job, and a fixture that fights it is the fixture's
  // fault. A non-wedding is the smaller shape here: this rule is about a guest's
  // photograph, which is not a wedding-only idea.
  await db.query(`INSERT INTO events (event_id, slug, display_name, event_type)
                  VALUES ($1,'her-removal-fixture','Her Removal Fixture','birthday')
                  ON CONFLICT DO NOTHING`, [EVENT]);
  // `event_members.user_id` is FK'd to auth.users — a hand-picked UUID is
  // refused. Let the database mint the id and use what it returns, rather than
  // asserting one into existence.
  const { rows: users } = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('couple@her-removal.test', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  const COUPLE = users[0]!.id;
  await db.query(`INSERT INTO event_members (event_id, user_id, member_type)
                  VALUES ($1,$2,'couple') ON CONFLICT DO NOTHING`, [EVENT, COUPLE]);
  // `guests.first_name` is NOT NULL — display_name alone is refused. Third
  // constraint this fixture met and the third time the schema was right: a
  // guest without a first name is not a guest. Seeding around it would have
  // meant testing a row the product cannot produce.
  // ⚠ FOUR constraints refused this fixture before it stood up, one at a time —
  // a wedding needs a ceremony_type, event_members.user_id is FK'd to
  // auth.users, guests.first_name is NOT NULL, and so are `side` and
  // `group_category`. Every one of them was the schema being right and the
  // fixture being wrong. The whack-a-mole ended by asking
  // information_schema for EVERY not-null-without-default column at once
  // instead of guessing the next one — four round trips that should have been
  // one query.
  await db.query(
    `INSERT INTO guests (guest_id, event_id, first_name, last_name, display_name, side, group_category)
     VALUES ($1,$2,'A','Guest','A Guest','both','friends') ON CONFLICT DO NOTHING`,
    [GUEST, EVENT],
  );
  // papic_photos requires a seat and an object key. ⚠ The table is
  // `paparazzi_seats` — NOT `papic_paparazzi_seats`. Every OTHER table in this
  // subsystem carries the `papic_` prefix (`papic_photos` right below it), so
  // the prefix was supplied from the pattern rather than read from the
  // migration, and PGlite answered `relation ... does not exist` — which reads
  // like a missing migration, not like a typo.
  // Its three NOT NULL columns without defaults — seat_index, sku_code,
  // claim_qr_token — are listed here because they were read out of
  // information_schema in ONE query, which is what the note above should have
  // done the first time.
  const { rows: seats } = await db.query<{ seat_id: string }>(
    `INSERT INTO paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token)
     VALUES ($1, 1, 'paparazzi_3_seats', 'her-removal-fixture-token')
     RETURNING seat_id`, [EVENT],
  );
  const SEAT = seats[0]!.seat_id;
  // One photo SHE took down, one a moderator took down.
  await db.query(
    `INSERT INTO papic_photos
       (photo_id, event_id, paparazzi_seat_id, r2_object_key, wall_hidden_at, wall_hidden_by_guest_id)
     VALUES ($1,$2,$5,'fixture/by-guest.jpg',NOW(),$3),
            ($4,$2,$5,'fixture/by-mod.jpg',  NOW(),NULL)
     ON CONFLICT DO NOTHING`,
    [BY_GUEST, EVENT, GUEST, BY_MOD, SEAT],
  );
  // ⚠ TWO ways to get this wrong, and BOTH report the same thing — 'not
  // authorized to moderate this wall', which reads as the authorisation branch
  // being wrong rather than as the identity never arriving.
  //   1. set_config's third argument is is_local. `true` scopes it to the
  //      CURRENT TRANSACTION, and there is none open here, so it survived
  //      exactly one statement.
  //   2. the replay's auth.uid() reads `request.jwt.claim.sub` — the dotted
  //      singular GUC — NOT the `request.jwt.claims` JSON blob. Writing the
  //      JSON one sets a setting auth.uid() never looks at; auth.jwt() is its
  //      only reader.
  // `setAuthUid` from ./replay-migrations does both correctly. Use it.
  await setAuthUid(db, COUPLE);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
});

test('the couple CANNOT put back a photograph the guest took down herself', async () => {
  await assert.rejects(
    () => db.query(`SELECT wall_unhide('papic_photos', $1)`, [BY_GUEST]),
    /only she can put it back/,
    'a guest-hidden photograph must refuse the couple — her withdrawal is the stronger signal, ' +
      'and it is the difference between a takedown and a suggestion',
  );

  const { rows } = await db.query<{ hidden: string | null; by_guest: string | null }>(
    `SELECT wall_hidden_at AS hidden, wall_hidden_by_guest_id AS by_guest
       FROM papic_photos WHERE photo_id = $1`, [BY_GUEST],
  );
  assert.notEqual(rows[0]?.hidden, null, 'it must still be hidden after the refusal');
  assert.equal(rows[0]?.by_guest, GUEST,
    'and the record that SHE removed it must survive — erasing it is the worse half of the defect');
});

test('but the couple CAN still un-hide what a moderator hid', async () => {
  // 🔑 Without this, "refuse everything" satisfies the test above and takes a
  // real power away from the couple. The rule is about HER photograph, not
  // about their wall.
  const { rows } = await db.query<{ wall_unhide: boolean }>(
    `SELECT wall_unhide('papic_photos', $1)`, [BY_MOD],
  );
  assert.equal(rows[0]?.wall_unhide, true, 'moderator-hidden photographs must still un-hide');

  const check = await db.query<{ hidden: string | null }>(
    `SELECT wall_hidden_at AS hidden FROM papic_photos WHERE photo_id = $1`, [BY_MOD],
  );
  assert.equal(check.rows[0]?.hidden, null, 'and it must actually be back on the wall');
});
