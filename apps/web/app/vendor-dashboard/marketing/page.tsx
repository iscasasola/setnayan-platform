import { redirect } from 'next/navigation';
import {
  Megaphone,
  Sparkles,
  TrendingUp,
  Info,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { parseVisibility } from '@/lib/vendor-visibility';
import {
  BOOSTED_OPTIONS,
  SPONSORED_OPTIONS,
  adPriceDisplay,
  daysRemaining,
  effectiveMonthlyPesos,
  fetchVendorAdSubscriptions,
  findAdOption,
  isActiveAdSubscription,
  type AdTierOption,
  type VendorAdSubscriptionRow,
} from '@/lib/vendor-ads';
import { formatCentavosPhp } from '@/lib/sku-catalog';
import { cancelAdSubscription, startAdSubscription } from './actions';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Marketing · Vendor' };

type Props = {
  searchParams: Promise<{
    started?: string;
    cancelled?: string;
    error?: string;
  }>;
};

export default async function VendorMarketingPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Verified gate. The parallel verification-flow PR added the canonical
  // `vendor_profiles.verification_state` ENUM ('unverified' | 'pending_review'
  // | 'verified' | 'demoted' | 'rejected'). We read both that and the
  // marketplace-side `public_visibility` so either signal can unlock the
  // gate (per 0022 § 2.1c, `public_visibility = 'verified'` carries the
  // same meaning as `verification_state = 'verified'`). Soft-probe so a
  // pre-migration environment still renders the page.
  let isVerified = false;
  try {
    const res = await supabase
      .from('vendor_profiles')
      .select('public_visibility, verification_state' as 'public_visibility')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    const row = res.data as unknown as
      | { public_visibility?: string | null; verification_state?: string | null }
      | null;
    const visibility = parseVisibility(row?.public_visibility);
    isVerified =
      row?.verification_state === 'verified' || visibility === 'verified';
  } catch {
    // Column missing — fall back to visibility-only read.
    const visibilityRes = await supabase
      .from('vendor_profiles')
      .select('public_visibility')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    isVerified =
      parseVisibility(visibilityRes.data?.public_visibility) === 'verified';
  }

  const rows = await fetchVendorAdSubscriptions(supabase, profile.vendor_profile_id);
  const activeRows = rows.filter(isActiveAdSubscription);
  const historyRows = rows.filter((r) => !isActiveAdSubscription(r));

  const activeBoosted = activeRows.find(
    (r) => findAdOption(r.sku_code)?.tier === 'boosted',
  );
  const activeSponsored = activeRows.find(
    (r) => findAdOption(r.sku_code)?.tier === 'sponsored',
  );

  // Retired 2026-05-28 V2 cutover: Pro Weekly ₱4,999/wk + Concierge bundle
  // both retire. New stacked-cost framing covers Pro Vendor monthly + Boosted
  // Ads + Sponsored Boost. Active rows still surface their real weekly
  // amortized cost.
  const realActiveWeeklyCentavos = activeRows.reduce((acc, row) => {
    const opt = findAdOption(row.sku_code);
    if (!opt) return acc;
    // Normalise everything to a "this-week effective" centavo cost.
    const weeks = opt.termDays / 7;
    return acc + Math.round(opt.priceCentavos / weeks);
  }, 0);

  return (
    <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      {/*
        v2.1 visual overlay 2026-05-28 — label-mono eyebrow above the display
        heading per vendor-dashboard.jsx template. Tier-picker cards + the
        existing "marketing tools being redesigned" amber retirement banner
        below preserve placement + every interaction unchanged per
        [[feedback_setnayan_button_preservation]]. Body copy already reflects
        the v2.1 publisher posture (Boosted Ads + Sponsored Boost being
        reworked under the publisher model · Pro Weekly retired by the fifth
        2026-05-28 row).
      */}
      <header className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Vendor dashboard · Marketing
        </p>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <Megaphone aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Marketing</h1>
        </div>
        <p className="max-w-prose text-base text-ink/65">
          Reach more couples on the Setnayan marketplace. Boosted Ads widen your
          catchment; Sponsored Boost is the premium placement tier with the most
          prominent surface. We&rsquo;re refreshing how these tools work — see the
          note below.
        </p>
      </header>

      <article className="flex items-start gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/5 p-4 text-sm text-terracotta-700">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <div className="space-y-1">
          <p className="font-medium">Marketing tools are being redesigned · check back soon</p>
          <p>
            Boosted Ads and Sponsored Boost are being reworked to align with the
            new Setnayan publisher model. Existing active subscriptions keep
            running through their term. New starts pause until the refresh ships.
          </p>
        </div>
      </article>

      <FlashBanner search={search} />

      {!isVerified ? (
        <UnverifiedGate />
      ) : null}

      <ActiveSubscriptions
        activeBoosted={activeBoosted}
        activeSponsored={activeSponsored}
        realActiveWeeklyCentavos={realActiveWeeklyCentavos}
      />

      <TierPicker
        section="boosted"
        title="Boosted Ads — weekly by radius"
        subtitle="Push to couples up to 20km from your pin for a single week. Cancel anytime."
        options={BOOSTED_OPTIONS}
        isVerified={isVerified}
        hasActiveOfTier={!!activeBoosted}
        currentActiveSku={activeBoosted?.sku_code ?? null}
      />

      <TierPicker
        section="sponsored"
        title="Sponsored Boost — long commit, 30km, verified only"
        subtitle="The premium tier. 30km radius (3× the default 10km). Featured Sponsor pill on every card."
        options={SPONSORED_OPTIONS}
        isVerified={isVerified}
        hasActiveOfTier={!!activeSponsored}
        currentActiveSku={activeSponsored?.sku_code ?? null}
      />

      <StackedExample isVerified={isVerified} />

      {historyRows.length > 0 ? (
        <History rows={historyRows} />
      ) : null}
    </section>
  );
}

