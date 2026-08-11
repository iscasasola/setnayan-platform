/**
 * WHO SIGNED THE DAY-OF ANNOUNCEMENT — decided by the database, never by the
 * browser. Sibling of chat-sender-not-forgeable.db.test.ts; read that one for
 * the shape. This file covers `public.coordinator_broadcasts` and the ONE way
 * it differs, which is the interesting part.
 *
 * ── WHAT WAS POSSIBLE ──────────────────────────────────────────────────────
 * Measured against this exact replay before migration 20271132843141:
 *
 *   couple      inserting sender_role = 'coordinator'  → ACCEPTED
 *   coordinator inserting sender_role = 'couple'       → ACCEPTED
 *
 * These are the announcements pushed to every guest's phone mid-event. Both
 * INSERT policies pin `sender_user_id = auth.uid()`, so this is MILDER than the
 * chat_messages case — nobody can impersonate a different person. What was
 * forgeable is the role LABEL guests are shown.
 *
 * ── THE DIFFERENCE THAT MATTERS: THIS COLUMN HAS A DEFAULT ────────────────
 * `chat_messages.sender_role` is NOT NULL with NO default, so a revoke without
 * a working trigger fails loudly. `coordinator_broadcasts.sender_role` is
 * NOT NULL **DEFAULT 'coordinator'** — a revoke without a working trigger
 * succeeds and silently labels every couple announcement as the coordinator.
 *
 * That is not hypothetical: in the pre-fix replay an honest couple insert that
 * merely omitted the column already landed as 'coordinator'.
 *
 * So the tests here do NOT stop at "the forgery is refused". Refusal alone is
 * equally true of the broken state. They assert the couple's row actually
 * reads 'couple', and a dedicated neutralisation test drops the trigger while
 * leaving the revoke in place to show that outcome flipping to the silent lie.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const TABLE = 'public.coordinator_broadcasts';
/** Columns the browser must not be able to decide. */
const PROVENANCE_COLUMNS = ['sender_role', 'sender_user_id', 'created_at'] as const;
/** Columns a legitimate announcement must still be able to write. */
const CALLER_COLUMNS = ['event_id', 'body'] as const;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function asService(): Promise<void> {
  await setAuthUid(db, null);
  await setAuthRole('service_role');
  await db.exec(`SET ROLE service_role`);
}
/** Tolerant: several tests provoke a refusal inside an explicit transaction,
 *  which aborts the block and makes even set_config() error with 25P02. */
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setAuthRole(null).catch(() => {});
}
/** ROLLBACK first — an aborted block refuses everything else until it ends. */
async function rollbackAndReset(): Promise<void> {
  await db.exec(`ROLLBACK`).catch(() => {});
  await reset();
}

async function canInsertColumn(role: string, column: string): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(
    `SELECT has_column_privilege($1, $2, $3, 'INSERT') AS ok`,
    [role, TABLE, column],
  );
  return r.rows[0]!.ok;
}

/** Run a statement as `uid`; return the error message, or null if allowed. */
async function attempt(uid: string, sql: string, params: unknown[]): Promise<string | null> {
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

/** What the app now sends: the event and the words, nothing else. */
async function announce(uid: string, body: string): Promise<string | null> {
  return attempt(
    uid,
    `INSERT INTO public.coordinator_broadcasts (event_id, body) VALUES ($1, $2)`,
    [F.eventId, body],
  );
}

async function roleOf(body: string): Promise<{ role: string; uid: string } | null> {
  await asService();
  const r = await db.query<{ sender_role: string; sender_user_id: string }>(
    `SELECT sender_role, sender_user_id FROM public.coordinator_broadcasts WHERE body = $1`,
    [body],
  );
  await reset();
  return r.rows.length === 1 ? { role: r.rows[0]!.sender_role, uid: r.rows[0]!.sender_user_id } : null;
}

const F = { couple: '', coordinator: '', outsider: '', eventId: '' };

async function createUser(email: string) {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.couple = await createUser('bcast-couple@test.test');
  F.coordinator = await createUser('bcast-coordinator@test.test');
  F.outsider = await createUser('bcast-outsider@test.test');

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Broadcast Forgery Event', 'birthday') RETURNING event_id`,
  );
  F.eventId = ev.rows[0]!.event_id;

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [F.eventId, F.couple],
  );
  // An accepted, not-removed delegate holding schedule='edit' — the exact
  // standing coordinator_broadcasts_moderator_insert asks for.
  await db.query(
    `INSERT INTO public.event_moderators
       (event_id, user_id, role_subtype, permissions_json, accepted_at)
     VALUES ($1, $2, 'wedding_planner_external', '{"areas":{"schedule":"edit"}}'::jsonb, now())`,
    [F.eventId, F.coordinator],
  );
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · ANTI-VACUITY ─────────────────────────────────────────────────────── */

