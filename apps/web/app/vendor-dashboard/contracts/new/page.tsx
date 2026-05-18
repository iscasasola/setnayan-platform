import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorThreads } from '@/lib/chat';
import { SubmitButton } from '@/app/_components/submit-button';
import { uploadVendorContract } from '../actions';
import { formatFileSize, CONTRACT_MAX_BYTES } from '@/lib/contracts';

export const metadata = { title: 'New contract · Vendor' };

export default async function NewVendorContractPage() {
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

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Link
        href="/vendor-dashboard/contracts"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/65 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to contracts
      </Link>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Upload a contract</h1>
        <p className="mt-1 text-sm text-ink/65">
          PDF only, up to {formatFileSize(CONTRACT_MAX_BYTES)}. After upload you can
          review, then send to the couple for signature.
        </p>
      </header>

      {eventOptions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-300/60 bg-amber-50 p-6 text-sm text-amber-900">
          You need to be in conversation with a couple before uploading a
          contract. Open a chat with a couple from your{' '}
          <Link href="/vendor-dashboard/messages" className="font-medium underline">
            messages
          </Link>{' '}
          first.
        </div>
      ) : (
        <form action={uploadVendorContract} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="event_id" className="block text-sm font-medium text-ink">
              For which event? <span className="text-terracotta">*</span>
            </label>
            <select
              id="event_id"
              name="event_id"
              required
              className="input-field"
              defaultValue=""
            >
              <option value="" disabled>
                Pick an event…
              </option>
              {eventOptions.map((o) => (
                <option key={o.event_id} value={o.event_id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="title" className="block text-sm font-medium text-ink">
              Contract title <span className="text-terracotta">*</span>
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
            <label htmlFor="description" className="block text-sm font-medium text-ink">
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
            <label htmlFor="file" className="block text-sm font-medium text-ink">
              Contract PDF <span className="text-terracotta">*</span>
            </label>
            <input
              id="file"
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required
              className="block w-full text-sm text-ink file:mr-4 file:rounded-md file:border-0 file:bg-terracotta file:px-4 file:py-2 file:text-sm file:font-medium file:text-cream hover:file:bg-terracotta-700"
            />
            <p className="text-xs text-ink/55">
              PDF only · max {formatFileSize(CONTRACT_MAX_BYTES)} ·
              you and the couple will both sign in-app after upload.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <SubmitButton className="button-primary w-full sm:w-auto" pendingLabel="Uploading…">
              Upload draft
            </SubmitButton>
            <Link href="/vendor-dashboard/contracts" className="button-secondary w-full sm:w-auto">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
