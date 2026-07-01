import Link from 'next/link';
import { AlertTriangle, ArrowRight, Coins, Star } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import type {
  OngoingTask,
  UpcomingEventRow,
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
        <span className="text-lg font-semibold" style={{ color: 'var(--m-ink)' }}>
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