test('META: the table, the columns, the CHECK and the DEFAULT are as this suite assumes', async () => {
  const cols = await db.query<{ attname: string; attnotnull: boolean; dflt: string | null }>(
    `SELECT a.attname, a.attnotnull, pg_get_expr(d.adbin, d.adrelid) AS dflt
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped`,
    [TABLE],
  );
  assert.ok(cols.rows.length > 0, `${TABLE} is missing from the replay`);
  const byName = new Map(cols.rows.map((r) => [r.attname, r]));
  for (const c of [...PROVENANCE_COLUMNS, ...CALLER_COLUMNS]) {
    assert.ok(byName.has(c), `${TABLE}.${c} is gone — re-decide this test, do not inherit it`);
  }

  // The load-bearing fact for this whole file, asserted rather than trusted.
  assert.equal(byName.get('sender_role')!.attnotnull, true, 'sender_role stopped being NOT NULL');
  assert.match(
    byName.get('sender_role')!.dflt ?? '',
    /'coordinator'/,
    "sender_role's DEFAULT is no longer 'coordinator'. This suite's central argument — that a " +
      'revoke without a working trigger fails SILENTLY rather than loudly — rests on that ' +
      'default. If it changed, re-argue the design instead of inheriting these tests.',
  );

  const chk = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = $1::regclass AND contype = 'c' AND conname LIKE '%sender_role%'`,
    [TABLE],
  );
  assert.equal(chk.rows.length, 1, 'the sender_role CHECK constraint is missing');
  for (const v of ['couple', 'coordinator']) {
    assert.match(chk.rows[0]!.def, new RegExp(`'${v}'`), `CHECK no longer admits '${v}'`);
  }
});

test('META: the BEFORE INSERT derivation trigger exists and really is BEFORE', async () => {
  const r = await db.query<{ is_before: boolean }>(
    `SELECT (t.tgtype & 2) = 2 AS is_before FROM pg_trigger t
      WHERE t.tgrelid = $1::regclass AND NOT t.tgisinternal
        AND t.tgname = 'coordinator_broadcasts_derive_sender'`,
    [TABLE],
  );
  assert.equal(r.rows.length, 1, 'coordinator_broadcasts_derive_sender is missing');
  assert.equal(
    r.rows[0]!.is_before,
    true,
    'the derivation trigger is not BEFORE. An AFTER trigger cannot change the row, so the ' +
      'forged value (or the misleading DEFAULT) is what would land.',
  );
});

test('META: both INSERT policies still pin sender_user_id — the milder half of the story', async () => {
  // This is WHY this table is less severe than chat_messages, so it is asserted
  // rather than asserted-in-a-comment. If a policy edit drops the pin, the
  // severity changes and somebody should find out here.
  const pols = await db.query<{ polname: string; wc: string }>(
    `SELECT polname, pg_get_expr(polwithcheck, polrelid) AS wc
       FROM pg_policy WHERE polrelid = $1::regclass AND polcmd = 'a'`,
    [TABLE],
  );
  assert.equal(pols.rows.length, 2, `expected 2 INSERT policies, found ${pols.rows.length}`);
  const unpinned = pols.rows.filter((p) => !/sender_user_id\s*=\s*auth\.uid\(\)/.test(p.wc));
  assert.deepEqual(
    unpinned.map((p) => p.polname),
    [],
    `${unpinned.map((p) => p.polname).join(', ')} no longer pins sender_user_id to auth.uid(). ` +
      'Impersonating a different PERSON may now be possible, which this suite does not cover.',
  );
});

test('META: the probing role is authenticated, is not the owner, and has no BYPASSRLS', async () => {
  await db.exec(`SET ROLE authenticated`);
  const r = await db.query<{ me: string; owner: string; bypass: boolean }>(
    `SELECT current_user AS me, pg_get_userbyid(c.relowner) AS owner,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass
       FROM pg_class c WHERE c.oid = $1::regclass`,
    [TABLE],
  );
  await reset();
  assert.equal(r.rows[0]!.me, 'authenticated', 'SET ROLE did not take');
  assert.notEqual(r.rows[0]!.owner, 'authenticated', 'the probing role OWNS the table — it bypasses RLS');
  assert.equal(r.rows[0]!.bypass, false, 'the probing role has BYPASSRLS');
});

test('META: service_role keeps INSERT on every column — a narrowing, not a demolition', async () => {
  const denied: string[] = [];
  for (const c of PROVENANCE_COLUMNS) {
    if (!(await canInsertColumn('service_role', c))) denied.push(c);
  }
  assert.deepEqual(denied, [], `service_role lost INSERT on ${denied.join(', ')}`);
});

test('META: the fixture couple and coordinator each really do pass their own policy', async () => {
  // Without this, "the forgery is refused" could just mean the fixture never
  // had standing to insert anything at all, and every behavioural test below
  // would be vacuously green.
  await asUser(F.couple);
  const c = await db.query<{ ok: boolean }>(
    `SELECT ($1::uuid IN (SELECT public.current_couple_event_ids())) AS ok`,
    [F.eventId],
  );
  await reset();
  await asUser(F.coordinator);
  const m = await db.query<{ lvl: string | null }>(
    `SELECT public.moderator_area_level($1::uuid, 'schedule') AS lvl`,
    [F.eventId],
  );
  await reset();
  assert.equal(c.rows[0]!.ok, true, 'the fixture couple does not satisfy the couple INSERT policy');
  assert.equal(m.rows[0]!.lvl, 'edit', 'the fixture delegate does not hold schedule=edit');
});

/* ── 1 · THE CLOSURE ──────────────────────────────────────────────────────── */

test('authenticated and anon hold NO INSERT on the provenance columns', async () => {
  const open: string[] = [];
  for (const role of ['anon', 'authenticated']) {
    for (const c of PROVENANCE_COLUMNS) {
      if (await canInsertColumn(role, c)) open.push(`${role}.${c}`);
    }
  }
  assert.deepEqual(
    open,
    [],
    `${open.join(', ')} is writable by the browser. has_column_privilege folds table-level ` +
      'grants in, so a table-wide GRANT INSERT re-opens these even with no column grant in sight.',
  );
});

test('authenticated CAN still write the columns a real announcement needs', async () => {
  const denied: string[] = [];
  for (const c of CALLER_COLUMNS) {
    if (!(await canInsertColumn('authenticated', c))) denied.push(c);
  }
  assert.deepEqual(denied, [], `authenticated cannot write ${denied.join(', ')} — nobody can announce`);
});

test('authenticated holds no UPDATE anywhere on the table', async () => {
  const t = await db.query<{ ok: boolean }>(
    `SELECT has_table_privilege('authenticated', $1, 'UPDATE') AS ok`,
    [TABLE],
  );
  assert.equal(t.rows[0]!.ok, false, 'authenticated regained UPDATE on coordinator_broadcasts');
  const cols: string[] = [];
  for (const c of PROVENANCE_COLUMNS) {
    const g = await db.query<{ ok: boolean }>(
      `SELECT has_column_privilege('authenticated', $1, $2, 'UPDATE') AS ok`,
      [TABLE, c],
    );
    if (g.rows[0]!.ok) cols.push(c);
  }
  assert.deepEqual(cols, [], `authenticated can UPDATE ${cols.join(', ')}`);
});

/* ── 2 · BEHAVIOURAL — the attack, both directions, run for real ──────────── */

test('BEHAVIOURAL: the couple cannot sign an announcement as the coordinator', async () => {
  const msg = await attempt(
    F.couple,
    `INSERT INTO public.coordinator_broadcasts (event_id, sender_user_id, sender_role, body)
     VALUES ($1,$2,'coordinator',$3)`,
    [F.eventId, F.couple, 'forged: couple as coordinator'],
  );
  assert.ok(msg, 'the couple signed an announcement as the coordinator');
  assert.match(msg, /permission denied/i, `expected a permission failure, got: ${msg}`);
});

test('BEHAVIOURAL: the coordinator cannot sign an announcement as the couple', async () => {
  const msg = await attempt(
    F.coordinator,
    `INSERT INTO public.coordinator_broadcasts (event_id, sender_user_id, sender_role, body)
     VALUES ($1,$2,'couple',$3)`,
    [F.eventId, F.coordinator, 'forged: coordinator as couple'],
  );
  assert.ok(msg, 'the delegate signed an announcement as the couple');
  assert.match(msg, /permission denied/i, `expected a permission failure, got: ${msg}`);
});

test('BEHAVIOURAL: nobody can backdate an announcement into the guests’ feed', async () => {
  // The feed is newest-first, so choosing your timestamp is choosing your slot.
  const msg = await attempt(
    F.couple,
    `INSERT INTO public.coordinator_broadcasts (event_id, body, created_at)
     VALUES ($1,$2,'2020-01-01T00:00:00Z'::timestamptz)`,
    [F.eventId, 'forged created_at'],
  );
  assert.ok(msg, 'the couple set created_at itself');
  assert.match(msg, /permission denied/i, `expected a permission failure, got: ${msg}`);
});

test('BEHAVIOURAL: a real announcement works and is signed from auth.uid() — NOT from the DEFAULT', async () => {
  // The central assertion of this file. "The forgery is refused" is also true
  // of a broken fix where the revoke landed and the trigger did not; only
  // reading back 'couple' distinguishes the two.
  assert.equal(await announce(F.couple, 'couple announcement'), null, 'the couple could not announce');
  assert.equal(
    await announce(F.coordinator, 'coordinator announcement'),
    null,
    'the delegate could not announce',
  );

  const c = await roleOf('couple announcement');
  const m = await roleOf('coordinator announcement');
  assert.deepEqual(
    { couple: c?.role, coordinator: m?.role },
    { couple: 'couple', coordinator: 'coordinator' },
    "the stored roles are wrong. If the couple's row reads 'coordinator', the column DEFAULT " +
      'is doing the work and the trigger is not — every couple announcement would be ' +
      'mislabelled, silently, with no error anywhere.',
  );
  assert.equal(c?.uid, F.couple, 'sender_user_id was not stamped from auth.uid()');
  assert.equal(m?.uid, F.coordinator, 'sender_user_id was not stamped from auth.uid()');
});

test('BEHAVIOURAL: somebody with no standing on the event is refused', async () => {
  const msg = await announce(F.outsider, 'I do not belong here');
  assert.ok(msg, 'a stranger announced to someone else’s guests');
  assert.match(
    msg,
    /not the couple or a schedule delegate|row-level security/i,
    `expected a standing/RLS refusal, got: ${msg}`,
  );
});

test('BEHAVIOURAL: a delegate WITHOUT schedule-edit is refused', async () => {
  // The moderator branch is a specific grant, not "is a delegate". A
  // view-only delegate must not be able to announce to every guest.
  const viewer = await createUser('bcast-viewonly@test.test');
  await db.query(
    `INSERT INTO public.event_moderators
       (event_id, user_id, role_subtype, permissions_json, accepted_at)
     VALUES ($1, $2, 'family_helper', '{"areas":{"schedule":"view"}}'::jsonb, now())`,
    [F.eventId, viewer],
  );
  const msg = await announce(viewer, 'view-only delegate announcement');
  assert.ok(msg, 'a view-only delegate announced to every guest');
  assert.match(
    msg,
    /not the couple or a schedule delegate|row-level security/i,
    `expected a standing/RLS refusal, got: ${msg}`,
  );
});

/* ── 3 · NEUTRALISATION — each half proven load-bearing ───────────────────── */

test('NEUTRALISATION: re-granting the columns re-opens the INSERT — but the TRIGGER still corrects it', async () => {
  await db.exec(`BEGIN`);
  try {
    await db.exec(`GRANT INSERT (sender_role, sender_user_id) ON ${TABLE} TO authenticated`);
    const msg = await attempt(
      F.couple,
      `INSERT INTO public.coordinator_broadcasts (event_id, sender_user_id, sender_role, body)
       VALUES ($1,$2,'coordinator',$3)`,
      [F.eventId, F.couple, 'neutralisation probe'],
    );
    assert.equal(msg, null, `the re-grant did not restore the INSERT — the refusal is not the ACL's doing: ${msg}`);
    const r = await roleOf('neutralisation probe');
    assert.equal(
      r?.role,
      'couple',
      'with the grant restored the forged label SURVIVED — the trigger is not correcting it, ' +
        'so the GRANT is carrying the whole fix alone',
    );
  } finally {
    await rollbackAndReset();
  }
});

