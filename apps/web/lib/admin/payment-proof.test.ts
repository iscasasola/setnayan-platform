import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A one-tap "Confirm payment" may only appear on a row that carries PROOF.
 *
 * 🚨 THE FAILURE THIS EXISTS FOR. Owner, 2026-08-05: *"vendor must send their
 * booking fee payment before we activate it. admin will verify it manually if
 * paid via QR."*
 *
 * A booking-fee payment row is inserted as `pending` THE MOMENT THE VENDOR
 * CONFIRMS THE DEPOSIT — before any money moves — with `reference_number: null`
 * and `screenshot_url: null` (lib/booking-fee-lock.server.ts). It is a
 * placeholder for a payment that is EXPECTED, not a record of one that ARRIVED.
 *
 * On the payments page an admin sees the blank screenshot and thinks twice. On
 * a list built for speed it looked identical to every other one-tap row — and
 * that tap now promotes the order, settles the booking-fee charge and activates
 * the booking. One careless tap would sync a booking nobody paid for.
 *
 * 🔑 A FACT QUEUE IS ONLY A FACT QUEUE WHEN THE FACT IS ON THE ROW.
 */

const SRC = readFileSync(join(process.cwd(), 'lib/admin/queue-peek.ts'), 'utf8');

test('the payments peek reads both proof columns', () => {
  // If either column stops being selected, `hasProof` silently reads undefined
  // and every row looks unproven — or worse, a later edit drops the check
  // entirely because the data is not there to check.
  const select = SRC.match(/open\('payment_id[^']*'\)/);
  assert.ok(select, 'the payments peek select could not be found');
  assert.match(select[0], /reference_number/, 'reference_number must be selected');
  assert.match(select[0], /screenshot_url/, 'screenshot_url must be selected');
});

test('the confirm-payment action is gated on proof, not offered outright', () => {
  const gated = /action: hasProof\s*\n?\s*\?\s*\{ kind: 'approve-payment'/.test(SRC);
  assert.ok(
    gated,
    "'Confirm payment' must be conditional on hasProof. An unconditional " +
      'action here lets one tap activate a booking whose fee was never paid.',
  );
});

test('a row with no proof explains itself instead of going silent', () => {
  // Silence reads as an unfinished feature and teaches nothing; the sentence
  // tells the admin WHY there is no button, which is the same rule the
  // judgement queues follow.
  assert.match(
    SRC,
    /note: hasProof\s*\n?\s*\?\s*undefined/,
    'a proofless payment row must carry a note where the button would be',
  );
});

test('proof means non-empty, not merely non-null', () => {
  // A blank string is what an empty form field posts. Treating '' as proof
  // would reopen the hole with an extra step, and would look correct in review.
  assert.match(
    SRC,
    /reference_number\.trim\(\) !== ''/,
    'reference_number must be trimmed-checked, not just null-checked',
  );
  assert.match(
    SRC,
    /screenshot_url\.trim\(\) !== ''/,
    'screenshot_url must be trimmed-checked, not just null-checked',
  );
});

test('the placeholder row this guards against still exists upstream', () => {
  // 🪤 If the lock ever stops pre-inserting a blank pending payment, this guard
  // becomes cargo cult — and worse, someone may "simplify" it away without
  // realising the hole it closed. Fail loudly if the upstream shape moves, so
  // the decision is made deliberately rather than by drift.
  const lock = readFileSync(join(process.cwd(), 'lib/booking-fee-lock.server.ts'), 'utf8');
  assert.match(
    lock,
    /from\('payments'\)\s*\n?\s*\.insert\(\{/,
    'booking-fee lock no longer pre-inserts a payment row — re-read whether the ' +
      'proof gate in queue-peek.ts is still the right shape',
  );
  assert.match(
    lock,
    /reference_number: null/,
    'the pre-inserted booking-fee payment no longer has a null reference — the ' +
      'proof gate may now be unnecessary, or may need a different test',
  );
});
