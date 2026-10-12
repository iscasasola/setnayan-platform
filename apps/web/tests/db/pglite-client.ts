/**
 * tests/db/pglite-client.ts — a supabase-js-shaped client over the PGlite replay
 * that runs AS SOMEBODY: a signed-in person (the `authenticated` role with their
 * uid, so RLS and the table grants apply exactly as they do to a browser), or the
 * SERVICE ROLE (the replay's own superuser — what `createAdminClient()` is).
 *
 * Written for the wish list's writers (`the-wish-list-writes-keep-their-rules`)
 * and shared with the gift record's (`a-gift-record-is-a-guests-own`), so a
 * production function that takes a `SupabaseClient` can be CALLED against the
 * replayed schema instead of being re-stated in SQL.
 *
 * ⚠ It models ONLY the call shapes those functions use — select · insert ·
 * update · delete with `.eq()` `.is(col, null)` `.not(col, 'is', null)`
 * `.in()` `.order()` `.limit()`
 * `.select()` `.maybeSingle()`. Anything else throws, never skips.
 *
 * 🔑 Errors are RETURNED as `{ data, error }`, never thrown — exactly as
 * supabase-js hands back a refusal — with `code` carrying the SQLSTATE.
 *
 * (`supabase-over-pglite.ts` is the older sibling: no RLS, modelled on the
 * booking-fee writer. This one exists because these writers are authorised BY
 * the role they run as.)
 */
import type { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setAuthUid } from './replay-migrations';

/** `SERVICE` = the service role (RLS does not apply); a uuid = that signed-in person. */
export const SERVICE = Symbol('service-role');
export type Actor = string | typeof SERVICE;

type Row = Record<string, unknown>;
type Res = { data: Row[] | null; error: { message: string; code?: string } | null };
const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (s: string) => {
  if (!IDENT.test(s)) throw new Error(`[pglite-client] not an identifier: ${s}`);
  return s;
};
const cols = (list: string) =>
  list
    .split(',')
    .map((c) => ident(c.trim()))
    .join(', ');

