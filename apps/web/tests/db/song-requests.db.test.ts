/**
 * Guest song requests — END-TO-END DB verification (migrations replayed).
 *
 * Covers 20271014090000_guest_song_requests. Every claim this feature makes is
 * a boundary, so each is asserted against real SQL rather than mocked:
 *
 *   • the REVOKE is load-bearing — `anon` holds NO privilege on the table,
 *     which matters because every new relation in `public` ships OPEN here;
 *   • there is NO INSERT policy — the only write path is the service-role RPCs,
 *     because a requester on either lane may have no account at all;
 *   • both submit RPCs are UNCALLABLE by anon and authenticated (naming the
 *     roles, not just PUBLIC — the 2026-07-26 lesson);
 *   • the bar lane's authorisation really is the scanned token: a wrong token
 *     inserts nothing;
 *   • the shared guest block lever silences song requests too, or the lever has
 *     a hole;
 *   • the rate caps actually bite, per lane;
 *   • one song = one row, so a room asking for the same track is one decision.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

let eventId: string;
let guestId: string;
let vendorProfileId: string;
const MASTER_TOKEN = 'master-qr-token-for-the-bar-night';
const ANON_KEY = 'a'.repeat(32);

/**
 * The act pauses or resumes its requests.
 *
 * ⚠ THIS INVERTED ON 2026-07-30 (owner-locked, migration 20271020224218).
 * Requests are ALWAYS ON and `song_requests_open` means **not paused**, so
 * `false` is a pause the act applies on the night rather than a window it never
 * opened. Tests that expect a request to LAND no longer need to open anything;
 * tests that expect a refusal must pause explicitly. Section 8 asserts the
 * always-on semantics themselves.
 */
async function setWindow(open: boolean) {
  await db.query(
    `UPDATE public.vendor_dayof_configs SET song_requests_open = $1
     WHERE vendor_profile_id = $2 AND event_id = $3`,
    [open, vendorProfileId, eventId],
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, master_qr_token)
     VALUES ('Bar Night', 'gala_night', $1) RETURNING event_id`,
    [MASTER_TOKEN],
  );
  eventId = ev.rows[0]!.event_id;

  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Maria', 'Santos', 'bride', 'friends') RETURNING guest_id`,
    [eventId],
  );
  guestId = g.rows[0]!.guest_id;

  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (business_name) VALUES ('Saysay Live Band')
     RETURNING vendor_profile_id`,
  );
  vendorProfileId = vp.rows[0]!.vendor_profile_id;

  // The act's day-of config row for this booking. We deliberately do NOT set
  // song_requests_open — the column's own default is what section 8 asserts,
  // and that default flipped to TRUE (always-on) on 2026-07-30.
  await db.query(
    `INSERT INTO public.vendor_dayof_configs (vendor_profile_id, event_id) VALUES ($1,$2)`,
    [vendorProfileId, eventId],
  );
});

after(async () => {
  await replay?.db?.close?.();
});

/** Clear the stream AND open the window — the state most tests are about. The
 *  window itself is asserted separately in section 6. */
async function reset() {
  await db.exec(`DELETE FROM public.event_song_requests`);
  await setWindow(true);
}

// ─── 1 · The exposure boundary ──────────────────────────────────────────────

test('anon holds NO privilege on event_song_requests (the REVOKE is load-bearing)', async () => {
  const r = await db.query<{ priv: string }>(
    `SELECT privilege_type AS priv FROM information_schema.role_table_grants
     WHERE table_schema='public' AND table_name='event_song_requests' AND grantee='anon'`,
  );
  assert.deepEqual(r.rows, [], 'anon must hold nothing — the default ACL grants arwdDxtm');
});

test('there is NO INSERT policy — the RPCs are the only write path', async () => {
  const r = await db.query<{ cmd: string }>(
    `SELECT CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                            WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
                            WHEN '*' THEN 'ALL' END AS cmd
     FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
     WHERE c.relname = 'event_song_requests'`,
  );
  const cmds = r.rows.map((x) => x.cmd).sort();
  assert.deepEqual(cmds, ['SELECT', 'UPDATE'], 'only read + decide; never INSERT/DELETE');
});

test('neither submit RPC is callable by anon or authenticated', async () => {
  for (const fn of ['guest_submit_song_request', 'open_submit_song_request', 'resolve_song_id']) {
    for (const role of ['anon', 'authenticated']) {
      const r = await db.query<{ ok: boolean }>(
        `SELECT has_function_privilege($1, p.oid, 'EXECUTE') AS ok
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname='public' AND p.proname = $2`,
        [role, fn],
      );
      for (const row of r.rows) {
        assert.equal(row.ok, false, `${role} must NOT be able to EXECUTE ${fn}`);
      }
    }
  }
});

// ─── 2 · The bar lane: the scanned token IS the authorisation ───────────────

test('a walk-in with the right master QR token lands a request', async () => {
  await reset();
  const r = await db.query<{ origin: string; status: string; anon_key: string }>(
    `SELECT origin, status, anon_key FROM public.open_submit_song_request($1,$2,$3,$4,$5)`,
    [MASTER_TOKEN, ANON_KEY, 'Kiss the Rain', 'Yiruma', 'Maria'],
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.origin, 'open');
  assert.equal(r.rows[0]!.status, 'pending');
  assert.equal(r.rows[0]!.anon_key, ANON_KEY);
});

test('a WRONG token inserts nothing — the token is the boundary, not the UI', async () => {
  await reset();
  await assert.rejects(
    () =>
      db.query(`SELECT * FROM public.open_submit_song_request($1,$2,$3,$4,$5)`, [
        'not-the-real-token',
        ANON_KEY,
        'Anak',
        'Freddie Aguilar',
        null,
      ]),
    /songreq:unknown_event/,
  );
  const c = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_song_requests`,
  );
  assert.equal(c.rows[0]!.n, 0);
});

