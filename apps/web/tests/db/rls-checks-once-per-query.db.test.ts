/**
 * THE PROOF that 20271281556823_rls_checks_once_per_query.sql made the policies
 * FASTER and changed NOTHING about who they admit.
 *
 * One database, two states. Replay every migration BEFORE that file, seed a
 * world, run the identity matrix — then apply that one file to the SAME
 * database and run the SAME matrix again. Every cell must match byte for byte.
 *
 *   identities  couple host · co-host (full seat) · limited helper (viewer seat)
 *               · guest-list delegate (view) · guest-list delegate (edit) ·
 *               legacy edit_all delegate · coordinator member · guest holding a
 *               pass (a member with a guest row) · linked supplier (a shop on
 *               this event) · unlinked supplier · stranger · admin · anon
 *   operations  SELECT (the visible rows, hashed over every column that role
 *               may read) · UPDATE / DELETE (row count or error, per row) ·
 *               INSERT (a copy of each seeded row with a fresh key: ok, or the
 *               error) — writes always rolled back
 *   tables      every table whose policy the migration rewrote, plus the hot
 *               tables named in the brief (guests, events, event_members,
 *               users, guest_groups, event_seat_assignments, orders,
 *               event_vendors)
 *
 * The world is seeded by hand for the hot tables and by a schema-driven filler
 * for the rest (one row per event per "who wrote it", FKs pointed at the
 * seeded world); META tests put floors under that coverage so an empty table
 * cannot pass as an unchanged one.
 *
 * Also proved here, without data:
 *   • the policy SET is unchanged — names, commands, roles, PERMISSIVE/RESTRICTIVE;
 *   • every rewritten predicate is exactly `askOnce(before)` as Postgres itself
 *     prints it (a probe policy re-parses the expected text), and nothing the
 *     rewrite would change was left behind;
 *   • every moderator_area_level call it replaced sat under AND/OR only;
 *   • the matrix is not decorative: a policy broadened inside a rolled-back
 *     transaction turns it red (SABOTAGE).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createReplayedDb, MIGRATIONS_DIR, versionOf, type ReplayResult } from './replay-migrations';
import { askOnce, moderatorCallsAreMonotone } from './policy-asks-once';

const MIGRATION = '20271281556823_rls_checks_once_per_query.sql';
const HOT = [
  'guests',
  'events',
  'event_members',
  'users',
  'guest_groups',
  'event_seat_assignments',
  'orders',
  'event_vendors',
];
/** Rows per table the write probes touch (SELECT always reads every row). */
const WRITE_ROWS = 4;

type Pol = {
  tablename: string;
  policyname: string;
  permissive: string;
  roles: string;
  cmd: string;
  qual: string | null;
  with_check: string | null;
};
type Identity = { name: string; uid: string | null; role: 'anon' | 'authenticated' };
type Matrix = Record<string, string>;

let replay: ReplayResult;
let db: ReplayResult['db'];
let beforePols: Pol[] = [];
let afterPols: Pol[] = [];
let touched: string[] = [];
let tables: string[] = [];
let ids: Identity[] = [];
let mBefore: Matrix = {};
let mAfter: Matrix = {};
let planBefore = '';
let planAfter = '';
const W: Record<string, string> = {};

const norm = (s: string | null) => (s === null ? null : s.replace(/\s+/g, ' ').trim());

async function policies(): Promise<Pol[]> {
  return (
    await db.query<Pol>(
      `SELECT tablename, policyname, permissive, roles::text AS roles, cmd, qual, with_check
         FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname`,
    )
  ).rows;
}

async function asOwner(): Promise<void> {
  await db.exec('RESET ROLE');
  await claims(null, 'anon');
}

