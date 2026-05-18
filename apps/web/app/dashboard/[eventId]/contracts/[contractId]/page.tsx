import Link from 'next/link';
import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  fetchContract,
  fetchContractSignatures,
  findSignatureByRole,
  formatFileSize,
  statusLabel,
} from '@/lib/contracts';
import { SubmitButton } from '@/app/_components/submit-button';
import { SignatureCanvas } from '@/app/_components/signature-canvas';
import { signContractAsCustomer } from '../actions';

export const metadata = { title: 'Contract · Sign' };

type Props = { params: Promise<{ eventId: string; contractId: string }> };

export default async function CustomerContractDetailPage({ params }: Props) {
  const { eventId, contractId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS gives this row to event members only when contract.status <> 'draft'.
  const contract = await fetchContract(supabase, contractId);
  if (!contract || contract.event_id !== eventId) notFound();

  const [signatures, vendorRes] = await Promise.all([
    fetchContractSignatures(supabase, contractId),
    supabase
      .from('vendor_profiles')
      .select('business_name')
      .eq('vendor_profile_id', contract.vendor_profile_id)
      .maybeSingle(),
  ]);
  const vendorName = (vendorRes.data?.business_name as string | undefined) ?? 'Vendor';

  const vendorSig = findSignatureByRole(signatures, 'vendor');
  const customerSig = findSignatureByRole(signatures, 'customer');
  const isFullySigned = contract.status === 'fully_signed';
  const isCancelled = contract.status === 'cancelled';
  const customerCanSign =
    contract.status === 'sent_for_signature' && !customerSig;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href={`/dashboard/${eventId}/contracts`}
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
          From <strong>{vendorName}</strong> ·{' '}
          {new Date(contract.created_at).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
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

      {/* Customer sign block */}
      {customerCanSign ? (
        <section className="rounded-2xl border-2 border-terracotta/40 bg-terracotta/5 p-5">
          <h2 className="text-base font-semibold text-ink">Your signature</h2>
          <p className="mt-1 text-sm text-ink/65">
            Read the PDF above carefully. By signing you agree to its terms.
          </p>
          <form action={signContractAsCustomer} className="mt-4 space-y-4">
            <input type="hidden" name="contract_id" value={contract.contract_id} />
            <input type="hidden" name="event_id" value={eventId} />
            <div className="space-y-1.5">
              <label htmlFor="full_name" className="block text-sm font-medium text-ink">
                Full legal name <span className="text-terracotta">*</span>
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                maxLength={200}
                placeholder="As it appears on your ID"
                className="input-field"
              />
            </div>
            <SignatureCanvas
              name="signature_data_url"
              label="Sign here"
              hint="By signing you agree to the contract terms in the PDF above."
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
          <CustomerSignatureBlock
            role={`Vendor (${vendorName})`}
            sig={vendorSig}
            pendingHint="Awaiting vendor signature."
          />
          <CustomerSignatureBlock
            role="You"
            sig={customerSig}
            pendingHint={customerCanSign ? 'Use the form above to sign.' : 'Awaiting your signature.'}
          />
        </div>
        {isFullySigned && contract.fully_signed_at ? (
          <p className="mt-4 rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            Both parties signed on{' '}
            {new Date(contract.fully_signed_at).toLocaleString('en-PH', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            . Keep a copy for your records.
          </p>
        ) : null}
        {isCancelled && contract.cancelled_at ? (
          <p className="mt-4 rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-xs text-rose-900">
            This contract was cancelled on{' '}
            {new Date(contract.cancelled_at).toLocaleString('en-PH', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            .
          </p>
        ) : null}
      </section>
    </div>
  );
}

function CustomerSignatureBlock({
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
