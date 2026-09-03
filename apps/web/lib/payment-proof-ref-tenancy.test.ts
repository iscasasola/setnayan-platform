/**
 * 🔴 A payment-proof screenshot ref could point at ANY object in ANY bucket —
 * and an ADMIN was the one who rendered it.
 *
 * `screenshot_url` is written from a `screenshot_ref` FORM FIELD on three paths
 * (couple checkout, couple order, vendor booking fee). All three validated it
 * with nothing but:
 *
 *     screenshotRefRaw.trim().startsWith('r2://')
 *
 * `lib/r2-client-ref.ts` documents `displayUrlForStoredAsset` as signing "any
 * r2:// ref for any of the five buckets with no tenancy check whatsoever" — and
 * its own header names *"another couple's payment screenshot"* as the example
 * oracle. So a buyer could submit
 *   r2://setnayan-vendor-verification/vendors/{anyone}/verification/dti.pdf
 * as their proof, and the /admin/payments reconciliation screen would presign
 * and render it. The output device is an admin's browser, which makes this worse
 * than the vendor-portfolio lane: nothing about the surface looks untrusted.
 *
 * Fixed by binding each ref to the private thread-files bucket under a prefix
 * the caller provably owns — the order id (both order paths, which load the row
 * `.eq('user_id', user.id)` first) or the event + buyer's own user id (checkout,
 * where the order row does not exist yet).
 *
 * The policies are pure, so they are exercised directly; the wiring is checked
 * by source-scan, because deleting the `parseClientRef` call at a call site
 * would otherwise leave every policy test green (the lesson from #3905).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  parseClientRef,
  orderPaymentProofPolicy,
  inlineCheckoutProofPolicy,
} from './r2-client-ref';

const ORDER = 'ord-1111';
const OTHER_ORDER = 'ord-2222';
const EVENT = 'evt-aaaa';
const USER = 'usr-bbbb';
const PRIVATE = 'setnayan-thread-files';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const read = (p: string) => readFileSync(join(appDir, p), 'utf8');

/**
 * Every lane that accepts a payment screenshot.
 *
 * ⚖ `vendor-dashboard/booking-fees/actions.ts` LEFT THIS LIST ON 2026-09-03 —
 * replaced, not dropped, by `pay/[reference]/actions.ts`. That action
 * (`logBookingFeePayment`) was deleted as superseded: the owner moved sending
 * the money to the one payment page on 2026-08-21, and it had had zero callers
 * ever since. So the lane this guard was watching had ALREADY stopped being a
 * lane, and the vendor's real proof upload — which is the one an attacker would
 * aim at — was never in the list at all.
 *
 * 🔑 THE LIST GREW BY LOSING AN ENTRY. Coverage went from two live lanes plus
 * one dead one to three live ones. If you remove a lane here, check it is dead
 * rather than merely renamed, and put its successor in the same commit.
 */
const CALL_SITES = [
  'dashboard/[eventId]/checkout/actions.ts',
  'dashboard/[eventId]/orders/actions.ts',
  'pay/[reference]/actions.ts',
] as const;

/* ── the order-keyed policy ─────────────────────────────────────────────── */

test('accepts a proof under this order’s own prefix', () => {
  const ok = parseClientRef(
    `r2://${PRIVATE}/payments/${ORDER}/proof.png`,
    orderPaymentProofPolicy(ORDER),
  );
  assert.ok(ok, 'the legitimate ref the uploader actually writes must pass');
  assert.equal(ok.bucket, PRIVATE);
});

test('REFUSES another order’s proof', () => {
  assert.equal(
    parseClientRef(
      `r2://${PRIVATE}/payments/${OTHER_ORDER}/proof.png`,
      orderPaymentProofPolicy(ORDER),
    ),
    null,
  );
});

test('REFUSES a vendor-verification document — the original oracle', () => {
  assert.equal(
    parseClientRef(
      'r2://setnayan-vendor-verification/vendors/someone-else/verification/dti.pdf',
      orderPaymentProofPolicy(ORDER),
    ),
    null,
  );
});

test('REFUSES a signed contract in the contracts bucket', () => {
  assert.equal(
    parseClientRef(
      `r2://setnayan-vendor-contracts/paperwork/${EVENT}/contract.pdf`,
      orderPaymentProofPolicy(ORDER),
    ),
    null,
  );
});

test('REFUSES the public media bucket even under a matching prefix', () => {
  assert.equal(
    parseClientRef(
      `r2://setnayan-media/payments/${ORDER}/proof.png`,
      orderPaymentProofPolicy(ORDER),
    ),
    null,
    'the policy names a private bucket; media must not satisfy it',
  );
});

test('REFUSES a sibling-prefix confusion (payments/ord-1111-evil)', () => {
  assert.equal(
    parseClientRef(
      `r2://${PRIVATE}/payments/${ORDER}-evil/proof.png`,
      orderPaymentProofPolicy(ORDER),
    ),
    null,
    'the trailing slash in the policy prefix is what stops this',
  );
});

