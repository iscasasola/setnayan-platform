/**
 * A supabase-js-shaped client over PGlite, plus the `server-only` shim a
 * production module needs before it can be imported into a node:test.
 *
 * ── WHY THIS IS A MODULE AND NOT A COPY ─────────────────────────────────────
 * Both halves were written inside `booking-fee-order-postconditions.db.test.ts`
 * (2026-09-19) so the REAL `collectBookingFeeAtLock` could be called against the
 * replayed schema instead of hand-minting the rows it "would" write. The money
 * PATH test needs the same two things for the same reason — and a second copy of
 * an adapter is a second copy of a money rule, which this corpus has already
 * paid for. So the adapter moved here verbatim and both files import it.
 *
 * 🔑 THE FIDELITY THAT MATTERS, said once, here: errors are RETURNED as
 * `{ data, error }`, NEVER thrown. `collectBookingFeeAtLock`'s compensating
 * delete is reached only via `if (pErr)`; an adapter that threw would abort the
 * function before the rollback and make that arm untestable while looking like
 * a crash. `code` carries the SQLSTATE, because the one-bill-per-charge arm
 * branches on '23505' — an adapter that dropped it would make that arm
 * unreachable while every other assertion stayed green.
 *
 * ⚠ It models ONLY the call shapes the modules under test use. Anything else
 * throws loudly (`assertModelled`) rather than silently skipping the call — a
 * skipped money write is exactly the failure that renders as success.
 *
 * NOT a general supabase-js: no RLS, no `.order()`, no `.single()`, no filters
 * beyond `.eq()`. Extend it when a tested path needs more.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';

/* ── `server-only` shim ──────────────────────────────────────────────────────
 * lib/booking-fee-lock.server.ts opens with `import 'server-only'`, a module
 * Next.js supplies to the bundler and which does not exist in node_modules, so
 * a plain import of the production file dies with MODULE_NOT_FOUND before a
 * single assertion runs. The import is a BUNDLER ASSERTION ("never ship me to a
 * client"), carries no runtime behaviour, and lib/live-studio-channel-pool.test
 * already guards its presence textually — so resolving it to an empty module is
 * faithful, not a shortcut.
 *
 * Registered at MODULE SCOPE, so merely importing anything from this file
 * installs it. That is what makes it safe for a test file to reach the
 * production module through a dynamic `import()` inside `before()`: this
 * module's own evaluation — hoisted with the static import — has already run.
 * The shim must never move into a function a test has to remember to call. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub__.js');
{
  const stub = new CjsModule(SERVER_ONLY_STUB);
  stub.filename = SERVER_ONLY_STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[SERVER_ONLY_STUB] = stub;
  const originalResolve = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return SERVER_ONLY_STUB;
    return originalResolve.call(this, request, ...rest);
  };
}

/* ── A supabase-js-shaped adapter over PGlite ────────────────────────────────
 * Models EXACTLY the call shapes lib/booking-fee-lock.server.ts uses:
 *   .rpc(fn, namedArgs)
 *   .from(t).select(cols).eq(...)[.limit(n)].maybeSingle()
 *   .from(t).insert(row).select(cols).maybeSingle()
 *   await .from(t).insert(row)
 *   await .from(t).delete().eq(...)
 * …and, since 2026-10-10, the four more that lib/booking-payment-plan.server.ts
 * uses (the payment plan frozen at a booking):
 *   .from(t).select(cols).eq(...).order(col, { ascending })
 *   .from(t).select('a, alias:child!fk_name(x,y)')   — ONE embedded child list,
 *       resolved through the NAMED foreign key exactly as PostgREST does: the
 *       constraint is looked up in pg_constraint, and a name that is not a
 *       foreign key is returned as an error, never guessed around
 *   await .from(t).update(row).eq(...)
 *   await .from(t).upsert(row, { onConflict: 'a,b' })
 * A jsonb column is written as JSON (the column's own type is read from the
 * catalog) — PGlite would otherwise send a JS array as a Postgres array.
 * Anything else throws loudly rather than silently skipping the call.
 *
 * THE FIDELITY THAT MATTERS: errors are RETURNED as `{ data, error }`, never
 * thrown. The order-rollback arm is reached only via `if (pErr)` — an adapter
 * that threw would abort the function before the compensating delete and make
 * the rollback untestable while looking like a crash.
 */
