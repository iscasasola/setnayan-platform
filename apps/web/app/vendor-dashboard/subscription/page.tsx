import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { payPath } from '@/lib/pay-path';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import { countDueVendorFeeOrders } from '@/lib/vendor-booking-fees.server';
import { VENDOR_BOOKING_FEES_PATH } from '@/lib/vendor-booking-fees';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchV2VendorCatalog } from '@/lib/v2-catalog';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { openRailOptions } from '@/lib/payment-channels';
import {
  TIER_PRICE_PHP,
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
import {
  fetchVendor3dBoothState,
  fetchVendor3dBoothPricePhp,
  isVendor3dBoothActive,
} from '@/lib/vendor-3d-booth-pricing';
import { isVendorAddonTieredPricingEnabled } from '@/lib/vendor-addon-tiered-pricing-flag';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import {
  PHOTO_CHALLENGE_MIN_TIER,
  VENDOR_PHOTO_CHALLENGE_PERIOD_DAYS,
  fetchPhotoChallengeExpiry,
  fetchVendorPhotoChallengePricePhp,
  isPhotoChallengeSubscriptionActive,
} from '@/lib/vendor-photo-challenge';
import { resolveVendorAddonPricePhp } from '@/lib/vendor-addon-tier-pricing';
import { isVendorAddonFirst5FreeEnabled } from '@/lib/vendor-addon-first5-free-flag';
import {
  addonIsFreeUnderFirst5,
  fetchVendorCommittedBookingCount,
  first5BookingsRemaining,
} from '@/lib/vendor-addon-first5-free';
import { vendorAutoReplyEnabled } from '@/lib/vendor-autoreply-flag';
import { seating3dEnabled } from '@/lib/seating-3d-flag';
import { PlanPicker, type PlanPick } from './_components/plan-picker';
import { PlanRows } from './_components/plan-rows';
import { startSubscriptionPurchase } from './actions';
import { AiAddonCard } from './_components/ai-addon-card';
import { BoothAddonCard } from './_components/booth-addon-card';
import { PapicChallengeCard } from './_components/papic-challenge-card';
import { PlanChangeNotice } from './_components/plan-change-notice';
import { termIsTooShort, termTooShortMessage } from '@/lib/vendor-plan-change-words';
import { BOOTH_BRANDING_MIN_TIER } from '@/lib/seating-3d';
import { formatPhp } from '@/lib/php';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveBookingFeeStanding } from '@/lib/booking-fee-disclosure.server';
import type { BookingFeeStanding } from '@/lib/booking-fee-disclosure';
import { planWord } from '@/lib/vendor-plan-change-words';
import { bookingFeeRow, planGivesLines, planPickLine } from '@/lib/vendor-plan-rows';
import { VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE } from '@/lib/vendor-papic-credits';
import { isVendorFeatureGateEnabled } from '@/lib/vendor-feature-gate';
import { ShopNotice } from '../_components/kit';


/**
 * /vendor-dashboard/subscription — the vendor Plan hub. Self-serve Pro /
 * Enterprise upgrade.
 *
 * Apply-then-pay: the vendor picks a plan + cycle, starts it
 * (create_vendor_subscription), pays our BDO / GCash account with the reference
 * code, and an admin confirms at /admin/subscriptions — which activates the
 * tier.
 *
 * ⚠ THE TOKEN HALF IS GONE (2026-08-07). This page was the unified "Plan &
 * tokens" hub: a wallet panel, a standalone top-up path, and a pack you could
 * fold into the same order. All retired under the owner's 2026-07-21 lock —
 * "token can retire, there should be nothing that needs token anymore". Prod
 * never saw a pack bought or a token spent.
 *
 * PRICING is DB-DRIVEN: the subscription SKUs come from
 * vendor_billing_catalog. The cards show the catalog price; the form posts only
 * sku_code; the RPC re-reads authoritative prices. Cap copy comes from the
 * TIER_CAPS matrix in code (the capability source).
 *
 * Current tier + renewal date are read via a soft-probe (tier_state /
 * tier_expires_at are not in FULL_VENDOR_PROFILE_SELECT).
 */

