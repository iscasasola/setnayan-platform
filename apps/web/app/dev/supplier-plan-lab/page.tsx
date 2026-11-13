/**
 * /dev/supplier-plan-lab — simpler supplier dashboard STEP 6 on fixture data: Plan · Helpers · Settings ·
 * Notifications · Help · How is my business doing. No sign-in, no database. DEV-ONLY: production builds 404
 * this route (the same kill-switch as `/dev/supplier-lab`). It mounts the REAL screens — `PlanRows` + `PlanSheet` (+ the shared lock and Door 1),
 * `HelpersView`, `SettingsView`, `NotificationsView`, `BusinessDoing` and the Help rows — so what it shows
 * is what ships. Every write is the SHIPPED action; with no session each one refuses, nothing is written.
 *
 *   ?s=plan            the Plan (who=parish · caterer · studio)       &unverified=1 · &fail=1 (receipts + fee unread)
 *   ?s=lock            🔒 the shared lock explainer (&lock=<key> · &plan=pro for a plan lock)
 *   ?s=plan&who=studio&limits=1   📉 the limits sheet on a lower plan (ruling 5683) · &floor=1 the storage floor (lab allowance)
 *   ?s=limit           ⤴ Door 1 — past a plan limit (&tier=solo &key=bookingsPerDate &want=2 · &unverified=1)
 *   ?s=helpers         Helpers (who=parish: owner + a free Helper · studio: admins, team members, an open vote)
 *   ?s=settings        Settings (&staff=1 — a scoped team member)
 *   ?s=notifs          Notifications › Recent (incl. "Someone else was booked")      &empty=1
 *   ?s=help            Help
 *   ?s=business        How is my business doing (who=…)               &new=1 — nobody has found you yet
 *   ?s=march           Event Hub › the Wedding March, read-only (band · coordinator)   &unread=1
 *   ?s=gifts           Shop › Promote › Your gifts (supplier gift stock, 2026-11-04; on Plan until 2026-11-05)  &unverified=1 (list price) · &fail=1 (unread)
 *                      &app=1 (the iPhone app: stock + Bought, no Buy)
 *                      &buy=1 opens nothing by itself — press "Buy gifts"
 *   ?s=gifts-couple    the couple's quote note "Gift from <shop> 🎁"    &given=1 (after the first payment) · &unlock=1 (+ Event Plus)
 *   ?s=gifts-admin     Admin › Gifts & comps › Supplier gifts             &fail=1 (both reads refused)
 *   ?s=prints          Shop › Promote › Prints (2026-11-05) — the REAL section; its pictures come from the lab's twin of
 *                      `/api/vendor/prints` (`./prints-art/[shop]`, same renderer, a fixture shop)   &long=1 (long name + seal,
 *                      rating, badges) · &noaddress=1 (no web address yet)
 *   (?s=more is gone with More itself — 2026-10-21, the bar is Today · Customers · Shop · Hub; /more redirects to Settings)
 */
import { GIFT_LIMIT_PCT_DEFAULT } from '@/lib/setnayan-gift';
import { notFound } from 'next/navigation';
import { PlanRows } from '@/app/vendor-dashboard/subscription/_components/plan-rows';
import { PlanSheet, type PlanPick, type SheetPlan } from '@/app/vendor-dashboard/subscription/_components/plan-sheet';
import { changeKind, limitAsk, payToday, planChanges, planDirection, planRowLine, sheetPlans, type PlanLimitKey } from '@/lib/plan-sheet';
import { downgradeFit, type DowngradeFacts } from '@/lib/downgrade-limits';
import { EARLY_SHOPS_PAPERS_DUE_ISO } from '@/lib/verified-badge';
import { asVendorTier } from '@/lib/vendor-tier-caps';
import { papersProgress } from '@/lib/locks';
import { planWord } from '@/lib/vendor-plan-change-words';
import { LabLimit, LabLock } from './lab-open';
import type { LockKey } from '@/lib/locks';
import { startSubscriptionPurchase } from '@/app/vendor-dashboard/subscription/actions';
import { HelpersView } from '@/app/vendor-dashboard/team/_components/helpers-view';
import {
  buyExtraSeat,
  cancelAdminMotion,
  inviteVendorTeamMember,
  proposeAdminMotion,
  removeVendorTeamMember,
  setVendorAgentServices,
  stepDownSelf,
  updateVendorTeamMember,
  voteAdminMotion,
} from '@/app/vendor-dashboard/team/actions';
import { SettingsView } from '@/app/vendor-dashboard/settings/settings-view';
import { settingsMoreTools, SUPPLIER_HELP_ROWS } from '@/app/vendor-dashboard/settings/settings-rows';
import { NotificationsView } from '@/app/vendor-dashboard/notifications/notifications-view';
import { MarchRead } from '@/app/vendor-dashboard/on-the-day/live/[eventId]/_components/march-read';
import { ConsolePlate } from '@/app/vendor-dashboard/on-the-day/_components/pahina-console';
import type { MarchSection } from '@/lib/march-drag';
import { BusinessDoing, type DoingWindow } from '@/app/vendor-dashboard/performance/_components/business-doing';
import { DatesRow } from '@/app/vendor-dashboard/customers/_components/dates-row';
import { BOOKING_FEE } from '@/lib/booking-fee';
import { bookingFeeRow, planGivesLines, planPickLine } from '@/lib/vendor-plan-rows';
import { giftEndedLine, giftEndsSoon, giftPlanLine, planGiftOf, portfolioPlanRowLine } from '@/lib/plan-gift';
import { dayAfterWords } from '@/lib/personal-invite-offer';
import { portfolioPhotoCap } from '@/lib/vendor-tier-caps';
import { storageRowLine } from '@/lib/supplier-storage';
import { seatLine, teamSeats } from '@/lib/vendor-free-helper';
import { barHeights, businessSentence, fromLine, ratingLine, replyLine } from '@/lib/business-doing';
import type { VendorTeamMemberWithUser } from '@/lib/vendor-team';
import type { NotificationRow } from '@/lib/notifications';
import type { GrantedReward } from '@/lib/badge-rewards';
import { ShopGiftsSection } from '@/app/vendor-dashboard/shop/promote/_components/shop-gifts-section';
import { ShopPrintsSection } from '@/app/vendor-dashboard/shop/promote/_components/shop-prints-section';
import { QuoteShopGiftNote } from '@/app/_components/quote-shop-gift-note';
import { ShopGiftsLedger } from '@/app/admin/gifts/_components/shop-gifts-ledger';
import { BadgeUpgradesSection } from '@/app/vendor-dashboard/subscription/_components/badge-upgrades-section';
import { BadgeUpgradesLedger } from '@/app/admin/gifts/_components/badge-upgrades-ledger';
import { startableChoices, type BadgeUpgradeChoice, type BadgeUpgradeRow } from '@/lib/badge-upgrades';
import { shopGiftPacksFrom } from '@/lib/shop-gifts';
import { formatCentavos } from '@/lib/vendor-proposals';
import { REQUIRED_DOC_COUNT } from '@/lib/vendor-verification';

