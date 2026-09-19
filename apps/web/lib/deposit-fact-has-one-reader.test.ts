/**
 * deposit-fact-has-one-reader.test.ts — DEPOSIT-TRUTH's fence (2026-09-19).
 *
 * The couple's "Record deposit" writes the money to the payment log and never
 * to `event_vendors.deposit_paid_php`. Every screen that read the column
 * directly therefore showed NO deposit on a recorded, supplier-confirmed
 * ₱2,000 (rosa-ben · Saysay, prod) — the workspace costing row, and Setnayan's
 * own deposit-dispute queue ("Couple recorded —"). #5670 fixed the yes/no half
 * (`bookingMoneyMoved`); `lib/paid-to-vendor.ts` is the amount half.
 *
 * Three properties, each facing a different way of undoing it:
 *   1 · THE RULE — executed: the log wins, the column is a fallback, never
 *       additive; the deposit is the `is_deposit_record` row.
 *   2 · THE ROSTER — every file whose code (comments stripped) names
 *       `deposit_paid_php` is listed here with how many times and why. A new
 *       reader, or one more read in a listed file, fails until it is added
 *       here on purpose.
 *   3 · EVERY PROPERTY READ IS AN ARGUMENT OF THE RULE — each
 *       `<row>.deposit_paid_php` must sit directly inside a call to one of the
 *       shared helpers. `formatPHP(ev.deposit_paid_php)` — the shape that
 *       caused this — fails, whatever file it is in.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { paidToVendorCentavos, paidToVendorPhp, recordedDepositPhp } from './paid-to-vendor';

// ── 1 · THE RULE ─────────────────────────────────────────────────────────────

test('rosa-ben: a recorded deposit is in the log and nowhere else — it counts', () => {
  const log = [{ amount_php: 2000, is_deposit_record: true }];
  assert.equal(paidToVendorPhp(log, null), 2000);
  assert.equal(recordedDepositPhp(log, null), 2000);
});

test('the log wins and is never added to the legacy column (R6: that double-counts)', () => {
  // Prod shape: all three legacy deposits also exist as log rows of exactly that amount.
  const log = [{ amount_php: '67500.00', is_deposit_record: false }];
  assert.equal(paidToVendorCentavos(log, '67500.00'), 67_500_00);
  // A second payment on top of the deposit: the log's sum, not log + column.
  const two = [...log, { amount_php: 10_000 }];
  assert.equal(paidToVendorPhp(two, 67_500), 77_500);
});

test('the legacy column counts only when the log has no row at all', () => {
  assert.equal(paidToVendorPhp([], '5000.00'), 5000);
  assert.equal(paidToVendorPhp([], null), 0);
  assert.equal(paidToVendorPhp([], -5), 0);
});

test('the deposit is the is_deposit_record row; none on file is null, never ₱0', () => {
  assert.equal(recordedDepositPhp([{ amount_php: 9000, is_deposit_record: false }], null), null);
  assert.equal(recordedDepositPhp([], 0), null);
  assert.equal(recordedDepositPhp([], '3000'), 3000);
  // The deposit row outranks the typed column when both exist.
  assert.equal(recordedDepositPhp([{ amount_php: 2000, is_deposit_record: true }], 1500), 2000);
});

// ── 2 · THE ROSTER ───────────────────────────────────────────────────────────

const WEB = join(__dirname, '..');
const ROOTS = ['app', 'lib', 'components'];

function walk(dir: string, out: string[]): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const n of names) {
    if (n === 'node_modules' || n === '.next') continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

const SOURCES = new Map<string, string>();
for (const root of ROOTS) {
  for (const f of walk(join(WEB, root), [])) {
    SOURCES.set(relative(WEB, f), stripComments(readFileSync(f, 'utf8')));
  }
}

const TOKEN = /\bdeposit_paid_php\b/g;

/**
 * Every file whose CODE names the column, how many times, and why that is
 * safe. Selects and row types are carriers; the reads they feed are held by
 * property 3.
 */
const ROSTER: Record<string, { count: number; why: string }> = {
  'lib/paid-to-vendor.ts': { count: 0, why: 'THE AMOUNT RULE — takes the column as an argument, never names it' },
  'lib/booking-money-moved.ts': { count: 4, why: 'THE YES/NO RULE (#5670) — the column is one of its three signals' },
  'lib/budget-truth.ts': {
    count: 4,
    why: 'row type + select; the paid figure via paidToVendorCentavos, and the unreconciled_deposit warning compares the column to the log ON PURPOSE',
  },
  'lib/budget.ts': { count: 4, why: 'two selects; both paidTotal figures via paidToVendorPhp' },
  'lib/vendors.ts': { count: 2, why: 'EventVendorRow type + fetchEventVendors select (a carrier)' },
  'app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx': {
    count: 3,
    why: 'select + row type; "Paid so far" via paidToVendorPhp, Cancel-vs-Dispute via bookingMoneyMoved(ev)',
  },
  'app/dashboard/[eventId]/vendors/actions.ts': {
    count: 4,
    why: 'the vendors-list form WRITES the typed figure (key + form field); cancelBookingAsHost selects it for bookingMoneyMoved',
  },
  'app/dashboard/[eventId]/delete-actions.ts': {
    count: 2,
    why: 'select + argument to supplierWasPaid (lib/event-deletion-gate.ts), which also reads deposit_recorded_at and the log',
  },
  'app/admin/disputes/actions.ts': { count: 2, why: 'select + argument to recordedDepositPhp for the settlement audit' },
  'app/admin/disputes/_components/deposit-disputes-section.tsx': {
    count: 3,
    why: 'row type + select + argument to recordedDepositPhp ("Couple recorded ₱…")',
  },
};

