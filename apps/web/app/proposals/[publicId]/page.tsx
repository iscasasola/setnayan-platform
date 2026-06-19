import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Send, Trash2, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { PrintButton } from '@/components/print-button';
import {
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_TONE,
  formatCentavos,
  type ProposalLineItem,
  type ProposalStatus,
} from '@/lib/vendor-proposals';
import {
  deleteDraftProposal,
  respondToProposal,
  sendProposal,
} from '@/app/vendor-dashboard/proposals/actions';

export const metadata = { title: 'Proposal · Setnayan' };

/**
 * Shared proposal detail + print view — data-link program ③ (corpus
 * 03_Strategy/Vendor_Portal_Event_Data_Link_2026-06-13.md § 3.5).
 *
 * ONE page for both parties; RLS decides who gets in (vendor org sees its
 * own rows incl. drafts; couple/delegates see sent+ rows on their events).
 * The vendor side gets Send/Delete on drafts; the couple side gets
 * Accept/Decline on sent proposals. Print is plain @media-print CSS — same
 * zero-dependency pattern as the seat-plan print pack.
 *
 * Accepting is a SIGNAL, not a booking or a payment — money stays
 * off-platform, and the footer says so (standing payment disclosure).
 */

type ProposalRow = {
  proposal_id: string;
  public_id: string;
  vendor_profile_id: string;
  event_id: string;
  title: string;
  merge_snapshot: {
    values?: Record<string, string | null>;
    confirmed_guests?: number;
    resolved_at?: string;
  };
  rendered_body: string;
  rendered_terms: string;
  line_items: ProposalLineItem[];
  total_centavos: number;
  status: ProposalStatus;
  valid_until: string | null;
  sent_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

type Props = {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ notice?: string }>;
};

