/**
 * Live Studio · THE GUEST-PICK ROSTER STOPS OFFERING A CAMERA THAT LEFT.
 *
 * `fetchGuestPickCameras` decides which side cameras a wedding guest is SHOWN on the
 * public event page. It filtered the bound seat on `revoked_at` / `status` /
 * `claimer_user_id` and never once asked whether the phone was still there — it did
 * not even project `last_seen_at`. A zone's `status = 'live'` is the last transition
 * anyone OBSERVED, and the one transition nobody observes is a phone leaving: a
 * browser closed, backgrounded past execution, or carried out of signal sends no
 * goodbye.
 *
 * Nor does anything clean up after it. `panood_camera_heartbeat`'s demotion sweep is
 * deliberately CRON-FREE — one live camera reports its dead neighbours — so when the
 * LAST camera on an event leaves there is no next heartbeat and NOTHING ever demotes
 * the seat or its zone.
 *
 * MEASURED IN PRODUCTION, 2026-09-01: event "Cale & Ice" carried a zone reading
 * 'live', bound to a claimed, un-revoked seat whose `last_seen_at` was **13,843
 * seconds** old — 230× the staleness window. This roster offered that camera, and the
 * function's own comment says what a guest then gets: *"a pill that spins forever"*.
 *
 * THE RULE IS NOT NEW AND IS NOT RE-DERIVED HERE. `resolveChannelStatus`
 * (lib/live-studio-channel-cameras.ts) has resolved the controller's honest status
 * this way since Wave 4, and its docblock already names this exact leak. The roster
 * now calls that same function — which also answers "is the seat claimed?", so the
 * `claimer_user_id` test that used to sit in the loop is folded in rather than
 * written twice. Migration 20271188365061 put the same 60s window on the signaling
 * predicate, so a guest is never offered a camera whose channel they could not open.
 *
 * ⚠ THE PROJECTION IS PART OF THE RULE, and it fails in the quiet direction. Drop
 * `last_seen_at` from the select and every stamp arrives `undefined`, which
 * `resolveChannelStatus` reads as "never beat" — the roster goes permanently EMPTY,
 * which looks exactly like a wedding with no side cameras. One test below asserts the
 * column is actually requested, because no behavioural test can tell those apart.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CHANNEL_STALE_MS } from './live-studio-channel-cameras';
import { fetchGuestPickCameras } from './live-studio-guest-pick';

const EVENT = 'evt-roster-1';

type ZoneSeed = {
  zone_index: number | null;
  label?: string | null;
  venue_label?: string | null;
  sort_order?: number | null;
  camera_operator_id: number | null;
  status?: string | null;
};

type SeatSeed = {
  id: number;
  camera_index: number;
  claimer_user_id?: string | null;
  revoked_at?: string | null;
  status?: string | null;
  last_seen_at?: string | null;
};

/** Seconds ago, as the ISO string Postgres hands back. */
const agoSeconds = (s: number) => new Date(Date.now() - s * 1000).toISOString();

/**
 * Supabase stub shaped to the REAL two-step read:
 *
 *   1. zones `.select(…).eq(event_id).eq(status,'live').order().order()`
 *   2. seats `.select(…).eq(event_id).in('id', […])`
 *
 * `projected` records the column list each table was asked for, so a test can assert
 * the query actually requests what the filter depends on.
 *
 * ⚠ The stub does NOT apply `.eq('status','live')` itself. That is deliberate: it
 * lets a test hand the loop a 'disabled' zone and prove the shared rule is consulted,
 * rather than the result being an artefact of the WHERE clause.
 */
