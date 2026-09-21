import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  FileText,
  Star,
  Inbox,
  ListTodo,
  CalendarClock,
  MessageSquare,
  Wallet,
  Store,
  Zap,
} from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { ProgressRing } from '@/app/_components/progress-ring';
import { CountUp } from '@/app/_components/count-up';
import { waitingAge } from '@/lib/waiting-age';
import { formatLongDate, monthDay } from '@/lib/format-date';
import { lockRequestFuseLabel } from '@/lib/lock-request-state';
import type { PayoutReadiness } from '@/lib/deposit-pay-step';
import { PayoutMethodNudge } from './payout-method-nudge';
import type { FeeDisclosure } from '@/lib/booking-fee-disclosure';
import { BookingFeeNotice } from '@/app/_components/booking-fee-notice';
import { reviewTemper, CLOSED_WINDOW_GRACE_DAYS } from '@/lib/answers-desk';
import { VENDOR_REPLY_MAX_CHARS } from '@/lib/reviews';
import { APPOINTMENT_KIND_LABEL } from '@/lib/appointments';
import { formatPhp } from '@/lib/orders';
import { formatCentavosPhp } from '@/lib/php';
import type {
  OngoingTask,
  UpcomingEventRow,
  VendorEarningsSummary,
  WhatsNewCard,
} from '@/lib/vendor-overview';

/**
 * overview-sections.tsx — the presentational sections of the vendor Overview.
 *
 * RECOMPOSED in Glass PR-6 (2026-07-15 · Atelier-Glass rollout § 3.3) from the
 * editorial `--m-*` white-card layout to the glass language: the KPI cluster is
 * a `.sn-tile` glass bento (ring sweeps + Space-Mono numerals + `.sn-eye` gold
 * eyebrows), the What's-new feed is `.sn-card`s with warm-semantic tone chips,
 * and Ongoing / Upcoming are `.sn-tile` panels of opaque `.sn-row` items with
 * mono date blocks. The single obsidian focal ("Today at {shop}") is
 * `VendorTodayFocal` below — the vendor twin of the launcher's Watch. Every
 * numeral is real (feed-derived counts + real earnings); `m-serif` / `m-label-mono`
 * and all residual `--v-blue` accents are retired here (gold-700 eyebrows;
 * gold rings). Data sources are unchanged — only the expression.
 *
 * COLOR IS ONE SOURCE OF TRUTH. Each card kind maps to a single palette entry
 * ({ accent, eye, eyebrow }) in `CARD_KIND` — the left accent bar and the
 * eyebrow tint both read from it, so a kind can never be one colour in one place
 * and a contradictory colour in another. Per the Atelier-Glass kit, decorative
 * accents are the gold family; only genuine status uses a warm semantic:
 *   · inquiry  → gold (--sn-gold)       — a new lead, money-adjacent (decorative)
 *   · review   → gold when it is praise; WARNING when it is criticism, which is
 *                genuine status (the one kind whose tone is read off the row —
 *                see `cardTone`)
 *   · lock     → success (--sn-success) — a positive commit to confirm (semantic)
 *   · dispute  → danger (--sn-danger)   — needs attention (semantic)
 *   · lapsed ask → ink, and NO control at all — a closed window is not an action
 * The accent uses the -500 shade (a fill), the eyebrow the -700 shade (text on
 * light) of the SAME family — one colour identity per kind, two legible weights.
 */

type CardTone = { accent: string; eye: string; eyebrow: string };

/*
  🪤 `--sn-warn` IS NOT A TOKEN AND NEVER WAS — the amber lock-request accent
  below named it and therefore never rendered. An undefined `var()` is not an
  error: the accent bar's `background` resolves to nothing and the eyebrow's
  `color` falls back to the inherited ink, so a card the comment describes at
  length as deliberately amber has been drawing in the default text colour with a
  blank accent bar. The real tokens are `--sn-warning` (#B77E2E, a FILL — 2.92:1
  as text, so never text) and `--sn-warning-deep` (#7A5119, the text weight,
  5.84:1). Same family as the undefined `--font-serif` that had a whole overlay
  rendering in the phone's default serif: rejected, not thrown, and the only
  symptom is that it looks ordinary.
*/
const CARD_KIND: Record<
  Exclude<WhatsNewCard['kind'], 'review'>,
  CardTone
> = {
  inquiry: { accent: 'var(--sn-gold-500)', eye: 'var(--sn-gold-700)', eyebrow: 'New inquiry' },
  lock: { accent: 'var(--sn-success)', eye: 'var(--sn-success)', eyebrow: 'Lock request' },
  // Amber, not green: this one is a QUESTION with a deadline, not good news to
  // acknowledge. (The Record is exhaustive over the union — a missing kind is a
  // typecheck failure, which is why this line is not optional.)
  lock_request: {
    accent: 'var(--sn-warning)',
    eye: 'var(--sn-warning-deep)',
    eyebrow: 'Booking request — agree?',
  },
  /*
    THE ASK WHOSE WINDOW CLOSED. Deliberately the quietest row on the desk: grey,
    and the only card kind with no control at all. Painting "act on me" on a
    question that can no longer be answered is a lie told to somebody who has
    just lost a booking. (`--sn-ink-400` is 3.67:1 — fine for a bar, never for
    text, so the words use `--sn-ink-500`.)
  */
  lock_request_lapsed: {
    accent: 'var(--sn-ink-400)',
    eye: 'var(--sn-ink-500)',
    eyebrow: 'Booking request — the window closed',
  },
  message: {
    accent: 'var(--sn-gold-500)',
    eye: 'var(--sn-gold-700)',
    eyebrow: 'Waiting on your reply',
  },
  meeting: {
    accent: 'var(--sn-gold-500)',
    eye: 'var(--sn-gold-700)',
    eyebrow: 'A time to confirm',
  },
  quote_draft: {
    accent: 'var(--sn-gold-500)',
    eye: 'var(--sn-gold-700)',
    eyebrow: 'A quote you never sent',
  },
  contract_draft: {
    accent: 'var(--sn-gold-500)',
    eye: 'var(--sn-gold-700)',
    eyebrow: 'A contract you never sent',
  },
  /*
    Danger red, not amber. The lock_request card above is a question with a
    deadline; this one is a question whose "yes" is irreversible for the
    celebration and whose "no" holds somebody's wedding in place. It should not
    look like the others.
  */
  delete_request: {
    accent: 'var(--sn-danger)',
    eye: 'var(--sn-danger)',
    eyebrow: 'A couple wants to remove a celebration',
  },
  dispute: { accent: 'var(--sn-danger)', eye: 'var(--sn-danger)', eyebrow: 'Delivery delay flagged' },
};

/**
 * ONE SOURCE, STILL. A review is the only kind whose tone depends on the row
 * itself: praise is decorative gold, and a review at or below 3 stars — or one
 * whose rating we could not read — is genuine status and wears the warm
 * semantic. The accent bar, the eyebrow tint and the eyebrow WORDS all come out
 * of this one call, so a card can never be amber and congratulatory at once.
 * `reviewTemper` is the pure rule; this function is only its expression.
 */
function cardTone(card: WhatsNewCard): CardTone {
  if (card.kind !== 'review') return CARD_KIND[card.kind];
  if (reviewTemper(card.rating) === 'praise') {
    return {
      accent: 'var(--sn-gold-500)',
      eye: 'var(--sn-gold-700)',
      eyebrow: card.rating
        ? `New ${card.rating}-star review — no reply yet`
        : 'New review — no reply yet',
    };
  }
  return {
    accent: 'var(--sn-warning)',
    eye: 'var(--sn-warning-deep)',
    eyebrow: 'A review needs your answer',
  };
}

/** A small gold diamond that leads a section head (matches the event surface). */
const spark = (
  <span
    aria-hidden
    className="mr-2 inline-block h-1.5 w-1.5 rotate-45 align-middle"
    style={{ background: 'var(--sn-gold-500)' }}
  />
);

/** Meta line joined with " · ", dropping empties. */
function metaLine(parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(' · ');
}

