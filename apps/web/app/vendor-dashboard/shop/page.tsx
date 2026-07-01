import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  Check,
  Eye,
  Globe,
  Handshake,
  Heart,
  Images,
  Lock,
  QrCode,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import {
  fetchOwnVendorProfile,
  fetchHasBusinessDocuments,
  businessProfileChecklist,
} from '@/lib/vendor-profile';
import { fetchReviewStats } from '@/lib/reviews';
import { fetchVendorBranches } from '@/lib/vendor-branches';
import { fetchVendorTeam } from '@/lib/vendor-team';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { loadVendorFeaturedStories } from '@/lib/realstories-vendor';
import { loadVendorRecaps } from '@/lib/recap-vendor';
import { isPubliclyVisible } from '@/lib/vendor-visibility';

/**
 * /vendor-dashboard/shop — "My Shop" (proto-shell 6-menu destination).
 *
 * Replaces the stub. This is the storefront home of the vendor doorway:
 * everything that defines the shop (identity + reach) and links out to the
 * sub-surfaces (Profile · Verify · Website · Team · Branches · Reviews · Real
 * Stories · Recaps · Partnerships) that own the detail.
 *
 * DATA — every number is LIVE (mockup figures are illustrative only):
 *   - completeness ring     → businessProfileChecklist (8-item publish gate)
 *   - "N doc to verify"     → fetchHasBusinessDocuments (verification docs flag)
 *   - Profile views (week)  → vendor_profile_views · viewed_at ≥ start-of-week
 *   - Rating · N reviews    → fetchReviewStats (avg_rating_overall · total_count)
 *   - Saved by couples      → count_saves_for_vendor RPC (distinct savers)
 *   - Stories tagged        → loadVendorFeaturedStories ∩ own bookings
 *   - Recaps day-of clips   → loadVendorRecaps ∩ own bookings (published recaps)
 *   - Team members          → fetchVendorTeam length
 *   - Branch locations      → 1 (HQ) + active branches
 *   - Website live state    → business_slug + isPubliclyVisible
 *   - Recommend (shops)     → accepted, active vendor_partnerships
 *
 * Every metric that has no source yet renders a plain zero/empty state — we
 * never fabricate a number (owner rule). Fail-soft: the whole loader is wrapped
 * so a single query error degrades to zeros rather than crashing the tab.
 */

export const metadata = { title: 'My Shop · Vendor · Setnayan' };

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');
const DISPLAY_HOST = SITE_URL.replace(/^https?:\/\//, '');

const nf = new Intl.NumberFormat('en-PH');

/** Two uppercase initials from a business name (mirrors the sidebar identity card). */
function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'SN';
  if (words.length === 1) return (words[0]!.slice(0, 2) || 'SN').toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** Start of the current ISO-ish week (Mon 00:00 local), as an ISO string. */
function startOfWeekIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d.toISOString();
}

type ShopData = {
  businessName: string;
  initials: string;
  slug: string | null;
  city: string | null;
  primaryService: string | null;
  tier: string | null;
  isVerified: boolean;
  websiteLive: boolean;
  completionPct: number;
  hasDocuments: boolean;
  profileViewsWeek: number;
  rating: number;
  reviewCount: number;
  savedByCouples: number;
  storiesTagged: number;
  recapClips: number;
  teamMembers: number;
  branchLocations: number;
  recommendedByShops: number;
};

