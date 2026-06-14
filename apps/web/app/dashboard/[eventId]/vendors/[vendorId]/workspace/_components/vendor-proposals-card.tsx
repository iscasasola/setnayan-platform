import Link from 'next/link';
import { FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_TONE,
  formatCentavos,
  type ProposalStatus,
} from '@/lib/vendor-proposals';

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
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export async function VendorProposalsCard({
  eventId,
  marketplaceVendorId,
  displayName,
}: {
  eventId: string;
  marketplaceVendorId: string | null;
  displayName: string;
}) {
  if (!marketplaceVendorId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('vendor_proposals')
    .select('proposal_id, public_id, title, status, total_centavos, valid_until, sent_at')
    .eq('event_id', eventId)
    .eq('vendor_profile_id', marketplaceVendorId)
    .order('created_at', { ascending: false });
  if (error) return null; // pre-migration graceful-degrade (42P01)

  const proposals = (data ?? []) as Row[];
  if (proposals.length === 0) return null;

  return (
    <section
      id="proposals"
      aria-labelledby="proposals-heading"
      className="space-y-3 rounded-xl border border-ink/10 bg-cream/60 p-5"
    >
      <header className="flex items-center justify-between gap-3">
        <h2
          id="proposals-heading"
          className="flex items-center gap-2 text-sm font-semibold text-ink"
        >
          <FileText aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          Proposals from {displayName}
        </h2>
      </header>

      <ul className="space-y-2">
        {proposals.map((p) => (
          <li
            key={p.proposal_id}
            className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-cream/80 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/proposals/${p.public_id}`}
                className="block truncate text-sm font-medium text-ink hover:text-terracotta"
              >
                {p.title}
              </Link>
              <p className="text-[10px] text-ink/55">
                {p.sent_at ? `Sent ${fmtDate(p.sent_at)}` : 'Sent'}
                {p.valid_until ? ` · valid until ${fmtDate(p.valid_until)}` : ''}
                {p.total_centavos > 0 ? ` · ${formatCentavos(p.total_centavos)}` : ''}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${PROPOSAL_STATUS_TONE[p.status]}`}
            >
              {p.status === 'sent' ? 'Awaiting your reply' : PROPOSAL_STATUS_LABEL[p.status]}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-ink/45">
        Open a proposal to review, print, accept, or decline. Accepting signals your choice
        — it never charges you.
      </p>
    </section>
  );
}
