/**
 * AN ADMIN-GATED RPC MUST NEVER BE CALLED ON THE SERVICE-ROLE CLIENT.
 *
 * ── THE DEFECT THIS EXISTS FOR (2026-08-21) ─────────────────────────────────
 * The plan-activation hook called `approve_vendor_subscription` through
 * `ctx.admin` — `createAdminClient()`, the service_role key, which carries NO
 * user. Inside the database `auth.uid()` is then NULL, `is_console_admin()` is
 * false, and the function RAISES `FORBIDDEN: admin only` before touching a row.
 * The caller swallowed it, so a shop's payment was approved and their plan
 * silently stayed off.
 *
 * 🔑 IT READS EXACTLY LIKE THE RIGHT THING TO DO. Service-role is the
 * "powerful" client, so reaching for it to do an admin's work is the natural
 * mistake. It is precisely backwards: service_role bypasses RLS *policies* and
 * fails every check that asks WHO IS THIS.
 *
 * ── WHY THE LIST IS DERIVED, NOT TYPED ──────────────────────────────────────
 * A hand-written list of admin-gated functions is a bill somebody has to keep
 * paying, and the next gated function added would not be on it. So the set is
 * read out of the migrations themselves: any `CREATE ... FUNCTION` whose body
 * gates on `is_console_admin()` / `is_admin()`.
 *
 * ⚠ What this does NOT prove: that the gated function actually refuses. That is
 * `tests/db/plan-activation-needs-a-real-admin.db.test.ts`, which calls it with
 * no `auth.uid()` and asserts the refusal. This file is the other half — that
 * nothing in the app hands it a client which can never satisfy the gate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WEB = process.cwd();
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');

/** Function names whose body gates on the caller being a console admin. */
function adminGatedFunctions(): Set<string> {
  const gated = new Set<string>();
  for (const file of readdirSync(MIGRATIONS)) {
    if (!file.endsWith('.sql')) continue;
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    // Split on function headers, then keep a body that consults the gate.
    const parts = sql.split(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+/i);
    for (const part of parts.slice(1)) {
      const name = part.match(/^(?:public\.)?([a-z0-9_]+)\s*\(/i)?.[1];
      if (!name) continue;
      const body = part.slice(0, 8000);
      // ⚠ A HARD GATE, NOT A MENTION. Most functions that name is_admin() use
      // it to WIDEN a predicate (`... OR is_admin()`), which a service-role
      // caller simply fails without being refused — those are fine and must not
      // be flagged, or the guard cries wolf and gets skimmed past. Only a
      // function that REFUSES an unauthenticated caller outright can never
      // succeed on the service-role client.
      const hardGate =
        /IF\s+NOT\s+(?:public\.)?is_(?:console_)?admin\s*\(\s*\)[\s\S]{0,200}?RAISE/i.test(body);
      if (hardGate) gated.add(name.toLowerCase());
    }
  }
  return gated;
}

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  return out;
}

/**
 * A `.rpc('name')` reached through a client whose NAME says service-role.
 * Matches `admin.rpc(`, `ctx.admin.rpc(`, `createAdminClient().rpc(`,
 * `moneyWriter.rpc(` — the four spellings this repo actually uses.
 */
const SERVICE_ROLE_RPC =
  /(?:^|[^A-Za-z0-9_])(?:ctx\.)?(?:admin|adminClient|moneyWriter|createAdminClient\(\)|createMoneyWriterClient\(\))\s*\.rpc\(\s*['"]([a-z0-9_]+)['"]/gi;

test('the admin-gated function list is derived and non-empty', () => {
  const gated = adminGatedFunctions();
  assert.ok(
    gated.size >= 5,
    `precondition: expected the migrations to yield several admin-gated functions, got ${gated.size}`,
  );
  assert.ok(
    gated.has('approve_vendor_subscription'),
    'approve_vendor_subscription gates on is_console_admin() — if this misses, the scan is broken',
  );
});

test('no admin-gated RPC is called on a service-role client', () => {
  const gated = adminGatedFunctions();
  const offenders: string[] = [];

  for (const file of sourceFiles()) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(SERVICE_ROLE_RPC)) {
      const fn = m[1]!.toLowerCase();
      if (!gated.has(fn)) continue;
      const line = src.slice(0, m.index ?? 0).split('\n').length;
      offenders.push(`${relative(WEB, file)}:${line} → ${fn}()`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'These call an admin-gated function through the service-role client, which has no ' +
      'auth.uid() and is REFUSED by the database — the call can never succeed. Use the ' +
      "approving admin's own session client instead.\n  " + offenders.join('\n  '),
  );
});
