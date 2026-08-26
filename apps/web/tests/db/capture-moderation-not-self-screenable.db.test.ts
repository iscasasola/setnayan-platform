/**
 * THE UPLOADER DOES NOT DECIDE WHETHER THEIR OWN PHOTO PASSED THE NSFW SCREEN.
 *
 * Sixth instance of the shape (chat sender · broadcast sender · self-promotion
 * to admin · self-awarded experience mark · self-approved payout destination).
 * `papic_photos` has two PERMISSIVE FOR ALL policies — the paparazzo who
 * claimed the seat, and the couple — ZERO BEFORE triggers, and nothing
 * constraining `moderation_state`.
 *
 * ── WHY THIS IS SCREEN EVASION, NOT A MISLABEL ─────────────────────────────
 * `lib/nsfw-screen.ts:258` returns early on any row whose state is not
 * `'unscreened'` ("already decided"), and its UPDATE matches only `'unscreened'`
 * rows. Measured in this replay before migration 20271135058626:
 *
 *   paparazzo INSERTs moderation_state='clean'   → ACCEPTED
 *   …then the screen's real compare-and-set runs → row is STILL 'clean'
 *
 * The screen did not mis-rule. It never ran. And because it runs once, at
 * upload, lane 2 is never re-corrected either:
 *
 *   paparazzo flips a 'nsfw_blocked' row → 'clean' → ACCEPTED
 *   couple    flips a 'nsfw_blocked' row → 'clean' → ACCEPTED
 *
 * Every guest, couple and Live Wall surface gates on
 * `moderation_state <> 'nsfw_blocked'` (lib/papic-gallery.ts:146,151,367), and
 * the spec corpus carries "NSFW filter is on by default and CANNOT be disabled"
 * as a hard product constraint.
 *
 * ── WHY A PLAIN COLUMN REVOKE, UNLIKE THE EXPERIENCE MARK ─────────────────
 * Every legitimate writer is already service-role — the screen, and the
 * couple's single-photo override (moderation/actions.ts:259-265, which uses
 * createAdminClient() and is pinned to `.eq('moderation_state','nsfw_blocked')`
 * so it can only undo a classifier block). No RLS-scoped client writes this
 * column, so unlike 20271134103060 there is no end-user lane to preserve.
 *
 * The DEFAULT is 'unscreened', which here is the SAFE value — the opposite of
 * vendor_payment_methods, where the default was the privileged one. An insert
 * naming nothing lands unscreened and the screen then runs.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let OUTER_LOCK_HELD = false;
let replay: ReplayResult;
let db: PGlite;

const TABLES = ['papic_photos', 'editorial_vendor_media'] as const;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setAuthRole(null).catch(() => {});
}
async function rollbackAndReset(): Promise<void> {
  await db.exec(`ROLLBACK`).catch(() => {});
  await reset();
}
async function tryAs(uid: string, sql: string, params: unknown[] = []): Promise<string | null> {
  await asUser(uid);
  try {
    await db.query(sql, params);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    await reset();
  }
}
async function stateOf(key: string): Promise<string | null> {
  await reset();
  const r = await db.query<{ m: string }>(
    `SELECT moderation_state AS m FROM public.papic_photos WHERE r2_object_key = $1`,
    [key],
  );
  return r.rows.length ? r.rows[0]!.m : null;
}
/** The screen's REAL compare-and-set, as service_role. */
async function runScreen(key: string, verdict = 'nsfw_blocked'): Promise<void> {
  await reset();
  await db.query(
    `UPDATE public.papic_photos SET moderation_state = $2
      WHERE r2_object_key = $1 AND moderation_state = 'unscreened'`,
    [key, verdict],
  );
}

