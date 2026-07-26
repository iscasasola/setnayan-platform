/**
 * SEC-6 — the Save-the-Date NSFW verdict must be UNWRITABLE by the host, and
 * the legacy in-blob verdict must be gone. End-to-end (test:db, every migration
 * replayed into PGlite).
 *
 * ── THE HOLE THIS CLOSES ────────────────────────────────────────────────────
 * "NSFW filter is on by default and CANNOT be disabled" is a locked product
 * rule. The verdict for a couple-uploaded Save-the-Date video used to live in
 * `events.std_media` — a column the host MUST be able to write, because they
 * pick their own video. Postgres RLS is ROW-level, never column-level, and the
 * Supabase anon key is public, so:
 *
 *     PATCH /rest/v1/events?event_id=eq.<their-own-event>
 *     { "std_media": {"type":"video","videoKey":"r2://…","nsfw":"approved"} }
 *
 * published an unscreened video. The server action's refusal to accept a client
 * verdict was real but lived in the wrong layer — PostgREST does not run it.
 *
 * The fix moves the verdict to `events.std_media_nsfw`, withheld from
 * authenticated + anon, and BINDS it to the media it judged (keys + content
 * fingerprints — that half is proven in lib/std-media.test.ts, which does not
 * need a database). This file proves the privilege half, which text auditing
 * cannot: a real Postgres, `SET ROLE authenticated`, a real 42501.
 *
 * ── WHY THE `before` BLOCK REBUILDS THE PRIVILEGE STATE ─────────────────────
 * Two harness facts would otherwise make this suite pass vacuously:
 *
 *   1. replay-migrations.ts runs `GRANT ALL ON ALL TABLES IN SCHEMA public TO
 *      anon, authenticated, service_role` AFTER the replay loop (emulating the
 *      Supabase default privileges that fire at CREATE TABLE time). That blanket
 *      grant restores the table-level UPDATE/SELECT that 20271005100000 and
 *      20271007100000 revoked — so every column would be writable and readable.
 *   2. Simply re-running those two does NOT reproduce prod either: they recompute
 *      their allow-lists from the LIVE catalog, which by then contains
 *      std_media_nsfw, so they would GRANT the very column under test.
 *
 * So we reproduce the real ORDERING: drop the column, re-run both privilege
 * migrations (snapshots taken WITHOUT it, exactly as in prod), then run the
 * migration under test. All three are the REAL files, never reconstructions.
 *
 * ── WHY IT IS NOT VACUOUS ───────────────────────────────────────────────────
 *   • A META test asserts current_user is literally 'authenticated', holds no
 *     BYPASSRLS, and does not own public.events.
 *   • TRAP PROBES — two throwaway columns added after the snapshots and
 *     deliberately NOT granted — are asserted unwritable AND unreadable. That is
 *     what makes "std_media_nsfw is unwritable" attributable to the REVOKE and
 *     "std_media_nsfw is readable" attributable to the GRANT, rather than to the
 *     harness having handed everything back out.
 *   • A POSITIVE CONTROL: the same host, same session, still writes std_media
 *     and still reads the verdict. If the wiring were broken everything would
 *     fail and the denials would mean nothing.
 *   • A DIFFERENTIAL CONTROL: every statement asserted to fail as authenticated
 *     is re-run as service_role and asserted to SUCCEED.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import { MIGRATIONS_DIR, createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

const UPDATE_PRIVILEGE_MIGRATION = '20271005100000_events_column_update_privileges.sql';
const SELECT_PRIVILEGE_MIGRATION = '20271007100000_events_column_select_privileges.sql';
const VERDICT_MIGRATION = '20271007493007_events_std_media_nsfw_verdict.sql';

/** Columns added after the privilege snapshots that are deliberately NOT granted. */
const WRITE_TRAP_PROBE = 'sec6_write_trap_probe';
const READ_TRAP_PROBE = 'sec6_read_trap_probe';

