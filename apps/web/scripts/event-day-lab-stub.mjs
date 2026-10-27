#!/usr/bin/env node
/**
 * event-day-lab-stub.mjs — A LOCAL STAND-IN FOR SUPABASE (PostgREST + Auth) FOR THE EVENT-DAY LOAD TEST AND WALKS.
 *
 * ⛔ NOTHING HERE CAN REACH PRODUCTION. The app under test is pointed at THIS process with
 * `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:<port>`; every database and auth answer comes from fixtures held in
 * memory, generated on start. Owner rule (DECISION_LOG 2026-10-28 "NO EVENT HUB MAY CRASH"): the load test runs
 * against a LOCAL production build, never against production.
 *
 * WHAT IT MODELS (enough for the guest Event Hub to render every visibility mode, not a database):
 *   · four live events (on the day, Manila) — `lab-public` · `lab-unlisted` · `lab-private` · `lab-invited`
 *     (`landing_page_visibility` public · unlisted · private · invited_accounts), each pinned to The Day;
 *   · `--guests N` guests on `lab-public` (3 on the others), seated 10 to a table, a run of show, a published floor plan;
 *   · two signed-in accounts — the couple (`host`) and a guest who bound their account to a seat (`seat`);
 *   · the stamp RPC `event_public_stamp` (bumped by `/__bump?slug=`), so the guest page's shared reads behave.
 * Writes to `coordinator_broadcasts` and `guest_checkins` are KEPT (an announcement or a scan is seen by the next
 * read); every other write is accepted and dropped.
 *
 * WHAT IT MEASURES — every request it answers is a database (or auth) round trip the app made:
 *   GET /__stats   → { total, byKind, byName, maxInFlight, inFlight, perSecondPeak } since the last reset
 *   GET /__reset   → zero the counters
 *   GET /__keys?as=host|seat → { cookieName, cookieValue } — a Supabase session cookie for that account
 *   GET /__fixture → { events, guests: [{ guest_id, event_id, qr_token }] } — what the load test signs passes for
 * `maxInFlight` is the most requests the app had open at this stand-in at once: the stand-in for "database
 * connections in use" (the pass bar's "< 40 of 60").
 *
 * Run:  node scripts/event-day-lab-stub.mjs --port 54321 --guests 500 [--delay 8]
 *   --delay  every answer waits this many ms (a stand-in for the network + query time; default 8).
 */
import http from 'node:http';
import crypto from 'node:crypto';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const PORT = Number(args.port ?? 54321);
const GUESTS = Number(args.guests ?? 500);
const DELAY = Number(args.delay ?? 8);

// ── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
const iso = (h) => `${today}T${String(h).padStart(2, '0')}:00:00+08:00`;
const uuid = (prefix, n) => `${prefix}-${String(n).padStart(4, '0')}-4000-8000-${String(n).padStart(12, '0')}`;
const HOST = '11111111-1111-4111-8111-111111111111';
const SEAT_USER = '11111111-1111-4111-8111-222222222222';
const VIS = { 'lab-public': 'public', 'lab-unlisted': 'unlisted', 'lab-private': 'private', 'lab-invited': 'invited_accounts' };

