import Link from 'next/link';
import { FileText, ChevronRight } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_TONE,
  formatCentavos,
  type ProposalLineItem,
  type ProposalStatus,
} from '@/lib/vendor-proposals';
import { isAcceptableStatus, selectCurrentQuote } from '@/lib/thread-quotations';

/**
 * Pinned "current quote" + quotation bookmark list for a couple↔vendor thread.
 *
 * SURFACING layer only — reads `vendor_proposals` under the couple's own RLS
 * (status <> 'draft'), never writes. The newest proposal is pinned at the top
 * of the thread as the current quote (amount + inclusions + the accept CTA);
 * older proposals stay listed below as an audit trail (never hidden). Accepting
 * happens on the shared `/proposals/[publicId]` detail page — reused verbatim,
 * so the booking-fee-base accuracy and the accept RPC stay in one place.
 *
 * Graceful-degrade: renders nothing pre-migration (table absent → 42P01) or
 * when the vendor has sent no proposals on this thread.
 */

type Row = {
  proposal_id: string;
  public_id: string;
  title: string;
  status: ProposalStatus;
  total_centavos: number;
  line_items: ProposalLineItem[] | null;
  valid_until: string | null;
  sent_at: string | null;
  created_at: string;
};

const MAX_PINNED_INCLUSIONS = 5;

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export async function ThreadQuotationsCard({
  supabase,
  eventId,
  vendorProfileId,
  vendorLabel,
}: {
  supabase: SupabaseClient;
  eventId: string;
  vendorProfileId: string;
  vendorLabel: string;
}) {
  const { data, error } = await supabase
    .from('vendor_proposals')
    .select(
      'proposal_id, public_id, title, status, total_centavos, line_items, valid_until, sent_at, created_at',
    )
    .eq('event_id', eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: false });
  if (error) return null; // pre-migration graceful-degrade (42P01)

  const split = selectCurrentQuote((data ?? []) as Row[]);
  if (!split) return null;

  const { current, older } = split;
  const inclusions = (current.line_items ?? []).filter((li) => li.label?.trim());
  const shown = inclusions.slice(0, MAX_PINNED_INCLUSIONS);
  const hiddenCount = inclusions.length - shown.length;
  const canAccept = isAcceptableStatus(current.status);

  return (
    <section
      aria-labelledby="current-quote-heading"
      className="space-y-3 rounded-xl border border-terracotta/25 bg-cream/70 p-4"
    >
      <header className="flex items-center justify-between gap-3">
        <h2
          id="current-quote-heading"
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink/70"
        >
          <FileText aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          Current quote
        </h2>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${PROPOSAL_STATUS_TONE[current.status]}`}
        >
          {current.status === 'sent'
            ? 'Awaiting your reply'
            : PROPOSAL_STATUS_LABEL[current.status]}
        </span>
      </header>

      {/* Pinned latest quote — amount + inclusions + accept action. */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-semibold text-ink">{current.title}</p>
          {current.total_centavos > 0 ? (
            <span className="shrink-0 text-base font-semibold tabular-nums text-ink">
              {formatCentavos(current.total_centavos)}
            </span>
          ) : (
            <span className="shrink-0 text-xs text-ink/55">Price on request</span>
          )}
        </div>

        {shown.length > 0 ? (
          <ul className="space-y-1 text-xs text-ink/70">
            {shown.map((li, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  {li.label}
                  {li.detail ? <span className="text-ink/45"> · {li.detail}</span> : null}
                </span>
                {li.amount_centavos ? (
                  <span className="shrink-0 tabular-nums text-ink/55">
                    {formatCentavos(li.amount_centavos)}
                  </span>
                ) : null}
              </li>
            ))}
            {hiddenCount > 0 ? (
              <li className="text-[11px] text-ink/45">
                + {hiddenCount} more {hiddenCount === 1 ? 'item' : 'items'} in the full quote
              </li>
            ) : null}
          </ul>
        ) : null}

        <p className="text-[11px] text-ink/45">
          {current.sent_at ? `Sent ${fmtDate(current.sent_at)}` : 'Sent'}
          {current.valid_until ? ` · valid until ${fmtDate(current.valid_until)}` : ''}
        </p>

        <Link
          href={`/proposals/${current.public_id}`}
          className={
            canAccept
              ? 'inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream hover:bg-mulberry-600'
              : 'inline-flex h-9 items-center text-xs font-medium text-terracotta hover:underline'
          }
        >
          {canAccept ? 'Review & accept' : 'View quote'}
        </Link>
      </div>

      {/* Audit trail — older quotes never hidden. */}
      {older.length > 0 ? (
        <details className="border-t border-ink/10 pt-3">
          <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 hover:text-ink/70">
            Earlier quotes ({older.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {older.map((p) => (
              <li key={p.proposal_id}>
                <Link
                  href={`/proposals/${p.public_id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-cream/80 px-3 py-2 hover:border-terracotta/30"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink">
                      {p.title}
                    </span>
                    <span className="text-[10px] text-ink/50">
                      {p.sent_at ? `Sent ${fmtDate(p.sent_at)}` : 'Sent'}
                      {p.total_centavos > 0 ? ` · ${formatCentavos(p.total_centavos)}` : ''}
                      {' · '}
                      {PROPOSAL_STATUS_LABEL[p.status]}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-ink/30"
                    strokeWidth={1.75}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="sr-only">
        Quotes from {vendorLabel}. The newest is your current quote; earlier ones stay for
        your records.
      </p>
    </section>
  );
}
