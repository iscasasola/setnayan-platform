/**
 * checkout-submit-refusal — the words a couple reads when the checkout drawer's
 * order submit is refused by the database. PURE.
 *
 * 💸 WHY IT EXISTS (known fault left in release d2e38b7, 2026-10-12). A submit
 * can LAND and lose its answer (no signal on the way back). The drawer then says
 * "We couldn't confirm that your order reached us … sending it twice cannot
 * create a second order" — and that promise is kept: every submit from one
 * drawer carries the ONE reference minted when it opened (`preminted_reference`)
 * and `orders.reference_code` is UNIQUE, so the retry's INSERT is refused. But
 * the action handed the refusal's raw text straight to the screen:
 *   duplicate key value violates unique constraint "orders_reference_code_key"
 * — right after the person had sent real money. Nothing was wrong; the order was
 * already in.
 *
 * 🔑 The double-order guard is NOT changed here, only what the refusal SAYS. A
 * unique refusal is called "already reached us" only when the caller has checked
 * that the order holding this reference is THIS buyer's own (`landedForThisBuyer`)
 * — a stranger's order with the same code (a mint collision) must never be
 * described to this person as theirs. Every other database refusal gets a plain
 * try-again line: the raw text goes to the fault log, never to the couple.
 */

/** Postgres `unique_violation`. */
const UNIQUE_VIOLATION = '23505';

export const ORDER_NOT_CREATED = 'We couldn’t create your order. Please try again — nothing was charged here.';
export const PAYMENT_NOT_LOGGED = 'We couldn’t record your payment details. Please try again — nothing was charged here.';

/** The line for a retry whose first send already landed. Names the reference the couple put in their transfer note. */
export function orderAlreadyReceived(referenceCode: string): string {
  return `This order already reached us — reference ${referenceCode}. There is nothing more to send; we’ll check your payment and let you know.`;
}

/** True when the refusal is the UNIQUE guard — the only case worth checking whose order holds the reference. */
export function isUniqueRefusal(err: { code?: string | null } | null | undefined): boolean {
  return err?.code === UNIQUE_VIOLATION;
}

/**
 * What the couple reads when the `orders` INSERT is refused.
 * `landedForThisBuyer` — an order with `referenceCode` exists AND belongs to the
 * signed-in buyer (the caller reads it; a failed read is `false`).
 */
export function orderInsertRefusal(
  err: { code?: string | null } | null | undefined,
  landedForThisBuyer: boolean,
  referenceCode: string,
): string {
  if (isUniqueRefusal(err) && landedForThisBuyer) return orderAlreadyReceived(referenceCode);
  return ORDER_NOT_CREATED;
}