// `code` carries the SQLSTATE, exactly like supabase-js's PostgrestError — the
// one-bill-per-charge arm branches on '23505', so an adapter that dropped it
// would make that arm unreachable while every other test stayed green.
type PgError = { message: string; code?: string } | null;

function asPgError(e: unknown): { message: string; code?: string } {
  const code = (e as { code?: unknown } | null)?.code;
  return {
    message: e instanceof Error ? e.message : String(e),
    ...(typeof code === 'string' ? { code } : {}),
  };
}
type Row = Record<string, unknown>;

function assertModelled(ok: boolean, what: string): asserts ok {
  if (!ok) {
    throw new Error(
      `[booking-fee adapter] unsupported call shape: ${what}. This adapter models only what ` +
        'lib/booking-fee-lock.server.ts uses — extend it rather than letting the test skip the call.',
    );
  }
}

const IDENT = /^[a-z_][a-z0-9_]*$/i;

/** Split a projection on its TOP-LEVEL commas — an embed carries its own. */
function splitProjection(projection: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of projection) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** `alias:child!fk_name(col,col)` — the one embed shape modelled. */
const EMBED = /^([a-z_][a-z0-9_]*):([a-z_][a-z0-9_]*)!([a-z_][a-z0-9_]*)\(([a-z0-9_,\s]+)\)$/i;

class Query implements PromiseLike<{ data: Row[] | null; error: PgError }> {
  private eqs: Array<[string, unknown]> = [];
  private limitN: number | null = null;
  private orderBy: { column: string; ascending: boolean } | null = null;
  private projection: string | null;

  constructor(
    private readonly pg: PGlite,
    private readonly table: string,
    private readonly op: 'select' | 'insert' | 'delete' | 'update' | 'upsert',
    projection: string | null,
    private readonly payload: Row | null,
    private readonly onConflict: string | null = null,
  ) {
    this.projection = projection;
  }

  eq(column: string, value: unknown): this {
    assertModelled(
      this.op !== 'insert' && this.op !== 'upsert',
      `.eq() on an ${this.op} into ${this.table}`,
    );
    this.eqs.push([column, value]);
    return this;
  }

  order(column: string, opts: { ascending?: boolean } = {}): this {
    assertModelled(this.op === 'select', `.order() on a ${this.op} of ${this.table}`);
    assertModelled(IDENT.test(column), `.order() column ${column}`);
    this.orderBy = { column, ascending: opts.ascending !== false };
    return this;
  }

  limit(n: number): this {
    assertModelled(this.op === 'select', `.limit() on a ${this.op} of ${this.table}`);
    this.limitN = n;
    return this;
  }

  /** Post-insert `.select(cols)` → RETURNING cols. */
  select(cols: string): this {
    assertModelled(this.op === 'insert', `.select() chained onto a ${this.op}`);
    this.projection = cols;
    return this;
  }

  async maybeSingle(): Promise<{ data: Row | null; error: PgError }> {
    const { data, error } = await this.run();
    if (error) return { data: null, error };
    return { data: data && data.length > 0 ? data[0]! : null, error: null };
  }

  private cols(): string {
    if (!this.projection || this.projection.trim() === '*') return '*';
    return this.projection
      .split(',')
      .map((c) => `"${c.trim()}"`)
      .join(', ');
  }