test('NEUTRALISATION: dropping the trigger fails LOUDLY — because sender_user_id was revoked too', async () => {
  // This test was written expecting the opposite, and the run corrected it.
  //
  // The guess was: drop the trigger, the 'coordinator' DEFAULT takes over, and
  // every couple announcement is silently mislabelled. What actually happens is
  // a refusal — because sender_user_id is ALSO revoked, so nothing fills it,
  // and both INSERT policies require sender_user_id = auth.uid().
  //
  // That makes revoking sender_user_id load-bearing rather than belt-and-braces:
  // it is what converts "the trigger is missing" from a silent mislabel into a
  // visible failure. The next test proves the silent version is real by removing
  // exactly that protection.
  await db.exec(`BEGIN`);
  try {
    await db.exec(`DROP TRIGGER coordinator_broadcasts_derive_sender ON ${TABLE}`);
    const msg = await announce(F.couple, 'loud failure probe');
    assert.ok(
      msg,
      'with the trigger gone the insert SUCCEEDED. Then either sender_user_id got a default, or ' +
        'a policy stopped pinning it to auth.uid() — check which, because the silent-mislabel ' +
        'failure mode is now reachable in production.',
    );
    assert.match(
      msg,
      /row-level security|null value in column "sender_user_id"/i,
      `expected the missing sender_user_id to be what refuses the row, got: ${msg}`,
    );
  } finally {
    await rollbackAndReset();
  }
});

