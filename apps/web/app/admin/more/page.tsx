/**
 * /admin/more — admin mobile "full menu" overflow landing.
 *
 * OWNER DIRECTIVE 2026-07-04: "Make both similar menu, different orientation,
 * but the content of menu should be the same on desktop and mobile." This
 * landing is the COMPLETE mobile menu — it renders EVERY group + item from the
 * desktop sidebar's canonical ADMIN_NAV_GROUPS (admin-sidebar.tsx), in mobile
 * card orientation. All 6 menus — Overview · Accounts · Studio · Ugat Console ·
 * App Performance · Money — with identical labels, items, hrefs, and icons.
 *
 * NO hand-maintained duplicate item lists live here anymore: the old
 * "Content / System Settings" hardcoded sections (which had drifted from the
 * desktop IA) are gone. Groups + items flow through adaptAdminGroupsToLanding;
 * per-item copy comes from the separate ADMIN_NAV_DESCRIPTIONS map so the nav
 * array stays lean. This is the vendor doorway's pattern (vendor-dashboard/more
 * → VENDOR_NAV_GROUPS) applied to admin.
 *
 * SCOPE: server component, hidden at lg+ via lg:hidden inside MobileLandingGrid
 * — desktop reaches these through the sidebar groups directly.
 */

import { ADMIN_NAV_GROUPS } from '../_components/admin-nav-groups';
import { MobileLandingGrid } from '../_components/mobile-landing-grid';
import { adaptAdminGroupsToLanding } from '../_components/admin-nav-descriptions';

export const metadata = { title: 'Menu · Admin' };

export default function AdminMoreLanding() {
  // Single source of truth: the desktop 6-menu IA, adapted to mobile cards.
  const groups = adaptAdminGroupsToLanding(ADMIN_NAV_GROUPS);

  return (
    <MobileLandingGrid
      title="Menu"
      subtitle="Every admin surface, one tap away — the same six menus you see on desktop."
      searchable
      groups={groups}
    />
  );
}