const db = {
  events: [],
  guests: [],
  event_members: [],
  event_moderators: [],
  event_tables: [],
  event_seat_assignments: [],
  event_schedule_blocks: [],
  event_floor_plan: [],
  coordinator_broadcasts: [],
  guest_checkins: [],
  orders: [],
  users: [
    { user_id: HOST, email: 'couple@example.test', display_name: 'Lab Couple', account_type: 'couple', is_internal: false, is_team_member: false },
    { user_id: SEAT_USER, email: 'seat@example.test', display_name: 'Lab Seat', account_type: 'couple', is_internal: false, is_team_member: false },
  ],
};
const revs = {};
let e = 0;
for (const [slug, vis] of Object.entries(VIS)) {
  e += 1;
  const EV = uuid('22222222', e);
  revs[EV] = 1;
  db.events.push({
    event_id: EV, public_id: `S89E-LAB0000${e}`, slug, display_name: `Lab ${vis} & Co`, event_type: 'wedding',
    event_date: today, event_end_date: null, status: 'active', is_public: vis === 'public', visibility: vis,
    landing_page_visibility: vis, scheduled_launch_at: null, launch_mode: 'manual', manual_phase: 'event',
    std_invitation_launch_date: null, created_by: HOST, created_at: '2026-01-01T00:00:00Z', timezone: 'Asia/Manila',
    venue_name: 'Manila Hotel', venue_address: 'Roxas Blvd', venue_latitude: 14.58, venue_longitude: 120.97,
    panood_watch_url: null, panood_watch_url_facebook: null, live_photo_wall_visibility: 'all_with_consent',
    archived: false, live_mode_override: null, love_story: {}, invite_theme: null, is_sample: false, cleared_at: null,
    monogram_text: 'L&C', reveal_stages: null, style_preferences: null,
  });
  db.event_members.push({ event_id: EV, user_id: HOST, member_type: 'couple', guest_id: null, hidden_at: null, can_edit_site: true });
  const n = slug === 'lab-public' ? GUESTS : 3;
  for (let g = 1; g <= n; g++) {
    const G = uuid(`3333${String(e).padStart(4, '0')}`, g);
    const T = uuid(`4444${String(e).padStart(4, '0')}`, Math.ceil(g / 10));
    db.guests.push({
      guest_id: G, event_id: EV, first_name: `Guest${g}`, last_name: 'Lab', display_name: `Guest${g} Lab`, name_prefix: null,
      middle_name: null, name_suffix: null, rsvp_status: 'attending', qr_token: `qr${e}x${String(g).padStart(6, '0')}`,
      plus_one_of_guest_id: null, plus_one_name_confirmed_at: null, couple_with_guest_id: null, represented_by_guest_id: null,
      deleted_at: null, faceblock_enabled: false, role: null, extra_roles: [], entry_source: 'host', custom_tags: [],
      attire: null, gender: null, email: null, mobile: null, avatar_url: null, invitation_sent_at: null,
    });
    if (g % 10 === 1) {
      db.event_tables.push({ table_id: T, event_id: EV, table_label: `Table ${Math.ceil(g / 10)}`, link_group_label: null, table_type: 'round', capacity: 10, sort_order: Math.ceil(g / 10) });
    }
    db.event_seat_assignments.push({ event_id: EV, guest_id: G, table_id: T, seat_number: ((g - 1) % 10) + 1 });
  }
  // The seat-holder account is bound to the first guest of every event.
  db.event_members.push({ event_id: EV, user_id: SEAT_USER, member_type: 'guest', guest_id: uuid(`3333${String(e).padStart(4, '0')}`, 1), hidden_at: null });
  const block = (id, label, h, state) => ({
    block_id: `${EV.slice(0, 8)}-b${id}`, event_id: EV, label, start_at: iso(h), end_at: iso(h + 1), location: 'Hall', run_state: state,
    actual_start_at: state === 'upcoming' ? null : iso(h), is_public: true, audience: null, visibility: 'couple', parent_block_id: null,
    sort_order: h, block_type: 'ceremony', description: null, released_at: null,
  });
  db.event_schedule_blocks.push(block(1, 'Ceremony', 15, 'done'), block(2, 'Cocktails', 17, 'live'), block(3, 'Dinner', 19, 'upcoming'));
  db.event_floor_plan.push({ event_id: EV, published_at: '2026-10-01T00:00:00Z' });
  db.coordinator_broadcasts.push({ broadcast_id: `cb-${e}`, event_id: EV, body: 'Dinner is served in the main hall.', created_at: new Date(Date.now() - 3600_000).toISOString(), created_by: HOST });
}

// ── Auth (an ES256 session the app verifies against this stand-in's JWKS) ──────────────────────────────────────
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const KID = 'lab-key-1';
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'ES256', use: 'sig', key_ops: ['verify'] };
const b64u = (b) => Buffer.from(b).toString('base64url');
const signJwt = (payload) => {
  const head = b64u(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: KID }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${b64u(sig)}`;
};
const userRow = (id) => {
  const u = db.users.find((r) => r.user_id === id) ?? db.users[0];
  return {
    id: u.user_id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: '2026-01-01T00:00:00Z',
    phone: '', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [],
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', is_anonymous: false,
  };
};
const sessionFor = (id) => {
  const now = Math.floor(Date.now() / 1000);
  const user = userRow(id);
  const access_token = signJwt({
    iss: `http://127.0.0.1:${PORT}/auth/v1`, sub: user.id, aud: 'authenticated', role: 'authenticated', email: user.email,
    exp: now + 86400 * 30, iat: now, session_id: `lab-${user.id.slice(-4)}`, aal: 'aal1', is_anonymous: false,
    app_metadata: user.app_metadata, user_metadata: {},
  });
  return { access_token, token_type: 'bearer', expires_in: 86400 * 30, expires_at: now + 86400 * 30, refresh_token: 'lab-refresh', user };
};
const subOf = (authz) => {
  try {
    return JSON.parse(Buffer.from((authz ?? '').replace(/^Bearer /, '').split('.')[1], 'base64url').toString());
  } catch {
    return {};
  }
};