/** Chip style for the mono facts inside the obsidian focal. */
const FOCAL_CHIP: React.CSSProperties = {
  background: 'rgba(255,255,255,.1)',
  border: '1px solid rgba(255,255,255,.16)',
  color: 'var(--sn-gold-300)',
};

// ---------------------------------------------------------------------------
// FOCAL · "Today at {shop}" — the single obsidian tile (§ 1.3, the vendor twin
//   of the launcher's Watch). Inquiries-waiting count-up + next booking + earned
//   this year (mono ₱) + one gold CTA into the What's-new feed where the real
//   Accept/Decline forms live. Blooms last (sn-bloom). All real data; hidden
//   states are honest zeros, never faked.
// ---------------------------------------------------------------------------

export function VendorTodayFocal({
  businessName,
  inquiries,
  nextBooking,
  earnedThisYearPhp,
}: {
  businessName: string;
  inquiries: number;
  nextBooking: UpcomingEventRow | null;
  /** Real year-to-date paid revenue; null when the read failed → chip omitted. */
  earnedThisYearPhp: number | null;
}) {
  const headline =
    inquiries > 0
      ? inquiries === 1
        ? 'A lead is warm — answer first, win first.'
        : `${inquiries} leads are warm — answer first, win first.`
      : nextBooking
        ? 'Your next booking is on the books.'
        : 'Your shop is all set for now.';

  return (
    <section aria-label={`Today at ${businessName}`} className="!mt-6">
      <div className="sn-tile-dark sn-bloom relative overflow-hidden">
        <p className="sn-eye">
          <Store aria-hidden strokeWidth={1.75} />
          Today at {businessName}
        </p>
        <h2
          className="mt-3 max-w-[34ch] text-[22px] font-extrabold leading-tight tracking-[-0.015em]"
          style={{ color: '#F3ECDF' }}
        >
          {headline}
        </h2>

        {/* Primary metric — inquiries waiting (count-up). */}
        <div className="mt-4 flex items-baseline gap-2">
          <b
            className="font-mono text-[46px] font-bold leading-none tracking-[-0.02em]"
            style={{ color: '#F3ECDF' }}
          >
            {inquiries > 0 ? <CountUp value={inquiries} delayMs={700} /> : '0'}
          </b>
          <span
            className="text-[13px] font-semibold"
            style={{ color: 'rgba(243,236,223,.7)' }}
          >
            {inquiries === 1 ? 'lead waiting on you' : 'leads waiting on you'}
          </span>
        </div>

        {/* Facts — next booking + earned this year (mono), hidden when absent. */}
        {(nextBooking || (earnedThisYearPhp !== null && earnedThisYearPhp > 0)) ? (
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            {nextBooking ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11.5px] font-bold"
                style={FOCAL_CHIP}
              >
                <CalendarClock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Next · {monthDay(nextBooking.date)}
              </span>
            ) : null}
            {earnedThisYearPhp !== null && earnedThisYearPhp > 0 ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11.5px] font-bold"
                style={FOCAL_CHIP}
              >
                <Wallet aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                {formatPhp(earnedThisYearPhp)} this year
              </span>
            ) : null}
          </div>
        ) : null}

        {/* One gold CTA → the What's-new feed below (the real Accept surface). */}
        <div className="mt-4">
          {inquiries > 0 ? (
            <Link
              href="#whats-new"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold transition-transform hover:-translate-y-0.5"
              style={{ background: 'var(--sn-gold-500)', color: 'var(--sn-ink-900)' }}
            >
              <Zap aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Answer them
            </Link>
          ) : (
            <Link
              href="/vendor-dashboard/customers"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-transform hover:-translate-y-0.5"
              style={{
                background: 'rgba(255,255,255,.08)',
                border: '1px solid rgba(255,255,255,.16)',
                color: 'rgba(243,236,223,.9)',
              }}
            >
              View your customers
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          )}
        </div>

        {/* Honesty line — the commission promise, said once on the canvas. */}
        <div
          className="mt-4 flex items-center gap-2 border-t pt-3 text-[11.5px]"
          style={{ borderColor: 'rgba(255,255,255,.12)', color: 'rgba(243,236,223,.62)' }}
        >
          <span
            aria-hidden
            className="sn-live-dot inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--sn-gold-300)' }}
          />
          <span>
            Win the booking and you keep 100% —{' '}
            <b className="font-mono font-bold" style={{ color: 'var(--sn-gold-300)' }}>
              0%
            </b>{' '}
            commission, settled off-platform.
          </span>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// KPI BENTO — glass tiles (ring sweeps + Space-Mono numerals + gold eyebrows).
//   Feed-derived counts reuse the SAME data the Overview already loaded — no new
//   queries. The two money tiles carry REAL earnings (fetchVendorEarningsSummary);
//   when that read fails, `earnings` is null and they are omitted, never faked.
// ---------------------------------------------------------------------------

/** Days-to-nearest-event → a 0–100 "how close" ratio for the countdown ring
 *  (a 90-day window; today = full). Real ratio off a real date. */
function countdownPct(inDays: number): number {
  return Math.max(0, Math.min(100, ((90 - inDays) / 90) * 100));
}

function inDaysShort(n: number): string {
  if (n <= 0) return 'Today';
  if (n === 1) return '1 day';
  return `${n} days`;
}

