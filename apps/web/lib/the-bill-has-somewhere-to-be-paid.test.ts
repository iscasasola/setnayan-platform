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

// ── 1 · the mint points at the bill ────────────────────────────────────────
test('the onboarding mint sends a buyer to the order it just minted', () => {
  const src = stripComments(read(MINT));
  assert.match(
    src,
    /paymentPath:\s*`\/dashboard\/\$\{eventId\}\/orders\/\$\{orderId\}\?created=1`/,
    'the mint must return the order\'s own bill page as paymentPath',
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
  assert.match(src, /via BDO or GCash/, 'the bill must say where to send the money');
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
    /Add shots here now/,
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
const UNPAID_READERS: ReadonlyArray<readonly [string, string]> = [
  ['app/dashboard/[eventId]/_components/event-dashboard.tsx', 'the couple\'s "Settle a payment" group'],
  ['lib/event-decisions.ts', 'the event needs-you count'],
  ['lib/setnayan-ai-snapshot.ts', 'the planner\'s pending-money bucket'],
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

test('the mint writes a status those readers can see', () => {
  const mint = stripComments(read(MINT));
  const minted = /status:\s*'(\w+)'/.exec(mint)?.[1];
  assert.ok(minted, 'the mint must name the status it writes');
  assert.ok(
    ['submitted', 'awaiting_payment'].includes(minted!),
    `the mint writes '${minted}', which no couple-facing unpaid surface reads`,
  );
});