function FlashBanner({
  search,
}: {
  search: { started?: string; cancelled?: string; error?: string };
}) {
  if (search.started) {
    const opt = findAdOption(search.started);
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
      >
        <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span>
          Started <strong>{opt?.label ?? search.started}</strong>. Setnayan admin will
          confirm payment via the Payments queue; your boost goes live immediately and
          will be cancelled if payment isn&rsquo;t reconciled within 7 days.
        </span>
      </div>
    );
  }
  if (search.cancelled) {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-md border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-ink/70"
      >
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span>Subscription cancelled. Refunds (if any) are processed by Setnayan admin.</span>
      </div>
    );
  }
  if (search.error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
      >
        <XCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span>{search.error}</span>
      </div>
    );
  }
  return null;
}

function UnverifiedGate() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
      <div className="space-y-1">
        <p className="font-medium">Verification required</p>
        <p>
          Both Boosted Ads and Sponsored Boost are open to verified vendors only. Finish
          verification first — you can view the tiers below but the start button stays
          disabled until your profile flips to <span className="font-medium">Verified</span>.
        </p>
      </div>
    </div>
  );
}

function ActiveSubscriptions({
  activeBoosted,
  activeSponsored,
  realActiveWeeklyCentavos,
}: {
  activeBoosted: VendorAdSubscriptionRow | undefined;
  activeSponsored: VendorAdSubscriptionRow | undefined;
  realActiveWeeklyCentavos: number;
}) {
  if (!activeBoosted && !activeSponsored) {
    return null;
  }
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Currently running</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {activeBoosted ? <ActiveRow row={activeBoosted} tier="boosted" /> : null}
        {activeSponsored ? <ActiveRow row={activeSponsored} tier="sponsored" /> : null}
      </ul>
      <p className="text-xs text-ink/55">
        Effective marketing spend this week:{' '}
        <span className="font-mono">{formatCentavosPhp(realActiveWeeklyCentavos)}</span>{' '}
        (sponsored boost long-commit is amortized weekly). Pro Vendor and
        Enterprise subscriptions are billed separately on your monthly invoice.
      </p>
    </section>
  );
}

