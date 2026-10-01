import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { NextCard } from '@/app/_components/next-card';
import type { SupplierNext, SupplierNextTarget } from '@/lib/supplier-today';
import type { UpcomingEventRow } from '@/lib/vendor-overview';
import { vendorBookingFeePayPath } from '@/lib/vendor-booking-fees';

/**
 * Where the one Next button goes. Written as `href:` literals ON PURPOSE — the
 * port-controls scan (`scripts/port-controls.mjs`) only sees an `href` followed
 * by a literal, which is why the host's `nextHref` is shaped the same way.
 */
function nextHref(t: SupplierNextTarget): string {
  switch (t.to) {
    case 'thread': {
      const href = `/vendor-dashboard/messages/${t.threadId}`;
      return href;
    }
    case 'card': {
      const href = `/vendor-dashboard/clients/${t.eventId}?tab=${t.tab}`;
      return href;
    }
    case 'review': {
      const href = `/vendor-dashboard/reviews#reply_${t.reviewId}`;
      return href;
    }
    case 'proposals': {
      const href = '/vendor-dashboard/proposals';
      return href;
    }
    case 'contracts': {
      const href = '/vendor-dashboard/contracts';
      return href;
    }
    case 'event-hub': {
      const href = '/vendor-dashboard/on-the-day';
      return href;
    }
    case 'fee':
      return vendorBookingFeePayPath(t.orderId);
    case 'payday': {
      const href = '/vendor-dashboard/payday';
      return href;
    }
    case 'customers': {
      const href = '/vendor-dashboard/customers';
      return href;
    }
    case 'today': {
      const href = '/vendor-dashboard#today-all';
      return href;
    }
    case 'given':
      return t.href;
  }
}

/** "3" + "Sat" for a Coming-up row, read in Manila like every date on this page. */
function dayBlock(iso: string): { day: string; weekday: string } {
  const d = new Date(`${iso}T00:00:00+08:00`);
  return {
    day: d.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', day: 'numeric' }),
    weekday: d.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'short' }),
  };
}

export type SupplierTodayFirstScreenProps = {
  /** The shop line — "Photo & video · Live" over the shop's name. */
  cover: { eyebrow: string; name: string };
  next: SupplierNext;
  /** Already worded: a count, "5+", or "—" when the read did not happen. */
  numbers: { inquiries: string; thisWeek: string; owed: string };
  /** The next three booked events (already sliced). */
  comingUp: readonly UpcomingEventRow[];
};

/**
 * 📱 THE SUPPLIER'S TODAY, FIRST SCREEN — owner-APPROVED 2026-10-01 (DECISION_LOG
 * "THE SUPPLIER PHONE APP — APPROVED, WITH THE THREE RECOMMENDED ANSWERS",
 * prototype `supplier_app_simple_2026-10-01_fable.html` frame 1).
 *
 *   shop line → ONE Next card (one button) → three numbers → Coming up (3)
 *   → "See everything" (the rest of Today, unchanged, just below).
 *
 * A server component, like the host's `HomeFirstScreen` it copies: every figure
 * arrives already read and already worded, so this adds no client weight.
 *
 * 🔒 THE NEXT CARD IS THE FIRST THING YOU CAN TAP. The shop line above it is
 * text, not a link; `the-today-page-speaks-to-every-supplier.test.ts` renders
 * this and fails if any link or button comes before the Next button.
 *
 * On a phone it fills the screen (minus the top bar and the measured dock), so
 * nothing else sits above the fold; from `lg` up the height is released.
 */
export function SupplierTodayFirstScreen({ cover, next, numbers, comingUp }: SupplierTodayFirstScreenProps) {
  return (
    <section
      data-today-first-screen
      aria-label="Today"
      className="mx-auto flex w-full max-w-xl flex-col gap-3 max-lg:min-h-[calc(100svh-var(--sn-bottomdock-h,5.5rem)-5rem)]"
    >
      <div className="rounded-2xl bg-mulberry px-4 py-3 text-cream">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-cream/75">{cover.eyebrow}</p>
        <p className="font-display text-[22px] leading-tight">{cover.name}</p>
      </div>

      {/* ① THE ONE NEXT CARD — the shared one, with exactly one button. */}
      <NextCard
        marker="data-today-next"
        kind={next.kind}
        title={next.title}
        body={next.body}
        action={next.action}
        href={nextHref(next.target)}
      />

      {/* ② THREE NUMBERS — each goes to the list it counts; "—" when unread, never 0. */}
      <div className="grid grid-cols-3 gap-2" data-today-numbers>
        <Link href="/vendor-dashboard/customers?lane=waiting#customers" className="sn-glass-bare sn-press rounded-xl px-2 py-3 text-center">
          <span className="block font-display text-[26px] leading-none text-ink">{numbers.inquiries}</span>
          <span className="mt-1 block text-[11.5px] text-ink/55">new inquiries</span>
        </Link>
        <Link href="/vendor-dashboard/calendar" className="sn-glass-bare sn-press rounded-xl px-2 py-3 text-center">
          <span className="block font-display text-[26px] leading-none text-ink">{numbers.thisWeek}</span>
          <span className="mt-1 block text-[11.5px] text-ink/55">events this week</span>
        </Link>
        <Link href="/vendor-dashboard/payday" className="sn-glass-bare sn-press rounded-xl px-2 py-3 text-center">
          <span className="block font-display text-[26px] leading-none text-ink">{numbers.owed}</span>
          <span className="mt-1 block text-[11.5px] text-ink/55">owed to you</span>
        </Link>
      </div>

      {/* ③ COMING UP — the next three booked events, each opening its customer card. */}
      <div className="sn-glass-bare rounded-2xl px-3 py-2" data-today-coming-up>
        <p className="px-1 pt-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-terracotta-700">Coming up</p>
        {comingUp.length === 0 ? (
          <p className="px-1 py-2 text-sm text-ink/55">No booked events yet.</p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {comingUp.map((row) => {
              const { day, weekday } = dayBlock(row.date);
              return (
                <li key={row.id}>
                  <Link href={row.href} className="flex items-center gap-3 px-1 py-2.5">
                    <span className="w-9 shrink-0 text-center">
                      <span className="block font-display text-[20px] leading-none text-ink">{day}</span>
                      <span className="block text-[10.5px] uppercase text-ink/50">{weekday}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[16px] text-ink">{row.eventName}</span>
                      {row.place ? <span className="block truncate text-[12.5px] text-ink/55">{row.place}</span> : null}
                    </span>
                    <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.75} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <a
        href="#today-all"
        className="mt-auto inline-flex items-center justify-center gap-1 self-center py-2 text-[13px] font-medium text-ink/55 hover:text-ink lg:hidden"
      >
        See everything
        <ChevronDown aria-hidden className="h-4 w-4" strokeWidth={2} />
      </a>
    </section>
  );
}
