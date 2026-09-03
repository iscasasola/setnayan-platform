/**
 * ⭐ A WEDDING HAS TWO VENUES — and until 2026-09-03 the schema stored one.
 *
 * Owner: *"venue is 2. ceremony and reception"* · *"ceremony venue is civil
 * registrar, church, mosque, garden, etc."*
 *
 * Migration 20271197508087 adds `events.ceremony_venue_setting` and narrows
 * `events_venue_setting_check` to drop `civil_registrar`, which describes where
 * you MARRY and had been storable as where you DINE.
 *
 * ── WHAT THIS FILE PROVES THAT A UNIT TEST CANNOT ───────────────────────────
 * `lib/venue-settings.test.ts` reads the migration TEXT. That catches drift
 * between the file and the TypeScript vocabulary; it cannot catch a migration
 * that does not apply, or that applies and leaves the column in the wrong
 * shape. This runs the FULL replay in filename order and asks the catalog.
 *
 * 🔑 AND IT PROVES THE DANGEROUS PART: **a CHECK cannot be added while an
 * existing row violates it.** Production held zero `civil_registrar` events on
 * 2026-09-03 (`select venue_setting, count(*) from public.events group by 1`),
 * so the replay alone can never exercise the case the migration was written
 * for — the tightening would pass for the trivial reason. The last test below
 * therefore RECONSTRUCTS the pre-migration world (the wide constraint, a real
 * event holding `civil_registrar`) and re-runs the migration's own two
 * statements over it. Without the UPDATE, the ADD CONSTRAINT raises 23514 and
 * the whole deploy aborts; that is asserted directly, so the ordering of those
 * two statements cannot be swapped or "simplified" without going red.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { VENUE_SETTINGS, CEREMONY_VENUE_SETTINGS } from '../../lib/venue-settings';

let replay: ReplayResult;

/** The literals inside a `= ANY (ARRAY[...])` CHECK definition. */
function literalsOf(constraintDef: string): string[] {
  return [...constraintDef.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]!);
}

