import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Crown, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchV2VendorCatalog } from '@/lib/v2-catalog';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import {
  TIER_PRICE_PHP,
  TIER_SUBSCRIPTION_BUNDLE_TOKENS,
  TIER_CAPS,
  asVendorTier,
  isTierAtLeast,
  type VendorTier,
} from '@/lib/vendor-tier-caps';
import {
  fetchVendorAiAddonState,
  fetchVendorAiAddonPricePhp,
  isVendorAiAddonActive,
} from '@/lib/vendor-addon-pricing';
import { vendorAutoReplyEnabled } from '@/lib/vendor-autoreply-flag';
import { SubscriptionCycleToggle } from './_components/cycle-toggle';
import {
  SubscriptionCards,
  type SubscriptionCardData,
} from './_components/subscription-cards';
import { AiAddonCard } from './_components/ai-addon-card';
import { TokenWalletSection } from './_components/token-wallet-section';
import type { TokenPack } from '@/app/vendor-dashboard/tokens/_components/buy-tokens-cta';

/**
 * /vendor-dashboard/subscription — the unified "Plan & tokens" hub. Self-serve
 * Pro / Enterprise upgrade + the vendor token wallet in ONE place (owner
 * 2026-07-01 "keep subscription and tokens in one place. so they can make 1
 * purchase for both").
 *
 * Apply-then-pay: the vendor picks a plan + cycle (optionally folding a token
 * pack into the SAME order), starts it (create_vendor_subscription), pays our
 * BDO / GCash account with the reference code, and an admin confirms at
 * /admin/subscriptions — which activates the tier, grants the bundled tokens,
 * and credits any add-on tokens. Standalone token top-ups live in the token
 * wallet section below (TokenWalletSection). /vendor-dashboard/tokens redirects
 * here.
 *
 * PRICING is DB-DRIVEN: the subscription + token_pack SKUs come from
 * vendor_billing_catalog. The cards show the catalog price; the form posts only
 * sku_code (+ optional add-on pack sku); the RPC re-reads authoritative prices.
 * Cap + bundled-token copy comes from the TIER_CAPS /
 * TIER_SUBSCRIPTION_BUNDLE_TOKENS matrix in code (the capability source).
 *
 * Current tier + renewal date are read via a soft-probe (tier_state /
 * tier_expires_at are not in FULL_VENDOR_PROFILE_SELECT).
 */

export const metadata = { title: 'Plan & tokens · Vendor' };

const NUMBER = new Intl.NumberFormat('en-PH');

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type Props = {
  searchParams: Promise<{ ordered?: string; error?: string; cycle?: string }>;
};

// Self-serve subscription tiers. All three paid tiers (Solo · Pro · Enterprise)
// are buyable — create_vendor_subscription maps solo_/pro_/enterprise_ SKUs to
// their tier and mints an apply-then-pay order (Solo self-serve wired by
// migration 20270426213000: the solo_vendor_annual SKU + the RPC's solo branch).
type PaidTier = Extract<VendorTier, 'solo' | 'pro' | 'enterprise'>;

const PAID_TIERS: PaidTier[] = ['solo', 'pro', 'enterprise'];

const TIER_PITCH: Record<PaidTier, string> = {
  solo: 'For solo pros — one category, your real business name, unlimited inquiries.',
  pro: 'For growing studios — more categories, agent seats, and full analytics.',
  enterprise: 'For multi-branch teams — the widest reach, seats, and listings.',
};