test('the open lane rate-limits a single device (3 per hour)', async () => {
  await reset();
  for (const t of ['Song A', 'Song B', 'Song C']) {
    await db.query(`SELECT * FROM public.open_submit_song_request($1,$2,$3,$4,$5)`, [
      MASTER_TOKEN, ANON_KEY, t, '', null,
    ]);
  }
  await assert.rejects(
    () =>
      db.query(`SELECT * FROM public.open_submit_song_request($1,$2,$3,$4,$5)`, [
        MASTER_TOKEN, ANON_KEY, 'Song D', '', null,
      ]),
    /songreq:rate_limited/,
  );
});

test('a DIFFERENT device is not punished for the first one hitting the cap', async () => {
  await reset();
  for (const t of ['S1', 'S2', 'S3']) {
    await db.query(`SELECT * FROM public.open_submit_song_request($1,$2,$3,$4,$5)`, [
      MASTER_TOKEN, ANON_KEY, t, '', null,
    ]);
  }
  const other = 'b'.repeat(32);
  const r = await db.query<{ origin: string }>(
    `SELECT origin FROM public.open_submit_song_request($1,$2,$3,$4,$5)`,
    [MASTER_TOKEN, other, 'S4', '', null],
  );
  assert.equal(r.rows.length, 1, 'a second phone must still be able to ask');
});

// ─── 3 · The wedding lane ──────────────────────────────────────────────────

test('a real guest lands a request on the guest lane', async () => {
  await reset();
  const r = await db.query<{ origin: string; guest_id: string; status: string }>(
    `SELECT origin, guest_id, status FROM public.guest_submit_song_request($1,$2,$3,$4)`,
    [guestId, 'Perfect', 'Ed Sheeran', null],
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.origin, 'guest');
  assert.equal(r.rows[0]!.guest_id, guestId);
  assert.equal(r.rows[0]!.status, 'pending');
});