test('NEUTRALISATION: revoking ONLY sender_role would have shipped a silent, uniform lie', async () => {
  // The road not taken, executed rather than argued. Revoke sender_role but
  // leave sender_user_id writable — the obvious minimal reading of "stop the
  // browser choosing the label" — and with no trigger the couple's own
  // announcement goes out to every guest signed 'coordinator'. No error, no
  // refusal, nothing in a log. That is worse than the bug being fixed, because
  // the bug at least required someone to choose to lie.
  //
  // This is what the column DEFAULT buys you, and it is why this table needed a
  // different shape of fix from chat_messages, where sender_role has no default
  // and a missing trigger simply cannot insert.
  await db.exec(`BEGIN`);
  try {
    await db.exec(`DROP TRIGGER coordinator_broadcasts_derive_sender ON ${TABLE}`);
    await db.exec(`GRANT INSERT (sender_user_id) ON ${TABLE} TO authenticated`);
    const msg = await attempt(
      F.couple,
      `INSERT INTO public.coordinator_broadcasts (event_id, sender_user_id, body)
       VALUES ($1,$2,$3)`,
      [F.eventId, F.couple, 'silent lie probe'],
    );
    assert.equal(msg, null, `the partial revoke refused the honest insert too: ${msg}`);
    const r = await roleOf('silent lie probe');
    assert.equal(
      r?.role,
      'coordinator',
      "expected the couple's own announcement to be silently signed 'coordinator' by the column " +
        'DEFAULT. It was not — so the DEFAULT is no longer what fills this column, and the ' +
        'reasoning in this migration should be re-read rather than inherited.',
    );
  } finally {
    await rollbackAndReset();
  }
});

test('NEUTRALISATION: with BOTH halves removed the original forgery succeeds again', async () => {
  await db.exec(`BEGIN`);
  try {
    await db.exec(`DROP TRIGGER coordinator_broadcasts_derive_sender ON ${TABLE}`);
    await db.exec(`GRANT INSERT (sender_role, sender_user_id) ON ${TABLE} TO authenticated`);
    const msg = await attempt(
      F.couple,
      `INSERT INTO public.coordinator_broadcasts (event_id, sender_user_id, sender_role, body)
       VALUES ($1,$2,'coordinator',$3)`,
      [F.eventId, F.couple, 'full reproduction'],
    );
    assert.equal(msg, null, `removing both halves did not restore the forgery: ${msg}`);
    const r = await roleOf('full reproduction');
    assert.equal(
      r?.role,
      'coordinator',
      'the forged label did not land even with both halves removed — this suite is no longer ' +
        'reproducing the defect it claims to prevent',
    );
  } finally {
    await rollbackAndReset();
  }
});