// The tier-DIFFERENTIATING benefits, in a PARALLEL order across the three cards
// so a vendor can compare Solo → Pro → Enterprise line-by-line. Derived from the
// TIER_CAPS matrix (vendor-tier-caps.ts) so the copy can never drift from the
// enforced caps. Benefits shared by ALL paid plans (real name day one, unlimited
// in-app inquiries, marketplace search, own event website) live in the "Every
// plan includes" strip above the cards, not repeated on each card.
function keyCapLines(tier: PaidTier): string[] {
  const c = TIER_CAPS[tier];
  const fin = (n: number) => (Number.isFinite(n) ? NUMBER.format(n) : 'Unlimited');

  const categories = Number.isFinite(c.parentCategories)
    ? `${fin(c.parentCategories)} listing categor${c.parentCategories === 1 ? 'y' : 'ies'}`
    : 'List under every category';

  const seats =
    c.agentAccounts === 0
      ? 'Solo operator — no agent seats'
      : `${fin(c.agentAccounts)} agent seat${c.agentAccounts === 1 ? '' : 's'}`;

  const reach =
    !Number.isFinite(c.serviceRadiusKm) || c.serviceRadiusKm >= 100
      ? 'Nationwide reach'
      : `${fin(c.serviceRadiusKm)} km service reach`;

  const listings = Number.isFinite(c.servicesPerLeaf)
    ? `${fin(c.servicesPerLeaf)} service listings / category`
    : 'Unlimited service listings';

  const photos = `${fin(c.portfolioPhotos)} portfolio photos`;

  const analytics = c.marketIntel
    ? 'Advanced analytics + Demand Radar'
    : c.performanceAdvanced
      ? 'Advanced ROI & funnel analytics'
      : 'Business-performance basics';

  return [categories, seats, reach, listings, photos, analytics];
}

function skuFor(tier: PaidTier, cycle: 'monthly' | 'annual'): string {
  return `${tier}_vendor_${cycle}`;
}

