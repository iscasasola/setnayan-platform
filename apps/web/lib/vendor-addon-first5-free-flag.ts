/**
 * vendor-addon-first5-free-flag.ts — the switch for "free until your 6th booking"
 * on the two couple-visibility add-ons (3D Plan Ads + Papic Challenge).
 *
 * Its OWN flag, deliberately separate from `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING`:
 * tiered pricing decides WHAT an add-on costs and WHO may buy it, this decides WHO
 * PAYS NOTHING YET. They ship together at launch but are independent policies, and
 * keeping them apart means the giveaway can be switched off without also reverting
 * the price bands (or the reverse). Matches the one-flag-per-policy convention of
 * `vendor-launch-free-window-flag.ts` / `vendor-free-tier-booking-cap-ui-flag.ts`.
 *
 * NEXT_PUBLIC so the card's price preview and the server's charge agree on one
 * value. Default OFF → the module is inert: the 3D booth keeps its one-time free
 * 28-day cycle and Papic Challenge charges from the first event, exactly as today.
 * Kept out of the decision module so that stays I/O-free and `tsx --test`-friendly.
 */
export function isVendorAddonFirst5FreeEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_VENDOR_ADDON_FIRST5_FREE;
  return v === '1' || v === 'true';
}
