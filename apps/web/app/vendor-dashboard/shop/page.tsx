import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  Check,
  Download,
  Eye,
  Globe,
  Handshake,
  Heart,
  Images,
  Sparkles,
  Star,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchOwnVendorProfile,
  fetchHasBusinessDocuments,
  businessProfileChecklist,
} from '@/lib/vendor-profile';
import { fetchReviewStats } from '@/lib/reviews';
import { fetchVendorBranches } from '@/lib/vendor-branches';
import {
  fetchVendorTeam,
  enrichTeamWithUsers,
  VENDOR_TEAM_ROLE_LABEL,
  type VendorTeamMemberRow,
  type VendorTeamMemberWithUser,
} from '@/lib/vendor-team';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { loadVendorFeaturedStories } from '@/lib/realstories-vendor';
import { loadVendorRecaps } from '@/lib/recap-vendor';
import { isPubliclyVisible } from '@/lib/vendor-visibility';
import { renderUrlQrSvg } from '@/lib/qr';
import {
  buildVendorInviteUrl,
  vendorCoverageCategories,
} from '@/lib/vendor-couple-invite';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { fetchVendorServices } from '@/lib/vendor-services';
import { fetchVendorContracts } from '@/lib/contracts';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { CopyButton } from '@/app/_components/copy-button';
import { SubmitButton } from '@/app/_components/submit-button';
import { LockedQrGenerator } from '@/app/vendor-dashboard/invite/_components/locked-qr-generator';
import { inviteVendorTeamMember } from '@/app/vendor-dashboard/team/actions';

import { ManageTiles } from './_components/manage-tiles';
import { QrCard } from './_components/qr-card';