function titleCase(s: string): string {
  return s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function loadShopData(): Promise<ShopData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return null;

  const vendorId = profile.vendor_profile_id;
  const businessName = profile.business_name ?? 'Your shop';

  // Tier — not in the shared profile select; soft-probe it.
  let tier: string | null = null;
  try {
    const { data } = await supabase
      .from('vendor_profiles')
      .select('tier_state')
      .eq('vendor_profile_id', vendorId)
      .maybeSingle();
    tier = (data as { tier_state?: string | null } | null)?.tier_state ?? null;
  } catch {
    tier = null;
  }

  const weekStart = startOfWeekIso();

  const [
    hasDocuments,
    reviewStats,
    savesRes,
    viewsRes,
    branches,
    team,
    bookings,
    partnershipsRes,
  ] = await Promise.all([
    fetchHasBusinessDocuments(supabase, vendorId).catch(() => false),
    fetchReviewStats(supabase, vendorId).catch(() => ({
      avg_rating_overall: 0,
      total_count: 0,
    })),
    // Distinct couples who saved/followed this vendor — the same RPC the
    // Shortlist Radar card uses. Fail-soft to 0.
    supabase
      .rpc('count_saves_for_vendor', { p_vendor_profile_id: vendorId })
      .then((r) => (typeof r.data === 'number' ? r.data : 0), () => 0),
    // Profile views this week — head/count-only on vendor_profile_views.
    supabase
      .from('vendor_profile_views')
      .select('view_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorId)
      .gte('viewed_at', weekStart)
      .then((r) => r.count ?? 0, () => 0),
    fetchVendorBranches(supabase, vendorId).catch(() => []),
    fetchVendorTeam(supabase, vendorId).catch(() => []),
    fetchVendorPoolBookings(supabase, vendorId).catch(() => []),
    // "N shops recommend you" — accepted, active partnerships where this vendor
    // is the recommended party.
    supabase
      .from('vendor_partnerships')
      .select('id', { count: 'exact', head: true })
      .eq('recommended_vendor_id', vendorId)
      .eq('status', 'accepted')
      .eq('is_active', true)
      .then((r) => r.count ?? 0, () => 0),
  ]);

  // Featured Real Stories + published Recaps for this vendor's own booked
  // events — reuse the SAME helpers the Real Stories + Recaps pages use, so the
  // counts here match those surfaces exactly.
  const eventIds = bookings.map((b) => b.eventId);
  const [storiesTagged, recapCount] = await Promise.all([
    loadVendorFeaturedStories(eventIds).then((s) => s.length, () => 0),
    loadVendorRecaps(eventIds).then((r) => r.length, () => 0),
  ]);

  const completion = businessProfileChecklist(profile, { hasDocuments });
  const completionPct =
    completion.total === 0
      ? 0
      : Math.round((completion.done / completion.total) * 100);

  const activeBranches = branches.filter((b) => b.status === 'active').length;

  return {
    businessName,
    initials: deriveInitials(businessName),
    slug: profile.business_slug ?? null,
    city: profile.location_city ?? null,
    primaryService: profile.services?.[0] ? titleCase(profile.services[0]) : null,
    tier,
    isVerified: profile.public_visibility === 'verified',
    websiteLive:
      Boolean(profile.business_slug) &&
      isPubliclyVisible(profile.public_visibility),
    completionPct,
    hasDocuments,
    profileViewsWeek: viewsRes,
    rating: Number(reviewStats.avg_rating_overall) || 0,
    reviewCount: Number(reviewStats.total_count) || 0,
    savedByCouples: savesRes,
    storiesTagged,
    // Published Recaps for this vendor's events (day-of recap pages). Same
    // helper the Recaps page uses; 0 = none published yet (honest empty state).
    recapClips: recapCount,
    teamMembers: team.length,
    branchLocations: 1 + activeBranches,
    recommendedByShops: partnershipsRes,
  };
}

const TIER_LABEL: Record<string, string> = {
  free: 'Free',
  solo: 'Solo',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

function tierLabel(tier: string | null): string {
  if (!tier) return 'Free';
  return TIER_LABEL[tier] ?? titleCase(tier);
}

export default async function VendorShopPage() {
  let data: ShopData | null;
  try {
    data = await loadShopData();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[/vendor-dashboard/shop] loader failed', err);
    data = null;
  }

  // No profile (team-member view or brand-new account with no profile) → a
  // simple set-up prompt rather than a broken storefront.
  if (!data) {
    return (
      <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">My Shop</h1>
          <p className="max-w-prose text-base text-ink/65">
            Everything that defines your shop and your reach.
          </p>
        </header>
        <div
          className="rounded-2xl border p-6"
          style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
        >
          <p className="text-sm text-ink/70">
            Set up your business profile first — once it&rsquo;s created, your
            storefront, reach, and reputation all live here.
          </p>
          <Link
            href="/vendor-dashboard/profile"
            className="button-primary mt-4 inline-flex items-center gap-2"
          >
            Go to my profile
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      </section>
    );
  }

  const publicPath = data.slug ? `/v/${data.slug}` : null;

  return (
    <section className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <HeroCard data={data} publicPath={publicPath} />

      {/* ── STAT CARDS ───────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Eye className="h-4 w-4" strokeWidth={1.75} />}
          value={nf.format(data.profileViewsWeek)}
          label="Profile views"
          sub="this week"
          href="/vendor-dashboard/performance"
        />
        <StatCard
          icon={<Star className="h-4 w-4" strokeWidth={1.75} />}
          value={data.reviewCount > 0 ? data.rating.toFixed(1) : '—'}
          label="Rating"
          sub={`${nf.format(data.reviewCount)} review${data.reviewCount === 1 ? '' : 's'}`}
          href="/vendor-dashboard/reviews"
        />
        <StatCard
          icon={<Heart className="h-4 w-4" strokeWidth={1.75} />}
          value={nf.format(data.savedByCouples)}
          label="Saved by couples"
          sub={
            data.savedByCouples === 1
              ? 'one couple saved you'
              : 'couples who saved you'
          }
          href="/vendor-dashboard/performance"
        />
        <StatCard
          icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} />}
          value={nf.format(data.storiesTagged)}
          label="Stories"
          sub="tagged"
          href="/vendor-dashboard/real-stories"
        />
      </section>

      {/* ── YOUR SHOP ────────────────────────────────────────────────────── */}
      <ClusterSection title="Your shop">
        <ClusterCard
          icon={<ShieldCheck className="h-5 w-5" strokeWidth={1.75} />}
          value={`${data.completionPct}%`}
          label="Profile"
          sub={data.hasDocuments ? 'Documents in' : '1 doc to verify'}
          href="/vendor-dashboard/profile"
        />
        <ClusterCard
          icon={<Globe className="h-5 w-5" strokeWidth={1.75} />}
          value={data.websiteLive ? 'Live' : 'Draft'}
          label="Website"
          sub={
            publicPath
              ? `${DISPLAY_HOST}${publicPath}`
              : 'Set your public address'
          }
          href="/vendor-dashboard/website"
        />
        <ClusterCard
          icon={<Users className="h-5 w-5" strokeWidth={1.75} />}
          value={nf.format(data.teamMembers)}
          label="Team"
          sub={`${data.teamMembers} member${data.teamMembers === 1 ? '' : 's'}`}
          href="/vendor-dashboard/team"
        />
        <ClusterCard
          icon={<Building2 className="h-5 w-5" strokeWidth={1.75} />}
          value={nf.format(data.branchLocations)}
          label="Branch"
          sub={`1 of ${data.branchLocations} location${data.branchLocations === 1 ? '' : 's'}`}
          href="/vendor-dashboard/branches"
        />
      </ClusterSection>

      {/* ── GET DISCOVERED ───────────────────────────────────────────────── */}
      <ClusterSection title="Get discovered">
        <ClusterCard
          icon={<QrCode className="h-5 w-5" strokeWidth={1.75} />}
          value="QR"
          label="Shortlist QR"
          sub="Show & share"
          href="/vendor-dashboard/invite"
        />
        <ClusterCard
          icon={<Lock className="h-5 w-5" strokeWidth={1.75} />}
          value="QR"
          label="Locked QR"
          sub="Per customer · lock + downpayment"
          href="/vendor-dashboard/invite?mode=locked"
        />
      </ClusterSection>

      {/* ── PROOF & REPUTATION ───────────────────────────────────────────── */}
      <ClusterSection title="Proof & reputation">
        <ClusterCard
          icon={<Sparkles className="h-5 w-5" strokeWidth={1.75} />}
          value={nf.format(data.storiesTagged)}
          label="Stories"
          sub={`${data.storiesTagged} editorial${data.storiesTagged === 1 ? '' : 's'} tagged`}
          href="/vendor-dashboard/real-stories"
        />
        <ClusterCard
          icon={<Star className="h-5 w-5" strokeWidth={1.75} />}
          value={data.reviewCount > 0 ? data.rating.toFixed(1) : '—'}
          label="Reviews"
          sub={`★ ${data.reviewCount > 0 ? data.rating.toFixed(1) : '—'} · ${nf.format(data.reviewCount)}`}
          href="/vendor-dashboard/reviews"
        />
        <ClusterCard
          icon={<Images className="h-5 w-5" strokeWidth={1.75} />}
          value={data.recapClips > 0 ? nf.format(data.recapClips) : '—'}
          label="Recap"
          sub={`${data.recapClips > 0 ? nf.format(data.recapClips) : 'No'} day-of clips`}
          href="/vendor-dashboard/recaps"
        />
      </ClusterSection>

      {/* ── YOUR AUDIENCE ────────────────────────────────────────────────── */}
      <ClusterSection title="Your audience">
        <ClusterCard
          icon={<Heart className="h-5 w-5" strokeWidth={1.75} />}
          value={nf.format(data.savedByCouples)}
          label="Saved by couples"
          sub={`${nf.format(data.savedByCouples)} saved you`}
          href="/vendor-dashboard/performance"
        />
        <ClusterCard
          icon={<Handshake className="h-5 w-5" strokeWidth={1.75} />}
          value={nf.format(data.recommendedByShops)}
          label="Recommend"
          sub={`${nf.format(data.recommendedByShops)} shop${data.recommendedByShops === 1 ? '' : 's'} recommend you`}
          href="/vendor-dashboard/partnerships"
        />
      </ClusterSection>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Hero card — cream (--m-orange-4 tint) identity block with the completeness
 * ring. Obsidian initials avatar + verified line + tier/service/city + public
 * URL + "View as couple" out to the live page.
 * ───────────────────────────────────────────────────────────────────────── */
function HeroCard({
  data,
  publicPath,
}: {
  data: ShopData;
  publicPath: string | null;
}) {
  const subline = [tierLabel(data.tier), data.primaryService, data.city]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className="flex flex-col gap-5 rounded-2xl border p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6"
      style={{ background: 'var(--m-orange-4)', borderColor: 'var(--m-orange-3)' }}
    >
      {/* Avatar */}
      <span
        aria-hidden
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold tracking-wide"
        style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
      >
        {data.initials}
      </span>

      {/* Identity */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-xl font-semibold" style={{ color: 'var(--m-ink)' }}>
            {data.businessName}
          </h2>
          {data.isVerified ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background: 'color-mix(in srgb, var(--m-sage-deep) 12%, transparent)',
                color: 'var(--m-sage-deep)',
              }}
            >
              <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              Verified
            </span>
          ) : (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: 'var(--m-paper)', color: 'var(--m-slate-3)' }}
            >
              Unverified
            </span>
          )}
        </div>
        {subline ? (
          <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
            {subline}
          </p>
        ) : null}
        {publicPath ? (
          <p
            className="inline-flex items-center gap-1.5 font-mono text-xs"
            style={{ color: 'var(--m-orange-2)' }}
          >
            <Globe aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span className="truncate">
              {DISPLAY_HOST}
              {publicPath}
            </span>
          </p>
        ) : (
          <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            No public address yet — set one in Profile.
          </p>
        )}
      </div>

      {/* Completeness ring */}
      <CompletenessRing pct={data.completionPct} />

      {/* View as couple */}
      {publicPath ? (
        <a
          href={publicPath}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
          style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
        >
          View as couple
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </a>
      ) : (
        <Link
          href="/vendor-dashboard/profile"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
          style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
        >
          Finish profile
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      )}
    </div>
  );
}

