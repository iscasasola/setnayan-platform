import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchReturningClientFlags,
  fetchVendorThreads,
  formatChatTimestamp,
} from '@/lib/chat';
import {
  fetchInquiryMaskMeta,
  inquiryPlaceholderLabel,
  isInquiryRevealed,
} from '@/lib/inquiry-mask.server';
import { ThreadListCard } from '@/app/_components/chat/thread-list-card';
import { ThreadArchiveToggle } from '@/app/_components/chat/thread-archive-toggle';
import { RevealList } from '@/app/_components/reveal-list';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorOutcomeRollup } from '@/lib/inquiry-outcomes';
import { InquiryOutcomesRollup } from './_components/inquiry-outcomes-rollup';

export const metadata = { title: 'Messages · Vendor' };

export default async function VendorMessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const threads = await fetchVendorThreads(supabase, profile.vendor_profile_id);

  // Returning-client badge (owner-locked 2026-06-12): for PENDING inquiries
  // only, flag threads whose couple previously CONFIRMED-booked this vendor on
  // a different event. ONE batched RPC for all pending threads (no N+1);
  // graceful-degrades to an empty map pre-migration.
  const returningFlags = await fetchReturningClientFlags(
    supabase,
    profile.vendor_profile_id,
    threads.filter((t) => t.inquiry_status === 'pending').map((t) => t.event_id),
  );

  // Won & Lost Reasons roll-up (Wave 6) — the vendor's own self-reported outcome
  // breakdown. Ownership-gated RPC; renders nothing until at least one outcome
  // is logged (graceful-degrades to null pre-migration).
  const outcomeRollup = await fetchVendorOutcomeRollup(
    supabase,
    profile.vendor_profile_id,
  );

  // Anonymization-until-accept (Glass PR-6b): PRE-accept threads have had the
  // couple's identity stripped from the DTO by fetchVendorThreads. Batch-read
  // ONLY event_type + city-level region (never name/venue) so each unrevealed
  // row can show the neutral placeholder instead of a bare "Event".
  const inquiryMaskMeta = await fetchInquiryMaskMeta(
    createAdminClient(),
    threads.filter((t) => !isInquiryRevealed(t)).map((t) => t.event_id),
  );

  // Viber-style archive split (Data Retention Schedule 2026-07-11) — archiving
  // deletes nothing; it moves a thread into the collapsible Archived section
  // until a new message auto-un-archives it.
  const returnTo = '/vendor-dashboard/messages';
  // Exclusivity (payment-gated lock): a 'displaced' inquiry — the couple booked
  // another vendor in this hard-single group — is closed, so fold it into the
  // Archived section here too (out of the active list). Only exists when the
  // flag is on; inert otherwise.
  const isDisplaced = (t: (typeof threads)[number]) => t.inquiry_status === 'displaced';
  const activeThreads = threads.filter((t) => !t.archived && !isDisplaced(t));
  const archivedThreads = threads.filter((t) => t.archived || isDisplaced(t));

  const renderRow = (t: (typeof threads)[number]) => {
    const returning =
      t.inquiry_status === 'pending' ? returningFlags.get(t.event_id) : undefined;
    return (
      <li key={t.thread_id} data-reveal-item className="flex items-stretch gap-2">
        <div className="min-w-0 flex-1">
          <ThreadListCard
            href={`/vendor-dashboard/messages/${t.thread_id}`}
            title={
              isInquiryRevealed(t)
                ? (t.event?.display_name ?? 'Event')
                : inquiryPlaceholderLabel(inquiryMaskMeta.get(t.event_id) ?? {})
            }
            badge={
              t.inquiry_status === 'pending' ? (
                <span className="mt-0.5 inline-block rounded-full bg-mulberry/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-mulberry">
                  New inquiry · accept to reply
                </span>
              ) : t.inquiry_status === 'declined' ? (
                <span className="mt-0.5 inline-block rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
                  Declined
                </span>
              ) : t.inquiry_status === 'displaced' ? (
                <span className="mt-0.5 inline-block rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
                  Released · booked another
                </span>
              ) : null
            }
            extra={
              returning ? (
                <>
                  <span
                    className="ml-1 mt-0.5 inline-block rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta"
                    title={
                      returning.resync_flat
                        ? 'A client you previously locked — accepting costs just 1 token'
                        : 'A client you previously locked'
                    }
                  >
                    Returning client
                  </span>
                  <p className="mt-0.5 truncate text-xs text-ink/65">
                    Booked you for{' '}
                    {returning.prior_event_display_name ?? 'a previous event'}
                    {returning.resync_flat ? ' · accepting costs just 1 token' : ''}
                  </p>
                </>
              ) : null
            }
            timestampLine={
              <>
                {t.event?.event_date ? `${t.event.event_date} · ` : ''}
                Last activity {formatChatTimestamp(t.updated_at)}
              </>
            }
          />
        </div>
        <ThreadArchiveToggle threadId={t.thread_id} returnTo={returnTo} archived={t.archived} />
      </li>
    );
  };

  return (
    <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Conversations</h1>
        <p className="text-base text-ink/65">
          One thread per couple who&rsquo;s reached out. Couples appear as the event they
          identified themselves with — personal names stay private until they choose to share.
        </p>
      </header>

      <InquiryOutcomesRollup rollup={outcomeRollup} />

      {threads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/20 p-8 text-center">
          <MessageSquare
            aria-hidden
            className="mx-auto mb-2 h-6 w-6 text-ink/30"
            strokeWidth={1.5}
          />
          <p className="text-sm font-medium text-ink">No conversations yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
            Couples start threads from their dashboard using your contact email. Make
            sure your{' '}
            <Link href="/vendor-dashboard" className="text-terracotta hover:underline">
              vendor profile
            </Link>{' '}
            is filled in and your contact email is right — that&rsquo;s the field
            couples search by.
          </p>
        </div>
      ) : (
        <>
          {activeThreads.length > 0 ? (
            <RevealList as="ul" className="space-y-2">
              {activeThreads.map(renderRow)}
            </RevealList>
          ) : (
            <p className="rounded-xl border border-dashed border-ink/20 px-4 py-6 text-center text-sm text-ink/60">
              No active conversations — everything&rsquo;s tucked into Archived below.
            </p>
          )}

          {archivedThreads.length > 0 ? (
            <details className="sn-row mt-4">
              <summary className="cursor-pointer list-none px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55 hover:text-ink">
                Archived · {archivedThreads.length}
              </summary>
              <ul className="space-y-2 px-2 pb-3">{archivedThreads.map(renderRow)}</ul>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