const VIDEO_KEY = 'r2://setnayan-media/events/std-video/clean.mp4';
const POSTER_KEY = 'r2://setnayan-media/events/std-video-poster/poster.jpg';

const FORGED_VERDICT = JSON.stringify({
  status: 'approved',
  videoKey: VIDEO_KEY,
  posterKey: POSTER_KEY,
  videoFingerprint: 'forged:1',
  posterFingerprint: 'forged:1',
  screenedAt: '2026-07-26T00:00:00.000Z',
  attemptedAt: '2026-07-26T00:00:00.000Z',
});

let replay: ReplayResult;
let db: PGlite;

let hostUid: string;
let eventId: string;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}

async function asHost(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, hostUid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}

async function asAnon(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole('anon');
  await db.exec(`SET ROLE anon`);
}

async function asService(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole('service_role');
  await db.exec(`SET ROLE service_role`);
}

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

/** Run a statement, returning the error message (or null when it succeeded). */
async function tryQuery(sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return (e as Error).message ?? String(e);
  }
}

/** Read the stored verdict as the OWNER (never through a role under test). */
async function storedVerdict(): Promise<Record<string, unknown> | null> {
  await reset();
  const r = await db.query<{ v: Record<string, unknown> | null }>(
    `SELECT std_media_nsfw AS v FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  return r.rows[0]?.v ?? null;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();

  // Seed the event BEFORE the migration under test, carrying the LEGACY in-blob
  // verdict — that is the row shape the strip has to clean up.
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ('sec6-host@example.com') RETURNING id`,
  );
  hostUid = u.rows[0]!.id;

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, std_media)
     VALUES ('SEC-6 Event', 'birthday', $1::jsonb) RETURNING event_id`,
    [
      JSON.stringify({
        type: 'video',
        videoKey: VIDEO_KEY,
        posterKey: POSTER_KEY,
        // The forgery: a host-writable "approved" sitting inside std_media.
        nsfw: 'approved',
        fit: 'fill',
      }),
    ],
  );
  eventId = ev.rows[0]!.event_id;

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple') ON CONFLICT DO NOTHING`,
    [eventId, hostUid],
  );

  // Reproduce the prod ordering (see the header): the column must not exist when
  // the two privilege snapshots are taken.
  await db.exec(`ALTER TABLE public.events DROP COLUMN IF EXISTS std_media_nsfw;`);
  await db.exec(readFileSync(join(MIGRATIONS_DIR, UPDATE_PRIVILEGE_MIGRATION), 'utf8'));
  await db.exec(readFileSync(join(MIGRATIONS_DIR, SELECT_PRIVILEGE_MIGRATION), 'utf8'));

  // The controls: columns that land after the snapshots with no GRANT of their own.
  await db.exec(`ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ${WRITE_TRAP_PROBE} TEXT;`);
  await db.exec(`ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ${READ_TRAP_PROBE} TEXT;`);

  // …and now the migration under test.
  await db.exec(readFileSync(join(MIGRATIONS_DIR, VERDICT_MIGRATION), 'utf8'));
});

after(async () => {
  if (!db) return;
  await reset();
  await db.close?.();
});

// ── 0. Meta ─────────────────────────────────────────────────────────────────

test('META: the impersonated session is really `authenticated`, not the owner', async () => {
  await asHost();
  const r = await db.query<{ cu: string; bypass: boolean; owner: string }>(
    `SELECT current_user AS cu,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
            (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.events'::regclass) AS owner`,
  );
  const row = r.rows[0]!;
  assert.equal(row.cu, 'authenticated', 'SET ROLE did not take — every assertion below is vacuous');
  assert.equal(row.bypass, false, 'the authenticated role can BYPASSRLS — the suite is meaningless');
  assert.notEqual(row.owner, 'authenticated', 'authenticated owns public.events — grants would not apply');
  await reset();
});

