/**
 * the-bill-has-somewhere-to-be-paid.test.ts
 *
 * THE DEFECT THIS EXISTS FOR (owner, 2026-08-20, on a real birthday he created):
 *   "i had a price to pay. but i there was no payment. it just created."
 *
 * He was right, and an order existed the whole time — prod `orders` row
 * S89O-GCR6BDC4Z6, Setnayan AI, PHP 499, status 'submitted'. The onboarding mint
 * redirected him to the PAPIC STUDIO, whose banner names no amount (it only
 * prints a figure when `papic_amount` is in the URL, which that path never set),
 * gives no account to send to, and says "your cameras activate" — to somebody
 * who bought the assisted planner.
 *
 * 🔑 NOTHING WAS DESIGNED TO FIX IT. The bill page already existed and is
 * canonical (`app/dashboard/[eventId]/orders/[orderId]/page.tsx`). A destination
 * was corrected. So this suite guards the JOIN, in both directions:
 *
 *   1. the mint points at the bill, and never back at the studio;
 *   2. the bill still SAYS the things that make it a bill;
 *   3. no `?next=` errand can carry a buyer past their own bill again;
 *   4. the shots card names a price BEFORE the button is pressed.
 *
 * ⚠ WHY (2) IS HERE AND IS NOT REDUNDANT. Asserting only that the mint links to
 * `/orders/<id>` would pass just as happily if that page were later gutted to a
 * status line. The original bug was not a broken link — it was a link to a page
 * that did not do the job. Pinning the DESTINATION's content is the only half
 * that would have caught it, and it is the half that did not exist.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const web = process.cwd();
const read = (rel: string) => readFileSync(join(web, rel), 'utf8');

/** Source with block + line comments removed — a comment must never satisfy a guard. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const MINT = 'lib/onboarding-services-orders.ts';
const GENERIC = 'app/onboarding/[type]/_components/generic-onboarding.tsx';
const WEDDING = 'app/onboarding/wedding/_components/onboarding-shell.tsx';
const SIMPLE = 'app/onboarding/simple/actions.ts';
const BILL = 'app/dashboard/[eventId]/orders/[orderId]/page.tsx';
const CARD = 'app/onboarding/_shared/services-step.tsx';

// ── 1 · the mint points at where the money can be sent ─────────────────────
test('the onboarding mint sends a buyer to the page that can TAKE the payment', () => {
  /**
   * 🔁 RE-POINTED 2026-08-28, AND IT IS A STEP CLOSER TO THE MONEY, NOT A
   * WEAKENING. This assertion used to pin `/dashboard/{id}/orders/{orderId}` —
   * the fix for the owner's *"i had a price to pay. but i there was no payment.
   * it just created."* Correct at the time: it replaced the Papic studio, whose
   * banner named no amount and no account.
   *
   * But the order page is where a bill LIVES; `/pay/[reference]` is where one is
   * SETTLED — the QR with the figure already inside it, the account number, the
   * proof form. Owner, 2026-08-28, looking at that same order page: *"i will go
   * here? it should be settled first. […] Then the onboarding end."*
   *
   * What this test has always protected is unchanged and is checked below: from
   * the end of the wizard there must be a way to actually send the money, and it
   * must never be a page that merely confirms something.
   */
  const src = stripComments(read(MINT));
  assert.match(
    src,
    /paymentPath: `\/pay\/\$\{encodeURIComponent\(referenceCode\)\}\?setup=1`/,
    'the mint must open the payment page, flagged as the last step of setting up',
  );
  // And the destination it replaced must not come back by a later edit.
  assert.doesNotMatch(
    src,
    /paymentPath: `\/dashboard\/\$\{eventId\}\/orders/,
    'the ledger entry is where a bill lives, not where it is settled',
  );
});

test('the mint never routes a bill back to the Papic studio', () => {
  const src = stripComments(read(MINT));
  assert.doesNotMatch(
    src,
    /studio\/papic/,
    'the studio banner names no amount and no account — it is a confirmation, not a bill',
  );
  // The two params that only ever addressed that banner must be gone with it,
  // or a future edit can reinstate the destination by re-adding one line.
  assert.doesNotMatch(src, /papic_purchased/, 'stale studio-banner param left in the mint');
});

// ── 2 · the destination is still a bill ────────────────────────────────────
test('the bill page still shows an amount, a reference and how to send it', () => {
  const src = read(BILL);
  assert.match(src, /Total to pay/, 'the bill must state the amount owed');
  assert.match(src, /reference_code/, 'the bill must show the reference code to quote');
  // ⚠ RE-POINTED 2026-08-21, NOT WEAKENED. The bill used to carry the rails
  // itself — an amount-less static QR pair and a form asking the couple to TYPE
  // the amount, the channel and the full reference. Sending the money now
  // happens on the ONE payment page, where the figure is inside the QR. What
  // this test protects is unchanged: from the bill, there must be a way to pay.
  assert.match(
    src,
    /payPath\(order\.reference_code\)/,
    'the bill must still lead somewhere the money can actually be sent',
  );
  assert.match(src, /Send your payment/, 'the way to pay must be named, not implied');
  assert.match(
    src,
    /created\b/,
    'the bill must have post-creation copy for someone arriving straight from onboarding',
  );
});

// ── 3 · nothing carries a buyer past their own bill ────────────────────────
test('a ?next= errand cannot outrank a bill in any onboarding flow', () => {
  // Generic (14 event types) — the flow the owner walked.
  const generic = stripComments(read(GENERIC));
  assert.match(
    generic,
    /res\.paymentPath\s*\?\?\s*nextPath/,
    'generic onboarding must offer the bill before the vendor errand',
  );
  assert.doesNotMatch(
    generic,
    /nextPath\s*\?\?\s*res\.paymentPath/,
    'the old precedence swallowed the bill whenever ?next= was set',
  );

  // Wedding — same shape, different variable. Swept because a fix applied to one
  // route and not its siblings is half a fix (this file's own history).
  const wedding = stripComments(read(WEDDING));
  assert.match(
    wedding,
    /papicPaymentPath\s*\?\?\s*nextPath/,
    'the wedding flow must offer the bill before the vendor errand',
  );
  assert.doesNotMatch(wedding, /nextPath\s*\?\?\s*papicPaymentPath/, 'old wedding precedence');

  // Simple — already correct; pinned so a "consistency" refactor cannot add a
  // nextPath above it.
  const simple = stripComments(read(SIMPLE));
  assert.match(
    simple,
    /redirect\(\s*papic\.paymentPath\s*\?\?/,
    'the simple flow must redirect to the bill first',
  );
});

// ── 4 · the shots card names a price before it is pressed ──────────────────
test('the shots stepper says what the next press costs, before it is pressed', () => {
  const src = stripComments(read(CARD));
  // The hint must be derived from the NEXT step, not from the current one —
  // reading the current step would print "Free" at rest, which is the bug.
  assert.match(
    src,
    /poolPriceAt\(type,\s*step \+ 1\)/,
    'the hint must price the step the button lands on',
  );
  assert.match(
    src,
    /poolShotsAt\(type,\s*step \+ 1\)\s*-\s*poolShotsAt\(type,\s*step\)/,
    'the hint must state how many MORE shots the press buys',
  );
  assert.match(src, /Press <span[^>]*>\+<\/span> to add/, 'the hint must name the control');
});

test('the shots card does not send the reader elsewhere to do what it does', () => {
  const src = stripComments(read(CARD));
  assert.doesNotMatch(
    src,
    /Top up any time from your\s*\n?\s*Papic studio/,
    'the card told the reader to buy on another page while a live control sat above it',
  );
  assert.match(
    src,
    /Add credits here now/,
    'the card must say buying happens here',
  );
});

// ── 5 · the bill stays findable after they leave it ────────────────────────
//
// Landing on the bill fixes the moment. It does not fix the day after. Every
// couple-facing "you owe money" surface asked for `awaiting_payment` ALONE —
// a real enum member that almost nothing writes. Every mint in the app writes
// `submitted`; prod's only order is `submitted`. So the prompt that exists to
// say "settle this" could not see an ordinary unpaid bill.
//
// ⚠ `lib/setnayan-ai-snapshot.ts` USED TO BE ON THIS LIST and is deliberately
// not any more (BA8). Its entry was GRD-05's `pending` bucket — a sum of
// unpaid orders that the over-budget guard added ON TOP of committed money.
// That bucket no longer exists: the guard's money now comes from
// `resolveEventMoney`, which reads the couple's orders WITHOUT a status filter
// and classifies each one by name — `awaiting_payment` is a commitment,
// `submitted` is an estimate (§18.5 rule 4: "over budget" means what they have
// AGREED exceeds their target). So neither unpaid state went blind; the read
// moved, and the test below pins it where it went. The two surfaces that
// actually tell a couple "settle this" are still listed, and still checked.
const UNPAID_READERS: ReadonlyArray<readonly [string, string]> = [
  ['app/dashboard/[eventId]/_components/event-dashboard.tsx', 'the couple\'s "Settle a payment" group'],
  ['lib/event-decisions.ts', 'the event needs-you count'],
];

test('every couple-facing unpaid-order read asks for BOTH unpaid states', () => {
  for (const [rel, what] of UNPAID_READERS) {
    const src = stripComments(read(rel));
    assert.match(
      src,
      /\.in\(\s*'status',\s*\[\s*'submitted',\s*'awaiting_payment'\s*\]\s*\)/,
      `${what} (${rel}) must count 'submitted' too — it is the state every mint writes`,
    );
    assert.doesNotMatch(
      src,
      /\.eq\(\s*'status',\s*'awaiting_payment'\s*\)/,
      `${what} (${rel}) still filters one unpaid state and will read empty for real bills`,
    );
  }
});

test('the planner delegates its orders read, and both unpaid states survive it', () => {
  // Removing a file from UNPAID_READERS must not be a way to go quiet. Two
  // halves, because either alone is satisfiable by a regression:
  //   · the snapshot no longer reads `orders` at all, so there is no filter of
  //     its own to get wrong;
  //   · the resolver it delegates to reads them unfiltered and names BOTH
  //     unpaid states, so an ordinary unpaid bill is still seen.
  const snap = stripComments(read('lib/setnayan-ai-snapshot.ts'));
  assert.doesNotMatch(
    snap,
    /\.from\(\s*'orders'\s*\)/,
    'the planner reads `orders` directly again — that is a second status filter ' +
      'to keep in step with the resolver, and it is how this defect started',
  );
  assert.match(
    snap,
    /resolveEventMoney\s*\(/,
    'the planner must get its money from resolveEventMoney',
  );

  const truth = stripComments(read('lib/budget-truth.ts'));
  const ordersRead = /\.from\(\s*'orders'\s*\)[\s\S]{0,400}?\.eq\(\s*'event_id'/.exec(truth);
  assert.ok(ordersRead, 'the resolver must read the event’s orders');
  assert.doesNotMatch(
    ordersRead[0],
    /\.(in|eq)\(\s*'status'/,
    'the resolver filtered orders by status — it classifies them instead, and a ' +
      'filter here silently drops a state from every surface at once',
  );
  for (const state of ['awaiting_payment', 'submitted']) {
    assert.ok(
      new RegExp(`'${state}'`).test(truth),
      `the resolver does not name '${state}' — an unpaid bill in that state is ` +
        `now invisible to every surface that asks it for money`,
    );
  }
});

test('the mint writes a status those readers can see', () => {
  const mint = stripComments(read(MINT));
  const minted = /status:\s*'(\w+)'/.exec(mint)?.[1];
  assert.ok(minted, 'the mint must name the status it writes');
  assert.ok(
    ['submitted', 'awaiting_payment'].includes(minted!),
    `the mint writes '${minted}', which no couple-facing unpaid surface reads`,
  );
});