test('every file that names deposit_paid_php is on the roster, with its exact count', () => {
  const found: Record<string, number> = {};
  for (const [f, src] of SOURCES) {
    const n = (src.match(TOKEN) ?? []).length;
    if (n > 0) found[f] = n;
  }
  // FLOOR: a walker that found nothing would pass everything below vacuously.
  console.log(`scanned ${SOURCES.size} files; ${Object.keys(found).length} name deposit_paid_php`);
  assert.ok(SOURCES.size > 1000, `only ${SOURCES.size} source files scanned — the walker is broken`);
  for (const [f, n] of Object.entries(found)) {
    console.log(`  ${n} × ${f}`);
    assert.ok(
      ROSTER[f],
      `${f} reads deposit_paid_php and is not on the roster. The couple's "Record deposit" never ` +
        'writes that column — read the amount through lib/paid-to-vendor.ts (or the yes/no through ' +
        'lib/booking-money-moved.ts), then add the file here with its reason.',
    );
    assert.equal(n, ROSTER[f].count, `${f}: deposit_paid_php count changed (${ROSTER[f].count} → ${n})`);
  }
  for (const [f, { count }] of Object.entries(ROSTER)) {
    assert.ok(SOURCES.has(f), `roster lists ${f}, which no longer exists`);
    if (count > 0) assert.ok(found[f], `roster lists ${f} but it no longer names the column — drop it`);
  }
});

// ── 3 · EVERY PROPERTY READ IS AN ARGUMENT OF THE RULE ──────────────────────

/** The calls a property read of the column may sit directly inside. */
const RULE_CALLS = new Set([
  'paidToVendorPhp',
  'paidToVendorCentavos',
  'recordedDepositPhp',
  'bookingMoneyMoved',
  'supplierWasPaid',
]);
/** The two files that ARE the rule, and the one deliberate comparison. */
const EXEMPT_READS: Record<string, { callee: string; count: number; why: string }[]> = {
  'lib/booking-money-moved.ts': [{ callee: '*', count: 3, why: 'the rule itself' }],
  'lib/budget-truth.ts': [
    {
      callee: 'toCentavos',
      count: 1,
      why: 'unreconciled_deposit: warns when the typed column EXCEEDS the log — it must read both',
    },
  ],
};

/** Blank string / template contents so parens inside them cannot unbalance the scan. */
function blankStrings(src: string): string {
  return src.replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, (m) =>
    m[0] + ' '.repeat(Math.max(0, m.length - 2)) + m[m.length - 1],
  );
}

/** The name of the nearest enclosing CALL, looking outward through grouping parens and braces. */
function enclosingCall(src: string, at: number): string | null {
  let depth = 0;
  for (let i = at - 1; i >= 0; i--) {
    const c = src[i];
    if (c === ')' || c === ']' || c === '}') depth++;
    else if (c === '(' || c === '[' || c === '{') {
      if (depth > 0) {
        depth--;
        continue;
      }
      if (c !== '(') continue; // an object literal / array / block: keep looking outward
      const before = src.slice(0, i).match(/([A-Za-z_$][\w$]*)\s*(?:<[^()]*>)?\s*$/);
      const name = before?.[1];
      if (name && !['if', 'while', 'for', 'switch', 'return', 'typeof', 'await'].includes(name)) {
        return name;
      }
      // a grouping paren `(v.deposit_paid_php as number)` — keep looking outward
    }
  }
  return null;
}

test('every <row>.deposit_paid_php is an argument of the shared rule', () => {
  let reads = 0;
  for (const [f, raw] of SOURCES) {
    const src = blankStrings(raw);
    const exempt = EXEMPT_READS[f] ?? [];
    const seen = new Map<string, number>();
    for (const m of src.matchAll(/\.\s*deposit_paid_php\b/g)) {
      reads++;
      const callee = enclosingCall(src, m.index!);
      console.log(`  ${f}: .deposit_paid_php inside ${callee ?? '(no call)'}(…)`);
      if (callee && RULE_CALLS.has(callee)) continue;
      const allowed = exempt.find((e) => e.callee === '*' || e.callee === callee);
      assert.ok(
        allowed,
        `${f} reads .deposit_paid_php inside ${callee ?? 'no call'}(…). That column is NULL on every ` +
          'couple-recorded deposit — pass it to paidToVendorPhp / recordedDepositPhp ' +
          '(lib/paid-to-vendor.ts) or bookingMoneyMoved (lib/booking-money-moved.ts) instead.',
      );
      const key = allowed.callee;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    for (const e of exempt) {
      assert.equal(seen.get(e.callee) ?? 0, e.count, `${f}: exempt read "${e.callee}" count changed — ${e.why}`);
    }
  }
  console.log(`property reads checked: ${reads}`);
  // FLOOR — the reads this change routes through the rule. Fewer means the scan stopped seeing them.
  assert.ok(reads >= 8, `only ${reads} property reads found — the scan is broken`);
});
