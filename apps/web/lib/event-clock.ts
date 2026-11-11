/**
 * lib/event-clock.ts — THE EVENT HUB'S ONE CLOCK (owner ruling, 10 Nov 2026).
 *
 * Owner: the public Event Hub keeps its stages (Save the Date · Invitation, with RSVP only when guests reply · The
 * Day · Post Event) inside one link, and EVERY part follows ONE clock. Before this file the code had two stage
 * resolvers (`getMenuLifecyclePhase` for the dashboard, `getLifecyclePhase` for the guest page) beside about eight
 * ad-hoc date rules that disagreed by up to a day and a half — the Live tab opening at noon the day before, the wall
 * reading "coming soon" a week after the wedding, the check-in desk flipping at midnight Manila while the dashboard
 * held on to 06:00, phones deciding "is it the day?" in their own time zone.
 *
 * ── THE ONE QUESTION ─────────────────────────────────────────────────────────────────────────────────────────────
 * `eventClock` answers "which stage is this event in NOW, at the venue?" — and everything that follows from it:
 *
 *   · The Day: `[opensMs, closesMs)` — 06:00 on the event day to 06:00 the morning after the LAST day, venue time,
 *     by default (`THE_DAY_OPENS_DEFAULT_MIN` / `THE_DAY_CLOSES_DEFAULT_MIN`); the couple may move either (`hours`).
 *     The Hub, the Live tab, seats, song requests, the live wall, check-in and the supplier's "today" desk all open
 *     and close on these two instants (rulings 1 · 2).
 *   · `automatic` — the stage the date puts the event in (ruling 3: "the event date moves the stage by itself").
 *   · `pinned` — the couple's "Pick what shows" pin (`manualLaunchPhase`), which wins while it is set; `stage` is
 *     the one guests see. `backToAutomatic` says the couple must be offered the way back.
 *   · `menu` — the dashboard's Plan → Day-of → After, on the SAME window (`cleared_at` closes it early).
 *
 * 🔑 BUILT FROM, NOT BESIDE. Every number comes from `lib/day-of-mode.ts` (`theDayWindow`, `getDayOfPhase`,
 * `getMenuLifecyclePhase`) and `lib/lifecycle-stage.ts` (`getLifecyclePhase`, `manualLaunchPhase`, re-exported by `lib/invitation-widgets.ts`). This file adds
 * no arithmetic of its own — it is the one place that asks all of them the same question with the same inputs, so
 * they cannot be asked with different ones.
 *
 * 🔑 THE ZONE IS THE VENUE'S (ruling 5): `venueTimezone(event)` in `lib/event-clock.server.ts` (tz-lookup on the
 * venue's coordinates, Manila when there is no venue). This module is pure and client-safe; a client component is
 * handed the zone by its server parent.
 *
 * Held by `lib/the-event-has-one-clock.test.ts`, which also fails a page that computes the event day itself.
 */
import {
  getDayOfPhase,
  getMenuLifecyclePhase,
  theDayWindow,
  VENUE_TZ_FALLBACK,
  type DayOfPhase,
  type MenuLifecyclePhase,
  type TheDayHours,
} from './day-of-mode';
import { getLifecyclePhase, manualLaunchPhase, type LifecyclePhase } from './lifecycle-stage';
import { STAGE_CLOCK_PARTS, type ClockPart } from './stage-scenes';

/** The columns of `events` the clock reads, beside the venue's coordinates (for its zone). One select string, so a
 *  reader cannot forget the last day or the pin. */
export const EVENT_CLOCK_COLUMNS =
  'event_date, event_end_date, launch_mode, manual_phase, std_invitation_launch_date, cleared_at, venue_latitude, venue_longitude';

/** What the clock needs to know about the event. Every field but the date is optional — absent reads as "none". */
export type EventClockRow = {
  event_date: string | null | undefined;
  /** The LAST day of a celebration that spans several. Null = `event_date` is the last day. */
  event_end_date?: string | null;
  /** `events.launch_mode` + `events.manual_phase` — the couple's "Pick what shows" pin. */
  launch_mode?: string | null;
  manual_phase?: string | null;
  /** `events.std_invitation_launch_date` — the day the Invitation replaces the Save the Date. */
  std_invitation_launch_date?: string | null;
  /** `events.cleared_at` — the couple closed the day out (the dashboard's menu only; never the guests' page). */
  cleared_at?: string | null;
};

export type EventClockInput = {
  event: EventClockRow;
  /** The venue's IANA zone (`venueTimezone(event)`). Absent = the venue fallback, Asia/Manila. */
  tz?: string | null;
  nowMs?: number;
  /** The couple's own hours for The Day. Absent = 06:00 → 06:00 the morning after the last day. */
  hours?: TheDayHours | null;
  /** `isWebsitePhasesEnabled()` (or the event type's own website surface). `false` = there are no stages to pin, so
   *  the pin is ignored. Absent = the pin is honoured (the Event Hub page's own composition). */
  phasesEnabled?: boolean;
};

export type EventClock = {
  tz: string;
  nowMs: number;
  /** The Day: opens at this instant … */
  opensMs: number;
  /** … and closes at this one. Both `NaN` when the event has no date. */
  closesMs: number;
  /** The run-up / The Day / the look-back day / neither — the one window. */
  day: DayOfPhase;
  /** Is The Day open right now? (`day === 'live'`) */
  theDayOpen: boolean;
  /** The dashboard's Plan → Day-of → After. */
  menu: MenuLifecyclePhase;
  /** The stage the date puts the event in. */
  automatic: LifecyclePhase;
  /** The couple's pin, when one is set (and stages are on). */
  pinned: LifecyclePhase | null;
  /** The stage guests see: the pin, else the date. */
  stage: LifecyclePhase;
  /** A pin is set — the couple is offered "Back to automatic" (ruling 3). */
  backToAutomatic: boolean;
};

