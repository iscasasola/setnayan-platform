/**
 * business-alaga-ensure.test.ts — every door that makes an account own a shop
 * gives that shop its business alaga, and the writer can never fail the door.
 *
 * Owner 2026-09-30 (DECISION_LOG "ONLY PEOPLE CAN BE INVITED…"): "if you create
 * a business. it also creates a beloved that is your business." Shipped for
 * open-shop only; a shop that became the account's through the CLAIM flow never
 * got its record, so its owner could not pick "For · <shop>" (2026-10-22).
 *
 * Three halves:
 *
 *   1 · BEHAVIOUR. `ensureBusinessAlaga` through a fake client: writes exactly
 *       the shop's row once, behind the People gates, read-then-write, a 23505
 *       read as success, a refused read writing nothing, an existing record
 *       renamed, and it never throws.
 *
 *   2 · THE TYPESCRIPT DOORS (a property, not a list). Every file under `app/` +
 *       `lib/` whose CODE gives a shop an owner — a `vendor_profiles` insert or
 *       upsert carrying a non-null `user_id`, an update that SETS `user_id`, or
 *       an `.rpc()` to a SQL function that opens or re-owns a shop — must call
 *       `ensureBusinessAlaga` AFTER every such write in the file. A new door is
 *       found by its code; an exemption must say why and must still match.
 *
 *   3 · THE SQL DOORS. Every function in `supabase/migrations/` (latest
 *       definition wins) that opens a shop for a user, re-owns one, or writes a
 *       shop's `business_name` must EITHER be called from TypeScript (so half 2
 *       holds its caller to the rule) OR open the shop NAMELESS — a nameless shop
 *       has nothing honest to record yet, and gets its record at the door that
 *       first names it (My Shop's rename, held by `business-alaga-sync.test.ts`).
 *       That is exactly `handle_new_vendor_user`, the vendor sign-up trigger.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { ensureBusinessAlaga, peopleGateOpen } from './business-alaga-ensure';

// ── 1 · BEHAVIOUR ──────────────────────────────────────────────────────────

type Call = {
  table: string;
  op: 'select' | 'insert' | 'update' | null;
  payload: unknown;
  eqs: Array<[string, unknown]>;
};

type FakeOpts = {
  existing?: { dependent_id: string } | null;
  readError?: { message: string; code?: string } | null;
  insertError?: { message: string; code?: string } | null;
  throws?: boolean;
};

function fakeClient(opts: FakeOpts = {}) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      if (opts.throws) throw new Error('network down');
      const call: Call = { table, op: null, payload: undefined, eqs: [] };
      calls.push(call);
      const result = () =>
        call.op === 'insert'
          ? { error: opts.insertError ?? null }
          : call.op === 'select'
            ? { data: opts.existing ?? null, error: opts.readError ?? null }
            : { error: null };
      const chain = {
        select(cols: string) {
          call.op = 'select';
          call.payload = cols;
          return chain;
        },
        insert(row: unknown) {
          call.op = 'insert';
          call.payload = row;
          return chain;
        },
        update(patch: unknown) {
          call.op = 'update';
          call.payload = patch;
          return chain;
        },
        eq(col: string, val: unknown) {
          call.eqs.push([col, val]);
          return chain;
        },
        maybeSingle() {
          return Promise.resolve(result());
        },
        then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
          return Promise.resolve(result()).then(resolve, reject);
        },
      };
      return chain;
    },
  };
  return { client: client as never, calls };
}

const OPEN = async () => true;
const CLOSED = async () => false;
const INPUT = { ownerUserId: 'user-1', vendorProfileId: 'shop-1', shopName: '  Tindahan ni Aling Nena  ' };

test('a shop with no record gets exactly its own row, once', async () => {
  const { client, calls } = fakeClient();
  assert.equal(await ensureBusinessAlaga(client, INPUT, OPEN), 'created');
  const read = calls.find((c) => c.op === 'select');
  const inserts = calls.filter((c) => c.op === 'insert');
  assert.ok(read, 'it must READ before it writes — the idempotency key is the backstop, not the plan');
  assert.equal(read!.table, 'dependents');
  assert.deepEqual(Object.fromEntries(read!.eqs), { owner_user_id: 'user-1', vendor_profile_id: 'shop-1' });
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0]!.table, 'dependents');
  assert.deepEqual(inserts[0]!.payload, {
    owner_user_id: 'user-1',
    vendor_profile_id: 'shop-1',
    dependent_kind: 'business',
    name: 'Tindahan ni Aling Nena',
  });
  assert.ok(calls.indexOf(read!) < calls.indexOf(inserts[0]!), 'read-then-write, in that order');
});

test('a shop that already has its record is renamed, never duplicated', async () => {
  const { client, calls } = fakeClient({ existing: { dependent_id: 'd-1' } });
  assert.equal(await ensureBusinessAlaga(client, INPUT, OPEN), 'renamed');
  assert.equal(calls.filter((c) => c.op === 'insert').length, 0);
  const upd = calls.find((c) => c.op === 'update');
  assert.ok(upd, 'the existing record follows the shop name');
  assert.equal((upd!.payload as { name: string }).name, 'Tindahan ni Aling Nena');
  assert.deepEqual(Object.fromEntries(upd!.eqs), {
    owner_user_id: 'user-1',
    vendor_profile_id: 'shop-1',
    dependent_kind: 'business',
  });
});

test('closed People gates write nothing new — but an existing record still follows the name', async () => {
  const { client, calls } = fakeClient();
  assert.equal(await ensureBusinessAlaga(client, INPUT, CLOSED), 'gated');
  assert.equal(calls.filter((c) => c.op === 'insert').length, 0, 'no row nobody can see');
  assert.equal(calls.filter((c) => c.op === 'select').length, 0);
  assert.equal(calls.filter((c) => c.op === 'update').length, 1, 'the rename is ungated, as it shipped');
});

test('a refused read writes nothing — "unreadable" is not "no record yet"', async () => {
  const { client, calls } = fakeClient({ readError: { message: 'permission denied', code: '42501' } });
  assert.equal(await ensureBusinessAlaga(client, INPUT, OPEN), 'unread');
  assert.equal(calls.filter((c) => c.op === 'insert' || c.op === 'update').length, 0);
});

test('a lost race (23505) is the record existing — success; any other refusal is reported, not thrown', async () => {
  const raced = fakeClient({ insertError: { code: '23505', message: 'duplicate key value violates unique constraint' } });
  assert.equal(await ensureBusinessAlaga(raced.client, INPUT, OPEN), 'created');
  const refused = fakeClient({ insertError: { code: '42501', message: 'permission denied' } });
  assert.equal(await ensureBusinessAlaga(refused.client, INPUT, OPEN), 'failed');
});

test('a thrown client or a thrown gate never fails the door', async () => {
  const thrown = fakeClient({ throws: true });
  assert.equal(await ensureBusinessAlaga(thrown.client, INPUT, OPEN), 'failed');
  const ok = fakeClient();
  const badGate = async () => {
    throw new Error('controls unreadable');
  };
  assert.equal(await ensureBusinessAlaga(ok.client, INPUT, badGate), 'failed');
});

test('no owner, no shop or a blank name: nothing to record, nothing read', async () => {
  for (const input of [
    { ...INPUT, ownerUserId: null },
    { ...INPUT, vendorProfileId: undefined },
    { ...INPUT, shopName: '   ' },
    { ...INPUT, shopName: null },
  ]) {
    const { client, calls } = fakeClient();
    let gateAsked = false;
    const gate = async () => {
      gateAsked = true;
      return true;
    };
    assert.equal(await ensureBusinessAlaga(client, input, gate), 'nothing_to_record', JSON.stringify(input));
    assert.equal(calls.length, 0);
    assert.equal(gateAsked, false);
  }
});

test('the default gate is shut while NEXT_PUBLIC_DEPENDENT_PEOPLE is not 1', async () => {
  const before = process.env.NEXT_PUBLIC_DEPENDENT_PEOPLE;
  try {
    delete process.env.NEXT_PUBLIC_DEPENDENT_PEOPLE;
    assert.equal(await peopleGateOpen(), false);
    process.env.NEXT_PUBLIC_DEPENDENT_PEOPLE = '0';
    assert.equal(await peopleGateOpen(), false);
  } finally {
    if (before === undefined) delete process.env.NEXT_PUBLIC_DEPENDENT_PEOPLE;
    else process.env.NEXT_PUBLIC_DEPENDENT_PEOPLE = before;
  }
});

// ── 3 · THE SQL DOORS (read first: half 2 needs the RPC names) ──────────────

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, '..', '..', 'supabase', 'migrations');

/** Latest body per SQL function, in filename (= replay) order. */
function sqlFunctions(): Map<string, { body: string; file: string }> {
  const out = new Map<string, { body: string; file: string }>();
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  const head = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi;
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    for (const m of sql.matchAll(head)) {
      const after = sql.slice(m.index! + m[0].length);
      const open = after.match(/\bAS\s+(\$[a-z_]*\$)/i);
      if (!open) continue;
      const bodyStart = open.index! + open[0].length;
      const close = after.indexOf(open[1]!, bodyStart);
      if (close === -1) continue;
      out.set(m[1]!.toLowerCase(), { body: after.slice(bodyStart, close), file });
    }
  }
  return out;
}

