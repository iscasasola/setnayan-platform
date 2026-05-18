import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Download, Eye, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  fetchContract,
  formatFileSize,
  statusLabel,
} from '@/lib/contracts';
import { SubmitButton } from '@/app/_components/submit-button';
import { cancelContract, publishContractToCouple } from '../actions';

export const metadata = { title: 'Contract · Vendor' };

type Props = { params: Promise<{ contractId: string }> };

export default async function VendorContractDetailPage({ params }: Props) {
  const { contractId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const contract = await fetchContract(supabase, contractId);
  if (!contract || contract.vendor_profile_id !== profile.vendor_profile_id) {
    notFound();
  }

  const eventLookup = await supabase
    .from('events')
    .select('event_id, display_name, event_date')
    .eq('event_id', contract.event_id)
    .maybeSingle();
  const event = eventLookup.data;

  const isDraft = contract.status === 'draft';
  const isVisible = contract.status === 'sent_for_signature' || contract.status === 'fully_signed';
  const isCancelled = contract.status === 'cancelled';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/vendor-dashboard/contracts"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/65 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to contracts
      </Link>

      <header className="space-y-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          {statusLabel(contract.status)}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {contract.title}
        </h1>
        <p className="text-sm text-ink/65">
          For <strong>{event?.display_name ?? 'Unknown event'}</strong>
          {event?.event_date
            ? ` · ${new Date(event.event_date).toLocaleDateString('en-PH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}`
            : null}
        </p>
        {contract.description ? (
          <p className="rounded-md border border-ink/10 bg-cream p-3 text-sm text-ink/75">
            {contract.description}
          </p>
        ) : null}
      </header>

      {/* PDF download */}
      <section className="rounded-2xl border border-ink/10 bg-cream p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Contract file
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-ink">{contract.file_name}</p>
            <p className="text-xs text-ink/55">{formatFileSize(contract.file_size_bytes)} · PDF</p>
          </div>
          <a
            href={contract.file_url}
            target="_blank"
            rel="noreferrer"
            className="button-secondary inline-flex items-center justify-center gap-2 text-sm"
          >
            <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            View / download
          </a>
        </div>
      </section>

      {/* Hosting-only disclosure */}
      <p className="rounded-md border border-ink/10 bg-cream/60 px-3 py-2 text-xs text-ink/65">
        Setnayan hosts this PDF for the couple to reference — we do not facilitate
        signing. Handle signatures externally (email, in-person, your own e-sig
        tool) and keep the signed copy with your records.
      </p>

      {/* Publish-to-couple action (only while draft) */}
      {isDraft ? (
        <section className="rounded-2xl border border-ink/10 bg-cream p-5">
          <h2 className="text-base font-semibold text-ink">Share with the couple</h2>
          <p className="mt-1 text-sm text-ink/65">
            Right now only you can see this. Make it visible so the couple can
            view and download it from their dashboard.
          </p>
          <form action={publishContractToCouple} className="mt-4">
            <input type="hidden" name="contract_id" value={contract.contract_id} />
            <SubmitButton
              className="button-primary inline-flex items-center justify-center gap-2 text-sm"
              pendingLabel="Sharing…"
            >
              <Eye aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Make visible to couple
            </SubmitButton>
          </form>
        </section>
      ) : null}

      {isVisible ? (
        <p className="rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          The couple can see this contract in their dashboard.
        </p>
      ) : null}

      {/* Cancel — available except when already cancelled */}
      {!isCancelled ? (
        <details className="rounded-2xl border border-ink/10 bg-cream p-5">
          <summary className="cursor-pointer text-sm font-medium text-rose-700">
            Cancel this contract
          </summary>
          <p className="mt-2 text-xs text-ink/55">
            Removes the contract from the couple&rsquo;s view. The file stays in
            our records for audit but is not shown anywhere else.
          </p>
          <form action={cancelContract} className="mt-3 space-y-3">
            <input type="hidden" name="contract_id" value={contract.contract_id} />
            <div className="space-y-1.5">
              <label htmlFor="reason" className="block text-xs text-ink/65">
                Reason (optional, ≤500 characters)
              </label>
              <textarea
                id="reason"
                name="reason"
                maxLength={500}
                rows={2}
                className="input-field text-sm"
                placeholder="Couple changed terms / pricing renegotiated / etc."
              />
            </div>
            <SubmitButton
              className="inline-flex items-center gap-2 rounded-md bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-200"
              pendingLabel="Cancelling…"
            >
              <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Cancel contract
            </SubmitButton>
          </form>
        </details>
      ) : null}

      {isCancelled && contract.cancelled_at ? (
        <p className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          Cancelled on{' '}
          {new Date(contract.cancelled_at).toLocaleString('en-PH', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
          {contract.cancelled_reason ? ` — ${contract.cancelled_reason}` : '.'}
        </p>
      ) : null}
    </div>
  );
}
