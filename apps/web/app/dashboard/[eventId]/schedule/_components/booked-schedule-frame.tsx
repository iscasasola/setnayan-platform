'use client';

/**
 * 📅 SUPPLIERS › BOOKED › SCHEDULE — ONE LINE, ONE DATE LINE, THEN THE MOMENTS.
 *
 * Owner 2026-10-31, live iPhone, verbatim: *"so many design error on schedule. the pop up. design template. how the
 * space is strategically used. so many upper space not used."* At rest the Schedule stacked SEVEN rows before its
 * first moment (the segmented Find | Build | Booked, `Schedule ▾ · 3 moments`, the couple's names and the date, "● You
 * can edit ⓘ", the Journey | Preparation | Event Day segmented, "ⓘ Announce", "+ Add to schedule", a tinted "fills in
 * automatically" band). The approved final Suppliers design (frames 19 · 19b · 20) draws, under the page's one row:
 *
 *   [Event Day ▾]  …the day's tools…  (🔊)      ONE line: the view (a dropdown) · Announce, a round on the right
 *   Friday 18 December 2026 · 50 days to go ⓘ   the date line — who can edit, the couple's names and what feeds the
 *                                               agenda are INSIDE the ⓘ (house rule: title + one short line visible)
 *   the moments, right there                    "+ Add a moment" / "+ Add a step" is the pill in the thumb zone
 *
 * The views are Event Day · Preparation · Journey (Journey has no other home — Home's door to it lands here — so it
 * stays, third, nothing lost). Every view is drawn by the server ONCE, with the page's one read, and kept: a pick
 * swaps what is shown in place — no request, no render — and writes `?view=` so a reload and Back come back to it.
 * 🔒 lib/the-schedule-under-booked-is-one-line.test.ts
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Tip } from './day-ui';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { ScheduleViewOnScreen } from './schedule-sheet';

export type BookedScheduleView = 'event-day' | 'preparation' | 'journey';

import { BOOKED_SCHEDULE_TOOLS_SLOT } from './booked-schedule-slot';

export function BookedScheduleFrame({
  initial,
  views,
  dateLine,
  info,
  notes,
  announce,
  meetings,
  panels,
}: {
  initial: BookedScheduleView;
  /** In the dropdown's order, each with its count (the open list's trailing number). */
  views: ReadonlyArray<{ key: BookedScheduleView; label: string; count: number }>;
  /** "Friday 18 December 2026 · 50 days to go" — the ⓘ's label. */
  dateLine: string;
  /** What the ⓘ always says: whose day, who can edit and why. */
  info: ReactNode;
  /** What the ⓘ adds for the view on screen. */
  notes: Partial<Record<BookedScheduleView, ReactNode>>;
  /** Announce, as its round — null when this person cannot announce. */
  announce: ReactNode | null;
  /** The supplier meetings, above Preparation and Journey (never above the day itself). */
  meetings?: ReactNode;
  panels: Record<BookedScheduleView, ReactNode>;
}) {
  const [view, setView] = useState<BookedScheduleView>(initial);
  // `?view=` changed by Back/Forward (a pick only replaces it) — follow it.
  useEffect(() => {
    const onPop = () => {
      const v = new URLSearchParams(window.location.search).get('view');
      if (v === 'event-day' || v === 'preparation' || v === 'journey') setView(v);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const pick = (key: string) => {
    if (key !== 'event-day' && key !== 'preparation' && key !== 'journey') return;
    if (key === view) return;
    setView(key);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('view', key);
      window.history.replaceState(window.history.state, '', url);
    } catch {
      // No history — the view still swaps, client-only.
    }
    window.scrollTo({ top: 0 });
  };
  const current = views.find((v) => v.key === view) ?? views[0];

  return (
    <ScheduleViewOnScreen.Provider value={view}>
      <div data-booked-schedule={view}>
        {/* ── THE ONE LINE: the view ▾ · the day's own tools (Event Day only) · 🔊 Announce. */}
        <div className="flex min-h-11 items-center gap-1.5" data-schedule-line="">
          <span className="flex min-w-0 shrink items-center">
            <PickMenu
              label="Schedule view"
              value={view}
              buttonText={current?.label}
              options={views.map((v) => ({
                key: v.key,
                label: v.label,
                trail: v.count > 0 ? { text: String(v.count), tone: 'muted' as const } : undefined,
              }))}
              onPick={pick}
              dataAttr="data-schedule-view"
              compact
            />
          </span>
          {/* The day's tools are the Event Day's only: `hidden` as a CLASS — a `flex` class beats the attribute. */}
          <span
            id={BOOKED_SCHEDULE_TOOLS_SLOT}
            hidden={view !== 'event-day'}
            className={view === 'event-day' ? 'ml-auto flex min-w-0 items-center' : 'hidden'}
            data-schedule-tools-slot=""
          />
          {announce ? <span className={`flex shrink-0 items-center${view !== 'event-day' ? ' ml-auto' : ''}`}>{announce}</span> : null}
        </div>

        {/* ── THE DATE LINE — everything else about the day is inside its ⓘ. */}
        <p className="mt-1 flex items-center gap-2 text-[13px] text-ink/60" data-schedule-date-line="">
          <span>{dateLine}</span>
          <Tip>
            <span className="block space-y-1.5">
              {info}
              {notes[view] ? <span className="block">{notes[view]}</span> : null}
            </span>
          </Tip>
        </p>

        {/* ── THE VIEWS, each drawn once and kept; the moments start right here. */}
        <div className="mt-3">
          {meetings ? <div hidden={view === 'event-day'}>{meetings}</div> : null}
          {(Object.keys(panels) as BookedScheduleView[]).map((k) => (
            <div key={k} hidden={k !== view} data-schedule-panel={k}>
              {panels[k]}
            </div>
          ))}
        </div>
      </div>
    </ScheduleViewOnScreen.Provider>
  );
}