// ── PostgREST filter subset ─────────────────────────────────────────────────────────────────────────────────────
function matches(row, key, expr) {
  const v = row[key];
  const s = v === null || v === undefined ? null : String(v);
  const list = (x) => x.replace(/^\(|\)$/g, '').split(',').map((t) => t.replace(/^"|"$/g, ''));
  if (expr.startsWith('eq.')) return s === expr.slice(3);
  if (expr.startsWith('neq.')) return s !== expr.slice(4);
  if (expr.startsWith('in.')) return s !== null && list(expr.slice(3)).includes(s);
  if (expr.startsWith('not.in.')) return s === null || !list(expr.slice(7)).includes(s);
  if (expr.startsWith('ilike.')) {
    const re = new RegExp(`^${expr.slice(6).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`, 'i');
    return s !== null && re.test(s);
  }
  if (expr === 'is.null') return s === null;
  if (expr === 'not.is.null') return s !== null;
  if (expr === 'is.true') return v === true;
  if (expr === 'is.false') return v === false;
  if (expr.startsWith('gte.')) return s !== null && s >= expr.slice(4);
  if (expr.startsWith('lte.')) return s !== null && s <= expr.slice(4);
  if (expr.startsWith('gt.')) return s !== null && s > expr.slice(3);
  if (expr.startsWith('lt.')) return s !== null && s < expr.slice(3);
  return true; // or / cs / ov / fts … — not modelled; the row passes
}
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'or', 'and', 'on_conflict', 'columns']);

