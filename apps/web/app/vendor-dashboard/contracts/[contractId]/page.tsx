import Link from 'next/link';
import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Download, Send, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  fetchContract,
  fetchContractSignatures,
  findSignatureByRole,
  formatFileSize,
  statusLabel,
} from '@/lib/contracts';
import { SubmitButton } from '@/app/_components/submit-button';
import { SignatureCanvas } from '@/app/_components/signature-canvas';
import {
  cancelContract,
  sendContractForSignature,
  signContractAsVendor,
} from '../actions';

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

  const [signatures, eventLookup] = await Promise.all([
    fetchContractSignatures(supabase, contractId),
    supabase
      .from('events')
      .select('event_id, display_name, event_date')
      .eq('event_id', contract.event_id)
      .maybeSingle(),
  ]);

  const event = eventLookup.data;
  const vendorSig = findSignatureByRole(signatures, 'vendor');
  const customerSig = findSignatureByRole(signatures, 'customer');
  const isDraft = contract.status === 'draft';
  const isSent = contract.status === 'sent_for_signature';
  const isFullySigned = contract.status === 'fully_signed';
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

      {/* Send-for-signature OR vendor signing */}
      {isDraft ? (
        <section className="rounded-2xl border border-ink/10 bg-cream p-5">
          <h2 className="text-base font-semibold text-ink">Send to the couple</h2>
          <p className="mt-1 text-sm text-ink/65">
            Once sent, the couple can review and sign in their dashboard. You can sign
            after.
          </p>
          <form action={sendContractForSignature} className="mt-4">
            <input type="hidden" name="contract_id" value={contract.contract_id} />
            <SubmitButton
              className="button-primary inline-flex items-center justify-center gap-2 text-sm"
              pendingLabel="Sending…"
            >
              <Send aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Send for signature
            </SubmitButton>
          </form>
        </section>
      ) : null}

      {isSent && !vendorSig ? (
        <section className="rounded-2xl border-2 border-terracotta/40 bg-terracotta/5 p-5">
          <h2 className="text-base font-semibold text-ink">Sign as vendor</h2>
          <p className="mt-1 text-sm text-ink/65">
            Add your signature to commit to the contract terms. The couple still needs
            to sign separately.
          </p>
          <form action={signContractAsVendor} className="mt-4 space-y-4">
            <input type="hidden" name="contract_id" value={contract.contract_id} />
            <div className="space-y-1.5">
              <label htmlFor="full_name" className="block text-sm font-medium text-ink">
                Full name <span className="text-terracotta">*</span>
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                maxLength={200}
                placeholder="Your legal name as it appears on the contract"
                className="input-field"
              />
            </div>
            <SignatureCanvas
              name="signature_data_url"
              label="Sign here"
              hint="By signing you agree to the terms in the PDF above."
            />
            <SubmitButton className="button-primary text-sm" pendingLabel="Signing…">
              Add my signature
            </SubmitButton>
          </form>
        </section>
      ) : null}

      {/* Signature status */}
      <section className="rounded-2xl border border-ink/10 bg-cream p-5">
        <h2 className="text-base font-semibold text-ink">Signatures</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SignatureBlock
            role="Vendor"
            sig={vendorSig}
            pendingHint={isDraft ? 'Send for signature first.' : 'Awaiting your signature.'}
          />
          <SignatureBlock
            role="Customer"
            sig={customerSig}
            pendingHint={
              isDraft
                ? 'Send for signature first.'
                : 'Awaiting customer signature.'
            }
          />
        </div>
        {isFullySigned && contract.fully_signed_at ? (
          <p className="mt-4 rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            Both parties signed on{' '}
            {new Date(contract.fully_signed_at).toLocaleString('en-PH', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            .
          </p>
        ) : null}
      </section>

      {/* Cancel (only while not fully signed) */}
      {!isFullySigned && !isCancelled ? (
        <details className="rounded-2xl border border-ink/10 bg-cream p-5">
          <summary className="cursor-pointer text-sm font-medium text-rose-700">
            Cancel this contract
          </summary>
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

function SignatureBlock({
  role,
  sig,
  pendingHint,
}: {
  role: string;
  sig: ReturnType<typeof findSignatureByRole>;
  pendingHint: string;
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream/60 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
        {role}
      </p>
      {sig ? (
        <div className="mt-2 space-y-2">
          <p className="text-sm font-medium text-ink">{sig.signer_full_name}</p>
          <Image
            src={sig.signature_image_url}
            alt={`${role} signature`}
            width={400}
            height={120}
            unoptimized
            className="h-20 w-full rounded border border-ink/10 bg-white object-contain"
          />
          <p className="text-[11px] text-ink/55">
            Signed{' '}
            {new Date(sig.signed_at).toLocaleString('en-PH', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-ink/55">{pendingHint}</p>
      )}
    </div>
  );
}
