/**
 * ⚡ CHAT ARRIVES INSTANTLY — the load test (owner 2026-10-29 pass bar: "200 signed-in + 50 msg/min … DB CPU/time +
 * connections ≤ main; reconnect backoff + jitter; one channel per user").
 *
 * ── TWO HALVES ──────────────────────────────────────────────────────────────
 *   1 · REQUESTS (always). Runs the REAL client machines — `createUserLive` (lib/user-live.ts) and
 *       `followEnvelopeLive` (lib/unread-follow.ts) — for USERS people on a fake clock for MINUTES minutes while
 *       MSGS_PER_MIN chat messages land, each pinging its real recipient count (RECIPIENTS). It counts what reaches the
 *       database: unread-count RPCs, channel joins, broadcast rows. Then the same people on main (the 60 s poll).
 *       A second pass kills Realtime at minute 1 for everybody at once and counts the rejoin attempts (the storm bar).
 *   2 · DATABASE (`--db`). Replays the REAL migrations into PGlite and times INSERTs into chat_messages three ways:
 *       no trigger (main), trigger with the stamp OFF (the shipped default), trigger ON (stubbed realtime.send).
 *
 * ⚠ WHAT IT CANNOT MEASURE. There is no Realtime server here (no Docker on the build machine), so Realtime's own CPU,
 * its replication read of realtime.messages, and real socket counts are NOT measured — those are Supabase's published
 * limits (PR body, CAPACITY). PGlite is one in-process session: every DB number is a CEILING, never a forecast.
 *
 * ⛔ NEVER POINT THIS AT PRODUCTION. It opens no network connection at all: the client half is a fake clock, the
 * database half is an in-memory database it creates and throws away.
 *
 * Run (from apps/web):  npx tsx scripts/loadtest-chat-live.mts            # requests only, seconds
 *                       npx tsx scripts/loadtest-chat-live.mts --db       # + the PGlite insert timing (heavy lane)
 * Knobs: USERS=200 MINUTES=5 MSGS_PER_MIN=50 RECIPIENTS=3 INSERTS=2000
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TabEnv } from '../lib/tab-return';
import { startCountPoll } from '../lib/tab-return';
import { createUserLive, type LiveListener, type Transport } from '../lib/user-live';
import { followEnvelopeLive } from '../lib/unread-follow';

const USERS = Number(process.env.USERS ?? 200);
const MINUTES = Number(process.env.MINUTES ?? 5);
const MSGS_PER_MIN = Number(process.env.MSGS_PER_MIN ?? 50);
const RECIPIENTS = Number(process.env.RECIPIENTS ?? 3);
const INSERTS = Number(process.env.INSERTS ?? 2_000);

/** Deterministic, so two runs print the same table. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** One clock shared by every simulated tab. */
function world() {
  let t = 0;
  let id = 0;
  const timers = new Map<number, { at: number; cb: () => void; every?: number }>();
  const env: TabEnv = {
    isVisible: () => true,
    onWake: () => () => {},
    onVisibility: () => () => {},
    now: () => t,
    setInterval: (cb, ms) => (timers.set(++id, { at: t + ms, cb, every: ms }), id),
    clearInterval: (h) => void timers.delete(h as number),
    setTimeout: (cb, ms) => (timers.set(++id, { at: t + ms, cb }), id),
    clearTimeout: (h) => void timers.delete(h as number),
  };
  const flush = async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  };
  return {
    env,
    now: () => t,
    async until(end: number) {
      for (;;) {
        let best: [number, { at: number; cb: () => void; every?: number }] | null = null;
        for (const e of timers) if (e[1].at <= end && (!best || e[1].at < best[1].at)) best = e;
        if (!best) break;
        const [h, x] = best;
        t = x.at;
        if (x.every) x.at += x.every;
        else timers.delete(h);
        x.cb();
        await flush();
      }
      t = end;
      await flush();
    },
  };
}

const sb = {} as SupabaseClient;

async function requests(mode: 'main' | 'live', outageAtMs: number | null) {
  const w = world();
  const random = rng(7);
  let reads = 0;
  let joins = 0;
  let realtimeUp = true;
  const listeners: Array<{ ping: () => void }> = [];

  for (let u = 0; u < USERS; u += 1) {
    const read = async () => {
      reads += 1;
      return 0;
    };
    if (mode === 'main') {
      startCountPoll({ read, onValue: () => {}, env: w.env });
      continue;
    }
    const open: Array<{ status: (s: string) => void; closed: boolean }> = [];
    const transport: Transport = (h) => {
      joins += 1;
      const ch = { status: h.onStatus, closed: false };
      open.push(ch);
      w.env.setTimeout(() => !ch.closed && h.onStatus(realtimeUp ? 'SUBSCRIBED' : 'CHANNEL_ERROR'), 150);
      listeners[u] = { ping: () => !ch.closed && h.onPing({ event: 'chat_message', payload: {} }) };
      return () => {
        ch.closed = true;
      };
    };
    const live = createUserLive({ transport, env: w.env, random });
    const subscribe = (_s: SupabaseClient, _u: string, l: LiveListener) => live.subscribe(l);
    followEnvelopeLive({ supabase: sb, userId: `u${u}`, onValue: () => {}, subscribe, read, env: w.env });
    if (outageAtMs !== null) {
      w.env.setTimeout(() => {
        realtimeUp = false;
        for (const ch of open) if (!ch.closed) ch.status('CHANNEL_ERROR');
      }, outageAtMs);
    }
  }

  let broadcasts = 0;
  const gap = 60_000 / MSGS_PER_MIN;
  for (let m = 0; m * gap < MINUTES * 60_000; m += 1) {
    w.env.setTimeout(() => {
      for (let r = 0; r < RECIPIENTS; r += 1) {
        broadcasts += 1;
        if (mode === 'live' && realtimeUp) listeners[Math.floor(random() * USERS)]?.ping();
      }
    }, m * gap + random() * gap);
  }
  await w.until(MINUTES * 60_000);
  return { reads, joins, broadcasts: mode === 'live' ? broadcasts : 0 };
}

