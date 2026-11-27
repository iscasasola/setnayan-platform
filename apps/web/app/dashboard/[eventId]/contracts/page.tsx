import { getCurrentUser } from '@/lib/auth';
import Link from 'next/link';
import { logQueryError } from '@/lib/supabase/error-detect';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { readEventContracts } from '@/lib/contracts';
import { ReadRefusedNotice } from '../_components/read-refused-notice';
import { ContractCard, ContractsEmptyState } from '@/app/_components/contracts/contract-card';
import { PageMasthead } from '@/app/_components/page-masthead';
import { BackButton } from '@/app/_components/back-button';

export const metadata = { title: 'Supplier contracts' };

type Props = { params: Promise<{ eventId: string }> };

export default async function EventContractsPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // RLS filters draft contracts out automatically (couples only see sent
  // and later); this returns sent_for_signature / fully_signed / cancelled.
  // A2-G14: `null` = refused. The page says so; it never claims "No contracts yet" for a read that never happened.
  const contractsRead = await readEventContracts(supabase, eventId);
  const contracts = contractsRead ?? [];

  // Pull joined vendor business names for each contract.
  const vendorProfileIds = Array.from(new Set(contracts.map((c) => c.vendor_profile_id)));
  const vendorMap = new Map<string, { business_name: string }>();
  if (vendorProfileIds.length > 0) {
    const { data: vendorRows, error: vendorRowsError } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', vendorProfileIds);
    // ⚠ supplier names on the couple's contracts. Refused, a signed contract renders
    // ⚠ without the name of who it is with.
    if (vendorRowsError) {
      logQueryError('ContractsPage.vendorRows', vendorRowsError, { eventId }, 'graceful_degrade');
    }
    for (const v of vendorRows ?? []) {
      vendorMap.set(v.vendor_profile_id as string, {
        business_name: (v.business_name as string) || 'Supplier',
      });
    }
  }

  return (
    <div className="sn-col space-y-6">
      {/* ↩ Not a bar tab, so it draws the back (DECISION_LOG 2026-11-16 back rule; walkthrough 27 Nov W2-14). */}
      <BackButton route="/dashboard/[eventId]/contracts" params={{ eventId }} className="!mb-0" />
      <PageMasthead
        title="Supplier contracts"
        actions={
          /* YOUR PLAN consolidation 2026-05-22 — vendor contracts also
           *  appear in the consolidated /documents view alongside
           *  paperwork, creations, and receipts. */
          <Link
            href={`/dashboard/${eventId}/documents`}
            className="inline-flex items-center gap-1 text-xs font-medium text-terracotta-700 hover:text-terracotta-800"
          >
            See all documents <ArrowRight aria-hidden className="h-3 w-3" strokeWidth={2} />
          </Link>
        }
      />

      {contractsRead === null ? (
        <ReadRefusedNotice what="your contracts" />
      ) : contracts.length === 0 ? (
        <ContractsEmptyState
          message="No contracts yet. Suppliers will upload PDFs here once you agree on terms in chat."
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
                subtitleName={vendor?.business_name ?? 'Supplier'}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
