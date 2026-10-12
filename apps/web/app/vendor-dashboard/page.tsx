import Link from 'next/link';
import { DATE_ANSWER_NOTICE } from '@/lib/date-change';
import { createAdminClient } from '@/lib/supabase/admin';
import { readSupplierPayoutReadiness } from '@/lib/vendor-payment-methods.server';
import type { PayoutReadiness } from '@/lib/deposit-pay-step';
import { PAYMENT_OPTIONS_HREF, payoutNudgeCopy } from './_components/payout-method-nudge';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { todayCreditNotice } from '@/lib/vendor-credit-warning';
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
import { WhatsNewFeed, NothingToAnswerFeed } from './_components/overview-sections';
import {
  splitDesk,
  oldestAskWaitDays,
  deskStatusLine,
} from '@/lib/vendor-desk-disposition';
import { fetchVendorFirstStepsState } from '@/lib/vendor-first-steps.server';
import type { FirstStepsRail } from '@/lib/vendor-first-steps';
import { AWARD_LABELS, fetchVendorCurrentAwards } from '@/lib/spotlight-awards';
import { businessMilestone } from '@/lib/vendor-milestone';
import { fetchVendorBusinessStartDate } from '@/lib/vendor-profile';
import { manilaToday } from '@/lib/std-views';