function fakeAdmin(zones: ZoneSeed[], seats: SeatSeed[]) {
  const projected: Record<string, string> = {};

  const rowsFor = (table: string): Record<string, unknown>[] => {
    if (table === 'live_studio_roam_zones') {
      return zones.map((z) => ({
        zone_index: z.zone_index,
        label: z.label ?? null,
        venue_label: z.venue_label ?? null,
        sort_order: z.sort_order ?? 0,
        camera_operator_id: z.camera_operator_id,
        status: z.status ?? 'live',
      }));
    }
    return seats.map((s) => ({
      id: s.id,
      camera_index: s.camera_index,
      claimer_user_id: s.claimer_user_id === undefined ? 'operator-uid' : s.claimer_user_id,
      revoked_at: s.revoked_at ?? null,
      status: s.status ?? 'live',
      last_seen_at: s.last_seen_at === undefined ? agoSeconds(1) : s.last_seen_at,
    }));
  };

  const client = {
    from(table: string) {
      if (table !== 'live_studio_roam_zones' && table !== 'panood_camera_operators') {
        throw new Error(`unexpected table: ${table}`);
      }
      // Only the columns actually named in the select reach the caller — the same
      // thing PostgREST does, and what makes the projection test meaningful.
      const project = (rows: Record<string, unknown>[], cols: string) => {
        const keep = cols.split(',').map((c) => c.trim());
        return rows.map((r) => Object.fromEntries(keep.filter((k) => k in r).map((k) => [k, r[k]])));
      };
      let cols = '';
      const b: Record<string, unknown> = {
        select: (c: string) => {
          cols = c;
          projected[table] = c;
          return b;
        },
        eq: () => b,
        in: () => b,
        order: () => b,
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
          Promise.resolve({ data: project(rowsFor(table), cols), error: null }).then(res, rej),
      };
      return b;
    },
  };

  return {
    admin: client as unknown as Parameters<typeof fetchGuestPickCameras>[0],
    projected,
  };
}

const slots = (cams: { slot: string }[]) => cams.map((c) => c.slot);

/* ── 1. Non-vacuity first ─────────────────────────────────────────────────── */

test('⭐ a beating camera IS offered (every empty roster below is the rule, not the stub)', async () => {
  const { admin } = fakeAdmin(
    [{ zone_index: 1, label: 'Aisle', camera_operator_id: 7 }],
    [{ id: 7, camera_index: 2, last_seen_at: agoSeconds(1) }],
  );
  const cams = await fetchGuestPickCameras(admin, EVENT);
  assert.deepEqual(slots(cams), ['cam2'], 'the slot keys off camera_index, not zone_index');
  assert.equal(cams[0]!.label, 'Aisle');
});

/* ── 2. The camera that left ──────────────────────────────────────────────── */

test('⭐ a phone that left 13,843s ago is NOT offered — the production case', async () => {
  // The exact state measured on "Cale & Ice": zone 'live', seat claimed and
  // un-revoked, nothing having demoted either because it was the LAST camera.
  const { admin } = fakeAdmin(
    [{ zone_index: 1, label: 'Aisle', camera_operator_id: 7, status: 'live' }],
    [
      {
        id: 7,
        camera_index: 2,
        claimer_user_id: 'operator-uid',
        revoked_at: null,
        status: 'live',
        last_seen_at: agoSeconds(13_843),
      },
    ],
  );
  assert.deepEqual(await fetchGuestPickCameras(admin, EVENT), []);
});

test('🔒 the window is the shipped CHANNEL_STALE_MS — just inside is offered, just outside is not', async () => {
  const inside = CHANNEL_STALE_MS / 1000 - 1;
  const outside = CHANNEL_STALE_MS / 1000 + 1;

  const fresh = fakeAdmin(
    [{ zone_index: 1, camera_operator_id: 7 }],
    [{ id: 7, camera_index: 1, last_seen_at: agoSeconds(inside) }],
  );
  assert.equal((await fetchGuestPickCameras(fresh.admin, EVENT)).length, 1, `${inside}s is live`);

  const stale = fakeAdmin(
    [{ zone_index: 1, camera_operator_id: 7 }],
    [{ id: 7, camera_index: 1, last_seen_at: agoSeconds(outside) }],
  );
  assert.equal((await fetchGuestPickCameras(stale.admin, EVENT)).length, 0, `${outside}s is dark`);
});

test('a seat that never beat is not offered — a null is not a camera', async () => {
  const { admin } = fakeAdmin(
    [{ zone_index: 1, camera_operator_id: 7 }],
    [{ id: 7, camera_index: 1, last_seen_at: null }],
  );
  assert.deepEqual(await fetchGuestPickCameras(admin, EVENT), []);
});

test('an unparseable stamp is treated as dark, not passed through as fresh', async () => {
  const { admin } = fakeAdmin(
    [{ zone_index: 1, camera_operator_id: 7 }],
    [{ id: 7, camera_index: 1, last_seen_at: 'not-a-timestamp' }],
  );
  assert.deepEqual(await fetchGuestPickCameras(admin, EVENT), []);
});