test('META: the grant trap is really reproduced — un-granted new columns are dead in both directions', async () => {
  // If this passes, the harness matches prod: a column added after the two
  // privilege snapshots is neither writable nor readable unless a migration says
  // so. That is what makes the next two tests attributable to THIS migration.
  await asHost();
  const priv = await db.query<{ w: boolean; r: boolean }>(
    `SELECT has_column_privilege('authenticated','public.events',$1,'UPDATE') AS w,
            has_column_privilege('authenticated','public.events',$2,'SELECT') AS r`,
    [WRITE_TRAP_PROBE, READ_TRAP_PROBE],
  );
  assert.equal(
    priv.rows[0]!.w,
    false,
    'the write-probe is writable — the blanket GRANT ALL was not undone, so this suite proves nothing',
  );
  assert.equal(
    priv.rows[0]!.r,
    false,
    'the read-probe is readable — the SELECT snapshot was not reproduced, so the SELECT grant below proves nothing',
  );

  const err = await tryQuery(
    `UPDATE public.events SET ${WRITE_TRAP_PROBE} = 'x' WHERE event_id = $1`,
    [eventId],
  );
  assert.ok(err, 'an un-granted column was writable by a host');
  assert.match(err as string, /permission denied/i);
  await reset();
});

// ── 1. The lock: the host cannot set their own verdict ──────────────────────

test('a HOST cannot UPDATE std_media_nsfw (and service_role can)', async () => {
  await asHost();
  const priv = await db.query<{ u: boolean; i: boolean }>(
    `SELECT has_column_privilege('authenticated','public.events','std_media_nsfw','UPDATE') AS u,
            has_column_privilege('authenticated','public.events','std_media_nsfw','INSERT') AS i`,
  );
  assert.equal(priv.rows[0]!.u, false, 'the host holds UPDATE on the verdict — SEC-6 is open');
  assert.equal(priv.rows[0]!.i, false, 'the host holds INSERT on the verdict — the create-with-value vector is open');

  const err = await tryQuery(
    `UPDATE public.events SET std_media_nsfw = $2::jsonb WHERE event_id = $1`,
    [eventId, FORGED_VERDICT],
  );
  assert.ok(err, 'a host self-approved their own Save-the-Date video');
  assert.match(err as string, /permission denied/i);
  assert.equal(await storedVerdict(), null, 'the forged verdict landed anyway');

  // DIFFERENTIAL — the identical statement must work as service_role, so the
  // denial above is the REVOKE and not a typo'd column or a missing row.
  await asService();
  const svcErr = await tryQuery(
    `UPDATE public.events SET std_media_nsfw = $2::jsonb WHERE event_id = $1`,
    [eventId, FORGED_VERDICT],
  );
  assert.equal(svcErr, null, `service_role also failed (${svcErr}) — the denial above proves nothing`);

  // Put it back so later tests see a clean slate.
  await db.query(`UPDATE public.events SET std_media_nsfw = NULL WHERE event_id = $1`, [eventId]);
  await reset();
});

test('a HOST cannot INSERT a new event with a verdict already set', async () => {
  // An UPDATE-only lock is trivially defeated by POSTing a fresh event with the
  // flag pre-set (the 20270920020000 INSERT-vector lesson).
  await asHost();
  const err = await tryQuery(
    `INSERT INTO public.events (display_name, event_type, std_media_nsfw)
     VALUES ('Pre-approved', 'birthday', $1::jsonb)`,
    [FORGED_VERDICT],
  );
  assert.ok(err, 'a host created an event with an approved verdict baked in');
  assert.match(err as string, /permission denied/i);
  await reset();
});