/**
 * /vendor-dashboard/shop — "My Shop".
 *
 * The storefront home of the vendor doorway. Reworked 2026-07 (owner):
 * everything acts INLINE — only Profile navigates. Website / Team / Branch
 * expand their function in place (ManageTiles + Collapsible); the QR row card
 * toggles Shortlist ↔ Locked, both rendering a real QR; the metrics strip is a
 * read-only pulse (its detail pages live in the sidebar).
 *
 * DATA — every number is LIVE (owner rule: never fabricate). The whole loader
 * is wrapped so a single query error degrades to zeros rather than crashing.
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

function titleCase(s: string): string {
  return s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

type TeamMember = VendorTeamMemberWithUser;

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
  coverage: VendorCategory[];
  serviceOptions: { value: string; label: string }[];
  contractOptions: { value: string; label: string }[];
  team: TeamMember[];
};

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
    supabase
      .rpc('count_saves_for_vendor', { p_vendor_profile_id: vendorId })
      .then((r) => (typeof r.data === 'number' ? r.data : 0), () => 0),
    supabase
      .from('vendor_profile_views')
      .select('view_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorId)
      .gte('viewed_at', weekStart)
      .then((r) => r.count ?? 0, () => 0),
    fetchVendorBranches(supabase, vendorId).catch(() => []),
    fetchVendorTeam(supabase, vendorId).catch(() => [] as VendorTeamMemberRow[]),
    fetchVendorPoolBookings(supabase, vendorId).catch(() => []),
    supabase
      .from('vendor_partnerships')
      .select('id', { count: 'exact', head: true })
      .eq('recommended_vendor_id', vendorId)
      .eq('status', 'accepted')
      .eq('is_active', true)
      .then((r) => r.count ?? 0, () => 0),
  ]);

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

  // Attach email/display_name (Pattern A — other users' identity needs the
  // admin client). Fail-soft: keep the rows nameless rather than crash.
  let enrichedTeam: TeamMember[];
  try {
    enrichedTeam = await enrichTeamWithUsers(createAdminClient(), team);
  } catch {
    enrichedTeam = team.map((m) => ({ ...m, email: null, display_name: null }));
  }

  // Locked-QR service picker = the vendor's own leaf offerings (DB-driven), with
  // a coverage-category fallback for vendors who haven't published services yet.
  const coverage = vendorCoverageCategories((profile.services ?? []) as string[]);
  const activeServices = (
    await fetchVendorServices(supabase, vendorId).catch(() => [])
  ).filter((s) => s.is_active);
  const serviceOptions = activeServices.length
    ? activeServices.map((s) => ({
        value: s.vendor_service_id,
        label: s.title ?? VENDOR_CATEGORY_LABEL[s.category as VendorCategory] ?? s.category,
      }))
    : coverage.map((c) => ({ value: c as string, label: VENDOR_CATEGORY_LABEL[c] ?? c }));
  const contractOptions = (await fetchVendorContracts(supabase, vendorId))
    .filter((c) => c.status !== 'cancelled')
    .map((c) => ({ value: c.contract_id, label: c.title }));

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
    recapClips: recapCount,
    teamMembers: team.length,
    branchLocations: 1 + activeBranches,
    recommendedByShops: partnershipsRes,
    coverage,
    serviceOptions,
    contractOptions,
    team: enrichedTeam,
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

export default async function VendorShopPage({
  searchParams,
}: {
  searchParams: Promise<{ et?: string; cat?: string }>;
}) {
  let data: ShopData | null;
  try {
    data = await loadShopData();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[/vendor-dashboard/shop] loader failed', err);
    data = null;
  }

  if (!data) {
    return (
      <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
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

  // QR data — Shortlist (standing slug QR, optionally scoped) is rendered here
  // on the server so the couple sees a real code; Locked reuses the existing
  // generator. Only computable once the vendor has a public slug.
  const sp = await searchParams;
  const eventTypes = await getCreatableEventTypes().catch(() => []);
  const selectedCat =
    sp.cat && data.coverage.includes(sp.cat as VendorCategory)
      ? (sp.cat as VendorCategory)
      : null;
  const selectedEt =
    sp.et && eventTypes.some((t) => t.key === sp.et) ? sp.et : null;

  let shortlistBody: React.ReactNode;
  let lockedBody: React.ReactNode;
  if (data.slug) {
    const inviteUrl = buildVendorInviteUrl(data.slug, {
      eventType: selectedEt,
      category: selectedCat,
    });
    const qrSvg = await renderUrlQrSvg(inviteUrl, 200);
    shortlistBody = (
      <ShortlistBody
        inviteUrl={inviteUrl}
        qrSvg={qrSvg}
        eventTypes={eventTypes}
        coverage={data.coverage}
        selectedEt={selectedEt}
        selectedCat={selectedCat}
      />
    );
    lockedBody = (
      <LockedBody
        eventTypes={eventTypes.map((t) => ({ value: t.key, label: t.label }))}
        services={data.serviceOptions}
        contracts={data.contractOptions}
      />
    );
  } else {
    const publishPrompt = (
      <div className="text-sm text-ink/70">
        Publish your business profile first — your QR is built from your public
        page.{' '}
        <Link
          href="/vendor-dashboard/profile"
          className="font-medium text-terracotta hover:underline"
        >
          Set up my page
        </Link>
      </div>
    );
    shortlistBody = publishPrompt;
    lockedBody = publishPrompt;
  }

  return (
    <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <HeroCard data={data} publicPath={publicPath} />

      <ManageTiles
        completionPct={data.completionPct}
        verifyLabel={data.hasDocuments ? 'Documents in' : '1 doc to verify'}
        websiteLive={data.websiteLive}
        teamLabel={nf.format(data.teamMembers)}
        branchLabel={nf.format(data.branchLocations)}
        websitePanel={
          <WebsitePanel publicPath={publicPath} websiteLive={data.websiteLive} />
        }
        teamPanel={<TeamPanel members={data.team} />}
        branchPanel={
          <BranchPanel
            city={data.city}
            branchLocations={data.branchLocations}
            tier={data.tier}
          />
        }
      />

      <QrCard shortlist={shortlistBody} locked={lockedBody} />

      {/* ── HOW YOU'RE DOING — read-only pulse (detail pages live in the sidebar) */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium" style={{ color: 'var(--m-slate)' }}>
          How you&rsquo;re doing
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile
            icon={<Eye className="h-4 w-4" strokeWidth={1.75} />}
            value={nf.format(data.profileViewsWeek)}
            label="Profile views"
            sub="this week"
          />
          <StatTile
            icon={<Star className="h-4 w-4" strokeWidth={1.75} />}
            value={data.reviewCount > 0 ? data.rating.toFixed(1) : '—'}
            label="Reviews"
            sub={`${nf.format(data.reviewCount)} review${data.reviewCount === 1 ? '' : 's'}`}
          />
          <StatTile
            icon={<Heart className="h-4 w-4" strokeWidth={1.75} />}
            value={nf.format(data.savedByCouples)}
            label="Saved"
            sub="couples saved you"
          />
          <StatTile
            icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} />}
            value={nf.format(data.storiesTagged)}
            label="Stories"
            sub="editorials tagged"
          />
          <StatTile
            icon={<Images className="h-4 w-4" strokeWidth={1.75} />}
            value={data.recapClips > 0 ? nf.format(data.recapClips) : '—'}
            label="Recap"
            sub="day-of clips"
          />
          <StatTile
            icon={<Handshake className="h-4 w-4" strokeWidth={1.75} />}
            value={nf.format(data.recommendedByShops)}
            label="Recommend"
            sub={`${data.recommendedByShops === 1 ? 'shop recommends' : 'shops recommend'} you`}
          />
        </div>
      </section>
    </section>
  );
}