/** The column list of every `INSERT INTO vendor_profiles (…)` in a body. */
function vendorProfileInsertColumns(body: string): string[][] {
  return [...body.matchAll(/INSERT\s+INTO\s+(?:public\.)?vendor_profiles\s*\(([^)]*)\)/gi)].map((m) =>
    m[1]!.split(',').map((c) => c.trim().toLowerCase()),
  );
}

/** The SET clauses of every `UPDATE vendor_profiles … SET …` statement in a body. */
function vendorProfileUpdateSets(body: string): string[] {
  return [...body.matchAll(/UPDATE\s+(?:public\.)?vendor_profiles\b[^;]*?\bSET\b([^;]*)/gi)].map((m) =>
    // Only the assignments, not the WHERE that follows them.
    m[1]!.split(/\bWHERE\b/i)[0]!.toLowerCase(),
  );
}

type SqlDoor = { name: string; file: string; opensForUser: boolean; reOwns: boolean; names: boolean };

function sqlShopDoors(): SqlDoor[] {
  const doors: SqlDoor[] = [];
  for (const [name, { body, file }] of sqlFunctions()) {
    const inserts = vendorProfileInsertColumns(body);
    const sets = vendorProfileUpdateSets(body);
    const opensForUser = inserts.some((cols) => cols.includes('user_id'));
    const reOwns = sets.some((s) => /(^|[\s,])user_id\s*=/.test(s));
    const names =
      inserts.some((cols) => cols.includes('business_name')) || sets.some((s) => /(^|[\s,])business_name\s*=/.test(s));
    if (opensForUser || reOwns || names) {
      doors.push({ name, file, opensForUser, reOwns, names });
    }
  }
  return doors.sort((a, b) => a.name.localeCompare(b.name));
}