class Q implements PromiseLike<Res> {
  private eqs: Array<[string, unknown]> = [];
  private nulls: string[] = [];
  private notNulls: string[] = [];
  private ins: Array<[string, unknown[]]> = [];
  private orders: string[] = [];
  private lim: number | null = null;
  private returning: string | null = null;
  private one = false;
  constructor(
    private db: PGlite,
    private actor: Actor,
    private table: string,
    private verb: 'select' | 'insert' | 'update' | 'delete',
    private payload: Row | null,
    private selected: string | null,
  ) {}
  select(list: string) {
    if (this.verb === 'select') throw new Error('[pglite-client] select().select() is not modelled');
    this.returning = cols(list);
    return this;
  }
  eq(col: string, value: unknown) {
    this.eqs.push([ident(col), value]);
    return this;
  }
  is(col: string, value: null) {
    if (value !== null) throw new Error('[pglite-client] .is() is modelled for null only');
    this.nulls.push(ident(col));
    return this;
  }
  not(col: string, op: 'is', value: null) {
    if (op !== 'is' || value !== null) throw new Error('[pglite-client] .not() is modelled for (col, "is", null) only');
    this.notNulls.push(ident(col));
    return this;
  }
  in(col: string, values: unknown[]) {
    this.ins.push([ident(col), values]);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push(`${ident(col)} ${opts?.ascending === false ? 'DESC' : 'ASC'}`);
    return this;
  }
  limit(n: number) {
    this.lim = n;
    return this;
  }
  maybeSingle(): PromiseLike<{ data: Row | null; error: Res['error'] }> {
    this.one = true;
    return this.run().then((r) => ({ data: r.data?.[0] ?? null, error: r.error }));
  }
  then<A = Res, B = never>(ok?: ((v: Res) => A | PromiseLike<A>) | null, no?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return this.run().then(ok, no);
  }
  private async run(): Promise<Res> {
    const params: unknown[] = [];
    const p = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    const where = () => {
      const parts = [
        ...this.eqs.map(([c, v]) => `${c} = ${p(v)}`),
        ...this.nulls.map((c) => `${c} IS NULL`),
        ...this.notNulls.map((c) => `${c} IS NOT NULL`),
        // One parameter per value — PGlite binds a JS array as its first element.
        ...this.ins.map(([c, vs]) => (vs.length ? `${c} IN (${vs.map((v) => p(v)).join(', ')})` : 'FALSE')),
      ];
      return parts.length ? ` WHERE ${parts.join(' AND ')}` : '';
    };
    let sql: string;
    if (this.verb === 'select') {
      sql = `SELECT ${this.selected} FROM public.${ident(this.table)}${where()}`;
      if (this.orders.length) sql += ` ORDER BY ${this.orders.join(', ')}`;
      if (this.lim != null || this.one) sql += ` LIMIT ${this.one ? 1 : this.lim}`;
    } else if (this.verb === 'insert') {
      const keys = Object.keys(this.payload!);
      sql = `INSERT INTO public.${ident(this.table)} (${keys.map(ident).join(', ')}) VALUES (${keys.map((k) => p(this.payload![k])).join(', ')})`;
      if (this.returning) sql += ` RETURNING ${this.returning}`;
    } else if (this.verb === 'update') {
      const keys = Object.keys(this.payload!);
      const set = keys.map((k) => `${ident(k)} = ${p(this.payload![k])}`).join(', ');
      sql = `UPDATE public.${ident(this.table)} SET ${set}${where()}`;
      if (this.returning) sql += ` RETURNING ${this.returning}`;
    } else {
      sql = `DELETE FROM public.${ident(this.table)}${where()}`;
      if (this.returning) sql += ` RETURNING ${this.returning}`;
    }
    const db = this.db;
    const person = this.actor === SERVICE ? null : this.actor;
    /* ONE STATEMENT AT A TIME. The writers run requests side by side (`Promise.all`), and this
       client is one connection: without the queue, one statement's RESET ROLE could land before
       another's query — which would then run as the superuser, past RLS, and "pass". */
    const turn = queue.then(async (): Promise<Res> => {
      sent.push(`${this.verb} ${this.table}`);
      if (person) {
        await db.exec('SET ROLE authenticated');
        await setAuthUid(db, person);
      }
      try {
        const r = await db.query<Row>(sql, params);
        return { data: r.rows, error: null };
      } catch (e) {
        // Returned, never thrown — exactly as supabase-js hands a refusal back.
        return { data: null, error: { message: (e as Error).message, code: (e as { code?: string }).code } };
      } finally {
        if (person) {
          await db.exec('RESET ROLE');
          await setAuthUid(db, null);
        }
      }
    });
    queue = turn.then(
      () => undefined,
      () => undefined,
    );
    return turn;
  }
}

/** The statements-in-turn queue (see `run`). */
let queue: Promise<void> = Promise.resolve();
/** Every request any client here sent, in order — "verb table". */
const sent: string[] = [];

/**
 * Run `fn` and hand back the requests it sent — "verb table", in the order they
 * were sent (owner rule 2026-10-08: count the requests, with a real function).
 * One request = one awaited table call, exactly as supabase-js sends one.
 */
export async function counted<T>(fn: () => Promise<T>): Promise<{ res: T; sent: string[] }> {
  const from = sent.length;
  const res = await fn();
  return { res, sent: sent.slice(from) };
}

export function clientAs(db: PGlite, actor: Actor): SupabaseClient {
  return {
    from(table: string) {
      return {
        select: (list: string) => new Q(db, actor, table, 'select', null, cols(list)),
        insert: (row: Row) => new Q(db, actor, table, 'insert', row, null),
        update: (patch: Row) => new Q(db, actor, table, 'update', patch, null),
        delete: () => new Q(db, actor, table, 'delete', null, null),
      };
    },
  } as unknown as SupabaseClient;
}
