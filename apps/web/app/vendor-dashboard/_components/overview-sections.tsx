import Link from 'next/link';
import { AlertTriangle, ArrowRight, Coins, Star, Inbox, ListTodo, CalendarClock, Wallet } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { ProgressRing } from '@/app/_components/progress-ring';
import { formatPhp } from '@/lib/vendors';
import type {
  OngoingTask,
  UpcomingEventRow,
  VendorEarningsSummary,
  WhatsNewCard,
} from '@/lib/vendor-overview';

/**
 * overview-sections.tsx — the presentational sections of the vendor Overview
 * (finalized 6-menu-shell prototype). Server components; the action buttons
 * post to the server actions passed down from the page. Editorial `--m-*`
 * palette throughout · white cards on the paper page bg · 12px radius ·
 * skeletal Lucide icons only.
 *
 * The feed cards carry a LEFT COLOR ACCENT keyed to the card kind (the
 * prototype's decision-feed treatment):
 *   · inquiry  → champagne gold (--m-orange) — a new lead, money-adjacent
 *   · lock     → sage green   (--m-sage-deep) — a positive commit to confirm
 *   · review   → champagne gold (--m-orange) — 5-star praise
 *   · dispute  → blush/terracotta (--m-blush-deep) — needs attention
 */

const CARD_ACCENT: Record<WhatsNewCard['kind'], string> = {
  inquiry: 'var(--m-orange)',
  lock: 'var(--m-sage-deep)',
  review: 'var(--m-orange)',
  dispute: 'var(--m-blush-deep)',
};

const CARD_EYEBROW: Record<WhatsNewCard['kind'], string> = {
  inquiry: 'New inquiry',
  lock: 'Lock request',
  review: 'New 5-star review',
  dispute: 'Delivery delay flagged',
};

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

