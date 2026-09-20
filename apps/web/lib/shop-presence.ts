/**
 * "THIS PERSON HAS NO SHOP" AND "WE COULD NOT READ WHETHER THEY HAVE ONE"
 * ARE TWO DIFFERENT FACTS. This file is the one place that tells them apart.
 *
 * ── Why it exists ────────────────────────────────────────────────────────
 * `/vendor-dashboard/shop` sends a shopless account to `/open-shop`, the
 * brand-new-shop wizard. That is correct for somebody who genuinely has no
 * shop, and it is the worst possible screen for somebody who HAS one and
 * whose read just failed: it invites them to create a SECOND shop over the
 * top of the first. The redirect is only safe when the absence was PROVEN —
 * a read that succeeded and came back with nothing.
 *
 * The shape this guards against is the repo's recorded disease: a failure
 * that renders identically to emptiness. A PostgREST read that is refused or
 * errors hands back `data: null`, which is byte-identical to the `data: null`
 * of a successful read over zero rows — and `const { data } = await …`, with
 * the error destructured away, makes the two literally the same value.
 *
 * ── The contract ─────────────────────────────────────────────────────────
 *   'has-shop'   — the read succeeded and returned at least one row.
 *   'no-shop'    — the read SUCCEEDED and returned zero rows. A proven
 *                  absence, and the ONLY verdict that may reach a redirect
 *                  to an onboarding/create gate.
 *   'unreadable' — an error, or no rows array at all. Never an absence.
 *
 * 🔑 An error must NEVER map to 'no-shop'. `lib/shop-presence.test.ts` exists
 * to hold that one property; everything else here is bookkeeping.
 *
 * Deliberately PURE and free of `server-only`, imports and I/O, so the guard
 * can EXECUTE the decision rather than grep for it (see the repo memory note
 * "`server-only` forces guards to grep — split the decision").
 */

export type ShopPresence = 'has-shop' | 'no-shop' | 'unreadable';

/**
 * Classify one PostgREST-shaped read of "does this person have a shop".
 *
 * @param rows  the `data` of the read — an array of rows, or null/undefined.
 * @param error the `error` of the read. ANY truthy value means unreadable.
 */
export function classifyShopRead(
  rows: readonly unknown[] | null | undefined,
  error: unknown,
): ShopPresence {
  // An error is never an absence — even when it arrives WITH rows, because
  // a partial result cannot prove the zero-row case either.
  if (error) return 'unreadable';
  // No error and no array: nothing was read. PostgREST gives `data: null` for
  // a refused single-row read, and a caller that has already destructured the
  // error away would otherwise read this as "they have no shop".
  if (rows == null) return 'unreadable';
  return rows.length > 0 ? 'has-shop' : 'no-shop';
}