type Who = 'parish' | 'caterer' | 'studio';

const SHOPS: Record<Who, { tier: string; cycle: 'monthly' | 'annual'; expires: string | null; used: number; feeKind: 'free' | 'billable' }> = {
  parish: { tier: 'free', cycle: 'monthly', expires: null, used: 1, feeKind: 'free' },
  caterer: { tier: 'solo', cycle: 'monthly', expires: '31 October 2026', used: 2, feeKind: 'free' },
  studio: { tier: 'pro', cycle: 'annual', expires: '3 October 2027', used: 5, feeKind: 'billable' },
};

/** Lab-only stand-in prices — the page reads `vendor_billing_catalog`; these never reach a supplier. */
const LAB_PRICES: Record<string, { monthly: number; annual: number }> = {
  solo: { monthly: 1000, annual: 10400 },
  pro: { monthly: 2500, annual: 26000 },
  enterprise: { monthly: 6000, annual: 62400 },
};

/** The plan sheet's rows from the lab's picks — the same lib calls the Plan screen makes (`plan-screen.tsx`). */
function labSheet(
  tier: string,
  picks: readonly PlanPick[],
  expiresOn: string | null,
  expiresAt: string | null,
  nowMs: number,
  limits: { floor: boolean } | null = null,
): SheetPlan[] {
  const by = new Map(picks.map((p) => [p.key, p]));
  return sheetPlans(tier).map((t) => {
    const paid = t === 'solo' || t === 'pro' || t === 'enterprise';
    const pick = paid ? by.get(t) : undefined;
    const price = pick?.price ?? {};
    const kind = changeKind(tier, expiresAt, t, nowMs);
    return {
      key: t,
      name: planWord(t),
      line: t === tier ? (expiresOn ? `Active until ${expiresOn}` : 'Nothing to pay · nothing renews by itself') : planRowLine(tier, t, false, expiresOn),
      paid,
      price,
      tooShort: pick?.tooShort ?? {},
      today: Object.fromEntries(
        (Object.entries(price) as [keyof typeof price, number][]).map(([cy, v]) => [
          cy,
          payToday({ kind, price: v, unusedPhp: 400, creditPhp: 0, currentRaw: tier, endsOn: expiresOn }),
        ]),
      ),
      pickLine: planPickLine(tier, t, expiresOn),
      changes: planChanges(tier, t, false),
      fit:
        limits && planDirection(tier, t) === 'down'
          ? downgradeFit(LAB_DOWN_FACTS, asVendorTier(tier), t, {
              paywallOn: false,
              storageAllowanceBytes: limits.floor ? LAB_STORAGE_ALLOWANCE : null,
              now: new Date(nowMs),
            })
          : null,
    };
  });
}

/**
 * 📉 `?s=plan&who=studio&limits=1` — the LIMITS SHEET (ruling 5683) on a Pro shop with more than Solo holds: five
 * services over three categories, one taking three bookings a day, four counted seats, three included branches, a
 * 100 km reach and a Verified badge on the 30 March renewal day. `&floor=1` adds the storage floor with a LAB-ONLY
 * allowance (the lab's own number, so the floor draws on any plan; the real one is `storageAllowanceBytes`, read from
 * TIER_CAPS — Solo 5 GB · Pro 10 GB · Ultra 15 GB since 2026-11-13).
 */
