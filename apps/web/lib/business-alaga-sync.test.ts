/**
 * business-alaga-sync.test.ts — a renamed shop renames its business alaga, and
 * EVERY writer of `vendor_profiles.business_name` does it.
 *
 * Two halves:
 *
 *   1 · BEHAVIOUR. `syncBusinessAlagaName` driven through a fake client: it
 *       renames exactly the shop's own business row, normalises the name the way
 *       the open-shop insert did, skips what it cannot do honestly, and can never
 *       throw — a record-keeping failure must not fail a supplier's rename.
 *
 *   2 · COVERAGE (a property, not a list). Every file under `app/` + `lib/` whose
 *       CODE both updates/upserts `vendor_profiles` AND names `business_name`
 *       is a rename writer, and must call `ensureBusinessAlaga` — unless it is
 *       in `NOT_A_RENAME` below with the reason it cannot rename an owned shop.
 *       A new writer is found by its code; nobody has to remember to list it.
 *       A stale exemption (a file that no longer matches) fails too, so the
 *       list cannot rot into a blanket pass.
 *
 *       Since 2026-10-22 the call is `ensureBusinessAlaga` — it renames through
 *       `syncBusinessAlagaName` when the record exists AND writes it when it does
 *       not, so a shop first NAMED at one of these doors (a vendor sign-up's
 *       trigger opens it empty) gets its record there.
 *
 * ⚠ SCOPE: TypeScript only. SQL functions that write `business_name` are held by
 * `lib/business-alaga-ensure.test.ts`: the one that exists (`20271280303462`
 * claim-ready) is called only from the claim finalize page, which calls
 * `ensureBusinessAlaga` after it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { syncBusinessAlagaName } from './business-alaga-sync';

// ── 1 · BEHAVIOUR ──────────────────────────────────────────────────────────

type Call = { table: string; patch: Record<string, unknown>; eqs: Array<[string, unknown]> };

function fakeClient(opts: { error?: { message: string; code?: string } | null; throws?: boolean } = {}) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      if (opts.throws) throw new Error('network down');
      const call: Call = { table, patch: {}, eqs: [] };
      calls.push(call);
      const chain = {
        update(patch: Record<string, unknown>) {
          call.patch = patch;
          return chain;
        },
        eq(col: string, val: unknown) {
          call.eqs.push([col, val]);
          return chain;
        },
        then(resolve: (v: { error: unknown }) => unknown) {
          return Promise.resolve({ error: opts.error ?? null }).then(resolve);
        },
      };
      return chain;
    },
  };
  return { client: client as never, calls };
}

test('renames exactly the shop’s own business alaga', async () => {
  const { client, calls } = fakeClient();
  await syncBusinessAlagaName(client, {
    ownerUserId: 'user-1',
    vendorProfileId: 'shop-1',
    shopName: '  Bagong Pangalan Catering  ',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.table, 'dependents');
  assert.equal(calls[0]!.patch.name, 'Bagong Pangalan Catering');
  assert.deepEqual(
    Object.fromEntries(calls[0]!.eqs),
    { owner_user_id: 'user-1', vendor_profile_id: 'shop-1', dependent_kind: 'business' },
  );
});

test('caps the name at the same length the open-shop insert used', async () => {
  const { client, calls } = fakeClient();
  await syncBusinessAlagaName(client, { ownerUserId: 'u', vendorProfileId: 's', shopName: 'x'.repeat(300) });
  assert.equal((calls[0]!.patch.name as string).length, 128);
});

test('writes nothing without an owner, a shop or a name', async () => {
  for (const input of [
    { ownerUserId: null, vendorProfileId: 's', shopName: 'A' },
    { ownerUserId: 'u', vendorProfileId: undefined, shopName: 'A' },
    { ownerUserId: 'u', vendorProfileId: 's', shopName: '   ' },
  ]) {
    const { client, calls } = fakeClient();
    await syncBusinessAlagaName(client, input);
    assert.equal(calls.length, 0, JSON.stringify(input));
  }
});

test('a refused write or a thrown client never fails the rename', async () => {
  const refused = fakeClient({ error: { message: 'permission denied', code: '42501' } });
  await assert.doesNotReject(
    syncBusinessAlagaName(refused.client, { ownerUserId: 'u', vendorProfileId: 's', shopName: 'A' }),
  );
  const thrown = fakeClient({ throws: true });
  await assert.doesNotReject(
    syncBusinessAlagaName(thrown.client, { ownerUserId: 'u', vendorProfileId: 's', shopName: 'A' }),
  );
});

// ── 2 · COVERAGE ───────────────────────────────────────────────────────────

const ROOT = process.cwd();

/**
 * Files whose code matches the writer shape but which cannot rename a shop
 * that has an owner — so there is no alaga to follow. Each reason is checked by
 * hand against the file; each entry must STILL match the shape (stale = red).
 */
