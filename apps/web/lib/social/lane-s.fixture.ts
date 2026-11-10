/**
 * A recording fake of the Supabase admin client, for the Lane S composer tests (`badge-post.test.ts`,
 * `milestones.test.ts`). Every query is ONE `Call` — table, action, filters, payload — answered by the test's
 * `respond`. Chains are thenable, so `await admin.from(t).update(x).eq(...)` resolves like the real client.
 */

export type Call = {
  table: string;
  action: 'select' | 'insert' | 'update' | 'rpc';
  columns?: string;
  filters: Array<[string, string, unknown]>;
  payload?: unknown;
  fn?: string;
};

export type Answer = { data?: unknown; error?: { code?: string; message?: string } | null };

export function fakeAdmin(respond: (call: Call) => Answer | undefined) {
  const calls: Call[] = [];
  const run = (call: Call) => {
    calls.push(call);
    const a = respond(call) ?? {};
    return Promise.resolve({ data: a.data ?? null, error: a.error ?? null });
  };

  function chain(call: Call): Record<string, unknown> {
    const self: Record<string, unknown> = {};
    const filter = (op: string) => (col: string, val?: unknown) => {
      call.filters.push([op, col, val]);
      return self;
    };
    for (const op of ['eq', 'neq', 'in', 'is', 'or', 'not', 'gte', 'lte', 'lt']) self[op] = filter(op);
    self.order = () => self;
    self.limit = () => self;
    self.select = (columns?: string) => {
      // insert(...).select('post_id') keeps the insert's action; it only names what comes back.
      if (call.action === 'select') call.columns = columns;
      return self;
    };
    self.maybeSingle = () => run(call);
    self.single = () => run(call);
    self.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => run(call).then(ok, bad);
    return self;
  }

  const admin = {
    from(table: string) {
      return {
        select: (columns?: string) => chain({ table, action: 'select', columns, filters: [] }),
        insert: (payload: unknown) => chain({ table, action: 'insert', payload, filters: [] }),
        update: (payload: unknown) => chain({ table, action: 'update', payload, filters: [] }),
      };
    },
    rpc(fn: string, args?: unknown) {
      return run({ table: '', action: 'rpc', fn, payload: args, filters: [] });
    },
  };
  return { admin, calls };
}

/** Make `import 'server-only'` a no-op under the node test runner (same trick as invitation-chapters.fixture). */
export function allowServerOnly() {
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}
