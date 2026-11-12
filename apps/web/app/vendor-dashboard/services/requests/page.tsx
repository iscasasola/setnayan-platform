import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ShopEmpty, ShopNotice } from '@/app/vendor-dashboard/_components/kit';
import { SERVICE_REQUEST_NEW_HREF, splitWaitingDecided, unseenDecision } from '@/lib/service-requests';
import { loadMyRequests, loadRequestTree } from '@/lib/service-requests.server';
import { DecisionNotice, RequestRowLink } from './_components/request-bits';

export const metadata = { title: 'Your requests · Supplier' };

/**
 * /vendor-dashboard/services/requests — "Your requests" (owner rulings 2026-11-13, ruling 4).
 *
 * What the shop asked us to add and what we did with it: Waiting first, then Decided, in the
 * owner's words (Waiting · Added as a new service · Moved to "…" · Kept just for your shop · Not
 * added). A row opens its detail. Extends the shipped inline list under the old "Tell us what you
 * do" form (services-manager.tsx) into a page of its own.
 *
 * 🔑 A refused read says so — "Couldn't load your requests" — and never draws "No requests yet".
 */
export default async function YourRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const [mine, tree] = await Promise.all([loadMyRequests(supabase, profile.vendor_profile_id), loadRequestTree()]);
  const notice = mine.ok ? unseenDecision(mine.value) : null;
  const { waiting, decided } = mine.ok ? splitWaitingDecided(mine.value) : { waiting: [], decided: [] };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10" data-your-requests="">
      <PageMasthead title="Your requests" />
      <p className="-mt-2 mb-4 max-w-prose text-sm text-ink/65">
        What you asked us to add, and what we did with it. Your cards move by themselves when we decide.
      </p>
      {notice ? (
        <div className="mb-4">
          <DecisionNotice r={notice} tree={tree} />
        </div>
      ) : null}

      {!mine.ok ? (
        <ShopNotice tone="danger" role="alert">
          <strong>Couldn&rsquo;t load your requests.</strong> Every request you sent is still with us and still being
          reviewed — it is not shown here right now.{' '}
          <Link href="/vendor-dashboard/services/requests" className="font-semibold underline underline-offset-2">
            Try again
          </Link>
        </ShopNotice>
      ) : mine.value.length === 0 ? (
        <ShopEmpty>
          <p className="font-medium text-ink/75">No requests yet.</p>
          <p className="mt-1">When you can&rsquo;t find your service, tell us what you do and it shows here.</p>
        </ShopEmpty>
      ) : (
        <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl bg-white shadow-sm">
          {waiting.length ? (
            <li className="bg-ink/[0.03] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/60">Waiting</li>
          ) : null}
          {waiting.map((r) => (
            <RequestRowLink key={r.request_id} r={r} tree={tree} />
          ))}
          {decided.length ? (
            <li className="bg-ink/[0.03] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/60">Decided</li>
          ) : null}
          {decided.map((r) => (
            <RequestRowLink key={r.request_id} r={r} tree={tree} />
          ))}
        </ul>
      )}

      <div className="mt-5">
        <Link
          href={SERVICE_REQUEST_NEW_HREF}
          className="inline-flex min-h-11 items-center rounded-full border border-terracotta px-5 text-sm font-semibold text-terracotta-700"
        >
          ＋ Request another service
        </Link>
      </div>
    </div>
  );
}
