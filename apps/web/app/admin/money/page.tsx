/**
 * /admin/money — the Money hub landing (desktop + mobile).
 *
 * HISTORY: born as a mobile-only overflow landing for the Monetization group
 * (nav tune 2026-06-15), with a hand-maintained card list. That list DRIFTED
 * from the sidebar's Money group (missing Custom plans · Vendor
 * recommendations · Price bands · Compliance and the settings tail; still
 * listing Discount codes, which moved to Studio 2026-07-04) — exactly the
 * drift the /admin/more parity pass eliminated by deriving from
 * ADMIN_NAV_GROUPS.
 *
 * 6-MENU RESPINE 2026-07-09 (owner: "integrate different pages, make it up
 * to 6 menus only"): this landing is now the integrated surface the desktop
 * sidebar's Money menu lands on, so it renders on desktop too and derives its
 * cards from the canonical 'settings-group' group + shared descriptions map —
 * the same single-source pattern as /admin/more and /admin/ugat. The mobile
 * bottom-nav Money tab keeps landing here unchanged.
 */

import { ADMIN_NAV_GROUPS } from '../_components/admin-nav-groups';
import { MobileLandingGrid } from '../_components/mobile-landing-grid';
import { adaptAdminGroupItems } from '../_components/admin-nav-descriptions';

export const metadata = { title: 'Money · Setnayan HQ' };

export default function AdminMoneyHub() {
  const items = adaptAdminGroupItems(ADMIN_NAV_GROUPS, 'settings-group');

  return (
    <MobileLandingGrid
      desktopVisible
      title="Money"
      subtitle="Pricing, catalog, and payout config — plus platform settings. The act-now money queues (Payments · Payouts · Token sales) live in Overview."
      items={items}
    />
  );
}
