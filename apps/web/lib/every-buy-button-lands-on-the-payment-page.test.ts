/**
 * EVERY PAID PURCHASE ENDS ON THE ONE PAYMENT PAGE — AND NO FREE ONE DOES.
 *
 * Owner, 2026-08-21: *"this can apply to all purchasable buttons."*
 *
 * Two invariants, and the second is the one that would embarrass us:
 *
 *  1. A path that takes money redirects to `/pay/<reference>` — the only screen
 *     that carries the amount inside the QR and can take a screenshot and a
 *     reference number. The panels these replaced quoted a code and left the
 *     buyer to work the rest out.
 *
 *  2. 🔒 A ₱0 GRANT MUST NEVER LAND THERE. `compOrderRowFor` stamps
 *     `status: 'paid'`, which `statusOf` reads as SETTLED — so a shop that just
 *     switched a feature on for FREE would be greeted with *"This one is
 *     settled — there's nothing left to send."* Every one of these files has a
 *     free branch, and every one must return before the redirect.
 *
 * Both are structural checks over source, deliberately paired with the shape of
 * the real regression: a later edit that moves a `return` or adds a redirect
 * inside the free arm.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** Paid purchase paths that must end on the payment page. */
const PAID_PATHS = [
  'app/vendor-dashboard/subscription/actions.ts', // the plan itself
  'app/vendor-dashboard/team/actions.ts', // extra seat
  'app/vendor-dashboard/branches/actions.ts', // additional branch (buy + renew)
  'app/vendor-dashboard/subscription/ai-addon-actions.ts', // Vendor AI
  'app/vendor-dashboard/subscription/booth-addon-actions.ts', // 3D Booth
  'app/vendor-dashboard/deep-search/actions.ts', // one Deep Search
  'app/vendor-dashboard/subscription/custom/actions.ts', // negotiated plan
  // ⬇ ADDED 2026-08-23. A vendor sponsoring Papic Challenges for a client's
  // event pays ₱400 (free only for their first 5 bookings). It was NOT in this
  // list, so it kept the exact panel every other button here shed: the amount
  // and the reference, and "pay to our BDO or GCash account" — naming NEITHER
  // account, with no QR carrying the amount and nowhere to send a screenshot.
  'app/vendor-dashboard/subscription/photo-challenge-actions.ts',
] as const;

/**
 * 🔑 THE LIST ABOVE IS HAND-WRITTEN, AND THAT IS EXACTLY HOW ONE WAS MISSED.
 *
 * A hand-enumerated guard list is a list of the doors somebody thought of. The
 * Papic Challenges purchase minted an order through the same shared helper as
 * the other seven, went to no payment page, and this file passed — because it
 * was never named here.
 *
 * So the completeness question is now asked of the CODE instead: every file
 * that calls the paid mint `orderRowFor(` must either land on the payment page
 * or appear below WITH A REASON. Adding a row here is a decision that somebody
 * pays without the one screen that can take their money, so it costs a
 * sentence.
 */
const DELIBERATELY_NOT_REDIRECTED: Record<string, string> = {
  'app/dashboard/[eventId]/checkout/actions.ts':
    "the couple's inline checkout drawer. It already mints an amount-carrying " +
    'QR inline and takes the screenshot in the same step, and it alerts the ' +
    'team through notifyAdminsOrderAwaitingReconciliation. Moving it means ' +
    'inverting pay-then-mint into mint-then-pay, which leaves an unpaid order ' +
    'in the admin queue on every abandoned checkout.',
};

/** Every file under app/ that mints a PAID order. Derived, never typed out. */
function paidMinters(): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    for (const e of readdirSync(join(WEB, rel), { withFileTypes: true })) {
      const child = rel + '/' + e.name;
      if (e.isDirectory()) walk(child);
      else if (e.name.endsWith('.ts') && !e.name.includes('.test.')) {
        if (readFileSync(join(WEB, child), 'utf8').includes('orderRowFor(')) out.push(child);
      }
    }
  };
  walk('app');
  return out.sort();
}

