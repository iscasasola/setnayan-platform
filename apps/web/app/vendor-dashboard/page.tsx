import Link from 'next/link';
import { DATE_ANSWER_NOTICE } from '@/lib/date-change';
import { createAdminClient } from '@/lib/supabase/admin';
import { readSupplierPayoutReadiness } from '@/lib/vendor-payment-methods.server';
import type { PayoutReadiness } from '@/lib/deposit-pay-step';
import { PAYMENT_OPTIONS_HREF } from './_components/payout-method-nudge';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { businessProfileChecklist, fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { todayCreditNotice } from '@/lib/vendor-credit-warning';
import {
  readEventDayFacts,
  readTodaySchedules,
  readTodayShopRow,
  readTodayViews,
  type EventDayFacts,
  type TodaySchedules,
  type TodayShopRow,
} from '@/lib/supplier-today.server';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import {
  fetchVendorOverviewData,
  fetchVendorEarningsSummary,
  cardTimestamp,
  type VendorEarningsSummary,
} from '@/lib/vendor-overview';
import { ServerTimer } from '@/lib/server-timing';
import { acceptInquiry, declineInquiry } from '@/lib/chat-actions';
import {
  vendorAcknowledgeDeposit,
  vendorMarkServiceComplete,
  vendorRejectDeposit,
  vendorAgreeToLock,
  vendorDeclineLock,
  vendorAgreeToDeletion,
  vendorDeclineDeletion,
  vendorAnswerDateChange,
} from './clients/[eventId]/actions';
// The desk TAKES these two answers rather than linking away to them. Both are
// the shipped actions, unchanged in what they enforce: the reply action still
// posts one final public reply through the vendor's own session, and
// `respondAppointment` still refuses an answer from the side that proposed.
import { postVendorReply } from './reviews/actions';
import { respondAppointment } from '@/app/_components/appointments-actions';
import {
  splitDesk,
  oldestAskWaitDays,
  deskStatusLine,
} from '@/lib/vendor-desk-disposition';
import { fetchVendorFirstStepsState } from '@/lib/vendor-first-steps.server';
import type { FirstStepsRail } from '@/lib/vendor-first-steps';
import { AWARD_LABELS, fetchVendorCurrentAwards } from '@/lib/spotlight-awards';
import { businessMilestone } from '@/lib/vendor-milestone';
import { manilaToday } from '@/lib/std-views';

import { PageMasthead } from '@/app/_components/page-masthead';
import {
  lockAgreeFeeHeld,
  lockAgreeNotice,
  lockDeclineNotice,
  type LockAnswerNotice,
} from '@/lib/lock-answer-notice';
import {
  shopFindability,
  findabilityNotice,
} from '@/lib/vendor-shop-findable';
import {
  fetchDueFeeBills,
  forecastsForBookings,
  FEE_BILLS_UNREADABLE,
} from '@/lib/booking-fee-disclosure.server';
import {
  billsForSurface,
  type DueFeeBill,
  type FeeDisclosure,
} from '@/lib/booking-fee-disclosure';
import { SupplierTodayScreen } from './_components/supplier-today-screen';
import { SupplierToast } from './_components/supplier-toast';
import { assembleSupplierToday } from '@/lib/supplier-today-view';
import { displayServiceLabel } from '@/lib/vendors';
import { MiniTour } from '@/app/_components/mini-tour';
import { resolveFeeEnforcement } from '@/lib/vendor-event-fee-access.server';

/**
 * /vendor-dashboard — the vendor Overview (finalized 6-menu-shell prototype).
 *
 * REBUILT 2026-07-01 to the finalized prototype (editorial `--m-*` palette).
 * ⚠ LABELLED "Today" SINCE 2026-08-26 (owner: "yes i agree"). The word was
 * always wrong for what this page does — the docblock below said so from the
 * first day — and the admin console took the same rename the same week. The
 * key stays `overview`; four systems read it and three fail silently.
 *
 * The Overview is a DECISION SURFACE — "what needs you today" — not a stat
 * board. Three live streams, all wired to real sources (never the mockup's
 * sample numbers), assembled in `fetchVendorOverviewData`:
 *
 *   1. "What's new"  — THE ANSWERS DESK: every answer this shop owes anybody,
 *      oldest waiting first, answered on the row wherever the answer works (new
 *      inquiries — answering couples is free · booking asks · unanswered
 *      reviews at any rating, with the reply box on the card · flagged delivery
 *      delays · replies owed in accepted conversations · meeting times the
 *      couple proposed · quotes and contracts never sent). Centrepiece.
 *   2. Amber note    — the "answering couples is free" explainer.
 *   3. "Ongoing"     — the vendor's open tasks with due chips.
 *   4. "Upcoming schedules" — the next 5 booked events by date.
 *
 * The previous stat-tile Overview (6 tiles + customer-mix + shortlist radar +
 * journal features) is superseded by this decision-first layout; those deeper
 * surfaces stay reachable from the 6-menu sidebar + /more.
 *
 * Role-aware: agent/viewer team members (who own no profile + have no scoped
 * data yet) see a team-member landing instead. Owner/admin get the full
 * Overview.
 */

export const metadata = { title: 'Today' };

function AgentHome() {
  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMasthead
        titleNode={
          <>
            You&apos;re on the team
          </>
        }
      />
      <div className="sn-tile p-5 text-sm text-ink/65">
        Need access to something now? Ask your supplier owner to assign you to the
        services you&apos;ll be managing.
      </div>
    </div>
  );
}

