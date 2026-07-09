/**
 * /admin/ugat — the Ugat Console hub landing (6-menu respine 2026-07-09).
 *
 * WHY: the owner's "integrate different pages, make it up to 6 menus only"
 * directive collapses the desktop sidebar to six menu rows, each landing on
 * one integrated surface. Ugat Console (the data-structure / mapping wing
 * carved out of System Settings on 2026-07-04) had no landing of its own —
 * its five pages were reachable only as always-visible sidebar links. This
 * hub is that landing: one card per Ugat surface, desktop AND mobile.
 *
 * Items derive from the canonical ADMIN_NAV_GROUPS 'ugat' group + the shared
 * descriptions map — no hand-maintained duplicate list, so the hub can never
 * drift from the sidebar per [[feedback_setnayan_orphan_prevention]].
 */

import { ADMIN_NAV_GROUPS } from '../_components/admin-sidebar';
import { MobileLandingGrid } from '../_components/mobile-landing-grid';
import { adaptAdminGroupItems } from '../_components/admin-nav-descriptions';

export const metadata = { title: 'Ugat Console · Setnayan HQ' };

export default function AdminUgatHub() {
  const items = adaptAdminGroupItems(ADMIN_NAV_GROUPS, 'ugat');

  return (
    <MobileLandingGrid
      desktopVisible
      title="Ugat Console"
      subtitle="The platform's roots — taxonomy, menus and icons, onboarding flows, wedding traditions, and the Setnayan AI brain."
      items={items}
    />
  );
}
