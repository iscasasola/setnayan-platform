/**
 * A TAKEDOWN REACHES EVERY COPY THAT CAN HOLD ONE — THE SET IS COMPLETE.
 *
 * ── WHY THIS GUARD IS SHAPED LIKE THIS ─────────────────────────────────────
 * 🔴 THE OBVIOUS GUARD WOULD HAVE PASSED THROUGH THE DEFECT IT IS BEING
 * WRITTEN FOR. `lib/hide-a-reported-photo.ts` was created in September to fix
 * exactly this class — a moderator's "Hide" that matched no row, stamped the
 * report *"Content hidden by Setnayan moderator."*, and left the photograph up
 * on five surfaces with no error anywhere. Its own docblock records that. And
 * it shipped with a list of TWO capture tables while FOUR existed: the two
 * supplier-owned ones (`vendor_papic_captures`, `vendor_papic_portfolio_photos`)
 * were never in it. A test asserting "these two tables hide correctly" would
 * have been green the entire time.
 *
 * 🔑 SO THE PROPERTY IS NOT "THE KNOWN MEMBERS WORK". IT IS "THE SET IS
 * COMPLETE." The population is asked of the REPLAYED SCHEMA, never re-typed
 * here, so a FIFTH capture table added next month turns this red by existing —
 * with nobody remembering this file.
 *
 * ── HOW THE SCHEMA IS ASKED, AND WHAT IT CANNOT ANSWER ─────────────────────
 * The schema has no column that says "this is a Papic capture". What it CAN
 * say, precisely, is which tables hold a STORED FILE, CAPTURED AT A
 * CELEBRATION, WITH A TAKEDOWN SWITCH — that is the conjunction of three
 * columns: `event_id` + `r2_object_key` + `hidden_at`. Today that is exactly
 * the four capture tables and nothing else, which is why it is the definition
 * used rather than a name pattern like `%papic%` (a name is a convention, and
 * the next table to hold a guest's face may not carry the word).
 *
 * ⚠ STATED HONESTLY, TWICE OVER, BECAUSE A GUARD THAT OVERSTATES ITS REACH IS
 * WORSE THAN NONE:
 *
 *   1. **This cannot see whether a `user_reports.target_id` can ever NAME a
 *      given row.** That is decided by the reporting UI, in TypeScript, and no
 *      query can answer it. The guard therefore demands that every table which
 *      COULD hold a takedown-able file is reachable by the helper, which is the
 *      safe direction to be wrong in: an extra lookup costs one indexed read
 *      and can never hide the wrong row (every id below is UUID and UNIQUE, and
 *      every read is additionally bound to the report's own event).
 *   2. **A table that holds an event file and has NO `hidden_at` is invisible
 *      here** — by construction, since the helper has nothing to write. As of
 *      2026-09-14 that set is `drive_copy_artifacts`, `media_hash_checks`,
 *      `patiktok_source_clips` and `photo_delivery_artifacts`: derived copies
 *      and bookkeeping, none of which has ANY takedown mechanism at all.
 *      Whether a takedown should reach a file already delivered to somebody's
 *      Drive is a real question and an owner's, not one this guard settles by
 *      silently widening. It is written down here so the next reader inherits
 *      the boundary instead of the illusion.
 *
 * Run: `pnpm --filter @setnayan/web test:db` (or the single file with tsx).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import {
  REPORTED_PHOTO_TABLES,
  SUPPLIER_OWNED_PHOTO_TABLES,
} from '../../lib/hide-a-reported-photo';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

/** The three columns that together mean "a captured file, at an event, that can be taken down". */
const TAKEDOWNABLE = ['event_id', 'r2_object_key', 'hidden_at'] as const;

async function tablesTheSchemaCallsTakedownable(): Promise<string[]> {
  const has = (col: string) =>
    `SELECT table_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = '${col}'`;
  const r = await db.query<{ table_name: string }>(`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       AND ${TAKEDOWNABLE.map((c) => `table_name IN (${has(c)})`).join('\n       AND ')}
     ORDER BY table_name
  `);
  return r.rows.map((x) => x.table_name);
}

