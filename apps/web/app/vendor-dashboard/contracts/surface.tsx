import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorContracts } from '@/lib/contracts';
import { ContractCard, ContractsEmptyState } from '@/app/_components/contracts/contract-card';

export const metadata = { title: 'Contracts · Supplier' };

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
    const { data: eventRows, error: eventRowsError } = await supabase
      .from('events')
      .select('event_id, display_name')
      .in('event_id', eventIds);
    // ⚠ the CLIENT NAME on each contract. Refused, `event?.display_name ??
    // ⚠ 'Unknown event'` renders every contract as being "For Unknown event" —
    // ⚠ and "Unknown event" is also what a genuinely missing event shows, so the
    // ⚠ two are indistinguishable on a page about signed agreements.
    if (eventRowsError) {
      logQueryError(
        'VendorContractsSurface.eventRows',
        eventRowsError,
        { vendorProfileId: profile.vendor_profile_id },
        'graceful_degrade',
      );
    }
    for (const e of eventRows ?? []) {
      eventMap.set(e.event_id as string, { display_name: e.display_name as string });
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Contracts</h1>
          <InfoTip
            label="Upload a contract PDF and make it visible to the couple for reference."
            labelAs="p"
            className="mt-1"
            labelClassName="text-sm text-[color:var(--m-slate-2)]"
            align="start"
          >
            Signing happens between you and the couple externally — Setnayan hosts the file but does not facilitate
            signatures.
          </InfoTip>
        </div>
        <ActionButton
          href="/vendor-dashboard/contracts/new"
          tone="brand"
          main
          icon={<Plus aria-hidden />}
          label="Upload new contract"
        />
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
