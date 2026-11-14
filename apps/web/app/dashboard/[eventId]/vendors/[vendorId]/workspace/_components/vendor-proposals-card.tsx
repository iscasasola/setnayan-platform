import type { ReactNode } from 'react';
import Link from 'next/link';
import { ReadRefusedNotice } from '@/app/dashboard/[eventId]/_components/read-refused-notice';
import { isMissingRelationError, logQueryError } from '@/lib/supabase/error-detect';
import { ChevronRight, FileText } from 'lucide-react';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import { createClient } from '@/lib/supabase/server';
import {
  PROPOSAL_STATUS_LABEL,
  formatCentavos,
  type ProposalStatus,
} from '@/lib/vendor-proposals';
import { formatCalendarDate } from '@/lib/events';

/**
 * Proposals from this vendor — couple side of data-link program ③ (corpus
 * 03_Strategy/Vendor_Portal_Event_Data_Link_2026-06-13.md § 3.5).
 *
 * Self-contained server component: queries under the couple's own RLS
 * (sent+ rows only — drafts never cross), renders compact rows linking to
 * the shared /proposals/[publicId] detail page where Accept / Decline live.
 * Graceful-degrade: renders nothing if the table isn't deployed yet.
 */

type Row = {
  proposal_id: string;
  public_id: string;
  title: string;
  status: ProposalStatus;
  total_centavos: number;
  valid_until: string | null;
  sent_at: string | null;
};

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  // A DATE column — the day it names must not move with the reader.
  return formatCalendarDate(iso, { year: 'numeric', month: 'short', day: 'numeric' });
}

export async function VendorProposalsCard({
  eventId,
  marketplaceVendorId,
  displayName,
  whenEmpty = null,
}: {
  eventId: string;
  marketplaceVendorId: string | null;
  displayName: string;
  /**
   * 🫙 What a page with no quotation says instead of nothing (owner 11 Nov 2026, the picked supplier's Quotation tab
   * "renders BLANK"): the picked page hands its one honest line + its one action; the flag-off long page hands none.
   */
  whenEmpty?: ReactNode;
}) {
  if (!marketplaceVendorId) return whenEmpty;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vendor_proposals')
    .select('proposal_id, public_id, title, status, total_centavos, valid_until, sent_at')
    .eq('event_id', eventId)
    .eq('vendor_profile_id', marketplaceVendorId)
    .order('created_at', { ascending: false });
  // ⚠ THE COMMENT NAMED ONE CAUSE; THE CODE SWALLOWED EVERY CAUSE. A table that
  // ⚠ does not exist yet is a fair reason to render nothing quietly. A refusal
  // ⚠ is not — and this card disappearing is how the quotations on this booking — go missing from the page that lists them.
  // ⚠ The predicate it meant to use already lived one file away.
  if (error) {
    if (isMissingRelationError(error)) return whenEmpty;
    logQueryError('VendorProposalsCard.proposals', error, { event_id: eventId }, 'graceful_degrade');
    return <ReadRefusedNotice what="the quotations on this booking" />;
  }

  const proposals = (data ?? []) as Row[];
  if (proposals.length === 0) return whenEmpty;

  // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 5 · 7 · 13 · 14): no card — the section's grey capitals, then one
  // plain row per quote: the whole row opens it (terracotta ›), the money bold on the right, the status a soft chip
  // with no border. "Accepting never charges you" sits behind the ⓘ on the label.
  return (
    <section id="proposals" aria-labelledby="proposals-heading">
      <h2 id="proposals-heading" className="mb-1 mt-[18px] flex items-center gap-2">
        <FileText aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        <InfoTip
          label={`Quotes from ${displayName}`}
          labelAs="span"
          labelClassName="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70"
          align="start"
        >
          Open a quote to review, print, accept, or decline. Accepting signals your choice — it never charges you.
        </InfoTip>
      </h2>

      <ul className="divide-y divide-ink/10">
        {proposals.map((p) => (
          <li key={p.proposal_id}>
            <Link
              href={`/proposals/${p.public_id}`}
              className="flex min-h-14 items-center justify-between gap-3 py-2.5 text-ink"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{p.title}</span>
                <span className="block text-[13px] text-ink/70">
                  {p.sent_at ? `Sent ${fmtDate(p.sent_at)}` : 'Sent'}
                  {p.valid_until ? ` · valid until ${fmtDate(p.valid_until)}` : ''}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                {p.total_centavos > 0 ? (
                  <span className="text-[15px] font-bold tabular-nums">{formatCentavos(p.total_centavos)}</span>
                ) : null}
                <Badge tone={PROPOSAL_BADGE_TONE[p.status]}>
                  {p.status === 'sent' ? 'Awaiting your reply' : PROPOSAL_STATUS_LABEL[p.status]}
                </Badge>
              </span>
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={1.75} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The quote's state as the shared chip's tone — green done · amber waiting · red refused · grey nothing live. */
const PROPOSAL_BADGE_TONE: Record<ProposalStatus, BadgeTone> = {
  draft: 'quiet',
  sent: 'wait',
  viewed: 'wait',
  accepted: 'ok',
  declined: 'no',
  expired: 'quiet',
  superseded: 'quiet',
};
