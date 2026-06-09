import { redirect } from 'next/navigation';
import { Check, Crown } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchV2VendorCatalog } from '@/lib/v2-catalog';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  TIER_PRICE_PHP,
  TIER_SUBSCRIPTION_BUNDLE_TOKENS,
  TIER_CAPS,
  asVendorTier,
  type VendorTier,
} from '@/lib/vendor-tier-caps';
import { startSubscriptionPurchase } from './actions';
import { SubscriptionCycleToggle } from './_components/cycle-toggle';

/**
 * /vendor-dashboard/subscription — self-serve Pro / Enterprise upgrade
 * (Phase D · Vendor Tier #5). Apply-then-pay: the vendor picks a plan + cycle,
 * starts an order (create_vendor_subscription), pays our BDO / GCash account
 * with the reference code, and an admin confirms at /admin/subscriptions —
 * which activates the tier + grants the bundled tokens.
 *
 * PRICING is DB-DRIVEN: the subscription SKUs (pro/enterprise · monthly/annual)
 * come from vendor_billing_catalog. The cards show the catalog price; the form
 * posts only the sku_code (the RPC re-reads the authoritative price). The cap +
 * bundled-token copy comes from the TIER_CAPS / TIER_SUBSCRIPTION_BUNDLE_TOKENS
 * matrix in code (the capability source of truth).
 *
 * Current tier + renewal date are read via a soft-probe (tier_state /
 * tier_expires_at are not in FULL_VENDOR_PROFILE_SELECT).
 */

export const metadata = { title: 'Subscription · Vendor' };

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

type PaidTier = Extract<VendorTier, 'pro' | 'enterprise'>;

const PAID_TIERS: PaidTier[] = ['pro', 'enterprise'];

const TIER_PITCH: Record<PaidTier, string> = {
  pro: 'For growing studios — more reach, agents, and unlimited in-app inquiries.',
  enterprise: 'For multi-branch teams — unlimited everything, nationwide reach.',
};