function ActiveRow({
  row,
  tier,
}: {
  row: VendorAdSubscriptionRow;
  tier: 'boosted' | 'sponsored';
}) {
  const opt = findAdOption(row.sku_code);
  const days = daysRemaining(row);
  const accent = tier === 'sponsored'
    ? 'border-amber-300 bg-amber-50'
    : 'border-terracotta/30 bg-terracotta/10';
  const dot = tier === 'sponsored'
    ? 'bg-amber-400 text-amber-900'
    : 'bg-terracotta text-cream';
  return (
    <li
      className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-start sm:justify-between ${accent}`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-6 items-center rounded-full px-2 font-mono text-[10px] uppercase tracking-[0.18em] ${dot}`}
          >
            {tier === 'sponsored' ? 'Featured Sponsor' : 'Boosted'}
          </span>
          <p className="text-sm font-semibold text-ink">{opt?.label ?? row.sku_code}</p>
        </div>
        <p className="text-xs text-ink/70">
          {row.radius_km}km radius · {opt?.termLabel ?? `${days}d`} term
        </p>
        <p className="text-xs text-ink/55">
          {days > 0 ? `${days} day${days === 1 ? '' : 's'} remaining` : 'Expiring'} ·{' '}
          Renews:{' '}
          <span className="font-medium">{row.auto_renew ? 'auto' : 'manual'}</span>
        </p>
      </div>
      <form action={cancelAdSubscription} className="flex w-full max-w-xs flex-col gap-2 sm:w-auto">
        <input type="hidden" name="ad_subscription_id" value={row.ad_subscription_id} />
        <input
          type="text"
          name="reason"
          placeholder="Cancel reason (optional)"
          className="input-field h-9 text-xs"
          maxLength={200}
        />
        <SubmitButton
          className="button-secondary h-9 px-3 text-xs"
          pendingLabel="Cancelling…"
        >
          Cancel subscription
        </SubmitButton>
      </form>
    </li>
  );
}

function TierPicker({
  section,
  title,
  subtitle,
  options,
  isVerified,
  hasActiveOfTier,
  currentActiveSku,
}: {
  section: 'boosted' | 'sponsored';
  title: string;
  subtitle: string;
  options: ReadonlyArray<AdTierOption>;
  isVerified: boolean;
  hasActiveOfTier: boolean;
  currentActiveSku: string | null;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {section === 'boosted' ? (
          <TrendingUp aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        ) : (
          <Sparkles aria-hidden className="h-4 w-4 text-amber-600" strokeWidth={1.75} />
        )}
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      <p className="max-w-prose text-sm text-ink/65">{subtitle}</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((opt) => (
          <TierCard
            key={opt.skuCode}
            opt={opt}
            isVerified={isVerified}
            hasActiveOfTier={hasActiveOfTier}
            isThisActive={currentActiveSku === opt.skuCode}
          />
        ))}
      </ul>
    </section>
  );
}

