/**
 * A PostgREST-shaped query builder over PGlite, for one purpose: running the
 * REAL `lib/erasure/purge.ts` against the REAL replayed schema.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Erasure is a list of table and column names executed through an UNTYPED
 * supabase-js client. Every other way of testing it re-states that list:
 *   · a mocked client tests the mock's opinion of the schema;
 *   · a hand-written SQL re-implementation tests the re-implementation;
 *   · reading the code is how three phantom columns survived for months.
 * The only test that can actually catch a name that isn't a column is one where
 * the real code's real statements hit a real Postgres holding the real schema.
 * That is what this adapter buys, and it is the only reason to accept the cost
 * of maintaining it.
 *
 * ── THE FIDELITY THAT MATTERS ───────────────────────────────────────────────
 * ERRORS ARE RETURNED, NEVER THROWN — `{ data, error }`, exactly like
 * supabase-js. This is not a detail: the production defect was that PostgREST
 * REJECTS THE WHOLE UPDATE on one unknown key (PGRST204) and returns it as an
 * ordinary error, which the purge's best-effort handler logged and swallowed.
 * An adapter that threw would surface the bug as a crash and mislead; an adapter
 * that ignored unknown columns would hide it completely. Neither is faithful.
 * Postgres itself supplies the rejection (`column "x" of relation "y" does not
 * exist`), so the check is real rather than simulated — and the db test's
 * meta-tests prove that rejection still happens before trusting any green run.
 *
 * ── WHAT IT IS NOT ──────────────────────────────────────────────────────────
 * Not a PostgREST implementation. It supports exactly the operations
 * `lib/erasure/purge.ts` uses; anything else throws loudly rather than
 * pretending. `assertSupported` is what keeps that honest — if the purge grows a
 * call shape this doesn't model, the test fails instead of silently skipping it.
 */
import type { PGlite } from '@electric-sql/pglite';

export type PgResult<T = Record<string, unknown>> = {
  data: T[] | null;
  error: { message: string } | null;
};
type SingleResult<T = Record<string, unknown>> = {
  data: T | null;
  error: { message: string } | null;
};

type Filter =
  | { kind: 'eq'; column: string; value: unknown }
  | { kind: 'in'; column: string; values: unknown[] }
  | { kind: 'notNull'; column: string }
  | { kind: 'isNull'; column: string };

/** column -> postgres data_type, per table. Drives jsonb / array casting. */
type ColumnTypes = Map<string, Map<string, string>>;

async function loadColumnTypes(db: PGlite): Promise<ColumnTypes> {
  const res = await db.query<{ table_name: string; column_name: string; data_type: string }>(
    `SELECT table_name, column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = 'public'`,
  );
  const out: ColumnTypes = new Map();
  for (const r of res.rows) {
    let t = out.get(r.table_name);
    if (!t) {
      t = new Map();
      out.set(r.table_name, t);
    }
    t.set(r.column_name, r.data_type);
  }
  return out;
}

/** Render one bound parameter with the cast its column actually needs. */
function bind(
  types: ColumnTypes,
  table: string,
  column: string,
  value: unknown,
  params: unknown[],
): string {
  const dataType = types.get(table)?.get(column);
  // Unknown column → bind plainly and let Postgres reject the statement. That
  // rejection is the entire point of this harness; do not pre-empt it.
  if (value === null || value === undefined) {
    params.push(null);
    return `$${params.length}`;
  }
  if (dataType === 'jsonb' || dataType === 'json') {
    params.push(JSON.stringify(value));
    return `$${params.length}::${dataType}`;
  }
  if (dataType === 'ARRAY') {
    const arr = Array.isArray(value) ? value : [value];
    // Postgres array literal; the elements here are always text keys/urls.
    params.push(`{${arr.map((v) => `"${String(v).replace(/(["\\])/g, '\\$1')}"`).join(',')}}`);
    return `$${params.length}`;
  }
  params.push(value);
  return `$${params.length}`;
}

