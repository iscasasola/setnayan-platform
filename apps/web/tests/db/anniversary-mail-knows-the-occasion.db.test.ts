/**
 * 🔒 NO SOLEMN EVENT EVER REACHES THE ANNIVERSARY MAIL.
 *
 * Covers migration 20271174085072. `couples_with_anniversary_today()` picks the
 * recipients for BOTH annual emails, and it had NO event_type predicate at all
 * while the templates it feeds were hardcoded wedding copy — *'you said "I
 * do."'* and *"worth celebrating."* A year after a wake, that is what a
 * bereaved family was in line to receive.
 *
 * ⚠ THE RECIPIENT JOIN IS NOT A WEDDING FILTER, WHICH IS WHY THIS WAS LIVE.
 * The function picks whoever holds `event_members.member_type = 'couple'`, and
 * that membership type is legacy naming every event type mints — measured in
 * production, both non-wedding events carry one. The first test below is the
 * one that proves the bug was reachable rather than theoretical.
 *
 * ── WHY THIS IS A DB TEST AND NOT A STRING MATCH ────────────────────────────
 * A guard that greps the migration for the word "solemn" passes whether or not
 * the predicate does anything. These call the function and read what comes
 * back, so a predicate that is present and inert fails here.
 *
 * ── THE ALLOW-LIST, AND WHY IT IS AN ALLOW-LIST ─────────────────────────────
 * The rule is "the type has a profile row and it does not say solemn", not "no
 * row says solemn". `createEventTypeCore` (lib/event-types-mutations.ts)
 * inserts a `event_type_vocab` row and nothing else, so a BRAND-NEW event type
 * has no profile row until an admin sets its tone. Under a deny-list such a
 * type would receive "you said I do"; under the allow-list it receives nothing
 * until somebody has decided what kind of day it is. Pinned below.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

/** The anniversary the selector is asked about — one year after the seeds. */
const TODAY = '2027-06-15';
const EVENT_DATE = '2026-06-15';

type Candidate = { event_id: string; event_type: string | null; years_ago: number };

async function candidates(today = TODAY): Promise<Candidate[]> {
  const r = await db.query<Candidate>(
    `SELECT event_id, event_type, years_ago
       FROM public.couples_with_anniversary_today($1::date)`,
    [today],
  );
  return r.rows;
}

