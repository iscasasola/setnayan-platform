// One read-only door to the live catalogue, shared by `print-prices.mjs` and
// `feature-register-check.mjs`. Production is SELECT-only from a session, so
// this module makes a write impossible three ways over:
//
//   1. it refuses any SQL that is not a single SELECT (no `;` inside, no DML/DDL words);
//   2. the statement runs inside `begin transaction read only; … rollback;`;
//   3. the session itself is opened with `default_transaction_read_only=on`.
//
// The connection string is read from the environment (PRICES_DB_URL, then
// SUPABASE_DB_URL, then DATABASE_URL) and is NEVER printed — not on success,
// not in an error. Only the variable's NAME is ever echoed.
//
// It shells out to `psql` (no npm dependency, so it runs before `pnpm install`).

import { spawnSync } from 'node:child_process';

export const DB_URL_VARS = ['PRICES_DB_URL', 'SUPABASE_DB_URL', 'DATABASE_URL'];

/** The env var that holds the URL (name only), or null. */
export function dbUrlVar(env = process.env) {
  return DB_URL_VARS.find((v) => typeof env[v] === 'string' && env[v].trim() !== '') ?? null;
}

const WRITE_WORDS = /\b(insert|update|delete|merge|upsert|truncate|drop|alter|create|grant|revoke|comment|copy|call|do|vacuum|reindex|cluster|refresh|lock|set|reset|begin|commit|rollback|savepoint|prepare|execute|listen|notify)\b/i;

/** Throws unless `sql` is exactly one SELECT (or WITH … SELECT) statement. */
export function assertSelectOnly(sql) {
  const body = sql.replace(/--[^\n]*/g, ' ').replace(/'(?:[^']|'')*'/g, "''").trim().replace(/;\s*$/, '');
  if (body.includes(';')) throw new Error('read-only-db: one statement only');
  if (!/^(select|with)\b/i.test(body)) throw new Error('read-only-db: only SELECT is allowed');
  if (WRITE_WORDS.test(body)) throw new Error('read-only-db: a write/transaction keyword is not allowed in a read');
  return body;
}

/** Remove anything that looks like a connection string from a message. */
export function scrub(text, env = process.env) {
  let out = String(text ?? '');
  for (const v of DB_URL_VARS) if (env[v]) out = out.split(env[v]).join(`<${v}>`);
  return out.replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '<db-url>');
}

/**
 * Run one SELECT and return its rows as objects. The query is wrapped as
 * `select coalesce(json_agg(q), '[]') from (<sql>) q` so psql prints one JSON
 * value and nothing has to be parsed from a text table.
 *
 * @returns {{ ok: true, rows: object[], via: string } | { ok: false, reason: string }}
 */
export function readRows(sql, { env = process.env, spawn = spawnSync } = {}) {
  const body = assertSelectOnly(sql);
  const via = dbUrlVar(env);
  if (!via) return { ok: false, reason: `no database URL in the environment (set one of ${DB_URL_VARS.join(' / ')})` };
  const wrapped = [
    'begin transaction read only;',
    `select coalesce(json_agg(q), '[]'::json) from (${body}) q;`,
    'rollback;',
  ].join('\n');
  const r = spawn('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-d', env[via], '-c', wrapped], {
    encoding: 'utf8',
    env: { ...env, PGOPTIONS: `${env.PGOPTIONS ?? ''} -c default_transaction_read_only=on`.trim(), PGCONNECT_TIMEOUT: env.PGCONNECT_TIMEOUT ?? '15' },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) {
    return { ok: false, reason: r.error.code === 'ENOENT' ? 'psql is not installed (macOS: `brew install libpq`, then add its bin to PATH)' : scrub(r.error.message, env) };
  }
  if (r.status !== 0) return { ok: false, reason: `psql failed: ${scrub((r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' '), env)}` };
  const line = (r.stdout || '').split('\n').map((l) => l.trim()).find((l) => l.startsWith('['));
  if (!line) return { ok: false, reason: 'psql returned no JSON row' };
  return { ok: true, rows: JSON.parse(line), via };
}