export default async function VendorSubscriptionPage({ searchParams }: Props) {
  const search = await searchParams;
  const cycle: 'monthly' | 'annual' = search.cycle === 'annual' ? 'annual' : 'monthly';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Soft-probe tier_state + tier_expires_at + verification_state (none in the
  // shared profile select). verification_state gates the Vendor AI add-on.
  const { data: tierRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state, tier_expires_at, tier_billing_cycle, verification_state')
    .eq('user_id', user.id)
    .maybeSingle();
  const currentTier = asVendorTier(
    (tierRow as { tier_state?: string | null } | null)?.tier_state,
  );
  const tierExpiresAt =
    (tierRow as { tier_expires_at?: string | null } | null)?.tier_expires_at ?? null;
  const currentCycle =
    (tierRow as { tier_billing_cycle?: string | null } | null)?.tier_billing_cycle ?? null;
  const isVerifiedVendor =
    (tierRow as { verification_state?: string | null } | null)?.verification_state === 'verified';

  // ── Vendor AI ("the AI Chatbot") add-on state (owner 2026-07-22) ───────────
  // Paid (Solo+) + verified only. Soft reads (fetchVendorAiAddonState is
  // try/catch) so a pre-migration DB degrades to "not activated, trial
  // available" instead of blanking the page.
  const isPaidTierForAddon = isTierAtLeast(currentTier, 'solo');
  const [aiAddonState, aiAddonPricePhp] = await Promise.all([
    fetchVendorAiAddonState(supabase, profile.vendor_profile_id),
    fetchVendorAiAddonPricePhp(supabase),
  ]);
  const aiAddonActive = isVendorAiAddonActive(aiAddonState.expiresAt);

  // DB prices for the chosen cycle, keyed by sku_code.
  const [vendorCatalog, settings] = await Promise.all([
    fetchV2VendorCatalog(),
    fetchPlatformSettings(supabase),
  ]);
  const priceBySku = new Map<string, number>();
  for (const r of vendorCatalog) {
    if (
      r.offering_type === 'subscription_monthly' ||
      r.offering_type === 'subscription_annual'
    ) {
      priceBySku.set(r.sku_code, r.price_php);
    }
  }

  // Solo self-serve is gated on its wiring being LIVE. Migration 20270426213000
  // seeds solo_vendor_annual AND adds the RPC's solo branch together, so the
  // annual SKU's presence in the catalog is a safe proxy for "Solo checkout
  // works." Until it's applied, Solo is omitted so we never render a buy button
  // that would hard-error (UNMAPPED_SKU_TIER). Once applied, Solo appears on the
  // next request — no redeploy (this is a server component reading live prices).
  const soloBuyable = priceBySku.has('solo_vendor_annual');
  const visibleTiers: PaidTier[] = soloBuyable
    ? PAID_TIERS
    : PAID_TIERS.filter((t) => t !== 'solo');

  // Token packs available to fold into a plan order as an optional add-on
  // (one payment for plan + tokens). Cheapest first.
  const addonPacks: TokenPack[] = vendorCatalog
    .filter((r) => r.offering_type === 'token_pack' && (r.token_grant_count ?? 0) > 0)
    .map((r) => ({
      sku_code: r.sku_code,
      token_count: r.token_grant_count as number,
      price_php: r.price_php,
    }))
    .sort((a, b) => a.token_count - b.token_count);

  // When an order was just started, look up its amount (+ add-on breakdown) so
  // the pay panel can tell the vendor exactly how much to send. The reference is
  // SUB- (plan / combined) or TKN- (standalone token top-up); check both tables
  // (RLS scopes each read to the caller's own rows).
  let orderedSummary:
    | { amount: number; planAmount: number; addonAmount: number; addonTokens: number }
    | null = null;
  // A standalone token top-up (TKN-) already gets its full apply-then-pay panel
  // from <PendingPurchases> inside <TokenWalletSection>; flag it so we DON'T also
  // render the plan-level "How to pay" tile below (that was two BDO+GCash QR
  // blocks on one page after a token order).
  let orderedIsToken = false;
  if (search.ordered) {
    const { data: subRow } = await supabase
      .from('vendor_subscriptions')
      .select('amount_php, addon_amount_php, addon_token_count')
      .eq('reference_code', search.ordered)
      .maybeSingle();
    if (subRow) {
      const total = Number(subRow.amount_php ?? 0);
      const addonAmount = Number(subRow.addon_amount_php ?? 0);
      orderedSummary = {
        amount: total,
        planAmount: total - addonAmount,
        addonAmount,
        addonTokens: Number(subRow.addon_token_count ?? 0),
      };
    } else {
      const { data: tknRow } = await supabase
        .from('vendor_token_purchases')
        .select('amount_php, token_count')
        .eq('reference_code', search.ordered)
        .maybeSingle();
      if (tknRow) {
        orderedIsToken = true;
        orderedSummary = {
          amount: Number(tknRow.amount_php ?? 0),
          planAmount: 0,
          addonAmount: Number(tknRow.amount_php ?? 0),
          addonTokens: Number(tknRow.token_count ?? 0),
        };
      }
    }
  }

  // Renewal urgency — within ~14 days of expiry.
  const now = Date.now();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const expiresSoon =
    tierExpiresAt != null &&
    new Date(tierExpiresAt).getTime() - now <= fourteenDaysMs &&
    new Date(tierExpiresAt).getTime() > now;

  // Custom is a paid tier too (composed via the Stage-2 configurator / admin
  // handshake, not self-serve-buyable from PAID_TIERS below) — include it so the
  // renewal/expiry chip renders for Custom vendors.
  const isPaid =
    currentTier === 'solo' ||
    currentTier === 'pro' ||
    currentTier === 'enterprise' ||
    currentTier === 'custom';

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 sm:mb-8">
        <p className="sn-eye">Plan &amp; tokens</p>
        <h1 className="sn-h1 mt-1">
          Choose your plan.
        </h1>
        <p className="mt-2 max-w-prose text-sm text-ink/65">
          Upgrade to reach more couples and answer unlimited inquiries — no
          features are locked behind a paywall. Pro and Enterprise also bundle
          free tokens each cycle.
        </p>

        {/* Current tier + renewal */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
          >
            <Crown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Current plan:{' '}
            {currentTier === 'custom'
              ? 'Custom'
              : currentTier === 'enterprise'
                ? 'Enterprise'
                : currentTier === 'pro'
                  ? 'Pro'
                  : currentTier === 'solo'
                    ? 'Solo'
                    : currentTier === 'verified'
                      ? 'Free · Verified'
                      : 'Free'}
            {currentCycle ? ` · ${currentCycle}` : ''}
          </span>
          {isPaid && tierExpiresAt && (
            <span
              className={
                'text-xs ' + (expiresSoon ? 'font-medium text-orange' : 'text-ink/55')
              }
            >
              {expiresSoon ? 'Renews / expires soon — ' : ''}
              active through {fmtDate(tierExpiresAt)}
            </span>
          )}
        </div>

        {search.ordered && (
          <div className="mt-4 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-900">
            ✓ Order started. Pay with the reference{' '}
            <span className="font-mono font-semibold">{search.ordered}</span> using
            the instructions below — it activates once we confirm the payment.
          </div>
        )}
        {search.error && (
          <div className="mt-4 rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-900">
            {search.error}
          </div>
        )}
      </header>

      {/* Monthly / annual toggle (client component · updates ?cycle=) */}
      <SubscriptionCycleToggle cycle={cycle} />

      {/* Plan cards + mobile "Buy on web" nudge (client component for isNativeApp detection) */}
      <div className="mt-5">
        <SubscriptionCards
          cycle={cycle}
          packs={addonPacks}
          cards={visibleTiers.flatMap((tier) => {
            const sku = skuFor(tier, cycle);
            // Catalog price first; fall back to the code matrix only if the DB
            // read failed (e.g. CI with no service-role key).
            const price = priceBySku.get(sku) ?? TIER_PRICE_PHP[tier][cycle];
            const bundle = TIER_SUBSCRIPTION_BUNDLE_TOKENS[tier][cycle];
            const isCurrent = currentTier === tier && currentCycle === cycle;
            return [
              {
                tier,
                sku,
                pitch: TIER_PITCH[tier],
                price,
                cycle,
                bundleTokens: bundle,
                capLines: keyCapLines(tier),
                isCurrent,
                isPaid,
              } satisfies SubscriptionCardData,
            ];
          })}
        />
      </div>

      {/* Beyond Enterprise — compose a Custom plan (VENDOR_TIERS §11). Routes to
          the sub-route configurator; framed as the top-of-ladder escape valve. */}
      <Link
        href="/vendor-dashboard/subscription/custom"
        className="sn-card sn-press mt-5 flex flex-wrap items-center gap-4 p-5 sm:flex-nowrap"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'var(--m-paper)', border: '1px solid var(--m-line)' }}
        >
          <Sparkles className="h-5 w-5 text-terracotta" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">
            Beyond Enterprise? Compose a Custom plan.
          </p>
          <p className="mt-0.5 text-sm text-ink/60">
            {currentTier === 'custom'
              ? 'Review or adjust your Custom plan — dial in branches, reach, seats, listings, photos and tokens.'
              : 'Everything in Enterprise plus white-glove, then dial in exactly the branches, reach, seats, listings, photos and tokens you need.'}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-ink">
          {currentTier === 'custom' ? 'Manage' : 'Build a Custom plan'}
          <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
      </Link>

      {/* Vendor AI ("the AI Chatbot") add-on — free first 28-day cycle, then
          ₱1,500/28d, on paid + verified shops (owner 2026-07-22). */}
      <AiAddonCard
        eligible={isPaidTierForAddon && isVerifiedVendor}
        paidButUnverified={isPaidTierForAddon && !isVerifiedVendor}
        trialAvailable={aiAddonState.trialUsedAt == null}
        active={aiAddonActive}
        expiresAt={aiAddonState.expiresAt}
        pricePhp={aiAddonPricePhp}
        assistantLive={vendorAutoReplyEnabled()}
      />

      {/* Apply-then-pay payment instructions when a PLAN/COMBINED order was just
          started. Token-only (TKN-) top-ups are intentionally excluded — their
          instructions render once inside <TokenWalletSection> below, so showing
          this tile too would double the BDO+GCash QR blocks. */}
      {search.ordered && !orderedIsToken && (
        <div className="sn-tile mt-6 p-6">
          <p className="sn-eye">How to pay</p>
          {orderedSummary && orderedSummary.amount > 0 && (
            <div
              className="mt-3 rounded-lg border p-4"
              style={{ borderColor: 'var(--m-line)', background: 'rgba(255,255,255,.72)' }}
            >
              <p className="font-mono text-2xl font-bold text-ink">
                ₱{NUMBER.format(orderedSummary.amount)}
              </p>
              {orderedSummary.addonTokens > 0 && orderedSummary.planAmount > 0 ? (
                <p className="mt-0.5 text-xs text-ink/60">
                  Plan ₱{NUMBER.format(orderedSummary.planAmount)} ＋{' '}
                  {NUMBER.format(orderedSummary.addonTokens)} tokens ₱
                  {NUMBER.format(orderedSummary.addonAmount)}
                </p>
              ) : orderedSummary.addonTokens > 0 ? (
                <p className="mt-0.5 text-xs text-ink/60">
                  {NUMBER.format(orderedSummary.addonTokens)} tokens
                </p>
              ) : null}
            </div>
          )}
          <p className="mt-3 text-sm text-ink/65">
            Pay {orderedSummary && orderedSummary.amount > 0 ? 'that amount' : 'the amount'}{' '}
            to our BDO or GCash account and put{' '}
            <span className="font-mono font-semibold text-ink">{search.ordered}</span>{' '}
            in the transfer note so we can match it to your account. It activates
            once our team confirms the payment (within 24 hours).
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <PayBox
              label="BDO"
              name={settings.bdo_account_name}
              number={settings.bdo_account_number}
              qrUrl={settings.bdo_qr_url}
            />
            <PayBox
              label="GCash"
              name={settings.gcash_account_name}
              number={settings.gcash_number}
              qrUrl={settings.gcash_qr_url}
            />
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-ink/50">
            Setnayan does not hold these funds in escrow — you pay our receiving
            account directly. Your order is credited after our team confirms the
            payment.
          </p>
        </div>
      )}

      {/* Token wallet — buy standalone packs, see balances + history */}
      <TokenWalletSection />
    </main>
  );
}

