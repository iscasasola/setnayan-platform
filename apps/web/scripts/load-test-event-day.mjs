#!/usr/bin/env node
/**
 * load-test-event-day.mjs — N GUESTS OPEN ONE EVENT'S HUB ON THE DAY, WHILE THE COORDINATOR ANNOUNCES AND THE
 * SUPPLIERS SCAN (EV1 · owner 2026-10-28: "Our priority is not crash any event hub most specially during their event").
 *
 * ⛔ NEVER POINT THIS AT PRODUCTION. It refuses any base URL that is not localhost / 127.0.0.1. Run it against a LOCAL
 * production build (`next build && next start`) wired to the lab stand-in (`scripts/event-day-lab-stub.mjs`), which
 * counts every database round trip the app makes and how many it had open at once.
 *
 * WHAT ONE SIMULATED GUEST DOES (what a phone does on the day, from `use-event-pulse.ts`, `live-wall-block.tsx` and
 * `day-of-announcement.tsx`):
 *   1. opens the hub — GET /<slug> with their own guest pass (signed like the redeem signs it);
 *   2. asks for its own bits — the announcement read (`--mode after`: GET /<slug>/announcement; `--mode before`: the
 *      `latestAnnouncementForGuest` server action the old page posted);
 *   3. keeps polling while the page is open: /<slug>/live-pulse every 12 s ± 20 %, /<slug>/live-wall every 25 s ± 20 %
 *      (stops for good on a 404, like the block), the announcement every 45 s ± 20 %;
 *   4. re-opens the hub once mid-run (a pull-to-refresh / coming back to the tab).
 * Guests arrive spread over `--ramp` seconds and stay until the end (`--ramp` + `--hold`).
 * Meanwhile `--scanners` supplier phones check guests in (the `checkInGuest` server action, as the couple's account)
 * every ~3 s, and at `--announce-at` seconds the coordinator posts an announcement; the run reports how long until
 * every polling guest has seen it.
 *
 * THE PASS BAR (EV1, written in the PR): 500 guests over 2 minutes · hub p95 < 1.5 s · 0 errors · the database
 * stand-in never has 40 or more requests open at once (prod max_connections = 60).
 *
 * Run (from apps/web, with the stub and `next start` up):
 *   GUEST_SESSION_SECRET=… node scripts/load-test-event-day.mjs --base http://localhost:3000 --stub http://127.0.0.1:54321 \
 *     --slug lab-public --guests 500 --ramp 120 --hold 60 --mode after --next-dir .next --out /tmp/run.json
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const BASE = (args.base ?? 'http://localhost:3000').replace(/\/$/, '');
const STUB = (args.stub ?? 'http://127.0.0.1:54321').replace(/\/$/, '');
const SLUG = args.slug ?? 'lab-public';
const GUESTS = Number(args.guests ?? 500);
const RAMP = Number(args.ramp ?? 120);
const HOLD = Number(args.hold ?? 60);
const MODE = args.mode ?? 'after';
const SCANNERS = Number(args.scanners ?? 4);
const ANNOUNCE_AT = Number(args['announce-at'] ?? Math.round(RAMP * 0.75));
const NEXT_DIR = args['next-dir'] ?? '.next';
/**
 * `--edge 1` — open the hub the way Vercel's edge serves it AFTER the middleware's rewrite: straight at the cached copy's
 * address (`/{slug}/cached/{key}`, the key computed here exactly as lib/hub-view-key.ts does). `next start` hands a
 * rewritten request its ORIGINAL url, so behind the middleware it always renders; Vercel invokes the rewritten path.
 * Needs the server started with HUB_VIEW_LAB_DIRECT=1 (a lab switch — never set on Vercel).
 */
const EDGE = args.edge === '1';
/** The event's stamp — part of the cached copy's key (`--edge 1`), read from the stand-in before the run. */
let REV = '0';
const SECRET = process.env.GUEST_SESSION_SECRET ?? '';

