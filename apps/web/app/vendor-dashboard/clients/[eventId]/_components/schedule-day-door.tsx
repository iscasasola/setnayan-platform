'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { clientScheduleDayHref, SCHEDULE_DAY_EVENT, SCHEDULE_DAY_PARAM } from '@/lib/upcoming-schedule-door';
import { usePickedNav } from './picked-client-nav';

/**
 * 📅 A date on a chat card that opens this client's Schedule ON that day (owner 18 Nov 2026: "Chat gets no calendar; its
 * dates open Schedule › that day"). Inside the picked client it switches in place — the day is written to the URL and
 * handed to the strip, no request; anywhere else (the routed thread page) it is a plain link to the same place.
 */
export function ScheduleDayDoor({ eventId, day, children }: { eventId: string; day: string | null; children: ReactNode }) {
  const nav = usePickedNav();
  if (!day) return <>{children}</>;
  return (
    <Link
      href={clientScheduleDayHref(eventId, day)}
      scroll={false}
      onClick={(e) => {
        if (!nav) return;
        e.preventDefault();
        try {
          const url = new URL(window.location.href);
          url.searchParams.set(SCHEDULE_DAY_PARAM, day);
          window.history.replaceState(null, '', url.toString());
        } catch {
          /* the day still reaches the strip below */
        }
        nav.select('schedule');
        window.dispatchEvent(new CustomEvent(SCHEDULE_DAY_EVENT, { detail: day }));
      }}
      className="font-semibold text-sn-accent underline underline-offset-2"
      data-schedule-day-door={day}
    >
      {children}
    </Link>
  );
}