export function VendorEnergyStats({
  whatsNew,
  ongoing,
  upcoming,
  earnings,
}: {
  whatsNew: WhatsNewCard[];
  ongoing: OngoingTask[];
  upcoming: UpcomingEventRow[];
  /** Real earnings summary; null when the read failed → money tiles omitted. */
  earnings: VendorEarningsSummary | null;
}) {
  const inquiries = whatsNew.filter((c) => c.kind === 'inquiry').length;
  const nearest = upcoming[0] ?? null;

  return (
    <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {/* Countdown ring — nearest upcoming booking (gold sweep). Every supplier
          reads this tile — a band, a caterer or a florist does not "shoot". */}
      <div className="sn-tile sn-reveal flex items-center gap-3.5">
        {nearest ? (
          <>
            <ProgressRing
              pct={countdownPct(nearest.inDays)}
              size={60}
              stroke={7}
              color="var(--sn-gold-500)"
              trackColor="rgba(30,26,18,.08)"
              sweep={{ delayMs: 300 }}
            >
              <span className="font-mono text-lg font-bold leading-none text-ink">
                {nearest.inDays <= 0 ? '0' : nearest.inDays}
              </span>
              <span className="text-[9px] uppercase tracking-wide text-ink/45">days</span>
            </ProgressRing>
            <div className="min-w-0">
              <p className="sn-eye">
                <CalendarClock aria-hidden strokeWidth={1.75} />
                Next booking
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-ink">
                {nearest.eventName}
              </p>
              <p className="mt-0.5 truncate text-xs text-ink/55">
                {inDaysShort(nearest.inDays)}
                {nearest.place ? ` · ${nearest.place}` : ''}
              </p>
            </div>
          </>
        ) : (
          <div>
            <p className="sn-eye">
              <CalendarClock aria-hidden strokeWidth={1.75} />
              Next booking
            </p>
            <p className="mt-1.5 text-sm text-ink/55">No booked events yet.</p>
          </div>
        )}
      </div>

      {/* Confirmed cash-flow ring — real confirmed-vs-expected ratio (gold sweep).
          Omitted when the earnings read failed (earnings === null). */}
      {earnings ? (
        <CashFlowTile
          confirmedPhp={earnings.confirmedPhp}
          expectedPhp={earnings.expectedPhp}
          measured={earnings.paydayMeasured}
        />
      ) : null}

      {/* Earned — the money doorway to the full ledger (real YTD, mono ₱). */}
      {earnings ? (
        <EarnedTile
          earnedThisYearPhp={earnings.earnedThisYearPhp}
          bookingCount={earnings.bookingCount}
          measured={earnings.earningsMeasured}
        />
      ) : null}

      {/* KPI row — real counts, Space-Mono numerals, count-up. */}
      <EnergyKpi
        icon={<Inbox className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
        value={inquiries}
        label="New inquiries"
        href="/vendor-dashboard/messages"
      />
      <EnergyKpi
        icon={<ListTodo className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
        value={ongoing.length}
        label="Open tasks"
        href="/vendor-dashboard/clients"
      />
      <EnergyKpi
        icon={<CalendarClock className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
        value={upcoming.length}
        label="Upcoming · next 5"
        href="/vendor-dashboard/calendar"
      />
    </section>
  );
}

/**
 * 🔴 A COUNT THAT GOES NOWHERE (owner, 2026-09-18). A supplier saw "New
 * inquiries · 1" on his dashboard, tapped it, and nothing happened — while the
 * `EarnedTile` sitting directly beside it links to the full ledger. Three
 * numbers styled like tiles, none of them reachable, next to one that is.
 *
 * 🔑 This file already carries the lesson 180 lines down: *"href and no form: a
 * control that looked pressable and did nothing."* Same defect, different
 * direction — that one looked pressable and was inert; these ARE the answer to
 * "where do I go next" and offered no way to go there.
 *
 * `href` is optional so a future count with no destination is a deliberate
 * choice rather than an oversight, and the guard below counts how many go
 * without one.
 */
function EnergyKpi({
  icon,
  value,
  label,
  href,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="sn-eye">
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-800)' }}
        >
          {icon}
        </span>
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-bold leading-none text-ink">
        <CountUp value={value} delayMs={200} />
      </p>
    </>
  );
  // Whole tile is the target, matching EarnedTile — a number is a poor tap
  // target and the label is the part that says where you are going.
  return href ? (
    <Link
      href={href}
      className="sn-tile sn-reveal block transition-colors hover:bg-ink/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {body}
    </Link>
  ) : (
    <div className="sn-tile sn-reveal">{body}</div>
  );
}

/**
 * Earned tile — the money doorway. The exact year-to-date figure the
 * /vendor-dashboard/earnings page shows (matched payments on this vendor's own
 * service categories). Whole card links to the full ledger. ₱0 with
 * `bookingCount === 0` is a genuine empty state.
 */
function EarnedTile({
  earnedThisYearPhp,
  bookingCount,
  measured,
}: {
  earnedThisYearPhp: number;
  bookingCount: number;
  /** False = the ledger read failed or came up short: say so, never ₱0. */
  measured: boolean;
}) {
  if (!measured) {
    return (
      <Link
        href="/vendor-dashboard/earnings"
        className="sn-tile sn-reveal sn-press group flex flex-col"
      >
        <p className="sn-eye">
          <Wallet aria-hidden strokeWidth={1.75} />
          Earned · this year
        </p>
        <span role="status" className="mt-2 block text-sm text-ink/70">
          Some payments couldn&rsquo;t load, so this year&rsquo;s total isn&rsquo;t shown.
          Open your earnings to try again.
        </span>
      </Link>
    );
  }
  return (
    <Link
      href="/vendor-dashboard/earnings"
      className="sn-tile sn-reveal sn-press group flex flex-col"
    >
      <p className="sn-eye">
        <Wallet aria-hidden strokeWidth={1.75} />
        Earned · this year
      </p>
      <span className="mt-2 block font-mono text-3xl font-bold leading-none text-ink">
        {formatPhp(earnedThisYearPhp)}
      </span>
      <span className="mt-2 flex items-center gap-1 text-xs text-ink/60">
        {bookingCount === 0
          ? 'Payments you confirm roll up here.'
          : `${bookingCount} payment${bookingCount === 1 ? '' : 's'} confirmed`}
        <ArrowUpRight
          className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100"
          strokeWidth={1.75}
          style={{ color: 'var(--sn-gold-600)' }}
          aria-hidden
        />
      </span>
    </Link>
  );
}

/**
 * Confirmed cash-flow tile — the vendor's payday timeline collapsed to a real
 * ratio: confirmed (received) vs expected (total booked) installment value
 * across all booked events. The ring encodes that genuine ratio; ₱0 / no booked
 * installments is a genuine empty state.
 */
function CashFlowTile({
  confirmedPhp,
  expectedPhp,
  measured,
}: {
  confirmedPhp: number;
  expectedPhp: number;
  /** false = the payday read was refused; ₱0 here is "unknown", not "none". */
  measured: boolean;
}) {
  const pct = expectedPhp > 0 ? (confirmedPhp / expectedPhp) * 100 : 0;
  return (
    <div className="sn-tile sn-reveal flex items-center gap-3.5">
      {!measured ? (
        <div>
          <p className="sn-eye">
            <Wallet aria-hidden strokeWidth={1.75} />
            Confirmed cash-flow
          </p>
          <p className="mt-1.5 text-sm text-ink/55">
            Couldn&rsquo;t load your installments right now.
          </p>
        </div>
      ) : expectedPhp > 0 ? (
        <>
          <ProgressRing
            pct={pct}
            size={60}
            stroke={7}
            color="var(--sn-gold-500)"
            trackColor="rgba(30,26,18,.08)"
            sweep={{ delayMs: 380 }}
          >
            <span className="font-mono text-base font-bold leading-none text-ink">
              <CountUp value={Math.round(pct)} delayMs={380} suffix="%" />
            </span>
          </ProgressRing>
          <div className="min-w-0">
            <p className="sn-eye">
              <Wallet aria-hidden strokeWidth={1.75} />
              Confirmed cash-flow
            </p>
            <p className="mt-1 truncate font-mono text-sm font-bold text-ink">
              {formatPhp(confirmedPhp)}
            </p>
            <p className="mt-0.5 truncate text-xs text-ink/55">
              of {formatPhp(expectedPhp)} booked
            </p>
          </div>
        </>
      ) : (
        <div>
          <p className="sn-eye">
            <Wallet aria-hidden strokeWidth={1.75} />
            Confirmed cash-flow
          </p>
          <p className="mt-1.5 text-sm text-ink/55">No booked installments yet.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1 · WHAT'S NEW — the decision feed (`.sn-card`s, warm-semantic tone chips).
//     The focal's "Answer them" CTA anchors here (id="whats-new").
// ---------------------------------------------------------------------------

export function WhatsNewFeed({
  cards,
  acceptInquiry,
  declineInquiry,
  confirmLock,
  rejectLock,
  agreeLock,
  declineLock,
  agreeDeletion,
  declineDeletion,
  postReviewReply,
  respondMeeting,
  markServiceComplete,
  payoutReadiness = 'unreadable',
  feeForecasts = {},
  incomplete = false,
}: {
  cards: WhatsNewCard[];
  /**
   * A booking-ask or deposit read did not reach the end. Said above the list,
   * and the "all caught up" empty state is never drawn on top of it — an empty
   * desk that could not be read must not look like a desk with nothing waiting.
   */
  incomplete?: boolean;
  acceptInquiry: (formData: FormData) => void | Promise<void>;
  declineInquiry: (formData: FormData) => void | Promise<void>;
  confirmLock: (formData: FormData) => void | Promise<void>;
  /** "It never arrived" — the shipped reject action, reachable from the row at last. */
  rejectLock: (formData: FormData) => void | Promise<void>;
  agreeLock: (formData: FormData) => void | Promise<void>;
  declineLock: (formData: FormData) => void | Promise<void>;
  agreeDeletion: (formData: FormData) => void | Promise<void>;
  declineDeletion: (formData: FormData) => void | Promise<void>;
  /** The review reply is TAKEN HERE — the desk could name an unanswered review and not accept the answer. */
  postReviewReply: (formData: FormData) => void | Promise<void>;
  respondMeeting: (formData: FormData) => void | Promise<void>;
  /** The completion mark is TAKEN HERE — CTRL-B2 build 1. A desk that names
   *  an unmarked celebration and cannot accept the mark is the same defect as
   *  naming a review it cannot accept an answer to. */
  markServiceComplete: (formData: FormData) => void | Promise<void>;
  /**
   * S19 — can a couple see anywhere to pay this supplier? Shown on the booking
   * ask, where agreeing makes the deposit the couple's next step. Defaults to
   * `unreadable`, which renders nothing.
   */
  payoutReadiness?: PayoutReadiness;
  /**
   * What agreeing to each booking ask will cost this shop, keyed by
   * `event_vendors.vendor_id`. Resolved ONCE on the Today page so a feed with
   * two asks prices both without either card doing its own arithmetic.
   */
  feeForecasts?: Record<string, FeeDisclosure | null>;
}) {
  return (
    <section id="whats-new" className="mb-8 scroll-mt-24">
      <SectionHeader
        title="What's new"
        count={cards.length}
        // ⛔ "Mark all seen" REMOVED — it was a bare <span> with no onClick, no
        // href and no form: a control that looked pressable and did nothing.
        // No bulk-acknowledge action exists for these cards, so the honest fix is
        // to remove the affordance rather than to fake one. ("No fake doors.")
        action={null}
      />
      {incomplete ? (
        <p role="status" className="sn-tile mb-3 p-4 text-sm text-ink/80">
          Some booking asks and deposits couldn&rsquo;t load, so this list may be
          missing some. Refresh the page to try again.
        </p>
      ) : null}
      {cards.length === 0 && incomplete ? null : cards.length === 0 ? (
        <EmptyCard
          icon={<Star className="h-5 w-5" strokeWidth={1.5} style={{ color: 'var(--sn-ink-400)' }} />}
          text="You're all caught up. Every answer you owe anybody — new inquiries, booking asks, replies, reviews, meeting times, quotes and contracts you haven't sent — lands here, the longest wait first."
        />
      ) : (
        <ul className="space-y-3">
          {cards.map((card) => (
            <li key={card.id}>
              <FeedCard
                card={card}
                acceptInquiry={acceptInquiry}
                declineInquiry={declineInquiry}
                confirmLock={confirmLock}
                rejectLock={rejectLock}
                agreeLock={agreeLock}
                declineLock={declineLock}
                agreeDeletion={agreeDeletion}
                declineDeletion={declineDeletion}
                postReviewReply={postReviewReply}
                respondMeeting={respondMeeting}
                payoutReadiness={payoutReadiness}
                feeForecasts={feeForecasts}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FeedCard({
  card,
  acceptInquiry,
  declineInquiry,
  confirmLock,
  rejectLock,
  agreeLock,
  declineLock,
  agreeDeletion,
  declineDeletion,
  postReviewReply,
  respondMeeting,
  payoutReadiness,
  feeForecasts,
}: {
  card: WhatsNewCard;
  acceptInquiry: (formData: FormData) => void | Promise<void>;
  declineInquiry: (formData: FormData) => void | Promise<void>;
  confirmLock: (formData: FormData) => void | Promise<void>;
  /** "It never arrived" — the shipped reject action, reachable from the row at last. */
  rejectLock: (formData: FormData) => void | Promise<void>;
  agreeLock: (formData: FormData) => void | Promise<void>;
  declineLock: (formData: FormData) => void | Promise<void>;
  agreeDeletion: (formData: FormData) => void | Promise<void>;
  declineDeletion: (formData: FormData) => void | Promise<void>;
  postReviewReply: (formData: FormData) => void | Promise<void>;
  respondMeeting: (formData: FormData) => void | Promise<void>;
  payoutReadiness: PayoutReadiness;
  feeForecasts: Record<string, FeeDisclosure | null>;
}) {
  const tone = cardTone(card);
  return (
    <div className="sn-card relative overflow-hidden py-4 pl-5 pr-4">
      {/* Left color accent + eyebrow — one palette entry per card. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: tone.accent }}
      />
      <p className="sn-eye mb-1" style={{ color: tone.eye }}>
        {tone.eyebrow}
      </p>

      {card.kind === 'inquiry' ? (
        <InquiryBody
          card={card}
          acceptInquiry={acceptInquiry}
          declineInquiry={declineInquiry}
        />
      ) : card.kind === 'lock_request' ? (
        <LockRequestBody
          card={card}
          agreeLock={agreeLock}
          declineLock={declineLock}
          payoutReadiness={payoutReadiness}
          feeForecast={feeForecasts[card.eventVendorId] ?? null}
        />
      ) : card.kind === 'lock_request_lapsed' ? (
        <LockRequestLapsedBody card={card} />
      ) : card.kind === 'delete_request' ? (
        <DeleteRequestBody
          card={card}
          agreeDeletion={agreeDeletion}
          declineDeletion={declineDeletion}
        />
      ) : card.kind === 'lock' ? (
        <LockBody card={card} confirmLock={confirmLock} rejectLock={rejectLock} />
      ) : card.kind === 'mark_complete' ? (
        <MarkCompleteBody card={card} markServiceComplete={markServiceComplete} />
      ) : card.kind === 'review' ? (
        <ReviewBody card={card} postReviewReply={postReviewReply} />
      ) : card.kind === 'message' ? (
        <MessageBody card={card} />
      ) : card.kind === 'meeting' ? (
        <MeetingBody card={card} respondMeeting={respondMeeting} />
      ) : card.kind === 'quote_draft' ? (
        <QuoteDraftBody card={card} />
      ) : card.kind === 'contract_draft' ? (
        <ContractDraftBody card={card} />
      ) : (
        <DisputeBody card={card} />
      )}
    </div>
  );
}

/**
 * HOW LONG THIS HAS BEEN WAITING — on every row that is a question, which is
 * every row on this desk.
 *
 * ⚠ The old rule here was "enquiry cards ONLY … putting an age on those would
 * invent an SLA nobody agreed to", written when the feed sorted newest-first.
 * The feed sorts OLDEST-WAITING-FIRST now, so the age is not a promise of a
 * reply time — it is the reason the row is where it is. Hiding it left a
 * supplier unable to see why one card sat above another.
 */
function AgeLine({ since }: { since: string }) {
  const waited = waitingAge(since, Date.now());
  if (!waited) return null;
  return (
    <span style={waited.overdue ? { color: 'var(--m-mulberry)' } : undefined}>
      {waited.label}
    </span>
  );
}

function MarkCompleteBody({
  card,
  markServiceComplete,
}: {
  card: Extract<WhatsNewCard, { kind: 'mark_complete' }>;
  markServiceComplete: (formData: FormData) => void | Promise<void>;
}) {
  /*
    THE ROW THAT STARTS THE WHOLE AFTER-THE-EVENT CHAIN (CTRL-B2 build 1).
    Measured 2026-09-22: `service_marked_complete_at` set on 0 of 51 bookings,
    `vendor_reviews` empty. The couple's confirm is gated on this mark and
    nothing ever asked a supplier for it.

    🔑 THE COPY SAYS WHAT IT UNLOCKS, not just what it does. "Mark it complete"
    alone reads like filing; a supplier presses it for the review, which is the
    thing that wins them their next booking.
  */
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/75">
        {card.eventName} has finished. Confirm you delivered your service — that
        lets the couple confirm they received it, which is what opens your
        review.
      </p>
      <p className="text-xs text-ink/55">{metaLine([card.eventDate ? formatLongDate(card.eventDate) : null])}</p>
      {/* 🔑 `event_id` ONLY. The shipped `vendorMarkServiceComplete` resolves the
          booking from (event, this shop's own profile) and ignores any vendor id
          — passing one would look like it scoped the write when it did not. */}
      <form action={markServiceComplete}>
        <input type="hidden" name="event_id" value={card.eventId} />
        <button type="submit" className="sn-btn sn-btn-primary text-sm">
          I delivered this service
        </button>
      </form>
    </div>
  );
}

function InquiryBody({
  card,
  acceptInquiry,
  declineInquiry,
}: {
  card: Extract<WhatsNewCard, { kind: 'inquiry' }>;
  acceptInquiry: (formData: FormData) => void | Promise<void>;
  declineInquiry: (formData: FormData) => void | Promise<void>;
}) {
  // `card.descriptor` is the neutral anonymized label ("A couple planning a
  // {type} in {city}") — the inquiry card carries no couple identity pre-accept.
  // ⚠ `card.place` was printed twice — once inside `descriptor` ("A couple
  // planning a wedding in Metro Manila") and again as its own item, so the line
  // read "… in Metro Manila · Dec 18 · Metro Manila · Live Band". Dropped from
  // the list; the descriptor already says where.
  const meta = metaLine([
    card.descriptor,
    formatLongDate(card.eventDate),
    card.category,
    card.paxAtInquiry ? `~${card.paxAtInquiry} guests` : null,
  ]);
  return (
    <>
      <p className="text-sm font-semibold text-ink">New customer</p>
      <p className="mt-0.5 font-mono text-xs text-ink/60">
        {meta}
        {/* § 2.4 EXTEND 1 — how long this couple has been waiting for a reply.
          *  ⚠ IT USED TO BE A SECOND COPY OF THIS, inline, with a docblock saying
          *  enquiry cards were the only place an age belonged. Every row on the
          *  desk carries one now, so it is ONE component (`AgeLine`) — two copies
          *  of the same clock is how two surfaces come to disagree about it. */}
        {' · '}
        <AgeLine since={card.createdAt} />
      </p>
      {/* WHAT THEY ASKED. Granted pre-accept by the 2026-07-15 anonymisation
          decision — *"a vendor sees the JOB (… guest/budget bands · category ·
          couple's message text)"* — and already shown pre-accept on the thread
          page. This card withheld it, so a supplier chose Accept or Decline
          without seeing the question. Quoted, never summarised: a paraphrase is
          a second author's version of what somebody asked. */}
      {card.messageExcerpt ? (
        <p className="mt-2 border-l-2 border-ink/15 pl-3 text-sm italic text-ink/75">
          “{card.messageExcerpt}”
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={acceptInquiry}>
          <input type="hidden" name="thread_id" value={card.threadId} />
          <input type="hidden" name="return_to" value="/vendor-dashboard" />
          <SubmitButton
            pendingLabel="Accepting…"
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-white"
            style={{ background: 'var(--sn-ink-900)' }}
          >
            Accept
          </SubmitButton>
        </form>
        <form action={declineInquiry}>
          <input type="hidden" name="thread_id" value={card.threadId} />
          <input type="hidden" name="return_to" value="/vendor-dashboard" />
          <SubmitButton
            pendingLabel="Declining…"
            className="inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold text-ink"
            style={{ borderColor: 'var(--sn-line)' }}
          >
            Decline
          </SubmitButton>
        </form>
      </div>
    </>
  );
}

/**
 * PR-H step 2 — the supplier's answer, on the surface they actually open.
 *
 * Plain forms with a hidden booking id, no client JS, mirroring LockBody. The
 * form carries ONLY `vendor_id`: every side effect keys on the event id the
 * DEFINER RPC read off the row it authorized, never on anything posted here.
 *
 * The decline sits inside a <details> rather than beside Agree — a no is a real
 * answer the couple needs, but it should not be one mis-tap away from a yes.
 */
function LockRequestBody({
  card,
  agreeLock,
  declineLock,
  payoutReadiness,
  feeForecast,
}: {
  card: Extract<WhatsNewCard, { kind: 'lock_request' }>;
  agreeLock: (formData: FormData) => void | Promise<void>;
  declineLock: (formData: FormData) => void | Promise<void>;
  payoutReadiness: PayoutReadiness;
  /** What this booking will cost them, named BEFORE the Agree button. */
  feeForecast: FeeDisclosure | null;
}) {
  // Rendered on the server, so "now" is the render instant.
  // ONE phrasing, shared with the customer card and the Customers roster — three
  // surfaces wording the same deadline three ways is how they come to disagree
  // about it. The window is 48 hours (owner 2026-08-28), so this now counts in
  // HOURS below a day: "Last day to answer" spent half a two-day fuse saying the
  // same thing at 23 hours and at 3 minutes.
  const fuse = lockRequestFuseLabel(card.expiresAt, new Date());
  const detail = metaLine([
    card.eventDate ? monthDay(card.eventDate) : null,
    // waitingAge returns { label, overdue } — metaLine wants strings.
    waitingAge(card.requestedAt, Date.now())?.label ?? null,
    fuse,
  ]);
  return (
    <>
      <p className="text-sm font-semibold text-ink">{card.coupleName} wants to book you</p>
      <p className="mt-0.5 text-sm text-ink/60">{detail}</p>
      <PayoutMethodNudge readiness={payoutReadiness} context="lock" />
      {/* ⚠ ABOVE THE BUTTON. A fee named after the press is a receipt. */}
      <BookingFeeNotice disclosure={feeForecast} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={agreeLock}>
          <input type="hidden" name="vendor_id" value={card.eventVendorId} />
          <SubmitButton
            pendingLabel="Agreeing…"
            className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-white"
            style={{ background: 'var(--sn-success)' }}
          >
            Agree to this booking
          </SubmitButton>
        </form>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-ink/60">
          Can&rsquo;t take this booking?
        </summary>
        <form action={declineLock} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="vendor_id" value={card.eventVendorId} />
          <input
            type="text"
            name="reason"
            maxLength={240}
            placeholder="Why? (optional — the couple sees this)"
            className="h-9 min-w-0 flex-1 rounded-full border px-3 text-sm"
            style={{ borderColor: 'var(--sn-line)' }}
          />
          <SubmitButton
            pendingLabel="Sending…"
            className="inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold text-ink"
            style={{ borderColor: 'var(--sn-line)' }}
          >
            Turn it down
          </SubmitButton>
        </form>
      </details>
    </>
  );
}

/**
 * The couple wants to remove a celebration this supplier was PAID for, and only
 * the supplier can release it (owner 2026-08-21).
 *
 * ── WHAT IT SAYS, AND WHY ──────────────────────────────────────────────────
 * This is somebody being told a wedding they were paid for is being erased. It
 * may have been cancelled, or called off, or something sad may have happened.
 * The card does not speculate and does not apologise on the couple's behalf —
 * it states the fact, the date, and the two things the supplier actually needs
 * to decide: their own record is kept either way, and nothing is removed until
 * they answer.
 *
 * 🔒 NO AMOUNT (owner ruling, D1). The figure we hold is the COUPLE'S ledger
 * entry and may not match what the supplier banked; a wrong number on this card
 * starts a dispute. It says "a payment" and stops there.
 *
 * ⏳ NO DEADLINE, deliberately (owner ruling, D3). An unanswered ask stays open
 * forever with one reminder. There is no fuse to display because there is no
 * fuse — anything that auto-agreed would manufacture a consent nobody gave.
 * The card therefore says what silence means: nothing happens.
 */
function DeleteRequestBody({
  card,
  agreeDeletion,
  declineDeletion,
}: {
  card: Extract<WhatsNewCard, { kind: 'delete_request' }>;
  agreeDeletion: (formData: FormData) => void | Promise<void>;
  declineDeletion: (formData: FormData) => void | Promise<void>;
}) {
  const detail = metaLine([
    card.eventDate ? monthDay(card.eventDate) : null,
    waitingAge(card.requestedAt, Date.now())?.label ?? null,
  ]);
  return (
    <>
      <p className="text-sm font-semibold text-ink">
        A celebration you were paid for is being removed
      </p>
      <p className="mt-0.5 text-sm text-ink/60">{detail}</p>
      <p className="mt-2 max-w-prose text-sm text-ink/70">
        Their records show a payment to you. If you agree, the couple&rsquo;s
        celebration is removed —{' '}
        <strong className="font-semibold text-ink">
          your booking record, your reviews and your figures stay with your shop
        </strong>
        . Nothing is removed until you answer, and there is no time limit.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={agreeDeletion}>
          <input type="hidden" name="vendor_id" value={card.eventVendorId} />
          <SubmitButton
            pendingLabel="Agreeing…"
            className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-white"
            style={{ background: 'var(--sn-danger)' }}
          >
            Agree to remove it
          </SubmitButton>
        </form>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-ink/60">
          Not yet &mdash; say why
        </summary>
        <form action={declineDeletion} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="vendor_id" value={card.eventVendorId} />
          <input
            type="text"
            name="reason"
            maxLength={240}
            placeholder="Why? (optional — the couple sees this)"
            className="h-9 min-w-0 flex-1 rounded-full border px-3 text-sm"
            style={{ borderColor: 'var(--sn-line)' }}
          />
          <SubmitButton
            pendingLabel="Sending…"
            className="inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold text-ink"
            style={{ borderColor: 'var(--sn-line)' }}
          >
            Keep it for now
          </SubmitButton>
        </form>
      </details>
    </>
  );
}

/**
 * SOMEBODY SAYS THEY PAID YOU — and now the row can say NO.
 *
 * ⚖ OWNER RULING 2026-08-27, asked directly: *"yes. they can declare it."*
 *
 * 🔑 RULE 0: THE "NO" WAS ALREADY BUILT — it is `vendorRejectDeposit` and the
 * `reject_vendor_deposit` RPC behind it, shipped with an ownership gate, a
 * single-winner UPDATE and a reason that reaches the couple. What did not exist
 * was a way to reach it from HERE: the desk asked a money question and offered
 * one answer, with the other one screen away on the customer's own card. So this
 * mirrors that card's control exactly rather than inventing a second way to say
 * no — two mechanisms for one answer is how they come to disagree.
 *
 * 🧾 AND THE RECEIPT WAS ALREADY IN THE CARD'S HAND. `proofUrl` has been fetched
 * into this card since it was written and never rendered once, so a supplier was
 * asked to confirm a payment without being shown the proof of it — the answer the
 * whole row exists for, decided blind.
 *
 * 🗣 THE COPY IS A CLAIM NOW, NOT A FACT. It read "Downpayment received", which
 * states as settled the very thing the supplier is being asked to judge.
 *
 * ⛔ The refusal stays behind a fold with its own reason box. A "no" is a real
 * answer the couple needs and must not be one mis-tap from the "yes" — the same
 * restraint the booking-ask and deletion cards keep.
 */
function LockBody({
  card,
  confirmLock,
  rejectLock,
}: {
  card: Extract<WhatsNewCard, { kind: 'lock' }>;
  confirmLock: (formData: FormData) => void | Promise<void>;
  rejectLock: (formData: FormData) => void | Promise<void>;
}) {
  const detail = metaLine([
    'They say they have paid your downpayment',
    card.eventDate ? monthDay(card.eventDate) : null,
  ]);
  // A local binding, not `card.proofUrl` inline: narrowing a nullable PROPERTY
  // inside JSX did not survive here (`string | null` reached an `href` that takes
  // `string | undefined`), and the typecheck said so. A const narrows once and
  // reads better than a non-null assertion, which would have silenced the one
  // check that noticed.
  const receiptUrl = card.proofUrl;
  return (
    <>
      <p className="text-sm font-semibold text-ink">{card.coupleName}</p>
      <p className="mt-0.5 text-sm text-ink/60">
        {detail}
        {' · '}
        <AgeLine since={card.recordedAt} />
      </p>
      {receiptUrl ? (
        <a
          href={receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-2 hover:underline"
          style={{ color: 'var(--sn-gold-700)' }}
        >
          <FileText aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          See what they sent
        </a>
      ) : (
        <p className="mt-2 text-sm text-ink/55">They attached no receipt.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={confirmLock}>
          <input type="hidden" name="event_id" value={card.eventId} />
          <input type="hidden" name="vendor_id" value={card.eventVendorId} />
          <SubmitButton
            pendingLabel="Confirming…"
            className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-white"
            style={{ background: 'var(--sn-success)' }}
          >
            Yes, it arrived
          </SubmitButton>
        </form>
        {/* Money → the Quote & Payments section, the one money tab BOTH
            shells render. A bare client route lands on the chat (#5614). */}
        <Link
          href={`/vendor-dashboard/clients/${card.eventId}?tab=quote`}
          className="inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold text-ink"
          style={{ borderColor: 'var(--sn-line)' }}
        >
          View the payment
        </Link>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-ink/60">
          It hasn&rsquo;t reached you?
        </summary>
        <form action={rejectLock} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="event_id" value={card.eventId} />
          <input type="hidden" name="vendor_id" value={card.eventVendorId} />
          {/* Comes back HERE with the outcome, instead of moving the supplier to
              another screen the moment they answer. The action selects from a
              fixed pair — the posted value is never used as a path. */}
          <input type="hidden" name="return_to" value="/vendor-dashboard" />
          <input
            type="text"
            name="reason"
            maxLength={200}
            placeholder="Why? (optional — they see this)"
            className="h-9 min-w-0 flex-1 rounded-full border px-3 text-sm"
            style={{ borderColor: 'var(--sn-line)' }}
          />
          <SubmitButton
            pendingLabel="Sending…"
            className="inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold"
            style={{ borderColor: 'var(--sn-danger)', color: 'var(--sn-danger)' }}
          >
            It never arrived
          </SubmitButton>
        </form>
        <p className="mt-2 max-w-prose text-[12px] text-ink/55">
          Their record of paying is cleared so they can send it again with the
          right receipt. It does not cancel the booking, and nothing about your
          date changes.
        </p>
      </details>
    </>
  );
}

/**
 * THE ANSWER IS TAKEN HERE.
 *
 * The feed could say a review was unanswered and could not accept the answer —
 * it linked away to the Reviews page, which is the one thing a list of answers
 * you owe must not do with the answer it is asking for. The box is on the row.
 *
 * 🔒 ONE PUBLIC REPLY, FINAL ONCE POSTED (owner 2026-06-29; the `lock_vendor_reply`
 * trigger refuses any change). So the card says so BEFORE the button, not after,
 * and the reply is never a one-tap send of pre-written words.
 *
 * ⚠ AND IT IS NOT ONLY PRAISE ANY MORE. This body is now reached by a one-star
 * review, so nothing here may assume the words above it were kind: the fallback
 * line states the rating instead of thanking anybody, and the placeholder does
 * not tell a shop how to feel about what was said.
 */
function ReviewBody({
  card,
  postReviewReply,
}: {
  card: Extract<WhatsNewCard, { kind: 'review' }>;
  postReviewReply: (formData: FormData) => void | Promise<void>;
}) {
  const stars = typeof card.rating === 'number' ? `${card.rating} of 5` : 'Rating unavailable';
  return (
    <>
      <p className="text-sm font-semibold text-ink">{card.coupleName}</p>
      <p className="mt-0.5 font-mono text-xs text-ink/60">
        {stars}
        {' · '}
        <AgeLine since={card.createdAt} />
      </p>
      {card.quote ? (
        <p className="mt-1 max-w-prose text-sm italic text-ink/70">
          &ldquo;{card.quote}&rdquo;
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink/60">They left a rating with no words.</p>
      )}
      <form action={postReviewReply} className="mt-3 space-y-2">
        <input type="hidden" name="review_id" value={card.reviewId} />
        {/* Brings the vendor back to the desk instead of the Reviews page. */}
        <input type="hidden" name="return_to" value="/vendor-dashboard" />
        <label htmlFor={`desk_reply_${card.reviewId}`} className="sr-only">
          Your public reply
        </label>
        <textarea
          id={`desk_reply_${card.reviewId}`}
          name="reply"
          required
          rows={2}
          maxLength={VENDOR_REPLY_MAX_CHARS}
          placeholder="Write your public reply — couples reading your shop will see it."
          className="input-field min-h-[64px] w-full py-2 text-sm"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-ink/50">
            One public reply, and it&rsquo;s final once posted.
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`/vendor-dashboard/reviews#reply_${card.reviewId}`}
              className="inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold text-ink"
              style={{ borderColor: 'var(--sn-line)' }}
            >
              Open the review
            </Link>
            <SubmitButton
              pendingLabel="Posting…"
              className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-white"
              style={{ background: 'var(--sn-ink-900)' }}
            >
              Post reply
            </SubmitButton>
          </div>
        </div>
      </form>
    </>
  );
}

/**
 * A JUDGEMENT, SO A SENTENCE AND A WAY IN — NEVER A FAST BUTTON.
 *
 * A couple has said a delivery was late. There is no answer to that which can be
 * given in one tap from a list without reading what they actually said, so this
 * card gets the one thing it was missing: a sentence telling the supplier what
 * the flag means and what happens next.
 */
function DisputeBody({ card }: { card: Extract<WhatsNewCard, { kind: 'dispute' }> }) {
  return (
    <>
      <p className="text-sm font-semibold text-ink">
        A couple flagged a delivery delay
      </p>
      <p className="mt-0.5 font-mono text-xs text-ink/60">
        {metaLine([card.eventName, card.label])}
        {' · '}
        <AgeLine since={card.createdAt} />
      </p>
      <p className="mt-2 max-w-prose text-sm text-ink/70">
        They marked something you handed over as late. Nothing is decided by us
        and no money moves —{' '}
        <strong className="font-semibold text-ink">
          read what they said and answer them in your own words
        </strong>
        . A flag they raised by mistake comes down when they clear it.
      </p>
      <div className="mt-3">
        {/*
          THE DESTINATION MATCHES THE SENTENCE ABOVE IT. "Read what they said
          and answer them in your own words" is the CONVERSATION — the customer
          card's handover list carries the status chip and no reply box. It used
          to be a bare client route, which only reached the chat by accident
          (the #5614 redirect) and landed on Overview whenever there was no
          thread or the shell flag was off. Named, not inferred.
        */}
        <Link
          href={card.threadHref ?? `/vendor-dashboard/clients/${card.eventId}?tab=schedule`}
          className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-white"
          style={{ background: 'var(--sn-danger)' }}
        >
          {card.threadHref ? 'Answer them' : 'Open the handover'}
        </Link>
      </div>
    </>
  );
}

/**
 * THE BOOKING ASK WHOSE SEVEN DAYS RAN OUT.
 *
 * 🔑 IT DOES NOT VANISH — a row that simply disappears reads as one you
 * answered. It keeps the answerable card's place in the feed for a week and then
 * clears itself, and it carries NO control: `vendor_agree_to_lock` refuses a
 * lapsed request, so any button here would be one that refuses the person it is
 * shown to. (Until now the answerable card kept rendering forever — expiry in
 * this product is lazy — telling a supplier it was their "Last day to answer"
 * long after it stopped being any day at all.)
 */
function LockRequestLapsedBody({
  card,
}: {
  card: Extract<WhatsNewCard, { kind: 'lock_request_lapsed' }>;
}) {
  /* 🔴 A TIMESTAMP, NOT A DATE — and it used to be rendered in whatever zone the
     RUNTIME happened to be in. Vercel runs UTC and Manila is UTC+8, so a lock
     that lapsed at 07:00 Manila was stamped 23:00 the PREVIOUS day and this card
     named the wrong day to the supplier. `meetingWhen` twenty lines below
     already zones to Asia/Manila; this is the same page agreeing with itself.
     The locale is pinned for the reason given on `monthDay`. */
  const closed = card.expiresAt
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Manila',
      }).format(new Date(card.expiresAt))
    : null;
  return (
    <>
      <p className="text-sm font-semibold text-ink">
        {card.coupleName} asked to book you, and nobody answered in time
      </p>
      <p className="mt-0.5 font-mono text-xs text-ink/60">
        {metaLine([
          card.eventDate ? monthDay(card.eventDate) : null,
          closed ? `closed ${closed}` : null,
        ])}
      </p>
      <p className="mt-2 max-w-prose text-sm text-ink/70">
        The date was never held for you and nothing was booked. If they still
        want you, they can ask again — this note clears itself in about{' '}
        {CLOSED_WINDOW_GRACE_DAYS} days.
      </p>
    </>
  );
}

/**
 * A REPLY OWED IN A CONVERSATION THIS SHOP ALREADY ACCEPTED — probably the
 * commonest row on this desk, and it appeared NOWHERE until now: the enquiry
 * lane above is pre-accept only.
 *
 * 🔑 THIS IS THE THING WE MEASURE AND PUBLISH. A shop's public card carries how
 * fast it replies; a list called "every answer you owe" that omitted the replies
 * was not that list.
 */
function MessageBody({ card }: { card: Extract<WhatsNewCard, { kind: 'message' }> }) {
  return (
    <>
      <p className="text-sm font-semibold text-ink">{card.coupleName}</p>
      <p className="mt-0.5 font-mono text-xs text-ink/60">
        <AgeLine since={card.lastMessageAt} />
      </p>
      {card.excerpt ? (
        <p className="mt-1 max-w-prose truncate text-sm text-ink/70">
          &ldquo;{card.excerpt}&rdquo;
        </p>
      ) : null}
      <div className="mt-3">
        <Link
          href={`/vendor-dashboard/messages/${card.threadId}`}
          className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-white"
          style={{ background: 'var(--sn-ink-900)' }}
        >
          Open the conversation
        </Link>
      </div>
    </>
  );
}

/** "Sat, Sep 5, 2:00 PM" — a real instant, so it is zoned, never split into digits. */
function meetingWhen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  }).format(d);
}

/**
 * THE COUPLE PROPOSED A TIME.
 *
 * Confirming is a FACT — you can be there or you cannot — so Confirm sits on the
 * row. Declining is a real answer the couple needs, so it is here too, but
 * behind a fold: a no should not be one mis-tap from a yes. Offering a different
 * time needs a calendar, so that is a way in, not a control on a feed card.
 *
 * 🪤 A PROPOSAL WITH NO TIME ON IT gets no Confirm button — there is nothing to
 * confirm — and a proposal whose time has PASSED gets none either: the same
 * closed-line treatment as the lapsed booking ask, out of the waited-longest
 * order so a tasting that already happened cannot claim the top of the list.
 */
function MeetingBody({
  card,
  respondMeeting,
}: {
  card: Extract<WhatsNewCard, { kind: 'meeting' }>;
  respondMeeting: (formData: FormData) => void | Promise<void>;
}) {
  const when = meetingWhen(card.scheduledAt);
  const hidden = (
    <>
      <input type="hidden" name="appointment_id" value={card.appointmentId} />
      <input type="hidden" name="event_id" value={card.eventId} />
      <input type="hidden" name="vendor_profile_id" value={card.vendorProfileId} />
      <input type="hidden" name="return_path" value="/vendor-dashboard" />
      <input type="hidden" name="label" value={card.label} />
    </>
  );
  return (
    <>
      <p className="text-sm font-semibold text-ink">
        {card.coupleName} — {card.label}
      </p>
      <p className="mt-0.5 font-mono text-xs text-ink/60">
        {metaLine([
          when,
          APPOINTMENT_KIND_LABEL[card.meetingKind] ?? null,
          card.location,
          card.durationMin ? `${card.durationMin} min` : null,
        ])}
        {' · '}
        <AgeLine since={card.passed && card.scheduledAt ? card.scheduledAt : card.proposedAt} />
      </p>
      {card.passed ? (
        <p className="mt-2 max-w-prose text-sm text-ink/70">
          That time has been and gone with no answer from you. Nothing is booked —
          open the customer to offer them another one.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!card.passed && card.scheduledAt ? (
          <form action={respondMeeting}>
            {hidden}
            <input type="hidden" name="decision" value="confirm" />
            <SubmitButton
              pendingLabel="Confirming…"
              className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-white"
              style={{ background: 'var(--sn-success)' }}
            >
              Confirm this time
            </SubmitButton>
          </form>
        ) : null}
        {/* "Offering a different time needs a calendar" — that calendar is
            AppointmentsSection, and it is mounted on `?tab=schedule`. A bare
            client route lands on the chat, which has no calendar in it. */}
        <Link
          href={`/vendor-dashboard/clients/${card.eventId}?tab=schedule`}
          className="inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold text-ink"
          style={{ borderColor: 'var(--sn-line)' }}
        >
          {card.passed || !card.scheduledAt ? 'Open the customer' : 'Offer another time'}
        </Link>
      </div>
      {!card.passed ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-ink/60">
            Can&rsquo;t make it at all?
          </summary>
          <form action={respondMeeting} className="mt-2">
            {hidden}
            <input type="hidden" name="decision" value="decline" />
            <SubmitButton
              pendingLabel="Sending…"
              className="inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold text-ink"
              style={{ borderColor: 'var(--sn-line)' }}
            >
              Turn down this meeting
            </SubmitButton>
          </form>
        </details>
      ) : null}
    </>
  );
}

/**
 * A QUOTE THIS SHOP WROTE AND NEVER SENT.
 *
 * ⛔ NO SEND BUTTON, DELIBERATELY. Sending retires every other live quote this
 * shop has out with that couple, so it is not a decision to make in one tap from
 * a list you are skimming. The card opens the quote where the consequence is
 * visible.
 */
function QuoteDraftBody({ card }: { card: Extract<WhatsNewCard, { kind: 'quote_draft' }> }) {
  // Centavo-exact. A draft is not yet an ask, but it becomes one on Send
  // without being re-entered, so the supplier must read the figure they will
  // actually put in front of the couple.
  //
  // 🔴 PR #5756 (MERGED) WROTE THIS LINE AS `formatPhp(Math.round(c) / 100)` AND
  // THAT FIX WAS INERT ON `main`. The arithmetic was right, but `formatPhp` in
  // this file came from `@/lib/vendors`, which did
  // `maximumFractionDigits: 0` — so a ₱837.50 draft still read ₱838 after the
  // fix landed. Measured on `main` at 30e6baab5, not inferred.
  //
  // 🔑 THAT IS THE WHOLE CASE FOR THIS PR. Removing the caller's rounding
  // cannot help while the formatter it calls also rounds, and a name collision
  // is what hid the second one. Now there is one definition (`lib/php.ts`) and
  // the centavos are entered directly.
  const amount =
    typeof card.totalCentavos === 'number'
      ? formatCentavosPhp(card.totalCentavos)
      : null;
  return (
    <>
      <p className="text-sm font-semibold text-ink">{card.title}</p>
      <p className="mt-0.5 font-mono text-xs text-ink/60">
        {metaLine([amount, 'saved, never sent'])}
        {' · '}
        <AgeLine since={card.createdAt} />
      </p>
      <div className="mt-3">
        <Link
          href="/vendor-dashboard/proposals"
          className="inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold text-ink"
          style={{ borderColor: 'var(--sn-line)' }}
        >
          Open the quote
        </Link>
      </div>
    </>
  );
}

/** A contract drafted and never sent. Same shape, same restraint — open it, never send it from here. */
function ContractDraftBody({
  card,
}: {
  card: Extract<WhatsNewCard, { kind: 'contract_draft' }>;
}) {
  return (
    <>
      <p className="text-sm font-semibold text-ink">{card.title}</p>
      <p className="mt-0.5 font-mono text-xs text-ink/60">
        {'drafted, never sent'}
        {' · '}
        <AgeLine since={card.createdAt} />
      </p>
      <div className="mt-3">
        <Link
          href="/vendor-dashboard/contracts"
          className="inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold text-ink"
          style={{ borderColor: 'var(--sn-line)' }}
        >
          Open the contract
        </Link>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// 3 · ONGOING — open tasks (a `.sn-tile` panel of opaque `.sn-row` items).
// ---------------------------------------------------------------------------

export function OngoingTasks({ tasks }: { tasks: OngoingTask[] }) {
  return (
    <section className="mb-8">
      <SectionHeader
        title="Ongoing"
        count={tasks.length}
        action={
          tasks.length > 0 ? (
            <Link
              href="/vendor-dashboard/clients"
              className="text-xs font-semibold hover:underline"
              style={{ color: 'var(--sn-gold-700)' }}
            >
              View all
            </Link>
          ) : null
        }
      />
      {tasks.length === 0 ? (
        <EmptyCard text="No open tasks right now. Contracts to send, deposits to confirm, and unanswered inquiries will show up here." />
      ) : (
        <div className="sn-tile p-2 sm:p-2.5">
          <ul className="space-y-1">
            {tasks.map((task) => (
              <li key={task.id}>
                <Link
                  href={task.href}
                  className="sn-row group flex items-center gap-3 px-3.5 py-3 transition-transform hover:translate-x-0.5"
                >
                  {/* Decorative status marker — the task completes on its own surface. */}
                  <span
                    aria-hidden
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border"
                    style={{ borderColor: 'var(--sn-ink-400)' }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {task.label}
                  </span>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold"
                    style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-800)' }}
                  >
                    {task.dueChip}
                  </span>
                  <ArrowRight
                    className="h-3.5 w-3.5 shrink-0 text-ink/35 transition-colors group-hover:text-[var(--sn-gold-600)]"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4 · UPCOMING SCHEDULES — next 5 booked events (`.sn-tile` panel + `.sn-row`
//     rows with obsidian mono date blocks).
// ---------------------------------------------------------------------------

/** Split a YYYY-MM-DD into the date-block parts (JUL / 05 / Sun). */
function dateBlock(iso: string): { month: string; day: string; weekday: string } {
  const d = new Date(`${iso}T00:00:00`);
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: d.toLocaleDateString('en-US', { day: '2-digit' }),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
  };
}

function inDaysLabel(n: number): string {
  if (n <= 0) return 'today';
  if (n === 1) return 'in 1 day';
  return `in ${n} days`;
}

export function UpcomingSchedules({ rows }: { rows: UpcomingEventRow[] }) {
  return (
    <section>
      <SectionHeader
        title="Upcoming schedules"
        subtitle="Next 5"
        action={
          <Link
            href="/vendor-dashboard/calendar"
            className="text-xs font-semibold hover:underline"
            style={{ color: 'var(--sn-gold-700)' }}
          >
            Open calendar
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyCard text="No booked events yet. Once a couple books you, your next dates show here." />
      ) : (
        <div className="sn-tile p-2 sm:p-2.5">
          <ul className="space-y-1.5">
            {rows.map((row) => {
              const block = dateBlock(row.date);
              return (
                <li key={row.id} className="sn-row group flex items-center gap-2 p-2.5">
                  <Link
                    href={row.href}
                    className="flex min-w-0 flex-1 items-center gap-4 transition-transform group-hover:translate-x-0.5"
                  >
                    <span
                      className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl"
                      style={{ background: 'var(--sn-ink-900)', color: 'var(--sn-gold-100)' }}
                    >
                      <span
                        className="font-mono text-[10px] font-bold tracking-wider"
                        style={{ color: 'var(--sn-gold-300)' }}
                      >
                        {block.month}
                      </span>
                      <span className="font-mono text-lg font-bold leading-none">
                        {block.day}
                      </span>
                      <span className="font-mono text-[9px]" style={{ color: 'rgba(243,236,223,.5)' }}>
                        {block.weekday}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {row.eventName}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink/55">
                        {metaLine([row.place, row.category]) || 'Booked event'}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs font-semibold text-ink/45">
                      {inDaysLabel(row.inDays)}
                    </span>
                  </Link>
                  {/*
                    THE CONVERSATION IS STILL ONE TAP AWAY. The row itself now
                    opens the customer card — the booking's money, brief and
                    next steps — which is what the owner asked for; some
                    suppliers still want the chat, and taking it away to give
                    them the card would just move the complaint. Rendered only
                    when the row is NOT already the thread (the no-card
                    fallback), so the same destination is never offered twice.
                    ⚠ A sibling, not a child: an <a> inside an <a> is invalid
                    HTML and the inner one is what stops working.
                  */}
                  {row.threadHref && row.threadHref !== row.href ? (
                    <Link
                      href={row.threadHref}
                      aria-label={`Message ${row.eventName}`}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors hover:text-ink"
                      style={{ borderColor: 'var(--sn-line)' }}
                    >
                      <MessageSquare aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Message
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  count,
  subtitle,
  action,
}: {
  title: string;
  count?: number;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="flex items-baseline gap-2">
        <span className="sn-sec">
          {spark}
          {title}
        </span>
        {typeof count === 'number' && count > 0 ? (
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[11px] font-bold"
            style={{ background: 'var(--sn-ink-900)', color: 'var(--sn-gold-100)' }}
          >
            {count}
          </span>
        ) : null}
        {subtitle ? <span className="sn-sec-sub">{subtitle}</span> : null}
      </h2>
      {action}
    </div>
  );
}

function EmptyCard({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <div
      className="flex items-start gap-3 rounded-2xl border border-dashed p-5 text-sm text-ink/60"
      style={{ borderColor: 'var(--sn-line)' }}
    >
      {icon ?? (
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0"
          strokeWidth={1.5}
          style={{ color: 'var(--sn-ink-400)' }}
          aria-hidden
        />
      )}
      <p>{text}</p>
    </div>
  );
}
