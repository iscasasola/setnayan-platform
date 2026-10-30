'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { SeatPlanSlot } from './seat-plan-slots';
import type { SeatView } from '@/lib/guests-views';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** A side list on the full surface starts under the floating pinned row (its measured height) — a margin, so its own sticky head sticks under the row too. */
const UNDER_THE_ROW = 'mt-[var(--gs-stick-h,0px)]';

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
 *
 * 🗺 On 2D and 3D the Guests screen hands it a FULL SURFACE (`data-guests-full-surface`, owner 2026-10-30, *"They are all
 * full screen"*): the surface already runs from under the top nav to the bottom nav, edge to edge, so the view simply
 * fills it — no height of its own, no bleed of its own (the surface took the gutters).
 */
export function SeatPlanInGuests({ children, seat }: { children: ReactNode; seat: SeatView | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);
  /* 📐 Full-bleed on a phone (owner 2026-10-29, *"always maximize the screen use"*): the plan takes the page's side
     gutters too — the column's own edges, measured, never a guessed number; from 768 it keeps the column (the side panel
     beside it uses the width). */
  const [bleed, setBleed] = useState<{ l: number; r: number }>({ l: 0, r: 0 });
  /** Inside the Guests screen's full surface (2D · 3D): fill it. */
  const [fill, setFill] = useState(false);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (el.offsetParent === null) return; // hidden (another Guests view is showing) — measured again when shown
      const inSurface = el.closest('[data-guests-full-surface]') !== null;
      setFill(inSurface);
      if (inSurface) {
        setBleed({ l: 0, r: 0 });
        return;
      }
      setTop(Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY)));
      const col = el.parentElement?.getBoundingClientRect();
      const phone = window.innerWidth < 768;
      setBleed(phone && col ? { l: Math.max(0, Math.round(col.left)), r: Math.max(0, Math.round(window.innerWidth - col.right)) } : { l: 0, r: 0 });
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
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
      style={{
        height: fill ? '100%' : top === null ? '70dvh' : `calc(100dvh - ${top}px - var(--sn-bottomdock-h, 0px))`,
        marginLeft: bleed.l ? -bleed.l : undefined,
        marginRight: bleed.r ? -bleed.r : undefined,
      }}
    >
      {/* On a phone neither slot is drawn — the guests are the editor's own sheet there, and the place's rows are
          what a tap on the plan picks; from 768 the guests column is the right part, from 1024 the place is the left. */}
      {/* 🗺 On the full surface the pinned row floats over the top of all three parts — the side lists start under it
          (`--gs-stick-h`, the row's measured height); the plan in the middle runs under it, it is the background. */}
      <SeatPlanSlot name="place" className={`hidden min-h-0 w-60 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-ink/10 p-2 lg:flex ${fill ? UNDER_THE_ROW : ''}`} />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      <SeatPlanSlot name="guests" className={`hidden min-h-0 w-80 shrink-0 flex-col overflow-y-auto border-l border-ink/10 md:flex ${fill ? UNDER_THE_ROW : ''}`} />
    </div>
  );
}