test('an unknown guest id is refused', async () => {
  await reset();
  await assert.rejects(
    () =>
      db.query(`SELECT * FROM public.guest_submit_song_request($1,$2,$3,$4)`, [
        '00000000-0000-0000-0000-000000000000', 'Perfect', '', null,
      ]),
    /songreq:unknown_guest/,
  );
});

test('the SHARED block lever silences song requests too (no hole in the lever)', async () => {
  await reset();
  await db.query(
    `INSERT INTO public.guest_message_blocks (event_id, guest_id) VALUES ($1,$2)`,
    [eventId, guestId],
  );
  await assert.rejects(
    () =>
      db.query(`SELECT * FROM public.guest_submit_song_request($1,$2,$3,$4)`, [
        guestId, 'Anything', '', null,
      ]),
    /songreq:blocked/,
  );
  await db.query(`DELETE FROM public.guest_message_blocks WHERE guest_id=$1`, [guestId]);
});

// ─── 4 · One song, one decision ────────────────────────────────────────────

test('a room asking for the SAME song is one row, not two hundred', async () => {
  await reset();
  await db.query(`SELECT * FROM public.guest_submit_song_request($1,$2,$3,$4)`, [
    guestId, 'Through the Years', 'Kenny Rogers', null,
  ]);
  // A different person, same song — must not create a second row for the act.
  await db.query(`SELECT * FROM public.open_submit_song_request($1,$2,$3,$4,$5)`, [
    MASTER_TOKEN, ANON_KEY, 'Through the Years', 'Kenny Rogers', null,
  ]);
  const c = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_song_requests`,
  );
  assert.equal(c.rows[0]!.n, 1);
});

test('the same title in different casing/spacing is the SAME song', async () => {
  await reset();
  await db.query(`SELECT * FROM public.guest_submit_song_request($1,$2,$3,$4)`, [
    guestId, 'Kiss The Rain', 'Yiruma', null,
  ]);
  await db.query(`SELECT * FROM public.open_submit_song_request($1,$2,$3,$4,$5)`, [
    MASTER_TOKEN, ANON_KEY, '  kiss the rain  ', 'yiruma', null,
  ]);
  const c = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_song_requests`,
  );
  assert.equal(c.rows[0]!.n, 1, 'normalized_key must collapse these');
});

// ─── 5 · The lane-identity constraint ──────────────────────────────────────

test('a row cannot forge a lane it does not own', async () => {
  await reset();
  const songId = (
    await db.query<{ id: string }>(`SELECT public.resolve_song_id('X','Y') AS id`)
  ).rows[0]!.id;

  // guest lane carrying an anon_key
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_song_requests (event_id, song_id, origin, guest_id, anon_key)
         VALUES ($1,$2,'guest',$3,$4)`,
        [eventId, songId, guestId, ANON_KEY],
      ),
    /event_song_requests_lane_identity/,
  );

  // open lane with no anon_key
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_song_requests (event_id, song_id, origin)
         VALUES ($1,$2,'open')`,
        [eventId, songId],
      ),
    /event_song_requests_lane_identity/,
  );
});