async function database() {
  const { createReplayedDb, setAuthUid } = await import('../tests/db/replay-migrations');
  const { db } = await createReplayedDb();
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS realtime;
    CREATE TABLE IF NOT EXISTS realtime.sent (n BIGSERIAL PRIMARY KEY, topic TEXT, event TEXT, payload JSONB);
    CREATE OR REPLACE FUNCTION realtime.send(payload JSONB, event TEXT, topic TEXT, private BOOLEAN DEFAULT TRUE)
    RETURNS VOID LANGUAGE sql AS $$ INSERT INTO realtime.sent (topic, event, payload) VALUES (topic, event, payload) $$;
  `);
  const user = async (email: string) =>
    (await db.query<{ id: string }>(`INSERT INTO auth.users (email) VALUES ($1) RETURNING id`, [email])).rows[0]!.id;
  const bride = await user('load-bride@chat.test');
  const groom = await user('load-groom@chat.test');
  const owner = await user('load-owner@chat.test');
  const vendor = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Load Studio') RETURNING vendor_profile_id`,
      [owner],
    )
  ).rows[0]!.vendor_profile_id;
  const ev = (await db.query<{ event_id: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ('Load', 'birthday') RETURNING event_id`)).rows[0]!.event_id;
  for (const u of [bride, groom]) await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [ev, u]);
  // A big day: 300 guests on the event — the partial index must keep them out of the couple lookup.
  for (let g = 0; g < 300; g += 1) {
    const gid = await user(`load-guest-${g}@chat.test`);
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'guest')`, [ev, gid]);
  }
  const th = (
    await db.query<{ thread_id: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id) VALUES ($1,$2,$3) RETURNING thread_id`,
      [ev, vendor, bride],
    )
  ).rows[0]!.thread_id;
  await setAuthUid(db, bride);

  const run = async (label: string) => {
    const t0 = performance.now();
    for (let i = 0; i < INSERTS; i += 1) {
      await db.query(`INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_user_id, body) VALUES ($1,$2,$3,$4,$5)`, [
        th,
        ev,
        vendor,
        bride,
        `load ${label} ${i}`,
      ]);
    }
    const ms = performance.now() - t0;
    const sent = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM realtime.sent`)).rows[0]!.n;
    await db.exec(`TRUNCATE realtime.sent`);
    return { label, perInsertMs: ms / INSERTS, pings: sent };
  };

  const out = [];
  await db.exec(`ALTER TABLE public.chat_messages DISABLE TRIGGER chat_messages_ping_recipients`);
  out.push(await run('no trigger (main)'));
  await db.exec(`ALTER TABLE public.chat_messages ENABLE TRIGGER chat_messages_ping_recipients`);
  await db.query(`UPDATE public.platform_settings SET chat_live_pings_live = FALSE WHERE id = 1`);
  out.push(await run('trigger, stamp OFF (default)'));
  await db.query(`UPDATE public.platform_settings SET chat_live_pings_live = TRUE WHERE id = 1`);
  out.push(await run('trigger, stamp ON'));
  await db.close();
  return out;
}

async function main() {
  console.log(`USERS=${USERS} · ${MINUTES} min · ${MSGS_PER_MIN} msg/min · ${RECIPIENTS} recipients/msg (one visible tab each)\n`);
  const main_ = await requests('main', null);
  const live = await requests('live', null);
  const storm = await requests('live', 60_000);
  const perMin = (n: number) => (n / MINUTES).toFixed(1);
  console.log('| | unread RPCs | RPCs/min | channel joins | broadcast rows |');
  console.log('|---|---:|---:|---:|---:|');
  console.log(`| main (60 s poll) | ${main_.reads} | ${perMin(main_.reads)} | 0 | 0 |`);
  console.log(`| live, Realtime up | ${live.reads} | ${perMin(live.reads)} | ${live.joins} | ${live.broadcasts} |`);
  console.log(`| live, Realtime dies at 1:00 | ${storm.reads} | ${perMin(storm.reads)} | ${storm.joins} | — |`);
  console.log(`\nStorm bar: ${storm.joins - USERS} rejoin attempts by ${USERS} people over ${MINUTES - 1} min after a total outage (cap ${USERS} × 5 = ${USERS * 5}).`);

  if (process.argv.includes('--db')) {
    console.log(`\nPGlite, ${INSERTS} inserts each (one session — a ceiling, not a forecast; 300 guests on the event):`);
    console.log('| | ms / insert | pings written |');
    console.log('|---|---:|---:|');
    for (const r of await database()) console.log(`| ${r.label} | ${r.perInsertMs.toFixed(3)} | ${r.pings} |`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
