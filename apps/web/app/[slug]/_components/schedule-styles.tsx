'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

/**
 * THE SCHEDULE'S OTHER TWO STYLES — One chapter per screen and Clock face
 * (prototype `every_scene_three_styles_2026-09-29.html` §5). They carry the
 * Post Event's NAMES and ids (`one-per-screen`, `clock-face`), so one pick
 * carries across stages. A · Programme rail is `ScheduleWidget` itself.
 *
 * 🔒 NOTHING IS DECIDED HERE. `ScheduleWidget` orders the blocks, reads the
 * clock after mount, picks "Happening now" / "Up next" (the run-of-show
 * trigger or the wall clock) and formats every time; it hands this file the
 * result. So a style can never disagree with the rail about what is live —
 * they are one computation drawn three ways. The heading, the "Estimated
 * program" line and the live run-of-show header stay the widget's, above
 * every style.
 */

export type ScheduleMomentView = {
  id: string;
  /** The widget's own time label (viewer-local after mount, event-local before). */
  timeLabel: string;
  /** "Ceremony", "Reception" — the block's kind, in the event type's words. */
  kindLabel: string;
  label: string;
  location: string | null;
  notes: string | null;
  /** The block's start as event-local minutes after midnight (0–1439), or null. */
  minuteOfDay: number | null;
};

type BodyProps = {
  moments: readonly ScheduleMomentView[];
  currentIndex: number;
  upNextIndex: number;
};