test('ANON cannot UPDATE std_media_nsfw either', async () => {
  await asAnon();
  const priv = await db.query<{ u: boolean; i: boolean }>(
    `SELECT has_column_privilege('anon','public.events','std_media_nsfw','UPDATE') AS u,
            has_column_privilege('anon','public.events','std_media_nsfw','INSERT') AS i`,
  );
  assert.equal(priv.rows[0]!.u, false, 'anon holds UPDATE on the verdict');
  assert.equal(priv.rows[0]!.i, false, 'anon holds INSERT on the verdict');

  const err = await tryQuery(
    `UPDATE public.events SET std_media_nsfw = $2::jsonb WHERE event_id = $1`,
    [eventId, FORGED_VERDICT],
  );
  assert.ok(err, 'the public anon key could approve a wedding video');
  assert.match(err as string, /permission denied/i);
  assert.equal(await storedVerdict(), null, 'the anon write changed the stored verdict');
});

// ── 2. The product must still work ──────────────────────────────────────────

test('a HOST can still write std_media and READ the verdict (positive control)', async () => {
  await asHost();

  // The couple picking their own video is the flow this fix must NOT break.
  const err = await tryQuery(
    `UPDATE public.events SET std_media = $2::jsonb WHERE event_id = $1`,
    [
      eventId,
      JSON.stringify({ type: 'video', videoKey: VIDEO_KEY, posterKey: POSTER_KEY, fit: 'fit' }),
    ],
  );
  assert.equal(err, null, `the couple's own media choice was rejected: ${err}`);

  // …and the builder badge ("your video is being reviewed") needs the read.
  const canRead = await db.query<{ r: boolean }>(
    `SELECT has_column_privilege('authenticated','public.events','std_media_nsfw','SELECT') AS r`,
  );
  assert.equal(canRead.rows[0]!.r, true, 'the couple cannot read their own screening status');

  const readErr = await tryQuery(
    `SELECT std_media, std_media_nsfw FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(readErr, null, `the builder's own read was rejected: ${readErr}`);
  await reset();
});

test('the media column is NOT locked — locking it would break the picker', async () => {
  // The fix deliberately leaves std_media host-writable. If a future edit locks
  // it "for safety", the couple can no longer choose a video at all.
  const r = await db.query<{ u: boolean; s: boolean }>(
    `SELECT has_column_privilege('authenticated','public.events','std_media','UPDATE') AS u,
            has_column_privilege('authenticated','public.events','std_media','SELECT') AS s`,
  );
  assert.equal(r.rows[0]!.u, true, 'std_media lost its host UPDATE grant — the video picker is dead');
  assert.equal(r.rows[0]!.s, true, 'std_media lost its host SELECT grant — the builder cannot load');
});

// ── 3. The legacy in-blob verdict is gone ───────────────────────────────────

test('the migration STRIPPED the legacy std_media.nsfw key and backfilled no verdict', async () => {
  await reset();
  const r = await db.query<{ media: Record<string, unknown>; verdict: unknown; had: boolean }>(
    `SELECT std_media AS media, std_media_nsfw AS verdict, (std_media ? 'nsfw') AS had
       FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  const row = r.rows[0]!;
  assert.equal(row.had, false, 'the forged in-blob nsfw key survived the migration');
  assert.equal(
    row.verdict,
    null,
    'the migration backfilled a verdict — a pre-existing forgery would have been blessed',
  );
  // The rest of the media choice must be intact: only the verdict key left.
  assert.equal(row.media.type, 'video');
  assert.equal(row.media.videoKey, VIDEO_KEY);

  // …and no OTHER row kept one either.
  const leftovers = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.events WHERE std_media ? 'nsfw'`,
  );
  assert.equal(leftovers.rows[0]!.n, 0, 'some events row still carries a host-writable nsfw verdict');
});

// ── 4. Re-applying the migration is safe ────────────────────────────────────

test('the migration is idempotent (db push may re-run it)', async () => {
  await reset();
  // Simulate a verdict written by the screen, then re-apply. It must survive and
  // the post-conditions must still hold.
  await db.query(`UPDATE public.events SET std_media_nsfw = $2::jsonb WHERE event_id = $1`, [
    eventId,
    FORGED_VERDICT,
  ]);
  // db.exec (not db.query) — the migration is a multi-statement script.
  let err: string | null = null;
  try {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, VERDICT_MIGRATION), 'utf8'));
  } catch (e) {
    err = (e as Error).message ?? String(e);
  }
  assert.equal(err, null, `re-applying the migration failed: ${err}`);
  const after = await storedVerdict();
  assert.ok(after, 're-applying the migration wiped a legitimate verdict');
  await db.query(`UPDATE public.events SET std_media_nsfw = NULL WHERE event_id = $1`, [eventId]);
});