const labCard = (id: string, name: string, kind: string, family: string, daily: number | null) => ({
  id,
  name,
  kind,
  families: [family],
  live: true,
  hold: null,
  holdStartsOn: null,
  daily,
});
const LAB_DOWN_FACTS: DowngradeFacts = {
  founder: false,
  cards: [
    labCard('c1', 'Wedding photos', 'photography', 'photo-video', 3),
    labCard('c2', 'Same-day edit', 'videography', 'photo-video', 1),
    labCard('c3', 'Prenup shoot', 'photography', 'photo-video', 1),
    labCard('c4', 'Photo booth', 'photo_booth', 'entertainment', 1),
    labCard('c5', 'Bridal flowers', 'florist', 'styling', 1),
  ],
  includedBranches: 3,
  seats: { people: 5, freeHelpers: 1, counted: 4 },
  extraSeats: 0,
  reachKm: 100,
  storedBytes: 7_400_000_000,
  badge: { verification_state: 'verified', next_renewal_due_at: EARLY_SHOPS_PAPERS_DUE_ISO },
};
/** LAB-ONLY storage allowance — never a ruled figure. */
const LAB_STORAGE_ALLOWANCE = 5_000_000_000;

/** Lab-only "now" and term ends, so the sheet's today/then lines are stable in a screenshot. */
const LAB_SHEET_NOW = Date.parse('2026-11-10T02:00:00Z');
const LAB_EXPIRES_AT: Record<string, string | null> = { free: null, solo: '2026-12-08T15:59:59Z', pro: '2027-10-03T15:59:59Z' };

function planFixture(who: Who, unverified: boolean, fail: boolean, limits: { floor: boolean } | null = null) {
  const shop = SHOPS[who];
  const plans: PlanPick[] = [
    { key: 'free', name: 'Free', price: {}, tooShort: {}, pickLine: planPickLine(shop.tier, 'free', shop.expires) },
    ...(['solo', 'pro', 'enterprise'] as const).map((t) => ({
      key: t,
      name: t === 'solo' ? 'Supplier Plus' : t === 'pro' ? 'Supplier Pro' : 'Supplier Ultra',
      price: LAB_PRICES[t]!,
      tooShort: { monthly: who === 'studio' ? 'You are paid up to 3 October 2027 — pick a year so it covers that.' : null, annual: null },
      pickLine: planPickLine(shop.tier, t, shop.expires),
    })),
  ];
  const standing = fail
    ? ({ kind: 'unreadable' } as const)
    : shop.feeKind === 'free'
      ? ({ kind: 'free', ordinal: shop.used + 1, ordinalIsFrozen: false, schedule: BOOKING_FEE } as const)
      : ({ kind: 'billable', ordinal: 9, ordinalIsFrozen: false, schedule: BOOKING_FEE } as const);
  const price = shop.tier in LAB_PRICES ? LAB_PRICES[shop.tier]![shop.cycle] : null;
  return (
    <PlanRows
      tier={shop.tier}
      pays={price !== null ? `₱${price.toLocaleString('en-PH')} / ${shop.cycle === 'annual' ? 'year' : '28 days'}` : 'nothing to pay'}
      expiresOn={shop.expires}
      expiresSoon={who === 'caterer'}
      isPaid={shop.tier !== 'free'}
      picker={
        <PlanSheet
          plans={labSheet(shop.tier, plans, who === 'caterer' ? '8 Dec 2026' : shop.expires, LAB_EXPIRES_AT[shop.tier] ?? null, LAB_SHEET_NOW, limits)}
          current={shop.tier}
          cycle={shop.cycle}
          verified={!unverified}
          action={startSubscriptionPurchase}
          expiresOn={who === 'caterer' ? '8 Dec 2026' : shop.expires}
          papersProgress={papersProgress({ done: 2, of: REQUIRED_DOC_COUNT })}
        />
      }
      feeRow={bookingFeeRow(standing, who === 'studio' ? 1 : 0)}
      gives={planGivesLines(shop.tier, false)}
      receipts={
        fail
          ? null
          : shop.tier === 'free'
            ? []
            : [
                { key: 'r1', title: `${shop.tier === 'pro' ? 'Supplier Pro' : 'Supplier Plus'} plan`, line: 'Thu 1 Oct 2026 · lab price', receiptId: 'lab-receipt' },
                { key: 'r2', title: `${shop.tier === 'pro' ? 'Supplier Pro' : 'Supplier Plus'} plan`, line: 'Tue 1 Sep 2026 · lab price', receiptId: null },
              ]
      }
      papicPackPrice={99}
      featured={shop.tier === 'pro'}
    />
  );
}

/**
 * 🎁 `?s=plan&gift=running|soon|ended` (+ `&photos=100`) — a shop on a plan Setnayan gave, from a personal invite
 * (prototype `supplier_personal_invite_2026-10-23` C1 · C3): Pro free until 31 Jan 2027, in its last week (Pay is back
 * on Pro, starting 1 Feb — no Free gap), or after it ended. The words are the shipped helpers' (`lib/plan-gift.ts`);
 * the lab's "now" is 1 Nov 2026 (running), 27 Jan 2027 (soon) or 2 Feb 2027 (ended).
 */
