import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { endedPlanReadsFree, tierHasLapsed } from '@/lib/vendor-tier-lapse';
import { createClient } from '@/lib/supabase/server';
import { payPath } from '@/lib/pay-path';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import { countDueVendorFeeOrders } from '@/lib/vendor-booking-fees.server';
import { VENDOR_BOOKING_FEES_PATH } from '@/lib/vendor-booking-fees';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchV2VendorCatalog } from '@/lib/v2-catalog';
import { planGiftOf, giftEndsSoon, giftPlanLine, giftEndedLine, portfolioPlanRowLine } from '@/lib/plan-gift';
import { dayAfterWords, offerDayWords, offerFromInvite } from '@/lib/personal-invite-offer';
import { readPortfolioAllowance } from '@/lib/portfolio-allowance.server';
import { readClaimedTeamInvite } from '@/lib/vendor-invites';
import {
  TIER_CAPS,
  asVendorTier,
  canBuyExtraSeats,
  holdsBoughtExtras,
  portfolioPhotoCap,
  PORTFOLIO_FREE_BASE,
  PORTFOLIO_ALLOWANCE_UNREAD,
  type VendorTier,
} from '@/lib/vendor-tier-caps';
import { fetchVendorAiAddonState, isVendorAiAddonActive } from '@/lib/vendor-addon-pricing';
import { fetchVendorAddonPricePhp } from '@/lib/vendor-addon-tier-pricing';
import { SEAT_SKU_CODE } from '@/lib/vendor-seats';
import { BRANCH_SKU_CODE } from '@/lib/vendor-branches';
import { PlanSheet, type PlanPick, type SheetPlan } from './plan-sheet';
import { changeKind, payToday, planChanges, planDirection, planRowLine, sheetPlans } from '@/lib/plan-sheet';
import { papersProgress } from '@/lib/locks';
import { REQUIRED_DOC_COUNT, countCompleteRequiredSlots, fetchLatestApplication, type DocUploadMap } from '@/lib/vendor-verification';
import { isStoreShellRequest } from '@/lib/request-platform';
import { PlanRows } from './plan-rows';
import { startSubscriptionPurchase } from '../actions';
import { BadgeUpgradesSection } from './badge-upgrades-section';
import { loadBadgeUpgradesSection } from './badge-upgrades-data';
import { PlanChangeNotice } from './plan-change-notice';
import { COUNT_ADDON_KINDS, COUNT_ADDONS, fetchAddOnExtras } from '@/lib/vendor-ultra-addons';
import { termIsTooShort, termTooShortMessage } from '@/lib/vendor-plan-change-words';
import { formatPhp } from '@/lib/php';
import { createAdminClient } from '@/lib/supabase/admin';
import { downgradeFit } from '@/lib/downgrade-limits';
import { readDowngradeFacts, readStoredBytes, storageAllowanceBytes } from '@/lib/downgrade-limits.server';
import { storageRowLine } from '@/lib/supplier-storage';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveBookingFeeStanding } from '@/lib/booking-fee-disclosure.server';
import type { BookingFeeStanding } from '@/lib/booking-fee-disclosure';
import { planWord } from '@/lib/vendor-plan-change-words';
import { bookingFeeRow, planGivesLines, planPickLine } from '@/lib/vendor-plan-rows';
import { fetchShopPapicPacks } from '@/lib/vendor-papic-grants';
import { isVendorFeatureGateEnabled } from '@/lib/vendor-feature-gate';
import { ShopNotice } from '../../_components/kit';


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


const NUMBER = new Intl.NumberFormat('en-PH');

/**
 * 📅 RW-30 (walk 13 Nov 2026): ONE date phrasing on this page — "12 Dec 2026", the gift's own words (`offerDayWords`),
 * of the MANILA day. It printed "Dec 11, 2026" (US order, the server's UTC day) beside the gift's "12 Dec 2026" for the
 * same moment: a plan that ends at 00:24 on 12 Dec in Manila is still 11 Dec in UTC.
 */
function fmtDate(s: string) {
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return s;
  const manilaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  return offerDayWords(manilaDay);
}

