/**
 * /dev/supplier-plan-lab — simpler supplier dashboard STEP 6 on fixture data: Plan · Helpers · Settings ·
 * Notifications · Help · How is my business doing. No sign-in, no database. DEV-ONLY: production builds 404
 * this route (the same kill-switch as `/dev/supplier-lab`). It mounts the REAL screens — `PlanRows` + `PlanPicker`,
 * `HelpersView`, `SettingsView`, `NotificationsView`, `BusinessDoing` and the Help rows — so what it shows
 * is what ships. Every write is the SHIPPED action; with no session each one refuses, nothing is written.
 *
 *   ?s=plan            the Plan (who=parish · caterer · studio)       &unverified=1 · &fail=1 (receipts + fee unread)
 *   ?s=helpers         Helpers (who=parish: owner + a free Helper · studio: admins, team members, an open vote)
 *   ?s=settings        Settings (&staff=1 — a scoped team member)
 *   ?s=notifs          Notifications › Recent (incl. "Someone else was booked")      &empty=1
 *   ?s=help            Help
 *   ?s=business        How is my business doing (who=…)               &new=1 — nobody has found you yet
 *   (?s=more is gone with More itself — 2026-10-21, the bar is Today · Customers · Shop · Hub; /more redirects to Settings)
 */
import { notFound } from 'next/navigation';
import { PlanRows } from '@/app/vendor-dashboard/subscription/_components/plan-rows';
import { PlanPicker, type PlanPick } from '@/app/vendor-dashboard/subscription/_components/plan-picker';
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
import { BusinessDoing, type DoingWindow } from '@/app/vendor-dashboard/performance/_components/business-doing';
import { DatesRow } from '@/app/vendor-dashboard/customers/_components/dates-row';
import { BOOKING_FEE } from '@/lib/booking-fee';
import { bookingFeeRow, planGivesLines, planPickLine } from '@/lib/vendor-plan-rows';
import { seatLine, teamSeats } from '@/lib/vendor-free-helper';
import { barHeights, businessSentence, fromLine, ratingLine, replyLine } from '@/lib/business-doing';
import type { VendorTeamMemberWithUser } from '@/lib/vendor-team';
import type { NotificationRow } from '@/lib/notifications';

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

function planFixture(who: Who, unverified: boolean, fail: boolean) {
  const shop = SHOPS[who];
  const plans: PlanPick[] = [
    { key: 'free', name: 'Free', price: {}, tooShort: {}, pickLine: planPickLine(shop.tier, 'free', shop.expires) },
    ...(['solo', 'pro', 'enterprise'] as const).map((t) => ({
      key: t,
      name: t === 'solo' ? 'Solo' : t === 'pro' ? 'Pro' : 'Ultra',
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
      picker={<PlanPicker plans={plans} current={shop.tier} cycle={shop.cycle} verified={!unverified} action={startSubscriptionPurchase} />}
      feeRow={bookingFeeRow(standing, who === 'studio' ? 1 : 0)}
      gives={planGivesLines(shop.tier, false)}
      receipts={
        fail
          ? null
          : shop.tier === 'free'
            ? []
            : [
                { key: 'r1', title: `${shop.tier === 'pro' ? 'Pro' : 'Solo'} plan`, line: 'Thu 1 Oct 2026 · lab price', receiptId: 'lab-receipt' },
                { key: 'r2', title: `${shop.tier === 'pro' ? 'Pro' : 'Solo'} plan`, line: 'Tue 1 Sep 2026 · lab price', receiptId: null },
              ]
      }
      papicPackPrice={500}
      featured={shop.tier === 'pro'}
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
      rating={ratingLine(fresh ? { review_count: 0, review_avg_bayesian: null } : { review_count: 31, review_avg_bayesian: 4.8 })}
      more={[
        { key: 'over-time', title: 'Over time', line: 'Bookings and money by day, month and year', href: '#over-time', pro: false },
        { key: 'market', title: 'Demand and prices near you', line: 'Busy months ahead · how your prices sit', href: '#market', pro: false },
      ]}
    />
  );
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
  if (s === 'plan') body = planFixture(who, sp.unverified === '1', sp.fail === '1');
  else if (s === 'helpers') return helpersFixture(who);
  else if (s === 'settings')
    body = (
      <SettingsView
        unread={3}
        manager={sp.staff !== '1'}
        storeShell={false}
        tier={SHOPS[who].tier}
        payout={who === 'parish' ? 'none' : 'ready'}
        helpers={who === 'parish' ? 1 : who === 'studio' ? 3 : 0}
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
  else if (s === 'business')
    body = (
      <>
        <h1 className="sn-h1">How is my business doing</h1>
        <div className="mt-2">{businessFixture(who, sp.new === '1')}</div>
      </>
    );

  return <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">{body}</main>;
}
