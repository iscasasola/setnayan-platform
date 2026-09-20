/**
 * THE DIGIT FORMS A PAYMENT'S AMOUNT CAN WEAR IN A BANK MESSAGE — the weakest
 * tier of the admin inbox matcher, split out so it can be EXECUTED.
 *
 * ── Why it is its own module ────────────────────────────────────────────────
 * It lived inside `app/admin/payments/_components/inbox-matcher.tsx`, a
 * `'use client'` React component that a node test cannot import without
 * dragging React and the client-boundary directive along. A guard on it could
 * therefore only GREP — and a grep passes while the thing it names does
 * nothing. The rule that can be got wrong now lives in a pure sibling and the
 * guard runs it.
 *
 * ── What it must never do ───────────────────────────────────────────────────
 * 🔴 It used to compare a ROUNDED number: `String(Math.round(amount_php))`. For
 * the ₱837.50 booking fee (charge `S89F-HMS91HGPAK`, order `S89O-DW67KBQADN`)
 * that searched a pasted bank notification for the literal `"838"` — a figure
 * that exists in no row of `payments`, `orders` or `booking_fee_charges`. It
 * cannot find this transfer by it, and it CAN find somebody else's genuine ₱838
 * transfer, which the desk is then offered as a match.
 *
 * 🔑 A DISPLAY THAT ROUNDS IS A LIE THE READER CAN SEE. A COMPARISON THAT
 * ROUNDS PICKS THE WRONG ROW AND LOOKS LIKE A HIT. Every form returned here is
 * a TRUNCATION of the exact digits, never a neighbour of them.
 */

/**
 * The forms of `amountPhp` worth searching a comma-stripped notification for,
 * exact digits only.
 *
 *   3999    → ['3999.00', '3999']   — a note that writes "3,999" still matches
 *   837.50  → ['837.50']            — the bare form IS the exact form
 *
 * The `.00`-stripped variant exists because plenty of GCash/BDO alerts write a
 * whole amount with no decimals at all. It is produced by cutting the exact
 * string, so no form here can be a number the database never held.
 */
export function paymentAmountMatchForms(amountPhp: number | string): string[] {
  // Supabase hands a NUMERIC back as a string on some paths; coerce rather than
  // trust the declared type, and return NOTHING for an unreadable figure —
  // never a form that would match text by accident.
  const n = Number(amountPhp);
  if (!Number.isFinite(n)) return [];
  const fixed = n.toFixed(2);
  const bare = fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed;
  return bare === fixed ? [fixed] : [fixed, bare];
}

/**
 * Does `haystack` (already lower-cased and comma-stripped by the caller) carry
 * this payment's amount?
 *
 * ⚖ THE 3-DIGIT FLOOR IS THE MATCHER'S OWN AND IS DELIBERATELY UNCHANGED: it is
 * measured on the PESO part, so a ₱50 payment — the booking fee's own minimum —
 * is below the floor and never matches on amount alone, exactly as before. Two
 * digits appear in almost any notification by accident, and this is the tier the
 * desk is explicitly told is not decisive. Loosening it is a separate decision
 * about how much the weakest tier may guess, not part of removing a rounding.
 */
export function haystackCarriesAmount(haystack: string, amountPhp: number | string): boolean {
  const forms = paymentAmountMatchForms(amountPhp);
  if (forms.length === 0) return false;
  const pesoDigits = forms[0].slice(0, forms[0].lastIndexOf('.'));
  if (pesoDigits.replace('-', '').length < 3) return false;
  return forms.some((form) => haystack.includes(form));
}
