import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Coins,
  Star,
  Inbox,
  ListTodo,
  CalendarClock,
  Wallet,
  Store,
  Zap,
} from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { ProgressRing } from '@/app/_components/progress-ring';
import { CountUp } from '@/app/_components/count-up';
import { formatPhp } from '@/lib/vendors';
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
 * The feed cards carry a LEFT COLOR ACCENT keyed to the card kind, now mapped
 * to the warm semantics:
 *   · inquiry  → gold (--sn-gold-500)   — a new lead, money-adjacent
 *   · lock     → success (--sn-success) — a positive commit to confirm
 *   · review   → gold (--sn-gold-500)   — 5-star praise
 *   · dispute  → danger (--sn-danger)   — needs attention
 */

const CARD_ACCENT: Record<WhatsNewCard['kind'], string> = {
  inquiry: 'var(--sn-gold-500)',
  lock: 'var(--sn-success)',
  review: 'var(--sn-gold-500)',
  dispute: 'var(--sn-danger)',
};

/** Eyebrow tint per kind — gold for money-adjacent, warm semantics for status. */
const CARD_EYE_COLOR: Record<WhatsNewCard['kind'], string> = {
  inquiry: 'var(--sn-gold-700)',
  lock: 'var(--sn-success)',
  review: 'var(--sn-gold-700)',
  dispute: 'var(--sn-danger)',
};

const CARD_EYEBROW: Record<WhatsNewCard['kind'], string> = {
  inquiry: 'New inquiry',
  lock: 'Lock request',
  review: 'New 5-star review',
  dispute: 'Delivery delay flagged',
};

/** A small gold diamond that leads a section head (matches the event surface). */
const spark = (
  <span
    aria-hidden
    className="mr-2 inline-block h-1.5 w-1.5 rotate-45 align-middle"
    style={{ background: 'var(--sn-gold-500)' }}
  />
);