// ── 5. D18 — the grant-independent lock ─────────────────────────────────────
//
// The REVOKE is the primary control, and the tests above prove it. But it is a
// GRANT, and 20271005100000 recomputes the grants on this table from the LIVE
// catalog as "every column MINUS a hard-coded deny-set". std_media_nsfw cannot
// be added to that deny-set (the file predates the column; its typo guard RAISEs
// on a name that does not exist yet), so RE-APPLYING that baseline hands UPDATE
// straight back and re-opens SEC-6 in silence.
//
// So the migration also installs guard_events_std_media_nsfw_trg. These tests
// restore the grant on purpose — reproducing the regression exactly — and assert
// the write STILL fails, with the service_role differential to prove the
// statement itself is fine.

test('D18 REGRESSION: even WITH the column grant restored, a host cannot write the verdict', async () => {
  await reset();
  // Reproduce the trap: hand authenticated + anon the privilege back.
  await db.exec(
    `GRANT UPDATE (std_media_nsfw), INSERT (std_media_nsfw) ON public.events TO authenticated, anon;`,
  );

  await asHost();
  // The grant really landed — otherwise this test would be the earlier one again.
  const priv = await db.query<{ u: boolean }>(
    `SELECT has_column_privilege('authenticated','public.events','std_media_nsfw','UPDATE') AS u`,
  );
  assert.equal(
    priv.rows[0]!.u,
    true,
    'the re-GRANT did not take — this test is not reproducing the D18 regression',
  );

  const err = await tryQuery(
    `UPDATE public.events SET std_media_nsfw = $2::jsonb WHERE event_id = $1`,
    [eventId, FORGED_VERDICT],
  );
  assert.ok(err, 'a re-applied privilege baseline re-opened SEC-6');
  assert.match(
    err as string,
    /written only by the screening service/i,
    `expected the trigger to refuse, got: ${err}`,
  );
  assert.equal(await storedVerdict(), null, 'the forged verdict landed anyway');

  // INSERT vector, same conditions.
  await asHost();
  const insErr = await tryQuery(
    `INSERT INTO public.events (display_name, event_type, std_media_nsfw)
     VALUES ('Pre-approved despite grant', 'birthday', $1::jsonb)`,
    [FORGED_VERDICT],
  );
  assert.ok(insErr, 'a host created a pre-approved event once the grant was back');
  assert.match(insErr as string, /written only by the screening service/i);

  // ANON too. Note the DIFFERENT mechanism: anon sees no rows on public.events
  // (RLS), so its UPDATE matches nothing and "succeeds" against zero rows rather
  // than reaching the trigger. Assert the OUTCOME — no verdict lands — which is
  // the property that matters and is true either way.
  await asAnon();
  await tryQuery(`UPDATE public.events SET std_media_nsfw = $2::jsonb WHERE event_id = $1`, [
    eventId,
    FORGED_VERDICT,
  ]);
  assert.equal(
    await storedVerdict(),
    null,
    'the public anon key wrote a verdict once the grant was back',
  );
  // …and the INSERT vector, which anon CAN reach (no row to be hidden by RLS),
  // is stopped by the trigger itself.
  await asAnon();
  const anonInsErr = await tryQuery(
    `INSERT INTO public.events (display_name, event_type, std_media_nsfw)
     VALUES ('Anon pre-approved', 'birthday', $1::jsonb)`,
    [FORGED_VERDICT],
  );
  assert.ok(anonInsErr, 'anon inserted an event with a verdict baked in');

  // DIFFERENTIAL — service_role, same statement, must succeed. Without this the
  // refusals above could be a broken statement rather than an enforced guard.
  await asService();
  const svcErr = await tryQuery(
    `UPDATE public.events SET std_media_nsfw = $2::jsonb WHERE event_id = $1`,
    [eventId, FORGED_VERDICT],
  );
  assert.equal(svcErr, null, `service_role also failed (${svcErr}) — the refusals prove nothing`);

  // NON-VACUITY of the trigger itself: drop it, re-run the identical host
  // statement under the identical grant, and watch it SUCCEED. If this write
  // were failing for any other reason, it would fail here too.
  await reset();
  await db.exec(`DROP TRIGGER IF EXISTS guard_events_std_media_nsfw_trg ON public.events;`);
  await db.query(`UPDATE public.events SET std_media_nsfw = NULL WHERE event_id = $1`, [eventId]);
  await asHost();
  const unguarded = await tryQuery(
    `UPDATE public.events SET std_media_nsfw = $2::jsonb WHERE event_id = $1`,
    [eventId, FORGED_VERDICT],
  );
  assert.equal(
    unguarded,
    null,
    'with the trigger dropped AND the grant restored the write still failed — the assertions above are not measuring the trigger',
  );
  assert.ok(await storedVerdict(), 'the unguarded write did not land — non-vacuity unproven');

  // Restore prod state for anything that runs after this file.
  await reset();
  await db.exec(`
    CREATE TRIGGER guard_events_std_media_nsfw_trg
      BEFORE INSERT OR UPDATE ON public.events
      FOR EACH ROW EXECUTE FUNCTION public.guard_events_std_media_nsfw();
    REVOKE UPDATE (std_media_nsfw), INSERT (std_media_nsfw)
      ON public.events FROM authenticated, anon;
  `);
  await db.query(`UPDATE public.events SET std_media_nsfw = NULL WHERE event_id = $1`, [eventId]);
});