// ── Counters ───────────────────────────────────────────────────────────────────────────────────────────────────
let stats;
const reset = () => {
  stats = { since: new Date().toISOString(), total: 0, byKind: {}, byName: {}, maxInFlight: 0, inFlight: 0, perSecond: {}, writes: 0 };
};
reset();
const count = (kind, name) => {
  stats.total += 1;
  stats.byKind[kind] = (stats.byKind[kind] ?? 0) + 1;
  const k = `${kind} ${name}`;
  stats.byName[k] = (stats.byName[k] ?? 0) + 1;
  const sec = Math.floor(Date.now() / 1000);
  stats.perSecond[sec] = (stats.perSecond[sec] ?? 0) + 1;
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  const control = path.startsWith('/__');
  if (!control) {
    stats.inFlight += 1;
    stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight);
  }
  const send = (code, body, headers = {}) => {
    const go = () => {
      if (!control) stats.inFlight -= 1;
      res.writeHead(code, { 'content-type': 'application/json', ...headers });
      res.end(body === undefined ? '' : JSON.stringify(body));
    };
    if (!control && DELAY > 0) setTimeout(go, DELAY);
    else go();
  };
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    if (path === '/__stats') {
      const peak = Math.max(0, ...Object.values(stats.perSecond));
      const { perSecond, ...rest } = stats;
      return send(200, { ...rest, perSecondPeak: peak, seconds: Object.keys(perSecond).length });
    }
    if (path === '/__reset') {
      reset();
      return send(200, { ok: true });
    }
    if (path === '/__keys') {
      const id = url.searchParams.get('as') === 'seat' ? SEAT_USER : HOST;
      return send(200, { cookieName: 'sb-127-auth-token', cookieValue: 'base64-' + Buffer.from(JSON.stringify(sessionFor(id))).toString('base64url') });
    }
    if (path === '/__fixture') {
      return send(200, {
        events: db.events.map((r) => ({ event_id: r.event_id, slug: r.slug, visibility: r.landing_page_visibility })),
        guests: db.guests.map((r) => ({ guest_id: r.guest_id, event_id: r.event_id, qr_token: r.qr_token })),
        hostUserId: HOST,
      });
    }
    if (path === '/__bump') {
      const ev = db.events.find((r) => r.slug === url.searchParams.get('slug'));
      if (ev) revs[ev.event_id] += 1;
      return send(200, { rev: ev ? revs[ev.event_id] : null });
    }

    if (path.startsWith('/auth/v1/')) {
      const name = path.slice('/auth/v1/'.length);
      count('auth', name);
      if (name === '.well-known/jwks.json') return send(200, { keys: [jwk] });
      if (name === 'user') {
        const sub = subOf(req.headers.authorization).sub;
        return sub ? send(200, userRow(sub)) : send(401, { code: 401, msg: 'no session' });
      }
      if (name.startsWith('token')) return send(200, sessionFor(HOST));
      return send(200, {});
    }

    if (path.startsWith('/rest/v1/rpc/')) {
      const name = path.slice('/rest/v1/rpc/'.length);
      count('rpc', name);
      let a = {};
      try {
        a = raw ? JSON.parse(raw) : Object.fromEntries(url.searchParams);
      } catch {
        /* ignore */
      }
      if (name === 'event_public_stamp') {
        const ev = db.events.find((r) => r.slug.toLowerCase() === String(a.p_slug ?? '').toLowerCase());
        return send(200, ev ? [{ event_id: ev.event_id, rev: revs[ev.event_id] }] : []);
      }
      const fixed = {
        event_host_is_internal: false, event_has_comp_for_sku: false, event_host_holds_founder_seat: false,
        event_comp_active_skus: [], event_basket_orders_granting: [], claim_periodic_job: false, wall_visible_photos: [],
      };
      return send(200, name in fixed ? fixed[name] : null);
    }

    if (path.startsWith('/rest/v1/')) {
      const table = path.slice('/rest/v1/'.length);
      count(req.method === 'GET' || req.method === 'HEAD' ? 'read' : 'write', table);
      const filters = {};
      for (const [k, v] of url.searchParams) if (!RESERVED.has(k)) filters[k] = v;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        stats.writes += 1;
        const wantsObject = (req.headers.accept ?? '').includes('vnd.pgrst.object');
        if (req.method === 'POST' && (table === 'coordinator_broadcasts' || table === 'guest_checkins')) {
          try {
            const body = JSON.parse(raw || '{}');
            const rows = (Array.isArray(body) ? body : [body]).map((r) => ({ created_at: new Date().toISOString(), checked_in_at: new Date().toISOString(), ...r }));
            if (table === 'guest_checkins') {
              for (const r of rows) {
                if (!db.guest_checkins.some((x) => x.guest_id === r.guest_id && x.event_id === r.event_id)) db.guest_checkins.push(r);
              }
            } else db.coordinator_broadcasts.push(...rows);
            return send(201, wantsObject ? rows[0] : rows);
          } catch {
            /* fall through */
          }
        }
        return send(req.method === 'POST' ? 201 : 200, wantsObject ? {} : []);
      }
      let rows = (db[table] ?? []).filter((row) =>
        Object.entries(filters).every(([k, x]) => (k.includes('.') ? true : matches(row, k, x))),
      );
      const order = url.searchParams.get('order');
      if (order) {
        const [col, dir] = order.split(',')[0].split('.');
        rows = [...rows].sort((p, q) => (String(p[col] ?? '') < String(q[col] ?? '') ? -1 : 1) * (dir === 'desc' ? -1 : 1));
      }
      const limit = url.searchParams.get('limit');
      if (limit) rows = rows.slice(0, Number(limit));
      const wantsObject = (req.headers.accept ?? '').includes('vnd.pgrst.object');
      const headers = { 'content-range': `${rows.length ? `0-${rows.length - 1}` : '*'}/${rows.length}` };
      if (req.method === 'HEAD') return send(200, undefined, headers);
      if (wantsObject) {
        if (rows.length !== 1) return send(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows` });
        return send(200, rows[0], headers);
      }
      return send(200, rows, headers);
    }
    count('other', path);
    send(404, { message: 'lab stub: no such path' });
  });
});
server.keepAliveTimeout = 65_000;
server.listen(PORT, '127.0.0.1', () => console.log(`event-day lab stub on ${PORT} · ${GUESTS} guests on lab-public · delay ${DELAY} ms`));
