/**
 * vendor-pays-setnayan.ts — which orders run the OTHER way.
 *
 * ─── THE HAZARD ──────────────────────────────────────────────────────────
 * `schedulePayoutForOrder` exists for ONE shape of order: a couple paid
 * Setnayan for a supplier's service, so Setnayan owes that supplier their net.
 * A supplier buying something FROM Setnayan is the same table, the same
 * `vendor_profile_id`, and the opposite direction of money.
 *
 * The guard that stood here inferred the direction from two accidents:
 *
 *     if (!row.event_id || isBranchOrder) return;
 *
 * `event_id` is null on an account-level supplier purchase, and the branch SKU
 * was special-cased by name after it got through once. That holds for seven of
 * the nine supplier purchase paths purely because they pass `eventId: null`.
 *
 * 🔴 IT DOES NOT HOLD FOR THE TWO THAT ARE PER-EVENT. `vendor_3d_booth_event`
 * (a supplier branding one wedding's booth) and `vendor_papic_portfolio_pack`
 * (a supplier buying Papic credits for their own portfolio at one wedding) both
 * pass a REAL `eventId` — there genuinely is a wedding behind them — and
 * neither is a branch key. So both signals miss, and approving a supplier's
 * ₱500 payment scheduled roughly ₱447.50 to be paid BACK to that supplier,
 * showing as money owed on the admin and supplier screens.
 *
 * 🔑 THE DIRECTION OF MONEY IS NOT DERIVABLE FROM WHETHER A WEDDING IS
 * ATTACHED. It is a property of the SKU, so it is declared here as one list
 * instead of inferred from two proxies that happen to correlate.
 *
 * ⚠ `service_key` on a couple booking comes from a FORM FIELD (the calling
 * add-on page posts it), so this is a closed allowlist rather than a
 * `startsWith('vendor_')` rule — a couple-facing SKU could be named anything,
 * and a rule that guessed would start refusing real payouts.
 */

/** Supplier purchases with a fixed SKU code. */
export const VENDOR_PAYS_SETNAYAN_SKUS: readonly string[] = [
  'vendor_3d_booth',
  'vendor_3d_booth_event',
  'vendor_ai_addon',
  'vendor_ai_addon_advanced',
  'vendor_deep_search',
  'vendor_papic_portfolio_pack',
  'vendor_photo_challenge',
  // 🧰 Build 4 (owner 2026-11-09) — the Specialized tools unlock, 4 weeks and 1 year. A shop paying US.
  'vendor_specialized_tools',
  'vendor_specialized_tools_annual',
] as const;

/**
 * Supplier purchases whose key carries an id, so only the prefix is fixed.
 * `vendor_additional_branch__` is the one this guard was originally patched
 * for, by name; it keeps its place here rather than staying a special case.
 */
export const VENDOR_PAYS_SETNAYAN_PREFIXES: readonly string[] = [
  'vendor_additional_branch__',
  'vendor_booking_fee__',
  // 2026-11-04 — the shop buys the couple's Papic packs into its wallet (`SHOP_PAPIC_PACK_KEY_PREFIX`).
  'vendor_papic_pack__',
  // ⚠ KEPT AFTER THE CUSTOM PLAN WAS RETIRED (2026-11-06), ON PURPOSE. Nothing mints these keys any more, but an
  // order that already carries one is still a supplier paying Setnayan — dropping the prefix would make such an
  // order look payable to a supplier. A list that refuses payouts may only grow while old orders exist.
  'vendor_custom_plan__',
  'vendor_custom_plan_annual__',
  'vendor_extra_seat__',
  // 2026-11-06 — the four Ultra add-ons (owner, "ULTRA ADD-ON PRICES"; lib/vendor-ultra-addons.ts).
  'vendor_extra_category__',
  'vendor_extra_service_card__',
  'vendor_extra_waitlist__',
  'vendor_extra_booking_per_date__',
  'vendor_subscription__',
] as const;

/**
 * True when THIS order is a supplier paying Setnayan — so no payout may ever
 * be scheduled for it.
 *
 * ⚖ A null/unknown key answers FALSE, which keeps the caller's existing
 * `!row.event_id` check load-bearing rather than replacing it. The two run
 * together: this one is authoritative about the SKUs we know, and the old
 * check still catches an account-level order whose SKU nobody has classified
 * yet. Answering TRUE on unknown would silently stop paying real suppliers.
 */
export function vendorPaysSetnayan(serviceKey: string | null | undefined): boolean {
  if (!serviceKey) return false;
  const k = serviceKey.trim();
  if (!k) return false;
  if (VENDOR_PAYS_SETNAYAN_SKUS.includes(k)) return true;
  return VENDOR_PAYS_SETNAYAN_PREFIXES.some((p) => k.startsWith(p));
}
