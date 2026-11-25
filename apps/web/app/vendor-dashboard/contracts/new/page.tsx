import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorThreadsDetailed, type VendorThreadWithEvent } from '@/lib/chat';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchInquiryCustomerFacts } from '@/lib/inquiry-customer.server';
import { UploadContractBody } from './upload-body';

export const metadata = { title: 'New contract · Supplier' };

type Props = { searchParams: Promise<{ event?: string }> };

/**
 * Upload a contract — the November look (owner-approved 21 Nov 2026, supplier pages set two, page 2). The pinned row
 * carries the title and its ⓘ; the form is label-left / answer-right rows; Cancel and Upload draft ride the thumb zone.
 * The ⓘ drops the signing half of the shipped line (controller, 21 Nov, decided 1): Setnayan hosts the PDF and does not
 * facilitate signing.
 *
 * 🧾 HONEST READ: the couples come from this shop's conversations. A refused or unfinished conversations read is SAID
 * ("We couldn’t load your conversations…", Try again) — never "You need to be in conversation with a couple", which
 * is a claim about the supplier's business that the page did not measure.
 */
export default async function NewVendorContractPage({ searchParams }: Props) {
  const { event: prefillEventId } = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser();
  // A6-65: back to this page — with the couple it was opened for (`?event=`), so the return lands on the same pick.
  if (!user) {
    redirect(
      loginRedirectPath(
        prefillEventId ? `/vendor-dashboard/contracts/new?event=${encodeURIComponent(prefillEventId)}` : '/vendor-dashboard/contracts/new',
      ),
    );
  }
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Vendor can only contract with couples they have a chat thread with — that's the V1 signal that a relationship
  // exists. Measured: a read that threw, or that could not prove it reached the end and found nothing, is not "none".
  let threads: VendorThreadWithEvent[] = [];
  let threadsMeasured = true;
  try {
    const read = await fetchVendorThreadsDetailed(supabase, profile.vendor_profile_id);
    threads = read.threads;
    if (!read.complete && read.threads.length === 0) threadsMeasured = false;
  } catch (err) {
    threadsMeasured = false;
    logQueryError(
      'NewVendorContractPage.threads',
      { message: err instanceof Error ? err.message : String(err) },
      { vendorProfileId: profile.vendor_profile_id },
      'graceful_degrade',
    );
  }
  // 🔑 A6-B13 (final check 25 Nov): the couples come from THIS shop's threads, but their names cannot come from the
  // thread's `event` embed — a supplier holds no `events` RLS, so it is null on every supplier thread (see
  // `VendorThreadWithEvent.event`), and filtering on it left a shop with seven chats "not in conversation with a
  // couple". The names are read the house way: `fetchInquiryCustomerFacts`, service-role, scoped to the event ids of
  // the threads the caller's own session just returned. Threads but no names back = the names read failed → said.
  const threadEventIds = [...new Set(threads.map((t) => t.event_id).filter(Boolean))];
  const facts = threadEventIds.length > 0 ? await fetchInquiryCustomerFacts(createAdminClient(), threadEventIds) : new Map();
  if (threadEventIds.length > 0 && facts.size === 0) threadsMeasured = false;
  // Some names back but not all: the couples it could name are listed, and the page SAYS some are missing (never a
  // shorter picker that reads as the whole list).
  const someCouplesUnread = threadsMeasured && facts.size < threadEventIds.length;
  const eventOptions = threadEventIds
    .filter((id) => facts.has(id))
    .map((id) => ({ id, title: facts.get(id)?.displayName ?? 'Untitled event' }));

  // Booking↔contract deep-link (2026-06-22): the vendor's per-client event brief links here with ?event=<id> to
  // pre-select the couple. Only honor it when that event is actually one the vendor can contract with.
  const defaultEventId =
    prefillEventId && eventOptions.some((o) => o.id === prefillEventId) ? prefillEventId : '';

  return (
    <UploadContractBody
      eventOptions={threadsMeasured ? eventOptions : null}
      someCouplesUnread={someCouplesUnread}
      defaultEventId={defaultEventId}
    />
  );
}
