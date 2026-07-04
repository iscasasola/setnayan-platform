/**
 * /admin/directory — mobile overflow landing for the Accounts group.
 *
 * OWNER DIRECTIVE 2026-07-04: mobile menus mirror the desktop sidebar. This
 * Accounts landing DERIVES its cards from the 'directory' group of the
 * canonical ADMIN_NAV_GROUPS (admin-sidebar.tsx) — no hand-mirrored item list.
 * Every NavItem here maps 1:1 to the desktop Accounts group by construction.
 *
 * SCOPE: server component, hidden at lg+ via lg:hidden — desktop reaches these
 * through the sidebar's Accounts group directly.
 */

import { ADMIN_NAV_GROUPS } from '../_components/admin-sidebar';
import { MobileLandingGrid } from '../_components/mobile-landing-grid';
import { adaptAdminGroupItems } from '../_components/admin-nav-descriptions';

export const metadata = { title: 'Accounts · Admin' };

export default function AdminDirectoryLanding() {
  const items = adaptAdminGroupItems(ADMIN_NAV_GROUPS, 'directory');

  return (
    <MobileLandingGrid
      title="Accounts"
      subtitle="People and places on the platform. Search users, vendors, events, and venues."
      items={items}
    />
  );
}
