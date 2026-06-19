import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Coins,
  MessageSquare,
  Sparkles,
  Star,
  ArrowRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  fetchOwnVendorProfile,
  fetchVendorCompletedEventStats,
  profileCompletion,
} from '@/lib/vendor-profile';
import { fetchVendorThreads } from '@/lib/chat';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';

/**
 * /vendor-dashboard — vendor doorway HOME / Overview page.
 *
 * WHY (2026-05-29 · session pivot after the shop-console crash chain was
 * resolved by PR #634): Owner observation — "shouldn't home be a complete
 * overview of our schedules, business, events, services, inquiries?"
 * Pre-this-PR, the /vendor-dashboard root route WAS the profile editor —
 * vendors clicking Shop console dropped straight into a long edit form.
 * That's functional but not a HOME. Customer-side dashboard established
 * the pattern (TodaysOneThing + UpcomingSchedules + ActivityFeed); vendor
 * side mirrors it now.
 *
 * SHIPS:
 *   - Welcome header with vendor business name + verification chip
 *   - Profile completion nudge (only when < 100%)
 *   - 6 stat tiles (PR #636 shipped 4; 2026-05-29 expanded to 6 +
 *     fixed the duplicate-tile bug · Tile 1 + Tile 2 both rendered
 *     the same upcomingCount in PR #636).
 *     · Upcoming events · upcomingCount (next 14 days from threads)
 *     · Open inquiries · totalThreadsCount (all chat threads · FIXED)
 *     · Confirmed bookings · accepted inquiry threads (chat_threads)
 *     · Active services · vendor_services is_active=true (NEW)
 *     · Completed events · public count
 *     · Token balance · purchased + earned
 *   - Upcoming events strip (next 14 days from chat threads)
 *   - Recent activity placeholder (V1.x: pull notifications · chat
 *     messages · booking events · review notifications into one feed)
 *
 * Profile editor moved to /vendor-dashboard/profile in the same PR.
 * Sidebar Home group gains an Overview entry pointing here; existing
 * Profile entry now points at /vendor-dashboard/profile. Role-pill
 * "Shop console" target unchanged (/vendor-dashboard) — vendors still
 * land on Home first.
 *
 * Per memory rules:
 *   - feedback_setnayan_no_dev_text_post_launch: brand-voice editorial
 *     copy throughout — no engineering jargon
 *   - feedback_setnayan_orphan_prevention: every stat tile + section
 *     has explicit routed exits (Bookings · Messages · Tokens · Profile)
 *   - feedback_setnayan_document_changes_with_why: WHY block above
 *
 * Cross-references:
 *   - apps/web/app/dashboard/[eventId]/page.tsx · customer home this
 *     mirrors at a vendor-data-shape level
 *   - apps/web/app/vendor-dashboard/profile/page.tsx · the editor that
 *     was previously at this route
 *   - CLAUDE.md 2026-05-29 row "Vendor home overview ship" · this PR
 */

export const metadata = { title: 'Vendor home · Setnayan' };

type LoaderState =
  | {
      ok: true;
      profileExists: boolean;
      businessName: string;
      isVerified: boolean;
      /* V2.1 brief amendment #2 (2026-05-30 · CLAUDE.md row "🔒 V2.1
       * BRIEF AMENDMENT #2 LOCKED" § 1(d) + memory rule
       * [[project_setnayan_vendor_hybrid_anonymity]]). NULL = the
       * vendor's business_name is hidden in marketplace cards +
       * microsite + browse · the vendor-dashboard surface needs this
       * to render the canonical "Your business name is currently
       * hidden in browse" banner pointing at the chat inbox. Non-NULL
       * = name globally revealed (DB trigger stamps on first vendor
       * chat reply · PR #662 / migration 20260530010000) · banner
       * suppressed. The Pro/Enterprise paid-tier override isn't
       * surfaced here yet (no subscription join exists); the canonical
       * banner gate still works correctly because the trigger fires
       * on any vendor reply regardless of tier, so a Pro vendor's
       * first reply also stamps the column and suppresses the banner. */
      nameRevealedAt: string | null;
      completedStats: { public_completed_count: number; full_completed_count: number };
      upcomingThreads: Awaited<ReturnType<typeof fetchVendorThreads>>;
      totalThreadsCount: number;
      activeServicesCount: number;
      confirmedBookingsCount: number;
      tokenBalance: { purchased: number; earned: number };
      completion: { done: number; total: number; missing: string[] };
    }
  | { ok: false; message: string };