function giftPlanFixture(mode: 'running' | 'soon' | 'ended', photos100: boolean) {
  const now = Date.parse(
    mode === 'running' ? '2026-11-01T02:00:00Z' : mode === 'soon' ? '2027-01-27T02:00:00Z' : '2027-02-02T02:00:00Z',
  );
  const tier = mode === 'ended' ? 'free' : 'pro';
  const gift = planGiftOf({ tier_state: 'pro', tier_source: 'admin_comp', tier_expires_at: '2027-01-31T15:59:59.000Z' }, now);
  const plans: PlanPick[] = [
    { key: 'free', name: 'Free', price: {}, tooShort: {}, pickLine: planPickLine(tier, 'free', gift ? '31 January 2027' : null) },
    ...(['solo', 'pro', 'enterprise'] as const).map((t) => ({
      key: t,
      name: t === 'solo' ? 'Supplier Plus' : t === 'pro' ? 'Supplier Pro' : 'Supplier Ultra',
      price: LAB_PRICES[t]!,
      tooShort: { monthly: null, annual: null },
      pickLine: planPickLine(tier, t, gift ? '31 January 2027' : null),
    })),
  ];
  const cap = portfolioPhotoCap(tier, photos100 ? 100 : null);
  return (
    <PlanRows
      tier={tier}
      pays="nothing to pay"
      expiresOn={null}
      expiresSoon={false}
      isPaid={tier !== 'free'}
      picker={
        <PlanSheet
          plans={labSheet(tier, plans, null, null, now)}
          current={tier}
          cycle="monthly"
          verified
          action={startSubscriptionPurchase}
          expiresOn={null}
          papersProgress={papersProgress(null)}
          gift={
            gift
              ? { untilShort: '31 Jan', untilFull: '31 Jan 2027', endsSoon: giftEndsSoon(gift), startsShort: dayAfterWords(gift.untilDay) }
              : null
          }
        />
      }
      feeRow={bookingFeeRow({ kind: 'free', ordinal: 1, ordinalIsFrozen: false, schedule: BOOKING_FEE } as const, 0)}
      gives={planGivesLines(tier, false)}
      receipts={[]}
      papicPackPrice={99}
      featured={tier === 'pro'}
      gift={gift ? { line: giftPlanLine(gift) } : { line: giftEndedLine('Pro', '2027-01-31') }}
      photosLine={portfolioPlanRowLine({
        held: mode === 'ended' ? 62 : 14,
        cap,
        gifted: photos100,
        giftUntilDay: gift ? gift.untilDay : null,
        giftEnded: mode === 'ended',
      })}
      storageLine={storageRowLine(tier, { status: 'ok', bytes: 1_240_000_000 })}
    />
  );
}

const ME = 'u-owner';
const member = (id: string, name: string, role: VendorTeamMemberWithUser['role'], label: string | null = null): VendorTeamMemberWithUser => ({
  vendor_team_member_id: id,
  public_id: id,
  vendor_profile_id: 'vp',
  user_id: id === 'm0' ? ME : `u-${id}`,
  role,
  team_label: label,
  created_at: '2026-09-01',
  updated_at: '2026-09-01',
  email: `${name.split(' ')[0]!.toLowerCase()}@example.com`,
  display_name: name,
});

function helpersFixture(who: Who) {
  const team =
    who === 'studio'
      ? [member('m0', 'Nena Villar', 'admin'), member('m1', 'Jo Santos', 'admin'), member('m2', 'Marco Lim', 'agent', 'Video'), member('m3', 'Front desk', 'viewer', 'Front desk')]
      : who === 'parish'
        ? [member('m0', 'Fr. Luis Abad', 'admin'), member('m1', 'Tita Baby Ramos', 'viewer', 'Parish office')]
        : [member('m0', 'Alegria Cruz', 'admin')];
  const cap = who === 'studio' ? 3 : 1;
  const motions =
    who === 'studio'
      ? [{ motion_id: 'mo1', vendor_profile_id: 'vp', target_user_id: 'u-m1', proposed_by: ME, kind: 'demote', new_role: 'agent', status: 'open', created_at: '2026-10-10' }]
      : [];
  return (
    <HelpersView
      userId={ME}
      founderUserId={ME}
      enriched={team}
      motionData={{ motions: motions as never, votes: [] }}
      services={who === 'studio' ? ([{ vendor_service_id: 's1', category: 'photo_video', is_active: true }] as never) : []}
      assignments={who === 'studio' ? { m2: ['s1'] } : {}}
      seatsLine={seatLine(teamSeats(team, ME), cap)}
      canBuySeats={false}
      storeShell={false}
      extraSeats={0}
      seatFeePhp={0}
      search={{}}
      actions={{
        update: updateVendorTeamMember,
        remove: removeVendorTeamMember,
        buySeat: buyExtraSeat,
        vote: voteAdminMotion,
        cancelMotion: cancelAdminMotion,
        propose: proposeAdminMotion,
        stepDown: stepDownSelf,
        invite: inviteVendorTeamMember,
        setServices: setVendorAgentServices,
      }}
    />
  );
}

