'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { SeatPlanSlot } from './seat-plan-slots';
import type { SeatView } from '@/lib/guests-views';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * 🗂 R4 · GUESTS › SEATS HOLDS THE SEAT PLAN'S THREE PARTS (owner 2026-10-27/28, DECISION_LOG "GUESTS = LIST · MAP ·
 * SEATS · MARCH"; Q7/Q8 "3D plan: yes, inside Seats").
 *
 * The seating editor is ONE component with ONE state (`seating-editor.tsx`): its plan is the middle, and it draws its
 * own lists into the two other parts through `SeatPlanPortal` — the place's elements (`place`) and the guests
 * (`guests`). In the Maker those parts were the Maker's columns. Here they are this view's — the SAME slots
 * (`seat-plan-slots.tsx`), so nothing about the editor is forked:
 *
 *   ≥ 1024  place · plan · guests — the Maker's three columns, as they were;
 *   768–1023  plan · guests (the place's rows are a convenience — a tap on the plan picks the same thing);
 *   ≤ 767  the plan fills the view; the guests are the editor's own pull-up sheet (the Studio's approved phone seat
 *          plan, `seat-plan-phone.tsx`), so no slot is drawn and none is needed.
 *
 * The view owns its height (no document scroll, the seat plan's long-standing rule): from its top to the bottom dock
 * (`--sn-bottomdock-h`, which the dock measures and publishes; 0 on a desk, where the rail is the offset).
 */
export function SeatPlanInGuests({ children, seat }: { children: ReactNode; seat: SeatView | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setTop(Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY)));
    measure();
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => {
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      data-seat-plan-guests={seat ?? 'plan'}
      className="flex min-h-[420px] min-w-0 overflow-hidden"
      style={{ height: top === null ? '70dvh' : `calc(100dvh - ${top}px - var(--sn-bottomdock-h, 0px))` }}
    >
      {/* On a phone neither slot is drawn — the guests are the editor's own sheet there, and the place's rows are
          what a tap on the plan picks; from 768 the guests column is the right part, from 1024 the place is the left. */}
      <SeatPlanSlot name="place" className="hidden min-h-0 w-60 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-ink/10 p-2 lg:flex" />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      <SeatPlanSlot name="guests" className="hidden min-h-0 w-80 shrink-0 flex-col overflow-y-auto border-l border-ink/10 md:flex" />
    </div>
  );
}
