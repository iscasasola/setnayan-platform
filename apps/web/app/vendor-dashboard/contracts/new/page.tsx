import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, X } from 'lucide-react';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { TEMPLATE_SUBLINE } from '@/app/_components/template-rows';
import { CardPick } from '../../services/requests/_components/card-pick';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorThreads } from '@/lib/chat';
import { SubmitButton } from '@/app/_components/submit-button';
import { uploadVendorContract } from '../actions';
import { formatFileSize, CONTRACT_MAX_BYTES } from '@/lib/contracts';

export const metadata = { title: 'New contract · Supplier' };

type Props = { searchParams: Promise<{ event?: string }> };

export default async function NewVendorContractPage({ searchParams }: Props) {
  const { event: prefillEventId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Vendor can only contract with couples they have a chat thread with —
  // that's the V1 signal that a relationship exists.
  const threads = await fetchVendorThreads(supabase, profile.vendor_profile_id);
  const eventOptions = Array.from(
    new Map(
      threads
        .filter((t) => t.event)
        .map((t) => [t.event_id, { event_id: t.event_id, label: t.event!.display_name }]),
    ).values(),
  );

  // Booking↔contract deep-link (2026-06-22): the vendor's per-client event
  // brief links here with ?event=<id> to pre-select the couple. Only honor it
  // when that event is actually one the vendor can contract with (it's in the
  // thread-derived option list); otherwise fall back to the empty picker.
  const defaultEventId =
    prefillEventId && eventOptions.some((o) => o.event_id === prefillEventId)
      ? prefillEventId
      : '';

  return (
    <div className="mx-auto w-full max-w-2xl space-y-2">
      <ActionButton
        tone="neutral"
        quiet
        icon={<ArrowLeft aria-hidden strokeWidth={2} />}
        label="Back to contracts"
        href="/vendor-dashboard/contracts"
      />

      {/* The heading stays visible: this route's own loading.tsx (FormPageSkeleton title) promises it. The explaining
          line moved behind its ⓘ (rule 7). */}
      <h1 className="text-xl font-semibold tracking-tight text-ink">
        <InfoTip label="Upload a contract">
          {`PDF only, up to ${formatFileSize(CONTRACT_MAX_BYTES)}. After upload you can review, then send to the couple for signature.`}
        </InfoTip>
      </h1>

      <div className="pt-2">
        {eventOptions.length === 0 ? (
          <p className="py-3 text-[14px]" style={{ color: 'rgb(var(--color-warn))' }}>
            You need to be in conversation with a couple before uploading a contract. Open a chat with a couple from
            your{' '}
            <Link href="/vendor-dashboard/messages" className="font-semibold underline">
              messages
            </Link>{' '}
            first.
          </p>
        ) : (
          <form action={uploadVendorContract} className="space-y-5">
            <div className="space-y-1.5">
              <p className="block text-[14px] font-semibold text-ink">
                For which event? <span className="text-terracotta-700">*</span>
              </p>
              <CardPick
                cards={eventOptions.map((o) => ({ id: o.event_id, title: o.label ?? 'Untitled event' }))}
                fieldName="event_id"
                label="For which event?"
                placeholder="Pick an event…"
                initial={defaultEventId}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="title" className="block text-[14px] font-semibold text-ink">
                Contract title <span className="text-terracotta-700">*</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                maxLength={200}
                placeholder="Wedding photography package — June 14, 2027"
                className="input-field"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="description" className="block text-[14px] font-semibold text-ink">
                Description (optional)
              </label>
              <textarea
                id="description"
                name="description"
                maxLength={2000}
                rows={3}
                placeholder="Brief note for the couple (not on the contract PDF)."
                className="input-field"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="file" className="block text-[14px] font-semibold text-ink">
                Contract PDF <span className="text-terracotta-700">*</span>
              </label>
              <input
                id="file"
                name="file"
                type="file"
                accept="application/pdf,.pdf"
                required
                className="block w-full text-[14px] text-ink file:mr-4 file:min-h-11 file:rounded-full file:border file:border-[color:var(--m-line)] file:bg-[color:var(--m-paper-2)] file:px-4 file:text-[14px] file:font-semibold file:text-ink"
              />
              <p className={TEMPLATE_SUBLINE}>
                PDF only · max {formatFileSize(CONTRACT_MAX_BYTES)} · you and the couple will both sign in-app after
                upload.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <SubmitButton className={`${actionButtonClass('brand', { main: true })} w-full sm:w-auto`} pendingLabel="Uploading…">
                Upload draft
              </SubmitButton>
              <ActionButton tone="neutral" icon={<X aria-hidden />} label="Cancel" href="/vendor-dashboard/contracts" />
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