test('a decision must carry its timestamp', async () => {
  await reset();
  const songId = (
    await db.query<{ id: string }>(`SELECT public.resolve_song_id('Z','W') AS id`)
  ).rows[0]!.id;
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_song_requests (event_id, song_id, origin, anon_key, status)
         VALUES ($1,$2,'open',$3,'accepted')`,
        [eventId, songId, ANON_KEY],
      ),
    /event_song_requests_decided_together/,
  );
});

// ─── 6 · The pause — the act silences the room and reopens it ───────────────
// Owner 2026-07-27: "the band will open or close accepting requests."
// ⚠ SUPERSEDED IN PART, 2026-07-30: requests are always on, so what is left of
// that lock is the PAUSE. These tests keep asserting the refusal path; what
// changed is that a paused state now has to be asked for. Section 8 owns the
// always-on half.

test('A PAUSED ROOM receives nothing on either lane', async () => {
  await db.exec(`DELETE FROM public.event_song_requests`);
  await setWindow(false); // a deliberate pause — no longer the default

  await assert.rejects(
    () =>
      db.query(`SELECT * FROM public.guest_submit_song_request($1,$2,$3,$4)`, [
        guestId, 'Perfect', 'Ed Sheeran', null,
      ]),
    /songreq:closed/,
    'the wedding lane must refuse a closed room',
  );
  await assert.rejects(
    () =>
      db.query(`SELECT * FROM public.open_submit_song_request($1,$2,$3,$4,$5)`, [
        MASTER_TOKEN, ANON_KEY, 'Perfect', 'Ed Sheeran', null,
      ]),
    /songreq:closed/,
    'the bar lane must refuse a closed room',
  );

  const c = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_song_requests`,
  );
  assert.equal(c.rows[0]!.n, 0, 'a paused room stores nothing');
});

test('the act RESUMES and requests start landing again', async () => {
  await db.exec(`DELETE FROM public.event_song_requests`);
  await setWindow(true);
  const r = await db.query<{ status: string }>(
    `SELECT status FROM public.guest_submit_song_request($1,$2,$3,$4)`,
    [guestId, 'Anak', 'Freddie Aguilar', null],
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.status, 'pending');
});

test('the act PAUSES mid-night and the room goes quiet', async () => {
  await db.exec(`DELETE FROM public.event_song_requests`);
  await setWindow(true);
  await db.query(`SELECT * FROM public.guest_submit_song_request($1,$2,$3,$4)`, [
    guestId, 'Before The Break', '', null,
  ]);
  await setWindow(false);
  await assert.rejects(
    () =>
      db.query(`SELECT * FROM public.guest_submit_song_request($1,$2,$3,$4)`, [
        guestId, 'During The Break', '', null,
      ]),
    /songreq:closed/,
  );
  // Pausing does NOT retract what was already asked — the act still owes those
  // a decision.
  const c = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_song_requests`,
  );
  assert.equal(c.rows[0]!.n, 1);
});

test('"paused" is reported BEFORE "blocked" or "rate limited" — a quiet room says so first', async () => {
  await db.exec(`DELETE FROM public.event_song_requests`);
  await setWindow(false);
  await db.query(
    `INSERT INTO public.guest_message_blocks (event_id, guest_id) VALUES ($1,$2)`,
    [eventId, guestId],
  );
  // Blocked AND closed → the guest hears the honest, impersonal reason.
  await assert.rejects(
    () =>
      db.query(`SELECT * FROM public.guest_submit_song_request($1,$2,$3,$4)`, [
        guestId, 'Anything', '', null,
      ]),
    /songreq:closed/,
  );
  await db.query(`DELETE FROM public.guest_message_blocks WHERE guest_id=$1`, [guestId]);
});

test('the PAUSE is per-EVENT reach: pausing here must not silence another event', async () => {
  // ⚠ This test's premise REVERSED on 2026-07-30. It used to assert that an
  // unconfigured event reads CLOSED ("opening one act's window must not open the
  // whole platform"). Under always-on an unconfigured event reads OPEN, so the
  // per-event claim has to be proven from the other side: a pause here leaves
  // another event alone. Same property, opposite polarity — and the old
  // assertion failing is exactly how we know the semantics really moved.
  await db.exec(`DELETE FROM public.event_song_requests`);
  await setWindow(false);

  const other = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, master_qr_token)
     VALUES ('Another Night', 'gala_night', 'a-different-master-token')
     RETURNING event_id`,
  );
  const otherId = other.rows[0]!.event_id;

  const openHere = await db.query<{ ok: boolean }>(
    `SELECT public.song_requests_open_for_event($1) AS ok`, [eventId]);
  const openThere = await db.query<{ ok: boolean }>(
    `SELECT public.song_requests_open_for_event($1) AS ok`, [otherId]);

  assert.equal(openHere.rows[0]!.ok, false, 'the paused event is the one that goes quiet');
  assert.equal(
    openThere.rows[0]!.ok,
    true,
    'one act’s pause must not silence every other event on the platform',
  );

  await db.query(`DELETE FROM public.events WHERE event_id=$1`, [otherId]);
  await setWindow(true);
});