/** One event of `type`, with a 'couple'-typed member holding a real address. */
async function seedEvent(type: string, name: string): Promise<string> {
  const email = `${name.replace(/[^a-z0-9]/gi, '').toLowerCase()}@test.invalid`;
  // `public.users.user_id` FKs to `auth.users`, which the replay shims — seed
  // the auth row first, exactly as the other db tests do.
  //
  // ⚠ AND THE public.users ROW IS ALREADY THERE BY THEN. `on_auth_user_created`
  // mints it from the auth row, so a plain INSERT here is a duplicate-key
  // failure, not a seed. Upsert the display name onto what the trigger made.
  const a = await db.query<{ id: string }>(
    `INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id`,
    [email],
  );
  const userId = a.rows[0]!.id;
  await db.query(
    `INSERT INTO public.users (user_id, email, display_name) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name`,
    [userId, email, name],
  );
  // `events_wedding_fields_consistency` is a two-way CHECK: a wedding MUST
  // carry ceremony_type + venue_setting, and every other type must carry
  // NEITHER. So the pair is set from the type rather than passed in.
  const isWedding = type === 'wedding';
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events
       (display_name, event_type, event_date, archived, ceremony_type, venue_setting)
     VALUES ($1, $2, $3::date, FALSE, $4, $5) RETURNING event_id`,
    [name, type, EVENT_DATE, isWedding ? 'catholic' : null, isWedding ? 'garden' : null],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [eventId, userId],
  );
  return eventId;
}

let weddingId: string;
let birthdayId: string;
let funeralId: string;

/**
 * The solemn type this file exercises, created HERE rather than reused from the
 * shipped roster.
 *
 * ⛔ IT DELIBERATELY DOES NOT USE THE SHIPPED SOLEMN TYPE'S KEY. That key is
 * being renamed by the owner on 2026-08-27 ("Wake is the viewing, funeral is
 * the ceremony until burial"), and a test that seeds the old string would fail
 * the moment the vocab row moves — for a reason that has nothing to do with
 * what it is testing. What is under test is that a SOLEMN REGISTER is refused,
 * whatever the row is filed under, so the test creates its own type and says so.
 */
const SOLEMN_KEY = 'anniv_test_solemn';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await db.query(
    `INSERT INTO public.event_type_vocab (event_type, label_en, sort_order, status, enabled)
     VALUES ($1, 'Solemn (test)', 990, 'active', TRUE) ON CONFLICT (event_type) DO NOTHING`,
    [SOLEMN_KEY],
  );
  await db.query(
    `INSERT INTO public.event_type_profiles (event_type, terminology)
     VALUES ($1, '{"register":"solemn","event_word":"wake"}'::jsonb)
     ON CONFLICT (event_type) DO UPDATE SET terminology = EXCLUDED.terminology`,
    [SOLEMN_KEY],
  );
  weddingId = await seedEvent('wedding', 'Maria and Jose');
  birthdayId = await seedEvent('birthday', 'Mateo Turns Seven');
  funeralId = await seedEvent(SOLEMN_KEY, 'In memory of Lola Rosa');
});

after(async () => {
  await replay?.close?.();
});

/* ══════════════════════════════════════════════════════════════════════════
   1 · THE BUG WAS REACHABLE — the recipient join admits every event type
   ══════════════════════════════════════════════════════════════════════════ */

test('the wake clears EVERY other condition — the type predicate is the only thing holding it back', async () => {
  // 🔑 THIS IS THE ONE THAT PROVES THE BUG WAS LIVE, and it is deliberately not
  // "does the wake have a couple member" — I seeded that row, so asking about
  // it would be asking myself. Instead: run the selector's OTHER predicates,
  // exactly as they are written, and see whether the wake satisfies them all.
  // If it does, then before this migration it WAS returned, and the new
  // predicate is the whole of what stops it now.
  const r = await db.query<{ event_id: string }>(
    `SELECT e.event_id
       FROM public.events e
       JOIN LATERAL (
         SELECT em.user_id FROM public.event_members em
          WHERE em.event_id = e.event_id AND em.member_type = 'couple'
          ORDER BY em.joined_at ASC, em.id ASC LIMIT 1
       ) cm ON TRUE
       JOIN public.users u ON u.user_id = cm.user_id
      WHERE e.event_id = $1
        AND e.event_date IS NOT NULL
        AND e.archived = FALSE
        AND EXTRACT(MONTH FROM e.event_date) = EXTRACT(MONTH FROM $2::date)
        AND EXTRACT(DAY   FROM e.event_date) = EXTRACT(DAY   FROM $2::date)
        AND e.event_date < $2::date
        AND u.email IS NOT NULL
        AND u.deleted_at IS NULL`,
    [funeralId, TODAY],
  );
  assert.equal(
    r.rows.length,
    1,
    'the wake must satisfy every pre-existing condition. If it does not, this ' +
      'file is not testing what it claims — the gate below would be passing ' +
      'for some unrelated reason.',
  );
  // …and yet the real function refuses it. Both halves, in one test.
  const rows = await candidates();
  assert.ok(
    !rows.some((c) => c.event_id === funeralId),
    'it qualifies on every other ground and is still returned — the event_type ' +
      'predicate is absent or inert.',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   2 · THE GATE
   ══════════════════════════════════════════════════════════════════════════ */

test('the wake is NOT a candidate for the anniversary mail', async () => {
  const rows = await candidates();
  const types = rows.map((c) => c.event_type).sort();
  assert.ok(
    !rows.some((c) => c.event_id === funeralId),
    `the solemn event came back as a recipient. Candidates: ${JSON.stringify(types)}`,
  );
});

test('the wedding and the birthday ARE still candidates — the gate is not a blanket', async () => {
  const rows = await candidates();
  const ids = rows.map((c) => c.event_id);
  assert.ok(ids.includes(weddingId), 'the wedding must still receive its anniversary mail');
  assert.ok(
    ids.includes(birthdayId),
    'a birthday is celebratory and must still receive it — a gate that ' +
      'silently switched the whole feature off would look exactly like this ' +
      'one working.',
  );
});

test('the selector returns event_type, so the mail can speak the occasion’s own words', async () => {
  const rows = await candidates();
  const wedding = rows.find((c) => c.event_id === weddingId);
  assert.equal(
    wedding?.event_type,
    'wedding',
    'without this column the job cannot resolve the event’s words and (by ' +
      'design) declines to send at all.',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   3 · THE GATE IS THE REGISTER, NOT ANY EVENT-TYPE NAME
   ══════════════════════════════════════════════════════════════════════════ */

test('a type whose profile says solemn is refused whatever it is called', async () => {
  await db.query(
    `INSERT INTO public.event_type_vocab (event_type, label_en, sort_order, status, enabled)
     VALUES ('memorial', 'Memorial', 900, 'active', TRUE)
     ON CONFLICT (event_type) DO NOTHING`,
  );
  await db.query(
    `INSERT INTO public.event_type_profiles (event_type, terminology)
     VALUES ('memorial', '{"register":"solemn","event_word":"memorial"}'::jsonb)
     ON CONFLICT (event_type) DO UPDATE SET terminology = EXCLUDED.terminology`,
  );
  const id = await seedEvent('memorial', 'A memorial gathering');
  const rows = await candidates();
  assert.ok(
    !rows.some((c) => c.event_id === id),
    'the predicate must read the REGISTER. A rule that only knows the string ' +
      "'funeral' is a deny-list of one, and the next solemn type walks past it.",
  );
});

test('A STRIPPED REGISTER IS NOT CAUGHT HERE — this asserts the known limit, on purpose', async () => {
  // 🛑 THIS TEST PASSES BY LETTING THE ROW THROUGH, AND THAT IS DELIBERATE.
  //
  // 🪤 Its first version claimed the opposite and was DECORATION — only the
  // mutation run said so. It DELETED the solemn profile row and asserted the
  // event stayed out; but a deleted row fails the allow-list on its own, so
  // removing the extra by-name refusal left it GREEN. It asserted the
  // allow-list twice and the belt never once.
  //
  // 🔑 The case a belt would cover is a solemn type whose row EXISTS and has
  // LOST its `register` key — not hypothetical here: the admin profile editor
  // once rebuilt `terminology` from its six form fields and silently dropped
  // every key the form has no input for, `register` among them.
  //
  // ⚖ The SQL belt was REMOVED because the only way to write it is to hardcode
  // an event-type key, and the owner renamed the solemn type on 2026-08-27. A
  // predicate naming the old value would have gone inert the day that landed —
  // still safe, but silently doing nothing.
  //
  // ✅ WHAT ACTUALLY STOPS IT is the code gate, and by construction: `toProfile`
  // falls back to the TYPE'S OWN code profile when a row omits `register`, and
  // the solemn type's code profile is solemn. So `anniversaryWordsFor` returns
  // null and the job declines. That fallback lives in lib/event-type-profile.ts
  // and survives the rename with the type.
  //
  // ⛔ IF THIS TEST EVER FAILS, somebody has added a SQL-side belt. Check
  // whether it names an event-type key; if it does, that is the fragile shape
  // this comment is about. If it is register-derived, delete this test rather
  // than repair it.
  await db.query(
    `UPDATE public.event_type_profiles SET terminology = '{"event_word":"wake"}'::jsonb
      WHERE event_type = $1`,
    [SOLEMN_KEY],
  );
  const stripped = await db.query<{ reg: string | null }>(
    `SELECT terminology->>'register' AS reg FROM public.event_type_profiles WHERE event_type = $1`,
    [SOLEMN_KEY],
  );
  assert.equal(
    stripped.rows[0]?.reg ?? null,
    null,
    'the register key must actually be gone, or this test proves nothing',
  );

  const rows = await candidates();
  assert.ok(
    rows.some((c) => c.event_id === funeralId),
    'the selector now refuses a register-less solemn row. See the note above ' +
      'before "fixing" this — the question is HOW it refuses it.',
  );

  await db.query(
    `UPDATE public.event_type_profiles
        SET terminology = '{"register":"solemn","event_word":"wake"}'::jsonb
      WHERE event_type = $1`,
    [SOLEMN_KEY],
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   4 · UNKNOWN FAILS CLOSED
   ══════════════════════════════════════════════════════════════════════════ */

test('a brand-new type with NO profile row receives nothing until its tone is set', async () => {
  await db.query(
    `INSERT INTO public.event_type_vocab (event_type, label_en, sort_order, status, enabled)
     VALUES ('vigil', 'Vigil', 901, 'active', TRUE)
     ON CONFLICT (event_type) DO NOTHING`,
  );
  const id = await seedEvent('vigil', 'A vigil');
  let rows = await candidates();
  assert.ok(
    !rows.some((c) => c.event_id === id),
    'createEventTypeCore writes a vocab row and NO profile row, so an ' +
      'unfinished type has no register at all. A deny-list would send it ' +
      'wedding copy; this allow-list sends nothing.',
  );

  // …and the moment an admin gives it a celebratory tone, it starts arriving.
  await db.query(
    `INSERT INTO public.event_type_profiles (event_type, terminology)
     VALUES ('vigil', '{"register":"celebratory","event_word":"vigil"}'::jsonb)
     ON CONFLICT (event_type) DO UPDATE SET terminology = EXCLUDED.terminology`,
  );
  rows = await candidates();
  assert.ok(
    rows.some((c) => c.event_id === id),
    'the allow-list must OPEN once the tone is known, or it is a gate with no ' +
      'handle — a feature that silently stops for every new event type.',
  );
});

test('a NULL register reads as celebratory, matching the code resolver', async () => {
  // 16 of the 17 seeded types carry no `register` key at all; toProfile() in
  // lib/event-type-profile.ts resolves that to the fallback register, which is
  // 'celebratory'. If the SQL disagreed, every one of them would go silent.
  const r = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.event_type_profiles
      WHERE terminology->>'register' IS NULL`,
  );
  assert.ok(
    Number(r.rows[0]!.n) > 0,
    'expected seeded profiles with no register key — if this is 0 the test ' +
      'below proves nothing.',
  );
  const rows = await candidates();
  assert.ok(
    rows.some((c) => c.event_id === birthdayId),
    "the birthday's profile carries no register key and it must still be a " +
      'candidate.',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   5 · THE OLD FILTERS STILL WORK — a new predicate must not eat the others
   ══════════════════════════════════════════════════════════════════════════ */

test('archived, future and already-sent events are still excluded', async () => {
  const archived = await seedEvent('birthday', 'Archived birthday');
  await db.query(`UPDATE public.events SET archived = TRUE WHERE event_id = $1`, [archived]);

  let rows = await candidates();
  assert.ok(!rows.some((c) => c.event_id === archived), 'archived must stay excluded');

  // Same calendar day, but not yet in the past → years_ago would be 0.
  rows = await candidates(EVENT_DATE);
  assert.ok(
    !rows.some((c) => c.event_id === weddingId),
    'an event on its own date is not an anniversary yet',
  );

  // The once-a-year idempotency lock.
  await db.query(
    `INSERT INTO public.anniversary_email_log (event_id, anniversary_year) VALUES ($1, 2027)`,
    [weddingId],
  );
  rows = await candidates();
  assert.ok(
    !rows.some((c) => c.event_id === weddingId),
    'the per-year lock must still suppress a second send',
  );
});