export default async function ProposalDetailPage({ params, searchParams }: Props) {
  const { publicId } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS is the gate: vendor org OR couple/delegate (non-draft) — anyone else
  // sees nothing and gets a 404.
  const { data } = await supabase
    .from('vendor_proposals')
    .select(
      'proposal_id, public_id, vendor_profile_id, event_id, title, merge_snapshot, rendered_body, rendered_terms, line_items, total_centavos, status, valid_until, sent_at, resolved_at, created_at',
    )
    .eq('public_id', publicId)
    .maybeSingle();
  if (!data) notFound();
  const proposal = data as ProposalRow;

  // Which side is looking? Org membership decides.
  const ownProfile = await fetchOwnVendorProfile(supabase, user.id);
  const isVendorSide = ownProfile?.vendor_profile_id === proposal.vendor_profile_id;

  // Letterhead — vendor business identity (falls back to the frozen snapshot).
  const { data: vendorProfile } = await supabase
    .from('vendor_profiles')
    .select('business_name, logo_url, city')
    .eq('vendor_profile_id', proposal.vendor_profile_id)
    .maybeSingle();
  const businessName =
    vendorProfile?.business_name ??
    proposal.merge_snapshot.values?.business_name ??
    'Your vendor';

  const snapshotAt = fmtDate(proposal.merge_snapshot.resolved_at ?? proposal.created_at);
  const confirmed = proposal.merge_snapshot.confirmed_guests;
  const lineItems = proposal.line_items ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6 print:max-w-none print:space-y-4 print:py-2">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={
            isVendorSide
              ? '/vendor-dashboard/proposals'
              : `/dashboard/${proposal.event_id}/vendors`
          }
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PROPOSAL_STATUS_TONE[proposal.status]}`}
          >
            {PROPOSAL_STATUS_LABEL[proposal.status]}
          </span>
          <PrintButton label="Print" />
        </div>
      </div>

      {search.notice === 'send_failed' || search.notice === 'respond_failed' ? (
        <p role="alert" className="rounded-lg bg-warn-50 px-3 py-2 text-sm text-warn-900 print:hidden">
          That didn&rsquo;t go through — refresh and try again.
        </p>
      ) : null}

      {/* Letterhead */}
      <header className="border-b border-ink/15 pb-4">
        <div className="flex items-center gap-3">
          {vendorProfile?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vendorProfile.logo_url}
              alt=""
              className="h-12 w-12 rounded-lg border border-ink/10 object-cover"
            />
          ) : null}
          <div>
            <p className="text-lg font-semibold">{businessName}</p>
            {vendorProfile?.city ? (
              <p className="text-xs text-ink/55">{vendorProfile.city}</p>
            ) : null}
          </div>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{proposal.title}</h1>
        <p className="mt-1 text-xs text-ink/50">
          {proposal.public_id}
          {snapshotAt ? ` · details as of ${snapshotAt}` : ''}
          {typeof confirmed === 'number' ? ` · ${confirmed} confirmed guests at that time` : ''}
          {proposal.valid_until ? ` · valid until ${fmtDate(proposal.valid_until)}` : ''}
        </p>
      </header>

      {/* Body */}
      <section className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink/85">
        {proposal.rendered_body || 'No proposal text.'}
      </section>

      {/* Line items */}
      {lineItems.length > 0 || proposal.total_centavos > 0 ? (
        <section className="rounded-xl border border-ink/10 bg-cream/60 p-4 print:rounded-none print:border-x-0 print:bg-transparent print:px-0">
          {lineItems.length > 0 ? (
            <ul className="divide-y divide-ink/10">
              {lineItems.map((item, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    {item.detail ? <p className="text-xs text-ink/50">{item.detail}</p> : null}
                  </div>
                  {item.amount_centavos ? (
                    <span className="text-sm tabular-nums text-ink/70">
                      {formatCentavos(item.amount_centavos)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {proposal.total_centavos > 0 ? (
            <p className="mt-2 flex items-baseline justify-between border-t border-ink/15 pt-3 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatCentavos(proposal.total_centavos)}</span>
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Terms */}
      {proposal.rendered_terms ? (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/55">Terms</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/75">
            {proposal.rendered_terms}
          </p>
        </section>
      ) : null}

      {/* Actions */}
      {isVendorSide && proposal.status === 'draft' ? (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <form action={sendProposal}>
            <input type="hidden" name="proposal_id" value={proposal.proposal_id} />
            <input type="hidden" name="public_id" value={proposal.public_id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-cream"
            >
              <Send aria-hidden className="h-4 w-4" /> Send to couple
            </button>
          </form>
          <form action={deleteDraftProposal}>
            <input type="hidden" name="proposal_id" value={proposal.proposal_id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink/20 px-4 py-2 text-sm font-medium text-ink/70 hover:text-red-700"
            >
              <Trash2 aria-hidden className="h-4 w-4" /> Delete draft
            </button>
          </form>
          <p className="w-full text-xs text-ink/45">
            Sending freezes these numbers — RSVP changes after today won&rsquo;t alter this
            proposal.
          </p>
        </div>
      ) : null}

      {!isVendorSide && (proposal.status === 'sent' || proposal.status === 'viewed') ? (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <form action={respondToProposal}>
            <input type="hidden" name="proposal_id" value={proposal.proposal_id} />
            <input type="hidden" name="public_id" value={proposal.public_id} />
            <input type="hidden" name="response" value="accepted" />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-success-700 px-4 py-2 text-sm font-medium text-white"
            >
              <CheckCircle2 aria-hidden className="h-4 w-4" /> Accept proposal
            </button>
          </form>
          <form action={respondToProposal}>
            <input type="hidden" name="proposal_id" value={proposal.proposal_id} />
            <input type="hidden" name="public_id" value={proposal.public_id} />
            <input type="hidden" name="response" value="declined" />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink/20 px-4 py-2 text-sm font-medium text-ink/70"
            >
              <XCircle aria-hidden className="h-4 w-4" /> Decline
            </button>
          </form>
          <p className="w-full text-xs text-ink/45">
            Accepting tells {businessName} you&rsquo;re going with this — it doesn&rsquo;t
            charge you anything.
          </p>
        </div>
      ) : null}

      {proposal.resolved_at ? (
        <p className="text-xs text-ink/50 print:hidden">
          {PROPOSAL_STATUS_LABEL[proposal.status]} on {fmtDate(proposal.resolved_at)}.
        </p>
      ) : null}

      {/* Standing payment disclosure — every payment-adjacent surface. */}
      <footer className="border-t border-ink/10 pt-3 text-[11px] leading-relaxed text-ink/45">
        Prices on this proposal are set by {businessName}. You pay the vendor directly —
        Setnayan never holds this money. Verify account details with your vendor through a
        channel you trust before paying.
      </footer>
    </main>
  );
}
