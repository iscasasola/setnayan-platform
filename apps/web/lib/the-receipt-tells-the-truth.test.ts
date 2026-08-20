/**
 * the-receipt-tells-the-truth.test.ts — a receipt may never declare a tax that
 * was not charged.
 *
 * 🚨 WHAT WENT WRONG, TWO WAYS, ON THE SAME DOCUMENT. Setnayan is NOT
 * VAT-registered (sole proprietorship, 8% flat; VAT only at the ₱3M tripwire),
 * and the configured rate is 0.
 *
 *   (a) The receipt writer never passed `vat_rate_pct`, so the column fell to
 *       its DEFAULT of 12.00 — on a customer receipt whose VAT amount was
 *       correctly ₱0.00. The printed document read "VAT @ 12%   ₱0.00": it
 *       contradicted itself in front of the buyer.
 *   (b) The vendor branch called `computeVatFromGross` with no rate, and that
 *       argument defaulted to 12 — so a ₱999 receipt actually stated ~₱107 of
 *       VAT, a tax this business is not registered to collect, on a document
 *       the vendor hands to their own accountant.
 *
 * 🔑 NOTHING WOULD HAVE COMPLAINED. The table's CHECK constraint only asserts
 * `pre_vat + vat ≈ gross`; it never cross-checks the RATE against the amount.
 * The row inserts cleanly and is wrong — ACCEPTED, not rejected. That is the
 * quieter cousin of this codebase's phantom column / enum / RPC-argument
 * family: there the query is refused, here it succeeds and lies.
 *
 * 🔑 AND THE FIRST HALF OF THIS WAS ALREADY FIXED ONCE. `computeVatFromBase`
 * was made rate-required months ago, with a comment explaining why. Its mirror
 * `computeVatFromGross` kept its 12% default, and the receipt writer kept
 * omitting the column. **Fixing one function is not fixing the rule** — which
 * is why this guard is written against the WRITER and the RENDERER, not against
 * one helper.
 *
 * ⚖ Driven by the rate STORED ON THE ROW, never by a constant. The day the ₱3M
 * threshold is crossed the owner sets the rate in settings, new receipts carry
 * it, and the VAT line appears by itself — while old receipts keep printing
 * whatever they were actually issued at, which is what a receipt is for.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeVatFromBase, computeVatFromGross } from './receipts';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

const WRITER = 'app/admin/payments/actions.ts';
const RENDERER = 'app/receipts/[receiptId]/page.tsx';

function strip(rel: string): string {
  return readFileSync(join(WEB, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** The `.insert({ … })` object literal on the receipts write. */
function receiptInsert(): string {
  const code = strip(WRITER);
  const at = code.indexOf(".from('receipts').insert(");
  assert.ok(at > -1, `${WRITER} no longer inserts a receipt — this guard is looking at nothing.`);
  let depth = 0;
  const start = code.indexOf('{', at);
  let i = start;
  for (; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return code.slice(start, i + 1);
}

test('the receipt records the rate it was actually charged at', () => {
  const insert = receiptInsert();
  assert.match(
    insert,
    /\bvat_rate_pct\s*:/,
    'The receipt insert does not set vat_rate_pct, so the column falls to its ' +
      'DEFAULT of 12.00 — printing "VAT @ 12%" beside a ₱0.00 VAT amount on a ' +
      'document handed to a customer. The constraint does not catch it: it only ' +
      'checks that the AMOUNTS add up, never that the rate matches them.',
  );
  assert.ok(
    !/\bvat_rate_pct\s*:\s*\d/.test(insert),
    'The receipt insert hardcodes a numeric rate. It must come from the ' +
      "platform's configured rate, so the day the ₱3M threshold is crossed the " +
      'owner sets one number and nothing in the code changes.',
  );
});

test('neither VAT helper is called without a rate on the money path', () => {
  const code = strip(WRITER);
  for (const fn of ['computeVatFromGross', 'computeVatFromBase']) {
    for (const m of code.matchAll(new RegExp(`${fn}\\s*\\(([^)]*)\\)`, 'g'))) {
      const args = (m[1] ?? '').split(',');
      assert.ok(
        args.length >= 2 && (args[1] ?? '').trim().length > 0,
        `${WRITER} calls ${fn} with no rate. That is how a ₱999 vendor receipt ` +
          `declared ~₱107 of VAT this business is not registered to collect. ` +
          `Call: ${m[0]}`,
      );
    }
  }
});

test('neither VAT helper carries a default rate — the trap cannot be re-armed', () => {
  // 🪤 THIS ASSERTION EXISTS BECAUSE A MUTATION EXPOSED THE GUARD, NOT THE CODE.
  // Restoring `vatRatePct: number = DEFAULT_VAT_RATE_PCT` on the gross back-out
  // left every test GREEN — correctly, because the one money path passes a rate
  // explicitly, so the default is unreachable from there. But an unreachable
  // default is exactly what this bug was for months before a second call site
  // found it. The property being defended is "there is no implicit tax
  // ANYWHERE", and that is a property of the SIGNATURE, not of today's callers.
  const src = readFileSync(join(WEB, 'lib/receipts.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  for (const fn of ['computeVatFromBase', 'computeVatFromGross']) {
    const at = src.indexOf(`export function ${fn}(`);
    assert.ok(at > -1, `${fn} is gone — this guard is looking at nothing.`);
    const sig = src.slice(at, src.indexOf('{', src.indexOf(')', at)));
    assert.ok(
      !/vatRatePct\s*:\s*number\s*=/.test(sig),
      `${fn} gives its rate a default again. A defaulted rate is how a hardcoded ` +
        `12% outlived a configured 0% in this file twice. Signature: ${sig.trim()}`,
    );
  }
});

test('a rate of zero means no VAT was assessed, at any price', () => {
  // The configured rate today. An all-in price is entirely sales.
  assert.deepEqual(computeVatFromGross(999, 0), { preVat: 999, vat: 0, gross: 999, rate: 0 });
  assert.deepEqual(computeVatFromBase(499, 0), { preVat: 499, vat: 0, gross: 499, rate: 0 });
  // And the buyer is never charged more than the quoted all-in figure.
  assert.equal(computeVatFromGross(999, 12).gross, 999);
});

test('the printed receipt shows no VAT line when no VAT was charged', () => {
  const code = strip(RENDERER);
  assert.match(
    code,
    /vatWasCharged/,
    `${RENDERER} prints its VAT line unconditionally again. "VAT @ 0%  ₱0.00" ` +
      'is not a harmless zero — it tells the reader a tax was assessed, on a ' +
      'document from a seller who is not registered to assess one.',
  );
  // It must be decided by the ROW, not by a constant or a build-time flag.
  assert.match(
    code,
    /vatWasCharged\s*=\s*Number\(receipt\.vat_rate_pct\)/,
    'Whether to print the VAT line must be read from the receipt row itself, so ' +
      'an old receipt keeps printing what it was issued at.',
  );
});