test('the gate helper is not callable by anon or authenticated', async () => {
  for (const role of ['anon', 'authenticated']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_function_privilege($1, p.oid, 'EXECUTE') AS ok
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname='public' AND p.proname = 'song_requests_open_for_event'`,
      [role],
    );
    for (const row of r.rows) assert.equal(row.ok, false, `${role} must not EXECUTE the gate`);
  }
});

// ─── 7 · The window is a PAID switch (20271020159662) ───────────────────────
//
// Opening the window is the song_desk specialization, which is sold from tier
// `solo` up. RLS on vendor_dayof_configs is row-level and can only ask "is this
// your row" — so the column privilege is what stops a free-tier band PATCHing
// `song_requests_open` straight through PostgREST. These tests are that claim.

test('authenticated cannot WRITE song_requests_open, by either verb', async () => {
  for (const priv of ['INSERT', 'UPDATE']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_column_privilege('authenticated', 'public.vendor_dayof_configs',
                                   'song_requests_open', $1) AS ok`,
      [priv],
    );
    assert.equal(
      r.rows[0]!.ok,
      false,
      `authenticated must NOT hold ${priv} on song_requests_open — it is the paid switch`,
    );
  }
});

test('authenticated can still READ its own switch — reading it is not the sale', async () => {
  const r = await db.query<{ ok: boolean }>(
    `SELECT has_column_privilege('authenticated', 'public.vendor_dayof_configs',
                                 'song_requests_open', 'SELECT') AS ok`,
  );
  assert.equal(r.rows[0]!.ok, true);
});

test('the module override still writes — the fix must not break the configurator', async () => {
  for (const col of ['enabled_modules', 'updated_at', 'vendor_profile_id', 'event_id']) {
    for (const priv of ['INSERT', 'UPDATE']) {
      const r = await db.query<{ ok: boolean }>(
        `SELECT has_column_privilege('authenticated', 'public.vendor_dayof_configs', $1, $2) AS ok`,
        [col, priv],
      );
      assert.equal(r.rows[0]!.ok, true, `authenticated lost ${priv} on ${col}`);
    }
  }
});

test('service_role keeps the write — it is the only path the gated action has', async () => {
  const r = await db.query<{ ok: boolean }>(
    `SELECT has_column_privilege('service_role', 'public.vendor_dayof_configs',
                                 'song_requests_open', 'UPDATE') AS ok`,
  );
  assert.equal(r.rows[0]!.ok, true);
});

test('anon holds nothing on vendor_dayof_configs at all', async () => {
  const r = await db.query<{ priv: string }>(
    `SELECT privilege_type AS priv FROM information_schema.role_table_grants
     WHERE table_schema='public' AND table_name='vendor_dayof_configs' AND grantee='anon'`,
  );
  assert.deepEqual(r.rows, [], 'anon must hold nothing on the act’s day-of config');
});

// ─── 8 · ALWAYS ON, AND THE PAYWALL MOVED TO THE INBOX ─────────────────────
//
// Owner-locked 2026-07-30, migration 20271020224218. Two changes, both of which
// reverse something that shipped days or hours earlier, so both are pinned here:
//
//   1. ALWAYS ON. Requests no longer wait for an act to open a window. The hard
//      part is not the column DEFAULT — it is that `vendor_dayof_configs` is
//      SPARSE, so most events have NO ROW for a default to apply to. A change
//      that only flipped the default would leave every unconfigured event shut
//      while claiming to be always-on; §8.1 is that distinction.
//   2. THE PAYWALL MOVED. "Seeing the requests" is the paid part, so the
//      booked-vendor leg came OFF both policies — booked is not paid, and RLS is
//      row-level so it cannot ask the paid question. The act now reads through an
//      entitlement-checked service_role action. §8.2 asserts the leg is gone,
//      which is the security claim of the whole PR.