/* ── 3. The projection — the failure nothing else can see ─────────────────── */

test('⭐ the roster asks the database for the heartbeat it filters on', async () => {
  // A dropped column here does not make the roster WRONG, it makes it EMPTY:
  // `last_seen_at` arrives undefined, resolveChannelStatus reads "never beat", and
  // every wedding silently loses its side cameras. No behavioural assertion can tell
  // that apart from an event that genuinely has none, so the query is pinned here.
  const { admin, projected } = fakeAdmin(
    [{ zone_index: 1, camera_operator_id: 7 }],
    [{ id: 7, camera_index: 1 }],
  );
  await fetchGuestPickCameras(admin, EVENT);

  assert.match(
    projected.panood_camera_operators ?? '',
    /\blast_seen_at\b/,
    'the seat read must project last_seen_at',
  );
  assert.match(
    projected.live_studio_roam_zones ?? '',
    /\bstatus\b/,
    "the zone read must project status — it is resolveChannelStatus's first input",
  );
});

/* ── 4. What was already true stays true ──────────────────────────────────── */

test('a revoked seat is still withheld, however hard it is beating', async () => {
  for (const seat of [
    { id: 7, camera_index: 1, revoked_at: agoSeconds(5), last_seen_at: agoSeconds(1) },
    { id: 7, camera_index: 1, status: 'revoked', last_seen_at: agoSeconds(1) },
  ]) {
    const { admin } = fakeAdmin([{ zone_index: 1, camera_operator_id: 7 }], [seat]);
    assert.deepEqual(await fetchGuestPickCameras(admin, EVENT), []);
  }
});

test('an unclaimed seat is still withheld — a reissued camera nobody holds', async () => {
  // reissuePanoodCameraToken clears claimer_user_id and leaves revoked_at NULL, so
  // this is the case a revocation-only filter misses.
  const { admin } = fakeAdmin(
    [{ zone_index: 1, camera_operator_id: 7 }],
    [{ id: 7, camera_index: 1, claimer_user_id: null, last_seen_at: agoSeconds(1) }],
  );
  assert.deepEqual(await fetchGuestPickCameras(admin, EVENT), []);
});

test('an unbound zone and a zone with no seat row are both withheld', async () => {
  const unbound = fakeAdmin([{ zone_index: 1, camera_operator_id: null }], []);
  assert.deepEqual(await fetchGuestPickCameras(unbound.admin, EVENT), []);

  const orphan = fakeAdmin([{ zone_index: 1, camera_operator_id: 99 }], []);
  assert.deepEqual(await fetchGuestPickCameras(orphan.admin, EVENT), []);
});

test("a host-disabled zone is withheld even with a beating phone — their decision outranks the signal", async () => {
  // Proves the shared rule is genuinely consulted: the stub does not apply the
  // query's own `.eq('status','live')`, so only resolveChannelStatus can refuse this.
  const { admin } = fakeAdmin(
    [{ zone_index: 1, camera_operator_id: 7, status: 'disabled' }],
    [{ id: 7, camera_index: 1, last_seen_at: agoSeconds(1) }],
  );
  assert.deepEqual(await fetchGuestPickCameras(admin, EVENT), []);
});

/* ── 5. A mixed roster — the one that matters on the day ──────────────────── */

test('⭐ a wedding with one live and one departed camera offers exactly one', async () => {
  // The realistic shape: three cameras were set up, two phones went home, one is
  // still running. Before this change a guest saw all three and two of them spun.
  const { admin } = fakeAdmin(
    [
      { zone_index: 1, label: 'Ceremony', camera_operator_id: 7 },
      { zone_index: 2, label: 'Reception', camera_operator_id: 8 },
      { zone_index: 3, label: 'Photo Booth', camera_operator_id: 9 },
    ],
    [
      { id: 7, camera_index: 1, last_seen_at: agoSeconds(9_000) },
      { id: 8, camera_index: 2, last_seen_at: agoSeconds(3) },
      { id: 9, camera_index: 3, last_seen_at: agoSeconds(600) },
    ],
  );
  const cams = await fetchGuestPickCameras(admin, EVENT);
  assert.deepEqual(slots(cams), ['cam2']);
  assert.equal(cams[0]!.label, 'Reception');
});
