import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  vendorPaysSetnayan,
  VENDOR_PAYS_SETNAYAN_SKUS,
  VENDOR_PAYS_SETNAYAN_PREFIXES,
} from './vendor-pays-setnayan';

/**
 * The property: Setnayan never schedules a payout for an order a supplier paid
 * US for.
 *
 * Measured 2026-09-18 — `vendor_3d_booth_event` (₱500) and
 * `vendor_papic_portfolio_pack` (₱500) both carry a real `event_id`, so M1's
 * `!row.event_id || isBranchOrder` missed both and approval scheduled roughly
 * ₱447.50 back to the paying supplier.
 */

/* ── THE DECISION, EXECUTED ──────────────────────────────────────────────── */

test('the two per-event supplier purchases are refused a payout', () => {
  // The exact SKUs that produced the defect. These are the regression.
  for (const k of ['vendor_3d_booth_event', 'vendor_papic_portfolio_pack']) {
    assert.equal(vendorPaysSetnayan(k), true, `${k} would still be paid out`);
  }
});

test('every fixed supplier SKU and every prefixed one is refused', () => {
  for (const k of VENDOR_PAYS_SETNAYAN_SKUS) {
    assert.equal(vendorPaysSetnayan(k), true, k);
  }
  for (const p of VENDOR_PAYS_SETNAYAN_PREFIXES) {
    assert.equal(vendorPaysSetnayan(`${p}abc123`), true, p);
    // The bare prefix without an id is still ours.
    assert.equal(vendorPaysSetnayan(p), true, p);
  }
});

test('an unknown or missing key answers FALSE — never refuse a real payout', () => {
  // ⚖ THE DIRECTION THAT MATTERS. Answering true on anything unrecognised
  // would silently stop paying real suppliers for real bookings, which is a
  // worse failure than the one this fixes: it is invisible and it is somebody
  // else's money.
  for (const k of [null, undefined, '', '   ', 'photography', 'setnayan_service__x']) {
    assert.equal(vendorPaysSetnayan(k as string | null), false, String(k));
  }
});

test('a couple booking for a supplier service still gets its payout', () => {
  // The floor. A marketplace SKU may be named anything — `service_key` on a
  // couple booking arrives from a FORM FIELD — so this must never be a
  // startsWith('vendor_') rule.
  for (const k of ['vendor', 'vendors', 'vendor_photography', 'vendor_catering_deluxe']) {
    assert.equal(
      vendorPaysSetnayan(k),
      false,
      `"${k}" is not a declared supplier purchase and must keep its payout`,
    );
  }
});

/* ── THE LIST MAINTAINS ITSELF ───────────────────────────────────────────── */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

function sources(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, acc);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) acc.push(full);
  }
  return acc;
}

test('a new supplier SKU cannot be added without classifying its direction', () => {
  // 🔑 THIS IS THE TEST THAT MATTERS. The defect was not a wrong list — it was
  // a list that nobody had to update. Every `VENDOR_*_SKU_CODE` constant and
  // every `vendor_*__` service-key prefix in the tree must appear here, so
  // adding the next supplier purchase goes RED until somebody says which way
  // the money moves.
  const declared = new Set<string>([
    ...VENDOR_PAYS_SETNAYAN_SKUS,
    ...VENDOR_PAYS_SETNAYAN_PREFIXES,
  ]);
  const missing: string[] = [];
  const found: string[] = [];
  for (const file of sources(join(WEB, 'lib'))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(
      /export const VENDOR_[A-Z0-9_]*SKU_CODE\s*=\s*'([^']+)'/g,
    )) {
      found.push(m[1]!);
      if (!declared.has(m[1]!)) missing.push(`${relative(WEB, file)} — '${m[1]}'`);
    }
    for (const m of src.matchAll(
      /export const [A-Z0-9_]*SERVICE_(?:KEY_)?PREFIX\s*=\s*'(vendor_[^']+)'/g,
    )) {
      found.push(m[1]!);
      if (!declared.has(m[1]!)) missing.push(`${relative(WEB, file)} — '${m[1]}'`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    'These supplier SKUs are not classified in lib/vendor-pays-setnayan.ts. If ' +
      'the supplier PAYS for it, add it — otherwise approving that payment may ' +
      'schedule money back to them. If a couple pays for it, say so in a ' +
      'comment there:\n  ' + missing.join('\n  '),
  );
  // A sweep that finds nothing passes forever.
  assert.ok(
    found.length >= 12,
    `only ${found.length} supplier SKU/prefix constants found — this scan has ` +
      'gone blind (renamed constants, or the export shape changed). Fix the ' +
      'scan, do not delete it.',
  );
});

test('the payout scheduler actually consults it', () => {
  const src = readFileSync(join(WEB, 'app/admin/payments/actions.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n');
  assert.match(
    src,
    /if \(vendorPaysSetnayan\(row\.service_key\)[^)]*\|\|[^)]*!row\.event_id/,
    'the payout scheduler stopped asking which way the money moves, or dropped ' +
      'the older !event_id check that still covers unclassified SKUs',
  );
});