/* 🚶 The march a band reads (owner 2026-10-23) — the shape `marchSections` hands the console. Names are samples. */
const MARCH_FIXTURE: MarchSection[] = [
  { key: 'groom', label: 'The Groom & his parents', rows: [[{ id: 'm1', name: 'Mr. Peregrino Dela Cruz', role: 'parent' }, { id: 'm2', name: 'Mrs. Milagros Dela Cruz', role: 'parent' }], [{ id: 'm3', name: 'Jose Dela Cruz', role: 'groom', tag: 'Groom' }, null]] },
  { key: 'family', label: 'Immediate family', rows: [[{ id: 'm4', name: 'Ms. Carmen Reyes', role: 'family' }, { id: 'm5', name: 'Mr. Fidel Santos', role: 'family' }]] },
  { key: 'honor', label: 'Maid of Honor & Best Man', rows: [[{ id: 'm6', name: 'Mr. Daniel Ramos', role: 'honor_attendant' }, { id: 'm7', name: 'Ms. Ana Reyes Dela Cruz', role: 'honor_attendant' }]] },
  { key: 'sponsors', label: 'Principal sponsors', rows: [[{ id: 'm8', name: 'Hon. Ricardo Villahermosa', role: 'sponsor' }, { id: 'm9', name: 'Mrs. Jessica Villahermosa', role: 'sponsor' }], [{ id: 'm10', name: 'Atty. Cesar Lim', role: 'sponsor' }, { id: 'm11', name: 'Mrs. Pilar Lim', role: 'sponsor' }]] },
  { key: 'bride', label: 'The Bride & her parents', rows: [[{ id: 'm12', name: 'Maria Santos', role: 'bride', tag: 'Bride' }, { id: 'm13', name: 'Mr. Andres Santos', role: 'parent' }]] },
];

const NOTICES: NotificationRow[] = [
  // ⏱ The couple shifted the day (owner 2026-10-23) — one notice per shift, words from `scheduleShiftTitle`.
  { notification_id: 'n0', user_id: ME, type: 'schedule_shifted', title: 'Schedule moved +30 min from 4:00 PM', body: 'Ana & Paolo shifted the day from Cocktails on. Open the schedule for the new times.', related_url: '/vendor-dashboard/on-the-day/live/e1#schedule', read_at: null, created_at: '2026-10-14T04:00:00Z' },
  { notification_id: 'n1', user_id: ME, type: 'inquiry_displaced', title: 'Someone else was booked', body: 'Reyes · Sat 12 Dec · the couple booked another supplier, so this ask was released.', related_url: '/vendor-dashboard/messages/t1', read_at: null, created_at: '2026-10-14T03:00:00Z' },
  { notification_id: 'n2', user_id: ME, type: 'vendor_inquiry_received', title: 'New booking inquiry', body: 'Ana & Miguel asked about Sat 12 Dec.', related_url: '/vendor-dashboard/messages/t2', read_at: null, created_at: '2026-10-14T01:00:00Z' },
  { notification_id: 'n3', user_id: ME, type: 'review_request', title: 'A review came in', body: '5 ★ · reply when you can', related_url: '/vendor-dashboard/reviews', read_at: '2026-10-13T00:00:00Z', created_at: '2026-10-12T01:00:00Z' },
];

function businessFixture(who: Who, fresh: boolean) {
  const totals = fresh
    ? { month: { views: 0, inquiries: 0, booked: 0 }, year: { views: 0, inquiries: 0, booked: 0 } }
    : who === 'studio'
      ? { month: { views: 312, inquiries: 14, booked: 4 }, year: { views: 2900, inquiries: 120, booked: 31 } }
      : { month: { views: 48, inquiries: 6, booked: 2 }, year: { views: 410, inquiries: 40, booked: 12 } };
  const attr = (s: number, o: number) => ({ setnayan: { bookingCount: s }, offPlatform: { bookingCount: o } });
  const windows: DoingWindow[] = [
    { key: 'month', label: 'Last 28 days', ...totals.month, bookedPhp: fresh ? 0 : who === 'studio' ? 186000 : 23000, ...businessSentence(totals.month), from: fromLine(fresh ? attr(0, 0) : attr(1, 1)) },
    { key: 'year', label: 'Last 12 months', ...totals.year, bookedPhp: fresh ? 0 : 640000, ...businessSentence(totals.year), from: fromLine(fresh ? attr(0, 0) : attr(9, 12)) },
  ];
  const series = fresh ? [] : [1, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 8].map((b, i) => ({ bookings: b, label: `M${i + 1}` }));
  return (
    <BusinessDoing
      windows={windows}
      initial="month"
      bars={barHeights(series)}
      barLabels={series.map((p) => p.label)}
      reply={replyLine(fresh ? { shown: false, reason: 'no_median' } : { shown: true, label: 'Usually responds in 2h', medianMinutes: 120, sample: 12 })}
      rating={ratingLine({ measured: true, row: fresh ? null : { review_count: 31, review_avg_bayesian: 4.8 } })}
      more={[
        { key: 'over-time', title: 'Over time', line: 'Bookings and money by day, month and year', href: '#over-time', pro: false },
        { key: 'market', title: 'Demand and prices near you', line: 'Busy months ahead · how your prices sit', href: '#market', pro: false },
      ]}
    />
  );
}