async function claims(uid: string | null, role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
  await db.query(`SELECT set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify(uid ? { sub: uid, role, is_anonymous: false } : { role }),
  ]);
}

async function newUser(email: string, accountType = 'customer'): Promise<string> {
  const id = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
      [email, accountType],
    )
  ).rows[0]!.id;
  await db.query(
    `INSERT INTO public.users (user_id, email, account_type) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET account_type = EXCLUDED.account_type`,
    [id, email, accountType],
  );
  return id;
}

/* ── the world ──────────────────────────────────────────────────────────── */

async function seedWorld(): Promise<void> {
  await asOwner();
  W.couple = await newUser('couple@once.test');
  W.cohost = await newUser('cohost@once.test');
  W.helper = await newUser('helper@once.test');
  W.glView = await newUser('glview@once.test');
  W.glEdit = await newUser('gledit@once.test');
  W.legacy = await newUser('legacy@once.test');
  W.coordinator = await newUser('coordinator@once.test');
  W.guest = await newUser('guest@once.test');
  W.supplier = await newUser('supplier@once.test');
  W.otherSupplier = await newUser('othersupplier@once.test');
  W.stranger = await newUser('stranger@once.test');
  W.otherCouple = await newUser('othercouple@once.test');
  W.admin = await newUser('admin@once.test', 'admin');

  const mkEvent = async (name: string): Promise<string> =>
    (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events
           (display_name, event_type, event_date, event_date_precision, region, ceremony_type, venue_setting)
         VALUES ($1, 'wedding', '2027-06-12'::date, 'day', 'NCR', 'civil', 'garden') RETURNING event_id`,
        [name],
      )
    ).rows[0]!.event_id;
  W.e1 = await mkEvent('Once Wedding');
  W.e2 = await mkEvent('Other Wedding');

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES
       ($1, $2, 'couple'), ($1, $3, 'coordinator'), ($4, $5, 'couple')`,
    [W.e1, W.couple, W.coordinator, W.e2, W.otherCouple],
  );

  // Guests: three live, one removed, one on the other event.
  const guest = async (e: string, first: string, deleted = false): Promise<string> =>
    (
      await db.query<{ guest_id: string }>(
        `INSERT INTO public.guests (event_id, first_name, last_name, display_name, side, group_category, deleted_at)
         VALUES ($1, $2, 'Reyes', $2 || ' Reyes', 'bride', 'family', $3) RETURNING guest_id`,
        [e, first, deleted ? new Date().toISOString() : null],
      )
    ).rows[0]!.guest_id;
  W.gAna = await guest(W.e1, 'Ana');
  W.gBen = await guest(W.e1, 'Ben');
  W.gCely = await guest(W.e1, 'Cely');
  W.gGone = await guest(W.e1, 'Gone', true);
  W.gOther = await guest(W.e2, 'Dina');

  // The guest holding a pass: an account linked to a guest row.
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, guest_id)
     VALUES ($1, $2, 'guest', $3)`,
    [W.e1, W.guest, W.gAna],
  );

  // Helper seats. The membership trigger mints the matching event_members row.
  const seat = async (uid: string, subtype: string, perms: object): Promise<void> => {
    await db.query(
      `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at)
       VALUES ($1, $2, $3, $4::jsonb, now())`,
      [W.e1, uid, subtype, JSON.stringify(perms)],
    );
  };
  const base = { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false };
  await seat(W.cohost, 'co_host', { ...base, edit_all: true, checkout: true });
  await seat(W.helper, 'viewer', { ...base, areas: { guest_list: 'view', schedule: 'view' } });
  await seat(W.glView, 'wedding_planner_external', {
    ...base,
    areas: { guest_list: 'view', seat_plan: 'view', budget: 'view', photos: 'view' },
  });
  await seat(W.glEdit, 'wedding_planner_external', {
    ...base,
    areas: { guest_list: 'edit', seat_plan: 'edit', schedule: 'edit', vendors: 'edit', budget: 'edit' },
  });
  await seat(W.legacy, 'wedding_planner_external', { ...base, edit_all: true, checkout: true });

  // Suppliers: one booked on e1, one with a shop and no link.
  const shop = async (uid: string, name: string): Promise<string> => {
    const vp = (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles
           (user_id, business_name, location_city, services, verification_state, last_verified_at)
         VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', now())
         RETURNING vendor_profile_id`,
        [uid, name],
      )
    ).rows[0]!.vendor_profile_id;
    await db.query(
      `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
       VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING`,
      [vp, uid],
    );
    return vp;
  };
  W.shop = await shop(W.supplier, 'Once Photo');
  W.otherShop = await shop(W.otherSupplier, 'Elsewhere Photo');
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'Once Photo', 'contracted', $2),
            ($1, 'florist', 'Manual Florist', 'contracted', NULL),
            ($3, 'photographer', 'Elsewhere Photo', 'contracted', $4)`,
    [W.e1, W.shop, W.e2, W.otherShop],
  );

  // Seating.
  const t1 = (
    await db.query<{ table_id: string }>(
      `INSERT INTO public.event_tables (event_id, table_label, table_type, capacity)
       VALUES ($1, 'Table 1', 'round_8', 8) RETURNING table_id`,
      [W.e1],
    )
  ).rows[0]!.table_id;
  const t2 = (
    await db.query<{ table_id: string }>(
      `INSERT INTO public.event_tables (event_id, table_label, table_type, capacity)
       VALUES ($1, 'Table 9', 'round_8', 8) RETURNING table_id`,
      [W.e2],
    )
  ).rows[0]!.table_id;
  await db.query(
    `INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id)
     VALUES ($1, $2, $3), ($1, $2, $4), ($5, $6, $7)`,
    [W.e1, t1, W.gAna, W.gBen, W.e2, t2, W.gOther],
  );

  // Orders: the couple's, the guest's, a stranger's, and one on the other event.
  for (const [uid, ev, status, ref] of [
    [W.couple, W.e1, 'submitted', 'ONCE00001'],
    [W.guest, W.e1, 'draft', 'ONCE00002'],
    [W.stranger, null, 'awaiting_payment', 'ONCE00003'],
    [W.otherCouple, W.e2, 'submitted', 'ONCE00004'],
  ] as const) {
    await db.query(
      `INSERT INTO public.orders (user_id, event_id, description, requested_total_php, reference_code, status)
       VALUES ($1, $2, 'Once pack', 1499, $3, $4::order_status)`,
      [uid, ev, ref, status],
    );
  }

  ids = [
    { name: 'couple host', uid: W.couple, role: 'authenticated' },
    { name: 'co-host', uid: W.cohost, role: 'authenticated' },
    { name: 'limited helper', uid: W.helper, role: 'authenticated' },
    { name: 'delegate guest_list view', uid: W.glView, role: 'authenticated' },
    { name: 'delegate guest_list edit', uid: W.glEdit, role: 'authenticated' },
    { name: 'legacy edit_all delegate', uid: W.legacy, role: 'authenticated' },
    { name: 'coordinator member', uid: W.coordinator, role: 'authenticated' },
    { name: 'guest with a pass', uid: W.guest, role: 'authenticated' },
    { name: 'linked supplier', uid: W.supplier, role: 'authenticated' },
    { name: 'unlinked supplier', uid: W.otherSupplier, role: 'authenticated' },
    { name: 'stranger', uid: W.stranger, role: 'authenticated' },
    { name: 'other event couple', uid: W.otherCouple, role: 'authenticated' },
    { name: 'admin', uid: W.admin, role: 'authenticated' },
    { name: 'anon', uid: null, role: 'anon' },
  ];
}