function TierCard({
  opt,
  isVerified,
  hasActiveOfTier,
  isThisActive,
}: {
  opt: AdTierOption;
  isVerified: boolean;
  hasActiveOfTier: boolean;
  isThisActive: boolean;
}) {
  const verifiedBlocked = opt.verifiedOnly && !isVerified;
  const tierBlocked = hasActiveOfTier && !isThisActive;
  const disabled = verifiedBlocked || tierBlocked || isThisActive;
  const sponsored = opt.tier === 'sponsored';

  return (
    <li
      className={`flex flex-col gap-3 rounded-2xl border bg-cream p-4 ${
        sponsored ? 'border-amber-300 ring-1 ring-amber-200' : 'border-ink/10'
      } ${isThisActive ? 'opacity-95' : ''}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            {sponsored ? 'Sponsored · 30km' : `Boosted · ${opt.radiusKm}km`}
          </p>
          <h3 className="text-base font-semibold text-ink">{opt.label}</h3>
        </div>
        {isThisActive ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-emerald-800">
            Active
          </span>
        ) : null}
      </header>

      <div className="space-y-1">
        <p className="text-2xl font-semibold text-ink">{adPriceDisplay(opt)}</p>
        <p className="text-xs text-ink/55">
          per {opt.termLabel.replace('1 ', '')}
          {sponsored ? (
            <>
              {' '}· ≈ ₱{effectiveMonthlyPesos(opt).toLocaleString('en-PH')}/mo effective
            </>
          ) : null}
        </p>
      </div>

      <p className="text-sm text-ink/70">{opt.useCase}</p>

      {verifiedBlocked ? (
        <p className="text-xs text-amber-700">Verified vendors only.</p>
      ) : null}
      {tierBlocked ? (
        <p className="text-xs text-ink/55">
          You have another active {opt.tier} subscription. Cancel it first.
        </p>
      ) : null}

      {disabled ? (
        <div className="mt-auto flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs text-ink/45">
            <input
              type="checkbox"
              defaultChecked={opt.autoRenewDefault}
              className="h-4 w-4 rounded border-ink/25"
              disabled
            />
            <span>Auto-renew at end of {opt.termLabel.replace('1 ', '')}</span>
          </label>
          <button
            type="button"
            disabled
            className={`${sponsored ? 'button-primary' : 'button-secondary'} h-10 text-sm`}
          >
            {isThisActive
              ? 'Active'
              : verifiedBlocked
                ? 'Verification required'
                : 'Cancel current first'}
          </button>
        </div>
      ) : (
        <form action={startAdSubscription} className="mt-auto flex flex-col gap-2">
          <input type="hidden" name="sku_code" value={opt.skuCode} />
          <label className="flex items-center gap-2 text-xs text-ink/65">
            <input
              type="checkbox"
              name="auto_renew"
              value="1"
              defaultChecked={opt.autoRenewDefault}
              className="h-4 w-4 rounded border-ink/25 text-terracotta focus:ring-terracotta/40"
            />
            <span>Auto-renew at end of {opt.termLabel.replace('1 ', '')}</span>
          </label>
          <SubmitButton
            className={`${sponsored ? 'button-primary' : 'button-secondary'} h-10 text-sm`}
            pendingLabel="Starting…"
          >
            {`Start ${opt.label.split(' · ')[1] ?? 'now'}`}
          </SubmitButton>
        </form>
      )}
    </li>
  );
}

function StackedExample({ isVerified }: { isVerified: boolean }) {
  return (
    <section className="rounded-2xl border border-ink/10 bg-cream/60 p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        Stacked-cost worked example
      </p>
      <p className="mt-2 text-sm text-ink/75">
        A photographer on Pro Vendor monthly + Boosted Ads 10km + Sponsored Boost
        Annual:{' '}
        <span className="font-mono">₱1,999/28d</span> (≈ ₱461/wk) +{' '}
        <span className="font-mono">₱7,999</span> (weekly) +{' '}
        <span className="font-mono">₱799,999/yr</span> (~₱15,384/wk amortized) ≈{' '}
        <span className="font-semibold">~₱23,844/week effective</span>.
      </p>
      {!isVerified ? (
        <p className="mt-2 text-xs text-ink/55">
          Verification unlocks Pro Vendor + both ad tiers, and adds 100
          complimentary tokens to your wallet. Preview the math here and come
          back once your profile is verified.
        </p>
      ) : null}
    </section>
  );
}

function History({
  rows,
}: {
  rows: VendorAdSubscriptionRow[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">History</h2>
      <ul className="divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-cream">
        {rows.slice(0, 20).map((row) => {
          const opt = findAdOption(row.sku_code);
          const cancelled = !!row.cancelled_at;
          const startedDate = new Date(row.started_at).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
          const expiresDate = new Date(row.expires_at).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
          return (
            <li key={row.ad_subscription_id} className="flex items-start justify-between gap-3 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-ink">{opt?.label ?? row.sku_code}</p>
                <p className="text-xs text-ink/55">
                  {startedDate} → {expiresDate} · {row.radius_km}km ·{' '}
                  {formatCentavosPhp(row.gross_centavos)}
                </p>
                {row.cancel_reason ? (
                  <p className="text-xs italic text-ink/55">“{row.cancel_reason}”</p>
                ) : null}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                  cancelled
                    ? 'bg-ink/8 text-ink/55'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {cancelled ? 'Cancelled' : 'Expired'}
              </span>
            </li>
          );
        })}
      </ul>
      {rows.length > 20 ? (
        <p className="text-xs text-ink/55">Showing the 20 most recent. Older history archived.</p>
      ) : null}
    </section>
  );
}
