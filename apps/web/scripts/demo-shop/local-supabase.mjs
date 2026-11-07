#!/usr/bin/env node
/**
 * A LOCAL stand-in for the Supabase API, in front of the throwaway Postgres that `replay-into-postgres.ts` built —
 * just enough for `next dev` to render the real pages against the demo shop:
 *
 *   /rest/v1/*          → PostgREST (started here, on PGRST_PORT), unchanged
 *   /auth/v1/user       → the signed-in user, read from the token's own `sub` (no GoTrue)
 *   /auth/v1/.well-known/jwks.json → no keys, so supabase-js verifies via /user like it does for an HS256 project
 *
 * 🛑 LOCAL ONLY. The keys it prints are signed with a throwaway secret made on start; they open nothing but this
 * stand-in. It never reads a production URL or key.
 *
 *   POSTGREST_BIN=/path/to/postgrest node scripts/demo-shop/local-supabase.mjs
 *   → prints the NEXT_PUBLIC_SUPABASE_URL / anon / service-role lines to start `next dev` with, and writes them to
 *     scripts/demo-shop/.local-env (gitignored) for demo-shop-shots.mjs.
 */
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { SignJWT, jwtVerify } from 'jose';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const PGRST_PORT = Number(process.env.PGRST_PORT ?? 54330);
const PGHOST = process.env.PGHOST ?? '/tmp';
const PGPORT = process.env.PGPORT ?? '54329';
const PGDATABASE = process.env.PGDATABASE ?? 'setnayan_demo';
const POSTGREST_BIN = process.env.POSTGREST_BIN ?? 'postgrest';

if (!(PGHOST.startsWith('/') || PGHOST === 'localhost' || PGHOST === '127.0.0.1')) {
  throw new Error(`local-supabase: refusing non-local PGHOST "${PGHOST}".`);
}

// One secret per checkout, kept in the gitignored .local-env, so a restart keeps the keys `next dev` started with.
const ENV_FILE = join(HERE, '.local-env');
const kept = existsSync(ENV_FILE) ? /^DEMO_SHOP_JWT_SECRET=(\w+)$/m.exec(readFileSync(ENV_FILE, 'utf8'))?.[1] : undefined;
const SECRET = kept ?? randomBytes(32).toString('hex');
const key = new TextEncoder().encode(SECRET);
const sign = (claims, ttl = '30d') =>
  new SignJWT(claims).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setIssuedAt().setExpirationTime(ttl).sign(key);
const ANON = await sign({ role: 'anon', iss: 'supabase-demo' }, '3650d');
const SERVICE = await sign({ role: 'service_role', iss: 'supabase-demo' }, '3650d');

// ── PostgREST ─────────────────────────────────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'sp-pgrst-'));
const conf = join(dir, 'postgrest.conf');
const pgUri = PGHOST.startsWith('/')
  ? `postgresql://authenticator@/${PGDATABASE}?host=${encodeURIComponent(PGHOST)}&port=${PGPORT}`
  : `postgresql://authenticator@${PGHOST}:${PGPORT}/${PGDATABASE}`;
writeFileSync(
  conf,
  [
    `db-uri = "${pgUri}"`,
    'db-schemas = "public"',
    'db-anon-role = "anon"',
    'db-extra-search-path = "public, extensions"',
    `jwt-secret = "${SECRET}"`,
    `server-port = ${PGRST_PORT}`,
    'server-host = "127.0.0.1"',
    'db-pool = 20',
    'db-max-rows = 5000',
    'log-level = "error"',
  ].join('\n'),
);
// The login role PostgREST connects as (created by replay-into-postgres.ts) must be able to become each API role.
spawnSync('psql', ['-h', PGHOST, '-p', PGPORT, '-U', 'postgres', '-d', PGDATABASE, '-qc', 'GRANT anon, authenticated, service_role TO authenticator']);
const pgrst = spawn(POSTGREST_BIN, [conf], { stdio: ['ignore', 'inherit', 'inherit'] });
pgrst.on('exit', (c) => {
  console.error(`postgrest exited (${c})`);
  process.exit(1);
});