for (const u of [BASE, STUB]) {
  const host = new URL(u).hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    console.error(`refusing ${u}: this load test only runs against a local build and the lab stand-in`);
    process.exit(2);
  }
}
if (SECRET.length < 32) {
  console.error('GUEST_SESSION_SECRET (the lab value the server was started with) is required');
  process.exit(2);
}

// ── Server action ids, read from the build (the protocol a phone uses: POST + `Next-Action: <id>`) ─────────────
function actionIdsByName() {
  const out = {};
  const dir = path.join(NEXT_DIR, 'static', 'chunks');
  const walk = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith('.js')) {
        const src = fs.readFileSync(p, 'utf8');
        for (const m of src.matchAll(/createServerReference\)\("([0-9a-f]{40,})"[^)]*?"([A-Za-z0-9_$]+)"\)/g)) out[m[2]] = m[1];
      }
    }
  };
  try {
    walk(dir);
  } catch {
    /* no build dir → no actions */
  }
  return out;
}
const ACTIONS = actionIdsByName();

// ── Helpers ────────────────────────────────────────────────────────────────────────────────────────────────────
const b64u = (x) => Buffer.from(x).toString('base64url');
function passCookie(g) {
  const head = b64u(JSON.stringify({ alg: 'HS256' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64u(JSON.stringify({ guest_id: g.guest_id, event_id: g.event_id, qr_token: g.qr_token, iat: now, exp: now + 86400 }));
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `setnayan_guest_session=${head}.${body}.${sig}`;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** lib/hub-view-key.ts `hubPassMac`, in node. */
const hubMac = (guestId, qr) =>
  crypto.createHmac('sha256', SECRET).update(`hub-view-v1|${guestId.toLowerCase()}|${qr}`).digest().subarray(0, 16).toString('base64url');
const jitter = (ms) => Math.round(ms * (0.8 + 0.4 * Math.random()));
const now = () => performance.now();

const samples = {}; // route → [{ms, status, cache}]
const errors = [];
let stopping = false;
async function hit(route, url, init = {}) {
  const t0 = now();
  try {
    const res = await fetch(url, { redirect: 'manual', ...init, signal: AbortSignal.timeout(30_000) });
    const body = await res.text();
    const ms = now() - t0;
    const cache = res.headers.get('x-nextjs-cache') ?? res.headers.get('x-vercel-cache') ?? '';
    (samples[route] ??= []).push({ ms, status: res.status, cache, bytes: body.length });
    if (res.status >= 500 || (route === 'hub' && res.status !== 200)) errors.push({ route, status: res.status, at: new Date().toISOString(), head: body.slice(0, 160) });
    return { status: res.status, body, headers: res.headers };
  } catch (err) {
    const ms = now() - t0;
    (samples[route] ??= []).push({ ms, status: 0, cache: '' });
    errors.push({ route, status: 0, at: new Date().toISOString(), head: String(err).slice(0, 160) });
    return { status: 0, body: '', headers: new Headers() };
  }
}
const action = (route, pathName, id, body, cookie, contentType = 'text/plain;charset=UTF-8') =>
  hit(route, `${BASE}${pathName}`, {
    method: 'POST',
    headers: { 'Next-Action': id, 'Content-Type': contentType, Accept: 'text/x-component', cookie },
    body,
  });

// ── The run ────────────────────────────────────────────────────────────────────────────────────────────────────
const fixture = await (await fetch(`${STUB}/__fixture`)).json();
const event = fixture.events.find((e) => e.slug === SLUG);
if (!event) throw new Error(`no event ${SLUG} at the stand-in`);
const guests = fixture.guests.filter((g) => g.event_id === event.event_id).slice(0, GUESTS);
const hostCookie = await (async () => {
  const k = await (await fetch(`${STUB}/__keys?as=host`)).json();
  return `${k.cookieName}=${k.cookieValue}`;
})();
if (EDGE) {
  const st = await (await fetch(`${STUB}/rest/v1/rpc/event_public_stamp`, { method: 'POST', body: JSON.stringify({ p_slug: SLUG }) })).json();
  REV = String(st?.[0]?.rev ?? 0);
}
await fetch(`${STUB}/__reset`);
const started = Date.now();
const until = started + (RAMP + HOLD) * 1000;
const announcement = { text: null, postedAt: null, seenBy: new Map() };

async function announcementRead(g, cookie) {
  if (MODE === 'before') {
    const id = ACTIONS.latestAnnouncementForGuest;
    if (!id) return null;
    const r = await action('announcement', `/${SLUG}`, id, JSON.stringify([event.event_id]), cookie);
    return r.body;
  }
  const r = await hit('announcement', `${BASE}/${SLUG}/announcement`, { headers: { cookie } });
  return r.body;
}
function noteSeen(g, body) {
  if (announcement.text && body && body.includes(announcement.text) && !announcement.seenBy.has(g.guest_id)) {
    announcement.seenBy.set(g.guest_id, Date.now() - announcement.postedAt);
  }
}

const hubUrl = (g) =>
  EDGE ? `${BASE}/${SLUG}/cached/v1.${REV}.g${g.guest_id.replace(/-/g, '')}${hubMac(g.guest_id, g.qr_token)}.000x.-.-` : `${BASE}/${SLUG}`;

async function guest(g, i) {
  await sleep((RAMP * 1000 * i) / Math.max(GUESTS, 1));
  const cookie = passCookie(g);
  await hit('hub', hubUrl(g), { headers: { cookie } });
  noteSeen(g, await announcementRead(g, cookie));
  let wallOpen = true;
  const reopenAt = Date.now() + (until - Date.now()) * Math.random();
  let reopened = false;
  let nextPulse = Date.now() + jitter(12_000);
  let nextWall = Date.now() + jitter(25_000);
  let nextAnn = Date.now() + jitter(45_000);
  while (!stopping && Date.now() < until) {
    const t = Math.min(nextPulse, wallOpen ? nextWall : Infinity, nextAnn, reopened ? Infinity : reopenAt);
    await sleep(Math.max(0, t - Date.now()));
    if (Date.now() >= until) break;
    if (!reopened && Date.now() >= reopenAt) {
      reopened = true;
      await hit('hub', hubUrl(g), { headers: { cookie } });
    }
    if (Date.now() >= nextPulse) {
      await hit('pulse', `${BASE}/${SLUG}/live-pulse`, { headers: { cookie } });
      nextPulse = Date.now() + jitter(12_000);
    }
    if (wallOpen && Date.now() >= nextWall) {
      const r = await hit('wall', `${BASE}/${SLUG}/live-wall`, { headers: { cookie } });
      if (r.status === 404) wallOpen = false;
      nextWall = Date.now() + jitter(25_000);
    }
    if (Date.now() >= nextAnn) {
      noteSeen(g, await announcementRead(g, cookie));
      nextAnn = Date.now() + jitter(45_000);
    }
  }
}

async function scanner(s) {
  const id = ACTIONS.checkInGuest;
  if (!id) return;
  await sleep(5_000 + s * 700);
  while (!stopping && Date.now() < until) {
    const g = guests[Math.floor(Math.random() * guests.length)];
    await action('scan', `/dashboard/${event.event_id}/guests/checkin`, id, JSON.stringify([event.event_id, g.guest_id, 'qr']), hostCookie);
    await sleep(jitter(3_000));
  }
}

async function announcer() {
  await sleep(ANNOUNCE_AT * 1000);
  const text = `Lab announcement ${crypto.randomBytes(3).toString('hex')}`;
  announcement.text = text;
  announcement.postedAt = Date.now();
  const id = ACTIONS.sendCoordinatorBroadcast;
  let via = 'stub';
  if (id) {
    // A single FormData argument, as React encodes it (`encodeReply`): the root names part 1, whose fields follow.
    const fd = new FormData();
    fd.append('0', '["$K1"]');
    fd.append('1_event_id', event.event_id);
    fd.append('1_body', text);
    const r = await hit('announce', `${BASE}/dashboard/${event.event_id}/schedule`, {
      method: 'POST',
      headers: { 'Next-Action': id, Accept: 'text/x-component', cookie: hostCookie },
      body: fd,
    });
    via = r.status === 200 && /"ok":true/.test(r.body) ? 'action' : `action-refused(${r.status})`;
  }
  if (via !== 'action') {
    // The coordinator's write, made straight at the stand-in (the same row the action would insert).
    await fetch(`${STUB}/rest/v1/coordinator_broadcasts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ broadcast_id: `cb-run-${Date.now()}`, event_id: event.event_id, body: text, created_by: fixture.hostUserId }),
    });
  }
  announcement.via = via;
}

const stamp = setInterval(async () => {
  try {
    const s = await (await fetch(`${STUB}/__stats`)).json();
    process.stderr.write(`t+${Math.round((Date.now() - started) / 1000)}s db=${s.total} open-max=${s.maxInFlight} errors=${errors.length}\n`);
  } catch {
    /* stub gone */
  }
}, 15_000);

await Promise.all([...guests.map((g, i) => guest(g, i)), ...Array.from({ length: SCANNERS }, (_, s) => scanner(s)), announcer()]);
stopping = true;
clearInterval(stamp);

// ── Report ─────────────────────────────────────────────────────────────────────────────────────────────────────
const pct = (xs, p) => (xs.length ? xs[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] : null);
const routes = {};
for (const [route, xs] of Object.entries(samples)) {
  const ms = xs.map((x) => x.ms).sort((a, b) => a - b);
  const codes = {};
  for (const x of xs) codes[x.status] = (codes[x.status] ?? 0) + 1;
  const hits = xs.filter((x) => /HIT|STALE/i.test(x.cache)).length;
  routes[route] = {
    n: xs.length,
    p50: Math.round(pct(ms, 50)),
    p95: Math.round(pct(ms, 95)),
    p99: Math.round(pct(ms, 99)),
    max: Math.round(ms[ms.length - 1] ?? 0),
    cacheHit: xs.length ? +(hits / xs.length).toFixed(2) : 0,
    codes,
  };
}
const db = await (await fetch(`${STUB}/__stats`)).json();
const seen = [...announcement.seenBy.values()].sort((a, b) => a - b);
const report = {
  mode: MODE,
  edge: EDGE,
  base: BASE,
  slug: SLUG,
  guests: guests.length,
  rampSeconds: RAMP,
  holdSeconds: HOLD,
  actionsFound: Object.keys(ACTIONS).filter((k) => ['latestAnnouncementForGuest', 'checkInGuest', 'sendCoordinatorBroadcast'].includes(k)),
  routes,
  errors: errors.length,
  sampleErrors: errors.slice(0, 8),
  database: { requests: db.total, perSecondPeak: db.perSecondPeak, maxOpenAtOnce: db.maxInFlight, byKind: db.byKind, top: Object.entries(db.byName).sort((a, b) => b[1] - a[1]).slice(0, 15) },
  announcement: {
    via: announcement.via,
    seenBy: seen.length,
    p50SeenMs: pct(seen, 50),
    p95SeenMs: pct(seen, 95),
  },
};
const hub = routes.hub ?? { p95: Infinity, n: 0 };
report.passBar = {
  hubP95Under1500: hub.p95 !== null && hub.p95 < 1500,
  zeroErrors: errors.length === 0,
  dbOpenUnder40: db.maxInFlight < 40,
};
report.pass = Object.values(report.passBar).every(Boolean);
if (args.out) fs.writeFileSync(args.out, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
process.exit(0);