/**
 * "What needs you today — Wednesday, July 1."
 *
 * 🔴 `en-PH` IS A LANGUAGE, NOT A PLACE. Until 2026-09-10 this passed the
 * Philippine LOCALE and no time zone, so it formatted the SERVER's instant with
 * Filipino wording — and the server runs in UTC. Measured on the live site at
 * Manila 2026-09-10 02:33 (UTC 09-09 18:33): the page greeted the shop with
 * "Wednesday, September 9". **Every Filipino supplier who opens the app after
 * 8pm was shown yesterday**, and everything on this page that means "today"
 * moved with it — Next booking, Upcoming, Open tasks.
 *
 * ⚠ CI runs in UTC, the one clock on which this cannot be seen. Same family as
 * the 2026-08-04 wall-clock sweep (`venueNowMs`, `formatEventDate`); this page
 * was not in it.
 *
 * The zone is Setnayan's own market, matching `anniversary-dates.ts` and the
 * coordinator broadcasts — a supplier dashboard is read where the shop is.
 */
function todayLabel(): string {
  return new Date().toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * The desk takes two answers that redirect back to it — the deposit refusal and
 * (via its own path) the review reply. A REFUSAL IN SILENCE IS INDISTINGUISHABLE
 * FROM ONE THAT NEVER HAPPENED: the row simply vanishes, so without this the
 * supplier who just said "it never arrived" has no way to know it was recorded
 * and the couple told. Four outcomes, each said plainly.
 */
const DEPOSIT_ANSWER_NOTICE: Record<string, string> = {
  ok: 'We told them it never reached you. Their record of paying is cleared, so they can send it again with the right receipt.',
  already: 'That was already answered — nothing changed.',
  already_confirmed:
    'You had already confirmed this payment, so it can no longer be marked as never received. Open the customer if that needs sorting out.',
  not_recorded: 'There was nothing to answer — they have no payment recorded here.',
  error: 'That did not go through. Nothing changed — please try again.',
};

export default async function VendorOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{
    deposit_answer?: string;
    lock_agree?: string;
    /** `held` — the yes left an unpaid booking fee, so the couple's news waits on it (`vendorAgreeToLock`). */
    fee?: string;
    lock_decline?: string;
    competing?: string;
    date_answer?: string;
  }>;
}) {
  const search = (await searchParams) ?? {};
  const depositAnswer = search.deposit_answer
    ? DEPOSIT_ANSWER_NOTICE[search.deposit_answer] ?? DEPOSIT_ANSWER_NOTICE.error
    : null;

  // 🗓 Move · Unlock, said out loud (`vendorAnswerDateChange`).
  const dateAnswer = search.date_answer
    ? DATE_ANSWER_NOTICE[search.date_answer] ?? DATE_ANSWER_NOTICE.failed
    : null;

  // ── THE ANSWER TO A BOOKING ASK, SAID OUT LOUD ───────────────────────────
  // `vendorAgreeToLock` / `vendorDeclineLock` have always redirected here with
  // the RPC's own status in the query string, and until now NOTHING READ IT:
  // every one of the refusals `vendor_agree_to_lock` can return landed as a
  // page reload with the request card still sitting there. Success is
  // self-evident (the card disappears); every failure looked like a dead
  // button. The sentences live in `lib/lock-answer-notice.ts`, and a db test
  // fails if the RPC learns a status that has no sentence.
  const competing = Number.parseInt(search.competing ?? '', 10);
  const lockAnswer: LockAnswerNotice | null =
    lockAgreeNotice(search.lock_agree, {
      competing: Number.isFinite(competing) ? competing : null,
      feeHeld: lockAgreeFeeHeld(search.fee),
    }) ?? lockDeclineNotice(search.lock_decline);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Role + profile have no dependency on each other — resolve them together.
  // Both are React-cache()-wrapped and were already read by the vendor layout
  // in this same request, so these calls hit the per-request cache rather than
  // re-querying (2026-07-01 perf).
  const [vendorRole, profile] = await Promise.all([
    resolveVendorRole(supabase, user.id),
    fetchOwnVendorProfile(supabase, user.id),
  ]);
  if (vendorRole && !canManageVendor(vendorRole)) {
    return <AgentHome />;
  }

  // No profile yet (fresh team-member without an owned shop) — a light landing
  // that routes them to create one. No feed to compute.
  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <header className="mb-6 space-y-1.5">
          <h1 className="sn-h1">Today</h1>
          <p className="text-sm text-ink/60">
            What needs you today — {todayLabel()}.
          </p>
        </header>
        <div className="sn-tile p-6">
          <p className="sn-eye">Team access</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">You&rsquo;re on a supplier team.</h2>
          <p className="mt-2 text-sm text-ink/65">
            You don&rsquo;t own a supplier profile yet. Reach the team owner to be
            added to bookings + chats, or
            <Link
              href="/signup?as=vendor"
              className="ml-1 font-semibold underline"
              style={{ color: 'var(--sn-gold-700)' }}
            >
              create your own
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const timer = new ServerTimer('vendor-dashboard/overview');
  const todayIso = manilaToday();
  const vendorProfileId = profile.vendor_profile_id;
  let data;
  let spotlightAwards;
  let shopRow: TodayShopRow | null;
  let schedules: TodaySchedules;
  try {
    /*
      🧮 WAVE 1 — everything keyed on the shop alone, in parallel (2026-07-01 perf). The decision feed is the slow
      one; the rest ride beside it. Awards fail soft (→ []) so a failed read only hides that word.

      🧮 THE SIMPLER TODAY MUST NOT GROW (2026-10-14). `readTodayShopRow` is ONE `vendor_profiles` read where three
      single-column reads used to be (first steps' `verification_state` · the milestone's start date · the credit
      about to expire); `readTodaySchedules` is ONE read for the schedules' names, the bookings from outside and the
      days off ahead. The census is in `lib/supplier-today.server.ts`.
    */
    [data, spotlightAwards, shopRow, schedules] = await timer.track('overview-data', () => Promise.all([
      fetchVendorOverviewData(
        supabase,
        vendorProfileId,
        profile.services ?? [],
      ),
      fetchVendorCurrentAwards(supabase, vendorProfileId).catch(() => []),
      readTodayShopRow(supabase, vendorProfileId),
      readTodaySchedules(supabase, vendorProfileId, todayIso),
    ]));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[/vendor-dashboard overview] loader failed', err);
    return (
      <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-start gap-3">
          <AlertTriangle
            aria-hidden
            className="mt-0.5 h-6 w-6 shrink-0"
            strokeWidth={1.75}
            style={{ color: 'var(--m-blush-deep)' }}
          />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              This page is temporarily unavailable.
            </h1>
            <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
              Refreshing usually clears this. Your data is safe.
            </p>
          </div>
        </header>
      </div>
    );
  }

  const { whatsNew, upcoming, deskIncomplete } = data;

  /*
    ── THE DESK IS CUT IN TWO (2026-09-22) ─────────────────────────────────
    Owner's drawing, approved 2026-08-26: the one block "mixes five things
    waiting on you with a 5-star review that needs nothing." `splitDesk` asks
    the one pure rule in `lib/vendor-desk-disposition.ts`; it does NOT re-sort,
    because `fetchVendorOverviewData` has already ordered the whole feed
    oldest-waiting-first and a second sort here would be a second answer to a
    question that already has one.

    ⚠ `askStatus` may be an empty string, and that is the honest reading: with
    nothing waiting there is no oldest wait, so the heading carries no number
    rather than a "0 days" measured over an empty set.
  */
  const { answer: needsAnswer, news: nothingToAnswer } = splitDesk(whatsNew);
  const askStatus = deskStatusLine(
    needsAnswer.length,
    oldestAskWaitDays(needsAnswer, cardTimestamp, new Date()),
  );

  // S19 · can a couple see anywhere to pay this shop? Asked only when a booking ask is on screen or the shop holds
  // an upcoming booking (2026-09-19) — a booked couple owes a deposit. `unreadable` renders nothing.
  const hasLockAsk = needsAnswer.some((c) => c.kind === 'lock_request');
  const hasBooking = upcoming.length > 0;
  // 🌑 AN EVENT DAY — the first booking is today. Its card is "Run the day", and its numbers are the day's own.
  const eventToday = upcoming[0] && upcoming[0].inDays <= 0 ? upcoming[0] : null;

  /*
    🧮 WAVE 2 — everything that needs wave 1's answer, in ONE parallel round (it used to be five rounds, one after
    another: payout · fees · forecasts · start date · credit). Each fails soft.

      · first steps — only for a shop not yet approved (wave 1 read `verification_state`; a refused read leaves it
        to probe for itself, as before);
      · WHAT THIS SHOP OWES SETNAYAN (owner 2026-09-20, billed ₱837.50 as Saysay: "i never saw the payment screen
        to pay us") — ⚠ UNREADABLE renders NOTHING rather than "you owe nothing"; the lock sentence states the
        GATE's own answer (`resolveFeeEnforcement`, batch-5 walk F);
      · WHAT AGREEING WOULD COST — priced per booking ask, read BEFORE the Agree button, never on the bill;
      · money still to come in — NOT on an event day: the dark card shows the day's numbers instead, and the day's
        two reads take its place (the screen does not grow);
      · page views for "How is business" — only once couples can see the shop.
  */
  const [firstSteps, payoutReadiness, feeBillsRead, feeEnforced, feeForecasts, earnings, views, dayFacts]: [
    FirstStepsRail | null,
    PayoutReadiness,
    Awaited<ReturnType<typeof fetchDueFeeBills>>,
    boolean,
    Record<string, FeeDisclosure | null>,
    VendorEarningsSummary | null,
    number | null,
    EventDayFacts | null,
  ] = await Promise.all([
    shopRow?.verified
      ? Promise.resolve(null)
      : fetchVendorFirstStepsState(supabase, profile, {
          verified: shopRow ? shopRow.verified : undefined,
          blocks: schedules.complete ? { notAvailable: schedules.notAvailableAhead, outside: schedules.outside.length } : undefined,
        }).catch(() => null),
    hasLockAsk || hasBooking
      ? readSupplierPayoutReadiness({
          adminClient: createAdminClient(),
          vendorProfileId,
          vendorUserId: profile.user_id,
        }).catch((): PayoutReadiness => 'unreadable')
      : Promise.resolve<PayoutReadiness>('unreadable'),
    fetchDueFeeBills(supabase, user.id).catch(() => FEE_BILLS_UNREADABLE),
    resolveFeeEnforcement(),
    forecastsForBookings(createAdminClient(), {
      vendorProfileId,
      eventVendorIds: needsAnswer
        .filter((c): c is Extract<typeof c, { kind: 'lock_request' }> => c.kind === 'lock_request')
        .map((c) => c.eventVendorId),
    }).catch(() => ({})),
    eventToday ? Promise.resolve(null) : fetchVendorEarningsSummary(supabase, vendorProfileId).catch(() => null),
    shopRow?.verified ? readTodayViews(supabase, vendorProfileId, new Date(Date.now() - 28 * 86_400_000).toISOString()) : Promise.resolve(null),
    eventToday ? readEventDayFacts(createAdminClient(), eventToday.eventId, Date.now()).catch(() => null) : Promise.resolve(null),
  ]);
  const todayFeeBills: DueFeeBill[] =
    feeBillsRead === FEE_BILLS_UNREADABLE
      ? []
      : billsForSurface(feeBillsRead, 'today');

  // BUSINESS MILESTONE (owner 2026-07-13) — a monthsary while the shop is new
  // (its first year) and a yearly anniversary after. Prefers the precise
  // founding date (now off the one shop-row read), else the open-date + year.
  //
  // ⚠ RETIRED 2026-08-05 (owner, looking at the live shop overview: "on vendor
  // why is there plan a celebration? there shouldn't be") — the pill shipped
  // 07-13 alongside a "Plan a celebration →" link into `/dashboard/create-event`.
  // That is the COUPLE doorway; a vendor's shop overview must not hand them a
  // plan-your-own-event flow. The badge stays (it was the ask); do NOT re-add
  // the CTA.
  const milestone = businessMilestone(
    profile.created_at,
    todayIso,
    profile.in_business_since_year,
    shopRow?.businessStartDate ?? null,
  );

  timer.flush();

  // WHY COUPLES CAN'T FIND YOU — decided once, in `lib/vendor-shop-findable.ts`,
  // from the `public_visibility` already on this row (no extra query) and from
  // whether the first-steps rail is on screen (so the two can never argue).
  // `notice` is null for a live shop and for a shop still working through
  // approval, where the rail says it better.
  const findability = shopFindability({
    publicVisibility: (profile as { public_visibility?: unknown }).public_visibility,
    railShowing: firstSteps != null,
  });
  const findabilityBanner = findabilityNotice(findability);

  /*
    ⏳ CREDIT ABOUT TO EXPIRE (owner 2026-10-02, tracker d5: "warn a supplier
    7 days before a balance expires — one notice on their Today page + email").
    The email + tray half already ships (`maybeSweepVendorCreditWarnings`, once
    per term). This is the Today half: the same rule (`todayCreditNotice`), shown
    while the window is open, in the prototype's words ("Credits expiring · ₱X ·
    Sat 31 Oct"). The two columns ride the one shop-row read; a failed read shows
    nothing here — the email and the tray still went out — and is logged, never
    read as "no credit".
  */
  const creditNotice = shopRow
    ? todayCreditNotice({ creditPhp: shopRow.creditPhp, tierExpiresAt: shopRow.tierExpiresAt }, Date.now())
    : null;

  /*
    ── 📱 TODAY, THE SIMPLER WAY (owner APPROVE 2026-10-14 — corpus DECISION_LOG ✅ "THE SIMPLER SUPPLIER
    DASHBOARD"; prototype `prototypes/supplier_easy_dashboard_2026-10-14_fable.html`, SCREENS.today) ──────────────
    ONE Next card (the couple's initials; a booking ask answered ON it) → its status line → three numbers →
    (event day: Also today) → Coming up (with the bookings from outside) → Also waiting (every row with its icon;
    the closed lines too) → the Shop row → How is business. Built on S-PR1 (2026-10-08); nothing it showed is gone:
      · the desk ("Needs your answer")   → Also waiting, one row per ask, the answer opening in place (the same
        forms, the same actions); a quote or contract never sent and an open dispute are door rows
      · "Nothing to answer"              → the same list, no second heading (a lapsed window and a flagged delay
        are still shown nowhere else)
      · the findability banner           → `pickSupplierNext` rule `findable`
      · the first-steps rail             → rule `setup` (its current step, "N of 6")
      · the booking-fee bills            → rule `fee` when it wins; and KEPT below, every unpaid bill with its own
        Pay, the lock said once under them (`the-fee-finds-the-supplier.test.ts`)
      · the credit-expiring banner       → a door row ("Credits expiring")
      · the payout nudge                 → a door row with Set up ("Where couples pay you")
      · the Spotlight Award + milestone  → on the Shop row's line
  */
  const firstCategory = (profile.services ?? [])[0] as string | undefined;
  const milestoneWord = milestone
    ? `your ${milestone.label}${
        milestone.daysUntil > 92
          ? ''
          : milestone.daysUntil <= 0
            ? ' today'
            : milestone.daysUntil === 1
              ? ' tomorrow'
              : ` in ${milestone.daysUntil} days`
      }`
    : null;
  // 🧩 ONE ASSEMBLY (`lib/supplier-today-view.ts`) — the page hands it the reads, the dev lab hands it fixtures,
  // and both draw the same Today. `verified` comes off the one shop-row read; when that read was refused, the
  // rail's own answer stands (no rail = approved), as it always did.
  const view = assembleSupplierToday({
    needsAnswer,
    closed: nothingToAnswer,
    deskIncomplete,
    upcoming,
    schedules,
    firstSteps,
    verified: shopRow ? shopRow.verified : firstSteps == null,
    findable: findability.findable,
    findability: findabilityBanner
      ? { title: findabilityBanner.title, body: findabilityBanner.body, cta: findabilityBanner.cta ?? null }
      : null,
    feeBills: todayFeeBills,
    feeEnforced,
    earnings,
    credit: creditNotice && shopRow ? { creditPhp: shopRow.creditPhp, tierExpiresAt: shopRow.tierExpiresAt, href: creditNotice.href } : null,
    payoutReadiness,
    payoutHref: PAYMENT_OPTIONS_HREF,
    shop: {
      name: profile.business_name,
      // The shared resolver, never an inline humaniser (`one-word-per-category.test.ts`).
      categoryWord: firstCategory ? displayServiceLabel(firstCategory) : null,
      details: businessProfileChecklist(profile),
      awardWord: [...new Set(spotlightAwards)].map((a) => AWARD_LABELS[a]).join(' · ') || null,
      milestoneWord,
    },
    views,
    inquiries28: data.inquiries28 ?? null,
    askDayHolds: data.askDayHolds,
    dayFacts,
    todayIso,
    now: Date.now(),
    since: cardTimestamp,
  });

  // The outcome of an answer given ON this page — the shared top toast (its
  // first sentence) and the whole sentence as the status line, now drawn UNDER
  // the Next card with the door it asks for (fee held → "Pay the booking fee").
  //   ok   = it happened · note = nothing changed · bad = refused or failed.
  // "Try again" only where pressing again can work: the one generic failure
  // ("That did not go through. Nothing changed — please try again."), which all
  // three answers share. A closed request or a full date is not retried.
  const genericFailure = new Set(
    [lockAgreeNotice('error')?.text, DATE_ANSWER_NOTICE.failed, DEPOSIT_ANSWER_NOTICE.error].filter(Boolean),
  );
  const outcome: { text: string; tone: 'ok' | 'note' | 'bad'; door?: { label: string; href: string } | null } | null = lockAnswer
    ? {
        text: lockAnswer.text,
        tone: lockAnswer.tone === 'ok' ? 'ok' : lockAnswer.tone === 'noop' ? 'note' : 'bad',
        door: lockAnswer.door ?? null,
      }
    : dateAnswer
      ? {
          text: dateAnswer,
          tone:
            search.date_answer === 'moved' || search.date_answer === 'unlocked'
              ? 'ok'
              : search.date_answer === 'already' || search.date_answer === 'not_yours'
                ? 'note'
                : 'bad',
        }
      : depositAnswer
        ? {
            text: depositAnswer,
            tone:
              search.deposit_answer === 'ok'
                ? 'ok'
                : depositAnswer === DEPOSIT_ANSWER_NOTICE.error
                  ? 'bad'
                  : 'note',
          }
        : null;


  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-4 sm:px-6 sm:py-10 lg:px-8">
      {/* The toast that says how an answer went (a booking ask · a date change · a payment that never arrived).
          A refusal is the whole point: without it the supplier presses Agree, is refused, and sees the same page
          with no explanation. Its lasting status line is drawn by the screen, under the Next card. */}
      {outcome ? <SupplierToast text={outcome.text} tone={outcome.tone} retry={genericFailure.has(outcome.text)} line={false} /> : null}

      <SupplierTodayScreen
        view={view}
        outcome={outcome}
        feeForecasts={feeForecasts}
        cards={[...needsAnswer, ...nothingToAnswer]}
        askStatus={askStatus}
        deskIncomplete={deskIncomplete}
        actions={{
          acceptInquiry,
          declineInquiry,
          confirmLock: vendorAcknowledgeDeposit,
          rejectLock: vendorRejectDeposit,
          agreeLock: vendorAgreeToLock,
          declineLock: vendorDeclineLock,
          agreeDeletion: vendorAgreeToDeletion,
          declineDeletion: vendorDeclineDeletion,
          answerDateChange: vendorAnswerDateChange,
          postReviewReply: postVendorReply,
          respondMeeting: respondAppointment,
          markServiceComplete: vendorMarkServiceComplete,
        }}
      />

      {/* First visit only — the shipped MiniTour (owner rule: every feature
          gets a first-visit tour). Waits for the welcome tour so two never
          stack on one first visit. */}
      <MiniTour tourKey="vendor_today_v1" after="vendor_welcome_v1" />
    </div>
  );
}
