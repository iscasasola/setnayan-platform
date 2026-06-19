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
import { FollowGate } from '@/app/_components/follow-gate';
import { isFollowingVendor } from '@/lib/follow';
import { resolveVendorDisplayName } from '@/lib/vendors';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';
import { startThreadByVendorEmail } from './actions';

export const metadata = { title: 'Messages' };

type Props = {
  params: Promise<{ eventId: string }>;
  // `next_action` + `vendor_profile_id` are populated by `startThreadByVendorEmail`
  // when the couple hits the iteration 0019 follow gate (anti-spam: must follow
  // a vendor before opening a new thread). They drive the inline <FollowGate>
  // mount below — see CLAUDE.md 2026-05-14 row 4 + 2026-05-19 row 10.
  searchParams: Promise<{
    error?: string;
    prefill_vendor_email?: string;
    next_action?: string;
    vendor_profile_id?: string;
  }>;
};

export default async function CoupleMessagesPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const threads = await fetchCoupleThreads(supabase, eventId);

  // Follow-gate recovery state — when `startThreadByVendorEmail` redirected us
  // back here with `?next_action=follow&vendor_profile_id=<UUID>`, resolve the
  // vendor's business name + contact email so the inline <FollowGate> can show
  // brand-voice copy + arm the prefilled Message button. The follow-state
  // re-check covers the race where the couple followed via another tab
  // between the redirect and this render — in that case skip the gate UI.
  // WHY: iteration 0019 follow gate is anti-spam (couples must follow before
  // opening a new thread). The server action correctly redirects with
  // `next_action=follow` + `vendor_profile_id` params, but this page wasn't
  // consuming them — couple was stranded with only the generic error toast.
  // Cross-ref CLAUDE.md 2026-05-14 row 4 + 2026-05-19 row 10 +
  // System_Wiring_Map_2026-05-28 RED #1.
  const showFollowGate =
    search.next_action === 'follow' && typeof search.vendor_profile_id === 'string' && search.vendor_profile_id.length > 0;
  let followGateVendor: { name: string; email: string | null; alreadyFollowing: boolean } | null = null;
  if (showFollowGate && search.vendor_profile_id) {
    // Anonymity surface fields per CLAUDE.md 2026-05-30 row — couples on
    // the follow-gate surface see the same Free/Verified screen_name OR
    // revealed business_name the rest of the marketplace + microsite
    // surfaces show. Resolution via `resolveVendorDisplayName` keeps the
    // gate copy in lock-step with VendorCard + /v/[slug].
    const { data: vendor } = await supabase
      .from('vendor_profiles')
      .select(
        'business_name, contact_email, screen_name, name_revealed_at, services, location_city, tier_state',
      )
      .eq('vendor_profile_id', search.vendor_profile_id)
      .maybeSingle();
    if (vendor) {
      let alreadyFollowing = false;
      try {
        alreadyFollowing = await isFollowingVendor(supabase, user.id, search.vendor_profile_id);
      } catch {
        // Graceful degrade: treat lookup failure as not-following so the
        // gate still surfaces — better to show a redundant Follow button
        // than to silently swallow the recovery path.
        alreadyFollowing = false;
      }
      const displayName = resolveVendorDisplayName({
        business_name: vendor.business_name ?? null,
        name_revealed_at: vendor.name_revealed_at ?? null,
        services: vendor.services ?? null,
        screen_name: vendor.screen_name ?? null,
        // Phase C: Pro/Enterprise reveal real business_name day-1.
        isPaidTier: isTrueNameTier(vendor.tier_state ?? null),
        primary_canonical_service: vendor.services?.[0] ?? null,
        location_city: vendor.location_city ?? null,
      });
      followGateVendor = {
        name: displayName.length > 0 ? displayName : 'this vendor',
        email: vendor.contact_email ?? null,
        alreadyFollowing,
      };
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Messages</h1>
        <p className="max-w-prose text-base text-ink/65">
          One thread per vendor you&rsquo;re working with. Vendors find you via the email on
          your invitation site or by starting their own thread.
        </p>
      </header>

      {search.error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {search.error}
        </p>
      ) : null}

      {showFollowGate && followGateVendor && search.vendor_profile_id ? (
        <section
          aria-labelledby="follow-gate-heading"
          className="space-y-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-5"
        >
          <div className="space-y-1">
            <h2
              id="follow-gate-heading"
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta-700"
            >
              Follow first, then chat
            </h2>
            <p className="text-sm text-ink/80">
              Follow{' '}
              <span className="font-semibold text-ink">{followGateVendor.name}</span>{' '}
              first to start a thread. You&rsquo;ll be able to message them right after.
            </p>
          </div>
          <FollowGate
            vendorProfileId={search.vendor_profile_id}
            vendorName={followGateVendor.name}
            vendorEmail={followGateVendor.email}
            isAuthenticated={true}
            initialFollowing={followGateVendor.alreadyFollowing}
            eventId={eventId}
            revalidatePath={`/dashboard/${eventId}/messages`}
          />
        </section>
      ) : null}

      <section className="rounded-xl border border-ink/10 bg-cream p-5">
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Start a new thread
        </h2>
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
        <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center">
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
        <ul className="space-y-2">
          {threads.map((t) => {
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
                  // Phase C: Pro/Enterprise reveal real business_name day-1.
                  isPaidTier: isTrueNameTier(t.vendor.tier_state ?? null),
                  primary_canonical_service: t.vendor.services?.[0] ?? null,
                  location_city: t.vendor.location_city ?? null,
                })
              : 'Vendor';
            return (
              <li key={t.thread_id}>
                <ThreadListCard
                  href={`/dashboard/${eventId}/messages/${t.thread_id}`}
                  title={vendorDisplayName}
                  avatar={
                    <ThreadListAvatar
                      logoUrl={t.vendor?.logo_url ?? null}
                      name={vendorDisplayName}
                    />
                  }
                  badge={
                    t.inquiry_status === 'pending' ? (
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
                    ) : null
                  }
                  timestampLine={<>Last activity {formatChatTimestamp(t.updated_at)}</>}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
