/**
 * no-invented-tax.test.ts — no screen may name a tax the platform does not charge.
 *
 * 🔒 OWNER RULING, 2026-08-20: *"just stay with 499. remove the 12% let's keep it
 * simple and effective for everybody."* Setnayan is **not VAT-registered** (sole
 * proprietorship, 8% flat; VAT only at the ₱3M tripwire) and the configured rate
 * is **0**. ₱499 is ₱499.
 *
 * 🚨 WHAT THIS CAUGHT — FOUR SURFACES, FOUND ONE AT A TIME OVER TWO DAYS.
 *   1. The RECEIPT recorded a 12% rate it was never charged at (fixed #4614).
 *   2. The ADMIN QUOTE screen printed `total * 1.12` — "₱499 · buyer pays ₱559
 *      incl. 12% VAT" — and labelled its input "Buyer pays base × 1.12".
 *   3. The CUSTOMER CHECKOUT drawer printed a fixed "incl. 12% VAT" under a
 *      price that was already correct.
 *   4. The SUPPLIES cart promised "Final price + 12% VAT are confirmed…".
 *
 * 🔑 THE PATTERN, AND WHY THE GUARD IS A SWEEP RATHER THAN FOUR ASSERTIONS.
 * In every single case **the arithmetic was already right and the WORDS were
 * wrong.** The rate had been correctly moved into settings long ago; what was
 * left behind was a hardcoded sentence next to a correct number. Fixing the
 * calculator does not fix the label, and each of these was found only by a
 * person happening to open that screen. The next one will be too — unless this
 * fails first.
 *
 * ⚖ DERIVED, NOT DELETED. Every surface now takes the rate from settings and
 * says nothing when it is 0. The day the ₱3M threshold is crossed the owner
 * sets one number and every line returns by itself, with the right figure — so
 * this guard bans the literal, never the concept.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

/** Comments are stripped: every file fixed here explains the string it removed. */
function strip(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (
      (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
      !entry.includes('.test.')
    ) {
      out.push(full);
    }
  }
  return out;
}

/**
 * The literal ways a 12% tax gets asserted at a person.
 *
 * ⚠ `1.12` on its own is NOT here, and deliberately so: it is a common CSS
 * line-height and a 3D coordinate in this repo, and a guard that flags those
 * cries wolf until nobody reads it. Only the money-shaped forms are banned.
 */
const BANNED: { pattern: RegExp; why: string }[] = [
  { pattern: /\b12%\s*VAT/i, why: 'names a 12% VAT the platform does not charge' },
  { pattern: /\*\s*1\.12\b/, why: 'multiplies money by a hardcoded 1.12' },
  { pattern: /×\s*1\.12\b/, why: 'tells a person the buyer pays base × 1.12' },
  { pattern: /&times;\s*1\.12\b/, why: 'tells a person the buyer pays base × 1.12' },
];

/** Where money is shown to a customer or to an operator quoting one. */
const MONEY_SURFACES = [
  'app/admin/payments',
  'app/admin/receipts',
  'app/receipts',
  'app/dashboard',
  'app/checkout',
  'lib/orders.ts',
];

test('no money screen names or applies a tax the platform does not charge', () => {
  const offenders: string[] = [];
  let scanned = 0;

  for (const surface of MONEY_SURFACES) {
    const full = join(WEB, surface);
    let files: string[];
    try {
      files = statSync(full).isDirectory() ? walk(full) : [full];
    } catch {
      continue; // surface moved; the coverage assert below catches a gutted list
    }
    for (const file of files) {
      scanned++;
      const code = strip(readFileSync(file, 'utf8'));
      for (const { pattern, why } of BANNED) {
        if (pattern.test(code)) {
          offenders.push(`${relative(WEB, file)} — ${why}`);
        }
      }
    }
  }

  assert.ok(
    scanned > 50,
    `Only ${scanned} files scanned — the money surfaces moved and this guard is ` +
      'looking at almost nothing.',
  );

  assert.deepEqual(
    offenders,
    [],
    'A screen states or applies a 12% VAT. Setnayan is not VAT-registered and ' +
      'the configured rate is 0 — ₱499 is ₱499 (owner, 2026-08-20). Take the ' +
      'rate from settings and say nothing when it is zero, so the line returns ' +
      'by itself if a rate is ever set.\n' +
      offenders.join('\n'),
  );
});

test('the surfaces that CAN show a rate take it from settings', () => {
  // Each of these renders a VAT line only when the configured rate is above 0.
  // If one stops reading the rate, it has either dropped the feature or gone
  // back to hardcoding — both are regressions.
  for (const rel of [
    'app/admin/payments/page.tsx',
    'app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx',
  ]) {
    const code = strip(readFileSync(join(WEB, rel), 'utf8'));
    assert.match(
      code,
      /vatRatePct/,
      `${rel} no longer reads the configured rate, so it cannot show VAT ` +
        'correctly if one is ever set — and is one edit away from hardcoding it again.',
    );
  }
});
