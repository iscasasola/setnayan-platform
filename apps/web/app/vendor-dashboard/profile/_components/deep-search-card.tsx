import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { SharePdfButton } from '@/app/_components/share-pdf-button';
import { formatCount } from '@/lib/format-number';
import { routes } from '@/lib/routes';
import {
  DEEP_SEARCH_FINDINGS,
  DEEP_SEARCH_KEEP_DAYS,
  deepSearchAllowanceWords,
  deepSearchCounts,
  deepSearchPdfFileName,
  deepSearchPdfHref,
  deepSearchStillKept,
} from '@/lib/deep-search-findings';
import type { DeepSearchOffer, LastDeepSearch } from '@/lib/vendor-deep-search-offer';
import { DeepSearchRunner } from '../../deep-search/_components/deep-search-runner';
import { GetVerifiedLine } from '../../_components/get-verified-line';

/** The fold's one line. */
export function deepSearchFoldLine(last: LastDeepSearch): string {
  if (!last.measured) return 'Your last search couldn’t be read just now';
  if (!last.last) return 'Not run yet';
  const when = shortDate(last.last.usedAt);
  switch (last.last.status) {
    case 'complete':
      return `Last search ${when}`;
    case 'running':
      return `Searching since ${when}`;
    case 'failed':
      return `Last search ${when} didn’t finish`;
    case 'expired':
      return `Last search ${when} · no longer kept`;
  }
}

const countWords = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });

/**
 * 🔎 SHOP › DETAILS › DEEP SEARCH — "See what the web says about your shop" (owner 2026-10-29, Supplier dashboard v13
 * note 2: *explained, not "fill in my details"*). The body of the Deep Search fold on Your details.
 *
 *   · WHAT IT GIVES — the five findings, in the order the result and its PDF use (`DEEP_SEARCH_FINDINGS`);
 *   · WHAT THE PLAN INCLUDES — in the ⓘ, built from the admin's monthly number (`deepSearchAllowanceWords` over
 *     `loadDeepSearchOffer`'s allowance), never typed and never a price: Deep Search is not sold (owner 2026-11-22,
 *     DECISION_LOG ✂️ "DEEP SEARCH IS RETIRED" + 🔎 "1 RUN A MONTH"). The runner below states THIS shop's searches left
 *     — or, on Free and Verified, "Included in Plus · Upgrade" — exactly as `/vendor-dashboard/deep-search` does: it IS
 *     that page's runner (`DeepSearchRunner`), mounted;
 *   · UNVERIFIED — the shared `GetVerifiedLine` instead of a runner that can only refuse (owner note 4: "the same line
 *     wherever being unverified blocks");
 *   · THE LAST SEARCH — when it ran, what it found, and its PDF (owner, with the approval: *"run search would also create
 *     a pdf file of the search created"*) through the shared Share button, while the search is kept
 *     (`DEEP_SEARCH_KEEP_DAYS`). A read that failed says so — never "not run yet".
 *
 * Server-safe (no hooks); the runner, the Share button and the Get-verified line are client parts.
 */
export function DeepSearchCard({
  offer,
  last,
  businessName,
}: {
  offer: DeepSearchOffer;
  last: LastDeepSearch;
  businessName: string;
}) {
  const kept = last.measured && last.last?.status === 'complete' && last.last.dossier && last.last.dossierId != null && last.last.createdAt
    ? deepSearchStillKept(last.last.createdAt, Date.now())
    : false;
  const found = kept && last.measured && last.last?.dossier ? deepSearchCounts(last.last.dossier) : null;

  return (
    <div className="space-y-3 pb-4" data-deep-search-card="">
      <p className="text-base font-semibold leading-snug text-ink" data-deep-search-title="">
        See what the web says about your shop
      </p>
      <InfoTip
        label={`We search the web for ${businessName} — never other shops — and show you what we found.`}
        labelNode={
          <>
            We search the web for <b className="font-semibold text-ink">{businessName}</b> — never other shops — and show you what we found.
          </>
        }
        labelAs="p"
        labelClassName="text-sm text-[color:var(--m-slate-2)]"
        align="start"
      >
        Nothing on your page changes on its own: you choose what to use.
      </InfoTip>

      <ul className="divide-y divide-[color:var(--m-line)]" data-deep-search-findings="">
        {DEEP_SEARCH_FINDINGS.map((f) => (
          <li key={f.key} className="flex min-h-14 items-center justify-between gap-3 py-2">
            <span className="text-base font-semibold text-ink">{f.title}</span>
            <span className="text-right text-sm text-[color:var(--m-slate-2)]">{f.line}</span>
          </li>
        ))}
      </ul>

      <InfoTip label="What your plan includes" labelAs="p" labelClassName="text-sm text-[color:var(--m-slate-2)]" align="start">
        {offer.allowance.read ? deepSearchAllowanceWords(offer.allowance.perMonth) : deepSearchAllowanceWords(null)} Each
        search is kept {DEEP_SEARCH_KEEP_DAYS} days with its PDF, then deleted.
      </InfoTip>

      {offer.verified || !offer.included ? (
        <DeepSearchRunner verified={offer.verified} included={offer.included} allowance={offer.allowance} />
      ) : (
        <GetVerifiedLine title="Deep Search is for verified shops" line="You can run it once you’re verified" data="deep-search" />
      )}

      <div className="divide-y divide-[color:var(--m-line)] border-t border-[color:var(--m-line)]" data-deep-search-last="">
        <div className="flex min-h-14 flex-wrap items-center gap-3 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold leading-snug text-ink">{deepSearchFoldLine(last)}</span>
            {found ? (
              <span className="mt-0.5 block text-sm tabular-nums text-[color:var(--m-slate-2)]">
                {[
                  countWords(found.services, 'service', 'services'),
                  countWords(found.prices, 'price', 'prices'),
                  countWords(found.presence, 'place', 'places'),
                  `${formatCount(found.flags)} to double-check`,
                ].join(' · ')}
              </span>
            ) : null}
          </span>
          {kept && last.measured && last.last?.dossierId != null ? (
            <SharePdfButton
              href={deepSearchPdfHref(last.last.dossierId)}
              fileName={deepSearchPdfFileName(last.last.createdAt)}
              name="Share your last Deep Search (PDF)"
              papers="document"
            />
          ) : null}
        </div>
        {last.measured && last.last ? (
          <Link href={routes.vendorDashboard.deepSearch()} className="sn-press flex min-h-14 items-center gap-3 py-2.5" data-deep-search-all="">
            <span className="flex-1 text-base font-semibold text-ink">All your Deep Searches</span>
            <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
