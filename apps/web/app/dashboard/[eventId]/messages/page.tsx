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
import { logQueryError } from '@/lib/supabase/error-detect';
import { teamPicksForMessages, type TeamProfile, type TeamRow } from '@/lib/messages-team-picker';
import { StartThreadPicker } from './_components/start-thread-picker';

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

  // ── Who the couple can start a conversation with: the suppliers on Your
  // Team (the same `event_vendors` rows the Your Team page reads). See
  // lib/messages-team-picker.ts for why this replaced the email box.
  // 🔴 AN UNREAD TEAM IS NOT AN EMPTY TEAM. A refused read must not tell a
  // couple with five suppliers to "add a supplier first" — `teamReadFailed`
  // reaches the render and says what actually happened.
  const teamRes = await supabase
    .from('event_vendors')
    .select('vendor_id, marketplace_vendor_id')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (teamRes.error) {
    logQueryError('CoupleMessagesPage.team', teamRes.error, { event_id: eventId }, 'graceful_degrade');
  }
  const teamRows = (teamRes.data ?? []) as TeamRow[];
  const shopIds = [
    ...new Set(teamRows.map((r) => r.marketplace_vendor_id).filter((v): v is string => Boolean(v))),
  ];
  // Same columns the thread list's vendor embed reads (lib/chat.ts
  // COUPLE_VENDOR_EMBED), under the couple's own session — the anonymity
  // resolver needs them. A failed read shows no names, never real ones.
  const profRes = shopIds.length
    ? await supabase
        .from('vendor_profiles')
        .select(
          'vendor_profile_id, business_name, screen_name, name_revealed_at, services, location_city, tier_state, verification_state',
        )
        .in('vendor_profile_id', shopIds)
    : { data: [] as TeamProfile[], error: null };
  if (profRes.error) {
    logQueryError('CoupleMessagesPage.teamNames', profRes.error, { event_id: eventId }, 'graceful_degrade');
  }
  const teamReadFailed = Boolean(teamRes.error);
  const team = teamPicksForMessages(teamRows, (profRes.data ?? []) as TeamProfile[]);

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
      : 'Supplier';
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
        <h2 className="sn-eye mb-3">Start a conversation</h2>
        {teamReadFailed ? (
          <p role="alert" className="text-sm text-ink/70">
            We couldn&rsquo;t load your team just now &mdash; this does not mean it is
            empty. Reload in a moment.
          </p>
        ) : team.length > 0 ? (
          <StartThreadPicker eventId={eventId} team={team} />
        ) : (
          <p className="text-sm text-ink/70">
            Nobody on your team can be messaged yet. Add a supplier from Setnayan to{' '}
            <Link
              href={`/dashboard/${eventId}/vendors`}
              className="font-medium text-mulberry underline underline-offset-2"
            >
              Your Team
            </Link>{' '}
            and you can message them from here.
          </p>
        )}
        {/* The old email box, kept for ONE arrival only: the budget card's
            Message link for a supplier the couple typed in by hand carries the
            address THEY typed (`prefill_vendor_email` — never a Setnayan shop's,
            see vendor-itemization-card.tsx). If that address belongs to a shop,
            this opens it; otherwise the action says so. No arrival → no box. */}
        {search.prefill_vendor_email ? (
          <form action={startThreadByVendorEmail} className="mt-3">
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="vendor_email" value={search.prefill_vendor_email} />
            <SubmitButton
              className="button-secondary inline-flex items-center justify-center gap-2"
              pendingLabel="Looking…"
            >
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
              Look for {search.prefill_vendor_email} on Setnayan
            </SubmitButton>
          </form>
        ) : null}
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
            {/* 🚪 Corrected 2026-09-10. This said the email is "the same one
                they listed on their Setnayan vendor profile" and "on their
                card" — neither shows a shop's email any more (owner: "not to let
                them communicate outside the app"). The way to reach a shop on
                Setnayan is its Message / Inquire button, which opens the
                conversation here. */}
            Pick a supplier above, or tap Inquire on any shop&rsquo;s page &mdash;
            the conversation opens right here.
          </p>
          <div className="mt-4">
            <Link
              href={`/dashboard/${eventId}/vendors`}
              className="button-secondary"
            >
              Open Your Team
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
