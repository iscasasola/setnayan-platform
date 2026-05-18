import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, FileText, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorContracts, statusLabel, type ContractStatus } from '@/lib/contracts';

export const metadata = { title: 'Contracts · Vendor' };

const STATUS_TONE: Record<ContractStatus, string> = {
  draft: 'bg-ink/10 text-ink/70',
  // Repurposed under upload-only scope (2026-05-18) — see lib/contracts.ts.
  sent_for_signature: 'bg-emerald-100 text-emerald-800',
  fully_signed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800',
};

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
        <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-10 text-center">
          <FileText aria-hidden className="mx-auto h-8 w-8 text-ink/40" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-ink/65">
            No contracts yet. Upload one when a couple is ready to commit.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {contracts.map((c) => {
            const event = eventMap.get(c.event_id);
            return (
              <li
                key={c.contract_id}
                className="rounded-2xl border border-ink/10 bg-cream"
              >
                <Link
                  href={`/vendor-dashboard/contracts/${c.contract_id}`}
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
                      For {event?.display_name ?? 'Unknown event'} ·{' '}
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