// ── 2 · THE TYPESCRIPT DOORS ───────────────────────────────────────────────

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** The text between the bracket at `open` and its partner. */
function balanced(code: string, open: number): string {
  const pairs: Record<string, string> = { '(': ')', '{': '}', '[': ']' };
  const stack: string[] = [];
  for (let i = open; i < code.length; i++) {
    const c = code[i]!;
    if (c in pairs) stack.push(pairs[c]!);
    else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return code.slice(open + 1, i);
    }
  }
  return code.slice(open + 1);
}

/** `user_id: <anything but null>` or the shorthand `{ user_id }` — an owner being written. */
const WRITES_AN_OWNER = /\buser_id\s*:\s*(?!null\b)\S|[{,]\s*user_id\s*[,}]/;

/**
 * Every position in this code where a shop gets an owner. Each is the END of the
 * write call, so "the ensure comes after it" is measured from where it finishes.
 */
function ownershipWrites(code: string, shopRpcs: ReadonlySet<string>): number[] {
  const at: number[] = [];
  const write = /\.from\(\s*['"]vendor_profiles['"]\s*\)\s*\.(insert|upsert|update)\(/g;
  for (const m of code.matchAll(write)) {
    const open = m.index! + m[0].length - 1;
    const payload = balanced(code, open);
    if (WRITES_AN_OWNER.test(payload)) at.push(open + payload.length);
  }
  for (const m of code.matchAll(/\.rpc\(\s*['"]([a-z_][a-z0-9_]*)['"]/g)) {
    if (shopRpcs.has(m[1]!)) at.push(m.index! + m[0].length);
  }
  return at;
}

/**
 * Files whose code gives a shop an owner but which are not a door an account
 * walks through. Each reason is checked by hand; each entry must STILL match
 * (stale = red), so the list cannot rot into a blanket pass.
 */
const NOT_AN_OWNER_DOOR: Record<string, string> = {};

function rpcCalledFromTs(): Set<string> {
  const names = new Set<string>();
  for (const f of [...walk(join(ROOT, 'app'), []), ...walk(join(ROOT, 'lib'), [])]) {
    const code = stripComments(readFileSync(f, 'utf8'));
    for (const m of code.matchAll(/\.rpc\(\s*['"]([a-z_][a-z0-9_]*)['"]/g)) names.add(m[1]!);
  }
  return names;
}

function shopRpcNames(): Set<string> {
  const called = rpcCalledFromTs();
  return new Set(sqlShopDoors().map((d) => d.name).filter((n) => called.has(n)));
}

function ownerDoors(): Array<{ rel: string; writes: number[]; code: string }> {
  const rpcs = shopRpcNames();
  const files = [...walk(join(ROOT, 'app'), []), ...walk(join(ROOT, 'lib'), [])];
  return files
    .map((f) => {
      const code = stripComments(readFileSync(f, 'utf8'));
      return { rel: relative(ROOT, f), writes: ownershipWrites(code, rpcs), code };
    })
    .filter((d) => d.writes.length > 0)
    .sort((a, b) => a.rel.localeCompare(b.rel));
}

test('the scans find the doors they were written for (they can hit)', () => {
  const doors = sqlShopDoors().map((d) => d.name);
  for (const known of ['claim_ready_the_shop', 'handle_new_vendor_user']) {
    assert.ok(doors.includes(known), `SQL scan no longer detects ${known} — the detector is broken`);
  }
  assert.ok(shopRpcNames().has('claim_ready_the_shop'), 'the claim RPC is no longer seen as a TS-called shop door');
  const ts = ownerDoors().map((d) => d.rel);
  for (const known of ['app/open-shop/actions.ts', 'app/vendor/claim/[token]/finalize/page.tsx']) {
    assert.ok(ts.includes(known), `TS scan no longer detects ${known} — the detector is broken`);
  }
  // The admin STAGING insert writes `user_id: null` — an unowned shop, so no
  // alaga. It must NOT be read as a door; if it is, the null rule went blind.
  assert.equal(ts.includes('app/admin/vendors/actions.ts'), false, 'user_id: null was read as an owner');
});

test('every TypeScript door that gives a shop an owner then writes its business alaga', () => {
  const missing: string[] = [];
  for (const { rel, writes, code } of ownerDoors()) {
    if (rel in NOT_AN_OWNER_DOOR) continue;
    const ensures = [...code.matchAll(/\bensureBusinessAlaga\(/g)].map((m) => m.index!);
    const lastWrite = Math.max(...writes);
    if (!ensures.some((i) => i > lastWrite)) missing.push(rel);
  }
  assert.deepEqual(
    missing,
    [],
    `These give a shop an owner but never call ensureBusinessAlaga after it, so the owner cannot pick "For · <shop>" and People says they care for nothing:\n  ${missing.join('\n  ')}\n` +
      'Call ensureBusinessAlaga(adminClient, { ownerUserId, vendorProfileId, shopName }) after the last ownership write — or, if the file is not a door an account walks through, add it to NOT_AN_OWNER_DOOR with the reason.',
  );
});

test('every NOT_AN_OWNER_DOOR entry still matches (no stale passes)', () => {
  const doors = new Set(ownerDoors().map((d) => d.rel));
  for (const rel of Object.keys(NOT_AN_OWNER_DOOR)) {
    assert.ok(doors.has(rel), `${rel} no longer gives a shop an owner — remove it from NOT_AN_OWNER_DOOR`);
  }
});

test('every SQL door is either called from TypeScript, or opens the shop nameless', () => {
  const called = rpcCalledFromTs();
  const wrong: string[] = [];
  for (const d of sqlShopDoors()) {
    if (called.has(d.name)) continue; // half 2 holds its caller
    // Not called from TS (a trigger): it may only open an EMPTY shop. A shop it
    // named or re-owned would have no TypeScript door to write its record.
    if (d.names || d.reOwns) wrong.push(`${d.name} (${d.file})`);
  }
  assert.deepEqual(
    wrong,
    [],
    `These SQL functions name or re-own a shop with no TypeScript caller to write its business alaga:\n  ${wrong.join('\n  ')}`,
  );
});