// ── 8.1 · always on ────────────────────────────────────────────────────────

test('an event NOBODY has configured is OPEN — this is what always-on means', async () => {
  const fresh = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, master_qr_token)
     VALUES ('Unconfigured Night', 'gala_night', 'token-for-the-unconfigured-night')
     RETURNING event_id`,
  );
  const freshId = fresh.rows[0]!.event_id;

  const open = await db.query<{ ok: boolean }>(
    `SELECT public.song_requests_open_for_event($1) AS ok`, [freshId]);
  assert.equal(
    open.rows[0]!.ok,
    true,
    'no config row must read as OPEN — a sparse table means most events never have one',
  );

  await db.query(`DELETE FROM public.events WHERE event_id=$1`, [freshId]);
});

test('a FRESH config row is open — the column default carries always-on too', async () => {
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (business_name) VALUES ('Second Act')
     RETURNING vendor_profile_id`,
  );
  const otherVendor = vp.rows[0]!.vendor_profile_id;

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, master_qr_token)
     VALUES ('Default Night', 'gala_night', 'token-for-the-default-night')
     RETURNING event_id`,
  );
  const evId = ev.rows[0]!.event_id;

  // Insert WITHOUT naming the column — the default is the subject of the test.
  await db.query(
    `INSERT INTO public.vendor_dayof_configs (vendor_profile_id, event_id) VALUES ($1,$2)`,
    [otherVendor, evId],
  );
  const row = await db.query<{ song_requests_open: boolean }>(
    `SELECT song_requests_open FROM public.vendor_dayof_configs
     WHERE vendor_profile_id=$1 AND event_id=$2`,
    [otherVendor, evId],
  );
  assert.equal(row.rows[0]!.song_requests_open, true, 'DEFAULT TRUE = not paused');

  await db.query(`DELETE FROM public.events WHERE event_id=$1`, [evId]);
  await db.query(`DELETE FROM public.vendor_profiles WHERE vendor_profile_id=$1`, [otherVendor]);
});

test('a guest can ask WITHOUT any act ever touching a setting', async () => {
  // The end-to-end shape of always-on: no config row anywhere, and the wedding
  // lane still accepts. Previously this raised songreq:closed.
  await db.exec(`DELETE FROM public.event_song_requests`);
  await db.query(
    `DELETE FROM public.vendor_dayof_configs WHERE vendor_profile_id=$1 AND event_id=$2`,
    [vendorProfileId, eventId],
  );

  const r = await db.query<{ status: string }>(
    `SELECT status FROM public.guest_submit_song_request($1,$2,$3,$4)`,
    [guestId, 'No Setup Needed', '', null],
  );
  assert.equal(r.rows.length, 1, 'always-on means the room is live with zero configuration');
  assert.equal(r.rows[0]!.status, 'pending');

  // Restore the row the rest of the suite shares.
  await db.query(
    `INSERT INTO public.vendor_dayof_configs (vendor_profile_id, event_id) VALUES ($1,$2)`,
    [vendorProfileId, eventId],
  );
});

test('A PAUSE BY ANY ACT PAUSES THE ROOM — the documented two-act trade-off', async () => {
  // Pinned because it is a DECISION, not an accident: the inbox is per-event
  // while the pause is per-(vendor × event), so two acts can disagree. We chose
  // "any pause wins" because over-pausing disappoints a guest while
  // under-pausing floods a band that explicitly asked for silence. If this test
  // ever needs to change, the inbox has to split per-act first.
  await db.exec(`DELETE FROM public.event_song_requests`);
  await setWindow(true);

  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (business_name) VALUES ('String Quartet')
     RETURNING vendor_profile_id`,
  );
  const quartet = vp.rows[0]!.vendor_profile_id;
  await db.query(
    `INSERT INTO public.vendor_dayof_configs (vendor_profile_id, event_id, song_requests_open)
     VALUES ($1,$2,FALSE)`,
    [quartet, eventId],
  );

  const open = await db.query<{ ok: boolean }>(
    `SELECT public.song_requests_open_for_event($1) AS ok`, [eventId]);
  assert.equal(open.rows[0]!.ok, false, 'one act pausing pauses the room');

  await db.query(`DELETE FROM public.vendor_dayof_configs WHERE vendor_profile_id=$1`, [quartet]);
  await db.query(`DELETE FROM public.vendor_profiles WHERE vendor_profile_id=$1`, [quartet]);

  const reopened = await db.query<{ ok: boolean }>(
    `SELECT public.song_requests_open_for_event($1) AS ok`, [eventId]);
  assert.equal(reopened.rows[0]!.ok, true, 'and removing that pause reopens it');
});

