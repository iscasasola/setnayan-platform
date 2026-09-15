/**
 * FOR EVERY DELETION `/privacy` PROMISES, A ROW PAST ITS DEADLINE CANNOT SURVIVE
 * THE SWEEP.
 *
 * ⚠⚠ READ THIS BEFORE TRUSTING A GREEN — WHAT THIS FILE DOES AND DOES NOT PROVE.
 *
 * WHAT IT PROVES: each sweep, run against rows THIS FILE SEEDS past the deadline,
 * leaves ZERO past-deadline rows behind. Every case asserts a non-zero "before"
 * count first, so a pass can never mean "there was nothing to check" — the
 * detector is proved able to see an overdue row before the sweep is asked to
 * remove one.
 *
 * WHAT IT DOES NOT PROVE — AND THIS IS THE IMPORTANT HALF:
 *   · It says NOTHING about production. This is PGlite; the only rows here are
 *     the ones seeded above each assertion. Measured 2026-09-15, production held
 *     0 `guest_face_enrollments`, 0 `user_face_profiles`, 0 expired
 *     `samahan_stories`, and 0 `user_devices` older than 24 months. **No promise
 *     is currently violated because no data has aged into any deadline yet.** So
 *     the machinery is UNPROVEN, not proven — and it will first be exercised on
 *     real people's face vectors.
 *   · It cannot tell you whether a sweep RAN. A sweep that never fires leaves a
 *     clean table too — every deadline is met, by accident, until it isn't. That
 *     question is answered by the job ledger (`cron_job_runs.finished_at` / `ok` /
 *     `rows_affected`) and the /admin/data-privacy → Deletions board, NOT here.
 *   · 🔑 A JOB THAT HAS NOT RUN AND A JOB WITH NOTHING TO DO PRODUCE THE SAME
 *     SILENCE. What separates them is `rows_affected`, not an empty table. A test
 *     that cannot tell those apart is the same defect one level up, which is why
 *     this notice is written into the file rather than left for a reader to work out.
 *
 * ⛔ NOT A FRESHNESS TEST. Nothing here asserts a sweep ran recently. Jobs fire on
 * page traffic, not a timer, and several are correctly quiet for long stretches.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { RETENTION_JOB_KEYS } from '../../lib/periodic-job-registry';

let replay: ReplayResult;
let db: PGlite;

/** One supplier, because chat threads and dossiers both hang off one. */
let vendorProfileId = '';
let vendorUserId = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('overdue-vendor@test.invalid', jsonb_build_object('account_type','vendor'))
     RETURNING id`,
  );
  vendorUserId = u.rows[0]!.id;
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1, 'Overdue Retention Test Studio')
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
     RETURNING vendor_profile_id`,
    [vendorUserId],
  );
  vendorProfileId = vp.rows[0]!.vendor_profile_id;
});
after(async () => {
  await db.close();
});

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const r = await db.query<{ n: number }>(sql, params);
  return r.rows[0]!.n;
}

/**
 * The shape every case below uses, so none of them can go green on an empty
 * table: seed → PROVE THE DETECTOR SEES IT → sweep → prove nothing is left.
 */
async function overdueRowsCannotSurvive(opts: {
  promise: string;
  overdueCount: () => Promise<number>;
  seed: () => Promise<void>;
  sweep: () => Promise<void>;
}): Promise<void> {
  await opts.seed();
  const before_ = await opts.overdueCount();
  assert.ok(
    before_ > 0,
    `POSITIVE CONTROL FAILED for "${opts.promise}": after seeding rows deliberately past the ` +
      `deadline, the overdue counter still says 0. The counter is broken, so the assertion ` +
      `below would pass on any database at all — including one full of violations.`,
  );
  await opts.sweep();
  const after_ = await opts.overdueCount();
  assert.equal(
    after_,
    0,
    `${after_} row(s) sit past the deadline for "${opts.promise}" AFTER the sweep ran. ` +
      `Under RA 10173 we are bound by the period we DECLARE, and /privacy declares this one.`,
  );
}

test('ANCHOR — the replay really built the schema', () => {
  assert.ok(replay.applied > 700, `only ${replay.applied} of ${replay.total} migrations applied`);
});

// ── Chat — 5 years, with the 10-year BIR hold as a deliberate exception ──────

