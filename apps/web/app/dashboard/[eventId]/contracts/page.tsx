import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchEventContracts } from '@/lib/contracts';
import { ContractCard, ContractsEmptyState } from '@/app/_components/contracts/contract-card';

export const metadata = { title: 'Vendor contracts' };

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
        <ContractsEmptyState
          message="No contracts yet. Vendors will upload PDFs here once you agree on terms in chat."
        />
      ) : (
        <ul className="space-y-3">
          {contracts.map((c) => {
            const vendor = vendorMap.get(c.vendor_profile_id);
            return (
              <ContractCard
                key={c.contract_id}
                title={c.title}
                status={c.status}
                createdAt={c.created_at}
                href={`/dashboard/${eventId}/contracts/${c.contract_id}`}
                subtitlePrefix="From"
                subtitleName={vendor?.business_name ?? 'Vendor'}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