// ── the gateway ───────────────────────────────────────────────────────────
function userRow(id) {
  const r = spawnSync(
    'psql',
    ['-h', PGHOST, '-p', PGPORT, '-U', 'postgres', '-d', PGDATABASE, '-XtAc', `select row_to_json(u) from auth.users u where id = '${id.replace(/[^0-9a-f-]/gi, '')}'`],
    { encoding: 'utf8' },
  );
  const line = (r.stdout ?? '').trim();
  return line ? JSON.parse(line) : null;
}

function asSupabaseUser(u) {
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: u.email_confirmed_at ?? u.created_at,
    phone: u.phone ?? '',
    confirmed_at: u.confirmed_at ?? u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? u.created_at,
    app_metadata: { provider: 'email', providers: ['email'], ...(u.raw_app_meta_data ?? {}) },
    user_metadata: u.raw_user_meta_data ?? {},
    identities: [],
    created_at: u.created_at,
    updated_at: u.updated_at,
    is_anonymous: false,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...headers });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' });
    return res.end();
  }

  if (url.pathname === '/auth/v1/.well-known/jwks.json') return send(200, { keys: [] });
  if (url.pathname === '/auth/v1/user') {
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    try {
      const { payload } = await jwtVerify(token, key);
      const u = payload.sub ? userRow(String(payload.sub)) : null;
      if (!u) return send(401, { code: 401, error_code: 'user_not_found', msg: 'User from sub claim in JWT does not exist' });
      return send(200, asSupabaseUser(u));
    } catch {
      return send(401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
    }
  }
  // The seed's two auth-admin calls (getUserById · createUser), service role only. Inserting into auth.users fires the
  // REAL signup trigger, so the person's `users` row is made exactly as a sign-up makes it.
  const adminUser = /^\/auth\/v1\/admin\/users(?:\/([0-9a-f-]+))?$/i.exec(url.pathname);
  if (adminUser) {
    try {
      const { payload } = await jwtVerify((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''), key);
      if (payload.role !== 'service_role') return send(403, { msg: 'service role only' });
    } catch {
      return send(401, { msg: 'invalid JWT' });
    }
    if (req.method === 'GET' && adminUser[1]) {
      const u = userRow(adminUser[1]);
      return u ? send(200, asSupabaseUser(u)) : send(404, { code: 404, error_code: 'user_not_found', msg: 'User not found' });
    }
    if (req.method === 'POST' && !adminUser[1]) {
      const body = JSON.parse(await new Promise((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => ok(b || '{}')); }));
      const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
      const sql = `insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, confirmed_at)
        values (${body.id ? `${q(body.id)}::uuid` : 'gen_random_uuid()'}, ${q(body.email)}, ${q(JSON.stringify(body.user_metadata ?? {}))}::jsonb, now(), now())
        returning id`;
      const r = spawnSync('psql', ['-h', PGHOST, '-p', PGPORT, '-U', 'postgres', '-d', PGDATABASE, '-XtAqc', sql], { encoding: 'utf8' });
      if (r.status !== 0) return send(422, { msg: r.stderr });
      return send(200, asSupabaseUser(userRow(r.stdout.trim().split('\n')[0])));
    }
  }
  if (url.pathname.startsWith('/auth/v1/')) return send(200, {});
  if (url.pathname.startsWith('/storage/v1/')) return send(404, { error: 'storage is not part of the local stand-in' });

  if (url.pathname.startsWith('/rest/v1/')) {
    const upstream = http.request(
      {
        host: '127.0.0.1',
        port: PGRST_PORT,
        method: req.method,
        path: url.pathname.slice('/rest/v1'.length) + url.search,
        headers: { ...req.headers, host: `127.0.0.1:${PGRST_PORT}` },
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on('error', (e) => send(502, { error: String(e) }));
    req.pipe(upstream);
    return;
  }
  send(404, { error: `not served by the local stand-in: ${url.pathname}` });
});

server.listen(PORT, '127.0.0.1', () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PORT}`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE,
    DEMO_SHOP_JWT_SECRET: SECRET,
  };
  const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n');
  writeFileSync(ENV_FILE, `${lines}\n`);
  console.log(`local Supabase stand-in on http://127.0.0.1:${PORT} (PostgREST :${PGRST_PORT}, Postgres ${PGHOST}:${PGPORT}/${PGDATABASE})`);
  console.log(`env written to ${join(HERE, '.local-env')}`);
});
