/**
 * the-banner-does-not-promise-an-email.test.ts
 *
 * Every Papic buy path in the studio told the buyer:
 *   "Payment instructions are on the way; your cameras activate once the
 *    Setnayan team confirms your transfer."
 *
 * 🔴 NO SUCH MESSAGE EXISTS. There is no `payment_instructions` notification
 * type in the app — `lib/notification-emit.ts` says so in its own comment, and
 * none of these actions touches an email path. The sentence sent a person who
 * was ready to pay away to wait for something that was never coming.
 *
 * 🔑 THE INSTRUCTIONS ARE NOT ON THE WAY — THEY ARE ONE TAP AWAY. The order's
 * own page already carries the total, the reference, the BDO/GCash accounts and
 * the form for telling us the transfer is made. So the banner linked to it.
 *
 * 🔁 AND ON 2026-09-20 THE BANNER ITSELF WENT. Owner: *"papic order is not
 * fixed like the other purchases… why isn't it like this when they set the
 * price they pay for papic."* He was looking at `/pay/<reference>` — the QR
 * with the figure already inside it, the account name and number, the exact
 * amount to copy, the field for the bank reference. A banner that NAMES a
 * payment page is still not a payment page: it cost two more taps ("See how to
 * pay" → the order page → "Pay now") to reach what every other buy button in
 * the product reaches on the redirect. So these four mints now end at
 * `payPath(referenceCode)` like the rest, and the tests below moved with them —
 * from "the banner links somewhere payable" to "there is no banner, because
 * there is no detour".
 *
 * This is the same defect the owner hit in onboarding on 2026-08-20 ("i had a
 * price to pay. but i there was no payment. it just created."), in three more
 * places a person can actually reach today.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const web = process.cwd();
const read = (rel: string) => readFileSync(join(web, rel), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const STUDIO_PAGE = 'app/dashboard/[eventId]/studio/papic/page.tsx';
const STUDIO_ACTIONS = 'app/dashboard/[eventId]/studio/papic/actions.ts';
const EMIT = 'lib/notification-emit.ts';

test('no Papic buy path promises payment instructions that are on the way', () => {
  for (const rel of [STUDIO_PAGE, STUDIO_ACTIONS]) {
    const src = stripComments(read(rel));
    assert.doesNotMatch(
      src,
      /instructions\s*\n?\s*are on the way/,
      `${rel} promises a message the app never sends`,
    );
  }
});

test('the promise is still unsendable — if this fails, the email now exists and the copy may change', () => {
  // Pinned deliberately: the reason the banner links instead of promising is
  // that the notification type does not exist. The day someone builds it, this
  // assertion is the thing that tells them the copy decision can be revisited.
  const emit = read(EMIT);
  assert.doesNotMatch(
    emit,
    /^\s*'payment_instructions',/m,
    'a payment_instructions notification type now exists — revisit the banner copy',
  );
});

test('every paid Papic studio buy ends on the payment page, by name', () => {
  /**
   * Anchored PER FUNCTION, not counted over the file. A file-level match cannot
   * say WHICH buy path still detours — sabotage that re-pointed one of the four
   * back at the studio would leave three matches standing and a count-based
   * assertion green. Each door is asked its own question.
   */
  const src = stripComments(read(STUDIO_ACTIONS));
  const bodyOf = (fn: string): string => {
    const at = src.indexOf(`export async function ${fn}(`);
    assert.ok(at >= 0, `${fn} is gone from ${STUDIO_ACTIONS} — was it renamed?`);
    const next = src.indexOf('\nexport async function ', at + 1);
    return next === -1 ? src.slice(at) : src.slice(at, next);
  };

  for (const fn of [
    'purchasePapicCameras',
    'activatePapicLimited',
    'purchasePapicExtras',
    'purchasePapicPoolTopUp',
  ]) {
    const body = bodyOf(fn);
    assert.match(
      body,
      /redirect\(payPath\(referenceCode\)\)/,
      `${fn} must send the buyer to /pay/<reference> — the one screen that carries ` +
        'the amount inside the QR and can take a screenshot and a bank reference',
    );
    assert.doesNotMatch(
      body,
      /papic_purchased=/,
      `${fn} still redirects to the studio banner, which is the detour this removed`,
    );
  }
});

test('a FREE Papic provision still returns before the payment page', () => {
  /**
   * The mirror of the ₱0 rule in every-buy-button-lands-on-the-payment-page:
   * an Unlock-all owner provisioning cameras for nothing must not be shown a
   * bill. Both free arms redirect on `papic_unlock_provisioned`, and both must
   * do it BEFORE the paid redirect is reached.
   */
  const src = stripComments(read(STUDIO_ACTIONS));
  const frees = [...src.matchAll(/papic_unlock_provisioned=/g)].map((m) => m.index ?? -1);
  assert.equal(frees.length, 2, `expected both free provisions, found ${frees.length}`);
  for (const freeAt of frees) {
    const payAt = src.indexOf('redirect(payPath(referenceCode))', freeAt);
    assert.ok(payAt > freeAt, 'the free arm must come before its function’s paid redirect');
    assert.doesNotMatch(
      src.slice(freeAt, payAt),
      /requested_total_php/,
      'nothing may be priced between the free arm and the paid redirect',
    );
  }
});

test('the studio banner that stood in for a payment page is GONE, not merely unreachable', () => {
  // A confirmation nothing can trigger reads to the next person as a live screen
  // with a broken trigger — and its copy drifts out of true unnoticed.
  const src = stripComments(read(STUDIO_PAGE));
  assert.doesNotMatch(src, /See how to pay/, 'the banner’s link survived the redirect change');
  assert.doesNotMatch(src, /papicPurchased/, 'the banner’s trigger survived the redirect change');
  for (const param of ['papic_purchased', 'papic_ref', 'papic_amount']) {
    assert.doesNotMatch(
      src,
      new RegExp(`${param}\\?:`),
      `${param} is still in the page’s searchParams — nothing sets it any more`,
    );
  }
});