test('every table that CAN hold a takedown is one the moderator’s Hide reaches', async () => {
  const fromSchema = await tablesTheSchemaCallsTakedownable();
  const inTheCode = REPORTED_PHOTO_TABLES.map((t) => t.table);

  /*
    ⚠ A ZERO POPULATION IS A BROKEN GUARD, NOT A CLEAN SCHEMA. If the query
    stops finding capture tables — a renamed column, a replay that did not
    apply — every assertion below passes vacuously and this dies silently.
  */
  assert.ok(
    fromSchema.length >= 4,
    `the schema query found only ${fromSchema.length} takedown-able tables ` +
      `(${fromSchema.join(', ') || 'none'}) — it has stopped seeing them, so ` +
      `everything below is vacuous.`,
  );

  const missing = fromSchema.filter((t) => !inTheCode.includes(t as never));
  assert.deepEqual(
    missing,
    [],
    `\nTHESE TABLES HOLD A PHOTOGRAPH TAKEN AT A CELEBRATION, CARRY A ` +
      `\`hidden_at\` TAKEDOWN SWITCH, AND THE MODERATOR'S "Hide" CANNOT REACH ` +
      `THEM:\n` +
      missing.map((t) => `  · public.${t}`).join('\n') +
      `\n\nAdd each one to REPORTED_PHOTO_TABLES in lib/hide-a-reported-photo.ts ` +
      `(with its own id column). Owner ruling 2026-09-14: a guest's takedown ` +
      `reaches the supplier's copy — "no. we will honour the guest."\n` +
      `Hiding nothing is INDISTINGUISHABLE from hiding successfully: the report ` +
      `is stamped "Content hidden by Setnayan moderator." either way.\n`,
  );

  const invented = inTheCode.filter((t) => !fromSchema.includes(t));
  assert.deepEqual(
    invented,
    [],
    `REPORTED_PHOTO_TABLES names ${invented.join(', ')}, which the schema does ` +
      `not hold as a takedown-able capture table. A table that does not exist ` +
      `(or lost one of ${TAKEDOWNABLE.join('/')}) makes every Hide throw or ` +
      `silently skip it.`,
  );
});

test('each id column named in the code exists, is a UUID, and is UNIQUE', async () => {
  /*
    🔴 A TYPO'D ID COLUMN IS THE SAME DEFECT WEARING THE TABLE'S NAME. The four
    tables do NOT agree on it — `papic_photos.photo_id` and
    `papic_guest_captures.capture_id` are unique columns beside a bigserial `id`
    primary key, while the two vendor tables use theirs AS the primary key — so
    "it is the PK" would be a wrong rule. UNIQUE is the property that matters:
    without it `.eq(id, photoId)` could match more than one row and the hide
    would land on somebody else's photograph.
  */
  const offenders: string[] = [];
  for (const { table, id } of REPORTED_PHOTO_TABLES) {
    const col = await db.query<{ data_type: string; is_nullable: string; is_generated: string }>(
      `SELECT data_type, is_nullable, is_generated
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
      [table, id],
    );
    if (col.rows.length === 0) {
      offenders.push(`public.${table} has no column "${id}" — every Hide against it throws.`);
      continue;
    }
    if (col.rows[0]!.data_type !== 'uuid') {
      offenders.push(`public.${table}.${id} is ${col.rows[0]!.data_type}, not uuid.`);
    }
    const uniq = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM pg_index i
         JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass
          AND i.indisunique
          AND array_length(i.indkey, 1) = 1
          AND a.attname = $2`,
      [`public.${table}`, id],
    );
    if ((uniq.rows[0]?.n ?? 0) === 0) {
      offenders.push(
        `public.${table}.${id} carries no single-column UNIQUE index — a Hide ` +
          `could match more than one row.`,
      );
    }

    // The switch itself has to be writable, or the helper is decoration.
    const hid = await db.query<{ is_nullable: string; is_generated: string }>(
      `SELECT is_nullable, is_generated
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND column_name='hidden_at'`,
      [table],
    );
    if (hid.rows[0]?.is_nullable !== 'YES') {
      offenders.push(`public.${table}.hidden_at is NOT NULL — a fresh capture cannot be un-hidden.`);
    }
    if (hid.rows[0]?.is_generated !== 'NEVER') {
      offenders.push(`public.${table}.hidden_at is generated — the takedown cannot write it.`);
    }
  }
  assert.deepEqual(offenders, [], `\n${offenders.join('\n')}\n`);
});

test('the supplier-owned tables are exactly the ones that can name a supplier', async () => {
  /*
    The other half of "tell the supplier": `tellTheSupplierItCameDown` reads
    `vendor_profile_id` off the hidden row. If a table is marked supplier-owned
    and has no such column the notice silently reaches nobody; if a table HAS
    one and is not marked, a supplier loses a photograph and is never told.
    Both directions are asked of the schema, not of a list.
  */
  const r = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.columns
      WHERE table_schema='public' AND column_name='vendor_profile_id'
        AND table_name = ANY($1::text[])
      ORDER BY table_name`,
    [REPORTED_PHOTO_TABLES.map((t) => t.table)],
  );
  const ownedBySchema = r.rows.map((x) => x.table_name).sort();
  const ownedByCode = [...SUPPLIER_OWNED_PHOTO_TABLES].sort();
  assert.deepEqual(
    ownedBySchema,
    ownedByCode,
    `the capture tables carrying vendor_profile_id are [${ownedBySchema.join(', ')}] ` +
      `but SUPPLIER_OWNED_PHOTO_TABLES says [${ownedByCode.join(', ')}]. A ` +
      `supplier either loses a photograph and is never told, or is told about ` +
      `one that was never theirs.`,
  );
});