/** YOUR FACTS' Verified seal + the badges piece read these on the lab — the fixture shop's facts as a data: URI (no route). */
function labBadgeFactsUrl(long: boolean): string {
  const facts = long
    ? { verified: true, completedEvents: 100, trusted: { trusted_avg_rating: 4.9, trusted_review_count: 32 }, inBusinessSinceYear: 2014, awards: [], nowYear: 2026 }
    : { verified: false, completedEvents: 0, trusted: null, inBusinessSinceYear: null, awards: [], nowYear: 2026 };
  return `data:application/json;base64,${Buffer.from(JSON.stringify({ facts })).toString('base64')}`;
}

export default async function SupplierPlanLabPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const s = sp.s ?? 'plan';
  const who: Who = sp.who === 'parish' || sp.who === 'studio' ? sp.who : 'caterer';

  let body: React.ReactNode = null;
  if (s === 'plan') {
    body =
      sp.gift === 'running' || sp.gift === 'soon' || sp.gift === 'ended'
        ? giftPlanFixture(sp.gift, sp.photos === '100')
        : planFixture(who, sp.unverified === '1', sp.fail === '1', sp.limits === '1' ? { floor: sp.floor === '1' } : null);
  }
  // 🔒 ?s=lock&lock=quotation (any key in lib/locks.ts) — the shared lock's explainer, risen; &plan=pro = a plan lock.
  else if (s === 'lock') {
    const key = (sp.lock ?? 'quotation') as LockKey;
    body = (
      <LabLock
          lock={key}
          need={
            sp.plan
              ? { kind: 'plan', plan: sp.plan, price: `${planWord(sp.plan)} · lab price / 28 days`, href: '/vendor-dashboard/subscription' }
              : { kind: 'verify', progress: papersProgress({ done: 2, of: REQUIRED_DOC_COUNT }) }
          }
          preview={
            <div className="space-y-1.5 text-[13.5px] text-ink">
              <div className="flex justify-between"><span>Photo coverage · 8 hours</span><b>lab price</b></div>
              <div className="flex justify-between"><span>Same-day edit</span><b>lab price</b></div>
              <div className="flex justify-between border-t border-ink/10 pt-1.5"><span>Total · due 1 Dec</span><b>lab price</b></div>
            </div>
          }
        />
    );
  }
  // ⤴ ?s=limit&tier=solo&key=bookingsPerDate&want=2 — Door 1, going past a plan limit (&unverified=1).
  else if (s === 'limit') {
    const key = (sp.key ?? 'bookingsPerDate') as PlanLimitKey;
    const tier = sp.tier ?? 'solo';
    const ask = limitAsk(tier, key, Number(sp.want ?? '2'), false);
    body = ask ? (
      <LabLimit ask={ask} verified={sp.unverified !== '1'} price="lab price / 28 days" />
    ) : (
      <p>Within the limit — no sheet.</p>
    );
  }
  else if (s === 'helpers') return helpersFixture(who);
  else if (s === 'settings')
    body = (
      <SettingsView
        unread={3}
        manager={sp.staff !== '1'}
        payout={who === 'parish' ? 'none' : 'ready'}
        tools={settingsMoreTools({ hasMoodboardLibraryAccess: true, hasMusicRepertoireAccess: who === 'studio', storeShell: false })}
      />
    );
  else if (s === 'notifs') body = <NotificationsView items={sp.empty === '1' ? [] : NOTICES} returnTo="/dev/supplier-plan-lab?s=notifs" />;
  else if (s === 'help')
    body = (
      <>
        <h1 className="sn-h1">Help</h1>
        <div className="mt-3">
          {SUPPLIER_HELP_ROWS.map((r) => (
            <DatesRow key={r.key} data={`help-${r.key}`} title={r.title} line={r.line} href={r.href} />
          ))}
        </div>
      </>
    );
  else if (s === 'march')
    body = (
      <ConsolePlate>
        <MarchRead sections={sp.unread === '1' ? [] : MARCH_FIXTURE} unread={sp.unread === '1'} />
      </ConsolePlate>
    );
  else if (s === 'business')
    body = (
      <>
        <h1 className="sn-h1">How is my business doing</h1>
        <div className="mt-2">{businessFixture(who, sp.new === '1')}</div>
      </>
    );

  else if (s === 'gifts') body = giftsFixture(sp.unverified === '1', sp.fail === '1', sp.app === '1');
  else if (s === 'prints')
    body = (
      <ShopPrintsSection
        canShare={sp.noaddress !== '1'}
        setupHref="/dev/supplier-plan-lab?s=prints"
        artBase={`/dev/supplier-plan-lab/prints-art/${sp.long === '1' ? 'long' : 'plain'}`}
        member={sp.noname === '1' ? null : { name: 'Juan dela Cruz', role: sp.long === '1' ? 'Head chef' : null }}
        facts={sp.long === '1' ? { name: 'Casa Buenaventura Catering & Events Services', line: 'Catering' } : { name: 'Setnayan Productions', line: 'Weddings & Events' }}
        badgeFactsUrl={labBadgeFactsUrl(sp.long === '1')}
      />
    );
  else if (s === 'gifts-couple')
    body = (
      <section className="p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/55">What&rsquo;s included</h2>
        <p className="mt-2 flex items-baseline justify-between border-t border-ink/15 pt-3 text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatCentavos(11_250_000)}</span>
        </p>
        <QuoteShopGiftNote
          credits={1150}
          given={sp.given === '1' ? 1150 : 0}
          unlocks={sp.unlock === '1' ? ['Event Plus'] : []}
          unlocksGiven={sp.given === '1' && sp.unlock === '1' ? 1 : 0}
          shopName="Saysay Catering"
          side="couple"
        />
      </section>
    );
  // ⏱ Badge upgrades (owner, 6 Nov): &tier=free shows the booth swapped for Papic Challenges; &fail=1 the unread state;
  // &empty=1 none yet; s=upgrades-admin the Admin › Gifts table.
  else if (s === 'upgrades')
    body = <BadgeUpgradesSection data={{ rows: sp.fail === '1' ? null : sp.empty === '1' ? [] : labUpgrades(sp.tier ?? 'pro'), nowMs: LAB_NOW }} />;
  else if (s === 'upgrades-admin')
    body = (
      <BadgeUpgradesLedger
        rows={labUpgrades('pro').map((r, i) => ({ ...r, vendorProfileId: `v${i}`, shopName: i % 2 ? 'Lente Studio' : 'Saysay Catering' }))}
        readError={null}
      />
    );
  else if (s === 'gifts-admin')
    body =
      sp.fail === '1' ? (
        <ShopGiftsLedger ledger={null} ledgerError={{ message: 'lab: refused' }} holds={null} holdsError={{ message: 'lab: refused' }} giftLimitPct={GIFT_LIMIT_PCT_DEFAULT} />
      ) : (
        <ShopGiftsLedger ledger={LAB_GIFT_LEDGER} ledgerError={null} holds={LAB_GIFT_HOLDS} holdsError={null} giftLimitPct={GIFT_LIMIT_PCT_DEFAULT} />
      );

  return <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">{body}</main>;
}