function whereClause(
  types: ColumnTypes,
  table: string,
  filters: Filter[],
  params: unknown[],
): string {
  if (filters.length === 0) return '';
  const parts = filters.map((f) => {
    if (f.kind === 'notNull') return `"${f.column}" IS NOT NULL`;
    if (f.kind === 'isNull') return `"${f.column}" IS NULL`;
    if (f.kind === 'eq') return `"${f.column}" = ${bind(types, table, f.column, f.value, params)}`;
    // `.in()` with an empty list must match NOTHING, as PostgREST does.
    if (f.values.length === 0) return 'FALSE';
    const rendered = f.values.map((v) => bind(types, table, f.column, v, params));
    return `"${f.column}" IN (${rendered.join(', ')})`;
  });
  return ` WHERE ${parts.join(' AND ')}`;
}

class Builder implements PromiseLike<PgResult> {
  private filters: Filter[] = [];

  constructor(
    private db: PGlite,
    private types: ColumnTypes,
    private table: string,
    private op: 'select' | 'update' | 'delete',
    private selectCols: string = '*',
    private payload: Record<string, unknown> | null = null,
    /** Records every statement for the harness's own meta-tests. */
    private log: string[] = [],
  ) {}

  eq(column: string, value: unknown): this {
    this.filters.push({ kind: 'eq', column, value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ kind: 'in', column, values: values ?? [] });
    return this;
  }

  /**
   * `.is(col, null)` — the fail-closed purge's "which rows can I NOT attribute
   * to this subject?" probe. Modelled only for null, which is the only value
   * supabase-js's `.is()` is used with in `lib/erasure/purge.ts`; anything else
   * fails loudly rather than being silently coerced into an `=` comparison
   * (`col = NULL` is never true in SQL, so a wrong model here would make the
   * unattributed-retained audit report zero forever and look green doing it).
   */
  is(column: string, value: unknown): this {
    assertSupported(value === null, `.is('${column}', …) — only .is(col, null) is modelled`);
    this.filters.push({ kind: 'isNull', column });
    return this;
  }

  not(column: string, operator: string, value: unknown): this {
    assertSupported(
      operator === 'is' && value === null,
      `.not('${column}', '${operator}', …) — only .not(col, 'is', null) is modelled`,
    );
    this.filters.push({ kind: 'notNull', column });
    return this;
  }

  async maybeSingle(): Promise<SingleResult> {
    const { data, error } = await this.run();
    if (error) return { data: null, error };
    return { data: data && data.length > 0 ? (data[0] as Record<string, unknown>) : null, error: null };
  }

  private async run(): Promise<PgResult> {
    const params: unknown[] = [];
    let sql: string;

    if (this.op === 'select') {
      const cols =
        this.selectCols.trim() === '*'
          ? '*'
          : this.selectCols
              .split(',')
              .map((c) => `"${c.trim()}"`)
              .join(', ');
      sql = `SELECT ${cols} FROM public."${this.table}"${whereClause(this.types, this.table, this.filters, params)}`;
    } else if (this.op === 'update') {
      const entries = Object.entries(this.payload ?? {});
      assertSupported(entries.length > 0, `.update({}) on ${this.table} — empty payload`);
      const sets = entries
        .map(([col, val]) => `"${col}" = ${bind(this.types, this.table, col, val, params)}`)
        .join(', ');
      sql = `UPDATE public."${this.table}" SET ${sets}${whereClause(this.types, this.table, this.filters, params)}`;
    } else {
      sql = `DELETE FROM public."${this.table}"${whereClause(this.types, this.table, this.filters, params)}`;
    }

    this.log.push(sql);
    try {
      const res = await this.db.query(sql, params);
      return { data: (res.rows ?? []) as Record<string, unknown>[], error: null };
    } catch (e) {
      // PostgREST shape: the error is DATA, not an exception. See the docblock —
      // this is the behaviour that let three phantom columns hide in production.
      return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
    }
  }