// ---------------------------------------------------------------------------
// 0 · ENERGY STATS — the databerry-inside-editorial stat bento ("Energy, not
//     skin" 2026-07-09). Feed-derived counts (whatsNew · ongoing · upcoming)
//     use the SAME data the Overview already loaded — no new queries there.
//     The two money tiles carry REAL earnings loaded by fetchVendorEarningsSummary
//     (year-to-date paid revenue + payday confirmed-vs-expected cash-flow); when
//     that read fails, `earnings` is null and the tiles are omitted rather than
//     faked. Remaining prototype widgets with no real source on this surface
//     (response-rate ring, profile-views sparkline, aggregate rating, token
//     balance) stay deliberately omitted rather than faked.
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
  const needsYou = whatsNew.length;
  const inquiries = whatsNew.filter((c) => c.kind === 'inquiry').length;
  const reviews = whatsNew.filter((c) => c.kind === 'review').length;
  const locks = whatsNew.filter((c) => c.kind === 'lock').length;
  const disputes = whatsNew.filter((c) => c.kind === 'dispute').length;
  const nearest = upcoming[0] ?? null;

  const legend: Array<{ label: string; n: number; color: string }> = [
    { label: 'inquiries', n: inquiries, color: 'var(--m-orange)' },
    { label: 'locks', n: locks, color: 'var(--m-sage-deep)' },
    { label: 'reviews', n: reviews, color: 'var(--v-blue)' },
    { label: 'delays', n: disputes, color: 'var(--m-blush-deep)' },
  ].filter((l) => l.n > 0);

  return (
    <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {/* Hero — "what needs you today", wine-accented. */}
      <div
        className="m-card relative overflow-hidden p-5 sm:col-span-2"
        style={{ boxShadow: 'inset 3px 0 0 var(--m-nav-active), var(--m-shadow-sm)' }}
      >
        <p className="m-label-mono" style={{ color: 'var(--m-nav-active)' }}>
          What needs you today
        </p>
        <div className="mt-1 flex items-end gap-3">
          <span className="m-serif text-5xl leading-none" style={{ color: 'var(--m-ink)' }}>
            {needsYou}
          </span>
          <span className="pb-1 text-sm" style={{ color: 'var(--m-slate)' }}>
            {needsYou === 0
              ? "you're all caught up"
              : needsYou === 1
                ? 'item to act on'
                : 'items to act on'}
          </span>
        </div>
        {legend.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
            {legend.map((l) => (
              <span
                key={l.label}
                className="inline-flex items-center gap-1.5 text-xs"
                style={{ color: 'var(--m-slate)' }}
              >
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: l.color }}
                />
                <span className="font-semibold" style={{ color: 'var(--m-ink)' }}>
                  {l.n}
                </span>
                {l.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Countdown ring — nearest upcoming shoot, photography-blue accent. */}
      <div className="m-card flex items-center gap-4 p-5">
        {nearest ? (
          <>
            <ProgressRing
              pct={countdownPct(nearest.inDays)}
              size={72}
              stroke={7}
              color="var(--v-blue)"
            >
              <span className="m-serif text-lg leading-none" style={{ color: 'var(--m-ink)' }}>
                {nearest.inDays <= 0 ? '0' : nearest.inDays}
              </span>
              <span className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--m-slate-3)' }}>
                days
              </span>
            </ProgressRing>
            <div className="min-w-0">
              <p className="m-label-mono" style={{ color: 'var(--v-blue)' }}>
                Next shoot
              </p>
              <p className="mt-1 truncate text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                {nearest.eventName}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate)' }}>
                {inDaysShort(nearest.inDays)}
                {nearest.place ? ` · ${nearest.place}` : ''}
              </p>
            </div>
          </>
        ) : (
          <div>
            <p className="m-label-mono" style={{ color: 'var(--v-blue)' }}>
              Next shoot
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--m-slate)' }}>
              No booked events yet.
            </p>
          </div>
        )}
      </div>

      {/* Earnings — REAL booked revenue (fetchVendorEarningsSummary). Omitted
          when the read failed (earnings === null); ₱0 is a genuine zero-state,
          never faked. */}
      {earnings ? (
        <>
          <EarnedTile
            earnedThisYearPhp={earnings.earnedThisYearPhp}
            bookingCount={earnings.bookingCount}
          />
          <CashFlowTile
            confirmedPhp={earnings.confirmedPhp}
            expectedPhp={earnings.expectedPhp}
          />
        </>
      ) : null}

      {/* KPI row — real counts, serif numerals. */}
      <EnergyKpi
        icon={<Inbox className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
        value={inquiries}
        label="New inquiries"
        accent="var(--v-blue)"
      />
      <EnergyKpi
        icon={<ListTodo className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
        value={ongoing.length}
        label="Open tasks"
        accent="var(--m-nav-active)"
      />
      <EnergyKpi
        icon={<CalendarClock className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
        value={upcoming.length}
        label="Upcoming (next 5)"
        accent="var(--m-orange-2)"
      />
    </section>
  );
}

function EnergyKpi({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent: string;
}) {
  return (
    <div className="m-card flex items-center gap-3 p-5">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: 'var(--m-paper-2)', color: accent }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <span className="m-serif text-2xl leading-none" style={{ color: 'var(--m-ink)' }}>
          {value}
        </span>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate)' }}>
          {label}
        </p>
      </div>
    </div>
  );
}