/** Lab clock for the upgrades view — fixed, so "on until" reads the same on every run. */
const LAB_NOW = Date.parse('2026-11-06T04:00:00Z');

/** Lab badge upgrades — fixture only: three ready (one a choice), one started and running. */
function labUpgrades(tier: string): BadgeUpgradeRow[] {
  const row = (key: string, choices: BadgeUpgradeChoice[], grantedAt: string, started?: { c: BadgeUpgradeChoice; at: string; ends: string }): BadgeUpgradeRow => ({
    upgradeId: `lab-${key}`,
    key,
    grantedAt,
    startable: started ? [] : startableChoices(choices, tier),
    startedChoice: started?.c ?? null,
    startedAt: started?.at ?? null,
    endsAt: started?.ends ?? null,
  });
  return [
    row('upgrade:award:top_pick:2026-11-01', ['photo_challenge', '3d_booth', 'ai_chatbot'], '2026-11-03T02:00:00Z'),
    row('upgrade:first_booking', ['3d_booth'], '2026-10-21T02:00:00Z'),
    row('upgrade:verified', ['photo_challenge'], '2026-10-02T02:00:00Z'),
    row('upgrade:reviews:5', ['ai_chatbot'], '2026-10-15T02:00:00Z', { c: 'ai_chatbot', at: '2026-10-20T02:00:00Z', ends: '2026-11-17T02:00:00Z' }),
  ];
}

/** Lab-only stand-in packs — the page reads `platform_retail_catalog_v2`; these never reach a supplier. */
const LAB_GIFT_PACKS = shopGiftPacksFrom([
  { code: 'PAPIC_GUEST_150', title: 'Papic 150', credits: 150, pricePhp: 99, giftPricePhp: 90 },
  { code: 'PAPIC_GUEST_1K', title: 'Papic 1000', credits: 1000, pricePhp: 499, giftPricePhp: 449 },
  // 💎 Slice 2 — the price sheet's figures (20271308555594), copied for the lab only.
  { code: 'EVENT_PLUS', title: 'Event Plus', credits: 1, pricePhp: 2990, giftPricePhp: 2690 },
  { code: 'COUPLE_WEBSITE_PRO', title: 'Event Pro', credits: 1, pricePhp: 5690, giftPricePhp: 5190 },
]);

/** A lab badge reward row (`GrantedReward`) — fixture only. */
function labReward(
  key: string,
  kind: GrantedReward['kind'],
  units: number,
  grantedAt: string,
  extra: Partial<GrantedReward> = {},
): GrantedReward {
  return { rewardId: `lab-${key}`, key, badge: key.split(':')[0]!, kind, units, grantedAt, revokedAt: null, usedAt: null, usedOn: null, ...extra };
}

