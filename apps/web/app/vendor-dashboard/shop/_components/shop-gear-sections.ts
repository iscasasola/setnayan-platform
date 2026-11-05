/**
 * 🏪 THE SHOP ⚙'S FOLDS, in order (owner 2026-10-31, *"Yes follow your recommendation"* — DECISION_LOG "SHOP ⚙ — WHAT A
 * SUPPLIER SETS ONCE"). Each key is the fold's `#anchor`, so an old link (`/vendor-dashboard/profile#docs`) opens the
 * sheet on it. A plain module so the server body, the client door and the guard read ONE list.
 *
 * ⏳ The fifth, SHOP STATUS (open or pause bookings, transfer or close the shop), is not here: measured 2026-10-31 there is
 * no shop-wide pause (Customers › Dates' "Open for bookings" is ONE day), and no supplier-side transfer or close (only
 * Admin › Vendors and the invite claim write those). A row that saves nothing is not drawn — it waits on its build.
 */
export const SHOP_GEAR_SECTIONS = ['plan', 'team', 'docs', 'notifications'] as const;
export type ShopGearSection = (typeof SHOP_GEAR_SECTIONS)[number];

export const SHOP_GEAR_TITLE: Readonly<Record<ShopGearSection, string>> = {
  plan: 'Plan and billing',
  team: 'Team',
  docs: 'Verification and documents',
  notifications: 'Notifications',
};