/** "Jul 5" style short date. */
function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  });
}

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
        ? 'Your next shoot is on the books.'
        : 'Your shop is all set for now.';

  return (
    <section aria-label={`Today at ${businessName}`} className="!mt-6">
      <div className="sn-tile-dark sn-bloom relative overflow-hidden">
        <span className="sn-veil" aria-hidden />
        <span className="sn-capiz" aria-hidden />
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
                Next · {shortDate(nextBooking.date)}
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
      {/* Countdown ring — nearest upcoming shoot (gold sweep). */}
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
                Next shoot
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
              Next shoot
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
        />
      ) : null}

      {/* Earned — the money doorway to the full ledger (real YTD, mono ₱). */}
      {earnings ? (
        <EarnedTile
          earnedThisYearPhp={earnings.earnedThisYearPhp}
          bookingCount={earnings.bookingCount}
        />
      ) : null}

      {/* KPI row — real counts, Space-Mono numerals, count-up. */}
      <EnergyKpi
        icon={<Inbox className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
        value={inquiries}
        label="New inquiries"
      />
      <EnergyKpi
        icon={<ListTodo className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
        value={ongoing.length}
        label="Open tasks"
      />
      <EnergyKpi
        icon={<CalendarClock className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
        value={upcoming.length}
        label="Upcoming · next 5"
      />
    </section>
  );
}

function EnergyKpi({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="sn-tile sn-reveal">
      <p className="sn-eye">
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-700)' }}
        >
          {icon}
        </span>
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-bold leading-none text-ink">
        <CountUp value={value} delayMs={200} />
      </p>
    </div>
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
}: {
  earnedThisYearPhp: number;
  bookingCount: number;
}) {
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
          ? 'Paid bookings roll up here.'
          : `${bookingCount} booking${bookingCount === 1 ? '' : 's'} logged`}
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
}: {
  confirmedPhp: number;
  expectedPhp: number;
}) {
  const pct = expectedPhp > 0 ? (confirmedPhp / expectedPhp) * 100 : 0;
  return (
    <div className="sn-tile sn-reveal flex items-center gap-3.5">
      {expectedPhp > 0 ? (
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
}: {
  cards: WhatsNewCard[];
  acceptInquiry: (formData: FormData) => void | Promise<void>;
  declineInquiry: (formData: FormData) => void | Promise<void>;
  confirmLock: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <section id="whats-new" className="mb-8 scroll-mt-24">
      <SectionHeader
        title="What's new"
        count={cards.length}
        action={
          cards.length > 0 ? (
            <span className="text-xs text-ink/45">Mark all seen</span>
          ) : null
        }
      />
      {cards.length === 0 ? (
        <EmptyCard
          icon={<Star className="h-5 w-5" strokeWidth={1.5} style={{ color: 'var(--sn-ink-400)' }} />}
          text="You're all caught up. New inquiries, lock requests, reviews, and any flagged delays will land here."
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
}: {
  card: WhatsNewCard;
  acceptInquiry: (formData: FormData) => void | Promise<void>;
  declineInquiry: (formData: FormData) => void | Promise<void>;
  confirmLock: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <div className="sn-card relative overflow-hidden py-4 pl-5 pr-4">
      {/* Left color accent — warm-semantic per kind. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: CARD_ACCENT[card.kind] }}
      />
      <p className="sn-eye mb-1" style={{ color: CARD_EYE_COLOR[card.kind] }}>
        {CARD_EYEBROW[card.kind]}
      </p>

      {card.kind === 'inquiry' ? (
        <InquiryBody
          card={card}
          acceptInquiry={acceptInquiry}
          declineInquiry={declineInquiry}
        />
      ) : card.kind === 'lock' ? (
        <LockBody card={card} confirmLock={confirmLock} />
      ) : card.kind === 'review' ? (
        <ReviewBody card={card} />
      ) : (
        <DisputeBody card={card} />
      )}
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
  const meta = metaLine([
    card.eventName,
    shortDate(card.eventDate),
    card.place,
    card.category,
  ]);
  return (
    <>
      <p className="text-sm font-semibold text-ink">New customer</p>
      <p className="mt-0.5 font-mono text-xs text-ink/60">{meta}</p>
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
            <span
              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[11px] font-bold"
              style={{ background: 'rgba(203,167,102,0.28)', color: 'var(--sn-gold-100)' }}
            >
              <Coins className="h-3 w-3" strokeWidth={2} aria-hidden />
              {card.tokenCost}
            </span>
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

function LockBody({
  card,
  confirmLock,
}: {
  card: Extract<WhatsNewCard, { kind: 'lock' }>;
  confirmLock: (formData: FormData) => void | Promise<void>;
}) {
  const detail = metaLine([
    'Downpayment received',
    card.eventDate ? `${shortDate(card.eventDate)} wedding` : null,
  ]);
  return (
    <>
      <p className="text-sm font-semibold text-ink">{card.coupleName}</p>
      <p className="mt-0.5 text-sm text-ink/60">{detail}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={confirmLock}>
          <input type="hidden" name="event_id" value={card.eventId} />
          <input type="hidden" name="vendor_id" value={card.eventVendorId} />
          <SubmitButton
            pendingLabel="Confirming…"
            className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-white"
            style={{ background: 'var(--sn-success)' }}
          >
            Confirm lock
          </SubmitButton>
        </form>
        <Link
          href={`/vendor-dashboard/clients/${card.eventId}`}
          className="inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold text-ink"
          style={{ borderColor: 'var(--sn-line)' }}
        >
          View
        </Link>
      </div>
    </>
  );
}

function ReviewBody({ card }: { card: Extract<WhatsNewCard, { kind: 'review' }> }) {
  return (
    <>
      <p className="text-sm font-semibold text-ink">{card.coupleName}</p>
      {card.quote ? (
        <p className="mt-0.5 text-sm italic text-ink/60">&ldquo;{card.quote}&rdquo;</p>
      ) : (
        <p className="mt-0.5 text-sm text-ink/60">Left you a 5-star rating.</p>
      )}
      <div className="mt-3">
        <Link
          href={`/vendor-dashboard/reviews#reply_${card.reviewId}`}
          className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-white"
          style={{ background: 'var(--sn-ink-900)' }}
        >
          Reply
        </Link>
      </div>
    </>
  );
}

function DisputeBody({ card }: { card: Extract<WhatsNewCard, { kind: 'dispute' }> }) {
  return (
    <>
      <p className="text-sm font-semibold text-ink">
        A couple flagged a delivery delay
      </p>
      <p className="mt-0.5 text-sm text-ink/60">
        {metaLine([card.eventName, card.label])}
      </p>
      <div className="mt-3">
        <Link
          href={`/vendor-dashboard/clients/${card.eventId}`}
          className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-white"
          style={{ background: 'var(--sn-danger)' }}
        >
          Open
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
                    style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-700)' }}
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
    month: d.toLocaleDateString('en-PH', { month: 'short' }).toUpperCase(),
    day: d.toLocaleDateString('en-PH', { day: '2-digit' }),
    weekday: d.toLocaleDateString('en-PH', { weekday: 'short' }),
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
                <li key={row.id}>
                  <Link
                    href={row.href}
                    className="sn-row group flex items-center gap-4 p-2.5 transition-transform hover:translate-x-0.5"
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
