import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchEventContracts, statusLabel, type ContractStatus } from '@/lib/contracts';

export const metadata = { title: 'Vendor contracts' };

const STATUS_TONE: Record<ContractStatus, string> = {
  draft: 'bg-ink/10 text-ink/70',
  // Repurposed under upload-only scope (2026-05-18) — see lib/contracts.ts.
  sent_for_signature: 'bg-emerald-100 text-emerald-800',
  fully_signed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800',
};

type Props = { params: Promise<{ eventId: string }> };

export default async function EventContractsPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS filters draft contracts out automatically (couples only see sent
  // and later); this returns sent_for_signature / fully_signed / cancelled.
  const contracts = await fetchEventContracts(supabase, eventId);

  // Pull joined vendor business names for each contract.
  const vendorProfileIds = Array.from(new Set(contracts.map((c) => c.vendor_profile_id)));
  const vendorMap = new Map<string, { business_name: string }>();
  if (vendorProfileIds.length > 0) {
    const { data: vendorRows } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', vendorProfileIds);
    for (const v of vendorRows ?? []) {
      vendorMap.set(v.vendor_profile_id as string, {
        business_name: (v.business_name as string) || 'Vendor',
      });
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Vendor contracts</h1>
          {/* YOUR PLAN consolidation 2026-05-22 — vendor contracts also
           *  appear in the consolidated /documents view alongside
           *  paperwork, creations, and receipts. */}
          <Link
            href={`/dashboard/${eventId}/documents`}
            className="inline-flex items-center gap-1 text-xs font-medium text-terracotta-700 hover:text-terracotta-800"
          >
            See all documents <ArrowRight aria-hidden className="h-3 w-3" strokeWidth={2} />
          </Link>
        </div>
        <p className="text-sm text-ink/65">
          PDFs your vendors have uploaded for reference. Setnayan hosts the
          files so both sides have a copy on hand — signing happens between
          you and the vendor externally.
        </p>
      </header>

      {contracts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-10 text-center">
          <FileText
            aria-hidden
            className="mx-auto h-8 w-8 text-ink/40"
            strokeWidth={1.5}
          />
          <p className="mt-3 text-sm text-ink/65">
            No contracts yet. Vendors will upload PDFs here once you agree on
            terms in chat.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {contracts.map((c) => {
            const vendor = vendorMap.get(c.vendor_profile_id);
            return (
              <li
                key={c.contract_id}
                className="rounded-2xl border border-ink/10 bg-cream"
              >
                <Link
                  href={`/dashboard/${eventId}/contracts/${c.contract_id}`}
                  className="flex flex-col gap-2 p-5 transition-colors hover:bg-terracotta/[0.03] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold tracking-tight text-ink">
                        {c.title}
                      </h2>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${STATUS_TONE[c.status]}`}
                      >
                        {statusLabel(c.status)}
                      </span>
                    </div>
                    <p className="text-xs text-ink/55">
                      From {vendor?.business_name ?? 'Vendor'} ·{' '}
                      {new Date(c.created_at).toLocaleDateString('en-PH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <ArrowRight
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-ink/40"
                    strokeWidth={1.75}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
