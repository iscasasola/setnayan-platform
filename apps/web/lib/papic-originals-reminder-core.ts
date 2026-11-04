/**
 * 📸 THE PHOTO RULE'S REMINDERS — pure, no I/O.
 *
 * ⚖ OWNER 2026-11-03 (DECISION_LOG "THE PHOTO RULE"): *"sync google drive to get original copies. after 3 months,
 * we compress to 720p download and 400px for thumbnail"* · *"3 months after the event date"* · multi-day: *"last
 * day"*. Originals are kept until 3 months after the event's LAST day; reminders go IN THE APP at day 60 / 80 / 89 of
 * that window — "Copy to Google Drive (free) or Download all". No new emails.
 *
 * 🔑 THE DATES COME FROM THE SAME TWO PLACES THE DROP USES — `eventLastDay` (the GREATEST(COALESCE(end, start),
 * start) rule `papic_events_past_fullres_clock` runs) and `FULL_RES_POST_EVENT_GRACE_DAYS` — so "kept until" on the
 * reminder can never name a different day from the one the sweep acts on.
 */
import { eventLastDay } from '@/lib/face-data-retention-core';
import { FULL_RES_POST_EVENT_GRACE_DAYS } from '@/lib/papic-fullres-drop-core';
import { PAPIC_TZ_OFFSET } from '@/lib/papic-window';

/** Days after the event's last day on which a host is reminded (owner 2026-11-03). */
export const ORIGINALS_REMINDER_DAYS = [60, 80, 89] as const;
export type OriginalsReminderDay = (typeof ORIGINALS_REMINDER_DAYS)[number];

const MS_PER_DAY = 86_400_000;

/** 'YYYY-MM-DD' + n days, on the calendar (no time zone can move it). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
}

/** Whole calendar days from `from` to `to` (both 'YYYY-MM-DD'). */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / MS_PER_DAY);
}

/** Today in Manila, 'YYYY-MM-DD'. */
export function manilaToday(nowMs: number): string {
  return new Date(nowMs + 8 * 3_600_000).toISOString().slice(0, 10);
}

/** The first day the originals may be replaced by the 720p copy — the day the drop's clock runs out. */
export function originalsKeptUntil(lastDay: string): string {
  return addDays(lastDay, FULL_RES_POST_EVENT_GRACE_DAYS);
}

export type DueOriginalsReminder = {
  /** The stage whose day has come (the LATEST one reached, so a missed run sends one notice, not a backlog). */
  stage: OriginalsReminderDay;
  /** 00:00 Manila on that stage's day — a reminder sent at or after it means this stage is done. */
  stageStartIso: string;
  /** The last day the originals are certainly kept (the day before the drop's clock runs out). */
  lastKeptDay: string;
};

/**
 * Which reminder, if any, is due for an event today. Null before day 60, and null once the window has closed (the
 * originals may already be gone — a reminder then would be false).
 */
export function dueOriginalsReminder(
  eventDate: string | null | undefined,
  eventEndDate: string | null | undefined,
  nowMs: number,
): DueOriginalsReminder | null {
  const last = eventLastDay(eventDate, eventEndDate);
  if (!last) return null;
  const day = daysBetween(last, manilaToday(nowMs));
  if (!Number.isFinite(day) || day >= FULL_RES_POST_EVENT_GRACE_DAYS) return null;
  let stage: OriginalsReminderDay | null = null;
  for (const s of ORIGINALS_REMINDER_DAYS) if (day >= s) stage = s;
  if (stage === null) return null;
  return {
    stage,
    stageStartIso: `${addDays(last, stage)}T00:00:00${PAPIC_TZ_OFFSET}`,
    lastKeptDay: addDays(originalsKeptUntil(last), -1),
  };
}

/** "Feb 12, 2027" — the day as a host reads it (en-PH). */
function formatDay(day: string): string {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

/** Title — one line, the deadline. */
export function originalsReminderTitle(due: DueOriginalsReminder): string {
  return `Original photos kept until ${formatDay(due.lastKeptDay)}`;
}

/** Body — the owner's two choices, then what stays. */
export function originalsReminderBody(eventName: string): string {
  return `${eventName}: Copy to Google Drive (free) or Download all. After that, the 720p copies stay in Memories, free, for life.`;
}

/**
 * The response header a host's Download carries when the photo came from their own Google Drive, so a screen can
 * say so ("Original quality, from your Google Drive") without a second request deciding it differently.
 */
export const ORIGINAL_SOURCE_HEADER = 'X-Setnayan-Original-Source';

/** The words a host sees beside a Download served from their Drive (owner 2026-11-03). */
export const ORIGINAL_FROM_DRIVE_LABEL = 'Original quality, from your Google Drive';
