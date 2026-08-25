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

import { Suspense } from 'react';

import { ADMIN_NAV_GROUPS } from '../_components/admin-nav-groups';
import { MobileLandingGrid } from '../_components/mobile-landing-grid';
import { adaptAdminGroupItems } from '../_components/admin-nav-descriptions';
import { requireAdmin } from '@/lib/admin/require-admin';
import { TablePageSkeleton } from '@/components/skeletons';
import { TransactionsLedger } from './_components/transactions-ledger';

export const metadata = { title: 'Money & Settings HQ' };

/**
 * THE MONEY IS ON THE MONEY PAGE NOW — 2026-08-25.
 *
 * This landing used to be links only, under a note apologising that the money
 * queues lived somewhere else. That note is deleted because it is no longer
 * true: the ledger above the grid lists every transaction, and its top strip
 * links to each money queue with its live count. A grid of links CAN now say
 * what is on it, because the thing a person came for is on it.
 *
 * ⚠ requireAdmin() IS LOAD-BEARING AND MUST STAY FIRST. This page was a pure
 * link grid with no reads, so it needed no page-level gate. It now mounts a
 * component that reaches the RLS-bypassing service-role client, and the admin
 * layout alone is NOT a safe auth boundary in front of one (layouts do not
 * re-run on soft navigation or a crafted RSC request) — the same council fix
 * that /admin and /admin/work carry. Removing it leaks the full transaction
 * ledger to any authenticated non-admin.
 */
export default async function AdminMoneyHub() {
  await requireAdmin();

  const items = adaptAdminGroupItems(ADMIN_NAV_GROUPS, 'settings-group');

  return (
    <>
      {/* Streamed: the settings grid below is static and paints immediately,
          so a slow ledger read never holds up the rest of the page. */}
      <Suspense fallback={<TablePageSkeleton />}>
        <TransactionsLedger />
      </Suspense>
      <MobileLandingGrid desktopVisible title="Money & Settings" items={items} />
    </>
  );
}