const NOT_A_RENAME: Record<string, string> = {
  'app/admin/vendors/actions.ts':
    'admin STAGING of an unclaimed shop: the insert has user_id NULL and the edit is filtered `.is(\'user_id\', null)` — no owner, so no alaga exists',
};

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** A `vendor_profiles` update/upsert call, up to its opening paren. */
const VENDOR_PROFILES_WRITE = /\.from\(\s*['"]vendor_profiles['"]\s*\)\s*\.(?:update|upsert)\(/g;

/** The text between the bracket at `open` and its partner (strings are rare enough here to ignore). */
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

const NAMES_COLUMN = /\bbusiness_name\b/;

/**
 * Does this file's CODE write `vendor_profiles.business_name`? Judged per call,
 * from the payload each `vendor_profiles` update/upsert actually receives:
 *
 *   • an inline payload that names the column            → `{ business_name: v }`
 *   • a payload built in a variable that names it        → `patch = { business_name: v }` … `.update({ ...patch })`
 *                                                           (or `patch.business_name = …`)
 *   • a COMPUTED key, in a file that names the column as a field choice
 *                                                         → `.update({ [request.field_key]: value })` + `case 'business_name'`
 *
 * A `.select()` list, a row type or an audit-log object never counts — only
 * what reaches a `vendor_profiles` write does. `\b` keeps
 * `registered_business_name` (the DTI name, a different column) out.
 */
function writesBusinessName(code: string): boolean {
  for (const m of code.matchAll(VENDOR_PROFILES_WRITE)) {
    const payload = balanced(code, m.index! + m[0].length - 1);
    if (NAMES_COLUMN.test(payload)) return true;
    if (/\[[^\]]+\]\s*:/.test(payload) && /['"]business_name['"]/.test(code)) return true;
    for (const [, ident] of payload.matchAll(/(?:^|[\s,{(]|\.\.\.)([A-Za-z_$][\w$]*)\s*(?=[,})]|$)/g)) {
      if (!ident || ['null', 'true', 'false', 'undefined'].includes(ident) || ident.includes('$')) continue;
      if (new RegExp(`\\b${ident}\\.business_name\\s*=|\\b${ident}\\[['"]business_name['"]\\]\\s*=`).test(code)) return true;
      const assign = new RegExp(`\\b${ident}\\s*(?::[^=;]+)?=\\s*\\{`, 'g');
      for (const a of code.matchAll(assign)) {
        if (NAMES_COLUMN.test(balanced(code, a.index! + a[0].length - 1))) return true;
      }
    }
  }
  return false;
}

function renameWriters(): string[] {
  const files = [...walk(join(ROOT, 'app'), []), ...walk(join(ROOT, 'lib'), [])];
  return files
    .filter((f) => writesBusinessName(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(ROOT, f))
    .sort();
}

test('the scan finds the rename writers it was written for (it can hit)', () => {
  const writers = renameWriters();
  // The two shop-name doors that exist today. If the scan stops seeing either,
  // it has gone blind, not clean.
  for (const known of ['app/vendor-dashboard/actions.ts', 'app/admin/corrections/actions.ts', 'app/open-shop/actions.ts']) {
    assert.ok(writers.includes(known), `scan no longer detects ${known} — the detector is broken`);
  }
});

test('every writer of vendor_profiles.business_name also renames the business alaga', () => {
  const missing = renameWriters().filter((rel) => {
    if (rel in NOT_A_RENAME) return false;
    const code = stripComments(readFileSync(join(ROOT, rel), 'utf8'));
    return !/\bensureBusinessAlaga\(/.test(code);
  });
  assert.deepEqual(
    missing,
    [],
    `These write vendor_profiles.business_name but never call ensureBusinessAlaga, so a renamed shop keeps its old name in "For ▾" and on People (and a shop first named there never gets its record):\n  ${missing.join('\n  ')}\n` +
      'Call ensureBusinessAlaga(adminClient, { ownerUserId, vendorProfileId, shopName }) after the write — or, if the file cannot rename an OWNED shop, add it to NOT_A_RENAME with the reason.',
  );
});

test('every NOT_A_RENAME entry still matches the writer shape (no stale passes)', () => {
  const writers = new Set(renameWriters());
  for (const rel of Object.keys(NOT_A_RENAME)) {
    assert.ok(writers.has(rel), `${rel} no longer writes business_name — remove it from NOT_A_RENAME`);
  }
});