const F = { couple: '', papz: '', eventId: '', seat: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const mk = async (email: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data)
         VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  F.couple = await mk('mod-couple@test.test');
  F.papz = await mk('mod-papz@test.test');

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Moderation Test Event','birthday') RETURNING event_id`,
  );
  F.eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id,user_id,member_type) VALUES ($1,$2,'couple')`,
    [F.eventId, F.couple],
  );
  const seat = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats (event_id, claimer_user_id, seat_index, sku_code, claim_qr_token)
     VALUES ($1,$2,1,'PAPIC_CAMERA_MINI_DAY','tok-moderation-test') RETURNING seat_id`,
    [F.eventId, F.papz],
  );
  F.seat = seat.rows[0]!.seat_id;

  /*
    ── 🛑 THIS FILE DELIBERATELY REACHES AROUND AN OUTER LOCK ────────────────

    On 2026-08-26, `20271169487222_no_photo_without_a_credit` revoked INSERT on
    papic_photos from `authenticated` altogether: the row is written by the
    service role after the eight gates in recordSeatCapture, because a policy
    cannot count credits. That closes every scenario below by a much blunter
    route — a paparazzo can no longer insert ANYTHING, forged verdict or not.

    ⚠ WHICH WOULD MAKE THIS WHOLE FILE PASS FOR THE WRONG REASON. Every
    behavioural rule here would go green on "permission denied", proving the
    outer lock and saying nothing about the inner one. And the inner one is
    worth keeping: the outer lock is one migration away from being softened by
    somebody who needs a browser write for a future feature, and on that day the
    `moderation_state` revoke and its trigger are what still stand between an
    uploader and their own NSFW verdict. **A second lock you cannot test is not
    a second lock.**

    So the base grant is restored HERE, for exactly the columns an ordinary
    capture names — and NOT for `moderation_state`, which is the thing under
    test. The rule immediately below asserts the outer lock is really there in
    the schema before this lifts it, so nobody mistakes this scaffolding for the
    product's shape.
  */
  /*
    🪤 ASKED PER COLUMN, AND THE FIRST VERSION OF THIS WAS DECORATION FOR THE
    EXACT REASON THE OUTER LOCK EXISTS. It read
    `has_table_privilege('authenticated','public.papic_photos','INSERT')` and
    treated FALSE as "closed" — but that function answers FALSE while 39
    COLUMN-level grants are standing, which is precisely how the original hole
    stayed invisible. Removing the revoke from the migration measured 1 → 0 and
    this rule stayed GREEN.
  */
  const openCols = await db.query<{ n: number }>(`
    SELECT count(*)::int AS n
      FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.table_name = 'papic_photos'
       AND (has_column_privilege('authenticated','public.papic_photos', c.column_name, 'INSERT')
         OR has_column_privilege('anon','public.papic_photos', c.column_name, 'INSERT'))
  `);
  const insertPolicies = await db.query<{ n: number }>(`
    SELECT count(*)::int AS n FROM pg_policies
     WHERE schemaname='public' AND tablename='papic_photos' AND cmd IN ('ALL','INSERT')
  `);
  OUTER_LOCK_HELD = (openCols.rows[0]?.n ?? -1) === 0 && (insertPolicies.rows[0]?.n ?? -1) === 0;

  /*
    🪤 THE HAND-TYPED VERSION OF THIS WAS DECORATION, exactly where it mattered.
    It listed eight columns and omitted `moderation_state` — so lane 1 below
    refused because MY LIST omitted it, not because the schema does. Delete the
    revoke this whole file exists to guard and every rule still passes: the
    scaffolding was carrying the assertion.

    ⚖ DERIVED INSTEAD. `20271169487222` revoked INSERT and left UPDATE alone, so
    the columns `authenticated` may still UPDATE are exactly the ones it could
    INSERT before that migration — 39 of 45, with the six the moderation revoke
    withholds (moderation_state and the safe_/tile_ derivatives) absent from
    both. Granting INSERT on precisely that set reproduces the pre-2026-08-26
    shape from the schema rather than from memory.

    🔑 And it restores the guard's teeth: if somebody ever hands `moderation_state`
    its UPDATE grant back, this scaffolding grants INSERT on it too and lane 1
    goes RED — which is the whole point of a second lock.
  */
  await db.exec(`
    DO $scaffold$
    DECLARE cols TEXT;
    BEGIN
      SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
        INTO cols
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'papic_photos'
        AND has_column_privilege('authenticated', 'public.papic_photos', c.column_name, 'UPDATE');
      IF cols IS NULL THEN
        RAISE EXCEPTION 'scaffolding found no updatable columns — the grant below would be empty';
      END IF;
      EXECUTE format('GRANT INSERT (%s) ON public.papic_photos TO authenticated', cols);
    END
    $scaffold$;
  `);

  // ⚠ THE OUTER LOCK HAS TWO HALVES AND BOTH HAVE TO BE LIFTED. The same
  // migration removed the INSERT arm from the claimer's policy (it was FOR ALL;
  // it is now three verbs). With only the GRANT restored the insert is refused
  // by RLS instead of by the ACL — a different refusal, still the wrong reason.
  // This is the claimer predicate exactly as it stood before 2026-08-26.
  await db.exec(`
    CREATE POLICY papic_photos_scaffold_claimer_insert ON public.papic_photos
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.paparazzi_seats ps
          WHERE ps.seat_id = papic_photos.paparazzi_seat_id
            AND ps.claimer_user_id = auth.uid()
            AND ps.revoked_at IS NULL
            AND ps.event_id = papic_photos.event_id
        )
      )
  `);
});

