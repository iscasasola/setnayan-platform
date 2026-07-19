'use client';

import { useState } from 'react';
import { CalendarRange, Info } from 'lucide-react';
import { setPapicWindow } from './actions';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  isTravelEventType,
  manilaDate,
  inclusiveDays,
  resolvePapicWindow,
} from '@/lib/papic-window';

/**
 * Papic CAPTURE WINDOW picker (owner 2026-06-26). The couple picks a start
 * (day + time) and an end DAY; the end TIME is auto-set (end-of-day). The chosen
 * span drives BOTH the price (cameras × rate/day × DAYS) and how long every
 * camera can shoot. Event-type rules (mirrored from lib/papic-window.ts):
 *   • travel  — free range: day 1 → end date of the trip.
 *   • else    — anchored to the event date: covers the day, extend BEFORE it
 *               (capture the prep), never AFTER. The end day is pinned.
 *
 * Pure client preview via resolvePapicWindow (no server-only imports); the
 * server action re-validates with the same resolver before saving.
 */
export default function PapicWindowPicker({
  eventId,
  eventType,
  eventDate,
  windowStart,
  windowEnd,
  windowIsSet,
  days,
  summary,
}: {
  eventId: string;
  eventType: string | null;
  eventDate: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  windowIsSet: boolean;
  days: number;
  summary: string;
}) {
  const travel = isTravelEventType(eventType);
  const anchor = manilaDate(eventDate); // pinned end for non-travel

  // Seed from the saved window, else from the event date.
  const seedStartDate = windowStart ? windowStart.slice(0, 10) : anchor ?? '';
  const seedStartTime = windowStart ? windowStart.slice(11, 16) : '14:00';
  const seedEndDate = windowEnd
    ? windowEnd.slice(0, 10)
    : travel
      ? anchor ?? ''
      : anchor ?? '';

  const [startDate, setStartDate] = useState(seedStartDate);
  const [startTime, setStartTime] = useState(seedStartTime || '14:00');
  const [endDate, setEndDate] = useState(seedEndDate);

  // For non-travel the end is always the event day, regardless of the field.
  const effectiveEnd = travel ? endDate : anchor ?? endDate;

  const preview = resolvePapicWindow({
    eventType,
    eventDate,
    startDate,
    startTime,
    endDate: effectiveEnd,
  });
  const previewDays = preview.ok
    ? preview.window.days
    : inclusiveDays(startDate, effectiveEnd);

  const errorText = !preview.ok
    ? preview.error === 'start_after_end'
      ? 'The end date is before the start date.'
      : preview.error === 'end_after_event_date'
        ? `Capture has to cover your event day — start on or before ${anchor ?? 'the event date'}.`
        : preview.error === 'missing_event_date'
          ? 'Set your event date first, then choose a window.'
          : 'Pick a start date.'
    : null;

  return (
    <div className="rounded-xl border border-terracotta/30 bg-cream/80 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <CalendarRange
              aria-hidden
              className="h-4 w-4 text-terracotta"
              strokeWidth={1.75}
            />
            Capture window
          </p>
          <p className="max-w-prose text-xs text-ink/60">
            {travel
              ? 'Day 1 to the last day of your trip. The window sets your price and how long every camera can shoot.'
              : 'When your cameras open and close. Start earlier to capture the prep — it ends on your event day. The window sets your price and how long cameras shoot.'}
          </p>
        </div>
        {windowIsSet ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-100 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-success-900">
            {summary || `${days} day${days === 1 ? '' : 's'}`}
          </span>
        ) : null}
      </div>

      <form action={setPapicWindow} className="mt-4 space-y-3">
        <input type="hidden" name="event_id" value={eventId} />
        {!travel ? (
          <input type="hidden" name="end_date" value={anchor ?? ''} readOnly />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink/70">Start day</span>
            <input
              type="date"
              name="start_date"
              value={startDate}
              max={travel ? undefined : anchor ?? undefined}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink/70">Start time</span>
            <input
              type="time"
              name="start_time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm text-ink"
            />
          </label>
        </div>

        {travel ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink/70">End day</span>
            <input
              type="date"
              name="end_date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm text-ink"
            />
            <span className="text-[11px] text-ink/45">
              Cameras run to the end of this day.
            </span>
          </label>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-ink/55">
            <Info aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Ends on your event day{anchor ? ` (${anchor})` : ''} — cameras run to
            the end of that day.
          </p>
        )}

        {errorText ? (
          <p className="text-xs text-amber-700">{errorText}</p>
        ) : (
          <p className="text-xs text-ink/55">
            {previewDays} day{previewDays === 1 ? '' : 's'} of capture — your
            camera prices below update to match.
          </p>
        )}

        <SubmitButton
          pendingLabel="Saving…"
          disabled={!preview.ok}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5 hover:text-ink disabled:opacity-50"
        >
          {windowIsSet ? 'Update window' : 'Set window'}
        </SubmitButton>
      </form>
    </div>
  );
}