import { PageMasthead } from '@/app/_components/page-masthead';
import {
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
  feeDueCopy,
  type DueFeeBill,
  type FeeDisclosure,
} from '@/lib/booking-fee-disclosure';
import { BookingFeeBills } from '@/app/_components/booking-fee-notice';
import { SupplierTodayFirstScreen } from './_components/supplier-today-first-screen';
import { SupplierToast } from './_components/supplier-toast';
import {
  pickSupplierNext,
  nextAnswerOf,
  nextLook,
  nextMeta,
  nextSecond,
  supplierWaiting,
  waitingOnYou,
  eventsThisWeek,
  owedToYouPhp,
} from '@/lib/supplier-today';
import { formatPesoCompact } from '@/lib/vendors-plan-budget';
import { displayServiceLabel } from '@/lib/vendors';
import { MiniTour } from '@/app/_components/mini-tour';

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
  let data;
  let spotlightAwards;
  let earnings: VendorEarningsSummary | null;
  let firstSteps: FirstStepsRail | null;
  try {
    // The decision feed, Spotlight Award banner, and earnings summary all key
    // off the same vendor_profile_id and have no dependency on each other —
    // fetch them in parallel (2026-07-01 perf). Awards + earnings fail soft
    // (→ [] / null) so a failed read only hides that widget instead of tripping
    // the overview-unavailable page.
    [data, spotlightAwards, earnings, firstSteps] = await timer.track('overview-data', () => Promise.all([
      fetchVendorOverviewData(
        supabase,
        profile.vendor_profile_id,
        profile.services ?? [],
      ),
      fetchVendorCurrentAwards(supabase, profile.vendor_profile_id).catch(() => []),
      fetchVendorEarningsSummary(supabase, profile.vendor_profile_id).catch(() => null),
      // The order-of-operations rail. Null on a verified shop (it short-circuits
      // after one cheap read) and null on any failure — a nudge must never be
      // what takes the vendor's home page down.
      fetchVendorFirstStepsState(supabase, profile).catch(() => null),
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

  // S19 · can a couple see anywhere to pay this shop? Asked ONLY when a booking
  // ask is on screen — that card is where the nudge sits, because agreeing is
  // what makes the deposit the couple's next step. `unreadable` renders nothing.
  // 2026-09-19 · and whenever the shop holds ANY upcoming booking: a booked
  // couple owes a deposit, and Today is the one screen every supplier opens.
  const hasLockAsk = needsAnswer.some((c) => c.kind === 'lock_request');
  const hasBooking = upcoming.length > 0;
  const payoutReadiness: PayoutReadiness = hasLockAsk || hasBooking
    ? await readSupplierPayoutReadiness({
        adminClient: createAdminClient(),
        vendorProfileId: profile.vendor_profile_id,
        vendorUserId: profile.user_id,
      }).catch((): PayoutReadiness => 'unreadable')
    : 'unreadable';

  // WHAT THIS SHOP OWES SETNAYAN — on the one screen every supplier opens.
  //
  // 🔴 Owner, 2026-09-20, having just been billed ₱837.50 as the supplier
  // Saysay: "i never saw the payment screen to pay us." The bill existed and
  // rendered correctly on /vendor-dashboard/booking-fees; the only link to that
  // page anywhere was one tile on /vendor-dashboard/subscription. This is the
  // first of the three surfaces in BOOKING_FEE_BILL_SURFACES.
  //
  // ⚠ UNREADABLE renders NOTHING rather than "you owe nothing" — an empty list
  // and a refused read must not look the same on a money surface.
  const feeBillsRead = await fetchDueFeeBills(supabase, user.id).catch(
    () => FEE_BILLS_UNREADABLE,
  );
  const todayFeeBills: DueFeeBill[] =
    feeBillsRead === FEE_BILLS_UNREADABLE
      ? []
      : billsForSurface(feeBillsRead, 'today');

  // WHAT AGREEING WOULD COST — priced per booking ask on the desk, so the
  // supplier reads the fee BEFORE the Agree button rather than on the bill.
  // Empty object when no ask is on screen: nothing is read and nothing renders.
  const feeForecasts: Record<string, FeeDisclosure | null> = await forecastsForBookings(
    createAdminClient(),
    {
      vendorProfileId: profile.vendor_profile_id,
      eventVendorIds: needsAnswer
        .filter((c): c is Extract<typeof c, { kind: 'lock_request' }> => c.kind === 'lock_request')
        .map((c) => c.eventVendorId),
    },
  ).catch(() => ({}));

  // BUSINESS MILESTONE (owner 2026-07-13) — a monthsary while the shop is new
  // (its first year) and a yearly anniversary after. Prefers the precise
  // founding date (guarded read, so a not-yet-applied migration degrades to the
  // open-date + year fallback).
  //
  // ⚠ RETIRED 2026-08-05 (owner, looking at the live shop overview: "on vendor
  // why is there plan a celebration? there shouldn't be") — the pill shipped
  // 07-13 alongside a "Plan a celebration →" link into `/dashboard/create-event`.
  // That is the COUPLE doorway; a vendor's shop overview must not hand them a
  // plan-your-own-event flow. The badge stays (it was the ask); do NOT re-add
  // the CTA.
  const businessStartDate = await fetchVendorBusinessStartDate(
    supabase,
    profile.vendor_profile_id,
  );
  const milestone = businessMilestone(
    profile.created_at,
    manilaToday(),
    profile.in_business_since_year,
    businessStartDate,
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
    per term). This is the Today half: the same rule and the same words
    (`todayCreditNotice`), shown while the window is open.
    ⚠ ITS OWN QUERY: the shared profile select does not carry these two columns,
    and naming one PostgREST does not know refuses the whole select. A failed
    read shows nothing here — the email and the tray still went out — and is
    logged, never read as "no credit".
  */
  const { data: creditRow, error: creditErr } = await supabase
    .from('vendor_profiles')
    .select('subscription_credit_php, tier_expires_at')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  if (creditErr) console.error('[supabase-error] /vendor-dashboard credit notice read', creditErr);
  const creditNotice = creditRow
    ? todayCreditNotice(
        {
          creditPhp: Number((creditRow as { subscription_credit_php?: number | string | null }).subscription_credit_php ?? 0),
          tierExpiresAt: (creditRow as { tier_expires_at?: string | null }).tier_expires_at ?? null,
        },
        Date.now(),
      )
    : null;

  /*
    ── 📱 TODAY, AS ROWS (supplier dashboard redesign S-PR1, 2026-10-08 — corpus
    `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 2 "Today" + § 3;
    prototype `supplier_dashboard_2026-10-08_fable.html` frames 01 · 02 · 15 ·
    31) ─────────────────────────────────────────────────────────────────────
    ONE Next card ("1 of 3") → three numbers → Coming up (3) → Also waiting
    (the rest of the queue) → one Shop row. The first screen approved on
    2026-10-01 is kept; "Everything else" under it is gone.

    WHERE EACH THING THAT WAS BELOW THE FOLD WENT — nothing is dropped unsaid:
      · the desk ("Needs your answer")   → Also waiting: one row per ask, the
        answer opening in place (the same forms, the same actions)
      · the findability banner           → `pickSupplierNext` rule `findable`
      · the first-steps rail             → rule `setup` (its current step)
        (each is the Next card when it wins, and a row under Also waiting when
        a busier rule wins — `supplierWaiting().doors`)
      · the booking-fee bills            → rule `fee` when it wins; and KEPT
        below, every unpaid bill with its own Pay — the rule knows one bill and
        a shop can owe several (`the-fee-finds-the-supplier.test.ts`)
      · the credit-expiring banner       → NO rule in `pickSupplierNext`, so its
        meaning is kept as a row (`doors`, id `credit`)
      · the payout nudge                 → NO rule either; kept as a row (`payout`)
      · the Spotlight Award banner       → its planned home (Shop › Page ›
        Reviews) is S-PR7; until then its label rides on the Shop row's line
      · the business-milestone pill      → on the Shop row's line
      · the two "Your money" tiles       → the "to come in" number here; the
        figures themselves are on Earnings and Payday (Customers › Money, S-PR4)
      · "Nothing to answer"              → kept, as quiet rows: a lapsed
        booking window and a flagged delay are shown nowhere else
      · the token note · Ongoing · Upcoming schedules → removed (the queue and
        Coming up already say them)
  */
  const owedPhp = owedToYouPhp(earnings);
  const firstCategory = (profile.services ?? [])[0] as string | undefined;
  // The shared resolver, never an inline humaniser (`one-word-per-category.test.ts`).
  const categoryWord = firstCategory ? displayServiceLabel(firstCategory) : null;
  const shopState = firstSteps ? 'Not live yet' : findability.findable ? 'Live' : 'Not listed';
  // 🗓 A date-change request (3-day deadline) is the Next card whenever one waits.
  const nextAnswer = nextAnswerOf(needsAnswer);
  const now = Date.now();
  const setupStep = firstSteps?.current
    ? {
        title: firstSteps.current.title,
        body: firstSteps.current.body,
        cta: firstSteps.current.cta,
        href: firstSteps.current.href,
      }
    : null;
  const findabilityRule = findabilityBanner
    ? { title: findabilityBanner.title, body: findabilityBanner.body, cta: findabilityBanner.cta ?? null }
    : null;
  const feeRule = todayFeeBills[0]
    ? { bill: todayFeeBills[0], copy: feeDueCopy(todayFeeBills[0], manilaToday()) }
    : null;
  const next = pickSupplierNext({
    answer: nextAnswer,
    answerSince: nextAnswer ? cardTimestamp(nextAnswer) : null,
    deskIncomplete,
    upcoming,
    setupStep,
    findability: findabilityRule,
    fee: feeRule,
    owedPhp,
    now,
  });
  // The door to "How clients pay you" while a booked couple cannot see anywhere
  // to pay. Not when a booking ask is on screen: that ask's own answer carries
  // the same nudge, and one screen says it once.
  const payoutCopy = hasBooking && !hasLockAsk ? payoutNudgeCopy(payoutReadiness, 'today') : null;
  const waiting = supplierWaiting({
    next,
    needsAnswer,
    since: cardTimestamp,
    setupStep,
    findability: findabilityRule,
    credit: creditNotice ? { title: creditNotice.title, body: creditNotice.body, href: creditNotice.href } : null,
    payout: payoutCopy ? { title: payoutCopy.cta, body: payoutCopy.body, href: PAYMENT_OPTIONS_HREF } : null,
    now,
  });
  const nextIsAnswer = next.kind === 'answer' ? nextAnswer : null;

  // The one Shop row's line — what the shop line at the top used to say, plus
  // the two things that used to be banners about the shop itself.
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
  const awardWord = [...new Set(spotlightAwards)].map((a) => AWARD_LABELS[a]).join(' · ') || null;
  const shopLine = [categoryWord, shopState, awardWord, milestoneWord].filter((p): p is string => Boolean(p)).join(' · ');

  // The outcome of an answer given ON this page — one sentence, as a toast.
  const outcome = lockAnswer
    ? { text: lockAnswer.text, refused: lockAnswer.tone === 'refused' }
    : dateAnswer
      ? { text: dateAnswer, refused: search.date_answer !== 'moved' && search.date_answer !== 'unlocked' }
      : depositAnswer
        ? { text: depositAnswer, refused: search.deposit_answer !== 'ok' }
        : null;

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-4 sm:px-6 sm:py-10 lg:px-8">
      {/* The outcome of an answer given ON this page (a booking ask · a date
          change · a payment that never arrived). A refusal is the whole point:
          without it the supplier presses Agree, is refused, and sees the same
          page with no explanation. Text only — nothing to press — so the Next
          card below is still the first thing you can tap. */}
      {outcome ? <SupplierToast text={outcome.text} refused={outcome.refused} /> : null}

      <SupplierTodayFirstScreen
        next={next}
        look={nextLook(next.kind, nextIsAnswer)}
        second={nextSecond(next, nextIsAnswer, upcoming)}
        counter={waiting.counter}
        meta={nextMeta(nextIsAnswer, nextIsAnswer ? cardTimestamp(nextIsAnswer) : null, now)}
        dateChange={
          nextIsAnswer?.kind === 'date_change' ? { card: nextIsAnswer, answer: vendorAnswerDateChange } : null
        }
        numbers={{
          waiting: waitingOnYou(needsAnswer.length, deskIncomplete),
          waitingNow: needsAnswer.length > 0,
          thisWeek: eventsThisWeek(upcoming),
          // ₱48K, not ₱48,000 — three numbers share one phone row. `null` when
          // payday was not read: the number then says "couldn't load", never ₱0.
          toComeIn: owedPhp === null ? null : formatPesoCompact(owedPhp * 100),
        }}
        // On an event day the card IS today's event; Coming up is what follows it.
        comingUp={(next.kind === 'run_day' ? upcoming.slice(1) : upcoming).slice(0, 3)}
        alsoWaitingHeaded={waiting.asks.length > 0 || deskIncomplete}
        doors={waiting.doors}
        shop={{ name: profile.business_name, line: shopLine, live: shopState === 'Live' }}
        alsoWaiting={
          <>
            {/* The asks, each opening its answer in place — the booking fee is
                still read BEFORE Agree, the receipt before Confirm. */}
            <WhatsNewFeed
              cards={needsAnswer}
              asks={waiting.asks}
              statusLine={askStatus}
              incomplete={deskIncomplete}
              acceptInquiry={acceptInquiry}
              declineInquiry={declineInquiry}
              confirmLock={vendorAcknowledgeDeposit}
              rejectLock={vendorRejectDeposit}
              agreeLock={vendorAgreeToLock}
              declineLock={vendorDeclineLock}
              agreeDeletion={vendorAgreeToDeletion}
              declineDeletion={vendorDeclineDeletion}
              answerDateChange={vendorAnswerDateChange}
              postReviewReply={postVendorReply}
              respondMeeting={respondAppointment}
              markServiceComplete={vendorMarkServiceComplete}
              payoutReadiness={payoutReadiness}
              feeForecasts={feeForecasts}
            />
            {/* The closed lines. Renders nothing when empty. */}
            <NothingToAnswerFeed
              cards={nothingToAnswer}
              acceptInquiry={acceptInquiry}
              declineInquiry={declineInquiry}
              confirmLock={vendorAcknowledgeDeposit}
              rejectLock={vendorRejectDeposit}
              agreeLock={vendorAgreeToLock}
              declineLock={vendorDeclineLock}
              agreeDeletion={vendorAgreeToDeletion}
              declineDeletion={vendorDeclineDeletion}
              answerDateChange={vendorAnswerDateChange}
              postReviewReply={postVendorReply}
              respondMeeting={respondAppointment}
              markServiceComplete={vendorMarkServiceComplete}
            />
            {/* WHAT YOU OWE SETNAYAN — every unpaid booking fee, each with its
                own Pay (owner 2026-09-20: "i never saw the payment screen to
                pay us"). The Next card shows ONE bill, and only when nothing
                busier wins; this shows the rest, always. Renders nothing when
                there is no unpaid fee, and nothing when the read failed — an
                unread bill list is not "you owe nothing". */}
            <BookingFeeBills
              bills={next.kind === 'fee' ? todayFeeBills.slice(1) : todayFeeBills}
              copyFor={(b) => feeDueCopy(b, manilaToday())}
            />
          </>
        }
      />

      {/* First visit only — the shipped MiniTour (owner rule: every feature
          gets a first-visit tour). Waits for the welcome tour so two never
          stack on one first visit. */}
      <MiniTour tourKey="vendor_today_v1" after="vendor_welcome_v1" />
    </div>
  );
}
