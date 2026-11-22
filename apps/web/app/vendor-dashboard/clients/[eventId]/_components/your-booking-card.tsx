'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight, Wallet } from 'lucide-react';
import { BADGE } from '@/app/_components/price-summary';
import { customerCardHref } from '@/lib/upcoming-schedule-door';
import { YOUR_BOOKING_COVERS_UNREAD, YOUR_BOOKING_DOOR, YOUR_BOOKING_TITLE, type YourBookingView } from '@/lib/your-booking';
import { usePickedNav } from './picked-client-nav';

/**
 * 🧾 YOUR BOOKING — the supplier's OWN booking money on Details (owner 21 Nov 2026: "the quotation, payment plan,
 * status"). View only: Price · Paid · Left, the next payment and its status, what the quotation covers, and one door —
 * "Open payments" — to the shipped Book & Budget page (switched in place, no request), where the plan and its actions
 * live. Every word and figure is decided in `lib/your-booking.ts`; this only draws them.
 *
 * Never the hosts' plan: their planned amount is not drawn here, shared or not (controller, 22 Nov 2026).
 */
export function YourBookingCard({ eventId, view }: { eventId: string; view: YourBookingView }) {
  const nav = usePickedNav();
  const door = (body: ReactNode) =>
    nav ? (
      <button type="button" onClick={() => nav.select('payments')} className={DOOR} data-your-booking-door="">
        {body}
      </button>
    ) : (
      <Link href={customerCardHref(eventId, 'payments')} className={DOOR} data-your-booking-door="">
        {body}
      </Link>
    );
  return (
    <div data-your-booking="">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
        <Wallet aria-hidden className="h-4 w-4 text-terracotta" /> {YOUR_BOOKING_TITLE}
      </h2>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {view.figures.map((f) => (
          <div key={f.key} className="min-w-0" data-your-booking-figure={f.key}>
            <dd className="truncate text-lg font-semibold tabular-nums tracking-tight text-ink">{f.value}</dd>
            <dt className="text-xs text-ink/70">{f.label}</dt>
          </div>
        ))}
      </dl>
      {view.note ? (
        <p role="status" className="mt-2 text-sm text-ink/70" data-your-booking-note="">
          {view.note}
        </p>
      ) : null}
      {view.next ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-ink/10 pt-3 text-sm text-ink" data-your-booking-next="">
          <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{view.next.line}</span>
          <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] leading-none ${BADGE[view.next.tone]}`} data-your-booking-status={view.next.tone}>
            {view.next.status}
          </span>
        </p>
      ) : null}
      {view.covers === YOUR_BOOKING_COVERS_UNREAD ? (
        // The quotes read was refused: said as that, never as a quotation that covers nothing.
        <p role="status" className="mt-2 text-sm text-ink/70" data-your-booking-covers="unread">
          {view.covers}
        </p>
      ) : view.covers ? (
        <p className="mt-2 text-sm text-ink/70 [overflow-wrap:anywhere]" data-your-booking-covers="">
          <span className="text-ink/70">Covers: </span>
          <span className="text-ink">{view.covers}</span>
        </p>
      ) : null}
      <div className="mt-3">
        {door(
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">{YOUR_BOOKING_DOOR.label}</span>
              <span className="block text-[13px] text-ink/70">{YOUR_BOOKING_DOOR.line}</span>
            </span>
            <ChevronRight aria-hidden className="h-4 w-4 flex-none text-ink/70" />
          </>,
        )}
      </div>
    </div>
  );
}

const DOOR = 'sn-press flex min-h-11 w-full items-center gap-2 rounded-xl bg-ink/[0.04] px-3.5 py-2 text-left';
