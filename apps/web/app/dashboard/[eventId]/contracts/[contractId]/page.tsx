import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  fetchContract,
  formatFileSize,
  statusLabel,
} from '@/lib/contracts';

export const metadata = { title: 'Contract · View' };

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

  const vendorRes = await supabase
    .from('vendor_profiles')
    .select('business_name')
    .eq('vendor_profile_id', contract.vendor_profile_id)
    .maybeSingle();
  const vendorName = (vendorRes.data?.business_name as string | undefined) ?? 'Vendor';

  const isCancelled = contract.status === 'cancelled';

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

      {/* Hosting-only disclosure */}
      <p className="rounded-md border border-ink/10 bg-cream/60 px-3 py-2 text-xs text-ink/65">
        This contract was uploaded by <strong>{vendorName}</strong> for your
        reference. Setnayan hosts the PDF so both sides have a copy on hand —
        signing happens between you and the vendor outside the app (email,
        in-person, or your own e-sig tool). Keep a signed copy with your
        records.
      </p>

      {isCancelled && contract.cancelled_at ? (
        <p className="rounded-md border border-danger-300/60 bg-danger-50 px-3 py-2 text-xs text-danger-900">
          This contract was cancelled by the vendor on{' '}
          {new Date(contract.cancelled_at).toLocaleString('en-PH', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
          .
        </p>
      ) : null}
    </div>
  );
}