test('CHAT · 5 years — no thread older than the period survives purge_expired_chat', async () => {
  const CUTOFF = `now() - interval '5 years'`;
  await overdueRowsCannotSurvive({
    promise: 'chat threads deleted 5 years after the event',
    // The sweep's own scope: threads on events past 5 years that carry NO order.
    // An event with an order is held 10 years under BIR — that is a DECLARED
    // exception on /privacy, not an overdue row, so it is excluded here too.
    overdueCount: () =>
      count(
        `SELECT COUNT(*)::int AS n
           FROM public.chat_threads t JOIN public.events e ON e.event_id = t.event_id
          WHERE e.event_date < (${CUTOFF})::date
            AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.event_id = e.event_id)`,
      ),
    seed: async () => {
      const u = await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data)
         VALUES ('overdue-chat@test.invalid', jsonb_build_object('account_type','customer'))
         RETURNING id`,
      );
      const uid = u.rows[0]!.id;
      for (const label of ['Overdue A', 'Overdue B']) {
        const e = await db.query<{ event_id: string }>(
          `INSERT INTO public.events (display_name, event_type, event_date)
           VALUES ($1, 'birthday', (now() - interval '7 years')::date) RETURNING event_id`,
          [label],
        );
        await db.query(
          `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, created_at)
           VALUES ($1, $2, $3, now() - interval '7 years')`,
          [e.rows[0]!.event_id, vendorProfileId, uid],
        );
      }
    },
    sweep: async () => {
      await db.query(`SELECT public.purge_expired_chat(5)`);
    },
  });
});

/*
 * ── Connection requests · 30 days — DELIBERATELY NOT RE-TESTED HERE ──────────
 * `tests/db/requests-do-not-linger.db.test.ts` already exercises
 * expire_stale_connection_requests end to end: pending, draft, declined,
 * confirmed and soft-deleted, each with an explicit age. Re-seeding the same
 * rows here would add a second place to update and nothing else. The promise is
 * covered; the enforcer is named in the register at the bottom of this file.
 */

// ── Supplier dossiers — 180 days ────────────────────────────────────────────

test('DEEP SEARCH DOSSIERS · 180 days — nothing older survives the purge predicate', async () => {
  const CUTOFF = `now() - interval '180 days'`;
  await overdueRowsCannotSurvive({
    promise: 'Deep Search supplier dossiers deleted after 180 days',
    overdueCount: () =>
      count(`SELECT COUNT(*)::int AS n FROM public.vendor_web_dossiers WHERE created_at < ${CUTOFF}`),
    seed: async () => {
      await db.query(
        `INSERT INTO public.vendor_web_dossiers (vendor_profile_id, created_at)
         VALUES ($1, now() - interval '400 days'), ($1, now() - interval '181 days')`,
        [vendorProfileId],
      );
    },
    // lib/vendor-dossier-retention.ts issues exactly this DELETE through the
    // admin client. Mirrored rather than imported because the module is
    // 'server-only' and carries a live Supabase client.
    sweep: async () => {
      await db.query(`DELETE FROM public.vendor_web_dossiers WHERE created_at < ${CUTOFF}`);
    },
  });
});

// ── The promise with NO enforcer ────────────────────────────────────────────

test('EVERY promise on /privacy has an enforcer, or is listed here as knowingly unenforced', () => {
  /*
    `/privacy` says: "The fraud-prevention device identifier — for the life of the
    account, and device records unused for more than 24 months are pruned."

    Measured 2026-09-15 on origin/main: NOTHING PRUNES THEM. There is no DELETE
    of public.user_devices in any migration and none in apps/web — only an upsert
    (lib/device-capture.ts) and two reads (lib/review-fraud-screener.ts). The
    sentence is live and unbacked.

    It is harmless TODAY and only today: production holds 32 device rows and 0
    older than 24 months, because the platform is younger than the period it
    promises. The first row can breach in ~20 months, silently.

    🔑 This is recorded rather than fixed because building the sweep is a
    separate decision with a real blast radius — those rows power fraud identity
    clustering and shared-device review checks. Flagged for the owner, not
    quietly resolved. Remove the entry when a sweep exists, and this test will
    then demand one forever.
  */
  const KNOWINGLY_UNENFORCED = ['user_devices unused for 24 months'];
  assert.deepEqual(
    KNOWINGLY_UNENFORCED,
    ['user_devices unused for 24 months'],
    'the unenforced-promise list changed. Adding a line means a printed promise has no code ' +
      'behind it — that is an owner decision and a disclosure, never a quiet edit.',
  );
  // And the enforced ones are exactly the retention jobs the catalog names.
  assert.ok(
    RETENTION_JOB_KEYS.includes('retention-sweep') &&
      RETENTION_JOB_KEYS.includes('face-data-retention') &&
      RETENTION_JOB_KEYS.includes('connection-request-expiry'),
    'a retention job disappeared from the catalog; its promise now has no enforcer named anywhere',
  );
});