  then<TResult1 = PgResult, TResult2 = never>(
    onfulfilled?: ((value: PgResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

/** Fail loudly on a call shape this adapter does not model. */
function assertSupported(ok: boolean, what: string): asserts ok {
  if (!ok) {
    throw new Error(
      `[pglite-postgrest] unsupported operation: ${what}. The adapter models only what ` +
        'lib/erasure/purge.ts uses — extend it rather than letting the test silently skip the call.',
    );
  }
}

export type AuthUpdateCall = { userId: string; attrs: Record<string, unknown> };

export type PgliteRestClient = {
  from(table: string): {
    select(cols?: string): Builder;
    update(payload: Record<string, unknown>): Builder;
    delete(): Builder;
    insert(payload: Record<string, unknown>): PromiseLike<PgResult>;
  };
  /**
   * A stored-function call, resolved BY ARGUMENT NAME exactly as PostgREST does.
   *
   * 🔑 THE NAMES ARE THE CONTRACT, WHICH IS WHY THIS CALLS THE REAL FUNCTION
   * INSTEAD OF PRETENDING. A live user-facing bug ran for weeks because a route
   * posted eight named arguments to a function that took seven: PostgREST found
   * no candidate, the call failed before the body ran, and nothing threw. An
   * adapter that accepted any name would make every erasure test agree with a
   * call production would reject.
   */
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<PgResult>;
  auth: {
    admin: {
      updateUserById(userId: string, attrs: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
    };
  };
  /** Every SQL statement the purge issued, in order. */
  statements: string[];
  /** Every auth.admin.updateUserById call, for asserting the metadata scrub. */
  authUpdates: AuthUpdateCall[];
};

export async function createPgliteRestClient(db: PGlite): Promise<PgliteRestClient> {
  const types = await loadColumnTypes(db);
  const statements: string[] = [];
  const authUpdates: AuthUpdateCall[] = [];

  return {
    from(table: string) {
      return {
        select: (cols = '*') => new Builder(db, types, table, 'select', cols, null, statements),
        update: (payload: Record<string, unknown>) =>
          new Builder(db, types, table, 'update', '*', payload, statements),
        delete: () => new Builder(db, types, table, 'delete', '*', null, statements),
        insert: (payload: Record<string, unknown>): PromiseLike<PgResult> => {
          const params: unknown[] = [];
          const cols = Object.keys(payload);
          const vals = cols.map((c) => bind(types, table, c, payload[c], params));
          const sql = `INSERT INTO public."${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${vals.join(', ')})`;
          statements.push(sql);
          return db
            .query(sql, params)
            .then(() => ({ data: [], error: null }) as PgResult)
            .catch((e: unknown) => ({
              data: null,
              error: { message: e instanceof Error ? e.message : String(e) },
            }));
        },
      };
    },
    rpc(fn: string, args: Record<string, unknown> = {}): PromiseLike<PgResult> {
      const params: unknown[] = [];
      const named = Object.keys(args).map((name) => {
        // Named notation (`f(p_x => $1)`) is what makes this a real test of the
        // argument names. A name that is not a plain identifier cannot be one
        // PostgREST would accept either, so refusing it here is the same answer
        // production gives, arrived at sooner.
        if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
          throw new Error(`rpc(${fn}): "${name}" is not a valid argument name`);
        }
        params.push(args[name]);
        return `${name} => $${params.length}`;
      });
      const sql = `SELECT public."${fn}"(${named.join(', ')})`;
      statements.push(sql);
      return db
        .query(sql, params)
        .then((r) => ({ data: (r.rows ?? []) as unknown, error: null }) as PgResult)
        // Errors come back as DATA, never as a throw — that asymmetry is the
        // reason the last-admin refusal was swallowed in production, and a
        // harness that threw here would hide the very shape under test.
        .catch((e: unknown) => ({
          data: null,
          error: { message: e instanceof Error ? e.message : String(e) },
        }));
    },
    auth: {
      admin: {
        async updateUserById(userId: string, attrs: Record<string, unknown>) {
          authUpdates.push({ userId, attrs });
          const sets: string[] = [];
          const params: unknown[] = [];
          if (typeof attrs.email === 'string') {
            params.push(attrs.email);
            sets.push(`email = $${params.length}`);
          }
          if (attrs.user_metadata !== undefined) {
            params.push(JSON.stringify(attrs.user_metadata));
            sets.push(`raw_user_meta_data = $${params.length}::jsonb`);
          }
          if (sets.length === 0) return { error: null };
          params.push(userId);
          const sql = `UPDATE auth.users SET ${sets.join(', ')} WHERE id = $${params.length}`;
          statements.push(sql);
          try {
            await db.query(sql, params);
            return { error: null };
          } catch (e) {
            return { error: { message: e instanceof Error ? e.message : String(e) } };
          }
        },
      },
    },
    statements,
    authUpdates,
  };
}
