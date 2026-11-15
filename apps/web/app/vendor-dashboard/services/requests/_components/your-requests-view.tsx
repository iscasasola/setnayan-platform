import Link from 'next/link';

import { PageMasthead } from '@/app/_components/page-masthead';
import { ShopEmpty, ShopNotice } from '@/app/vendor-dashboard/_components/kit';
import { SERVICE_REQUEST_NEW_HREF, splitWaitingDecided, unseenDecision } from '@/lib/service-requests';
import type { Loaded, MyRequest, RequestTree } from '@/lib/service-requests.server';
import { DecisionNotice, RequestRowLink } from './request-bits';

/** The page as drawn, from what was read — rendered by the page and, on fixtures, by /dev/service-requests-lab. */
export function YourRequestsView({ mine, tree }: { mine: Loaded<MyRequest[]>; tree: RequestTree | null }) {
  const notice = mine.ok ? unseenDecision(mine.value) : null;
  const { waiting, decided } = mine.ok ? splitWaitingDecided(mine.value) : { waiting: [], decided: [] };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10" data-your-requests="">
      <PageMasthead title="Your requests" />
      <p className="mb-4 max-w-prose text-sm text-ink/65">
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