/**
 * Fill every listed table that is still empty with up to four rows — one per
 * event × "who wrote it" (the couple / the guest) — from the schema alone.
 * Each attempt runs in its own savepoint; a table whose triggers or CHECKs
 * refuse every attempt simply stays empty (and is counted by the META floor).
 */
async function fillTables(list: string[]): Promise<{ filled: string[]; empty: string[] }> {
  await asOwner();
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS rls_once;
    CREATE OR REPLACE FUNCTION rls_once.fill(p_tbl regclass, p_event uuid, p_user uuid)
    RETURNS text LANGUAGE plpgsql AS $f$
    DECLARE
      c record; cols text[] := '{}'; vals text[] := '{}'; v text; lit text;
    BEGIN
      FOR c IN
        SELECT a.attname, a.atttypid, a.attnotnull, format_type(a.atttypid, a.atttypmod) AS typ,
               pg_get_expr(d.adbin, d.adrelid) AS def, a.attgenerated, a.attidentity,
               (SELECT confrelid::regclass::text || '.' || (SELECT attname FROM pg_attribute
                         WHERE attrelid = k.confrelid AND attnum = k.confkey[1])
                  FROM pg_constraint k
                 WHERE k.conrelid = p_tbl AND k.contype = 'f' AND k.conkey = ARRAY[a.attnum] LIMIT 1) AS fk
          FROM pg_attribute a
          LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
         WHERE a.attrelid = p_tbl AND a.attnum > 0 AND NOT a.attisdropped
         ORDER BY a.attnum
      LOOP
        IF c.attgenerated <> '' OR c.attidentity <> '' THEN CONTINUE; END IF;
        v := NULL;
        IF c.attname = 'event_id' THEN v := quote_literal(p_event);
        ELSIF c.fk IS NOT NULL AND (c.fk LIKE '%users.user_id' OR c.fk LIKE 'auth.users.id') THEN
          v := quote_literal(p_user);
        ELSIF c.fk IS NOT NULL THEN
          -- point at a row of the referenced table, on this event when it has one
          BEGIN
            EXECUTE format(
              'SELECT %I::text FROM %s t %s LIMIT 1',
              split_part(c.fk, '.', array_length(string_to_array(c.fk, '.'), 1)),
              substr(c.fk, 1, length(c.fk) - length(split_part(c.fk, '.', array_length(string_to_array(c.fk, '.'), 1))) - 1),
              CASE WHEN EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid =
                     substr(c.fk, 1, length(c.fk) - length(split_part(c.fk, '.', array_length(string_to_array(c.fk, '.'), 1))) - 1)::regclass
                     AND attname = 'event_id' AND NOT attisdropped)
                   THEN format('ORDER BY (t.event_id = %L) DESC', p_event) ELSE '' END)
              INTO lit;
          EXCEPTION WHEN others THEN lit := NULL; END;
          IF lit IS NOT NULL THEN v := quote_literal(lit) || '::' || c.typ;
          ELSIF c.attnotnull AND c.def IS NULL THEN RETURN 'no parent row for ' || c.attname; END IF;
        ELSIF c.attnotnull AND c.def IS NULL THEN
          -- a CHECK's first literal for this column, else a value of its type
          SELECT (regexp_match(pg_get_constraintdef(k.oid), '''([^'']*)''::'))[1] INTO lit
            FROM pg_constraint k
           WHERE k.conrelid = p_tbl AND k.contype = 'c' AND k.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = p_tbl AND attname = c.attname)]
           LIMIT 1;
          IF lit IS NOT NULL THEN v := quote_literal(lit) || '::' || c.typ;
          ELSIF EXISTS (SELECT 1 FROM pg_type WHERE oid = c.atttypid AND typtype = 'e') THEN
            v := quote_literal((SELECT enumlabel FROM pg_enum WHERE enumtypid = c.atttypid ORDER BY enumsortorder LIMIT 1)) || '::' || c.typ;
          ELSE
            v := CASE
              WHEN c.typ IN ('text', 'character varying') OR c.typ LIKE 'character varying%' OR c.typ LIKE 'citext%' THEN quote_literal('once')
              WHEN c.typ IN ('integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision') OR c.typ LIKE 'numeric%' THEN '1'
              WHEN c.typ = 'boolean' THEN 'false'
              WHEN c.typ = 'date' THEN quote_literal('2027-06-12') || '::date'
              WHEN c.typ LIKE 'timestamp%' THEN 'now()'
              WHEN c.typ LIKE 'time%' THEN quote_literal('10:00') || '::' || c.typ
              WHEN c.typ IN ('jsonb', 'json') THEN quote_literal('{}') || '::' || c.typ
              WHEN c.typ = 'uuid' THEN 'gen_random_uuid()'
              WHEN c.typ LIKE '%[]' THEN quote_literal('{}') || '::' || c.typ
              WHEN c.typ = 'interval' THEN quote_literal('1 hour') || '::interval'
              ELSE NULL END;
            IF v IS NULL THEN RETURN 'no value for ' || c.attname || ' ' || c.typ; END IF;
          END IF;
        END IF;
        IF v IS NOT NULL THEN cols := cols || quote_ident(c.attname); vals := vals || v; END IF;
      END LOOP;
      BEGIN
        EXECUTE format('INSERT INTO %s (%s) VALUES (%s)', p_tbl, array_to_string(cols, ','), array_to_string(vals, ','));
      EXCEPTION WHEN others THEN RETURN SQLERRM;
      END;
      RETURN 'ok';
    END $f$;
  `);
  const filled: string[] = [];
  const pending = new Set(list);
  for (let pass = 0; pass < 3 && pending.size; pass++) {
    for (const t of [...pending]) {
      const n = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.${t}`)).rows[0]!.n;
      if (n > 0) {
        pending.delete(t);
        filled.push(t);
        continue;
      }
      for (const [e, u] of [
        [W.e1, W.couple],
        [W.e1, W.guest],
        [W.e2, W.otherCouple],
        [W.e1, W.supplier],
      ]) {
        await claims(u!, 'authenticated'); // triggers that ask "who is writing"
        await db.query(`SELECT rls_once.fill($1::regclass, $2, $3)`, [`public.${t}`, e, u]);
      }
      await claims(null, 'anon');
    }
  }
  const empty: string[] = [];
  for (const t of pending) {
    const n = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.${t}`)).rows[0]!.n;
    (n > 0 ? filled : empty).push(t);
  }
  return { filled, empty };
}

/* ── the matrix ─────────────────────────────────────────────────────────── */

async function installProbe(): Promise<void> {
  await asOwner();
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS rls_once;
    -- One identity × one table. Every operation runs in its own subtransaction
    -- that is ALWAYS rolled back (a sentinel exception), so a write never lands
    -- and the SET LOCAL ROLE never outlives the probe.
    CREATE OR REPLACE FUNCTION rls_once.probe(p_tbl regclass, p_role text, p_max int)
    RETURNS jsonb LANGUAGE plpgsql AS $f$
    DECLARE
      out jsonb := '{}'; sel text[]; upd text; ins text[]; t tid; r jsonb; n bigint; v text; i int := 0;
      tids tid[]; rows jsonb[];
    BEGIN
      SELECT array_agg(quote_ident(attname) ORDER BY attnum) INTO sel FROM pg_attribute
       WHERE attrelid = p_tbl AND attnum > 0 AND NOT attisdropped
         AND has_column_privilege(p_role, p_tbl, attnum, 'SELECT');
      SELECT quote_ident(attname) INTO upd FROM pg_attribute
       WHERE attrelid = p_tbl AND attnum > 0 AND NOT attisdropped AND attgenerated = '' AND attidentity = ''
       ORDER BY has_column_privilege(p_role, p_tbl, attnum, 'UPDATE') DESC, attnum LIMIT 1;
      -- a copy with a fresh key: drop defaulted primary-key columns, generated and identity columns
      SELECT array_agg(quote_ident(a.attname) ORDER BY a.attnum) INTO ins FROM pg_attribute a
       WHERE a.attrelid = p_tbl AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = '' AND a.attidentity = ''
         AND NOT (a.atthasdef AND EXISTS (SELECT 1 FROM pg_index x WHERE x.indrelid = p_tbl AND x.indisprimary AND a.attnum = ANY (x.indkey)));
      EXECUTE format('SELECT array_agg(ctid ORDER BY ctid), array_agg(to_jsonb(t) ORDER BY ctid) FROM (SELECT ctid, * FROM %s ORDER BY ctid LIMIT %s) t', p_tbl, p_max)
        INTO tids, rows;

      BEGIN
        EXECUTE format('SET LOCAL ROLE %I', p_role);
        IF sel IS NULL THEN
          EXECUTE format('SELECT count(*)::text FROM %s', p_tbl) INTO v;
        ELSE
          EXECUTE format('SELECT count(*) || '':'' || coalesce(md5(string_agg(x, E''\\n'' ORDER BY x)), '''') FROM (SELECT ROW(%s)::text AS x FROM %s) s',
                         array_to_string(sel, ','), p_tbl) INTO v;
        END IF;
        RAISE EXCEPTION '__once_ok__%', v;
      EXCEPTION WHEN others THEN
        out := out || jsonb_build_object('select', CASE WHEN SQLERRM LIKE '__once_ok__%' THEN substr(SQLERRM, 12) ELSE 'ERR ' || SQLSTATE || ' ' || SQLERRM END);
      END;

      FOREACH t IN ARRAY coalesce(tids, '{}') LOOP
        i := i + 1;
        BEGIN
          EXECUTE format('SET LOCAL ROLE %I', p_role);
          EXECUTE format('UPDATE %s SET %s = %s WHERE ctid = $1', p_tbl, upd, upd) USING t;
          GET DIAGNOSTICS n = ROW_COUNT;
          RAISE EXCEPTION '__once_ok__%', n;
        EXCEPTION WHEN others THEN
          out := out || jsonb_build_object('update#' || i, CASE WHEN SQLERRM LIKE '__once_ok__%' THEN substr(SQLERRM, 12) ELSE 'ERR ' || SQLSTATE || ' ' || SQLERRM END);
        END;
        BEGIN
          EXECUTE format('SET LOCAL ROLE %I', p_role);
          EXECUTE format('DELETE FROM %s WHERE ctid = $1', p_tbl) USING t;
          GET DIAGNOSTICS n = ROW_COUNT;
          RAISE EXCEPTION '__once_ok__%', n;
        EXCEPTION WHEN others THEN
          out := out || jsonb_build_object('delete#' || i, CASE WHEN SQLERRM LIKE '__once_ok__%' THEN substr(SQLERRM, 12) ELSE 'ERR ' || SQLSTATE || ' ' || SQLERRM END);
        END;
        BEGIN
          r := rows[i] - 'ctid';
          EXECUTE format('SET LOCAL ROLE %I', p_role);
          EXECUTE format('INSERT INTO %s (%s) SELECT %s FROM jsonb_populate_record(NULL::%s, $1) ON CONFLICT DO NOTHING',
                         p_tbl, array_to_string(ins, ','), array_to_string(ins, ','), p_tbl) USING r;
          GET DIAGNOSTICS n = ROW_COUNT;
          RAISE EXCEPTION '__once_ok__%', n;
        EXCEPTION WHEN others THEN
          out := out || jsonb_build_object('insert#' || i, CASE WHEN SQLERRM LIKE '__once_ok__%' THEN substr(SQLERRM, 12) ELSE 'ERR ' || SQLSTATE || ' ' || SQLERRM END);
        END;
      END LOOP;
      RETURN out;
    END $f$;
  `);
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

async function runMatrix(onlyTables: string[] = tables): Promise<Matrix> {
  const m: Matrix = {};
  for (const id of ids) {
    await db.exec('RESET ROLE');
    await claims(id.uid, id.role);
    for (const t of onlyTables) {
      const r = await db.query<{ out: Record<string, string> }>(
        `SELECT rls_once.probe($1::regclass, $2, $3) AS out`,
        [`public.${t}`, id.role, WRITE_ROWS],
      );
      for (const [op, v] of Object.entries(r.rows[0]!.out)) {
        m[`${t} · ${id.name} · ${op}`] = String(v).replace(UUID, '<uuid>');
      }
    }
  }
  await asOwner();
  return m;
}

function diff(a: Matrix, b: Matrix): string[] {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return keys.filter((k) => a[k] !== b[k]).map((k) => `${k}\n    before: ${a[k]}\n    after:  ${b[k]}`);
}

async function couplePlan(): Promise<string> {
  await db.exec('RESET ROLE');
  await claims(W.couple!, 'authenticated');
  await db.exec('SET ROLE authenticated');
  const r = await db.query<{ 'QUERY PLAN': string }>(
    `EXPLAIN (COSTS OFF) SELECT guest_id, display_name FROM public.guests WHERE event_id = '${W.e1}'`,
  );
  await asOwner();
  return r.rows.map((x) => x['QUERY PLAN']).join('\n');
}

let fillReport: { filled: string[]; empty: string[] } = { filled: [], empty: [] };

before(async () => {
  const mine = versionOf(MIGRATION);
  const only = new Set(
    fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .map(versionOf)
      .filter((v) => v < mine),
  );
  replay = await createReplayedDb({ only });
  db = replay.db;

  beforePols = await policies();
  touched = [
    ...new Set(
      beforePols
        .filter((p) => askOnce(p.qual) !== p.qual || askOnce(p.with_check) !== p.with_check)
        .map((p) => p.tablename),
    ),
  ].sort();
  tables = [...new Set([...HOT, ...touched])].sort();

  await seedWorld();
  fillReport = await fillTables(tables);
  await installProbe();

  planBefore = await couplePlan();
  mBefore = await runMatrix();

  await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, MIGRATION), 'utf8'));

  afterPols = await policies();
  planAfter = await couplePlan();
  mAfter = await runMatrix();
});

after(async () => {
  await db?.close();
});

/* ── META: the matrix is not vacuous ────────────────────────────────────── */

test('META: the replay stopped just before the migration, and the migration has work to do', () => {
  assert.ok(replay.applied > 1500, `replayed ${replay.applied} files`);
  assert.ok(touched.length >= 100, `the rewrite touches ${touched.length} tables`);
  for (const t of HOT) assert.ok(tables.includes(t), `${t} is in the matrix`);
});

test('META: every hot table and most touched tables hold rows to test against', () => {
  for (const t of HOT) assert.ok(fillReport.filled.includes(t), `${t} is seeded`);
  const share = fillReport.filled.length / tables.length;
  // Measured 2026-10-20 — raise it, never lower it.
  assert.ok(
    share >= 0.6,
    `only ${fillReport.filled.length}/${tables.length} tables hold rows; empty: ${fillReport.empty.join(', ')}`,
  );
});

test('META: the identities really see different things', () => {
  const guestsSel = (who: string) => mBefore[`guests · ${who} · select`];
  assert.match(guestsSel('couple host')!, /^4:/, 'the couple reads their four guest rows (removed one included via FOR ALL)');
  assert.match(guestsSel('anon')!, /^(0:|ERR)/, 'anon reads no guests');
  assert.match(guestsSel('stranger')!, /^0:/, 'a stranger reads no guests');
  assert.notEqual(guestsSel('delegate guest_list view'), guestsSel('stranger'), 'a granted delegate reads the list');
  assert.notEqual(guestsSel('guest with a pass'), guestsSel('couple host'), 'a guest reads only their own row');
  const distinct = new Set(Object.values(mBefore));
  assert.ok(distinct.size >= 150, `the matrix has ${distinct.size} distinct outcomes — too few to prove anything`);
  const writesOk = Object.entries(mBefore).filter(([k, v]) => /· (update|delete|insert)#/.test(k) && /^[1-9]/.test(v));
  const writesRefused = Object.entries(mBefore).filter(([k, v]) => /· (update|delete|insert)#/.test(k) && /^(0$|ERR)/.test(v));
  assert.ok(writesOk.length >= 100, `${writesOk.length} writes went through — the write probes must reach real rows`);
  assert.ok(writesRefused.length >= 100, `${writesRefused.length} writes refused`);
});

/* ── THE PROOF ──────────────────────────────────────────────────────────── */

test('every identity sees and changes exactly the same rows before and after', () => {
  assert.equal(Object.keys(mAfter).length, Object.keys(mBefore).length, 'same cells');
  const d = diff(mBefore, mAfter);
  assert.equal(d.length, 0, `${d.length} cells changed:\n${d.slice(0, 40).join('\n')}`);
});

test('the policy set is unchanged — names, commands, roles, PERMISSIVE/RESTRICTIVE', () => {
  const shape = (ps: Pol[]) => ps.map((p) => `${p.tablename}|${p.policyname}|${p.cmd}|${p.roles}|${p.permissive}`);
  assert.deepEqual(shape(afterPols), shape(beforePols));
});

test('every predicate is exactly askOnce(before), as Postgres prints it — nothing else moved, nothing left behind', async () => {
  const byKey = new Map(afterPols.map((p) => [`${p.tablename}|${p.policyname}`, p]));
  const wrong: string[] = [];
  let rewritten = 0;
  for (const b of beforePols) {
    const a = byKey.get(`${b.tablename}|${b.policyname}`)!;
    for (const clause of ['qual', 'with_check'] as const) {
      const want = askOnce(b[clause]);
      if (want === b[clause]) {
        if (a[clause] !== b[clause]) wrong.push(`${b.tablename}.${b.policyname} ${clause} changed but the rewrite has nothing to do there`);
        continue;
      }
      rewritten++;
      assert.deepEqual(moderatorCallsAreMonotone(b[clause]), [], `${b.tablename}.${b.policyname}`);
      // Let Postgres print the expected text the way it prints a policy.
      const cmd = b.cmd === 'ALL' ? 'ALL' : b.cmd;
      const usesQual = clause === 'qual';
      if (cmd === 'INSERT' && usesQual) continue;
      await db.exec('BEGIN');
      try {
        await db.exec(
          `CREATE POLICY __once_probe ON public.${b.tablename} FOR ${cmd} TO authenticated ` +
            (usesQual ? `USING (${want})` : `WITH CHECK (${want})`),
        );
        const p = (
          await db.query<{ e: string }>(
            `SELECT ${usesQual ? 'qual' : 'with_check'} AS e FROM pg_policies
              WHERE schemaname = 'public' AND tablename = $1 AND policyname = '__once_probe'`,
            [b.tablename],
          )
        ).rows[0]!.e;
        if (norm(p) !== norm(a[clause])) wrong.push(`${b.tablename}.${b.policyname} ${clause}\n  want: ${norm(p)}\n  got:  ${norm(a[clause])}`);
        if (askOnce(a[clause]) !== a[clause]) wrong.push(`${b.tablename}.${b.policyname} ${clause} still has a per-row call`);
      } finally {
        await db.exec('ROLLBACK');
      }
    }
  }
  assert.ok(rewritten >= 300, `${rewritten} predicates rewritten`);
  assert.equal(wrong.length, 0, wrong.slice(0, 20).join('\n'));
});

test('the couple’s guest list no longer calls the delegate resolver once per guest', () => {
  console.log(`\n── guests as the couple, BEFORE ──\n${planBefore}\n── AFTER ──\n${planAfter}\n`);
  assert.match(planBefore, /moderator_area_level\(/, 'the before plan calls the resolver per row');
  assert.doesNotMatch(planAfter, /moderator_area_level\(/, 'the after plan must not');
  assert.match(planAfter, /current_moderator_area_levels/, 'it asks the set once instead');
});

/* ── SABOTAGE: the matrix must notice a broadened policy ───────────────── */

test('SABOTAGE: a read policy broadened to true turns the matrix red', async () => {
  await db.exec('BEGIN');
  try {
    await db.exec(`ALTER POLICY guests_moderator_read ON public.guests USING (true)`);
    const m = await runMatrix(['guests']);
    const d = Object.keys(m).filter((k) => m[k] !== mBefore[k]);
    assert.ok(d.length > 0, 'a guests read opened to everyone must change some cell');
    assert.ok(d.some((k) => k.includes('stranger') && k.endsWith('select')), 'the stranger now reads guests');
  } finally {
    await db.exec('ROLLBACK');
  }
});

test('SABOTAGE: a write check broadened turns the matrix red', async () => {
  await db.exec('BEGIN');
  try {
    await db.exec(`ALTER POLICY guests_moderator_write ON public.guests USING (true) WITH CHECK (true)`);
    const m = await runMatrix(['guests']);
    const d = Object.keys(m).filter((k) => m[k] !== mBefore[k] && /(update|delete|insert)#/.test(k));
    assert.ok(d.length > 0, 'opening the delegate write must change some write cell');
  } finally {
    await db.exec('ROLLBACK');
  }
});
