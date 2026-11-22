import { getCurrentUser } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { readContract } from '@/lib/contracts';
import { ContractBody, ContractReadFailed } from './contract-body';

export const metadata = { title: 'Contract · Supplier' };

type Props = { params: Promise<{ contractId: string }> };

/**
 * The opened contract — the November look (owner-approved 21 Nov 2026, supplier pages set two, page 2). The status is
 * a pill in the pinned row; the title and the couple sit in the top block; the file is one row; Make visible is the one
 * main button (the thumb zone on a phone, the right of the pinned row on a computer); Cancel is a closed row in the
 * danger word that opens in place with its reason box. Every word, limit and action is the shipped page's.
 *
 * 🧾 HONEST READ: a refused contract read says "We couldn’t load this contract right now." with Try again inside the
 * page — only a read that answered with no row (or another shop's row) is the not-found page.
 */
export default async function VendorContractDetailPage({ params }: Props) {
  const { contractId } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const read = await readContract(supabase, contractId);
  if (read.failed) return <ContractReadFailed contractId={contractId} />;
  const contract = read.contract;
  if (!contract || contract.vendor_profile_id !== profile.vendor_profile_id) {
    notFound();
  }

  const eventLookup = await supabase
    .from('events')
    .select('event_id, display_name, event_date')
    .eq('event_id', contract.event_id)
    .maybeSingle();
  if (eventLookup.error) {
    logQueryError('VendorContractDetailPage.event', eventLookup.error, { contractId }, 'graceful_degrade');
  }
  const event = eventLookup.data;

  return <ContractBody contract={contract} event={event ?? null} eventFailed={Boolean(eventLookup.error)} />;
}
