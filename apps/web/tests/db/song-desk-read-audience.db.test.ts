/**
 * THE SONG DESK READ AUDIENCE — who may read the couple's songs (migrations
 * replayed).
 *
 * Covers 20271020710612, which fixed three findings from the 2026-07-30 audit:
 *
 *   ① a vendor TEAM MEMBER read zero playlist rows, because
 *      `event_playlist_picks_music_vendor_read` hand-rolled "the profile owner"
 *      while the shared `current_vendor_booked_event_ids()` resolves the whole
 *      org (owner UNION team members). Two definitions of "booked", and the
 *      older one was narrower.
 *   ② a DAY-OF GRANTEE read zero from BOTH song tables, so the desk had rendered
 *      "they haven't picked any songs yet" at crew since PR #3803. The page
 *      authorises grantees via the admin client; the desk read under their RLS.
 *   ③ neither table ever got its `REVOKE` — both still granted `anon` SIUD from
 *      the default ACL, the root cause of the 368-table exposure.
 *
 * WHY THESE ARE ASSERTED ON THE POLICY TEXT AND THE PRIVILEGE CATALOG rather
 * than by acting as each role: PGlite has no JWT, so `auth.uid()` cannot be
 * impersonated here — the same reason `song-requests.db.test.ts` asserts
 * `has_table_privilege` / `pg_policies` instead of running as `anon`. What that
 * buys is still real: these are the exact predicates and grants Postgres will
 * enforce in prod, read back out of the catalog after a full migration replay.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await replay?.db?.close?.();
});

async function playlistQual(): Promise<string> {
  const r = await db.query<{ qual: string | null }>(
    `SELECT qual FROM pg_policies
     WHERE schemaname='public' AND tablename='event_playlist_picks'
       AND policyname='event_playlist_picks_music_vendor_read'`,
  );
  assert.equal(r.rows.length, 1, 'the music-vendor read policy must exist');
  return r.rows[0]!.qual ?? '';
}

async function songPicksQual(): Promise<string> {
  const r = await db.query<{ qual: string | null }>(
    `SELECT qual FROM pg_policies
     WHERE schemaname='public' AND tablename='event_song_picks'
       AND policyname='event_song_picks_booked_vendor_read'`,
  );
  assert.equal(r.rows.length, 1, 'the booked-vendor read policy must exist');
  return r.rows[0]!.qual ?? '';
}

// ─── ① · crew belong to the act ─────────────────────────────────────────────

test('the playlist read admits vendor TEAM MEMBERS, not just the profile owner', async () => {
  const qual = await playlistQual();
  assert.ok(
    qual.includes('vendor_team_members'),
    'crew read zero playlist rows without this — and PR #3885 told them the couple had written nothing',
  );
  assert.ok(qual.includes('vendor_profiles'), 'the owner leg must survive alongside it');
});

// ─── ② · the grant is real authorisation ────────────────────────────────────

test('the playlist read admits DAY-OF GRANTEES', async () => {
  const qual = await playlistQual();
  assert.ok(
    qual.includes('vendor_event_access_grants'),
    'the page authorises a grantee via the admin client; the policy has to agree',
  );
});

test('a grantee leg is bound to the SAME vendor, so a florist’s crew cannot read the band’s playlist', async () => {
  // The whole reason this is an EXISTS against the grants table rather than a
  // reuse of `current_vendor_dayof_grant_event_ids()`: that helper returns
  // event_ids and drops the vendor binding. Losing the binding would let any
  // grantee on the event read a music act's playlist.
  const qual = await playlistQual();
  assert.ok(
    qual.includes('vendor_profile_id') && qual.includes('marketplace_vendor_id'),
    'the grant must be tied to the booked vendor row, not just to the event',
  );
  assert.ok(qual.includes('revoked_at'), 'a revoked grant must not read anything');
});

test('event_song_picks admits grantees WITHOUT losing the booked-vendor leg', async () => {
  const qual = await songPicksQual();
  assert.ok(
    qual.includes('current_vendor_dayof_grant_event_ids'),
    'grantees read zero flat picks without this — the desk’s coverage line lied to crew',
  );
  assert.ok(
    qual.includes('current_vendor_booked_event_ids'),
    'the original booked-vendor audience must be kept, not replaced',
  );
});

test('`current_vendor_booked_event_ids()` was NOT widened to grantees', async () => {
  // Fixing ② by widening the shared helper would have been one line, and would
  // have silently changed event_schedule_blocks and every other consumer. Each
  // policy opts in explicitly instead. This test is the tripwire on that choice.
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname='current_vendor_booked_event_ids'`,
  );
  assert.equal(r.rows.length, 1);
  assert.ok(
    !r.rows[0]!.def.includes('vendor_event_access_grants'),
    'the shared booked helper must stay about BOOKINGS — widening it is a blast-radius change',
  );
});

// ─── The category gate must survive the audience widening ──────────────────

test('the playlist read is still MUSIC-ONLY, on the legacy vendor_category vocabulary', async () => {
  // The audit's first hypothesis was that this list had drifted from
  // MUSIC_CANONICALS (live_band / choir / orchestra / wedding_singer / dj). It
  // had not: these are the legacy `vendor_category` ENUM values, which is what
  // `event_vendors.category` holds and what real prod bookings carry. Rewriting
  // them to the canonical keys would break every booking, so this test pins the
  // vocabulary as much as the gate.
  const qual = await playlistQual();
  for (const cat of ['band_dj', 'host_emcee', 'choir', 'string_quartet']) {
    assert.ok(qual.includes(cat), `the category gate lost ${cat}`);
  }
  for (const key of ['live_band', 'wedding_singer', 'orchestra']) {
    assert.ok(
      !qual.includes(key),
      `${key} is a MUSIC_CANONICALS taxonomy key, not a vendor_category enum value — wrong vocabulary for this column`,
    );
  }
  assert.ok(qual.includes('contracted'), 'the booked-status gate must survive too');
});

// ─── ③ · both tables lose the default ACL ───────────────────────────────────

for (const table of ['event_playlist_picks', 'event_song_picks']) {
  test(`anon holds NO privilege on ${table} (the REVOKE that was never written)`, async () => {
    const r = await db.query<{ priv: string }>(
      `SELECT privilege_type AS priv FROM information_schema.role_table_grants
       WHERE table_schema='public' AND table_name=$1 AND grantee='anon'`,
      [table],
    );
    assert.deepEqual(
      r.rows,
      [],
      `anon must hold nothing on ${table} — the default ACL grants arwdDxtm and this table never revoked it`,
    );
  });

  test(`authenticated keeps all four verbs on ${table} (its host policy is FOR ALL)`, async () => {
    // The narrowing must not have clipped the couple: unlike
    // vendor_dayof_configs, both of these carry FOR ALL host policies, so DELETE
    // backs a real code path (a couple removing a song).
    for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      const r = await db.query<{ ok: boolean }>(
        `SELECT has_table_privilege('authenticated', $1, $2) AS ok`,
        [`public.${table}`, priv],
      );
      assert.equal(r.rows[0]!.ok, true, `authenticated needs ${priv} on ${table}`);
    }
  });
}

test('every policy on both song tables is still TO authenticated only', async () => {
  // What made ③ non-exploitable rather than a live hole. If a permissive policy
  // ever names anon, the revoked grant is the only thing left standing — so this
  // asserts the second layer is still there.
  const r = await db.query<{ tablename: string; policyname: string; roles: string }>(
    `SELECT tablename, policyname, roles::text AS roles FROM pg_policies
     WHERE schemaname='public'
       AND tablename IN ('event_playlist_picks','event_song_picks')`,
  );
  assert.ok(r.rows.length >= 5, 'expected the couple read/write + vendor read policies on both');
  for (const row of r.rows) {
    assert.ok(
      !row.roles.includes('anon'),
      `${row.tablename}.${row.policyname} names anon — that turns a dormant grant into a hole`,
    );
  }
});