// The few caps worth surfacing on a marketing-style card (the full matrix lives
// in vendor-tier-caps.ts). Keep this list short + scannable.
function keyCapLines(tier: PaidTier): string[] {
  const c = TIER_CAPS[tier];
  const fin = (n: number) => (Number.isFinite(n) ? NUMBER.format(n) : 'Unlimited');
  return [
    `${fin(c.parentCategories)} listing categor${c.parentCategories === 1 ? 'y' : 'ies'}`,
    `${fin(c.agentAccounts)} agent seat${c.agentAccounts === 1 ? '' : 's'}`,
    `${Number.isFinite(c.serviceRadiusKm) ? `${fin(c.serviceRadiusKm)} km` : 'Nationwide'} reach`,
    `${fin(c.portfolioPhotos)} portfolio photos`,
    'Unlimited in-app inquiries',
    'Real business name shown day one',
  ];
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

  // Soft-probe tier_state + tier_expires_at (not in the shared profile select).
  const { data: tierRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state, tier_expires_at, tier_billing_cycle')
    .eq('user_id', user.id)
    .maybeSingle();
  const currentTier = asVendorTier(
    (tierRow as { tier_state?: string | null } | null)?.tier_state,
  );
  const tierExpiresAt =
    (tierRow as { tier_expires_at?: string | null } | null)?.tier_expires_at ?? null;
  const currentCycle =
    (tierRow as { tier_billing_cycle?: string | null } | null)?.tier_billing_cycle ?? null;

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

  // Renewal urgency — within ~14 days of expiry.
  const now = Date.now();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  const expiresSoon =
    tierExpiresAt != null &&
    new Date(tierExpiresAt).getTime() - now <= fourteenDaysMs &&
    new Date(tierExpiresAt).getTime() > now;

  const isPaid = currentTier === 'pro' || currentTier === 'enterprise';

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 sm:mb-8">
        <p className="m-eyebrow">Vendor subscription</p>
        <h1 className="m-display-tight mt-1 text-3xl sm:text-4xl">
          Choose your plan.
        </h1>
        <p className="mt-2 max-w-prose text-sm text-ink/65">
          Subscriptions sell reach, not paywalled features. Upgrade to be seen by
          more couples, add agent seats, and answer unlimited in-app inquiries.
          Each plan bundles free tokens every period.
        </p>

        {/* Current tier + renewal */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
          >
            <Crown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Current plan:{' '}
            {currentTier === 'pro'
              ? 'Pro'
              : currentTier === 'enterprise'
                ? 'Enterprise'
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
              {currentTier === 'pro' || currentTier === 'enterprise'
                ? `active through ${fmtDate(tierExpiresAt)}`
                : ''}
            </span>
          )}
        </div>

        {search.ordered && (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            ✓ Upgrade started. Pay with the reference{' '}
            <span className="font-mono font-semibold">{search.ordered}</span> using
            the instructions below — your plan activates once we confirm the payment.
          </div>
        )}
        {search.error && (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {search.error}
          </div>
        )}
      </header>

      {/* Monthly / annual toggle (client component · updates ?cycle=) */}
      <SubscriptionCycleToggle cycle={cycle} />

      <div className="mt-5 grid gap-4 sm:gap-6 lg:grid-cols-2">
        {PAID_TIERS.map((tier) => {
          const sku = skuFor(tier, cycle);
          // Catalog price first; fall back to the code matrix only if the DB
          // read failed (e.g. CI with no service-role key).
          const price = priceBySku.get(sku) ?? TIER_PRICE_PHP[tier][cycle];
          const bundle = TIER_SUBSCRIPTION_BUNDLE_TOKENS[tier][cycle];
          const isCurrent = currentTier === tier && currentCycle === cycle;
          return (
            <section
              key={tier}
              className="m-card flex flex-col p-6"
              style={tier === 'enterprise' ? { borderColor: 'var(--m-orange)' } : undefined}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="m-label-mono">
                  {tier === 'pro' ? 'Pro' : 'Enterprise'}
                </p>
                {isCurrent && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-800">
                    Current
                  </span>
                )}
              </div>
              <p className="text-sm text-ink/65">{TIER_PITCH[tier]}</p>

              <p className="mt-4">
                <span className="text-3xl font-semibold text-ink">
                  ₱{NUMBER.format(price)}
                </span>
                <span className="text-sm text-ink/55">
                  {' '}
                  / {cycle === 'monthly' ? '28 days' : 'year'}
                </span>
              </p>
              <p className="mt-1 text-xs text-ink/55">
                Includes {NUMBER.format(bundle)} free tokens{' '}
                {cycle === 'monthly' ? 'each period' : 'on activation'}.
              </p>

              <ul className="mt-4 space-y-2">
                {keyCapLines(tier).map((line) => (
                  <li key={line} className="flex items-start gap-2 text-sm text-ink/75">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                      strokeWidth={2.25}
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <form action={startSubscriptionPurchase} className="mt-5">
                <input type="hidden" name="sku_code" value={sku} />
                <SubmitButton
                  className="button-primary w-full"
                  pendingLabel="Starting…"
                >
                  {isPaid
                    ? isCurrent
                      ? 'Renew this plan'
                      : `Switch to ${tier === 'pro' ? 'Pro' : 'Enterprise'}`
                    : `Upgrade to ${tier === 'pro' ? 'Pro' : 'Enterprise'}`}
                </SubmitButton>
              </form>
            </section>
          );
        })}
      </div>

      {/* Apply-then-pay payment instructions when an order was just started */}
      {search.ordered && (
        <div className="mt-6 m-card p-6">
          <p className="m-label-mono">How to pay</p>
          <p className="mt-1 text-sm text-ink/65">
            Pay the amount to our BDO or GCash account and put{' '}
            <span className="font-mono font-semibold text-ink">{search.ordered}</span>{' '}
            in the transfer note so we can match it to your account. Your plan
            activates once our team confirms the payment (within 24 hours).
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
            account directly. The plan is credited after our team confirms the
            payment.
          </p>
        </div>
      )}
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
