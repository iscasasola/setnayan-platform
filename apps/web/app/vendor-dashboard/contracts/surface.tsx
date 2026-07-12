import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorContracts } from '@/lib/contracts';
import { ContractCard, ContractsEmptyState } from '@/app/_components/contracts/contract-card';

export const metadata = { title: 'Contracts · Vendor' };

export default async function VendorContractsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const contracts = await fetchVendorContracts(supabase, profile.vendor_profile_id);

  // Pull joined event display names for the list.
  const eventIds = Array.from(new Set(contracts.map((c) => c.event_id)));
  const eventMap = new Map<string, { display_name: string }>();
  if (eventIds.length > 0) {
    const { data: eventRows } = await supabase
      .from('events')
      .select('event_id, display_name')
      .in('event_id', eventIds);
    for (const e of eventRows ?? []) {
      eventMap.set(e.event_id as string, { display_name: e.display_name as string });
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Contracts</h1>
          <p className="mt-1 text-sm text-ink/65">
            Upload a contract PDF and make it visible to the couple for
            reference. Signing happens between you and the couple externally —
            Setnayan hosts the file but does not facilitate signatures.
          </p>
        </div>
        <Link
          href="/vendor-dashboard/contracts/new"
          className="button-primary inline-flex items-center justify-center gap-2 text-sm"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          Upload new contract
        </Link>
      </header>

      {contracts.length === 0 ? (
        <ContractsEmptyState
          message="No contracts yet. Upload one when a couple is ready to commit."
        />
      ) : (
        <ul className="space-y-3">
          {contracts.map((c) => {
            const event = eventMap.get(c.event_id);
            return (
              <ContractCard
                key={c.contract_id}
                title={c.title}
                status={c.status}
                createdAt={c.created_at}
                href={`/vendor-dashboard/contracts/${c.contract_id}`}
                subtitlePrefix="For"
                subtitleName={event?.display_name ?? 'Unknown event'}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
