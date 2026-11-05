/**
 * 🪪 A TITLE CARRIES WOMAN OR MAN — `guests.gender`, against the real replayed schema.
 *
 * ⚖ Owner 2026-10-17: *"let them choose Atty (Female) or Atty (Male)"* → *"so no need to choose"*. Migration
 * `20271271534871_a_title_carries_woman_or_man.sql`.
 *
 * THE PROPERTIES:
 *   1. THE BACKFILL MAPS ONLY THE TITLES THAT SAY IT. The migration file is RE-APPLIED (it is idempotent) over a cast
 *      whose genders were wiped: Mr. → man, Ms. / Mrs. / Miss → woman (any case, with or without the dot); Atty., Dr.,
 *      a typed "Regional Prosecutor", "Atty. Mrs." and no title at all stay NULL; a gender a host already picked
 *      ("Atty. (Woman)") is never overwritten.
 *   2. EVERY WRITER GETS IT FREE: an insert or update naming only `name_prefix` = "Mrs." carries 'woman'; a title that
 *      says it wins over a contradicting gender; a title that says nothing leaves the gender the row already had.
 *   3. The CHECK holds the two words; the column reads and writes for every role exactly like `name_prefix`.
 *
 * Sabotage (2026-10-17), each seen RED then restored: the backfill's IN list widened with 'atty' → 1 (property 1);
 * the trigger's `IF said IS NOT NULL` dropped (a neutral title clears the gender) → 1 (property 2); the grant line
 * removed and the table re-cut without the column → the migration's own post-condition stops the replay.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

const MIGRATION = join(dirname(fileURLToPath(import.meta.url)), '../../../../supabase/migrations/20271271534871_a_title_carries_woman_or_man.sql');

let replay: ReplayResult;
let db: ReplayResult['db'];
let eventId = '';

const CAST: Array<[first: string, prefix: string | null, expect: 'woman' | 'man' | null]> = [
  ['Pedro', 'Mr.', 'man'],
  ['Pablo', 'mr', 'man'],
  ['Luz', 'Mrs.', 'woman'],
  ['Ana', 'Ms.', 'woman'],
  ['Bea', 'MISS', 'woman'],
  ['Eufemia', 'Atty.', null],
  ['Tina', 'Dr.', null],
  ['Rex', 'Regional Prosecutor', null],
  ['Lorna', 'Atty. Mrs.', null],
  ['Nida', null, null],
];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date) VALUES ('Titles', 'birthday', '2027-06-06') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  for (const [first, prefix] of CAST) {
    await db.query(
      `INSERT INTO public.guests (event_id, first_name, last_name, name_prefix, side, group_category, rsvp_status)
       VALUES ($1, $2, 'Cruz', $3, 'both', 'family', 'pending')`,
      [eventId, first, prefix],
    );
  }
  // A host who already picked "Atty. (Woman)".
  await db.query(
    `INSERT INTO public.guests (event_id, first_name, last_name, name_prefix, gender, side, group_category, rsvp_status)
     VALUES ($1, 'Picked', 'Cruz', 'Atty.', 'woman', 'both', 'family', 'pending')`,
    [eventId],
  );
});
after(async () => {
  await db?.close();
});

const genderOf = async (first: string) =>
  (await db.query<{ gender: string | null }>(`SELECT gender FROM public.guests WHERE event_id = $1 AND first_name = $2`, [eventId, first]))
    .rows[0]!.gender;

test('the backfill maps ONLY the four titles that say it — re-applied over wiped genders, a picked one untouched', async () => {
  await db.query(`ALTER TABLE public.guests DISABLE TRIGGER guests_title_says_gender_trg`);
  await db.query(`UPDATE public.guests SET gender = NULL WHERE event_id = $1 AND first_name <> 'Picked'`, [eventId]);
  await db.query(`ALTER TABLE public.guests ENABLE TRIGGER guests_title_says_gender_trg`);
  for (const [first] of CAST) assert.equal(await genderOf(first), null, `${first} kept a gender through the wipe — the test sees nothing`);

  await db.exec(readFileSync(MIGRATION, 'utf8'));

  for (const [first, prefix, expect] of CAST) {
    assert.equal(await genderOf(first), expect, `"${prefix ?? '(no title)'}" → ${await genderOf(first)}, expected ${expect}`);
  }
  assert.equal(await genderOf('Picked'), 'woman', 'the backfill overwrote a gender the host picked');
});

test('every writer gets it free: the title that says it wins; a title that says nothing keeps what the row had', async () => {
  const id = (
    await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, name_prefix, gender, side, group_category, rsvp_status)
       VALUES ($1, 'Writer', 'Cruz', 'Mrs.', 'man', 'both', 'family', 'pending') RETURNING guest_id`,
      [eventId],
    )
  ).rows[0]!.guest_id;
  const g = async () => (await db.query<{ gender: string | null }>(`SELECT gender FROM public.guests WHERE guest_id = $1`, [id])).rows[0]!.gender;
  assert.equal(await g(), 'woman', 'a "Mrs." was stored as a man');
  await db.query(`UPDATE public.guests SET name_prefix = 'Atty.' WHERE guest_id = $1`, [id]);
  assert.equal(await g(), 'woman', 'changing "Mrs." to "Atty." forgot she is a woman');
  await db.query(`UPDATE public.guests SET gender = 'man' WHERE guest_id = $1`, [id]);
  assert.equal(await g(), 'man', 'a host pick on a neutral title did not stick');
  await db.query(`UPDATE public.guests SET gender = NULL WHERE guest_id = $1`, [id]);
  assert.equal(await g(), null, 'a host could not clear the gender of a neutral title');
  await db.query(`UPDATE public.guests SET name_prefix = 'Mr.' WHERE guest_id = $1`, [id]);
  assert.equal(await g(), 'man');
});

test('the CHECK holds the two words; the column is reachable exactly like name_prefix for every role', async () => {
  await assert.rejects(
    db.query(`UPDATE public.guests SET gender = 'female' WHERE event_id = $1 AND first_name = 'Nida'`, [eventId]),
    /guests_gender_chk|check/i,
  );
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const priv of ['SELECT', 'INSERT', 'UPDATE']) {
      const r = (
        await db.query<{ g: boolean; p: boolean }>(
          `SELECT has_column_privilege($1, 'public.guests', 'gender', $2) AS g, has_column_privilege($1, 'public.guests', 'name_prefix', $2) AS p`,
          [role, priv],
        )
      ).rows[0]!;
      assert.equal(r.g, r.p, `${role} ${priv}: gender ${r.g}, name_prefix ${r.p}`);
    }
  }
});
