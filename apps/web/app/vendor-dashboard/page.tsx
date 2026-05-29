import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Coins,
  MessageSquare,
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
 *   - 4 stat tiles · Upcoming bookings · Open inquiries · Completed
 *     events · Token balance
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
      completedStats: { public_completed_count: number; full_completed_count: number };
      upcomingThreads: Awaited<ReturnType<typeof fetchVendorThreads>>;
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

export default async function VendorHomePage() {
  let loaderState: LoaderState;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const profile = await fetchOwnVendorProfile(supabase, user.id);

    if (!profile) {
      loaderState = {
        ok: true,
        profileExists: false,
        businessName: 'Vendor',
        isVerified: false,
        completedStats: { public_completed_count: 0, full_completed_count: 0 },
        upcomingThreads: [],
        tokenBalance: { purchased: 0, earned: 0 },
        completion: profileCompletion(null),
      };
    } else {
      const [threadsAll, completedRes, walletRes] = await Promise.all([
        fetchVendorThreads(supabase, profile.vendor_profile_id),
        fetchVendorCompletedEventStats(supabase, profile.vendor_profile_id),
        supabase
          .from('vendor_wallets')
          .select('purchased_tokens, earned_tokens')
          .eq('vendor_id', profile.vendor_profile_id)
          .maybeSingle(),
      ]);

      const upcomingThreads = threadsAll.filter((t) =>
        isUpcomingWithin14Days(t.event?.event_date ?? null),
      );

      loaderState = {
        ok: true,
        profileExists: true,
        businessName: profile.business_name ?? 'Vendor',
        isVerified:
          (profile as { public_visibility?: string }).public_visibility === 'verified',
        completedStats: completedRes,
        upcomingThreads,
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
    completedStats,
    upcomingThreads,
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
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3 w-3" strokeWidth={2} aria-hidden />
              Verified vendor
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              Verification pending
            </span>
          )}
          <span>·</span>
          <span>
            Couples find you on the marketplace · 0% commission on every booking
          </span>
        </div>
      </header>

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

      {/* 4-stat row */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={<Briefcase className="h-4 w-4" strokeWidth={1.75} />}
          label="Upcoming bookings"
          value={String(upcomingCount)}
          sub="Next 14 days"
          href="/vendor-dashboard/bookings"
        />
        <StatTile
          icon={<MessageSquare className="h-4 w-4" strokeWidth={1.75} />}
          label="Open inquiries"
          value={String(upcomingCount)}
          sub="From couples"
          href="/vendor-dashboard/messages"
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