  /**
   * The SELECT list, with any `alias:child!fk(cols)` embed turned into a
   * correlated subquery through the NAMED foreign key. When the name is not a
   * foreign key between the two tables it hands back PostgREST's own complaint
   * for `run()` to RETURN as `{ error }`, like supabase-js — never a throw, and
   * never a silent empty list.
   */
  private async selectList(): Promise<string | { relationError: string }> {
    if (!this.projection || this.projection.trim() === '*') return '*';
    // A DATE column comes back from PostgREST as the string 'YYYY-MM-DD'; PGlite
    // hands back a JS Date. Code that reads `event_date` as a string (every
    // due-date computation) would silently see garbage, so named DATE columns
    // are rendered the way production renders them.
    const dateCols = new Set(
      (
        await this.pg.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1 AND data_type = 'date'`,
          [this.table],
        )
      ).rows.map((r) => r.column_name),
    );
    const parts: string[] = [];
    for (const token of splitProjection(this.projection)) {
      const embed = EMBED.exec(token);
      if (!embed) {
        assertModelled(IDENT.test(token), `select column ${token} on ${this.table}`);
        parts.push(dateCols.has(token) ? `to_char("${token}", 'YYYY-MM-DD') AS "${token}"` : `"${token}"`);
        continue;
      }
      const [, alias, child, fk, colList] = embed as unknown as [string, string, string, string, string];
      const childCols = colList.split(',').map((c) => c.trim());
      for (const c of childCols) assertModelled(IDENT.test(c), `embedded column ${c}`);
      const found = await this.pg.query<{ child_col: string; parent_col: string }>(
        `SELECT a.attname AS child_col, af.attname AS parent_col
           FROM pg_constraint k
           JOIN pg_attribute a  ON a.attrelid  = k.conrelid  AND a.attnum  = k.conkey[1]
           JOIN pg_attribute af ON af.attrelid = k.confrelid AND af.attnum = k.confkey[1]
          WHERE k.contype = 'f' AND k.conname = $1
            AND k.conrelid  = ('public.' || quote_ident($2))::regclass
            AND k.confrelid = ('public.' || quote_ident($3))::regclass`,
        [fk, child, this.table],
      );
      const link = found.rows[0];
      if (!link) {
        return {
          relationError: `Could not find a relationship between '${this.table}' and '${child}' using the hint '${fk}'`,
        };
      }
      const object = childCols.map((c) => `'${c}', c."${c}"`).join(', ');
      parts.push(
        `(SELECT coalesce(json_agg(json_build_object(${object})), '[]'::json)
            FROM public."${child}" c
           WHERE c."${link.child_col}" = public."${this.table}"."${link.parent_col}") AS "${alias}"`,
      );
    }
    return parts.join(', ');
  }

  /** `$n`, cast to jsonb when the column is jsonb (the value is sent as JSON text). */
  private async bind(column: string, value: unknown, params: unknown[]): Promise<string> {
    assertModelled(IDENT.test(column), `column name ${column} on ${this.table}`);
    const t = await this.pg.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [this.table, column],
    );
    const isJson = t.rows[0]?.data_type === 'jsonb' || t.rows[0]?.data_type === 'json';
    if (isJson && value !== null && value !== undefined) {
      params.push(JSON.stringify(value));
      return `$${params.length}::jsonb`;
    }
    params.push(value);
    return `$${params.length}`;
  }

  private async run(): Promise<{ data: Row[] | null; error: PgError }> {
    const params: unknown[] = [];
    const where = () => {
      if (this.eqs.length === 0) return '';
      const parts = this.eqs.map(([c, v]) => {
        params.push(v);
        return `"${c}" = $${params.length}`;
      });
      return ` WHERE ${parts.join(' AND ')}`;
    };

    let sql: string;
    if (this.op === 'select') {
      const list = await this.selectList();
      // A hint that names no foreign key is PostgREST's error to RETURN.
      if (typeof list !== 'string') return { data: null, error: { message: list.relationError, code: 'PGRST200' } };
      sql =
        `SELECT ${list} FROM public."${this.table}"` +
        where() +
        (this.orderBy === null
          ? ''
          : ` ORDER BY "${this.orderBy.column}" ${this.orderBy.ascending ? 'ASC' : 'DESC'}`) +
        (this.limitN === null ? '' : ` LIMIT ${Number(this.limitN)}`);
    } else if (this.op === 'delete') {
      sql = `DELETE FROM public."${this.table}"` + where();
    } else if (this.op === 'update') {
      const entries = Object.entries(this.payload ?? {});
      assertModelled(entries.length > 0, `.update({}) of ${this.table}`);
      // An UPDATE with no filter is never something a tested path means.
      assertModelled(this.eqs.length > 0, `.update() of ${this.table} with no .eq()`);
      const sets: string[] = [];
      for (const [c, v] of entries) sets.push(`"${c}" = ${await this.bind(c, v, params)}`);
      sql = `UPDATE public."${this.table}" SET ${sets.join(', ')}` + where();
    } else if (this.op === 'upsert') {
      const entries = Object.entries(this.payload ?? {});
      assertModelled(entries.length > 0, `.upsert({}) into ${this.table}`);
      const keys = (this.onConflict ?? '').split(',').map((c) => c.trim()).filter(Boolean);
      assertModelled(keys.length > 0 && keys.every((k) => IDENT.test(k)), `.upsert() onConflict "${this.onConflict}"`);
      const values: string[] = [];
      for (const [c, v] of entries) values.push(await this.bind(c, v, params));
      const names = entries.map(([c]) => `"${c}"`).join(', ');
      const sets = entries
        .filter(([c]) => !keys.includes(c))
        .map(([c]) => `"${c}" = EXCLUDED."${c}"`)
        .join(', ');
      sql =
        `INSERT INTO public."${this.table}" (${names}) VALUES (${values.join(', ')}) ` +
        `ON CONFLICT (${keys.map((k) => `"${k}"`).join(', ')}) DO UPDATE SET ${sets}`;
    } else {
      const entries = Object.entries(this.payload ?? {});
      assertModelled(entries.length > 0, `.insert({}) into ${this.table}`);
      const names = entries.map(([c]) => `"${c}"`).join(', ');
      const values = entries
        .map(([, v]) => {
          params.push(v);
          return `$${params.length}`;
        })
        .join(', ');
      sql =
        `INSERT INTO public."${this.table}" (${names}) VALUES (${values})` +
        (this.projection ? ` RETURNING ${this.cols()}` : '');
    }

    try {
      const res = await this.pg.query(sql, params);
      // supabase-js: an insert with no .select() resolves with data === null.
      if (this.op === 'insert' && !this.projection) return { data: null, error: null };
      return { data: (res.rows ?? []) as Row[], error: null };
    } catch (e) {
      return { data: null, error: asPgError(e) };
    }
  }

  then<T1 = { data: Row[] | null; error: PgError }, T2 = never>(
    onfulfilled?: ((v: { data: Row[] | null; error: PgError }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

/**
 * A `SupabaseClient`-shaped facade over a PGlite database.
 *
 * Every query runs as PGlite's superuser, so RLS is NOT in force — this stands
 * in for the SERVICE-ROLE (admin) client, which is the client the money path
 * actually uses. A test that means to exercise RLS must go through the RPCs and
 * `setAuthUid`, not through this.
 */
export function makeAdminClient(pg: PGlite): SupabaseClient {
  return {
    from(table: string) {
      return {
        select: (cols = '*') => new Query(pg, table, 'select', cols, null),
        insert: (payload: Row) => new Query(pg, table, 'insert', null, payload),
        delete: () => new Query(pg, table, 'delete', null, null),
        update: (payload: Row) => new Query(pg, table, 'update', null, payload),
        upsert: (payload: Row, opts: { onConflict?: string } = {}) =>
          new Query(pg, table, 'upsert', null, payload, opts.onConflict ?? null),
      };
    },
    async rpc(fn: string, params: Record<string, unknown>) {
      assertModelled(IDENT.test(fn), `rpc name ${fn}`);
      const keys = Object.keys(params);
      for (const k of keys) assertModelled(IDENT.test(k), `rpc arg name ${k}`);
      const sql =
        `SELECT public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) AS result`;
      try {
        const res = await pg.query<{ result: unknown }>(sql, keys.map((k) => params[k]));
        return { data: res.rows[0]?.result ?? null, error: null };
      } catch (e) {
        return { data: null, error: asPgError(e) };
      }
    },
  } as unknown as SupabaseClient;
}
