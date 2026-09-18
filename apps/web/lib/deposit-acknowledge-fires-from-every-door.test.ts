/**
 * deposit-acknowledge-fires-from-every-door.test.ts — every TypeScript door
 * that acknowledges a deposit also runs the acknowledge effects.
 *
 * ─── The failure this catches ────────────────────────────────────────────
 * 2026-09-18, the platform's first real booking. The supplier pressed
 * "Confirm" on the payment card. `confirm_vendor_payment` acknowledged the
 * deposit inside SQL; the booking fee and the schedule reservation lived in
 * the OTHER door's TypeScript and never ran. Zero ledger rows, zero log lines.
 *
 * Two RPCs acknowledge a deposit — `acknowledge_vendor_deposit` directly, and
 * `confirm_vendor_payment` which calls it for a deposit's row. So the invariant
 * is: **every non-test file that calls either RPC also calls
 * `runDepositAcknowledgedEffects`, inside the same exported action.** A third
 * door added tomorrow fails this the moment it forgets.
 *
 * ─── It fails in both directions ─────────────────────────────────────────
 * A door that acknowledges without the effects → red. A caller of the effects
 * that is not a known door → red too (the effects mint a fee order; nothing
 * should be able to run them from an unexpected place). And the render-time
 * catch-up must be wired into the vendor layout's `after()`, or the bookings
 * already missed stay missed.
 *
 * Grep-shaped because the module is `server-only`; the decision it feeds is
 * pure and exercised in `deposit-acknowledged-effects.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

const EFFECTS_MODULE = 'lib/deposit-acknowledged-effects.server.ts';
const LAYOUT = 'app/vendor-dashboard/layout.tsx';

/** door file → the exported action the RPC call AND the effects call must sit inside. */
const DOORS: Record<string, { rpc: string; action: string }> = {
  'app/vendor-dashboard/clients/[eventId]/actions.ts': {
    rpc: 'acknowledge_vendor_deposit',
    action: 'vendorAcknowledgeDeposit',
  },
  'app/vendor-dashboard/messages/[threadId]/pay-confirm-actions.ts': {
    rpc: 'confirm_vendor_payment',
    action: 'confirmVendorPayment',
  },
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const ALL = ['app', 'lib']
  .flatMap((r) => walk(resolve(WEB, r)))
  .map((f) => relative(WEB, f))
  .filter((rel) => !/\.test\.tsx?$/.test(rel));

// The ONE comment stripper (lib/strip-comments.ts) — a home-grown two-replace
// regex opens a block comment on a line comment containing `video/*` and blanks
// everything to the next `*/`, and a guard then asserts against a blank.
const read = (rel: string) => stripComments(readFileSync(resolve(WEB, rel), 'utf8'));

/** Name of the `export async function` enclosing the FIRST match of `needle`. */
function enclosingAction(src: string, needle: RegExp): string | null {
  const m = needle.exec(src);
  if (!m) return null;
  const before = src.slice(0, m.index);
  const fnIdx = before.lastIndexOf('export async function ');
  if (fnIdx < 0) return null;
  return before.slice(fnIdx).match(/export async function (\w+)/)?.[1] ?? null;
}

/** Every occurrence, so a second call in the wrong function cannot hide behind the first. */
function allEnclosingActions(src: string, needle: RegExp): string[] {
  const out: string[] = [];
  const re = new RegExp(needle.source, needle.flags.includes('g') ? needle.flags : needle.flags + 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const before = src.slice(0, m.index);
    const fnIdx = before.lastIndexOf('export async function ');
    out.push(fnIdx < 0 ? '<top-level>' : (before.slice(fnIdx).match(/export async function (\w+)/)?.[1] ?? '<?>'));
  }
  return out;
}

const RPC_CALL = (name: string) => new RegExp(`\\.rpc\\(\\s*['"]${name}['"]`);
const EFFECTS_CALL = /runDepositAcknowledgedEffects\s*\(/;

test('the set of TypeScript files calling an acknowledging RPC is exactly the known doors', () => {
  const found = ALL.filter((rel) => {
    const src = read(rel);
    return Object.values(DOORS).some((d) => RPC_CALL(d.rpc).test(src));
  }).sort();
  assert.deepEqual(
    found,
    Object.keys(DOORS).sort(),
    `Files calling acknowledge_vendor_deposit / confirm_vendor_payment: ${found.join(', ') || 'NONE'}.\n` +
      `A new door must be added to DOORS in this test AND call runDepositAcknowledgedEffects.`,
  );
});

test('every door runs the effects, inside the SAME exported action that calls the RPC', () => {
  for (const [rel, door] of Object.entries(DOORS)) {
    const src = read(rel);
    const rpcIn = enclosingAction(src, RPC_CALL(door.rpc));
    assert.equal(rpcIn, door.action, `${rel}: the ${door.rpc} call sits in ${rpcIn}, expected ${door.action}`);

    const effectsIn = allEnclosingActions(src, EFFECTS_CALL);
    assert.deepEqual(
      effectsIn,
      [door.action],
      `${rel}: runDepositAcknowledgedEffects must be called exactly once, inside ${door.action} ` +
        `(found in: ${effectsIn.join(', ') || 'NOWHERE'}). This is the 2026-09-18 miss.`,
    );
  }
});

test('nothing else calls the effects — they mint a fee order and must not be reachable from a surprise', () => {
  const callers = ALL.filter((rel) => rel !== EFFECTS_MODULE && EFFECTS_CALL.test(read(rel))).sort();
  assert.deepEqual(callers, Object.keys(DOORS).sort(), `unexpected callers: ${callers.join(', ')}`);
});

test('the effects module itself owns the catch-up, and the vendor layout fires it post-response', () => {
  const mod = read(EFFECTS_MODULE);
  assert.ok(/export async function maybeCatchUpAcknowledgedDeposits\s*\(/.test(mod), 'catch-up export missing');
  assert.ok(
    /maybeCatchUpAcknowledgedDeposits[\s\S]*?runDepositAcknowledgedEffects\s*\(/.test(
      mod.slice(mod.indexOf('export async function maybeCatchUpAcknowledgedDeposits')),
    ),
    'the catch-up must run the effects for each missed booking',
  );

  const layout = read(LAYOUT);
  const hits = layout.match(/after\(\s*\(\)\s*=>\s*maybeCatchUpAcknowledgedDeposits\(user\.id\)/g) ?? [];
  assert.equal(hits.length, 1, `the layout must fire the catch-up exactly once via after() — found ${hits.length}`);
});

test('the effects module records every outcome through the pure judge, and reads event_id off the row', () => {
  const mod = read(EFFECTS_MODULE);
  assert.ok(/judgeDepositEffects\s*\(/.test(mod), 'the judge is not consulted');
  assert.ok(/Sentry\.captureMessage\s*\(/.test(mod), 'attention outcomes must reach Sentry');
  // The old block took event_id from FormData; this module must not accept one.
  assert.ok(
    !/args\s*:\s*\{[^}]*eventId/.test(mod),
    'runDepositAcknowledgedEffects must take only the booking id and read event_id off the row',
  );
});

test('the scan actually scanned something', () => {
  assert.ok(ALL.length > 500, `only ${ALL.length} files walked — the roots are wrong`);
});
