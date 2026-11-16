/**
 * /admin/directory — the People tab's dashboard (admin reorg v10, the drawing's `people.py`; owner 17 Nov 2026: *"on
 * people. we can list everyone here already. no problem with that. just add the show and sort filter icon on the right
 * of the search bar"*).
 *
 * It was the retired phone card grid for the Accounts group. It now draws People's head numbers and its group cards
 * (shared `TabLanding`), then the Ask bar with the Show & sort icon on its right, then EVERYONE — the shipped Look up
 * list, mounted unchanged (`merged-view.ts`). The Show choice picks which shipped list answers:
 *   Everyone · People · Suppliers · Events → the Look up page's own tabs (`accounts/page.tsx`)
 *   To verify → the Papers page · Documents → ID documents · Needs my decision → Approvals
 * Nothing is re-read or re-drawn here. The Look up and Papers cards stay as they are until the owner's answer (v10).
 */
import { requireAdmin } from '@/lib/admin/require-admin';
import { TabLanding } from '../_components/tab-landing';
import { AdminAskPill } from '../_components/admin-ask-pill';
import { mountView, type SearchParamsRecord } from '../_components/merged-view';
import { PeopleShowSort, PEOPLE_SHOW } from './_components/people-show-sort';
import AccountsPage from '../accounts/page';
import VerifyPage from '../verify/page';
import VerificationDocsPage from '../verification-docs/page';
import ApprovalsPage from '../approvals/page';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'People · Admin' };

const ACCOUNT_TAB: Record<string, Record<string, string>> = {
  everyone: {},
  people: { tab: 'users', filter: 'customer' },
  suppliers: { tab: 'vendors' },
  events: { tab: 'events' },
};

export default async function AdminPeopleLanding({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await requireAdmin();
  const sp = await searchParams;
  const raw = Array.isArray(sp.show) ? sp.show[0] : sp.show;
  const show = PEOPLE_SHOW.some((o) => o.key === raw) ? raw! : 'everyone';
  const rest = Object.fromEntries(Object.entries(sp).filter(([k]) => k !== 'show'));

  const list =
    show === 'to-verify'
      ? mountView(VerifyPage, rest)
      : show === 'documents'
        ? mountView(VerificationDocsPage, rest)
        : show === 'needs-decision'
          ? mountView(ApprovalsPage, rest)
          : mountView(AccountsPage, { ...rest, ...ACCOUNT_TAB[show] });

  return (
    <>
      <TabLanding tab="people" />
      <div className="mx-auto flex w-full max-w-[1120px] items-center gap-2 px-4 sm:px-6" data-people-askrow="">
        <div className="min-w-0 flex-1">
          <AdminAskPill place="top" />
        </div>
        <PeopleShowSort show={show} />
      </div>
      <div data-people-list={show}>{list}</div>
    </>
  );
}
