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
 * the form for telling us the transfer is made. So the banner links to it.
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

test('the banner sends the buyer somewhere they can actually pay', () => {
  const src = stripComments(read(STUDIO_PAGE));
  // Counted, not merely matched: this label used to be duplicated across two
  // ternary branches, and a mutation deleting ONE left the other standing and
  // this guard green. Exactly one link, so removing it cannot hide.
  const labels = (src.match(/See how to pay/g) ?? []).length;
  assert.equal(labels, 1, `expected exactly one pay link, found ${labels}`);
  assert.match(
    src,
    /`\/dashboard\/\$\{eventId\}\/orders\/\$\{papicOrder\}`/,
    'the link must open the order that was just minted',
  );
  assert.match(
    src,
    /`\/dashboard\/\$\{eventId\}\/orders`/,
    'and must fall back to the orders list when the id is missing, never to nothing',
  );
});

test('every studio buy path carries the order id the link needs', () => {
  const src = stripComments(read(STUDIO_ACTIONS));
  const purchased = (src.match(/papic_purchased=/g) ?? []).length;
  const withOrder = (src.match(/papic_order=/g) ?? []).length;
  assert.ok(purchased > 0, 'expected at least one buy-path redirect');
  assert.equal(
    withOrder,
    purchased,
    `${purchased - withOrder} buy path(s) redirect without the order id, so their banner degrades to the list`,
  );
});