/** THE ONE FUNCTION. Which stage is this event in now, at the venue — and The Day's two instants. */
export function eventClock(input: EventClockInput): EventClock {
  const tz = (input.tz ?? '').trim() || VENUE_TZ_FALLBACK;
  const nowMs = input.nowMs ?? Date.now();
  const e = input.event;
  const date = e.event_date || null;
  const end = e.event_end_date ?? null;
  const hours = input.hours ?? null;
  const { opensMs, closesMs } = theDayWindow(date, tz, end, hours);
  const day: DayOfPhase = date ? getDayOfPhase(date, tz, nowMs, end, hours) : 'inactive';
  const automatic = getLifecyclePhase(date, tz, end, nowMs, e.std_invitation_launch_date ?? null, hours);
  const pinned = input.phasesEnabled === false ? null : manualLaunchPhase(e.launch_mode, e.manual_phase);
  return {
    tz,
    nowMs,
    opensMs,
    closesMs,
    day,
    theDayOpen: day === 'live',
    menu: getMenuLifecyclePhase(date, e.cleared_at ?? null, tz, nowMs, end, hours),
    automatic,
    pinned,
    stage: pinned ?? automatic,
    backToAutomatic: pinned !== null,
  };
}

/**
 * Is this part of the event open now? — `STAGE_CLOCK_PARTS` (lib/stage-scenes.ts), read on the DATE's stage
 * (`automatic`), never the pin: a couple who pins "The Day" a week early to preview it must not open check-in, song
 * requests or the seat finder to every guest. What a part ADDS on top (the early-seats switch, Papic's own window)
 * stays with the part's reader.
 */
export function clockPartOpen(clock: Pick<EventClock, 'automatic'>, part: ClockPart): boolean {
  return (STAGE_CLOCK_PARTS[clock.automatic] as readonly ClockPart[]).includes(part);
}

/** One letter per stage, for keys (the Event Hub's cache key, `lib/hub-view-key.ts`). */
export const STAGE_CODE: Readonly<Record<LifecyclePhase, string>> = {
  save_the_date: 's',
  rsvp: 'r',
  event: 'e',
  editorial: 'p',
};
/** One letter per day-of phase, for keys. */
export const DAY_CODE: Readonly<Record<DayOfPhase, string>> = { pre: 'b', live: 'l', post: 'a', inactive: 'i' };

/** `{stage}{day}` — what the clock says now, in two letters. Moves when a stage OR the day-of phase flips. */
export function clockCode(clock: Pick<EventClock, 'stage' | 'day'>): string {
  return `${STAGE_CODE[clock.stage]}${DAY_CODE[clock.day]}`;
}

/**
 * THE DAY AS TWO INSTANTS — what a server hands a client component, so the phone never works out "is it the day?"
 * itself. Before the one clock the day-of hooks (`useEventPulse`, `useDayOfLiveTick`, the seat plan's banner, the
 * sidebar) were given a bare `YYYY-MM-DD` and anchored it on the PHONE's own midnight — a guest whose phone was set to
 * another zone saw the Live tab open hours early or late. Instants have no zone: `now >= opensMs && now < closesMs`.
 */
export type TheDayInstants = { opensMs: number; closesMs: number };

/** What the day-of hooks accept: The Day's instants (preferred — from the server's clock), or a legacy date, which is
 *  read on the venue fallback zone (Asia/Manila), never the device's. */
export type TheDayWhen = string | Date | TheDayInstants | null | undefined;

export function theDayInstantsOf(clock: Pick<EventClock, 'opensMs' | 'closesMs'>): TheDayInstants | null {
  return Number.isFinite(clock.opensMs) && Number.isFinite(clock.closesMs)
    ? { opensMs: clock.opensMs, closesMs: clock.closesMs }
    : null;
}

function isInstants(when: TheDayWhen): when is TheDayInstants {
  return typeof when === 'object' && when !== null && !(when instanceof Date);
}

/** Is The Day open at `nowMs`? The client's one question — asked of instants when it has them. */
export function theDayIsOpenAt(when: TheDayWhen, nowMs: number = Date.now()): boolean {
  if (!when) return false;
  if (isInstants(when)) {
    return Number.isFinite(when.opensMs) && Number.isFinite(when.closesMs) && nowMs >= when.opensMs && nowMs < when.closesMs;
  }
  return getDayOfPhase(when, VENUE_TZ_FALLBACK, nowMs) === 'live';
}

/** A stable string for a hook's dependency list (an instants object is a new object on every render). */
export function theDayWhenKey(when: TheDayWhen): string {
  if (!when) return '';
  if (isInstants(when)) return `${when.opensMs}-${when.closesMs}`;
  return when instanceof Date ? String(when.getTime()) : when;
}

/** The clock's columns read off ANY row (a loosely typed select, the page's shell) — strings stay strings, coordinates
 *  become numbers, anything else is "none". So a reader never casts its row to feed the clock. */
export function clockRowOf(
  row: unknown,
): EventClockRow & { venue_latitude: number | null; venue_longitude: number | null } {
  const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
  const num = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  return {
    event_date: str(r.event_date),
    event_end_date: str(r.event_end_date),
    launch_mode: str(r.launch_mode),
    manual_phase: str(r.manual_phase),
    std_invitation_launch_date: str(r.std_invitation_launch_date),
    cleared_at: str(r.cleared_at),
    venue_latitude: num(r.venue_latitude),
    venue_longitude: num(r.venue_longitude),
  };
}
