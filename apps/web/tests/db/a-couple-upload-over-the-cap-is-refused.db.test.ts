/**
 * A COUPLE UPLOAD OVER THE CAP IS REFUSED — and a removed picture frees its
 * bytes. Migration 20271259142990 (DECISION_LOG 2026-09-25: "that means they can
 * only upload a total of 100MB compressed files").
 *
 * The SQL half of the cap, as `/api/upload` asks it through the service role
 * (lib/couple-media-allowance.server.ts):
 *   · reserve_couple_media_bytes adds the bytes ONLY when the total stays within
 *     the cap — under it counts, over it is refused and changes nothing;
 *   · a couple's own session can call neither function (nor write the column);
 *   · the settle: the event's rows are read back, measured with the SAME pure
 *     function the route uses (measureCoupleMediaBytes), and written with
 *     set_couple_media_bytes — after the couple removes a photo, the upload that
 *     was refused goes through.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { measureCoupleMediaBytes } from '../../lib/couple-media-allowance';

let replay: ReplayResult;
let db: PGlite;

const MIGRATION_FILE = '20271259142990_couple_media_cap_is_enforced.sql';
const MB = 1024 * 1024;
const CAP = 100 * MB;

const F = { couple: '', eventId: '' };

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
async function asService<T>(fn: () => Promise<T>): Promise<T> {
  await setRole('service_role');
  await db.exec('SET ROLE service_role');
  try {
    return await fn();
  } finally {
    await reset();
  }
}
async function asCouple<T>(fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, F.couple);
  await setRole('authenticated');
  await db.exec('SET ROLE authenticated');
  try {
    return await fn();
  } finally {
    await reset();
  }
}

const reserve = (bytes: number) =>
  asService(async () =>
    (
      await db.query<{ total: string | number | null }>(`SELECT public.reserve_couple_media_bytes($1, $2, $3) AS total`, [
        F.eventId,
        bytes,
        CAP,
      ])
    ).rows[0]!.total,
  );
const counter = async () =>
  Number(
    (await db.query<{ n: string | number }>(`SELECT couple_media_bytes AS n FROM public.events WHERE event_id = $1`, [F.eventId]))
      .rows[0]!.n,
  );
const setCounter = async (bytes: number) => {
  await db.query(`UPDATE public.events SET couple_media_bytes = $2 WHERE event_id = $1`, [F.eventId, bytes]);
};

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  F.couple = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('cap-couple@media.test', jsonb_build_object('account_type', 'customer')) RETURNING id`,
    )
  ).rows[0]!.id;
  F.eventId = (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type) VALUES ('Our 100 MB', 'birthday') RETURNING event_id AS e`,
    )
  ).rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [F.eventId, F.couple]);
});

after(async () => {
  await db?.close();
});

test('the migration applied', () => {
  assert.ok(!replay.skipped.some((s) => s.file === MIGRATION_FILE), `${MIGRATION_FILE} was skipped: ${JSON.stringify(replay.skipped)}`);
});

test('under the cap: the upload is reserved and COUNTED', async () => {
  await setCounter(0);
  assert.equal(Number(await reserve(30 * MB)), 30 * MB);
  assert.equal(Number(await reserve(70 * MB)), CAP, 'exactly at the cap is still within it');
  assert.equal(await counter(), CAP);
});

test('over the cap: REFUSED, and the counter does not move', async () => {
  await setCounter(95 * MB);
  assert.equal(await reserve(6 * MB), null, 'a 6 MB file on 95 MB used would take the event over 100 MB');
  assert.equal(await counter(), 95 * MB, 'a refusal adds nothing');
  assert.equal(Number(await reserve(5 * MB)), CAP, 'the 5 MB that does fit is still accepted');
});

test('a couple’s own session can neither reserve, settle, nor write the counter', async () => {
  for (const sql of [
    `SELECT public.reserve_couple_media_bytes('${'0'.repeat(8)}-0000-0000-0000-${'0'.repeat(12)}', 1, 999999999999)`,
    `SELECT public.set_couple_media_bytes('${'0'.repeat(8)}-0000-0000-0000-${'0'.repeat(12)}', 0)`,
  ]) {
    await assert.rejects(
      asCouple(() => db.query(sql)),
      /permission denied/,
      `a couple could move their own allowance: ${sql}`,
    );
  }
  await assert.rejects(
    asCouple(() => db.query(`UPDATE public.events SET couple_media_bytes = 0 WHERE event_id = $1`, [F.eventId])),
    /permission denied/,
  );
  const gone = await db.query<{ p: string | null }>(`SELECT to_regprocedure('public.increment_couple_media_bytes(uuid,bigint)')::text AS p`);
  assert.equal(gone.rows[0]!.p, null, 'the never-refusing increment is dropped');
});

test('DELETE FREES BYTES: a removed photo is no longer counted, and the refused upload then fits', async () => {
  const k = (name: string) => `events/${F.eventId}/our-photos/0b6c2f1e-1d0a-4b8e-9b7a-3c1f2e4d5a6b-${name}`;
  const keep = k('keep.jpg');
  const drop = k('drop.jpg');
  const old = new Date(Date.now() - 24 * 3600 * 1000);
  // R2's listing of the event's folder — sizes as storage reports them.
  const objects = [
    { key: keep, size: 60 * MB, lastModified: old },
    { key: drop, size: 40 * MB, lastModified: old },
  ];
  await db.query(`UPDATE public.events SET our_photos = $2::jsonb WHERE event_id = $1`, [
    F.eventId,
    JSON.stringify([`r2://setnayan-media/${keep}`, `r2://setnayan-media/${drop}`]),
  ]);
  await setCounter(CAP);
  assert.equal(await reserve(10 * MB), null, 'full: both photos are kept');

  // The couple removes one photo from their gallery (a row edit — the object stays in R2).
  await db.query(`UPDATE public.events SET our_photos = $2::jsonb WHERE event_id = $1`, [
    F.eventId,
    JSON.stringify([`r2://setnayan-media/${keep}`]),
  ]);

  // The settle, as settleCoupleMediaBytes does it: read the rows a ref lives on,
  // measure, write the number through the service-role function.
  const ev = await db.query(`SELECT * FROM public.events WHERE event_id = $1`, [F.eventId]);
  const widgets = await db.query(`SELECT config_json FROM public.invitation_widgets WHERE event_id = $1`, [F.eventId]);
  const draft = await db.query(`SELECT draft_json, applied_snapshot FROM public.event_site_drafts WHERE event_id = $1`, [F.eventId]);
  const referenceText = JSON.stringify([ev.rows[0], widgets.rows, draft.rows[0] ?? null]);
  const used = measureCoupleMediaBytes({ eventId: F.eventId, objects, referenceText, now: new Date() });
  assert.equal(used, 60 * MB, 'only the kept photo counts');
  await asService(() => db.query(`SELECT public.set_couple_media_bytes($1, $2)`, [F.eventId, used]));
  assert.equal(await counter(), 60 * MB, 'the removed photo gave its 40 MB back');

  assert.equal(Number(await reserve(10 * MB)), 70 * MB, 'the upload that was refused now fits');
});
