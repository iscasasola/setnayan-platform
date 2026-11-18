import { Plus } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { PageMasthead } from '@/app/_components/page-masthead';
import { TemplateEmpty, TemplateFail, TemplateSection } from '@/app/_components/template-rows';
import { SERVICE_REQUEST_NEW_HREF, splitWaitingDecided, unseenDecision } from '@/lib/service-requests';
import type { Loaded, MyRequest, RequestTree } from '@/lib/service-requests.server';
import { DecisionNotice, RequestRowLink } from './request-bits';

/** The page as drawn, from what was read — rendered by the page and, on fixtures, by /dev/service-requests-lab. */
export function YourRequestsView({ mine, tree }: { mine: Loaded<MyRequest[]>; tree: RequestTree | null }) {
  const notice = mine.ok ? unseenDecision(mine.value) : null;
  const { waiting, decided } = mine.ok ? splitWaitingDecided(mine.value) : { waiting: [], decided: [] };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-2 px-4 py-4 sm:px-6" data-your-requests="">
      <PageMasthead title="Your requests" />
      {notice ? <DecisionNotice r={notice} tree={tree} /> : null}

      {!mine.ok ? (
        <TemplateFail data="your-requests" retryHref="/vendor-dashboard/services/requests">
          <strong>Couldn&rsquo;t load your requests.</strong> Every request you sent is still with us and still being
          reviewed — it is not shown here right now.
        </TemplateFail>
      ) : mine.value.length === 0 ? (
        <TemplateSection
          label="Your requests"
          first
          tip="What you asked us to add, and what we did with it. Your cards move by themselves when we decide."
        >
          <TemplateEmpty data="your-requests">
            No requests yet. When you can&rsquo;t find your service, tell us what you do and it shows here.
          </TemplateEmpty>
        </TemplateSection>
      ) : (
        <>
          {waiting.length ? (
            <TemplateSection
              label="Waiting"
              first
              tip="What you asked us to add, and what we did with it. Your cards move by themselves when we decide."
            >
              <ul className="[&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
                {waiting.map((r) => (
                  <RequestRowLink key={r.request_id} r={r} tree={tree} />
                ))}
              </ul>
            </TemplateSection>
          ) : null}
          {decided.length ? (
            <TemplateSection
              label="Decided"
              first={!waiting.length}
              tip={
                waiting.length
                  ? undefined
                  : 'What you asked us to add, and what we did with it. Your cards move by themselves when we decide.'
              }
            >
              <ul className="[&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
                {decided.map((r) => (
                  <RequestRowLink key={r.request_id} r={r} tree={tree} />
                ))}
              </ul>
            </TemplateSection>
          ) : null}
        </>
      )}

      <div className="pt-3">
        <ActionButton
          tone="brand"
          main
          icon={<Plus aria-hidden />}
          label="Request another service"
          href={SERVICE_REQUEST_NEW_HREF}
        />
      </div>
    </div>
  );
}
