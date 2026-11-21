'use client';

/**
 * 📜 TERMS AT ACCEPT — the supplier's terms, on the quote, beside the Accept (Unichat part H2, 20 Nov 2026; drawing
 * `UNICHAT-LIVE-2026-11-19.html`: under the host's Accept, "ⓘ You agree to Lumina's terms").
 *
 * RULE 0: the terms are not a new field. A supplier already writes them on the service card (the first payment's
 * reservation terms — cancellation, non-refundable, refund window, no-show); a quote freezes them when it is sent
 * (`vendor_proposals.rendered_terms`, `lib/proposal-send.ts`), and the full quote page has always drawn that column
 * under "Terms". This line is the same words in the chat. The accept already records who and when
 * (`respond_vendor_proposal` → `resolved_by_user_id`, `resolved_at`) on the row that carries the terms.
 *
 * A quote that states no terms draws nothing. A refused read says it could not load them — an Accept beside terms
 * the reader was never shown is the one thing this line exists to prevent.
 */
import { useCallback, useEffect, useState } from 'react';
import { termsAtAccept } from '@/lib/deal-end';
import { loadQuoteTerms } from './deal-end-calls';
import type { Read } from './card-bits';

type Got = { terms: string; status: string };

export function QuoteTermsLine({ proposalId, supplierName, seed }: { proposalId: string; supplierName: string; seed?: Got }) {
  const [read, setRead] = useState<Read<Got>>(seed ? { at: 'ok', data: seed } : { at: 'loading' });
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void loadQuoteTerms(proposalId).then((r) => setRead(r.ok ? { at: 'ok', data: { terms: r.terms, status: r.status } } : { at: 'failed' }));
  }, [proposalId]);
  useEffect(() => {
    if (!seed) load();
  }, [load, seed]);

  if (read.at === 'loading') return null;
  if (read.at === 'failed') {
    return (
      <p className="mt-2 text-[13px] text-ink/70" role="alert" data-quote-terms="failed">
        Couldn&rsquo;t load {supplierName}&rsquo;s terms.{' '}
        <button type="button" onClick={load} className="sn-press -my-3 inline-flex min-h-11 items-center font-semibold text-sn-accent">
          Try again
        </button>
      </p>
    );
  }
  const said = termsAtAccept({ terms: read.data.terms, supplierName, status: read.data.status });
  if (!said) return null;
  return (
    <details className="group mt-2" data-quote-terms={said.agreed ? 'agreed' : 'open'}>
      {/* The whole line is the press; its reach is 44 px tall through the ::after. */}
      <summary className="sn-press relative flex min-h-7 cursor-pointer list-none items-center gap-1.5 text-[13px] text-ink/70 after:absolute after:inset-x-0 after:-inset-y-2 [&::-webkit-details-marker]:hidden">
        {/* The drawing's `.terms`: ⓘ + the sentence, nothing else. A tap opens the exact words under it. */}
        {/* The house ⓘ, class for class (`<InfoTip>`'s drawn circle — there-is-one-info-dot); the whole line is its press. */}
        <span
          aria-hidden="true"
          className="sn-press-ring relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ink/25 text-[10px] font-semibold leading-none text-ink/55 transition-all duration-sn-control ease-sn before:absolute before:-inset-[15px] before:content-[''] group-hover:border-terracotta group-hover:text-terracotta group-open:border-terracotta group-open:text-terracotta"
        >
          i
        </span>
        <span className="min-w-0 truncate">{said.words}</span>
      </summary>
      <p className="mt-1 whitespace-pre-wrap break-words rounded-md bg-ink/[0.04] px-3 py-2 text-[13px] leading-snug text-ink/80">{read.data.terms}</p>
    </details>
  );
}