/* ─── Hero ──────────────────────────────────────────────────────────────── */
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
      <span
        aria-hidden
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold tracking-wide"
        style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
      >
        {data.initials}
      </span>

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
          <div className="flex flex-wrap items-center gap-2">
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
            <CopyButton
              value={`${DISPLAY_HOST}${publicPath}`}
              label="Copy link"
              copiedLabel="Copied"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-[color:var(--m-orange-2)] hover:bg-[color:var(--m-orange-3)]"
            />
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            No public address yet — set one in Profile.
          </p>
        )}
      </div>

      <CompletenessRing pct={data.completionPct} />

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
          style={{ width: '3.75rem', height: '3.75rem', background: 'var(--m-orange-4)' }}
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

/* ─── Read-only metric tile ─────────────────────────────────────────────── */
function StatTile({
  icon,
  value,
  label,
  sub,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--m-orange-4)' }}>
      <span
        className="inline-flex items-center gap-1.5 text-xs"
        style={{ color: 'var(--m-slate-3)' }}
      >
        <span aria-hidden style={{ color: 'var(--m-orange-2)' }}>
          {icon}
        </span>
        {label}
      </span>
      <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: 'var(--m-ink)' }}>
        {value}
      </p>
      <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
        {sub}
      </p>
    </div>
  );
}