test('REFUSES traversal out of the order prefix', () => {
  assert.equal(
    parseClientRef(
      `r2://${PRIVATE}/payments/${ORDER}/../${OTHER_ORDER}/proof.png`,
      orderPaymentProofPolicy(ORDER),
    ),
    null,
  );
});

test('REFUSES a legacy https:// URL — closes the SSRF shape too', () => {
  assert.equal(
    parseClientRef('http://169.254.169.254/latest/meta-data/', orderPaymentProofPolicy(ORDER)),
    null,
  );
});

/* ── the pre-order checkout policy ──────────────────────────────────────── */

test('checkout accepts the drawer’s event-keyed prefix', () => {
  assert.ok(
    parseClientRef(
      `r2://${PRIVATE}/payment-screenshots/inline-checkout/${EVENT}/p.png`,
      inlineCheckoutProofPolicy(EVENT, USER),
    ),
  );
});

test('checkout accepts the buyer’s own user-keyed prefix', () => {
  assert.ok(
    parseClientRef(
      `r2://${PRIVATE}/payment-screenshots/inline-checkout/${USER}/p.png`,
      inlineCheckoutProofPolicy(EVENT, USER),
    ),
  );
});

test('checkout REFUSES another event’s / another buyer’s prefix', () => {
  for (const foreign of ['evt-zzzz', 'usr-zzzz']) {
    assert.equal(
      parseClientRef(
        `r2://${PRIVATE}/payment-screenshots/inline-checkout/${foreign}/p.png`,
        inlineCheckoutProofPolicy(EVENT, USER),
      ),
      null,
      `${foreign} must not pass`,
    );
  }
});

test('the eventless AI-sub case emits no degenerate prefix', () => {
  const policy = inlineCheckoutProofPolicy(null, USER);
  assert.equal(policy.prefixes.length, 1, 'only the user-keyed prefix survives');
  assert.ok(
    !policy.prefixes.some((p) => p.includes('null') || p.includes('//')),
    'a null must never be interpolated into a prefix',
  );
  // …and it still gates.
  assert.ok(
    parseClientRef(
      `r2://${PRIVATE}/payment-screenshots/inline-checkout/${USER}/p.png`,
      policy,
    ),
  );
  assert.equal(
    parseClientRef(
      `r2://${PRIVATE}/payment-screenshots/inline-checkout/usr-zzzz/p.png`,
      policy,
    ),
    null,
  );
});

/* ── wiring: the call sites must still USE the policy ───────────────────── */

test('every proof call site routes screenshot_ref through parseClientRef', () => {
  for (const rel of CALL_SITES) {
    const src = read(rel);
    assert.match(
      src,
      /parseClientRef\(/,
      `${rel} must gate its ref through the sanctioned parser`,
    );
    assert.match(
      src,
      /(orderPaymentProofPolicy|inlineCheckoutProofPolicy)\(/,
      `${rel} must name a tenanted proof policy`,
    );
  }
});

test('no call site still accepts a ref on startsWith(r2://) alone', () => {
  for (const rel of CALL_SITES) {
    const src = read(rel);
    // The regression shape: a scheme test used AS the acceptance condition for
    // the raw ref. Any reintroduction fails here.
    //
    // 🪤 THIS WAS PINNED TO ONE VARIABLE NAME UNTIL 2026-09-03 and therefore
    // could not see the regression on a lane that spells it differently.
    // Sabotage proved it: reintroducing the bare scheme check on
    // `pay/[reference]/actions.ts` — where the raw ref is `refRaw`, not
    // `screenshotRefRaw` — left THIS test green while its two neighbours went
    // red. A guard that only recognises the defect in the file it was written
    // against is a guard with a blind spot per lane.
    assert.ok(
      !/[A-Za-z_$][\w$]*\.trim\(\)\.startsWith\('r2:\/\//.test(src),
      `${rel} reintroduced the bare scheme check — that is not a tenancy check`,
    );
  }
});

test('the ref is only stored on the branch the parser approved', () => {
  for (const rel of CALL_SITES) {
    const src = read(rel);
    // The identifier holding the raw ref differs per lane (`screenshotRefRaw`
    // on the dashboard lanes, `refRaw` on /pay) and the SPELLING is not the
    // rule — the shape is: screenshotUrl is assigned a trimmed ref, and the
    // parser call gates it. Matching the name would have made this guard refuse
    // a correct third lane, which is how a guard teaches people to delete it.
    const assignMatch = /screenshotUrl\s*=\s*[A-Za-z_$][\w$]*\.trim\(\)/.exec(src);
    assert.ok(assignMatch, `${rel} should still assign the approved ref`);
    const assign = assignMatch.index;
    // The nearest preceding parseClientRef must be within the same guard —
    // a few lines, not somewhere else in the 600-line module.
    const gate = src.lastIndexOf('parseClientRef(', assign);
    assert.ok(gate > 0, `${rel}: no parseClientRef precedes the assignment`);
    const between = src.slice(gate, assign);
    assert.ok(
      between.split('\n').length <= 8,
      `${rel}: the parser call is too far from the assignment to be gating it`,
    );
  }
});
