/**
 * a-refunded-fee-gives-the-money-back.test.ts — CTRL-B1 build 1.
 *
 * ── THE DEFECT, measured 2026-09-22 against origin/main ──────────────────────
 * `activateOrderSku` carries a `vendor_booking_fee__{charge_id}` arm: settle the
 * charge, roll it into `booking_fee_ledger`, grant the supplier's 5% Papic
 * credits, land the couple's Setnayan gift. `deactivateOrderSku` carried NO
 * booking-fee arm — the anchor in the brief was
 *   `awk '/deactivateOrderSku/,/^}/' sku-activation.ts | grep -c BookingFee` → 0.
 *
 * So a refunded fee order left: the charge 'paid', the ledger counting money we
 * gave back, the cap possibly still reached, and the supplier holding credits
 * that fee bought.
 *
 * ── WHAT THIS FILE HOLDS ────────────────────────────────────────────────────
 *   1. THE ARM EXISTS and is reached from `deactivateOrderSku` — counted, not
 *      merely present, because a second arm would double-decrement.
 *   2. THE REVERSAL IS ATOMIC — the charge + ledger move in one RPC, never as
 *      two TypeScript writes.
 *   3. THE CREDITS ARE CLAWED BACK by `order_id`, the same key the couple's pot
 *      uses.
 *   4. THE GIFT IS NOT DOUBLE-REVERSED — `reversePapicPassPoints` already takes
 *      it, and a second deletion here would be a bug, not belt-and-braces.
 *   5. THE ORDINAL IS NOT TOUCHED — the brief asked for it; the schema forbids
 *      it. This asserts the restraint so nobody "completes" it later.
 *
 * 🛡 Mutation-checked: every rule below was broken on purpose and confirmed RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const count = (src: string, re: RegExp) => (src.match(new RegExp(re.source, 'g')) ?? []).length;

const SKU = read('lib/sku-activation.ts');

/** `deactivateOrderSku`'s body alone — the window must face the sabotage. */
function deactivateBody(): string {
  const m = /export async function deactivateOrderSku[\s\S]*?\n}/.exec(SKU);
  assert.ok(m, 'deactivateOrderSku not found — this guard is pointed at nothing');
  return m[0];
}

/** The reversal helper's body alone. */
function reversalBody(): string {
  const m = /async function reverseBookingFeeCharge[\s\S]*?\n}/.exec(SKU);
  assert.ok(m, 'reverseBookingFeeCharge not found');
  return m[0];
}

