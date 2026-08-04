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
//
// ⚠ THESE THREE WERE REWRITTEN 2026-07-30 (migration 20271021788625). PR 1c
// admitted crew and grantees by spelling the audiences out INSIDE this policy —
// a `vendor_profiles UNION vendor_team_members` subquery plus an EXISTS on
// `vendor_event_access_grants`, all wrapped in a category gate. Removing that
// category gate (it was the last mount-vs-read mismatch on the desk) let the
// whole predicate collapse onto the two shared helpers, so the audiences are now
// admitted BY those helpers rather than by literal SQL in this policy. Same
// people, one less copy of the rule. The tests therefore assert the property —
// "crew are admitted" — at the layer that now decides it.

test('the playlist read delegates to the ONE shared definition of booked', async () => {
  const qual = await playlistQual();
  assert.ok(
    qual.includes('current_vendor_booked_event_ids'),
    'the act itself reads via the shared helper, not a hand-rolled join',
  );
});

test('…and that shared definition really does include vendor TEAM MEMBERS', async () => {
  // The property PR 1c actually cared about: crew read zero before, because this
  // policy hand-rolled "profile owner". Now it inherits the helper, so the claim
  // has to be checked where the helper defines it.
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname='current_vendor_booked_event_ids'`,
  );
  assert.equal(r.rows.length, 1);
  assert.ok(
    r.rows[0]!.def.includes('vendor_team_members'),
    'crew would read zero playlist rows again — this is the regression PR 1c fixed',
  );
});

// ─── ② · the grant is real authorisation ────────────────────────────────────

test('the playlist read admits DAY-OF GRANTEES', async () => {
  const qual = await playlistQual();
  assert.ok(
    qual.includes('current_vendor_dayof_grant_event_ids'),
    'the page authorises a grantee via the admin client; the policy has to agree',
  );
});

test('the grantee helper only returns LIVE grants', async () => {
  // PR 1c protected this with `revoked_at IS NULL` written into the policy's own
  // EXISTS. That clause now lives in the helper, so the guarantee is checked
  // there — a revoked grant must never read a playlist.
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname='current_vendor_dayof_grant_event_ids'`,
  );
  assert.equal(r.rows.length, 1);
  assert.ok(r.rows[0]!.def.includes('revoked_at'), 'a revoked grant must read nothing');
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

test('the hardcoded legacy category list is GONE — the desk mounts and reads on the same terms', async () => {
  // ⚠ THIS TEST REVERSED ON 2026-07-30 (owner: "fix the song desk"). It used to
  // assert the category gate was PRESENT and pinned to the legacy vocabulary. The
  // gate turned out to be the last mount-vs-read mismatch on this desk: the
  // specialization is granted on MUSIC_CANONICALS tiles (live_band · dj · choir ·
  // orchestra · wedding_singer) while the read gated on legacy enum values
  // (band_dj · host_emcee · choir · string_quartet), and NO legacy category maps
  // to `orchestra` or `wedding_singer`. So a booked orchestra held `song_desk`,
  // mounted the desk, and read zero playlist rows.
  //
  // Extending the list would have kept a taxonomy in SQL, where it drifted
  // silently for the whole life of the feature. Dropping it matches the sibling
  // policy `event_song_picks_booked_vendor_read`, which is deliberately not
  // narrowed for exactly this reason. ⚠ Consequence, owner-visible: ANY booked
  // vendor can now read the playlist, not only music acts.
  const qual = await playlistQual();
  for (const cat of ['band_dj', 'host_emcee', 'string_quartet']) {
    assert.ok(
      !qual.includes(cat),
      `${cat} is still in the predicate — a hand-kept taxonomy in SQL is what caused the drift`,
    );
  }
  assert.ok(
    qual.includes('current_vendor_booked_event_ids'),
    'the read must gate on the ONE shared definition of booked instead',
  );
});

test('a booked ORCHESTRA or WEDDING SINGER can now read — the case the old gate excluded', async () => {
  // The regression this whole change exists for, asserted as the property rather
  // than the string: whatever the predicate says, it must not depend on the
  // vendor's category, because the mount does not.
  const qual = await playlistQual();
  assert.ok(
    !qual.includes('ev.category') && !qual.includes('category ='),
    'the predicate still branches on event_vendors.category — orchestra/wedding_singer have no legacy value',
  );
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
