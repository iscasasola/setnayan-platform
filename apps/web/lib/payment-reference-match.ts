/**
 * Is this bank reference the SAME transfer as one we have already seen?
 *
 * Owner, 2026-08-05: *"must also detect if reference number is used twice."*
 *
 * 🔑 A BLUNT "ONE REFERENCE, ONE PAYMENT, EVER" RULE WOULD BREAK REAL PAYMENTS.
 * Three repeats are honest and must keep working:
 *
 *   1. THE RE-SEND. When an admin asks for a clearer screenshot, the payer's
 *      correction is a NEW row carrying the SAME real reference. A one-use rule
 *      makes the honest fix impossible — and that is the very flow the
 *      "request better proof" button exists for.
 *   2. ONE TRANSFER, TWO ORDERS. A couple with two things to pay sends one lump
 *      sum and puts the same reference on both. Legitimate.
 *   3. THE BDO RAIL. On a bank transfer our reference and the payer's own
 *      invoice text are never identical — ours ENDS WITH theirs. Exact string
 *      matching would miss every cross-bank payment, and one stray space would
 *      sail through an exact rule anyway.
 *
 * So this module answers "same transfer?" loosely and lets the CALLER decide
 * what to do about it. Exactly one situation is always wrong and gets refused
 * outright; everything else is surfaced to a human who can see the bank app.
 *
 * Pure and dependency-free so the rule can be tested without a database — the
 * comparison is the whole risk, and a rule that cannot fail cheaply is a rule
 * nobody re-checks.
 */

/**
 * Strip everything that varies between two typings of the same reference:
 * case, spaces, and the punctuation banks sprinkle through confirmation codes.
 * A payer copying from GCash and an admin retyping from a BDO alert must land
 * on the same string, or the check silently never fires.
 */
export function normalizeReference(raw: string | null | undefined): string {
  if (raw == null) return '';
  return raw.replace(/[^a-z0-9]/gi, '').toUpperCase();
}

/**
 * Short references collide by accident. Below this many characters, treat a
 * containment match as noise rather than evidence — "123" appearing inside
 * another code means nothing, and a false accusation on a money screen costs
 * the admin's trust in every later warning.
 */
export const MIN_CONTAINMENT_LENGTH = 6;

export type ReferenceMatch = 'exact' | 'contained' | 'none';

/**
 * Compare two references as TRANSFERS, not as strings.
 *
 * `contained` covers the BDO shape in both directions: ours ends with theirs,
 * or a payer pastes the full bank line around the code. It is deliberately a
 * weaker signal than `exact` so the caller can treat it as "look at this"
 * rather than "refuse this".
 */
export function compareReferences(a: string | null | undefined, b: string | null | undefined): ReferenceMatch {
  const x = normalizeReference(a);
  const y = normalizeReference(b);
  if (x === '' || y === '') return 'none';
  if (x === y) return 'exact';
  if (x.length < MIN_CONTAINMENT_LENGTH || y.length < MIN_CONTAINMENT_LENGTH) return 'none';
  if (x.includes(y) || y.includes(x)) return 'contained';
  return 'none';
}

export type PriorPayment = {
  paymentId: string;
  orderId: string;
  referenceNumber: string | null;
  /** Only a payment that COUNTS AS MONEY can double-count. */
  status: string;
};

export type DuplicateVerdict =
  | { kind: 'clear' }
  /**
   * The same transfer is already counted on THIS order. Always wrong, always
   * refused: the shortfall guard adds up what payers CLAIM they sent, so two
   * rows describing one transfer would promote an order that was half paid.
   */
  | { kind: 'refuse'; message: string; priorPaymentId: string }
  /**
   * The same transfer is counted on a DIFFERENT order. Possibly honest (one
   * lump sum covering two purchases), possibly the same receipt submitted
   * twice. A human with the bank app open decides — this only makes sure they
   * are told, and names the other order so they can check it.
   */
  | { kind: 'warn'; message: string; priorPaymentId: string; otherOrderId: string; match: ReferenceMatch };

/**
 * Statuses that mean this row is being counted as received money.
 *
 * 🚨 EXACTLY THE ENUM, NOTHING INVENTED. `payments.status` is
 * pending / matched / rejected — there is **no 'paid'**. Listing one made
 * Postgres reject the entire duplicate lookup, so the guard silently found
 * nothing on every payment from the hour it shipped. Exported so the query and
 * the rule cannot drift, and so a test can compare it against the migration.
 */
export const MONEY_STATUSES = ['matched'] as const;

const COUNTS_AS_MONEY = new Set<string>(MONEY_STATUSES);

/**
 * Decide what to do about a reference that already exists somewhere.
 *
 * ⚠ ONLY PRIOR ROWS THAT COUNT AS MONEY MATTER. A rejected row carrying the
 * same reference is the re-send case (#1 above) — the correction is SUPPOSED to
 * repeat it, and warning there would train the admin to click through warnings.
 */
export function classifyDuplicate(args: {
  reference: string | null | undefined;
  orderId: string;
  priors: readonly PriorPayment[];
}): DuplicateVerdict {
  const { reference, orderId, priors } = args;
  if (normalizeReference(reference) === '') return { kind: 'clear' };

  let warn: DuplicateVerdict | null = null;

  for (const p of priors) {
    if (!COUNTS_AS_MONEY.has(p.status)) continue;
    const match = compareReferences(reference, p.referenceNumber);
    if (match === 'none') continue;

    if (p.orderId === orderId) {
      // Same order, same transfer. No honest reading of this.
      return {
        kind: 'refuse',
        priorPaymentId: p.paymentId,
        message:
          'This reference is already counted on this order. Approving it again would ' +
          'count one transfer twice and could mark the order paid when only part of ' +
          'the money arrived.',
      };
    }

    // Keep looking — a same-order match outranks a cross-order one and must
    // win even if the cross-order row was found first.
    if (!warn) {
      warn = {
        kind: 'warn',
        priorPaymentId: p.paymentId,
        otherOrderId: p.orderId,
        match,
        message:
          match === 'exact'
            ? 'This exact reference is already counted on another order. If one transfer ' +
              'really covers both, confirm below — otherwise this is the same receipt sent twice.'
            : 'A reference very close to this one is already counted on another order. ' +
              'Bank transfers often wrap our code in their own, so check the bank app before confirming.',
      };
    }
  }

  return warn ?? { kind: 'clear' };
}
