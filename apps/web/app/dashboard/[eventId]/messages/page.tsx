import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageSquare, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchCoupleThreads, formatChatTimestamp } from '@/lib/chat';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  ThreadListCard,
  ThreadListAvatar,
} from '@/app/_components/chat/thread-list-card';
import { ThreadArchiveToggle } from '@/app/_components/chat/thread-archive-toggle';
import { resolveVendorDisplayName, isVendorNameRevealed } from '@/lib/vendors';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';
import { startThreadByVendorEmail } from './actions';
import { PageMasthead } from '@/app/_components/page-masthead';

export const metadata = { title: 'Messages' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    error?: string;
    prefill_vendor_email?: string;
  }>;
};

export default async function CoupleMessagesPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const threads = await fetchCoupleThreads(supabase, eventId);

  // Viber-style archive split (Data Retention Schedule 2026-07-11). Archiving
  // deletes nothing — it just moves a thread out of the active list into the
  // collapsible "Archived" section; a new message auto-un-archives it.
  const returnTo = `/dashboard/${eventId}/messages`;
  // Exclusivity (payment-gated lock): a 'displaced' inquiry — the couple locked
  // another vendor in this hard-single group — is closed, so fold it into the
  // Archived section on this side too (never in the active list). Only exists
  // when the flag is on; inert otherwise.
  const isDisplaced = (t: (typeof threads)[number]) => t.inquiry_status === 'displaced';
  // Removed (archive-not-delete): the couple withdrew this inquiry / removed the
  // vendor. The thread + messages are PRESERVED as the evidence record — it just
  // folds into "Archived" (re-openable; re-adding the vendor un-archives it).
  const isRemoved = (t: (typeof threads)[number]) => t.archived_at != null;
  const activeThreads = threads.filter((t) => !t.archived && !isDisplaced(t) && !isRemoved(t));
  const archivedThreads = threads.filter((t) => t.archived || isDisplaced(t) || isRemoved(t));

  const renderRow = (t: (typeof threads)[number]) => {
    // Anonymity-aware thread label per CLAUDE.md 2026-05-30 row.
    // Free/Verified vendors who haven't yet replied show their
    // screen_name (Bark format) — paid + revealed + venue vendors
    // show real business_name. Single resolver call keeps the
    // Avatar initials + visible label in lock-step.
    const vendorDisplayName = t.vendor
      ? resolveVendorDisplayName({
          business_name: t.vendor.business_name ?? null,
          name_revealed_at: t.vendor.name_revealed_at ?? null,
          services: t.vendor.services ?? null,
          screen_name: t.vendor.screen_name ?? null,
          // Phase C: Pro/Enterprise reveal real business_name day-1. Open-it-up
          // lock: a VERIFIED vendor's name is never gated (any tier).
          isPaidTier: isTrueNameTier(t.vendor.tier_state ?? null),
          is_verified: t.vendor.verification_state === 'verified',
          primary_canonical_service: t.vendor.services?.[0] ?? null,
          location_city: t.vendor.location_city ?? null,
        })
      : 'Vendor';
    // Hybrid-anonymity logo gate (Data Flow Map audit gap #6): the
    // vendor's real logo is as identifying as the business name, so it
    // must stay masked until the SAME predicate that reveals the name
    // says reveal. Reuse `isVendorNameRevealed` (the single source of
    // truth behind `resolveVendorDisplayName`) so the logo and the
    // label can never drift — pre-reveal we pass null and the avatar
    // falls back to screen-name initials.
    const vendorNameRevealed = t.vendor
      ? isVendorNameRevealed({
          name_revealed_at: t.vendor.name_revealed_at ?? null,
          isPaidTier: isTrueNameTier(t.vendor.tier_state ?? null),
          is_verified: t.vendor.verification_state === 'verified',
          services: t.vendor.services ?? null,
        })
      : false;
    const vendorLogoUrl = vendorNameRevealed ? t.vendor?.logo_url ?? null : null;
    return (
      <li key={t.thread_id} className="flex items-stretch gap-2">
        <div className="min-w-0 flex-1">
          <ThreadListCard
            href={`/dashboard/${eventId}/messages/${t.thread_id}`}
            title={vendorDisplayName}
            avatar={<ThreadListAvatar logoUrl={vendorLogoUrl} name={vendorDisplayName} />}
            badge={
              t.archived_at != null ? (
                <span className="mt-0.5 inline-block rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
                  Removed
                </span>
              ) : t.inquiry_status === 'pending' ? (
                <span className="mt-0.5 inline-block rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta-700">
                  Waiting for reply
                </span>
              ) : t.inquiry_status === 'accepted' ? (
                // Accepted (inquiry-accepted-visibility 2026-06-16) — the
                // vendor took the inquiry, the thread is open + the name is
                // revealed. Emerald matches the inquiry_accepted notification
                // tone so the couple reads "this one's live" at a glance.
                <span className="mt-0.5 inline-block rounded-full bg-success-100 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-success-800">
                  Ready to quote
                </span>
              ) : t.inquiry_status === 'declined' ? (
                <span className="mt-0.5 inline-block rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
                  Not available
                </span>
              ) : t.inquiry_status === 'displaced' ? (
                <span className="mt-0.5 inline-block rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
                  You booked another
                </span>
              ) : null
            }
            timestampLine={<>Last activity {formatChatTimestamp(t.updated_at)}</>}
          />
        </div>
        <ThreadArchiveToggle threadId={t.thread_id} returnTo={returnTo} archived={t.archived} />
      </li>
    );
  };

  return (
    <section className="space-y-6">
      <PageMasthead
        title="Messages"
      />

      {search.error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {search.error}
        </p>
      ) : null}

      <section className="sn-tile p-5">
        <h2 className="sn-eye mb-3">Start a new thread</h2>
        {search.prefill_vendor_email ? (
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-terracotta/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
            Pre-filled from vendor profile · just tap Start thread
          </p>
        ) : null}
        <form
          action={startThreadByVendorEmail}
          className="flex flex-col gap-2 sm:flex-row sm:items-stretch"
        >
          <input type="hidden" name="event_id" value={eventId} />
          <input
            name="vendor_email"
            type="email"
            required
            placeholder="vendor's contact email"
            defaultValue={search.prefill_vendor_email ?? ''}
            autoFocus={!!search.prefill_vendor_email}
            className="input-field flex-1"
          />
          <SubmitButton
            className="button-primary inline-flex items-center justify-center gap-2"
            pendingLabel="Starting…"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            Start thread
          </SubmitButton>
        </form>
        <p className="mt-2 text-xs text-ink/55">
          The vendor must already have a Setnayan vendor account with this email on their
          profile. New thread or resume an existing one — Setnayan keeps one per pair.
        </p>
      </section>

      {threads.length === 0 ? (
        <div className="sn-row border-dashed p-8 text-center">
          <MessageSquare
            aria-hidden
            className="mx-auto mb-2 h-6 w-6 text-ink/30"
            strokeWidth={1.5}
          />
          <p className="text-sm font-medium text-ink">No conversations yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
            Start a thread with the form above. You&rsquo;ll need the vendor&rsquo;s
            contact email — the same one they listed on their Setnayan vendor profile.
            Already tracking a vendor on the Vendors page? Their contact email is
            on their card.
          </p>
          <div className="mt-4">
            <Link
              href={`/dashboard/${eventId}/vendors`}
              className="button-secondary"
            >
              Open vendors
            </Link>
          </div>
        </div>
      ) : (
        <>
          {activeThreads.length > 0 ? (
            <ul className="space-y-2">{activeThreads.map(renderRow)}</ul>
          ) : (
            <p className="sn-row border-dashed px-4 py-6 text-center text-sm text-ink/60">
              No active conversations — everything&rsquo;s tucked into Archived below.
            </p>
          )}

          {archivedThreads.length > 0 ? (
            <details className="sn-row mt-4">
              <summary className="sn-eye cursor-pointer list-none px-4 py-3 hover:text-ink">
                Archived · <span className="font-mono">{archivedThreads.length}</span>
              </summary>
              <ul className="space-y-2 px-2 pb-3">{archivedThreads.map(renderRow)}</ul>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