test('D18 the guard does NOT preserve an old verdict — it refuses the statement', async () => {
  // The rejected design was "on UPDATE, keep the OLD nsfw value", which PINS an
  // approval onto media swapped underneath it. Prove this trigger is the other
  // thing: with a verdict present, a host UPDATE that touches it ERRORS (the
  // whole statement is lost), and a host UPDATE that does not touch it succeeds
  // with the verdict untouched — no silent carry-forward, no pinning.
  await reset();
  await db.query(`UPDATE public.events SET std_media_nsfw = $2::jsonb WHERE event_id = $1`, [
    eventId,
    FORGED_VERDICT,
  ]);
  await db.exec(
    `GRANT UPDATE (std_media_nsfw) ON public.events TO authenticated;`,
  );

  await asHost();
  const err = await tryQuery(
    `UPDATE public.events
        SET display_name = 'Renamed', std_media_nsfw = '{"status":"approved"}'::jsonb
      WHERE event_id = $1`,
    [eventId],
  );
  assert.ok(err, 'the multi-column write slipped a forged verdict through');
  await reset();
  const name = await db.query<{ n: string }>(
    `SELECT display_name AS n FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  assert.notEqual(
    name.rows[0]!.n,
    'Renamed',
    'the statement was NOT rejected — the guard silently preserved the column instead, which is the pinning design this migration refuses',
  );

  // An ordinary host edit that leaves the verdict alone still works.
  await asHost();
  const ok = await tryQuery(
    `UPDATE public.events SET display_name = 'Ordinary Edit' WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(ok, null, `an ordinary host edit was blocked by the guard: ${ok}`);

  await reset();
  const kept = await storedVerdict();
  assert.ok(kept, 'the ordinary edit dropped the verdict');
  await db.exec(
    `REVOKE UPDATE (std_media_nsfw) ON public.events FROM authenticated;`,
  );
  await db.query(`UPDATE public.events SET std_media_nsfw = NULL WHERE event_id = $1`, [eventId]);
});