/** B · One chapter per screen — one moment fills the width; the live one is scrolled to first. */
export function ScheduleOneChapter({ moments, currentIndex, upNextIndex }: BodyProps) {
  const railRef = useRef<HTMLOListElement | null>(null);
  const focus = currentIndex >= 0 ? currentIndex : upNextIndex >= 0 ? upNextIndex : 0;
  const [at, setAt] = useState(focus);

  // The live (or next) moment opens first — scrolled to after mount, so the
  // server markup is the same list in the same order for every instant.
  useEffect(() => {
    const rail = railRef.current;
    const panel = rail?.children[focus] as HTMLElement | undefined;
    if (rail && panel) rail.scrollTo({ left: panel.offsetLeft - rail.offsetLeft });
    setAt(focus);
  }, [focus]);

  if (moments.length === 0) return null;
  const next = upNextIndex >= 0 ? moments[upNextIndex] : null;
  return (
    <div data-scene-style="one-per-screen" className="space-y-3">
      <ol
        ref={railRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const w = el.clientWidth || 1;
          setAt(Math.max(0, Math.min(moments.length - 1, Math.round(el.scrollLeft / w))));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto"
        aria-label="The day, one moment at a time"
      >
        {moments.map((m, i) => {
          const isNow = i === currentIndex;
          const isNext = i === upNextIndex;
          return (
            <li
              key={m.id}
              data-schedule-moment={isNow ? 'now' : isNext ? 'next' : 'later'}
              className="w-full shrink-0 snap-center px-1 py-8 text-center"
            >
              <p
                className={`font-sans text-xs uppercase tracking-[0.2em] ${isNow ? 'text-terracotta' : 'text-ink/60'}`}
              >
                {isNow ? 'Happening now' : isNext ? 'Up next' : `${i + 1} of ${moments.length}`}
              </p>
              <p className="mt-3 font-mono text-base tabular-nums text-gild">{m.timeLabel}</p>
              <p className="mt-2 font-sans text-xs uppercase tracking-[0.2em] text-ink/60">
                {m.kindLabel}
                {isNow || isNext ? ` · ${i + 1} of ${moments.length}` : ''}
              </p>
              <p className="mt-2 font-pahina text-4xl font-light leading-tight text-ink">{m.label}</p>
              {m.location ? (
                <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-ink/65">
                  <MapPin aria-hidden className="h-3.5 w-3.5 text-gild" strokeWidth={1.5} />
                  {m.location}
                </p>
              ) : null}
              {m.notes ? (
                <p className="mx-auto mt-3 max-w-xs whitespace-pre-wrap text-sm leading-relaxed text-ink/70">{m.notes}</p>
              ) : null}
              {isNow && next ? (
                <p className="mt-5 border-t border-ink/12 pt-3 text-sm text-ink/70">
                  <span aria-hidden className="mr-1.5 text-gild">✦</span>
                  Up next · {next.timeLabel} · {next.label}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="flex items-center justify-center gap-1.5" aria-hidden>
        {moments.map((m, i) => (
          <span
            key={m.id}
            className={`h-1.5 rounded-full transition-all ${i === at ? 'w-4 bg-ink/70' : i === currentIndex ? 'w-1.5 bg-terracotta' : 'w-1.5 bg-ink/20'}`}
          />
        ))}
      </div>
      {moments.length > 1 ? (
        <p className="text-center font-sans text-xs uppercase tracking-[0.2em] text-ink/60">
          Swipe for the rest of the day
        </p>
      ) : null}
    </div>
  );
}

/** Minutes after midnight → a short dial label: 900 → "3 PM", 990 → "4:30". */
export function dialTime(minute: number): string {
  const h24 = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12} ${h24 < 12 ? 'AM' : 'PM'}` : `${h12}:${String(m).padStart(2, '0')}`;
}

/** Where a moment sits on a 12-hour dial, in degrees clockwise from twelve. */
export function dialAngle(minute: number): number {
  return ((minute % 720) / 720) * 360;
}

/**
 * C · Clock face — the day around a dial. Tap a moment for where it is and
 * its notes. `handMinute` is the event-local time right now, passed only once
 * the day has begun; before that there is no hand.
 */
export function ScheduleClockFace({
  moments,
  currentIndex,
  upNextIndex,
  handMinute = null,
  centreLine = null,
}: BodyProps & { handMinute?: number | null; centreLine?: string | null }) {
  const placed = moments.filter((m) => m.minuteOfDay !== null);
  const [openId, setOpenId] = useState<string | null>(null);
  if (moments.length === 0) return null;
  const open = moments.find((m) => m.id === openId) ?? moments[currentIndex] ?? null;
  const R = 38; // % of the box, where the labels sit
  return (
    <div data-scene-style="clock-face" className="space-y-4">
      <div className="relative mx-auto aspect-square w-full max-w-[20rem]">
        <svg viewBox="0 0 100 100" aria-hidden className="absolute inset-0 h-full w-full">
          <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeOpacity="0.15" className="text-ink" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * 2 * Math.PI;
            return (
              <line
                key={i}
                x1={50 + 44 * Math.sin(a)}
                y1={50 - 44 * Math.cos(a)}
                x2={50 + 47 * Math.sin(a)}
                y2={50 - 47 * Math.cos(a)}
                stroke="currentColor"
                strokeOpacity="0.3"
                className="text-ink"
              />
            );
          })}
          {handMinute !== null ? (
            <line
              data-clock-hand
              x1="50"
              y1="50"
              x2={50 + 30 * Math.sin((dialAngle(handMinute) * Math.PI) / 180)}
              y2={50 - 30 * Math.cos((dialAngle(handMinute) * Math.PI) / 180)}
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              className="text-terracotta"
            />
          ) : null}
        </svg>
        <div className="absolute inset-[28%] flex flex-col items-center justify-center text-center">
          {centreLine ? <p className="font-pahina text-lg leading-tight text-ink">{centreLine}</p> : null}
          <p className="mt-1 font-sans text-xs uppercase tracking-[0.14em] text-ink/60">
            {moments.length} {moments.length === 1 ? 'moment' : 'moments'}
          </p>
        </div>
        {placed.map((m) => {
          const i = moments.indexOf(m);
          const a = (dialAngle(m.minuteOfDay!) * Math.PI) / 180;
          const isNow = i === currentIndex;
          const isNext = i === upNextIndex;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setOpenId(m.id)}
              aria-pressed={open?.id === m.id}
              aria-label={`${m.timeLabel} · ${m.label}`}
              style={{ left: `${50 + R * Math.sin(a)}%`, top: `${50 - R * Math.cos(a)}%` }}
              className={`absolute flex min-h-[44px] min-w-[44px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-md px-1 text-center leading-tight ${
                isNow ? 'text-terracotta' : isNext ? 'text-ink' : 'text-ink/75'
              }`}
            >
              <span className="font-mono text-xs tabular-nums">{dialTime(m.minuteOfDay!)}</span>
              <span className="max-w-[4.5rem] truncate font-sans text-xs">{m.label}</span>
            </button>
          );
        })}
      </div>
      {open ? (
        <div className="border-t border-ink/12 pt-3 text-center" aria-live="polite">
          <p className="font-mono text-sm tabular-nums text-gild">{open.timeLabel}</p>
          <p className="mt-1 font-pahina text-2xl font-light leading-snug text-ink">{open.label}</p>
          {open.location ? (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink/65">
              <MapPin aria-hidden className="h-3.5 w-3.5 text-gild" strokeWidth={1.5} />
              {open.location}
            </p>
          ) : null}
          {open.notes ? <p className="mx-auto mt-2 max-w-xs whitespace-pre-wrap text-sm text-ink/70">{open.notes}</p> : null}
        </div>
      ) : (
        <p className="text-center text-sm text-ink/65">Tap a moment for where it is and what to bring.</p>
      )}
    </div>
  );
}