function PayBox({
  label,
  name,
  number,
  qrUrl,
}: {
  label: string;
  name: string | null;
  number: string | null;
  qrUrl: string | null;
}) {
  const configured = Boolean(number?.trim() || qrUrl?.trim());
  const hasQr = Boolean(qrUrl?.trim());
  return (
    <div
      className="flex flex-col items-center rounded-md border px-3 py-3 text-center"
      style={{ borderColor: 'var(--m-line)' }}
    >
      <p className="text-[10px] uppercase tracking-[0.15em] text-ink/50">{label}</p>
      {configured ? (
        <>
          {hasQr && (
            <div
              className="relative mt-2 h-40 w-40 overflow-hidden rounded-lg border bg-white"
              style={{ borderColor: 'var(--m-line)' }}
            >
              {/* External URL · plain <img> (QR assets live on Supabase
                  storage, not in next/image's whitelisted domains) — mirrors
                  the token-purchase PendingPurchases QR pattern. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl as string}
                alt={`${label} payment QR code`}
                width={160}
                height={160}
                decoding="async"
                loading="lazy"
                className="h-full w-full object-contain p-2"
              />
            </div>
          )}
          {number?.trim() && (
            <p className="mt-2 font-mono text-sm font-semibold text-ink">{number}</p>
          )}
          {name?.trim() && <p className="text-[11px] text-ink/55">{name}</p>}
        </>
      ) : (
        <p className="mt-1 text-[11px] text-ink/45">
          Account details coming — our team will email them with your reference.
        </p>
      )}
    </div>
  );
}
