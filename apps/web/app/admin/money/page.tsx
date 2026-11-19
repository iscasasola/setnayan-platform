/**
 * /admin/money — the Money hub landing (desktop + mobile).
 *
 * HISTORY: born as a mobile-only overflow landing for the Monetization group
 * (nav tune 2026-06-15), with a hand-maintained card list. That list DRIFTED
 * from the sidebar's Money group (missing Vendor
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

import { requireAdmin } from '@/lib/admin/require-admin';
import { TablePageSkeleton } from '@/components/skeletons';
import { TransactionsLedger } from './_components/transactions-ledger';
import { RevenueSummary } from './_components/revenue-summary';
import ReceiptsPage from '../receipts/page';
import { mountView, type SearchParamsRecord } from '@/app/admin/_components/merged-view';
import { TabLanding } from '@/app/admin/_components/tab-landing';

export const metadata = { title: 'Money · Admin' };

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
/*
 * 💰 MONEY › EVERYTHING (admin drawing 2026-11-13, `money-all` + `money-revenue`).
 * The card grid that sat under the ledger is gone: under the five tabs every one of its cards has a home — the money
 * queues are views in `Money · View ▾`, Receiving accounts · Launch offer · Discount codes · Referrals · Free windows
 * are rows in the Money ⚙, and Pricing · Price bands · Supplier recommendations live under Catalogue
 * (`lib/admin/admin-tabs.ts`; `admin-routes-all-have-a-tab.test.ts` fails if any of them loses its home).
 */
async function AdminMoneyHub() {
  await requireAdmin();

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-10 pt-1 sm:px-6" data-money-everything="">
      {/* Streamed: each section has its own skeleton, so a slow ledger read
          never holds up the revenue figure above it. */}
      {/* M16 — the page called Money now says what has been earned. It was a
          nav landing of cards; the owner could not state revenue without SQL. */}
      <Suspense fallback={<TablePageSkeleton />}>
        <RevenueSummary />
      </Suspense>
      <Suspense fallback={<TablePageSkeleton />}>
        <TransactionsLedger />
      </Suspense>
    </div>
  );
}

/**
 * ➕ ADMIN REORG v7 (owner 17 Nov 2026) — Money: /admin/money is the Money dashboard; Records · Show ▾ is ?view=everything|receipts.
 * Each extra view MOUNTS its old page's body unchanged (`merged-view.ts`); the old address forwards here with
 * `?view=` preselected (`lib/admin/admin-pages.ts`). Every other `?view=` is this page's own, as before.
 */
const MERGED_VIEWS = {
  'receipts': ReceiptsPage,
} as const;

export default async function AdminMergedHost(props: { searchParams?: Promise<SearchParamsRecord> }) {
  const sp: SearchParamsRecord = (await props.searchParams) ?? {};
  const raw = sp.view;
  const key = Array.isArray(raw) ? raw[0] : raw;
  if (key && key in MERGED_VIEWS) return mountView(MERGED_VIEWS[key as keyof typeof MERGED_VIEWS], sp);
  if (key === undefined && Object.keys(sp).length === 0) return <TabLanding tab="money" />;
  return mountView(AdminMoneyHub, sp);
}