test('0 · THE OUTER LOCK: in the real schema no browser role can insert at all', () => {
  assert.ok(
    OUTER_LOCK_HELD,
    'a browser role can insert into papic_photos again — by column grant, by ' +
      'policy, or both. Every gate in ' +
      'recordSeatCapture — burst limiter, clip cap, capture window, paid-order ' +
      'gate, put-away gate, geo control, credit reserve — becomes advisory, ' +
      'because a photo can then be POSTed straight to PostgREST. See ' +
      'no-photo-without-a-credit.db.test.ts. Everything below this line runs ' +
      'with that lock deliberately lifted, to exercise the SECOND one.',
  );
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · ANTI-VACUITY ─────────────────────────────────────────────────────── */

test('META: the screen really does skip any row that is not unscreened', async () => {
  // The fact the whole severity argument rests on, asserted against the shipped
  // source rather than trusted. If nsfw-screen stops early-returning, a forged
  // 'clean' becomes a mislabel the screen would correct, and this suite is
  // guarding something milder than it claims.
  const fs = await import('node:fs');
  const path = await import('node:path');
  const url = await import('node:url');
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const src = fs.readFileSync(path.resolve(here, '../../lib/nsfw-screen.ts'), 'utf8');
  assert.match(
    src,
    /moderation_state\s*!==\s*'unscreened'\)\s*return/,
    "nsfw-screen.ts no longer early-returns on a row that is not 'unscreened' — re-argue the " +
      'severity of this finding rather than inheriting it',
  );
  assert.match(
    src,
    /\.eq\('moderation_state',\s*'unscreened'\)/,
    "nsfw-screen.ts no longer pins its UPDATE to 'unscreened'",
  );
});

test('META: the DEFAULT is unscreened on both tables — here the default is the SAFE value', async () => {
  for (const t of TABLES) {
    const r = await db.query<{ dflt: string | null }>(
      `SELECT pg_get_expr(d.adbin, d.adrelid) AS dflt FROM pg_attribute a
         LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = format('public.%I',$1::text)::regclass AND a.attname = 'moderation_state'`,
      [t],
    );
    assert.match(
      r.rows[0]?.dflt ?? '',
      /'unscreened'/,
      `${t}.moderation_state DEFAULT is not 'unscreened'. If it became a decided value, revoking ` +
        'the column would silently pre-decide every row and skip the screen — the ' +
        'vendor_payment_methods trap on a safety column.',
    );
  }
});

test('META: the pin trigger exists on both tables and fires BEFORE both verbs', async () => {
  for (const t of TABLES) {
    const r = await db.query<{ before: boolean; ins: boolean; upd: boolean }>(
      `SELECT (t.tgtype & 2) = 2 AS before, (t.tgtype & 4) > 0 AS ins, (t.tgtype & 16) > 0 AS upd
         FROM pg_trigger t
        WHERE t.tgrelid = format('public.%I',$1::text)::regclass AND NOT t.tgisinternal
          AND t.tgfoid = 'public.tg_pin_moderation_state'::regproc`,
      [t],
    );
    assert.equal(r.rows.length, 1, `the pin trigger is missing on ${t}`);
    assert.deepEqual(r.rows[0], { before: true, ins: true, upd: true }, `wrong timing/verbs on ${t}`);
  }
});

test('META: papic_guest_captures is deliberately untouched, and still admin-only for writes', async () => {
  // The reason it is excluded. If an ordinary-user write policy ever appears,
  // this table joins the fix and somebody needs to know.
  const r = await db.query<{ polname: string; expr: string }>(
    `SELECT polname, coalesce(pg_get_expr(polwithcheck,polrelid),pg_get_expr(polqual,polrelid),'') AS expr
       FROM pg_policy WHERE polrelid = 'public.papic_guest_captures'::regclass
        AND polcmd IN ('a','w','*')`,
  );
  const nonAdmin = r.rows.filter((p) => !/is_admin\(\)/.test(p.expr));
  assert.deepEqual(
    nonAdmin.map((p) => p.polname),
    [],
    `papic_guest_captures gained a non-admin write policy (${nonAdmin.map((p) => p.polname).join(', ')}). ` +
      'It carries the same moderation_state column and now needs the same pin.',
  );
});

test('META: the probing role is authenticated, is not the owner, and has no BYPASSRLS', async () => {
  await db.exec(`SET ROLE authenticated`);
  const r = await db.query<{ me: string; owner: string; bypass: boolean }>(
    `SELECT current_user AS me, pg_get_userbyid(c.relowner) AS owner,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass
       FROM pg_class c WHERE c.oid = 'public.papic_photos'::regclass`,
  );
  await reset();
  assert.equal(r.rows[0]!.me, 'authenticated');
  assert.notEqual(r.rows[0]!.owner, 'authenticated');
  assert.equal(r.rows[0]!.bypass, false);
});

test('META: service_role keeps the column on both tables — the screen must still write', async () => {
  for (const t of TABLES) {
    for (const p of ['INSERT', 'UPDATE'] as const) {
      const r = await db.query<{ ok: boolean }>(
        `SELECT has_column_privilege('service_role', format('public.%I',$1::text), 'moderation_state', $2) AS ok`,
        [t, p],
      );
      assert.equal(r.rows[0]!.ok, true, `service_role lost ${p} on ${t}.moderation_state — the screen is broken`);
    }
  }
});

/* ── 1 · THE CLOSURE ──────────────────────────────────────────────────────── */

test('authenticated and anon hold no INSERT or UPDATE on moderation_state', async () => {
  const open: string[] = [];
  for (const t of TABLES) {
    for (const role of ['anon', 'authenticated']) {
      for (const p of ['INSERT', 'UPDATE'] as const) {
        const r = await db.query<{ ok: boolean }>(
          `SELECT has_column_privilege($1, format('public.%I',$2::text), 'moderation_state', $3) AS ok`,
          [role, t, p],
        );
        if (r.rows[0]!.ok) open.push(`${role}.${t}.${p}`);
      }
    }
  }
  assert.deepEqual(open, [], `${open.join(', ')} is writable by the browser`);
});

test('the capture columns are writable — i.e. the scaffolding above is in place', async () => {
  // ⚠ THIS ONCE ASSERTED A PROPERTY OF THE SCHEMA and now asserts one of this
  // file's own setup, because the schema stopped granting these on 2026-08-26.
  // It is kept because a silently failed scaffolding GRANT would make every
  // behavioural rule below go green on "permission denied" — passing for the
  // wrong reason is the failure mode this file exists to avoid.
  const needed = ['event_id', 'paparazzi_seat_id', 'r2_object_key', 'hidden_at', 'clip_web_r2_key'];
  const denied: string[] = [];
  for (const c of needed) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_column_privilege('authenticated','public.papic_photos',$1,'INSERT') AS ok`,
      [c],
    );
    if (!r.rows[0]!.ok) denied.push(c);
  }
  assert.deepEqual(denied, [], `authenticated cannot write ${denied.join(', ')} — captures break`);
});

/* ── 2 · BEHAVIOURAL ──────────────────────────────────────────────────────── */

test('BEHAVIOURAL: lane 1 — the uploader cannot pre-mark a photo clean and skip the screen', async () => {
  const msg = await tryAs(
    F.papz,
    `INSERT INTO public.papic_photos (event_id, paparazzi_seat_id, r2_object_key, moderation_state)
     VALUES ($1,$2,'r2://lane1','clean')`,
    [F.eventId, F.seat],
  );
  assert.ok(msg, 'the uploader inserted a pre-approved photo');
  assert.match(msg, /permission denied/i, `expected a permission failure, got: ${msg}`);
  assert.equal(await stateOf('r2://lane1'), null, 'the row landed anyway');
});

test('BEHAVIOURAL: lane 2 — neither the uploader nor the couple can un-block a screened photo', async () => {
  await reset();
  await db.query(
    `INSERT INTO public.papic_photos (event_id, paparazzi_seat_id, r2_object_key, moderation_state)
     VALUES ($1,$2,'r2://lane2','nsfw_blocked')`,
    [F.eventId, F.seat],
  );
  for (const [who, uid] of [['paparazzo', F.papz], ['couple', F.couple]] as const) {
    const msg = await tryAs(
      uid,
      `UPDATE public.papic_photos SET moderation_state='clean' WHERE r2_object_key='r2://lane2'`,
    );
    assert.ok(msg, `the ${who} un-blocked a screened photo`);
    assert.match(msg, /permission denied/i, `expected a permission failure for the ${who}, got: ${msg}`);
  }
  assert.equal(await stateOf('r2://lane2'), 'nsfw_blocked', 'the block was lifted anyway');
});

test('BEHAVIOURAL: an ordinary capture lands unscreened, so the screen actually runs on it', async () => {
  // Not merely "the insert works" — the value has to be the one that makes
  // nsfw-screen.ts do anything at all.
  const msg = await tryAs(
    F.papz,
    `INSERT INTO public.papic_photos (event_id, paparazzi_seat_id, r2_object_key)
     VALUES ($1,$2,'r2://ok')`,
    [F.eventId, F.seat],
  );
  assert.equal(msg, null, `an ordinary capture was refused: ${msg}`);
  assert.equal(await stateOf('r2://ok'), 'unscreened', 'the capture did not land unscreened — the screen would skip it');

  await runScreen('r2://ok');
  assert.equal(await stateOf('r2://ok'), 'nsfw_blocked', 'the screen could not write its verdict');
});

test('BEHAVIOURAL: the couple can still hide a photo, and the admin override still lifts a block', async () => {
  assert.equal(
    await tryAs(F.couple, `UPDATE public.papic_photos SET hidden_at=now() WHERE r2_object_key='r2://ok'`),
    null,
    'the couple can no longer hide a photo',
  );
  await reset();
  await db.query(
    `UPDATE public.papic_photos SET moderation_state='clean'
      WHERE r2_object_key='r2://ok' AND moderation_state='nsfw_blocked'`,
  );
  assert.equal(await stateOf('r2://ok'), 'clean', 'the couple’s service-role override no longer works');
});

/* ── 3 · NEUTRALISATION ───────────────────────────────────────────────────── */

test('NEUTRALISATION: re-granting the column re-opens the INSERT — but the trigger still pins it', async () => {
  await db.exec(`BEGIN`);
  try {
    await db.exec(`GRANT INSERT (moderation_state) ON public.papic_photos TO authenticated`);
    const msg = await tryAs(
      F.papz,
      `INSERT INTO public.papic_photos (event_id, paparazzi_seat_id, r2_object_key, moderation_state)
       VALUES ($1,$2,'r2://regrant','clean')`,
      [F.eventId, F.seat],
    );
    assert.equal(msg, null, `the re-grant did not restore the INSERT — the refusal is not the ACL's doing: ${msg}`);
    assert.equal(
      await stateOf('r2://regrant'),
      'unscreened',
      'with the grant restored the forged verdict SURVIVED — the trigger is not pinning it, so the ' +
        'GRANT is carrying the whole fix alone',
    );
  } finally {
    await rollbackAndReset();
  }
});

test('NEUTRALISATION: with both halves removed, the forged clean survives the screen', async () => {
  // The full reproduction — and note what is asserted: not just that the insert
  // lands, but that running the screen's real compare-and-set leaves it 'clean'.
  // That is the actual defect: evasion, not mislabelling.
  await db.exec(`BEGIN`);
  try {
    await db.exec(`DROP TRIGGER papic_photos_pin_moderation_state ON public.papic_photos`);
    await db.exec(`GRANT INSERT (moderation_state), UPDATE (moderation_state) ON public.papic_photos TO authenticated`);
    const msg = await tryAs(
      F.papz,
      `INSERT INTO public.papic_photos (event_id, paparazzi_seat_id, r2_object_key, moderation_state)
       VALUES ($1,$2,'r2://repro','clean')`,
      [F.eventId, F.seat],
    );
    assert.equal(msg, null, `removing both halves did not restore the forgery: ${msg}`);
    await runScreen('r2://repro');
    assert.equal(
      await stateOf('r2://repro'),
      'clean',
      'the screen corrected the forged verdict, so this suite is no longer reproducing screen ' +
        'EVASION — re-read nsfw-screen.ts before trusting the severity claims in this file',
    );
  } finally {
    await rollbackAndReset();
  }
});
