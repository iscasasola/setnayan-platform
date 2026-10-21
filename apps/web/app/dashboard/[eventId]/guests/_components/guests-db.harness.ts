/**
 * guests-db.harness.ts — TEST HELPER: an in-memory `guests` · `event_seat_assignments` · `event_tables`, behind the
 * Supabase client shape the guest list's server actions use, and the module shims (`server-only`, the two client
 * factories, Next's cache, the public-copy refresh) that let a test run the REAL action with no network and no Next.
 * Import it FIRST — the shims must be in place before the actions are imported.
 *
 * It models one database behaviour the actions rely on: the live `free_seat_on_decline` trigger (a reply moved TO
 * "declined" frees that guest's chair).
 */
import path from 'node:path';
import { createRequire } from 'node:module';

/* ── An in-memory `guests` + `event_seat_assignments`, behind the Supabase client shape the action uses ────────────── */

export type Row = Record<string, unknown>;
type Table = 'guests' | 'event_seat_assignments' | 'event_tables';
export const DB: { guests: Row[]; event_seat_assignments: Row[]; event_tables: Row[]; afterFirstGuestRead: (() => void) | null } = {
  guests: [],
  event_seat_assignments: [],
  event_tables: [],
  afterFirstGuestRead: null,
};

/**
 * #6728's `a_plus_ones_count_is_their_rows` trigger (migration 20271281805227), as the database runs it after a guest's
 * number changes: fewer live +1 rows than the number → "TBA" seats are minted; more → ONLY unnamed placeholders go,
 * NEWEST first, their chairs released. (tests/db/a-released-seat-is-taken-once.db.test.ts runs the real one.)
 */
let minted = 0;
function followCount(b: Row) {
  const target = Math.max(0, Math.min(4, Number(b.plus_one_count ?? 0)));
  const live = DB.guests.filter((g) => g.plus_one_of_guest_id === b.guest_id && !g.deleted_at);
  if (live.length < target) {
    for (let i = live.length; i < target; i++) {
      DB.guests.push({ guest_id: `minted-${++minted}`, event_id: b.event_id, first_name: 'TBA', last_name: '+1', display_name: `+${i + 1} · TBA`, plus_one_of_guest_id: b.guest_id, plus_one_name_confirmed_at: null, plus_one_count: 0, deleted_at: null, created_at: `9999-${minted}` });
    }
    return;
  }
  const drop = live
    .filter((g) => !g.plus_one_name_confirmed_at && String(g.first_name ?? '').trim().toUpperCase() === 'TBA')
    .sort((x, y) => String(y.created_at ?? '').localeCompare(String(x.created_at ?? '')))
    .slice(0, live.length - target);
  for (const g of drop) {
    DB.event_seat_assignments = DB.event_seat_assignments.filter((x) => x.guest_id !== g.guest_id);
    g.deleted_at = 'trigger';
  }
}

function table(name: Table) {
  const filters: ((r: Row) => boolean)[] = [];
  let op: { kind: 'select' } | { kind: 'update'; patch: Row } | { kind: 'delete' } | { kind: 'upsert'; rows: Row[] } = { kind: 'select' };
  let returning = false;
  const rows = () => DB[name];
  const run = () => {
    if (op.kind === 'upsert') {
      for (const r of op.rows) {
        const at = rows().findIndex((x) => x.event_id === r.event_id && x.guest_id === r.guest_id);
        if (at >= 0) rows()[at] = { ...rows()[at], ...r };
        else rows().push({ ...r });
      }
      return { data: null, error: null };
    }
    const hit = rows().filter((r) => filters.every((f) => f(r)));
    if (op.kind === 'select') {
      const out = { data: hit.map((r) => ({ ...r })), error: null };
      if (name === 'guests' && DB.afterFirstGuestRead) {
        const hook = DB.afterFirstGuestRead;
        DB.afterFirstGuestRead = null;
        hook();
      }
      return out;
    }
    if (op.kind === 'delete') {
      DB[name] = rows().filter((r) => !hit.includes(r));
      return { data: returning ? hit : null, error: null };
    }
    for (const r of hit) {
      // free_seat_on_decline: a reply moved TO declined frees that guest's chair.
      if (name === 'guests' && op.patch.rsvp_status === 'declined' && r.rsvp_status !== 'declined') {
        DB.event_seat_assignments = DB.event_seat_assignments.filter((x) => !(x.guest_id === r.guest_id && x.event_id === r.event_id));
      }
      const countMoved = name === 'guests' && 'plus_one_count' in op.patch && op.patch.plus_one_count !== r.plus_one_count;
      Object.assign(r, op.patch);
      if (countMoved && !r.plus_one_of_guest_id && !r.deleted_at) followCount(r);
    }
    return { data: returning ? hit.map((r) => ({ ...r })) : null, error: null };
  };
  const b: Record<string, unknown> = {
    select: () => ((op.kind === 'select' ? null : (returning = true)), b),
    eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
    neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), b),
    in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), b),
    is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), b),
    update: (patch: Row) => ((op = { kind: 'update', patch }), b),
    delete: () => ((op = { kind: 'delete' }), b),
    upsert: (rs: Row[]) => ((op = { kind: 'upsert', rows: rs }), b),
    maybeSingle: async () => {
      const r = run();
      return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error };
    },
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
  };
  return b;
}

const client = {
  from: (t: string) => table(t as Table),
  rpc: async (fn: string, args: { p_event_id: string; p_guest_ids: string[] }) => {
    if (fn === 'restore_deleted_guests') {
      const back = DB.guests.filter((g) => g.event_id === args.p_event_id && args.p_guest_ids.includes(g.guest_id as string) && g.deleted_at);
      for (const g of back) g.deleted_at = null;
      return { data: [{ restored_guest_ids: back.map((g) => g.guest_id), songs_restored: 0, songs_not_restored: 0 }], error: null };
    }
    return { data: null, error: null };
  },
};

/* ── module shims: the server's client, Next's cache, and the public-copy refresh (no network, no Next) ──────────── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
function shim(id: string, exports: unknown): string {
  const file = path.join(process.cwd(), `__seat_release_${id}__.js`);
  const m = new CjsModule(file);
  m.filename = file;
  m.loaded = true;
  m.exports = exports;
  m.paths = [];
  CjsModule._cache[file] = m;
  return file;
}
const SHIMS: Record<string, string> = {
  'server-only': shim('server_only', {}),
  '@/lib/supabase/server': shim('server', { createClient: async () => client }),
  '@/lib/supabase/admin': shim('admin', { createAdminClient: () => client }),
  '@/lib/a-withdrawal-reaches-every-copy.server': shim('copies', { everyCopyIsNowStale: async () => {} }),
  'next/cache': shim('next_cache', { revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (f: unknown) => f }),
};
{
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request in SHIMS) return SHIMS[request]!;
    return original.call(this, request, ...rest);
  };
}