test('the set of paid buy paths is DERIVED from the mint, not trusted from a list', () => {
  const minters = paidMinters();
  // A guard that finds nothing passes silently — the failure mode this whole
  // file exists to prevent. Floor it against the eight we know are real.
  assert.ok(minters.length >= 8, `expected to find the paid minters, saw ${minters.length}`);

  const uncovered = minters.filter(
    (rel) => !PAID_PATHS.includes(rel as (typeof PAID_PATHS)[number]) && !DELIBERATELY_NOT_REDIRECTED[rel],
  );
  assert.deepEqual(
    uncovered,
    [],
    'these mint a paid order and are neither sent to the payment page nor excused with a reason',
  );

  // And the excuse list may not outlive its subject: a file that stopped
  // minting must lose its row, or the next reader inherits a stale exemption.
  const stale = Object.keys(DELIBERATELY_NOT_REDIRECTED).filter((rel) => !minters.includes(rel));
  assert.deepEqual(stale, [], 'these are excused from a rule they are no longer subject to');
});

test('every shop purchase ends on the payment page', () => {
  const missing = PAID_PATHS.filter((rel) => {
    const src = read(rel);
    // The plan path builds its own URL because the order mint is fail-soft and
    // it must be able to fall back; everything else uses the shared helper.
    return !/redirect\(payPath\(/.test(src) && !/'\/pay\/'/.test(src);
  });
  assert.deepEqual(missing, [], 'these take money and never send the buyer anywhere to pay it');
});

test('a free grant is never sent to a payment page', () => {
  for (const rel of PAID_PATHS) {
    const src = read(rel);
    const compAt = src.lastIndexOf('compOrderRowFor(');
    if (compAt === -1) continue; // no free branch in this path
    const payAt = src.indexOf('redirect(payPath(');
    assert.ok(payAt > compAt, `${rel}: the paid redirect must come AFTER the free branch`);
    const between = src.slice(compAt, payAt);
    assert.match(
      between,
      /\n\s*return \{/,
      `${rel}: the free branch must RETURN before the paid redirect — a ₱0 order lands on ` +
        '"this one is settled", which is what a shop sees after being given something free',
    );
  }
});

test('the shared helper is what builds the address', () => {
  // One place to encode a reference, so a later route change is one edit and
  // not a hunt through a dozen call sites.
  const helper = read('lib/pay-path.ts');
  assert.match(helper, /encodeURIComponent/);
  const users = PAID_PATHS.filter((rel) => /payPath\(/.test(read(rel)));
  assert.ok(users.length >= 6, `expected the helper to be used widely, saw ${users.length}`);
});

test('the dead panels those redirects replaced are gone, not left behind', () => {
  // A panel nothing can reach is a screen that still reads as current to the
  // next person editing it, and the strings drift out of true unnoticed.
  assert.doesNotMatch(read('app/vendor-dashboard/team/page.tsx'), /search\.bought/);
});

test('the couple and the guest reach it too — the last three doors', () => {
  // Owner 2026-08-21, in his own words: "guest needs to have an account to buy",
  // "couple can purchase with the custom qr", and yes to the booking fee.
  const guest = read('app/papic/buy/actions.ts');
  assert.match(guest, /redirect\(payPath\(referenceCode\)\)/, 'the guest buy must land on /pay');
  assert.match(
    guest,
    /if \(!accountId\) backTo\(returnTo, 'needs_account'\)/,
    'buying needs an account — without one the buyer 404s on their own order',
  );

  const bill = read('app/dashboard/[eventId]/orders/[orderId]/page.tsx');
  assert.match(bill, /payPath\(order\.reference_code\)/, 'the couple’s bill must lead to /pay');
  // The amount-less static QRs and the type-it-yourself form are gone, not
  // hidden — two payment surfaces for one order is how the numbers drift.
  // The form itself AND the sentence that pointed at it — a banner telling a
  // couple to use a form that no longer exists is worse than no banner.
  assert.doesNotMatch(bill, /action=\{logPayment\}|name="amount_php"/);
  assert.doesNotMatch(bill, /&ldquo;Log a payment&rdquo; form below/);

  const fee = read('app/vendor-dashboard/booking-fees/[orderId]/page.tsx');
  assert.match(fee, /payPath\(order\.reference_code\)/, 'the booking fee must lead to /pay');
});

test('settling an order that already exists is untouched', () => {
  // A rule about NEW purchases must never strand a debt somebody already owes —
  // the same boundary the 2026-08-21 finished-event ruling drew. The token page
  // is the only door onto orders minted before an account was required.
  const guest = read('app/papic/buy/actions.ts');
  assert.match(guest, /submitPapicGuestPayment/, 'the settle path must still exist');
  assert.match(
    guest,
    /\/papic\/order\/\$\{encodeURIComponent\(token\)\}/,
    'the token page must still receive the settle redirects',
  );
});