/**
 * Earned tile — the wine-accented money hero the reskin skipped. The exact
 * year-to-date figure the /vendor-dashboard/earnings page shows (matched
 * payments on this vendor's own service categories). Whole card links to the
 * full ledger. ₱0 with `bookingCount === 0` is a genuine empty state.
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
      className="m-card group relative overflow-hidden p-5 transition-colors hover:bg-[var(--m-paper-2)] lg:col-span-2"
      style={{ boxShadow: 'inset 3px 0 0 var(--m-nav-active), var(--m-shadow-sm)' }}
    >
      <span className="flex items-center justify-between">
        <span className="m-label-mono" style={{ color: 'var(--m-nav-active)' }}>
          Earned · this year
        </span>
        <Wallet
          className="h-4 w-4"
          strokeWidth={1.75}
          aria-hidden
          style={{ color: 'var(--m-nav-active)' }}
        />
      </span>
      <span
        className="m-serif mt-1 block text-4xl leading-none sm:text-5xl"
        style={{ color: 'var(--m-ink)' }}
      >
        {formatPhp(earnedThisYearPhp)}
      </span>
      <span className="mt-2 flex items-center gap-1 text-sm" style={{ color: 'var(--m-slate)' }}>
        {bookingCount === 0
          ? 'No earnings yet — paid bookings on your services roll up here.'
          : `${bookingCount} booking${bookingCount === 1 ? '' : 's'} logged`}
        <ArrowRight
          className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100"
          strokeWidth={1.75}
          aria-hidden
        />
      </span>
    </Link>
  );
}

/**
 * Confirmed cash-flow tile — the vendor's payday timeline collapsed to a real
 * ratio: confirmed (received) vs expected (total booked) installment value
 * across all booked events. The ring encodes that genuine ratio; ₱0 / no
 * booked installments is a genuine empty state.
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
    <div className="m-card flex items-center gap-4 p-5">
      {expectedPhp > 0 ? (
        <>
          <ProgressRing pct={pct} size={72} stroke={7} color="var(--v-blue)">
            <span className="m-serif text-lg leading-none" style={{ color: 'var(--m-ink)' }}>
              {Math.round(pct)}
            </span>
            <span
              className="text-[9px] uppercase tracking-wide"
              style={{ color: 'var(--m-slate-3)' }}
            >
              %
            </span>
          </ProgressRing>
          <div className="min-w-0">
            <p className="m-label-mono" style={{ color: 'var(--v-blue)' }}>
              Confirmed cash-flow
            </p>
            <p className="mt-1 truncate text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
              {formatPhp(confirmedPhp)}
            </p>
            <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--m-slate)' }}>
              of {formatPhp(expectedPhp)} booked
            </p>
          </div>
        </>
      ) : (
        <div>
          <p className="m-label-mono" style={{ color: 'var(--v-blue)' }}>
            Confirmed cash-flow
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--m-slate)' }}>
            No booked installments yet.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1 · WHAT'S NEW — the decision feed
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
    <section className="mb-8">
      <SectionHeader
        title="What's new"
        count={cards.length}
        action={
          cards.length > 0 ? (
            <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
              Mark all seen
            </span>
          ) : null
        }
      />
      {cards.length === 0 ? (
        <EmptyCard
          icon={<Star className="h-5 w-5" strokeWidth={1.5} style={{ color: 'var(--m-slate-4)' }} />}
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
    <div
      className="relative overflow-hidden rounded-xl border pl-5 pr-4 py-4"
      style={{ background: '#fff', borderColor: 'var(--m-line)' }}
    >
      {/* Left color accent */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: CARD_ACCENT[card.kind] }}
      />
      <p
        className="m-label-mono mb-1"
        style={{ color: CARD_ACCENT[card.kind] === 'var(--m-orange)' ? 'var(--m-orange-2)' : CARD_ACCENT[card.kind] }}
      >
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
      <p className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
        New customer
      </p>
      <p className="mt-0.5 text-sm" style={{ color: 'var(--m-slate)' }}>
        {meta}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={acceptInquiry}>
          <input type="hidden" name="thread_id" value={card.threadId} />
          <input type="hidden" name="return_to" value="/vendor-dashboard" />
          <SubmitButton
            pendingLabel="Accepting…"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white"
            style={{ background: 'var(--m-ink)' }}
          >
            Accept
            <span
              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.16)' }}
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
            className="inline-flex h-9 items-center rounded-lg border px-4 text-sm font-semibold"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
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
      <p className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
        {card.coupleName}
      </p>
      <p className="mt-0.5 text-sm" style={{ color: 'var(--m-slate)' }}>
        {detail}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={confirmLock}>
          <input type="hidden" name="event_id" value={card.eventId} />
          <input type="hidden" name="vendor_id" value={card.eventVendorId} />
          <SubmitButton
            pendingLabel="Confirming…"
            className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-white"
            style={{ background: 'var(--m-sage-deep)' }}
          >
            Confirm lock
          </SubmitButton>
        </form>
        <Link
          href={`/vendor-dashboard/clients/${card.eventId}`}
          className="inline-flex h-9 items-center rounded-lg border px-4 text-sm font-semibold"
          style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
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
      <p className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
        {card.coupleName}
      </p>
      {card.quote ? (
        <p className="mt-0.5 text-sm italic" style={{ color: 'var(--m-slate)' }}>
          &ldquo;{card.quote}&rdquo;
        </p>
      ) : (
        <p className="mt-0.5 text-sm" style={{ color: 'var(--m-slate)' }}>
          Left you a 5-star rating.
        </p>
      )}
      <div className="mt-3">
        <Link
          href={`/vendor-dashboard/reviews#reply_${card.reviewId}`}
          className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-white"
          style={{ background: 'var(--m-ink)' }}
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
      <p className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
        A couple flagged a delivery delay
      </p>
      <p className="mt-0.5 text-sm" style={{ color: 'var(--m-slate)' }}>
        {metaLine([card.eventName, card.label])}
      </p>
      <div className="mt-3">
        <Link
          href={`/vendor-dashboard/clients/${card.eventId}`}
          className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-white"
          style={{ background: 'var(--m-blush-deep)' }}
        >
          Open
        </Link>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// 3 · ONGOING — open tasks
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
              className="text-xs font-medium hover:underline"
              style={{ color: 'var(--m-orange-2)' }}
            >
              View all
            </Link>
          ) : null
        }
      />
      {tasks.length === 0 ? (
        <EmptyCard text="No open tasks right now. Contracts to send, deposits to confirm, and unanswered inquiries will show up here." />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border" style={{ background: '#fff', borderColor: 'var(--m-line)' }}>
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={task.href}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--m-paper-2)]"
              >
                {/* Decorative checkbox — the task completes on its own surface,
                    so this is a status marker, not an input. */}
                <span
                  aria-hidden
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border"
                  style={{ borderColor: 'var(--m-slate-4)' }}
                />
                <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--m-ink)' }}>
                  {task.label}
                </span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ background: 'var(--m-paper-2)', color: 'var(--m-slate)' }}
                >
                  {task.dueChip}
                </span>
                <span
                  className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium"
                  style={{ color: 'var(--m-slate-3)' }}
                >
                  Open
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4 · UPCOMING SCHEDULES — next 5 booked events
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
            className="text-xs font-medium hover:underline"
            style={{ color: 'var(--m-orange-2)' }}
          >
            Open calendar
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyCard text="No booked events yet. Once a couple books you, your next dates show here." />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const block = dateBlock(row.date);
            return (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="flex items-center gap-4 rounded-xl border p-3 transition-colors hover:bg-[var(--m-paper-2)]"
                  style={{ background: '#fff', borderColor: 'var(--m-line)' }}
                >
                  <span
                    className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg"
                    style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
                  >
                    <span className="text-[10px] font-semibold tracking-wider" style={{ color: 'var(--m-orange-3)' }}>
                      {block.month}
                    </span>
                    <span className="text-lg font-bold leading-none">{block.day}</span>
                    <span className="text-[10px]" style={{ color: 'var(--m-slate-4)' }}>
                      {block.weekday}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                      {row.eventName}
                    </span>
                    <span className="mt-0.5 block truncate text-xs" style={{ color: 'var(--m-slate)' }}>
                      {metaLine([row.place, row.category]) || 'Booked event'}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium" style={{ color: 'var(--m-slate-3)' }}>
                    {inDaysLabel(row.inDays)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
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
        <span className="m-serif text-xl" style={{ color: 'var(--m-ink)' }}>
          {title}
        </span>
        {typeof count === 'number' && count > 0 ? (
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
          >
            {count}
          </span>
        ) : null}
        {subtitle ? (
          <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            {subtitle}
          </span>
        ) : null}
      </h2>
      {action}
    </div>
  );
}

function EmptyCard({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-dashed p-5 text-sm"
      style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
    >
      {icon ?? (
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0"
          strokeWidth={1.5}
          style={{ color: 'var(--m-slate-4)' }}
          aria-hidden
        />
      )}
      <p>{text}</p>
    </div>
  );
}
