/**
 * WHAT THE PAYMENT PAGE PRINTS IS WHAT THE QR CARRIES — and it is printed from
 * ONE place.
 *
 * The page's promise is in its own words: *"the amount is already in it."* So
 * the figure a person reads and the figure their wallet is about to fill in
 * have to be the same digits. They are produced by two different functions in
 * two different files — `payAmount` for the screen, `mintOrderQr` for the code
 * — and nothing tied them together until this suite.
 *
 * 🔑 WHY IT IS WORTH A TEST AT ALL. On 2026-08-28 the same amount was rendered
 * twice on one screen from two private copies of one formatting rule; an
 * encoding accident destroyed the peso sign in one file and not the other, so
 * the page printed junk at the top and a correct `₱` beside the QR. A rule
 * written twice is a rule that can disagree with itself. There is one copy now,
 * and this suite pins BOTH halves: that the copy is shared, and that its output
 * matches the QR byte for byte.
 *
 * ⚠ The assertions below compare COMPUTED VALUES, not source strings, wherever
 * they can — a source grep passes while the thing it names does nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { payAmount } from '../../lib/pay-amount';
import { mintOrderQr, parseTlv } from '../../lib/emv-qr';

/** The real decoded GCash receiving QR, same fixture as `lib/emv-qr.test.ts`. */
const GCASH =
  '00020101021127830012com.p2pqrpay0111GXCHPHM2XXX02089996440303152170200000006560417DWQM4TK3JDNWIWRDY5204601653036085802PH5908Setnayan6011Holy Spirit6104123463045E2D';

const HERE = join(process.cwd(), 'app', 'pay', '[reference]');
const read = (...p: string[]) => readFileSync(join(HERE, ...p), 'utf8');

/** EMV tag 54 — the transaction amount the wallet pre-fills. */
function amountInQr(php: number): string {
  const minted = mintOrderQr(GCASH, php);
  assert.ok(minted, `mintOrderQr refused ${php}`);
  const tag = parseTlv(minted).find((f) => f.id === '54');
  assert.ok(tag, 'minted QR carries no amount tag');
  return tag.value;
}

/** The digits a person reads, with the peso sign and grouping taken off. */
function digitsOnScreen(php: number): string {
  return payAmount(php).replace('₱', '').replace(/,/g, '');
}

test('the amount on screen is the amount in the QR, digit for digit', () => {
  for (const php of [49, 50, 499, 1499, 2499, 3500, 10000, 1, 999999]) {
    assert.equal(
      digitsOnScreen(php),
      amountInQr(php),
      `screen and QR disagree at ${php}`,
    );
  }
});

test('a figure carrying centavos still agrees — two decimals on both sides', () => {
  // NOT reachable from the database today (`amount_php` is NUMERIC(12,2) and
  // both branches of orderGrossOwed round to 2dp), which is exactly why it is
  // worth pinning: the day something upstream stops rounding, the screen and
  // the code must not start disagreeing quietly.
  // 49.567 is the case that separates a 2-decimal cap from Intl's default
  // 3: the QR carries 49.57 and an uncapped screen prints 49.567. Without
  // it this whole assertion passes with the cap removed — measured.
  for (const php of [49.5, 49.05, 2500.99, 0.5, 49.567, 1.005, 99.999]) {
    assert.equal(
      digitsOnScreen(php),
      amountInQr(php),
      `screen and QR disagree at ${php}`,
    );
  }
});

test('the amount always carries exactly two decimals', () => {
  // The whole-peso case is the one that regresses: every other formatter in
  // this app drops the decimals, and adopting one of them here would print
  // "₱49" against a QR carrying "49.00".
  assert.equal(payAmount(49), '₱49.00');
  assert.equal(payAmount(2499), '₱2,499.00');
  assert.equal(payAmount(49.5), '₱49.50');
  for (const php of [49, 1000, 49.5, 0.05]) {
    assert.match(payAmount(php), /\.\d{2}$/, `${php} lost its centavos`);
  }
});

test('the peso sign is the real one, on the page and in the helper', () => {
  // U+20B1. Spelled by codepoint so this assertion cannot itself be destroyed
  // by the encoding accident it exists to notice.
  const PESO = String.fromCodePoint(0x20b1);
  assert.ok(payAmount(49).startsWith(PESO));
  assert.equal(payAmount(49).codePointAt(0), 0x20b1);
});

/** How many places each file shows the figure today. Raise, never lower. */
const FLOOR: Record<string, number> = { 'page.tsx': 1, 'pay-panel.tsx': 4 };

test('neither file keeps a private copy of the rule', () => {
  const page = read('page.tsx');
  const panel = read('_components', 'pay-panel.tsx');
  for (const [name, src] of [
    ['page.tsx', page],
    ['pay-panel.tsx', panel],
  ] as const) {
    assert.doesNotMatch(
      src,
      /function\s+peso\s*\(/,
      `${name} has grown its own money formatter again`,
    );
    assert.doesNotMatch(
      src,
      /toLocaleString\(\s*'en-PH'/,
      `${name} formats an amount inline instead of using payAmount`,
    );
    assert.match(
      src,
      /import \{ payAmount \} from '@\/lib\/pay-amount'/,
      `${name} does not import the shared amount`,
    );
    // ⚠ A FILE-LEVEL MATCH CANNOT SEE ONE CALL SITE GO. The panel shows the
    // amount in four places; `match(/payAmount\(/)` still passed with one of
    // them replaced by the raw number — measured, 4 -> 3, and green. Floored
    // per file instead: a fifth display is welcome and must raise the floor,
    // but losing one of today's is a regression.
    const calls = (src.match(/payAmount\(/g) ?? []).length;
    assert.ok(
      calls >= FLOOR[name],
      `${name} renders the amount through payAmount ${calls}x, below its floor of ${FLOOR[name]}`,
    );
    /**
     * ⛔ A "the raw number is not printed" CHECK WAS TRIED HERE AND DELETED.
     * No regex separates a rendered figure from `value={amountPhp}` on the
     * hidden input, which must stay raw, or from `amountPhp={amountPhp}` as a
     * prop. It fired on the untouched file twice. The floor above is measured
     * to catch the regression it was reaching for (4 -> 3 call sites goes red),
     * and a guard that cries wolf teaches you to skim past the one time it is
     * right.
     */
  }
});