/** `inApp` — `&app=1`: the section as the iPhone app (store shell) draws it — the stock and Bought show, Buy does not
 * (`canBuy` is false there; `shop-gifts-data.ts`). */
function giftsFixture(unverified: boolean, fail: boolean, inApp = false) {
  return (
    <ShopGiftsSection
      data={{
        stock: fail
          ? null
          : {
              papic: { balance: 2150, held: 1150 },
              event_plus: { balance: 3, held: 1 },
              event_pro: { balance: 1, held: 0 },
            },
        packs: LAB_GIFT_PACKS,
        paysGiftPrice: !unverified,
        bought: fail
          ? null
          : [
              { orderId: 'o4', title: 'Event Plus', quantity: 3, paidPhp: 8070, createdAt: '2026-11-05T05:00:00Z', state: 'checking' },
              { orderId: 'o3', title: 'Papic 150', quantity: 1, paidPhp: 90, createdAt: '2026-11-04T05:00:00Z', state: 'checking' },
              { orderId: 'o2', title: 'Papic 1000', quantity: 2, paidPhp: 898, createdAt: '2026-11-02T05:00:00Z', state: 'in_stock' },
              { orderId: 'o1', title: 'Papic 150', quantity: 1, paidPhp: 90, createdAt: '2026-10-30T05:00:00Z', state: 'in_stock' },
            ],
        openRails: [
          { id: 'gcash', label: 'GCash' },
          { id: 'bank', label: 'Bank transfer' },
        ],
        canBuy: !inApp,
        // 🏅 Badge rewards (2026-11-05): some of the stock is badge reward, a free booking fee used and one waiting.
        rewards: {
          left: fail ? null : { papic: 300, event_plus: 1, event_pro: 0 },
          granted: fail
            ? null
            : [
                labReward('events:5000', 'fee_waiver', 1, '2026-11-05T02:00:00Z'),
                labReward('events:1000', 'fee_waiver', 1, '2026-10-12T02:00:00Z', {
                  usedAt: '2026-10-20T02:00:00Z',
                  usedOn: { coupleName: 'Maria & Juan', wouldHaveBeenPhp: 2500 },
                }),
                labReward('events:50', 'event_plus', 1, '2026-10-02T02:00:00Z'),
                labReward('events:10', 'event_plus', 1, '2026-09-14T02:00:00Z'),
              ],
          names: { papic: 'Papic 150', event_plus: 'Event Plus', event_pro: 'Event Pro' },
        },
      }}
    />
  );
}

const LAB_GIFT_LEDGER = [
  { entryId: 'e6', vendorProfileId: 'v1', shopName: 'Saysay Catering', kind: 'given' as const, giftKind: 'event_plus' as const, unlocksSku: 'COUPLE_WEBSITE_PRO', delta: -1, eventId: 'ev1', eventName: 'Ana & Miguel', orderReference: null, landed: true, createdAt: '2026-11-05T07:00:00Z' },
  { entryId: 'e5', vendorProfileId: 'v1', shopName: 'Saysay Catering', kind: 'bought' as const, giftKind: 'event_plus' as const, unlocksSku: null, delta: 3, eventId: null, eventName: null, orderReference: 'SN-9VQD', landed: false, createdAt: '2026-11-05T05:00:00Z' },
  { entryId: 'e4', vendorProfileId: 'v1', shopName: 'Saysay Catering', kind: 'given' as const, giftKind: 'papic' as const, unlocksSku: null, delta: -1150, eventId: 'ev1', eventName: 'Ana & Miguel', orderReference: null, landed: true, createdAt: '2026-11-04T06:00:00Z' },
  { entryId: 'e3', vendorProfileId: 'v1', shopName: 'Saysay Catering', kind: 'bought' as const, giftKind: 'papic' as const, unlocksSku: null, delta: 2000, eventId: null, eventName: null, orderReference: 'SN-8Q2K', landed: false, createdAt: '2026-11-02T05:00:00Z' },
  { entryId: 'e2', vendorProfileId: 'v2', shopName: 'Lente Studio', kind: 'reversal' as const, giftKind: 'papic' as const, unlocksSku: null, delta: -150, eventId: null, eventName: null, orderReference: 'SN-7XRT', landed: false, createdAt: '2026-11-01T05:00:00Z' },
  { entryId: 'e1', vendorProfileId: 'v1', shopName: 'Saysay Catering', kind: 'bought' as const, giftKind: 'papic' as const, unlocksSku: null, delta: 150, eventId: null, eventName: null, orderReference: 'SN-6PLM', landed: false, createdAt: '2026-10-30T05:00:00Z' },
];
const LAB_GIFT_HOLDS = [
  { proposalId: 'p1', shopName: 'Saysay Catering', eventName: 'Bea & Carlo', status: 'sent', credits: 1000, plus: 1, pro: 0 },
  { proposalId: 'p2', shopName: 'Saysay Catering', eventName: 'Rina’s 18th', status: 'accepted', credits: 150, plus: 0, pro: 0 },
];
