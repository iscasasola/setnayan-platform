'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { customerCardHref } from '@/lib/upcoming-schedule-door';
import { priceDueText } from '@/lib/price-summary';
import { paidOfWords, type QuotePlanLine } from '@/lib/quote-top-lines';
import { usePickedNav } from './picked-client-nav';

/**
 * 🧾 Under a booked client's quote (owner 18 Nov 2026): "Paid N of M · Next due <day> ›" → Payment (switched in place, no
 * request), and "Who it counts · <rule> · N" for a per-head booking. Words and counts come from `lib/quote-top-lines.ts`.
 */
export function QuoteTopLines({
  eventId,
  plan,
  count,
}: {
  eventId: string;
  plan: QuotePlanLine;
  /** The couple's rule for this booking in their words, and how many it counts. Null = not priced per head (no line). */
  count: { rule: string; counted: number } | null;
}) {
  const nav = usePickedNav();
  if (plan === null && count === null) return null;
  const door = (body: ReactNode) =>
    nav ? (
      <button type="button" onClick={() => nav.select('payments')} className={DOOR} data-quote-paid-door="">
        {body}
      </button>
    ) : (
      <Link href={customerCardHref(eventId, 'payments')} className={DOOR} data-quote-paid-door="">
        {body}
      </Link>
    );
  return (
    <div className="space-y-2 px-4 pt-4" data-quote-top-lines="">
      {plan === 'unread' ? (
        <p role="status" className="text-sm text-ink/70" data-quote-paid="unread">
          The payment plan couldn&rsquo;t load just now — the quote below is unaffected.
        </p>
      ) : plan ? (
        door(
          <>
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink" data-quote-paid={`${plan.paid}/${plan.total}`}>
              {paidOfWords(plan)}
            </span>
            {plan.nextDue ? <span className="flex-none text-[13px] font-semibold text-sn-accent">Next due {priceDueText(plan.nextDue)}</span> : null}
            <ChevronRight aria-hidden className="h-4 w-4 flex-none text-ink/70" />
          </>,
        )
      ) : null}
      {count ? (
        <p className="flex min-h-11 flex-wrap items-center gap-x-2 text-sm text-ink/70" data-quote-counts={count.counted}>
          <span>Who it counts</span>
          <span className="rounded-full bg-ink/[0.06] px-2.5 py-0.5 text-[13px] font-semibold text-ink">
            {count.rule} · {count.counted}
          </span>
        </p>
      ) : null}
    </div>
  );
}

const DOOR = 'sn-press flex min-h-11 w-full items-center gap-2 rounded-xl bg-ink/[0.04] px-3.5 py-2 text-left';