export type PlanSearch = {
    ordered?: string;
    error?: string;
    cycle?: string;
    /** A plan change that cost nothing -- the shop's own credit covered it. */
    applied?: string;
    /** A scheduled change was called off. */
    kept?: string;
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

/**
 * 🏪 THE PLAN SCREEN, ONE DRAWING FOR TWO SEATS (2026-10-31, DECISION_LOG "SHOP ⚙ — WHAT A SUPPLIER SETS ONCE"): the
 * Plan page (`/vendor-dashboard/subscription`) and the Shop ⚙'s "Plan and billing" fold both mount THIS — never a second
 * plan editor. `embedded` drops the page's own column (the sheet is the column).
 */
export async function PlanScreen({ search, embedded = false }: { search: PlanSearch; embedded?: boolean }) {
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
  const readTierRow = () =>
    supabase
      .from('vendor_profiles')
      .select('tier_state, tier_expires_at, tier_billing_cycle, verification_state, tier_source')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
  let { data: tierRow } = await readTierRow();
  // ⏳ A PLAN THAT HAS RUN OUT IS ENDED BEFORE THIS SCREEN DRAWS IT (Lane G · Step 0 rows 14–15, 2026-11-10).
  // The layout's lapse sweep runs AFTER the response, so this page — the one that prints the plan and its day —
  // drew the ended plan as current ("You are on Solo · until Oct 19, 2026") on the visit that ended it. When the
  // row says the day has passed, ask the same sweep now and read again. Downgrade-only and idempotent; a refused
  // sweep leaves the first read in place (the layout's after() still runs).
  if (tierHasLapsed(tierRow as { tier_state?: string | null; tier_expires_at?: string | null } | null, Date.now())) {
    const { error: sweepErr } = await supabase.rpc('sweep_vendor_tier_expiry', {
      p_vendor_id: profile.vendor_profile_id,
    });
    if (sweepErr) {
      console.error('[supabase-error] subscription/plan-screen · rpc:sweep_vendor_tier_expiry', sweepErr);
    } else {
      const reread = await readTierRow();
      if (!reread.error && reread.data) tierRow = reread.data;
    }
  }
  // 🔒 A REFUSED SWEEP NEVER DRAWS A PAST DAY AS THE FUTURE (Build 5 row 14 + Lane W, 2026-11-11). If the row still
  // says a plan whose day has passed, read it as the sweep would have written it — Free/Verified, no end day — which
  // is what every gate already enforces. Held by lib/an-ended-plan-never-reads-as-current.test.ts.
  tierRow = endedPlanReadsFree(tierRow, Date.now());
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
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  const pendingTier =
    (planChangeRow as { pending_tier?: string | null } | null)?.pending_tier ?? null;
  const heldCreditPhp = Number(
    (planChangeRow as { subscription_credit_php?: number | string | null } | null)
      ?.subscription_credit_php ?? 0,
  );

  // ── 💳 WHAT IS LEFT TO BUY, AND WHAT A SHOP ALREADY BOUGHT (owner 2026-11-14, DECISION_LOG "SIMPLER SUPPLIER PLANS",
  // drawing § 3). The AI chatbot, specialized tools and Ultra's four "+1" add-ons are folded into the plans, so their
  // cards leave this page (what a plan includes is under "What <plan> gives you"). Left: a Deep Search row with its
  // price (every plan) and, on Ultra, an extra seats and branches row. A shop that bought a chatbot window or an Ultra
  // "+1" before the change keeps it until it runs out (item 11) — said on its own row while it runs.
  const ultraHoldsExtras = holdsBoughtExtras(currentTier);
  const [ultraExtras, aiAddonState, deepSearchPricePhp, extraSeatsRead] = await Promise.all([
    ultraHoldsExtras ? fetchAddOnExtras(supabase, profile.vendor_profile_id) : Promise.resolve(null),
    fetchVendorAiAddonState(supabase, profile.vendor_profile_id),
    fetchVendorAddonPricePhp(supabase, 'deep_search_about_you', currentTier),
    canBuyExtraSeats(currentTier)
      ? supabase.from('vendor_profiles').select('extra_agent_seats').eq('vendor_profile_id', profile.vendor_profile_id).maybeSingle()
      : Promise.resolve(null),
  ]);
  const aiAddonActive = isVendorAiAddonActive(aiAddonState.expiresAt);
  const extraSeats =
    extraSeatsRead && !extraSeatsRead.error
      ? Number((extraSeatsRead.data as { extra_agent_seats?: number | null } | null)?.extra_agent_seats ?? 0)
      : null;

  // DB prices for the chosen cycle, keyed by sku_code.
  const vendorCatalog = await fetchV2VendorCatalog();
  // The extra seat and the extra branch (Ultra only) — the rows their purchases CHARGE; unread → no figure.
  const seatPricePhp = vendorCatalog.find((r) => r.sku_code === SEAT_SKU_CODE)?.price_php ?? null;
  const branchPricePhp = vendorCatalog.find((r) => r.sku_code === BRANCH_SKU_CODE)?.price_php ?? null;
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

  const isPaid =
    currentTier === 'solo' ||
    currentTier === 'pro' ||
    currentTier === 'enterprise';

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

  // Every plan with its catalogue price per cycle — the plan sheet's rows read these.
  const expiresOn = isPaid && tierExpiresAt ? fmtDate(tierExpiresAt) : null;
  const plans: PlanPick[] = [
    { key: 'free', name: 'Free', price: {}, tooShort: {}, pickLine: planPickLine(currentTier, 'free', expiresOn) },
    ...visibleTiers.map((tier) => ({
      key: tier,
      name: planWord(tier),
      price: Object.fromEntries(
        (['monthly', 'annual'] as const).flatMap((cy) => {
          // 💰 The catalogue row or nothing (owner 2026-11-13): an unread plan price shows no figure and no Pay button.
          const v = priceBySku.get(skuFor(tier, cy));
          return v !== undefined && Number.isFinite(v) ? [[cy, v]] : [];
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

  // 📋 THE PLAN SHEET (Build 5 · Lane B, Door 2) — the same plans and prices as above, as rows that open in place: what
  // changes (TIER_CAPS) and what you pay today (`payToday`, the plan-change RPC's own arithmetic). The unused value of
  // the current plan is the server's `vendor_unused_plan_value_php` (admin-only, called for THIS shop's own id); a
  // failed read is said on the row ("the exact amount shows on your order"), never guessed.
  const paywallOn = isVendorFeatureGateEnabled();
  const [unusedPhp, papersRead, storeShell] = await Promise.all([
    isPaid
      ? (async () => {
          const { data, error } = await createAdminClient().rpc('vendor_unused_plan_value_php', {
            p_vendor_id: profile.vendor_profile_id,
          });
          if (error) {
            logQueryError('subscription/plan-screen · rpc:vendor_unused_plan_value_php', error);
            return null;
          }
          const n = Number(data);
          return Number.isFinite(n) ? n : null;
        })().catch(() => null)
      : Promise.resolve(0),
    isVerifiedVendor
      ? Promise.resolve(null)
      : fetchLatestApplication(supabase, profile.vendor_profile_id)
          .then((a) => ({ done: countCompleteRequiredSlots((a?.doc_uploads ?? {}) as DocUploadMap), of: REQUIRED_DOC_COUNT }))
          .catch((err) => {
            console.error('[supabase-error] subscription/plan-screen · latest application', err);
            return null;
          }),
    isStoreShellRequest(),
  ]);
  const pickBy = new Map(plans.map((p) => [p.key, p]));
  // 📉 THE LIMITS SHEET (ruling 5683): what the shop has today that a LOWER plan does not hold — read once, only when
  // there is a lower plan to show (Free has none below it).
  const downgradeFacts =
    currentTier === 'free' ? null : await readDowngradeFacts(supabase, createAdminClient(), profile.vendor_profile_id);
  const sheet: SheetPlan[] = sheetPlans(currentTier)
    .filter((t) => t === 'free' || t === 'verified' || (visibleTiers as readonly string[]).includes(t))
    .map((t) => {
      const paid = t === 'solo' || t === 'pro' || t === 'enterprise';
      const pick = paid ? pickBy.get(t) : undefined;
      const price = pick?.price ?? {};
      const kind = changeKind(currentTier, tierExpiresAt, t, now);
      return {
        key: t,
        name: planWord(t),
        line:
          t === currentTier
            ? expiresOn
              ? `Active until ${expiresOn}`
              : isVerifiedVendor || t !== 'free'
                ? 'Nothing to pay · nothing renews by itself'
                : 'Not verified yet · nothing to pay'
            : planRowLine(currentTier, t, paywallOn, expiresOn),
        paid,
        price,
        tooShort: pick?.tooShort ?? {},
        today: Object.fromEntries(
          (Object.entries(price) as [keyof typeof price, number][]).map(([cy, v]) => [
            cy,
            payToday({ kind, price: v, unusedPhp, creditPhp: heldCreditPhp, currentRaw: currentTier, endsOn: expiresOn }),
          ]),
        ),
        pickLine: planPickLine(currentTier, t, expiresOn),
        changes: planChanges(currentTier, t, paywallOn),
        fit:
          downgradeFacts && planDirection(currentTier, t) === 'down'
            ? downgradeFit(downgradeFacts, currentTier, t, { paywallOn, storageAllowanceBytes: storageAllowanceBytes(t), now: new Date(now) })
            : null,
      };
    });
  const currentPrice =
    currentTier === 'solo' || currentTier === 'pro' || currentTier === 'enterprise'
      ? priceBySku.get(skuFor(currentTier, currentCycleKey)) ?? null
      : null;
  const pays =
    currentPrice !== null
      ? `${formatPhp(currentPrice)} / ${currentCycleKey === 'annual' ? 'year' : '28 days'}`
      : isPaid
        ? 'paid'
        : 'nothing to pay';
  // 🛍 2026-11-04: the shop buys the couple's Papic packs — the row quotes the smallest one's catalogue price.
  const papicPackPrice = (await fetchShopPapicPacks(createAdminClient()))?.[0]?.pricePhp ?? null;
  const gives = planGivesLines(currentTier, isVendorFeatureGateEnabled());
  const featured = TIER_CAPS[currentTier].editorialFeatures;

  // 🎁 A PLAN SETNAYAN GAVE (prototype supplier_personal_invite_2026-10-23 C1 · C3, owner-approved). While it runs,
  // the answer line names the gift instead of a price nobody pays, and the picker's rows say ₱0 until the day. Once a
  // personal invite's plan gift has ended (the comp lapse wrote the shop back to Free), the line says it ended. The
  // photos row reads the shop's own allowance — the invite's 100 are kept (owner ruling 2026-10-23).
  const gift = planGiftOf(
    {
      tier_state: (tierRow as { tier_state?: string | null } | null)?.tier_state ?? null,
      tier_source: (tierRow as { tier_source?: string | null } | null)?.tier_source ?? null,
      tier_expires_at: tierExpiresAt,
    },
    now,
  );
  const [allowance, claimedInvite] = await Promise.all([
    readPortfolioAllowance(supabase, profile.vendor_profile_id),
    (async () => readClaimedTeamInvite(createAdminClient(), profile.vendor_profile_id))().catch((err) => {
      console.error('[supabase-error] subscription · claimed invite', err);
      return null;
    }),
  ]);
  const invited = claimedInvite ? offerFromInvite(claimedInvite) : null;
  const todayDay = new Date(now + 8 * 3_600_000).toISOString().slice(0, 10);
  const giftEnded =
    !gift && !isPaid && invited?.tier && invited.untilDay && invited.untilDay < todayDay
      ? { plan: planWord(invited.tier), untilDay: invited.untilDay }
      : null;

  // An allowance that could not be read says so — never "50 free" in its place (a gifted 100 would read as 50).
  const photosLine = allowance.ok
    ? portfolioPlanRowLine({
        held: (profile.portfolio_r2_keys ?? []).length,
        cap: portfolioPhotoCap(currentTier, allowance.allowance),
        gifted: (allowance.allowance ?? 0) > PORTFOLIO_FREE_BASE,
        giftUntilDay: gift ? gift.untilDay : null,
        giftEnded: Boolean(giftEnded),
      })
    : PORTFOLIO_ALLOWANCE_UNREAD;

  // 💾 STORAGE (owner 2026-11-13 "plan storage": Solo 5 GB · Pro 10 GB · Ultra 15 GB) — "1.2 GB of 5 GB used", from the
  // SAME read the limits sheet and the upload refusal use. A read that failed says so, never "0 MB". No allowance (Free ·
  // Verified) = no row. The limits sheet above already read it for every paid plan; read again only if it did not.
  const storageLine =
    storageAllowanceBytes(currentTier) === null
      ? null
      : storageRowLine(
          currentTier,
          downgradeFacts
            ? downgradeFacts.storedBytes === null
              ? { status: 'unread' }
              : { status: 'ok', bytes: downgradeFacts.storedBytes }
            : await readStoredBytes(createAdminClient(), profile.vendor_profile_id),
        );

  // 💳 The rows that replaced the add-on cards (drawing § 3). Deep Search's own route is web-only (lib/store-shell.ts),
  // so the row is not drawn in the store app.
  const deepSearchRow = storeShell
    ? null
    : {
        line:
          deepSearchPricePhp !== null
            ? `${formatPhp(deepSearchPricePhp)} a search · on every plan`
            : 'One search at a time · on every plan',
      };
  const seatPrice = seatPricePhp !== null ? formatPhp(seatPricePhp) : null;
  const branchPrice = branchPricePhp !== null ? formatPhp(branchPricePhp) : null;
  const extrasRow = canBuyExtraSeats(currentTier)
    ? {
        line: [
          extraSeats === null ? null : `${NUMBER.format(extraSeats)} extra ${extraSeats === 1 ? 'seat' : 'seats'}`,
          seatPrice && branchPrice
            ? seatPrice === branchPrice
              ? `${seatPrice} each, every 4 weeks`
              : `seat ${seatPrice} · branch ${branchPrice}, every 4 weeks`
            : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'Add a seat on Team, a branch under Where',
      }
    : null;
  // Item 11 — what this shop bought before the fold, while it still runs.
  const bought: { key: string; title: string; line: string }[] = [];
  if (aiAddonActive && aiAddonState.expiresAt) {
    bought.push({ key: 'ai', title: 'AI chatbot, bought', line: `Runs until ${fmtDate(aiAddonState.expiresAt)}, then your plan covers it` });
  }
  if (ultraExtras) {
    for (const k of COUNT_ADDON_KINDS) {
      const n = ultraExtras[k];
      if (n > 0) bought.push({ key: k, title: `${COUNT_ADDONS[k].label} × ${NUMBER.format(n)}, bought`, line: 'Counts on top of your plan until it runs out' });
    }
  }

  return (
    <Column embedded={embedded}>
      <PlanRows
        titled={!embedded}
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
          <PlanSheet
            plans={sheet}
            current={currentTier}
            cycle={currentCycleKey}
            verified={isVerifiedVendor}
            action={startSubscriptionPurchase}
            expiresOn={expiresOn}
            storeShell={storeShell}
            papersProgress={papersProgress(papersRead)}
            gift={
              gift
                ? {
                    untilShort: offerDayWords(gift.untilDay).replace(/ \d{4}$/, ''),
                    untilFull: offerDayWords(gift.untilDay),
                    // Last week: Pay comes back on the current plan, starting the day after — no forced Free gap.
                    endsSoon: giftEndsSoon(gift),
                    startsShort: dayAfterWords(gift.untilDay),
                  }
                : null
            }
          />
        }
        feeRow={feeRow}
        gives={gives}
        receipts={planReceipts}
        papicPackPrice={papicPackPrice}
        featured={featured}
        gift={gift ? { line: giftPlanLine(gift) } : giftEnded ? { line: giftEndedLine(giftEnded.plan, giftEnded.untilDay) } : null}
        photosLine={photosLine}
        storageLine={storageLine}
        deepSearch={deepSearchRow}
        extras={extrasRow}
        bought={bought}
      />

      {/* 🎁 YOUR GIFTS moved to Shop › Promote (owner 2026-11-05, DECISION_LOG "SHOP › PROMOTE IS THE HOME OF THE
          SUPPLIER QR CODES, PRINTS AND GIFTS") — one place for every marketing tool. Not linked from here: the Plan is
          what the shop pays Setnayan; gifts are what it gives its couples. 🔒 shop/promote/gifts-live-on-promote.test.ts */}

      {/* ⏱ YOUR UPGRADES (owner, 6 Nov) — add-on time a badge gave the shop, ready until Start. Above the add-on cards
          it extends; a started one shows on its card as on. */}
      <BadgeUpgradesSection data={await loadBadgeUpgradesSection(profile.vendor_profile_id)} />

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

    </Column>
  );
}


/** The page's own column — or, inside the Shop ⚙'s sheet, none (the sheet is the column). */
function Column({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? (
    <div className="pb-2" data-plan-screen="" data-plan-embedded="">
      {children}
    </div>
  ) : (
    <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10" data-plan-screen="">
      {children}
    </div>
  );
}