async function constraintDef(name: string): Promise<string> {
  const res = await replay.db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND c.conname = $1`,
    [name],
  );
  assert.equal(res.rows.length, 1, `expected exactly one ${name} constraint`);
  return res.rows[0]!.def;
}

/** A wedding row. `events_wedding_fields_consistency` demands both wedding
 *  columns be non-null on a wedding, which is exactly why `venue_setting` has
 *  nowhere to put "unknown". */
async function insertWedding(name: string, venueSetting: string): Promise<string> {
  const r = await replay.db.query<{ event_id: string }>(
    `INSERT INTO public.events
       (display_name, event_type, event_date, estimated_pax, ceremony_type, venue_setting)
     VALUES ($1, 'wedding', (now() + interval '200 days')::date, 120, 'civil', $2)
     RETURNING event_id`,
    [name, venueSetting],
  );
  return r.rows[0]!.event_id;
}

before(async () => {
  replay = await createReplayedDb();
});

after(async () => {
  await replay.db.close();
});

// ── the migration applied at all ────────────────────────────────────────────

test('⭐ ceremony_venue_setting exists, and "not set" is a state it can hold', async () => {
  const res = await replay.db.query<{
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>(
    `SELECT data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'events'
        AND column_name = 'ceremony_venue_setting'`,
  );
  assert.equal(res.rows.length, 1, 'the column did not land — the migration did not apply');
  assert.equal(res.rows[0]!.data_type, 'text');
  // NULLABLE WITH NO DEFAULT IS THE POINT. `venue_setting` cannot say "the
  // couple has not answered" — both writers stamp banquet_hall — and this
  // column exists partly so the ceremony side never inherits that defect.
  assert.equal(
    res.rows[0]!.is_nullable,
    'YES',
    'ceremony_venue_setting became NOT NULL, so a couple who has not decided ' +
      'must now claim a venue they never chose.',
  );
  assert.equal(
    res.rows[0]!.column_default,
    null,
    'a DEFAULT appeared, which makes "never said" and that value the same bytes ' +
      '— the exact thing wrong with venue_setting.',
  );
});

test('the ceremony CHECK is the TypeScript list, exactly', async () => {
  const allowed = literalsOf(await constraintDef('events_ceremony_venue_setting_check'));
  assert.ok(allowed.length > 0, 'parsed no literals out of the CHECK definition');
  assert.deepEqual([...allowed].sort(), [...CEREMONY_VENUE_SETTINGS].sort());
});

test('the reception CHECK is the TypeScript list, exactly — and has lost civil_registrar', async () => {
  const allowed = literalsOf(await constraintDef('events_venue_setting_check'));
  assert.deepEqual([...allowed].sort(), [...VENUE_SETTINGS].sort());
  assert.ok(
    !allowed.includes('civil_registrar'),
    'civil_registrar is still storable as a RECEPTION venue — a paid "Make it ' +
      "real\" render would put a banquet inside a registrar's office.",
  );
  // The narrowing dropped NOTHING ELSE. A setting quietly lost here rejects
  // saves for hosts who chose it months ago.
  for (const keep of ['banquet_hall', 'restaurant', 'garden', 'beach', 'destination', 'heritage', 'outdoor_tent']) {
    assert.ok(allowed.includes(keep), `the narrowing dropped '${keep}'`);
  }
});

// ── the constraints actually bite ───────────────────────────────────────────

test('every ceremony venue is accepted, and an invented one is refused', async () => {
  for (const setting of CEREMONY_VENUE_SETTINGS) {
    const id = await insertWedding(`Ceremony ${setting}`, 'banquet_hall');
    await replay.db.query(`UPDATE public.events SET ceremony_venue_setting = $1 WHERE event_id = $2`, [
      setting,
      id,
    ]);
    const back = await replay.db.query<{ v: string }>(
      `SELECT ceremony_venue_setting AS v FROM public.events WHERE event_id = $1`,
      [id],
    );
    assert.equal(back.rows[0]!.v, setting);
  }

  const id = await insertWedding('Ceremony invented', 'banquet_hall');
  for (const invented of ['cathedral', 'catholic_church', 'inc_chapel', 'banquet_hall', 'CHURCH']) {
    await assert.rejects(
      () =>
        replay.db.query(
          `UPDATE public.events SET ceremony_venue_setting = $1 WHERE event_id = $2`,
          [invented, id],
        ),
      /events_ceremony_venue_setting_check|violates check constraint/i,
      `'${invented}' was accepted as a ceremony venue. ` +
        `(catholic_church / inc_chapel are the DIRECTORY's words and encode a ` +
        `faith that events.ceremony_type already carries; banquet_hall is a ` +
        `RECEPTION setting — the two vocabularies must not blur.)`,
    );
  }
});

test('civil_registrar is refused as a RECEPTION venue and accepted as a ceremony one', async () => {
  const id = await insertWedding('Registrar reception', 'banquet_hall');
  await assert.rejects(
    () =>
      replay.db.query(`UPDATE public.events SET venue_setting = 'civil_registrar' WHERE event_id = $1`, [
        id,
      ]),
    /events_venue_setting_check|violates check constraint/i,
    'the reception column still accepts civil_registrar',
  );
  await replay.db.query(
    `UPDATE public.events SET ceremony_venue_setting = 'civil_registrar' WHERE event_id = $1`,
    [id],
  );
});

// ── the read path the couple's page actually uses ───────────────────────────

test('events_host projects ceremony_venue_setting, so Personalization does not 500', async () => {
  // events_host has an EXPLICIT column projection computed from the SELECT
  // allow-list at apply time. A column added without rebuilding the view is a
  // PHANTOM column on it, and /dashboard/[eventId]/details THROWS on a query
  // error — killing the page for every host on every event type.
  const res = await replay.db.query<{ n: string }>(
    `SELECT count(*) AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'events_host'
        AND column_name = 'ceremony_venue_setting'`,
  );
  assert.equal(
    Number(res.rows[0]!.n),
    1,
    'events_host does not project ceremony_venue_setting — the details page ' +
      'selects it and would throw on every load.',
  );
});

// ── the dangerous part ──────────────────────────────────────────────────────

