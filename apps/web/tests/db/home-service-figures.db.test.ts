/**
 * Home's "Your services" figures — `event_service_figures` (owner "approve all",
 * 2026-10-14) — and Patiktok's catalog row reading PER EVENT.
 *
 * The function is the ONE round trip behind six rows: suppliers watched,
 * cameras set up, live / recorded, reels made, and each paid service's catalog
 * price. These run it as each role in turn, because the property that matters
 * — a refused read is NULL ("—"), never a zero — only exists with the real
 * policies and the real grants in front of it.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F = { couple: '', coordinator: '', guest: '', stranger: '', eventId: '', emptyId: '' };

type Figures = {
  suppliers: number;
  cameras: number;
  live: boolean;
  live_since: string | null;
  recorded: boolean;
  recorded_minutes: number | null;
  reels: number;
  prices: Record<string, number>;
} | null;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}
async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}
async function newEvent(name: string): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ($1, 'wedding', 'civil', 'banquet_hall') RETURNING event_id`,
    [name],
  );
  return ev.rows[0]!.event_id;
}

/** Call the RPC as `uid` under the `authenticated` role — Home's own session. */
async function figuresAs(uid: string | null, eventId: string): Promise<Figures> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
  try {
    const r = await db.query<{ f: Figures }>(`SELECT public.event_service_figures($1::uuid) AS f`, [eventId]);
    return r.rows[0]!.f;
  } finally {
    await reset();
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.couple = await createUser('figures-couple@audit.test');
  F.coordinator = await createUser('figures-coordinator@audit.test');
  F.guest = await createUser('figures-guest@audit.test');
  F.stranger = await createUser('figures-stranger@audit.test');
  F.eventId = await newEvent('Figures Test');
  F.emptyId = await newEvent('Figures Empty');

  for (const [ev, uid, kind] of [
    [F.eventId, F.couple, 'couple'],
    [F.eventId, F.coordinator, 'coordinator'],
    // A LEGITIMATELY invited guest — must not learn the couple's figures.
    [F.eventId, F.guest, 'guest'],
    [F.emptyId, F.couple, 'couple'],
  ] as const) {
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,$3)`, [ev, uid, kind]);
  }

  // Planner · two suppliers on the list, one archived (not watched).
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, archived_at)
     VALUES ($1,'venue','San Agustin',NULL), ($1,'catering','Hizon''s',NULL), ($1,'photographer','Gone',now())`,
    [F.eventId],
  );
  // Live stream · three channels, one switched off.
  await db.query(
    `INSERT INTO public.live_studio_roam_zones (event_id, zone_index, label, status)
     VALUES ($1,1,'Ceremony','planned'), ($1,2,'Reception','live'), ($1,3,'Booth','disabled')`,
    [F.eventId],
  );
  // One broadcast done (2 h 14 min), one live now.
  await db.query(
    `INSERT INTO public.panood_broadcasts (event_id, broadcast_id, stream_id, stream_key, ingestion_url, status, went_live_at, ended_at)
     VALUES ($1,'b1','s1','k1','rtmp://x','complete', now() - interval '1 day' - interval '134 minutes', now() - interval '1 day'),
            ($1,'b2','s2','k2','rtmp://x','live', now() - interval '5 minutes', NULL)`,
    [F.eventId],
  );
  // Video booth · three reels finished, one failed (not a reel).
  await db.query(
    `INSERT INTO public.patiktok_render_jobs (event_id, template_slug, requested_by, duration_sec, status)
     VALUES ($1,'glow',$2,15,'completed'), ($1,'glow',$2,15,'completed'), ($1,'kilig',$2,15,'completed'), ($1,'tanda',$2,15,'failed')`,
    [F.eventId, F.couple],
  );
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('🧾 Patiktok is PER EVENT — its catalog row reads one_time (owner 2026-10-14 🧩)', async () => {
  const r = await db.query<{ billing_period: string; is_active: boolean }>(
    `SELECT billing_period, is_active FROM public.platform_retail_catalog_v2 WHERE service_code = 'PATIKTOK_COMPILER'`,
  );
  assert.equal(r.rows.length, 1, 'PATIKTOK_COMPILER is missing from the catalog');
  assert.equal(r.rows[0]!.billing_period, 'one_time', 'the catalog still sells the booth by the day');
});

test('the COUPLE gets every figure, counted the way each page counts it', async () => {
  const f = await figuresAs(F.couple, F.eventId);
  assert.ok(f, 'the couple was refused their own figures');
  assert.equal(f.suppliers, 2, 'an archived supplier is not watched');
  assert.equal(f.cameras, 2, 'a switched-off channel is not a camera');
  assert.equal(f.live, true);
  assert.ok(f.live_since, 'a live broadcast says since when');
  assert.equal(f.recorded, true);
  assert.equal(f.recorded_minutes, 134, 'the recording is ended − went live, in minutes');
  assert.equal(f.reels, 3, 'a failed render is not a reel');
  // Every paid service on sale has its catalog price — read, never typed.
  for (const code of ['LIVE_STUDIO', 'PAKANTA', 'PATIKTOK_COMPILER', 'COUPLE_WEBSITE_PRO']) {
    const row = await db.query<{ retail_price_php: string; is_active: boolean }>(
      `SELECT retail_price_php, is_active FROM public.platform_retail_catalog_v2 WHERE service_code = $1`,
      [code],
    );
    if (row.rows[0]?.is_active) {
      assert.equal(Number(f.prices[code]), Number(row.rows[0].retail_price_php), `${code}'s price is not the catalog's`);
    } else {
      assert.equal(f.prices[code], undefined, `${code} is off sale but still priced`);
    }
  }
});

test('a COORDINATOR sees the same figures (the widening Home\'s Papic counts got)', async () => {
  const f = await figuresAs(F.coordinator, F.eventId);
  assert.ok(f);
  assert.equal(f.suppliers, 2);
  assert.equal(f.reels, 3);
});

test('an event with nothing yet is ZEROS for its couple — measured, not refused', async () => {
  const f = await figuresAs(F.couple, F.emptyId);
  assert.ok(f, 'an empty event read as a refusal');
  assert.equal(f.suppliers, 0);
  assert.equal(f.cameras, 0);
  assert.equal(f.live, false);
  assert.equal(f.recorded, false);
  assert.equal(f.recorded_minutes, null);
  assert.equal(f.reels, 0);
});

test('🔒 a guest, a stranger and a signed-out caller get NULL — never zeros', async () => {
  assert.equal(await figuresAs(F.guest, F.eventId), null, 'an invited guest learned the couple\'s figures');
  assert.equal(await figuresAs(F.stranger, F.eventId), null, 'a stranger learned the figures');
  assert.equal(await figuresAs(null, F.eventId), null, 'a signed-out caller learned the figures');
});

test('🔒 the function is closed to anon and open to authenticated', async () => {
  const r = await db.query<{ anon: boolean; auth: boolean }>(
    `SELECT has_function_privilege('anon', 'public.event_service_figures(uuid)', 'EXECUTE') AS anon,
            has_function_privilege('authenticated', 'public.event_service_figures(uuid)', 'EXECUTE') AS auth`,
  );
  assert.equal(r.rows[0]!.anon, false);
  assert.equal(r.rows[0]!.auth, true);
});