export const metadata = { title: 'Plan · Supplier' };

const NUMBER = new Intl.NumberFormat('en-PH');

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type Props = {
  searchParams: Promise<{
    ordered?: string;
    error?: string;
    cycle?: string;
    /** A plan change that cost nothing -- the shop's own credit covered it. */
    applied?: string;
    /** A scheduled change was called off. */
    kept?: string;
  }>;
};

// Self-serve subscription tiers. All three paid tiers (Solo · Pro · Enterprise)
// are buyable — create_vendor_subscription maps solo_/pro_/enterprise_ SKUs to
// their tier and mints an apply-then-pay order (Solo self-serve wired by
// migration 20270426213000: the solo_vendor_annual SKU + the RPC's solo branch).
type PaidTier = Extract<VendorTier, 'solo' | 'pro' | 'enterprise'>;

const PAID_TIERS: PaidTier[] = ['solo', 'pro', 'enterprise'];

/**
 * How many days each cycle BUYS. These are the two periods
 * `create_vendor_subscription` writes (28 / 365) — the same numbers the
 * too-short rule is measured against there, so the screen and the database
 * cannot disagree about what a "monthly" plan is worth.
 */
const TERM_DAYS: Record<'monthly' | 'annual', number> = { monthly: 28, annual: 365 };

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

  // ── A scheduled plan change, and money the shop is holding ────────────────
  // ⚠ ITS OWN QUERY, DELIBERATELY. Naming a column PostgREST does not know
  // refuses the WHOLE select — and the select above also carries
  // `verification_state`, which gates both add-on cards. Folding these two
  // columns in would mean that on any environment running ahead of this
  // migration the plan screen silently loses the current plan, the renewal date
  // AND both add-ons at once. Kept separate, an unmigrated database degrades to
  // "nothing scheduled, no money held", which is the truth there anyway.
  const { data: planChangeRow } = await supabase
    .from('vendor_profiles')
    .select('pending_tier, subscription_credit_php')
    .eq('user_id', user.id)
    .maybeSingle();
  const pendingTier =
    (planChangeRow as { pending_tier?: string | null } | null)?.pending_tier ?? null;
  const heldCreditPhp = Number(
    (planChangeRow as { subscription_credit_php?: number | string | null } | null)
      ?.subscription_credit_php ?? 0,
  );

  // ── Vendor AI ("the AI Chatbot") add-on state (owner 2026-07-22) ───────────
  // Paid (Solo+) + verified only. Soft reads (fetchVendorAiAddonState is
  // try/catch) so a pre-migration DB degrades to "not activated, trial
  // available" instead of blanking the page.
  const isPaidTierForAddon = isTierAtLeast(currentTier, 'solo');
  const [aiAddonState, aiAddonCatalogPricePhp] = await Promise.all([
    fetchVendorAiAddonState(supabase, profile.vendor_profile_id),
    fetchVendorAiAddonPricePhp(supabase),
  ]);
  // 2026-07-25 tiered band for AI Chatbot Basic (₱2,000 Free/Solo · ₱1,500
  // Pro/Ent). Mirrors ai-addon-actions.ts so the card and the charge agree.
  const aiAddonPricePhp = isVendorAddonTieredPricingEnabled()
    ? resolveVendorAddonPricePhp('ai_chatbot_basic', currentTier)
    : aiAddonCatalogPricePhp;
  // Deep Search — About-You band (₱1,000 Free/Solo · ₱500 Pro/Ent) for the
  // doorway copy below, so the tile never quotes a price the runner won't charge.
  const deepSearchPricePhp = isVendorAddonTieredPricingEnabled()
    ? resolveVendorAddonPricePhp('deep_search_about_you', currentTier)
    : 500;
  const aiAddonActive = isVendorAiAddonActive(aiAddonState.expiresAt);

  // ── 3D Booth add-on state (owner 2026-07-22) ───────────────────────────────
  // PRO+ (Pro / Enterprise / Custom) + verified only — booth branding is a
  // Pro/Enterprise perk, so the add-on that turns it on is Pro+ too. Soft reads
  // (try/catch inside) degrade to "not activated, trial available" on a
  // pre-migration DB instead of blanking the page.
  //
  // 2026-07-25 tiered add-on model (flag-dark): when on, 3D Plan Ads opens to
  // EVERY tier at its band's price (₱2,000 Free/Solo · ₱1,500 Pro/Ent) — the
  // verified-only rule stays. Mirrors the buy action's gate exactly, so the card
  // never offers what the server would reject (or vice versa).
  const tieredAddonPricing = isVendorAddonTieredPricingEnabled();
  // ⚠ NOT `tieredAddonPricing || …` any more. Owner 2026-08-29 ruled the 3D
  // Booth floor the same way as Papic Challenges: paid plans only, Solo and up.
  // The flag keeps its PRICE job; it no longer decides access.
  const isPaidTierForBooth = isTierAtLeast(currentTier, BOOTH_BRANDING_MIN_TIER);
  const [boothAddonState, boothAddonCatalogPricePhp] = await Promise.all([
    fetchVendor3dBoothState(supabase, profile.vendor_profile_id),
    fetchVendor3dBoothPricePhp(supabase),
  ]);
  const boothAddonPricePhp = tieredAddonPricing
    ? resolveVendorAddonPricePhp('ads_3d_plan', currentTier)
    : boothAddonCatalogPricePhp;
  const boothAddonActive = isVendor3dBoothActive(boothAddonState.expiresAt);

  // ── Papic Challenges (owner 2026-08-28: "unlimited us 2500 for 4 weeks") ───
  // ₱2,500 / 28 days, unlimited, across every celebration the shop is booked
  // for — the replacement for the ₱400-per-event sponsorship. It is bought by
  // the SHOP, which is why it is on this hub and not on a celebration's page.
  // Same tier/verified shape as the 3D booth; NO free first cycle (the owner set
  // a trial for the AI + 3D add-ons only, and that has not changed).
  // ⚠ NOT `tieredAddonPricing || …` like the booth below it. Owner 2026-08-29
  // ruled the Papic Challenges floor separately from the tiered-pricing flag:
  // *"not when they are free"*. Solo and up, always — so the card offers exactly
  // what the server would accept.
  const isPaidTierForChallenge = isTierAtLeast(currentTier, PHOTO_CHALLENGE_MIN_TIER);
  const [papicChallengeExpiry, papicChallengeCatalogPricePhp] = await Promise.all([
    fetchPhotoChallengeExpiry(supabase, profile.vendor_profile_id),
    fetchVendorPhotoChallengePricePhp(supabase),
  ]);
  const papicChallengePricePhp = tieredAddonPricing
    ? resolveVendorAddonPricePhp('papic_challenge', currentTier)
    : papicChallengeCatalogPricePhp;
  const papicChallengeActive = isPhotoChallengeSubscriptionActive(papicChallengeExpiry);

  // "Free until your 6th booking" (owner 2026-07-25, flag-dark). Reads the SAME
  // pure decision the buy action does, off the SAME committed-booking count, so
  // the price on the card and the price charged can never disagree. The count
  // read fails CLOSED, so a bad read shows the paid price rather than a ₱0 the
  // server would refuse. Flag off → both false/0 and the card is unchanged.
  const first5FreeEnabled = isVendorAddonFirst5FreeEnabled();
  const committedBookings = first5FreeEnabled
    ? await fetchVendorCommittedBookingCount(supabase, profile.vendor_profile_id)
    : Number.NaN;
  const boothFirst5Free = addonIsFreeUnderFirst5({
    sku: 'ads_3d_plan',
    committedBookingCount: committedBookings,
    enabled: first5FreeEnabled,
  });
  const first5Remaining = first5FreeEnabled ? first5BookingsRemaining(committedBookings) : 0;
  // Same pure decision + same count as the booth, keyed on the challenge SKU —
  // the perk is per-SKU, so reusing the booth's boolean would silently give a
  // second add-on away (or withhold it) whenever the two SKUs' rules diverge.
  const challengeFirst5Free = addonIsFreeUnderFirst5({
    sku: 'papic_challenge',
    committedBookingCount: committedBookings,
    enabled: first5FreeEnabled,
  });

  // DB prices for the chosen cycle, keyed by sku_code.
  const [vendorCatalog, settings] = await Promise.all([
    fetchV2VendorCatalog(),
    fetchPlatformSettings(supabase),
  ]);
  // The rails the owner has left ON — every add-on card below offers only
  // these, and says "payments are paused" when there are none.
  const openRails = openRailOptions(settings);
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

  // When an order was just started, look up its amount so the pay panel can
  // tell the vendor exactly how much to send. Every reference is now SUB- (a
  // plan) — the TKN- standalone top-up lookup went with the token retirement
  // (owner 2026-07-21), along with the plan/add-on split, because a plan order
  // can no longer carry an add-on.
  let orderedSummary: { amount: number } | null = null;
  if (search.ordered) {
    const { data: subRow } = await supabase
      .from('vendor_subscriptions')
      .select('amount_php')
      .eq('reference_code', search.ordered)
      .maybeSingle();
    if (subRow) {
      orderedSummary = { amount: Number(subRow.amount_php ?? 0) };
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

  // Booking-fee doorway (surfacing layer). Flag-gated AND count-gated so nothing
  // shows when the fee system is dark OR the vendor owes nothing ("no fee →
  // nothing shows"). RLS scopes the count to this vendor's own fee orders.
  const bookingFeeDueCount = isBookingFeeEnabled()
    ? await countDueVendorFeeOrders(supabase, user.id)
    : 0;

  // ── THE ROWS' OWN READS (simpler supplier dashboard step 6) ──────────────
  // Two, in one parallel batch, each the shipped reader:
  //   · the booking-fee STANDING for the shop's next Setnayan booking — the same
  //     resolver the Agree forecast uses, so "N of 5 used" and the live schedule
  //     are the numbers the supplier is billed on (silent when the fee is off:
  //     no read at all);
  //   · the plan's paid orders and their receipts — one embedded read.
  const [feeStanding, planOrdersRead] = await Promise.all([
    isBookingFeeEnabled()
      ? resolveBookingFeeStanding(createAdminClient(), {
          vendorProfileId: profile.vendor_profile_id,
          eventId: null,
        }).catch((): BookingFeeStanding => ({ kind: 'unreadable' }))
      : Promise.resolve<BookingFeeStanding>({ kind: 'silent' }),
    supabase
      .from('orders')
      .select('order_id, description, requested_total_php, created_at, receipts!receipts_order_id_fkey(receipt_id)')
      .eq('user_id', user.id)
      .like('service_key', 'vendor_subscription__%')
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(6),
  ]);
  if (planOrdersRead.error) logQueryError('subscription: plan receipts', planOrdersRead.error);
  const planReceipts = planOrdersRead.error
    ? null
    : ((planOrdersRead.data ?? []) as Array<{
        order_id: string;
        description: string | null;
        requested_total_php: number | string | null;
        created_at: string;
        receipts: { receipt_id: string } | { receipt_id: string }[] | null;
      }>).map((o) => {
        const r = Array.isArray(o.receipts) ? o.receipts[0] : o.receipts;
        return {
          key: o.order_id,
          title: o.description?.trim() || 'Your plan',
          line: `${fmtDate(o.created_at)} · ${formatPhp(Number(o.requested_total_php ?? 0))}`,
          receiptId: r?.receipt_id ?? null,
        };
      });
  const feeRow = bookingFeeRow(feeStanding, bookingFeeDueCount);

  // The plan as ONE dropdown — every plan with its catalogue price per cycle.
  const expiresOn = isPaid && tierExpiresAt ? fmtDate(tierExpiresAt) : null;
  const pickCurrent = currentTier === 'verified' ? 'free' : currentTier;
  const plans: PlanPick[] = [
    { key: 'free', name: 'Free', price: {}, tooShort: {}, pickLine: planPickLine(currentTier, 'free', expiresOn) },
    ...visibleTiers.map((tier) => ({
      key: tier,
      name: planWord(tier),
      price: Object.fromEntries(
        (['monthly', 'annual'] as const).flatMap((cy) => {
          const v = priceBySku.get(skuFor(tier, cy)) ?? TIER_PRICE_PHP[tier][cy];
          return Number.isFinite(v) ? [[cy, v]] : [];
        }),
      ) as PlanPick['price'],
      tooShort: {
        monthly: termIsTooShort(TERM_DAYS.monthly, tierExpiresAt, now) ? termTooShortMessage(tierExpiresAt) : null,
        annual: termIsTooShort(TERM_DAYS.annual, tierExpiresAt, now) ? termTooShortMessage(tierExpiresAt) : null,
      },
      pickLine: planPickLine(currentTier, tier, expiresOn),
    })),
  ];
  const currentCycleKey: 'monthly' | 'annual' = currentCycle === 'annual' ? 'annual' : cycle;
  const currentPrice =
    currentTier === 'solo' || currentTier === 'pro' || currentTier === 'enterprise'
      ? priceBySku.get(skuFor(currentTier, currentCycleKey)) ?? null
      : null;
  const pays =
    currentTier === 'custom'
      ? 'your Custom quote'
      : currentPrice !== null
        ? `${formatPhp(currentPrice)} / ${currentCycleKey === 'annual' ? 'year' : '28 days'}`
        : isPaid
          ? 'paid'
          : 'nothing to pay';
  const papicPackPrice =
    vendorCatalog.find((r) => r.sku_code === VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE)?.price_php ?? null;
  const gives = planGivesLines(currentTier, isVendorFeatureGateEnabled());
  const featured = TIER_CAPS[currentTier].editorialFeatures;

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10" data-plan-screen="">
      <PlanRows
        tier={currentTier}
        pays={pays}
        expiresOn={expiresOn}
        expiresSoon={expiresSoon}
        isPaid={isPaid}
        notices={
          <>
            {/* A scheduled change, and money the shop is holding — in plain words,
                each shown only when it is true. The date it names is
                `tierExpiresAt`; there is no separate stored effective date. */}
            <PlanChangeNotice
              situation={{
                currentTier,
                pendingTier,
                tierExpiresAt,
                creditPhp: heldCreditPhp,
              }}
            />
            {search.applied && (
              <ShopNotice tone="success" role="status">
                Done — there was nothing to pay. The money already on your account covered it, and your new plan is on now.
              </ShopNotice>
            )}
            {search.kept && (
              <ShopNotice tone="success" role="status">
                Your plan stays as it is. What you paid for the change is on your account and comes off your next bill.
              </ShopNotice>
            )}
            {search.ordered && (
              <ShopNotice tone="success" role="status">
                Order started. Pay with the reference <span className="font-mono font-semibold">{search.ordered}</span> —
                it starts once we confirm the payment.
              </ShopNotice>
            )}
            {search.error && (
              <ShopNotice tone="gold" role="alert">
                {search.error}
              </ShopNotice>
            )}
          </>
        }
        picker={
          <PlanPicker
            plans={plans}
            current={pickCurrent}
            cycle={currentCycleKey}
            verified={isVerifiedVendor}
            action={startSubscriptionPurchase}
          />
        }
        feeRow={feeRow}
        gives={gives}
        receipts={planReceipts}
        papicPackPrice={papicPackPrice}
        featured={featured}
      />

      {/* ── ADD-ONS — the shipped cards, unchanged, under the row that points here ── */}
      <h2 id="add-ons" className="sn-sec mt-8 scroll-mt-24">
        Add-ons
      </h2>

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
        openRails={openRails}
      />

      {/* 3D Booth add-on — free first 28-day cycle, then ₱3,000/28d (flat, 2026-09-05), on
          Pro/Enterprise/Custom + verified shops (owner 2026-07-22). Turns on the
          vendor's branded booth inside their couples' published 3D Plans.
          With the 2026-07-25 tiered model on: every verified tier, at ₱2,000
          (Free/Solo) or ₱1,500 (Pro/Ent). */}
      <BoothAddonCard
        available={seating3dEnabled()}
        eligible={isPaidTierForBooth && isVerifiedVendor}
        paidButUnverified={isPaidTierForBooth && !isVerifiedVendor}
        trialAvailable={boothAddonState.trialUsedAt == null}
        active={boothAddonActive}
        expiresAt={boothAddonState.expiresAt}
        pricePhp={boothAddonPricePhp}
        first5Free={boothFirst5Free}
        first5Remaining={first5Remaining}
        openRails={openRails}
      />

      {/* Papic Challenges — ₱2,500 / 28 days, unlimited, across every
          celebration the shop is booked for (owner 2026-08-28). Replaces the
          ₱400-per-event sponsorship, which is why the buy surface is HERE and no
          longer on a celebration's page. */}
      <PapicChallengeCard
        available={papicGamesEnabled()}
        eligible={isPaidTierForChallenge && isVerifiedVendor}
        paidButUnverified={isPaidTierForChallenge && !isVerifiedVendor}
        active={papicChallengeActive}
        expiresAt={papicChallengeExpiry}
        pricePhp={papicChallengePricePhp}
        periodDays={VENDOR_PHOTO_CHALLENGE_PERIOD_DAYS}
        first5Free={challengeFirst5Free}
        first5Remaining={first5Remaining}
        openRails={openRails}
      />

      {/* Deep Search — a metered ₱500/search add-on that researches the vendor's
          OWN business to auto-fill their profile. Pro+ get 1 free per 28-day
          cycle; Solo always pays. The runnable surface lives on its own sub-route
          (owner 2026-07-22). */}
      <Link
        href="/vendor-dashboard/deep-search"
        className="sn-card sn-press mt-5 flex flex-wrap items-center gap-4 p-5 sm:flex-nowrap"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'var(--m-paper)', border: '1px solid var(--m-line)' }}
        >
          <Search className="h-5 w-5 text-terracotta" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">
            Deep Search — auto-fill your profile from the web.
          </p>
          <p className="mt-0.5 text-sm text-ink/60">
            {isPaidTierForAddon
              ? isVerifiedVendor
                ? isTierAtLeast(currentTier, 'pro')
                  ? `We research your business and hand you a “what we learned” review. 1 free every 28 days, then ₱${deepSearchPricePhp.toLocaleString('en-PH')} each.`
                  : `We research your business and hand you a “what we learned” review. ₱${deepSearchPricePhp.toLocaleString('en-PH')} per search on Solo.`
                : 'Get verified to run Deep Search — it researches your business and hands you a “what we learned” review to copy in.'
              : 'A paid-plan add-on: we research your business and hand you a “what we learned” review to auto-fill your profile.'}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-ink">
          Open Deep Search
          <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
      </Link>

      {/* Apply-then-pay payment instructions when a plan order was just
          started. This is the only payment tile on the screen — the token
          top-up path it used to share the page with is retired. */}
      {search.ordered && (
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
            </div>
          )}
          <p className="mt-3 text-sm text-ink/65">
            Put{' '}
            <span className="font-mono font-semibold text-ink">{search.ordered}</span>{' '}
            in the transfer note so we can match it to your account. It activates
            once our team confirms the payment (within 24 hours).
          </p>
          {/* 🔁 TWO `PayBox` TILES SAT HERE AND THEY WERE A THIRD PAYMENT
              SURFACE (removed 2026-09-20). They printed both receiving accounts
              beside their STATIC QR codes — codes carrying NO amount, which is
              the ₱0 scan the owner reported the same day — and offered no way
              to send the proof afterwards, so a shop that paid from this tile
              had nowhere to say so.

              🔑 ONE PAYMENT PROCESS, AND IT IS THE ONE THAT CAN TAKE THE
              MONEY. `/pay/<reference>` mints the code with the figure already
              inside it, shows the account to type instead, and takes the
              screenshot — the same rails the couple's checkout drawer renders
              (app/_components/payment/payment-rails.tsx). Owner, 2026-09-20:
              *"cant we have 1 type of payment process?"* */}
          <Link
            href={payPath(search.ordered)}
            className="button-primary mt-5 inline-flex items-center gap-2"
          >
            Send your payment
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </Link>
          <p className="mt-4 text-[11px] leading-relaxed text-ink/50">
            Setnayan does not hold these funds in escrow — you pay our receiving
            account directly. Your order is credited after our team confirms the
            payment.
          </p>
        </div>
      )}

    </main>
  );
}