test('⭐ the tightening is safe over a row that violates it — and would NOT be without the UPDATE', async () => {
  // Reconstruct the pre-migration world: the wide constraint, and a real
  // wedding whose RECEPTION is stored as a registrar's office. Production had
  // none of these on 2026-09-03, so nothing else in this file can exercise the
  // case the migration was actually written for.
  await replay.db.query(`ALTER TABLE public.events DROP CONSTRAINT events_venue_setting_check`);
  await replay.db.query(
    `ALTER TABLE public.events
       ADD CONSTRAINT events_venue_setting_check
       CHECK (venue_setting IS NULL OR venue_setting = ANY (ARRAY[
         'banquet_hall'::text,'restaurant'::text,'garden'::text,'beach'::text,
         'destination'::text,'heritage'::text,'outdoor_tent'::text,
         'civil_registrar'::text]))`,
  );
  const id = await insertWedding('Pre-migration registrar wedding', 'civil_registrar');

  const narrow = `ALTER TABLE public.events
       ADD CONSTRAINT events_venue_setting_check
       CHECK (venue_setting IS NULL OR venue_setting = ANY (ARRAY[
         'banquet_hall'::text,'restaurant'::text,'garden'::text,'beach'::text,
         'destination'::text,'heritage'::text,'outdoor_tent'::text]))`;

  // 1. WITHOUT the UPDATE first, the narrowing raises 23514 and aborts the
  //    deploy. This is the failure the migration's ordering exists to avoid;
  //    asserting it means the two statements cannot be reordered silently.
  await replay.db.query(`ALTER TABLE public.events DROP CONSTRAINT events_venue_setting_check`);
  await assert.rejects(
    () => replay.db.query(narrow),
    /check constraint|23514/i,
    'The narrowing was accepted over a violating row. Either this replay is not ' +
      'enforcing CHECKs — in which case every assertion in this file is worthless ' +
      '— or the row was not created.',
  );

  // 2. The migration's own UPDATE, verbatim, then the narrowing.
  await replay.db.query(
    `UPDATE public.events
        SET ceremony_venue_setting = COALESCE(ceremony_venue_setting, 'civil_registrar'),
            venue_setting          = 'banquet_hall'
      WHERE venue_setting = 'civil_registrar'`,
  );
  await replay.db.query(narrow);

  const row = await replay.db.query<{ reception: string; ceremony: string | null }>(
    `SELECT venue_setting AS reception, ceremony_venue_setting AS ceremony
       FROM public.events WHERE event_id = $1`,
    [id],
  );
  // The registrar moved ACROSS, not away: the couple told us that fact and it
  // is still true — it was simply filed under the wrong venue.
  assert.equal(row.rows[0]!.ceremony, 'civil_registrar');
  // And the reception falls back to the value this codebase already writes to
  // mean "the couple has not told us", which `receptionVenuePhrase` refuses to
  // assert — so a migrated row can never cause a paid render to depict a
  // ballroom nobody chose.
  assert.equal(row.rows[0]!.reception, 'banquet_hall');
});

test('the UPDATE never overwrites a ceremony venue the couple already chose', async () => {
  // COALESCE, not assignment. A couple who answered the new question AND still
  // had the old mis-filed reception must keep their own answer.
  const id = await insertWedding('Already answered', 'banquet_hall');
  await replay.db.query(
    `UPDATE public.events SET ceremony_venue_setting = 'church' WHERE event_id = $1`,
    [id],
  );
  // Put the row back into the violating state the migration migrates.
  await replay.db.query(`ALTER TABLE public.events DROP CONSTRAINT events_venue_setting_check`);
  await replay.db.query(`UPDATE public.events SET venue_setting = 'civil_registrar' WHERE event_id = $1`, [
    id,
  ]);
  await replay.db.query(
    `UPDATE public.events
        SET ceremony_venue_setting = COALESCE(ceremony_venue_setting, 'civil_registrar'),
            venue_setting          = 'banquet_hall'
      WHERE venue_setting = 'civil_registrar'`,
  );
  const row = await replay.db.query<{ ceremony: string }>(
    `SELECT ceremony_venue_setting AS ceremony FROM public.events WHERE event_id = $1`,
    [id],
  );
  assert.equal(
    row.rows[0]!.ceremony,
    'church',
    "the migration overwrote the couple's own answer with a derived one",
  );
});
