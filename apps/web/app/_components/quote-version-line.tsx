'use client';

import { QuoteVersionsRow } from './quote-versions-sheet';
import { QuoteVersionsCompareDoor } from './quote-versions-compare';
import { orderQuoteVersions, versionDay, versionsNewestFirst, versionsOldestFirst, type QuoteVersionRow } from '@/lib/quote-versions';
import { PROPOSAL_STATUS_LABEL, type ProposalStatus } from '@/lib/vendor-proposals';

/**
 * THE QUOTATION PAGE'S FIRST LINE (THE ONE BUILD, v113): "v2 · Accepted · 10 Oct · What changed ›".
 *
 * Moved, not invented: the version number, its day and "What changed ›" are the stream's own — `orderQuoteVersions` +
 * `versionDay` (lib/quote-versions.ts) and the shipped `QuoteVersionsRow` sheet the quote card in the chat opens. The
 * status word is the app's (`PROPOSAL_STATUS_LABEL`). No quote sent yet → nothing (the builder below starts a first one).
 * `rows` NULL = unread — said as such, never as "no quote".
 * PR-4 (owner 12 Nov): "Side by side" beside it — the two-picker comparison (`quote-versions-compare.tsx`).
 */
export function QuoteVersionLine({
  rows,
  counterpartyLabel,
}: {
  rows: readonly QuoteVersionRow[] | null;
  counterpartyLabel: string;
}) {
  if (rows === null) {
    return (
      <p className="px-4 py-2 text-xs text-ink/55" role="status" data-quote-version-line="unread">
        Couldn&rsquo;t load this quote&rsquo;s versions just now.
      </p>
    );
  }
  const versions = orderQuoteVersions(rows);
  const latest = versions.reduce<(typeof versions)[number] | null>(
    (best, v) => (!best || v.at > best.at ? v : best),
    null,
  );
  if (!latest) return null;
  const chain = versionsNewestFirst(versions, latest.proposalId);
  const status = PROPOSAL_STATUS_LABEL[latest.status as ProposalStatus] ?? latest.status;
  return (
    <div className="flex flex-wrap items-center gap-x-2 px-4 py-2 text-sm text-ink/70" data-quote-version-line="">
      <span>
        v{latest.version} · {status} · {versionDay(latest.at)}
      </span>
      <QuoteVersionsRow versions={chain} counterpartyLabel={counterpartyLabel} />
      <QuoteVersionsCompareDoor versions={versionsOldestFirst(versions, latest.proposalId)} />
    </div>
  );
}