/* ─── Inline panels (rendered server-side, hosted by ManageTiles) ───────── */
function WebsitePanel({
  publicPath,
  websiteLive,
}: {
  publicPath: string | null;
  websiteLive: boolean;
}) {
  if (!publicPath) {
    return (
      <div className="text-sm text-ink/70">
        No public address yet.{' '}
        <Link
          href="/vendor-dashboard/profile"
          className="font-medium text-terracotta hover:underline"
        >
          Set one in Profile
        </Link>{' '}
        and your microsite goes live.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
          style={
            websiteLive
              ? {
                  background: 'color-mix(in srgb, var(--m-sage-deep) 12%, transparent)',
                  color: 'var(--m-sage-deep)',
                }
              : { background: 'var(--m-paper)', color: 'var(--m-slate-3)' }
          }
        >
          {websiteLive ? 'Live' : 'Draft'}
        </span>
        <span className="text-xs text-ink/55">Your page is built from your profile.</span>
      </div>

      <div className="flex items-center gap-2">
        <code
          className="min-w-0 flex-1 truncate rounded-lg border bg-white px-3 py-2 text-xs"
          style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
        >
          {DISPLAY_HOST}
          {publicPath}
        </code>
        <CopyButton value={`${DISPLAY_HOST}${publicPath}`} label="Copy link" />
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={publicPath}
          target="_blank"
          rel="noreferrer"
          className="button-secondary inline-flex items-center gap-2"
        >
          <Globe className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Open live
        </a>
        <Link
          href="/vendor-dashboard/profile"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:underline"
        >
          Edit content on your profile
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function TeamPanel({ members }: { members: TeamMember[] }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-ink/55">Any admin can manage the team.</p>

      <ul className="space-y-2">
        {members.length === 0 ? (
          <li className="text-sm text-ink/60">No team members yet.</li>
        ) : (
          members.map((m) => (
            <li
              key={m.vendor_team_member_id}
              className="flex items-center gap-3 rounded-lg border bg-white p-3"
              style={{ borderColor: 'var(--m-line)' }}
            >
              <span
                aria-hidden
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
                style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
              >
                {deriveInitials(m.display_name ?? m.email ?? 'SN')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {m.display_name ?? m.email ?? 'Member'}
                </p>
                <p className="text-xs text-ink/55">
                  {VENDOR_TEAM_ROLE_LABEL[m.role]}
                  {m.team_label ? ` · ${m.team_label}` : ''}
                </p>
              </div>
            </li>
          ))
        )}
      </ul>

      <form
        action={inviteVendorTeamMember}
        className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"
      >
        <input type="hidden" name="returnTo" value="shop" />
        <input
          name="email"
          type="email"
          required
          placeholder="colleague@example.com"
          className="input-field"
          aria-label="Team member email"
        />
        <select
          name="role"
          defaultValue="viewer"
          className="input-field cursor-pointer"
          aria-label="Role"
        >
          <option value="admin">Admin</option>
          <option value="agent">Agent</option>
          <option value="viewer">Viewer</option>
        </select>
        <SubmitButton className="button-primary" pendingLabel="Adding…">
          Add
        </SubmitButton>
      </form>
    </div>
  );
}

function BranchPanel({
  city,
  branchLocations,
  tier,
}: {
  city: string | null;
  branchLocations: number;
  tier: string | null;
}) {
  const isEnterprise = tier === 'enterprise';
  return (
    <div className="space-y-3">
      <div
        className="flex items-center gap-3 rounded-lg border bg-white p-3"
        style={{ borderColor: 'var(--m-line)' }}
      >
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
          aria-hidden
        >
          <Building2 className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {city ?? 'Headquarters'}
          </p>
          <p className="text-xs text-ink/55">
            {branchLocations === 1
              ? 'Headquarters'
              : `1 of ${branchLocations} locations`}
          </p>
        </div>
      </div>

      {isEnterprise ? (
        <Link
          href="/vendor-dashboard/branches"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:underline"
        >
          Add or manage branches
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </Link>
      ) : (
        <p
          className="rounded-lg p-3 text-xs"
          style={{ background: 'var(--m-orange-4)', color: 'var(--m-slate)' }}
        >
          Extra branches are an Enterprise feature — each gets its own team and
          calendar.
        </p>
      )}
    </div>
  );
}

/* ─── QR bodies ─────────────────────────────────────────────────────────── */
function ShortlistBody({
  inviteUrl,
  qrSvg,
  eventTypes,
  coverage,
  selectedEt,
  selectedCat,
}: {
  inviteUrl: string;
  qrSvg: string;
  eventTypes: { key: string; label: string }[];
  coverage: VendorCategory[];
  selectedEt: string | null;
  selectedCat: VendorCategory | null;
}) {
  const qrDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <div className="shrink-0 text-center">
        <div
          className="rounded-2xl border bg-white p-3 [&_svg]:h-[160px] [&_svg]:w-[160px]"
          style={{ borderColor: 'var(--m-line)' }}
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="mt-1 text-[11px] text-ink/45">Reusable · scan anytime</p>
      </div>

      <div className="min-w-0 flex-1 space-y-4">
        <p className="text-sm text-ink/70">
          Couples scan to save your shop to their shortlist — same code every
          time.
        </p>

        <form method="GET" className="grid gap-2 sm:grid-cols-2" aria-label="Scope the shortlist QR">
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-ink/70">Event</span>
            <select name="et" defaultValue={selectedEt ?? ''} className="input-field w-full">
              <option value="">Any event type</option>
              {eventTypes.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-ink/70">Service</span>
            <select name="cat" defaultValue={selectedCat ?? ''} className="input-field w-full">
              <option value="">All my services</option>
              {coverage.map((c) => (
                <option key={c} value={c}>
                  {VENDOR_CATEGORY_LABEL[c] ?? c}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <SubmitButton className="button-secondary" pendingLabel="Updating…">
              Update QR
            </SubmitButton>
          </div>
        </form>

        <div className="flex items-center gap-2">
          <code
            className="min-w-0 flex-1 truncate rounded-lg border bg-white px-3 py-2 text-xs"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
          >
            {inviteUrl}
          </code>
          <CopyButton value={inviteUrl} label="Copy link" />
        </div>

        <a
          href={qrDataUri}
          download="setnayan-shortlist-qr.svg"
          className="button-secondary inline-flex items-center gap-2"
        >
          <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Download QR
        </a>
      </div>
    </div>
  );
}

function LockedBody({
  eventTypes,
  services,
  contracts,
}: {
  eventTypes: { value: string; label: string }[];
  services: { value: string; label: string }[];
  contracts: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/70">
        Lock one customer to a plan and downpayment. Scanning freezes the deal
        onto their event.
      </p>
      <LockedQrGenerator eventTypes={eventTypes} services={services} contracts={contracts} />
      <Link
        href="/vendor-dashboard/locked-qr"
        className="inline-block text-sm font-medium text-terracotta hover:underline"
      >
        View your issued Locked QRs →
      </Link>
    </div>
  );
}