/** Gold conic-gradient progress ring with the percent inside. */
function CompletenessRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(var(--m-orange) ${clamped * 3.6}deg, var(--m-orange-3) 0deg)`,
        }}
        role="img"
        aria-label={`Profile ${clamped}% complete`}
      >
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: '3.75rem',
            height: '3.75rem',
            background: 'var(--m-orange-4)',
          }}
        >
          <span
            className="text-base font-semibold tabular-nums"
            style={{ color: 'var(--m-ink)' }}
          >
            {clamped}%
          </span>
        </div>
      </div>
      <span
        className="font-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ color: 'var(--m-orange-2)' }}
      >
        Complete
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Stat card — the four top-row metrics (white card, big value + label + sub).
 * ───────────────────────────────────────────────────────────────────────── */
function StatCard({
  icon,
  value,
  label,
  sub,
  href,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  sub: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border bg-white p-4 transition-colors hover:border-[color:var(--m-orange-3)]"
      style={{ borderColor: 'var(--m-line)' }}
    >
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
        aria-hidden
      >
        {icon}
      </span>
      <p
        className="mt-3 text-2xl font-semibold tabular-nums"
        style={{ color: 'var(--m-ink)' }}
      >
        {value}
      </p>
      <p className="mt-0.5 text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
        {label}
      </p>
      <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
        {sub}
      </p>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Cluster section — an uppercase eyebrow heading + a responsive card grid.
 * ───────────────────────────────────────────────────────────────────────── */
function ClusterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2
        className="font-mono text-[11px] uppercase tracking-[0.2em]"
        style={{ color: 'var(--m-slate)' }}
      >
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Cluster card — icon + big value + label + sub, linking to a sub-route.
 * ───────────────────────────────────────────────────────────────────────── */
function ClusterCard({
  icon,
  value,
  label,
  sub,
  href,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  sub: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border bg-white p-4 transition-colors hover:border-[color:var(--m-orange-3)]"
      style={{ borderColor: 'var(--m-line)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
          aria-hidden
        >
          {icon}
        </span>
        <ArrowRight
          aria-hidden
          className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
          strokeWidth={1.75}
          style={{ color: 'var(--m-slate-4)' }}
        />
      </div>
      <p
        className="text-xl font-semibold tabular-nums"
        style={{ color: 'var(--m-ink)' }}
      >
        {value}
      </p>
      <p className="mt-0.5 text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
        {label}
      </p>
      <p className="truncate text-xs" style={{ color: 'var(--m-slate-3)' }}>
        {sub}
      </p>
    </Link>
  );
}