const TODAY_PLUS_14D_MS = 14 * 24 * 60 * 60 * 1000;

function isUpcomingWithin14Days(eventDate: string | null): boolean {
  if (!eventDate) return false;
  const event = new Date(`${eventDate}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = event.getTime() - now.getTime();
  return diff >= 0 && diff <= TODAY_PLUS_14D_MS;
}

function formatShortDate(eventDate: string | null): string {
  if (!eventDate) return '—';
  const d = new Date(`${eventDate}T00:00:00`);
  return d.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

/**
 * Team-member (agent/viewer) home — shown to non-owner members until Phase-2
 * per-service scoping opens their assigned services + customers. Keeps the
 * agent out of the owner "set up your profile" flow they can't act on.
 */
function AgentHome() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">Setnayan · Vendor</p>
        <h1 className="m-display-tight text-3xl text-[color:var(--m-ink)] sm:text-4xl">
          You&apos;re on the team
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Your account is set up as a team member. The services and customers your
          owner assigns to you will appear here — scoped access is rolling out
          shortly. There&apos;s nothing you need to do right now.
        </p>
      </header>
      <div className="m-card p-5 text-sm" style={{ color: 'var(--m-slate)' }}>
        Need access to something now? Ask your vendor owner to assign you to the
        services you&apos;ll be managing.
      </div>
    </div>
  );
}

export default async function VendorHomePage() {
  let loaderState: LoaderState;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    // Role-aware home — agent/viewer members don't own the profile and (until
    // Phase-2 per-service scoping lands) have no scoped data yet. Show them a
    // clear team-member landing instead of the owner "set up your profile"
    // state. Owner/admin fall through to the full overview below.
    const vendorRole = await resolveVendorRole(supabase, user.id);
    if (vendorRole && !canManageVendor(vendorRole)) {
      return <AgentHome />;
    }

    const profile = await fetchOwnVendorProfile(supabase, user.id);

    if (!profile) {
      loaderState = {
        ok: true,
        profileExists: false,
        businessName: 'Vendor',
        isVerified: false,
        /* No profile · banner irrelevant. */
        nameRevealedAt: null,
        completedStats: { public_completed_count: 0, full_completed_count: 0 },
        upcomingThreads: [],
        totalThreadsCount: 0,
        activeServicesCount: 0,
        confirmedBookingsCount: 0,
        tokenBalance: { purchased: 0, earned: 0 },
        completion: profileCompletion(null),
      };
    } else {
      // Expanded data fetch (2026-05-29 · Task #10).
      // Owner directive · "shouldn't home be a complete overview of our
      // schedules, business, events, services, inquiries?" Pre-this-PR
      // the 4 stat tiles double-counted inquiries (Tile 1 and Tile 2
      // both showed the same upcomingCount). This adds:
      //   - Active services count (vendor_services where is_active=true)
      //   - Confirmed bookings count — derived below from threadsAll
      //     (accepted inquiry threads). See the derivation note for why
      //     this is no longer an event_vendors count.
      // The services fetch uses head:true + count='exact' so we get the
      // count without pulling rows. Safe to run in parallel with the
      // existing fetches — neither depends on the others.
      /* V2.1 brief amendment #2 (2026-05-30) · grab name_revealed_at
         alongside the existing 5 parallel fetches so the welcome
         header can decide whether to render the "Your business name
         is currently hidden in browse" banner with a deep-link to
         the chat inbox. Fail-soft via the maybeSingle + null
         destructure · pre-migration deploys (and the rare RLS edge
         case) collapse to "name still hidden", which is the
         conservative default for a brand-new vendor who hasn't
         replied to anyone yet anyway. */
      const [
        threadsAll,
        completedRes,
        walletRes,
        servicesCountRes,
        nameRevealRes,
      ] = await Promise.all([
        fetchVendorThreads(supabase, profile.vendor_profile_id),
        fetchVendorCompletedEventStats(supabase, profile.vendor_profile_id),
        supabase
          .from('vendor_wallets')
          .select('purchased_tokens, earned_tokens')
          .eq('vendor_id', profile.vendor_profile_id)
          .maybeSingle(),
        supabase
          .from('vendor_services')
          .select('vendor_service_id', { count: 'exact', head: true })
          .eq('vendor_profile_id', profile.vendor_profile_id)
          .eq('is_active', true),
        supabase
          .from('vendor_profiles')
          .select('name_revealed_at')
          .eq('vendor_profile_id', profile.vendor_profile_id)
          .maybeSingle(),
      ]);

      const upcomingThreads = threadsAll.filter((t) =>
        isUpcomingWithin14Days(t.event?.event_date ?? null),
      );

      // Confirmed bookings = accepted inquiry threads for this vendor,
      // derived from the already-fetched threadsAll (no extra query). Matches
      // the "accepted thread" booking definition in bookings/actions.ts
      // (isBookingForEvent). Replaces a prior event_vendors count that was
      // structurally always 0: event_vendors carries couple-only RLS
      // (event_vendors_couple_read/_write), so the vendor's session read zero
      // rows regardless of how many real bookings existed.
      const confirmedBookingsCount = threadsAll.filter(
        (t) => t.inquiry_status === 'accepted',
      ).length;

      loaderState = {
        ok: true,
        profileExists: true,
        businessName: profile.business_name ?? 'Vendor',
        isVerified:
          (profile as { public_visibility?: string }).public_visibility === 'verified',
        nameRevealedAt:
          (nameRevealRes.data as { name_revealed_at?: string | null } | null)
            ?.name_revealed_at ?? null,
        completedStats: completedRes,
        upcomingThreads,
        totalThreadsCount: threadsAll.length,
        activeServicesCount: servicesCountRes.count ?? 0,
        confirmedBookingsCount,
        tokenBalance: {
          purchased: walletRes.data?.purchased_tokens ?? 0,
          earned: walletRes.data?.earned_tokens ?? 0,
        },
        completion: profileCompletion(profile),
      };
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[/vendor-dashboard home] loader failed', err);
    const message = err instanceof Error ? err.message : String(err);
    loaderState = { ok: false, message };
  }

  if (!loaderState.ok) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-start gap-3">
          <AlertTriangle
            aria-hidden
            className="mt-0.5 h-6 w-6 shrink-0 text-terracotta"
            strokeWidth={1.75}
          />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Home is temporarily unavailable.
            </h1>
            <p className="text-sm text-ink/65">
              Refreshing usually clears this. Your data is safe.
            </p>
          </div>
        </header>
        {process.env.NODE_ENV !== 'production' ? (
          <pre className="overflow-auto rounded-md border border-ink/15 bg-ink/[0.03] p-3 text-xs text-ink/65">
            {loaderState.message}
          </pre>
        ) : null}
      </div>
    );
  }

  const {
    profileExists,
    businessName,
    isVerified,
    nameRevealedAt,
    completedStats,
    upcomingThreads,
    totalThreadsCount,
    activeServicesCount,
    confirmedBookingsCount,
    tokenBalance,
    completion,
  } = loaderState;

  const totalTokens = tokenBalance.purchased + tokenBalance.earned;
  const upcomingCount = upcomingThreads.length;
  const completionPct =
    completion.total === 0
      ? 0
      : Math.round((completion.done / completion.total) * 100);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* Welcome header */}
      <header className="mb-8 space-y-2">
        <p className="m-eyebrow" style={{ color: 'var(--m-orange-2)' }}>
          Vendor home
        </p>
        <h1 className="m-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {businessName}
        </h1>
        <div
          className="flex flex-wrap items-center gap-2 text-sm"
          style={{ color: 'var(--m-slate)' }}
        >
          {isVerified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700">
              <CheckCircle2 className="h-3 w-3" strokeWidth={2} aria-hidden />
              Verified vendor
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-warn-50 px-2 py-0.5 text-xs font-medium text-warn-700">
              Verification pending
            </span>
          )}
          <span>·</span>
          <span>
            Couples find you on the marketplace · 0% commission on every booking
          </span>
        </div>
      </header>

      {/* V2.1 brief amendment #2 (locked 2026-05-30 · CLAUDE.md row
       *  "🔒 V2.1 BRIEF AMENDMENT #2 LOCKED" § 1(d) + memory rule
       *  [[project_setnayan_vendor_hybrid_anonymity]]) · hybrid-
       *  anonymity reveal explainer banner.
       *
       *  Surfaces ONLY when the vendor's business_name is still
       *  hidden in browse — i.e., `nameRevealedAt IS NULL` AND the
       *  vendor has a profile (no profile = no marketplace surface =
       *  no banner). The DB trigger
       *  `reveal_vendor_name_on_chat` (PR #662 / migration
       *  20260530010000) stamps `vendor_profiles.name_revealed_at` on
       *  the vendor's FIRST chat reply to any customer · after which
       *  this banner is silenced forever (name cannot be re-hidden ·
       *  see memory rule).
       *
       *  Per [[feedback_setnayan_no_dev_text_post_launch]] copy uses
       *  brand-voice editorial register · no engineering jargon, no
       *  technical column names exposed. The CTA deep-links to the
       *  chat inbox so the vendor can reply to any pending thread —
       *  one reply reveals their name globally across every
       *  marketplace surface, every microsite, every wizard pick
       *  card. Per [[feedback_setnayan_orphan_prevention]] entry
       *  points: the banner itself is reachable from the canonical
       *  /vendor-dashboard surface (vendor's daily HOME · the
       *  role-pill "Shop console" target) · the CTA's destination
       *  /vendor-dashboard/messages is the existing sidebar Messages
       *  entry. */}
      {profileExists && nameRevealedAt === null ? (
        <Link
          href="/vendor-dashboard/messages"
          className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-warn-300/70 bg-warn-50 p-4 transition-colors hover:bg-warn-100"
        >
          <div className="space-y-1">
            <p className="m-label-mono text-warn-800">
              Your business name is currently hidden in browse
            </p>
            <p className="text-sm text-ink/85">
              Send your first chat reply to any customer to reveal it
              globally. After that, your name shows everywhere — your
              profile, your microsite, search results.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-warn-800">
            Open chat inbox
            <ArrowRight
              className="h-4 w-4"
              strokeWidth={1.75}
              aria-hidden
            />
          </span>
        </Link>
      ) : null}

      {/* Profile completion nudge */}
      {profileExists && completionPct < 100 ? (
        <Link
          href="/vendor-dashboard/profile"
          className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-terracotta/30 bg-terracotta/[0.06] p-4 transition-colors hover:bg-terracotta/[0.1]"
        >
          <div className="space-y-1">
            <p className="m-label-mono text-terracotta">Finish your profile</p>
            <p className="text-sm text-ink">
              You&rsquo;re {completionPct}% complete. Couples find verified, complete profiles first.
            </p>
          </div>
          <ArrowRight
            className="h-5 w-5 shrink-0 text-terracotta"
            strokeWidth={1.75}
            aria-hidden
          />
        </Link>
      ) : null}

      {/* No-profile state for team members */}
      {!profileExists ? (
        <div className="mb-6 rounded-2xl border border-ink/10 bg-cream p-6">
          <p className="m-eyebrow" style={{ color: 'var(--m-orange-2)' }}>
            Team access
          </p>
          <h2 className="mt-2 text-xl font-semibold">You&rsquo;re on a vendor team.</h2>
          <p className="mt-2 text-sm text-ink/70">
            You don&rsquo;t own a vendor profile yet. Reach the team owner to be
            added to bookings + chats, or
            <Link
              href="/signup?as=vendor"
              className="ml-1 text-terracotta underline"
            >
              create your own
            </Link>
            .
          </p>
        </div>
      ) : null}

      {/* Stat tiles row · 6 tiles (2026-05-29 · Task #10).
       *  Pre-this-PR Tile 1 (Upcoming bookings) and Tile 2 (Open
       *  inquiries) both rendered upcomingCount — a duplicate-count
       *  bug shipped with PR #636. This row fixes both + adds Active
       *  services + Confirmed bookings tiles per owner directive
       *  "shouldn't home be a complete overview of our schedules,
       *  business, events, services, inquiries?"
       *
       *  Tile semantics:
       *    1. Upcoming events    · upcomingCount (renamed from
       *       Upcoming bookings · these are chat threads with events
       *       in the next 14 days).
       *    2. Open inquiries     · totalThreadsCount (FIXED · all chat
       *       threads regardless of date · the true inquiry count).
       *    3. Confirmed bookings · accepted inquiry threads (chat_threads
       *       where inquiry_status='accepted' · matches isBookingForEvent
       *       in bookings/actions.ts). Previously an event_vendors count
       *       that always read 0 under that table's couple-only RLS.
       *    4. Active services    · vendor_services where is_active=true.
       *    5. Completed events   · public_completed_count (unchanged).
       *    6. Token balance      · purchased + earned (unchanged).
       *
       *  Layout: 2 columns mobile · 3 columns sm · 6 columns lg ·
       *  follows the existing dashboard breakpoints. */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile
          icon={<Briefcase className="h-4 w-4" strokeWidth={1.75} />}
          label="Upcoming events"
          value={String(upcomingCount)}
          sub="Next 14 days"
          href="/vendor-dashboard/bookings"
        />
        <StatTile
          icon={<MessageSquare className="h-4 w-4" strokeWidth={1.75} />}
          label="Open inquiries"
          value={String(totalThreadsCount)}
          sub="From couples"
          href="/vendor-dashboard/messages"
        />
        <StatTile
          icon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />}
          label="Confirmed bookings"
          value={String(confirmedBookingsCount)}
          sub="Locked-in events"
          href="/vendor-dashboard/bookings"
        />
        <StatTile
          icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} />}
          label="Active services"
          value={String(activeServicesCount)}
          sub="What you offer"
          href="/vendor-dashboard/services"
        />
        <StatTile
          icon={<Star className="h-4 w-4" strokeWidth={1.75} />}
          label="Completed events"
          value={String(completedStats.public_completed_count)}
          sub="Public count"
          href="/vendor-dashboard/profile"
        />
        <StatTile
          icon={<Coins className="h-4 w-4" strokeWidth={1.75} />}
          label="Token balance"
          value={String(totalTokens)}
          sub={`${tokenBalance.earned} earned · ${tokenBalance.purchased} bought`}
          href="/vendor-dashboard/tokens"
        />
      </section>

      {/* Upcoming events */}
      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="m-label-mono" style={{ color: 'var(--m-slate)' }}>
            Upcoming events · next 14 days
          </h2>
          <Link
            href="/vendor-dashboard/bookings"
            className="text-xs text-terracotta hover:underline"
          >
            View all bookings →
          </Link>
        </div>
        {upcomingThreads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-6 text-center">
            <p className="text-sm text-ink/65">
              No events booked in the next 14 days. New inquiries from couples
              land in Messages.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {upcomingThreads.slice(0, 5).map((t) => (
              <li key={t.thread_id}>
                <Link
                  href={`/vendor-dashboard/messages/${t.thread_id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-cream p-4 transition-colors hover:bg-ink/[0.03]"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-ink">
                      {t.event?.display_name ?? 'Upcoming event'}
                    </p>
                    <p
                      className="m-label-mono"
                      style={{ color: 'var(--m-slate)' }}
                    >
                      {formatShortDate(t.event?.event_date ?? null)}
                    </p>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-ink/40"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent activity placeholder */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="m-label-mono" style={{ color: 'var(--m-slate)' }}>
            Recent activity
          </h2>
          <Link
            href="/vendor-dashboard/messages"
            className="text-xs text-terracotta hover:underline"
          >
            See messages →
          </Link>
        </div>
        <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-6 text-center">
          <p className="text-sm text-ink/65">
            New messages, booking confirmations, and review notifications land here.
            For now, check{' '}
            <Link
              href="/vendor-dashboard/messages"
              className="text-terracotta underline"
            >
              Messages
            </Link>{' '}
            for couple-side activity.
          </p>
        </div>
      </section>
    </div>
  );
}

type StatTileProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  href: string;
};

function StatTile({ icon, label, value, sub, href }: StatTileProps) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-ink/10 bg-cream p-4 transition-colors hover:bg-ink/[0.03]"
    >
      <div className="mb-2 flex items-center gap-1.5 text-ink/55">
        {icon}
        <span className="m-label-mono text-xs">{label}</span>
      </div>
      <p className="font-display text-3xl font-semibold tabular-nums text-ink">
        {value}
      </p>
      <p className="mt-1 text-xs text-ink/55">{sub}</p>
    </Link>
  );
}
