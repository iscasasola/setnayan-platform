import { redirect } from 'next/navigation';
import { Scale, ShieldCheck, MessageSquareWarning, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { relativeTime } from '@/lib/activity';
import { SubmitButton } from '@/app/_components/submit-button';
import { submitDisputeContest } from './actions';

export const metadata = { title: 'Disputes · Vendor · Setnayan' };

/**
 * /vendor-dashboard/disputes — "Stand up for yourself" mediation.
 *
 * Every dispute a couple files against you is reviewed by a NEUTRAL Setnayan
 * team BEFORE it can touch your rating. An unreviewed dispute never counts
 * toward demotion (migration 20270413204817) — the team looks at the record
 * first. This surface lets you:
 *   • SEE every dispute filed against your shop + its current status.
 *   • CONTEST an open dispute — write your side of the story; the team reads it
 *     when they adjudicate.
 *   • TRACK the outcome once the team rules.
 *
 * Reads are RLS-scoped: vendor_disputes_self_read lets you read only disputes
 * against your own profile (or ones you opened). No admin client here.
 */

type DisputeRow = {
  dispute_id: string;
  public_id: string;
  category:
    | 'no_show'
    | 'late_arrival'
    | 'quality_issue'
    | 'communication'
    | 'refund_request'
    | 'other';
  description: string;
  status: 'open' | 'resolved_for_vendor' | 'resolved_for_couple' | 'withdrawn';
  resolved_at: string | null;
  resolution_notes: string | null;
  counts_toward_demotion: boolean;
  vendor_contest: string | null;
  vendor_contested_at: string | null;
  created_at: string;
};

const CATEGORY_LABEL: Record<DisputeRow['category'], string> = {
  no_show: 'No-show',
  late_arrival: 'Late arrival',
  quality_issue: 'Quality issue',
  communication: 'Communication',
  refund_request: 'Refund request',
  other: 'Other',
};

const STATUS_LABEL: Record<DisputeRow['status'], string> = {
  open: 'Under review',
  resolved_for_vendor: 'Resolved · in your favor',
  resolved_for_couple: 'Resolved · for the couple',
  withdrawn: 'Withdrawn',
};

const STATUS_TONE: Record<DisputeRow['status'], string> = {
  open: 'bg-warn-100 text-warn-900',
  resolved_for_vendor: 'bg-success-100 text-success-800',
  resolved_for_couple: 'bg-violet-100 text-violet-800',
  withdrawn: 'bg-ink/10 text-ink/60',
};

export default async function VendorDisputesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Disputes</h1>
        <p className="mt-4 text-base text-ink/65">
          Set up your vendor profile first. If a couple ever raises a concern
          about a booking, it&rsquo;ll show up here — and a neutral Setnayan team
          reviews it before it can affect your standing.
        </p>
      </div>
    );
  }

  // RLS-scoped: only disputes filed against this vendor's profile (or opened by
  // this user). No admin client — the vendor's own session is enough.
  const { data, error } = await supabase
    .from('vendor_disputes')
    .select(
      'dispute_id,public_id,category,description,status,resolved_at,resolution_notes,counts_toward_demotion,vendor_contest,vendor_contested_at,created_at',
    )
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = (data ?? []) as DisputeRow[];
  const openCount = rows.filter((r) => r.status === 'open').length;

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-3">
        <div className="flex items-center gap-2">
          <Scale className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Disputes</h1>
        </div>
        <p className="max-w-prose text-base text-ink/65">
          Stand up for yourself. If a couple raises a concern about a booking, a{' '}
          <span className="font-medium text-ink">neutral Setnayan team reviews the record first</span> —
          it can never affect your rating or your listing until the team has
          looked at both sides.
        </p>
        <div className="flex items-start gap-2 rounded-lg border border-success-200 bg-success-50 px-3 py-2.5 text-sm text-success-800">
          <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <p>
            An open dispute is <span className="font-semibold">under review only</span> — it does
            not count against you unless the team resolves it in the couple&rsquo;s favor.
            Add your side below while it&rsquo;s still open.
          </p>
        </div>
      </header>

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          Your disputes couldn&apos;t load right now. Refresh in a moment.
        </p>
      ) : null}

      {rows.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-ink/15 p-8 text-center">
          <CheckCircle2 aria-hidden className="mx-auto h-8 w-8 text-success-600" strokeWidth={1.75} />
          <p className="mt-3 text-sm font-medium text-ink">No disputes — nice work.</p>
          <p className="mt-1 text-sm text-ink/60">
            Nothing has been raised against your shop. If a couple ever does, it
            shows up here and the team reviews it before it touches your standing.
          </p>
        </div>
      ) : (
        <>
          {openCount > 0 ? (
            <p className="mb-4 text-sm text-ink/70">
              <span className="font-semibold text-ink">{openCount}</span>{' '}
              {openCount === 1 ? 'dispute is' : 'disputes are'} under review.
            </p>
          ) : null}
          <ul className="space-y-4">
            {rows.map((r) => (
              <DisputeCard key={r.dispute_id} row={r} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function DisputeCard({ row }: { row: DisputeRow }) {
  const isOpen = row.status === 'open';
  return (
    <li className="sn-row p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-medium text-ink/60">{row.public_id}</span>
          <span className="inline-flex items-center rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/70">
            {CATEGORY_LABEL[row.category]}
          </span>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${STATUS_TONE[row.status]}`}
        >
          {STATUS_LABEL[row.status]}
        </span>
      </div>

      <p className="mt-3 text-sm text-ink/80 whitespace-pre-wrap">{row.description}</p>
      <p className="mt-1 text-xs text-ink/50">
        Filed <span title={row.created_at}>{relativeTime(row.created_at)}</span>
      </p>

      {/* The vendor's contest, if written */}
      {row.vendor_contest ? (
        <div className="mt-3 rounded-lg border border-ink/10 bg-white/60 p-3">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            <MessageSquareWarning aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Your response
            {row.vendor_contested_at ? (
              <span className="normal-case tracking-normal text-ink/45">
                · {relativeTime(row.vendor_contested_at)}
              </span>
            ) : null}
          </p>
          <p className="mt-1.5 text-sm text-ink/80 whitespace-pre-wrap">{row.vendor_contest}</p>
        </div>
      ) : null}

      {/* Resolution outcome, once the team has ruled */}
      {!isOpen ? (
        <div className="mt-3 rounded-lg border border-ink/10 bg-white/60 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Team decision
            {row.resolved_at ? (
              <span className="normal-case tracking-normal text-ink/45">
                {' '}· {relativeTime(row.resolved_at)}
              </span>
            ) : null}
          </p>
          <p className="mt-1.5 text-sm font-medium text-ink">{STATUS_LABEL[row.status]}</p>
          {row.resolution_notes ? (
            <p className="mt-1 text-sm text-ink/70 whitespace-pre-wrap">{row.resolution_notes}</p>
          ) : null}
        </div>
      ) : null}

      {/* Contest form — only while the dispute is open */}
      {isOpen ? (
        <details className="mt-4">
          <summary className="cursor-pointer select-none text-sm font-medium text-terracotta">
            {row.vendor_contest ? 'Edit your response' : 'Contest this dispute'}
          </summary>
          <form action={submitDisputeContest} className="mt-3 space-y-2">
            <input type="hidden" name="dispute_id" value={row.dispute_id} />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink/70">
                Your side of the story
              </span>
              <textarea
                name="vendor_contest"
                rows={4}
                required
                maxLength={2000}
                defaultValue={row.vendor_contest ?? ''}
                placeholder="Explain what happened from your side. The Setnayan team reads this before making any decision — attach dates, messages, or delivery proof you can reference."
                className="input-field w-full text-sm"
                aria-label="Your response to this dispute"
              />
            </label>
            <p className="text-xs text-ink/50">
              The neutral team reviews your response before this dispute can
              affect your rating. You can edit it any time until the team rules.
            </p>
            <SubmitButton pendingLabel="Submitting…" className="button-secondary text-sm">
              {row.vendor_contest ? 'Update my response' : 'Submit my response'}
            </SubmitButton>
          </form>
        </details>
      ) : null}
    </li>
  );
}
