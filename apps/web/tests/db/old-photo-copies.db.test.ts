/**
 * SMALL COPIES OF OLD PHOTOS — the database half (migration 20271284663331, owner 2026-10-23). Run against the
 * replayed schema, with fixtures:
 *
 *   • THE DRY RUN LISTS THE RIGHT COVERS: a hero Main background that is a photo in the event's OWN folder of the
 *     public media bucket, with no copy yet — and never a theme still, a video, a picture in another event's
 *     folder, a copy (`….web.jpg`), or a cover already copied;
 *   • THE PRESS POINTS ONE COVER AT ITS COPY: only that row, only the `media` key (the rest of the cover is kept),
 *     and the ledger records the pair, both sizes and who pressed;
 *   • IT NEVER GUESSES: a cover the couple changed meanwhile is left alone and nothing is recorded; a copy outside the
 *     event's folder, not `.web.jpg`, or not smaller is refused;
 *   • IDEMPOTENT: the copied cover drops off the list, and a second press changes nothing;
 *   • 🔒 SERVICE ROLE ONLY: anon and a signed-in user — even an admin's browser session — cannot run either function
 *     or read the ledger (the admin page reads it with the service role behind requireAdmin); the positive control
 *     (service role) succeeds.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let adminUser = '';
const ev: Record<string, string> = {};

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
async function as<T>(role: 'service_role' | 'anon' | 'authenticated', fn: () => Promise<T>, uid: string | null = null): Promise<T> {
  await setRole(role);
  if (uid) await setAuthUid(db, uid);
  await db.exec(`SET ROLE ${role}`);
  try {
    return await fn();
  } finally {
    await reset();
  }
}
const folder = (eventId: string) => `r2://setnayan-media/events/${eventId}/`;
async function setMain(eventId: string, main: unknown): Promise<void> {
  await db.query(
    `UPDATE public.invitation_widgets SET config_json = jsonb_set(COALESCE(config_json, '{}'::jsonb), '{main}', $2::jsonb) WHERE event_id = $1 AND widget_type = 'hero'`,
    [eventId, JSON.stringify(main)],
  );
}
async function mainOf(eventId: string): Promise<Record<string, unknown> | null> {
  const r = await db.query<{ main: Record<string, unknown> | null }>(
    `SELECT config_json -> 'main' AS main FROM public.invitation_widgets WHERE event_id = $1 AND widget_type = 'hero'`,
    [eventId],
  );
  return r.rows[0]?.main ?? null;
}
async function candidates(): Promise<Array<{ event_id: string; original_ref: string }>> {
  return as('service_role', async () => (await db.query<{ event_id: string; original_ref: string }>(`SELECT * FROM public.media_web_copy_candidates(1000)`)).rows);
}
async function apply(eventId: string, original: string, web: string, ob: number, wb: number): Promise<boolean> {
  return as('service_role', async () =>
    (await db.query<{ ok: boolean }>(`SELECT public.apply_media_web_copy($1, $2, $3, $4, $5, $6) AS ok`, [eventId, original, web, ob, wb, adminUser])).rows[0]!.ok,
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  adminUser = (await db.query<{ id: string }>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('photos-admin@photos.test', '{}'::jsonb) RETURNING id`)).rows[0]!.id;
  await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [adminUser]);
  for (const name of ['old', 'theme', 'video', 'foreign', 'copied', 'compressed', 'changed']) {
    ev[name] = (await db.query<{ event_id: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ($1, 'wedding') RETURNING event_id`, [`Photos ${name}`])).rows[0]!.event_id;
  }
  const hero = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.invitation_widgets WHERE widget_type = 'hero' AND event_id = ANY($1::uuid[])`, [Object.values(ev)]);
  assert.equal(hero.rows[0]!.n, Object.keys(ev).length, 'every fixture event was seeded a hero row — or the fixtures below are about nothing');
  await setMain(ev.old!, { kind: 'photo', media: `${folder(ev.old!)}std-background/abc-Prenup7.jpg`, fit: 'cover' });
  await setMain(ev.theme!, { kind: 'photo', media: '/std/backgrounds/garden.webp' });
  await setMain(ev.video!, { kind: 'snippet', media: `${folder(ev.video!)}scene-background/clip.mp4` });
  await setMain(ev.foreign!, { kind: 'photo', media: `${folder(ev.old!)}std-background/abc-Prenup7.jpg` });
  await setMain(ev.copied!, { kind: 'photo', media: `${folder(ev.copied!)}scene-background/x.web.jpg` });
  await setMain(ev.compressed!, { kind: 'photo', media: `${folder(ev.compressed!)}scene-background/small.jpg` });
  await setMain(ev.changed!, { kind: 'photo', media: `${folder(ev.changed!)}std-background/before.jpg` });
});

after(async () => {
  await replay?.db.close();
});

test('the dry run lists exactly the covers in their own folder with no copy yet', async () => {
  const mine = (await candidates()).filter((c) => Object.values(ev).includes(c.event_id));
  const byEvent = Object.fromEntries(mine.map((c) => [c.event_id, c.original_ref]));
  assert.equal(byEvent[ev.old!], `${folder(ev.old!)}std-background/abc-Prenup7.jpg`, 'the old cover is listed');
  assert.ok(ev.compressed! in byEvent, 'a photo in its own folder is listed (its SIZE, read from storage, decides if it is oversized)');
  assert.ok(ev.changed! in byEvent);
  for (const name of ['theme', 'video', 'foreign', 'copied']) {
    assert.ok(!(ev[name]! in byEvent), `${name}: listed, and must not be`);
  }
});

test('the press points one cover at its copy, keeps the rest of the cover, and records the pair', async () => {
  const original = `${folder(ev.old!)}std-background/abc-Prenup7.jpg`;
  const web = `${folder(ev.old!)}std-background/abc-Prenup7.web.jpg`;
  assert.equal(await apply(ev.old!, original, web, 4_320_000, 380_000), true);
  assert.deepEqual(await mainOf(ev.old!), { kind: 'photo', media: web, fit: 'cover' }, 'only `media` moved');
  // The other event that (wrongly) names the same picture is untouched — the press is per event.
  assert.equal((await mainOf(ev.foreign!))?.media, original);
  const ledger = await as('service_role', async () =>
    (await db.query<{ original_ref: string; web_ref: string; original_bytes: string; web_bytes: string; made_by: string; source: string }>(`SELECT * FROM public.media_web_copies WHERE event_id = $1`, [ev.old!])).rows,
  );
  assert.equal(ledger.length, 1);
  assert.deepEqual(
    { ...ledger[0]!, original_bytes: Number(ledger[0]!.original_bytes), web_bytes: Number(ledger[0]!.web_bytes) },
    { ...ledger[0]!, source: 'hero.main', original_ref: original, web_ref: web, original_bytes: 4_320_000, web_bytes: 380_000, made_by: adminUser },
  );
});

test('it is idempotent — the copied cover drops off the list and a second press changes nothing', async () => {
  const mine = (await candidates()).map((c) => c.event_id);
  assert.ok(!mine.includes(ev.old!), 'a copied cover is listed again');
  const original = `${folder(ev.old!)}std-background/abc-Prenup7.jpg`;
  assert.equal(await apply(ev.old!, original, `${folder(ev.old!)}std-background/abc-Prenup7.web.jpg`, 4_320_000, 380_000), false, 'the cover no longer names the original');
  const n = await as('service_role', async () => (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.media_web_copies WHERE event_id = $1`, [ev.old!])).rows[0]!.n);
  assert.equal(n, 1);
});

test('it never guesses: a changed cover, a copy outside the folder, a non-copy name or a bigger copy are refused', async () => {
  const original = `${folder(ev.changed!)}std-background/before.jpg`;
  // The couple picked a new cover after the list was read.
  await setMain(ev.changed!, { kind: 'photo', media: `${folder(ev.changed!)}scene-background/new.jpg` });
  assert.equal(await apply(ev.changed!, original, `${folder(ev.changed!)}std-background/before.web.jpg`, 3_000_000, 300_000), false);
  assert.equal((await mainOf(ev.changed!))?.media, `${folder(ev.changed!)}scene-background/new.jpg`, 'the couple’s new cover is untouched');

  const c = `${folder(ev.compressed!)}scene-background/small.jpg`;
  assert.equal(await apply(ev.compressed!, c, `${folder(ev.old!)}scene-background/small.web.jpg`, 2_000_000, 200_000), false, 'a copy in ANOTHER event’s folder');
  assert.equal(await apply(ev.compressed!, c, `${folder(ev.compressed!)}scene-background/small-copy.jpg`, 2_000_000, 200_000), false, 'not named as a copy');
  assert.equal(await apply(ev.compressed!, c, `${folder(ev.compressed!)}scene-background/small.web.jpg`, 200_000, 250_000), false, 'not smaller');
  assert.equal((await mainOf(ev.compressed!))?.media, c);
  const n = await as('service_role', async () => (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.media_web_copies WHERE event_id = ANY($1::uuid[])`, [[ev.changed!, ev.compressed!]])).rows[0]!.n);
  assert.equal(n, 0, 'a refusal records nothing');
});

test('🔒 service role only — no browser role runs the functions or reads the ledger', async () => {
  for (const [role, uid] of [['anon', null], ['authenticated', adminUser]] as const) {
    await assert.rejects(as(role, () => db.query(`SELECT * FROM public.media_web_copy_candidates(10)`), uid), /permission denied/, `${role} ran the dry run`);
    await assert.rejects(
      as(role, () => db.query(`SELECT public.apply_media_web_copy($1, 'a', 'b', 2, 1, NULL)`, [ev.compressed!]), uid),
      /permission denied/,
      `${role} ran the press`,
    );
    await assert.rejects(as(role, () => db.query(`SELECT * FROM public.media_web_copies`), uid), /permission denied/, `${role} read the ledger`);
  }
  // Positive control: the service role reads the ledger.
  const rows = await as('service_role', async () => (await db.query(`SELECT 1 FROM public.media_web_copies LIMIT 1`)).rows);
  assert.ok(Array.isArray(rows));
});