// ── 8.2 · the paywall moved: booked is NOT paid ────────────────────────────

test('NEITHER request policy gates on booked-vendor any more — booked is not paid', async () => {
  // THE security assertion of this PR. `current_vendor_booked_event_ids()` asks
  // "are you booked", which every free-tier band on the event satisfies. With the
  // open/close switch retired as the sale, that predicate would have handed them
  // the inbox we just decided to charge for — the same class of hole PR #3876
  // closed on the column privilege, one table over.
  const r = await db.query<{ policyname: string; qual: string | null; withcheck: string | null }>(
    `SELECT policyname, qual, with_check AS withcheck FROM pg_policies
     WHERE schemaname='public' AND tablename='event_song_requests'`,
  );
  assert.ok(r.rows.length >= 2, 'both the read and decide policies must still exist');
  for (const row of r.rows) {
    const text = `${row.qual ?? ''} ${row.withcheck ?? ''}`;
    assert.ok(
      !text.includes('current_vendor_booked_event_ids'),
      `${row.policyname} still gates on booked-vendor — the paid check cannot live in RLS`,
    );
  }
});

test('the host still reads their own room, and admin still oversees', async () => {
  // The narrowing must not have taken the two legitimate legs with it.
  const r = await db.query<{ policyname: string; qual: string | null }>(
    `SELECT policyname, qual FROM pg_policies
     WHERE schemaname='public' AND tablename='event_song_requests'`,
  );
  for (const row of r.rows) {
    assert.ok(
      (row.qual ?? '').includes('current_event_ids'),
      `${row.policyname} must keep the host leg — the couple owns their own room`,
    );
    assert.ok(
      (row.qual ?? '').includes('is_admin'),
      `${row.policyname} must keep admin oversight`,
    );
  }
});

test('anon STILL holds nothing on the request table', async () => {
  // Re-asserted after touching this table's policies: the REVOKE from
  // 20271014090000 is the thing that makes every other claim here meaningful,
  // and a policy edit is exactly when someone re-grants by reflex.
  for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege('anon', 'public.event_song_requests', $1) AS ok`,
      [priv],
    );
    assert.equal(r.rows[0]!.ok, false, `anon must not hold ${priv} on event_song_requests`);
  }
});

test('the pause is STILL write-gated by column privilege — PR #3876 is not undone', async () => {
  // Always-on retired the window as a setup step; it did NOT make the control
  // free. If this ever goes green-to-red, the paid pause became a public toggle.
  for (const priv of ['INSERT', 'UPDATE']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_column_privilege('authenticated', 'public.vendor_dayof_configs',
                                   'song_requests_open', $1) AS ok`,
      [priv],
    );
    assert.equal(
      r.rows[0]!.ok,
      false,
      `authenticated must NOT hold ${priv} on song_requests_open — the pause is a paid control`,
    );
  }
});