// SABOTAGE: delete the `reverseBookingFeeCharge(ctx, …)` call → RED.
// SABOTAGE: add a SECOND call → RED (a double decrement is the mirror defect).
test('deactivateOrderSku reverses the booking fee — exactly once', () => {
  const body = deactivateBody();
  assert.equal(
    count(body, /await reverseBookingFeeCharge\(/),
    1,
    'a refunded fee order must reverse its charge exactly once — 0 leaves revenue overstated, 2 decrements the ledger twice',
  );
  assert.match(
    body,
    /chargeIdFromBookingFeeLockServiceKey\(ctx\.serviceKey\)/,
    'the arm must recognise a fee order by the same parser the activation side uses',
  );
});

// SABOTAGE: replace the rpc call with two .from('booking_fee_charges').update()
//           + .from('booking_fee_ledger').update() writes → RED.
test('the charge and the ledger move together, in one RPC', () => {
  const body = reversalBody();
  assert.match(
    body,
    /rpc\('booking_fee_reverse_charge'/,
    'the reversal must go through the RPC — two TypeScript writes can land apart and leave the charge and the ledger disagreeing about the same peso',
  );
  assert.equal(
    count(body, /from\('booking_fee_charges'\)[\s\S]{0,80}\.update\(/),
    0,
    'the charge status must not be written directly — that path skips the ledger decrement',
  );
  assert.equal(
    count(body, /from\('booking_fee_ledger'\)/),
    0,
    'the ledger must not be written directly — the RPC owns both halves',
  );
});

// SABOTAGE: delete the vendor_papic_portfolio_credit_grants clawback → RED.
// SABOTAGE: key the delete on vendor_profile_id instead of order_id → RED
//           (that would revoke credits from OTHER orders' grants).
test('the credits the fee bought are taken back, keyed on the order', () => {
  const body = reversalBody();
  assert.match(
    body,
    /from\('vendor_papic_portfolio_credit_grants'\)[\s\S]{0,120}\.delete\(\)/,
    'the supplier keeps the 5% credits a refunded fee bought',
  );
  assert.match(
    body,
    /from\('vendor_papic_portfolio_credit_grants'\)[\s\S]{0,200}\.eq\('order_id', ctx\.orderId\)/,
    'the clawback must be keyed on order_id — any wider key revokes credits other orders paid for',
  );
});

// SABOTAGE: add a papic_event_point_grants delete to reverseBookingFeeCharge → RED.
test('the couple’s gift is reversed ONCE, by the pot reversal that already owns it', () => {
  assert.equal(
    count(reversalBody(), /papic_event_point_grants/),
    0,
    'the Setnayan gift lands in papic_event_point_grants keyed on order_id and is already deleted by reversePapicPassPoints — a second deletion here is a bug, not belt-and-braces',
  );
  assert.match(
    deactivateBody(),
    /await reversePapicPassPoints\(ctx\)/,
    'the pot reversal is what takes the gift back — if it ever goes, the gift needs a new owner',
  );
});

// SABOTAGE: add `booking_ordinal` to the migration's UPDATE → RED.
test('a refund does NOT release the frozen booking ordinal', () => {
  const migrations = readdirSync(join(WEB, '..', '..', 'supabase', 'migrations'))
    .filter((f) => f.includes('booking_fee_reverse_charge'));
  assert.equal(migrations.length, 1, 'expected exactly one reverse-charge migration');
  const only = migrations[0];
  assert.ok(only, 'no reverse-charge migration found — this guard is pointed at nothing');
  const sql = readFileSync(join(WEB, '..', '..', 'supabase', 'migrations', only), 'utf8');
  // 🪤 THE FIRST VERSION OF THIS ASSERTION FIRED ON ITS OWN DOCUMENTATION.
  // Stripping `--` comments is not enough: `COMMENT ON FUNCTION … IS '…'` is a
  // STRING LITERAL, and this migration's comment says "Does NOT touch
  // booking_ordinal". So the guard convicted the sentence promising the very
  // restraint it was checking for. Assert the PROPERTY — no ASSIGNMENT to the
  // column, inside the function body only — not the absence of a word.
  const body = /AS \$\$([\s\S]*?)\$\$;/.exec(sql)?.[1] ?? '';
  assert.ok(body.length > 200, 'could not isolate the function body — this guard is pointed at nothing');
  const code = body.replace(/^\s*--.*$/gm, '');
  assert.equal(
    count(code, /booking_ordinal\s*=/),
    0,
    'booking_ordinal is documented immutable ("so a re-lock never shifts it") — releasing it on refund lets a supplier refund back down the free-5 ladder',
  );
  // 🪤 AND THE SECOND VERSION FIRED ON ITSELF TOO — `jsonb_build_object('reversed',
  // true)` is a RETURN KEY, not a status. Twice now a bare word-search convicted
  // the code it was written to protect. Match the ASSIGNMENT, which is the only
  // thing that could actually widen the vocabulary.
  assert.equal(
    count(code, /status\s*=\s*'(refunded|reversed|void)'/),
    0,
    'the status vocabulary has no refunded/void by design (positioning doc 2026-07-22) — reverse to pending, do not invent one',
  );
  assert.equal(
    count(sql, /ADD CONSTRAINT[\s\S]{0,120}status/),
    0,
    'this migration must not widen the status CHECK — that is an owner decision, not a side effect of a refund fix',
  );
  assert.match(code, /status\s+= 'pending'/, 'a reversed charge becomes pending — the bill is open again');
  assert.match(code, /status = 'paid'/, 'only a PAID charge may be reversed — that WHERE is the idempotency guard');
});
