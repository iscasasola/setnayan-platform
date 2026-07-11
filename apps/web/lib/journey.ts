/**
 * Journey timeline — the "Journey" mode of the couple's /schedule page
 * (event-lifecycle arc, 2026-07-11).
 *
 * Where the Preparation mode answers "what dated steps are still ahead of
 * me?", the Journey mode answers a different, wider question: "what is the
 * whole arc of this event, from the day we started dreaming it up, through
 * the day itself, to the story we publish afterward?" It is the couple's
 * historical journey — conceptualizing → reality → documentation — on one
 * continuous, phase-grouped timeline.
 *
 * Like Preparation, this is PURE AGGREGATION over data that ALREADY exists —
 * no new table, no new migration. It reuses the already-built Preparation
 * agenda for the middle of the arc and adds three lifecycle bookend
 * milestones read from columns that already exist:
 *
 *   1. Kickoff   · events.created_at        — "You started planning"
 *   2. The day   · events.event_date        — the event itself
 *   3. The story · event_recaps.published_at — the editorial / recap the
 *                  couple publishes afterward (a forward placeholder until
 *                  it exists, so the arc always shows where it's headed)
 *
 * The caller (the schedule page) already fetches the agenda + the event row;
 * this module just needs the two extra anchors handed in, keeping the read
 * cost of the Journey mode to one small recap-status lookup on top of the
 * agenda the page loads anyway.
 */

import type { PreparationAgenda, PreparationItem, PreparationSource } from './preparation';

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

/**
 * The four phases of the arc. Grouping by PHASE (not by month, as Preparation
 * does) is what turns a flat agenda into a legible "conceptualizing → reality
 * → documentation" story.
 */
export type JourneyPhaseId = 'kickoff' | 'road' | 'day' | 'story';

/** The three lifecycle bookends (vs. the ordinary dated agenda rows). */
export type JourneyMilestone = 'created' | 'the_day' | 'editorial';

export type JourneyEntry = {
  /** Stable id — unique per source + row. React key. */
  id: string;
  phase: JourneyPhaseId;
  /** The date this entry sits at on the arc. */
  date: Date;
  /** Whole-day diff between now and date (negative = already happened). */
  daysFromNow: number;
  /** True once the date is today or in the past. */
  past: boolean;
  title: string;
  subtitle: string;
  /**
   * Set on the three lifecycle bookends; undefined on ordinary agenda rows.
   * Drives the milestone visual (a larger, accented node on the arc).
   */
  milestone?: JourneyMilestone;
  /**
   * For agenda rows: the Preparation source so the Journey can reuse the same
   * icon/tone vocabulary the Preparation mode already speaks. Undefined on
   * milestones.
   */
  prepSource?: PreparationSource;
  /** Manual/typed prep rows borrow a source visual via this kind. */
  prepKind?: PreparationItem['kind'];
  /** Whole pesos on payment rows; undefined elsewhere. */
  amountPhp?: number;
  /** On-platform deep-link for tap-through. */
  href?: string;
  /**
   * True when this is a forward-looking placeholder rather than a real dated
   * fact — specifically the editorial bookend before the recap is published.
   * The UI renders it dimmed ("coming soon") rather than as a settled event.
   */
  pending?: boolean;
};

export type JourneyPhase = {
  id: JourneyPhaseId;
  /** Section heading, brand-voiced. */
  label: string;
  /** One-line caption under the heading. */
  caption: string;
  entries: JourneyEntry[];
};

export type JourneyTimeline = {
  phases: JourneyPhase[];
  /** Front bookend — when planning began. Null if the event row has no created_at. */
  createdDate: Date | null;
  /** The event day. Null until the couple sets a date. */
  eventDate: Date | null;
  /** Real editorial publish date, when the recap is live. */
  editorialDate: Date | null;
  /** The event has happened but the editorial isn't published yet. */
  editorialPending: boolean;
  /**
   * Where "today" sits along the arc, 0..1 (created → editorial-or-day). Drives
   * the progress bar in the header. 0 before kickoff, 1 once the story is out.
   */
  progressPct: number;
  /** Total entries across all phases (milestones + agenda rows). */
  totalEntries: number;
};

// ----------------------------------------------------------------------------
// Copy handed in by the caller (kept event-type-aware without pulling the
// event-term machinery into this pure module).
// ----------------------------------------------------------------------------

export type JourneyCopy = {
  /** e.g. "your wedding day" / "your event day". Lower-case noun phrase. */
  dayLabel: string;
  /** e.g. "wedding" / "event" — the bare noun for milestone titles. */
  eventNoun: string;
};

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function daysBetween(target: Date, now: Date): number {
  const a = new Date(target);
  a.setHours(0, 0, 0, 0);
  const b = new Date(now);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/** Same civil day? (compares local Y/M/D, ignoring time-of-day.) */
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ----------------------------------------------------------------------------
// Phase metadata
// ----------------------------------------------------------------------------

const PHASE_META: Record<JourneyPhaseId, { label: string; caption: string }> = {
  kickoff: {
    label: 'The beginning',
    caption: 'Where it all started.',
  },
  road: {
    label: 'The road there',
    caption: 'Every dated step on the way — payments, paperwork, and meetings.',
  },
  day: {
    label: 'The day',
    caption: 'The moment everything led up to.',
  },
  story: {
    label: 'The story after',
    caption: 'How the day is remembered and shared.',
  },
};

const PHASE_ORDER: JourneyPhaseId[] = ['kickoff', 'road', 'day', 'story'];

// ----------------------------------------------------------------------------
// Builder
// ----------------------------------------------------------------------------

export type BuildJourneyInput = {
  eventId: string;
  /** The already-aggregated Preparation agenda (reused for the middle). */
  agenda: PreparationAgenda;
  /** events.created_at (ISO). */
  createdAt: string | null;
  /** events.event_date (YYYY-MM-DD DATE, no time). */
  eventDate: string | null;
  /** event_recaps.published_at (ISO) when the recap is live; else null. */
  recapPublishedAt: string | null;
  now: Date;
  copy: JourneyCopy;
};

/**
 * Fold the lifecycle bookends + the Preparation agenda into one phase-grouped
 * arc. Every entry is chronologically sorted within its phase; phases render
 * in fixed narrative order (kickoff → road → day → story).
 */
export function buildJourneyTimeline(input: BuildJourneyInput): JourneyTimeline {
  const { eventId, agenda, createdAt, eventDate, recapPublishedAt, now, copy } = input;

  const createdDate = parseIso(createdAt);
  // event_date is a civil DATE — anchor to noon local for stable day-bucketing
  // (mirrors lib/preparation.ts).
  const theDay = eventDate ? safeDate(`${eventDate}T12:00:00`) : null;
  const editorialDate = parseIso(recapPublishedAt);

  const entries: JourneyEntry[] = [];

  // ── Kickoff bookend ──────────────────────────────────────────────────────
  if (createdDate) {
    entries.push({
      id: 'milestone:created',
      phase: 'kickoff',
      date: createdDate,
      daysFromNow: daysBetween(createdDate, now),
      past: true, // creation is always in the past
      title: 'You started planning',
      subtitle: `The day your ${copy.eventNoun} began on Setnayan.`,
      milestone: 'created',
      href: `/dashboard/${eventId}`,
    });
  }

  // ── The road there — reuse the Preparation agenda rows ───────────────────
  for (const item of agenda.items) {
    // Anything dated before the event day belongs on the road; an item that
    // happens to fall on the event day itself sits in the "day" phase; a rare
    // post-event agenda item lands in "story".
    const phase = phaseForAgendaDate(item.date, theDay);
    entries.push({
      id: `prep:${item.id}`,
      phase,
      date: item.date,
      daysFromNow: item.daysFromNow,
      past: item.daysFromNow < 0,
      title: item.title,
      subtitle: item.subtitle,
      prepSource: item.source,
      prepKind: item.kind,
      ...(item.amountPhp !== undefined ? { amountPhp: item.amountPhp } : {}),
      href: item.href,
    });
  }

  // ── The day bookend ──────────────────────────────────────────────────────
  if (theDay) {
    const d = daysBetween(theDay, now);
    entries.push({
      id: 'milestone:the-day',
      phase: 'day',
      date: theDay,
      daysFromNow: d,
      past: d < 0,
      title: capitalize(copy.dayLabel),
      subtitle:
        d > 0
          ? `The big day — ${d} day${d === 1 ? '' : 's'} to go.`
          : d === 0
            ? 'Today is the day.'
            : 'The day you celebrated.',
      milestone: 'the_day',
      href: `/dashboard/${eventId}/schedule?view=event-day`,
    });
  }

  // ── The story bookend (editorial / recap) ────────────────────────────────
  const eventPast = theDay ? daysBetween(theDay, now) < 0 : false;
  let editorialPending = false;
  if (editorialDate) {
    // Real, published editorial.
    entries.push({
      id: 'milestone:editorial',
      phase: 'story',
      date: editorialDate,
      daysFromNow: daysBetween(editorialDate, now),
      past: daysBetween(editorialDate, now) < 0,
      title: 'Your story is live',
      subtitle: 'Your editorial recap is published for family and friends to relive.',
      milestone: 'editorial',
      href: `/dashboard/${eventId}/studio/papic/recap`,
    });
  } else if (theDay) {
    // Not yet published — show a forward placeholder so the arc always ends on
    // "the story". Soft-anchored a couple of weeks after the day (a natural
    // documentation window) purely for ordering; it is NOT a hard deadline, so
    // the UI renders it as "coming soon" rather than a dated obligation.
    editorialPending = eventPast;
    const placeholder = new Date(theDay);
    placeholder.setDate(placeholder.getDate() + 14);
    entries.push({
      id: 'milestone:editorial',
      phase: 'story',
      date: placeholder,
      daysFromNow: daysBetween(placeholder, now),
      past: false,
      title: 'Your editorial',
      subtitle: eventPast
        ? 'Publish your recap once your photos are in — the finale of your journey.'
        : `The keepsake you'll publish after ${copy.dayLabel}.`,
      milestone: 'editorial',
      href: `/dashboard/${eventId}/studio/papic/recap`,
      pending: true,
    });
  }

  // ── Group into phases, sorted within each ────────────────────────────────
  const byPhase = new Map<JourneyPhaseId, JourneyEntry[]>();
  for (const id of PHASE_ORDER) byPhase.set(id, []);
  for (const e of entries) byPhase.get(e.phase)!.push(e);

  const phases: JourneyPhase[] = PHASE_ORDER.map((id) => {
    const phaseEntries = (byPhase.get(id) ?? []).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
    return {
      id,
      label: PHASE_META[id].label,
      caption: PHASE_META[id].caption,
      entries: phaseEntries,
    };
  }).filter((p) => p.entries.length > 0);

  return {
    phases,
    createdDate,
    eventDate: theDay,
    editorialDate,
    editorialPending,
    progressPct: computeProgress(createdDate, theDay, editorialDate, now),
    totalEntries: entries.length,
  };
}

// ----------------------------------------------------------------------------
// internals
// ----------------------------------------------------------------------------

function parseIso(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeDate(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function phaseForAgendaDate(date: Date, theDay: Date | null): JourneyPhaseId {
  if (!theDay) return 'road';
  if (sameDay(date, theDay)) return 'day';
  return date.getTime() < theDay.getTime() ? 'road' : 'story';
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Where "today" sits along the arc, clamped 0..1. The arc runs from kickoff to
 * the editorial (or, before an editorial exists, to the event day). Returns 0
 * with no start anchor, 1 once the far end is behind us.
 */
function computeProgress(
  created: Date | null,
  theDay: Date | null,
  editorial: Date | null,
  now: Date,
): number {
  const start = created?.getTime();
  const end = (editorial ?? theDay)?.getTime();
  if (start === undefined || end === undefined || end <= start) {
    // Degenerate arc — if the far end is already behind us, call it complete.
    return end !== undefined && now.getTime() >= end ? 1 : 0;
  }
  const t = (now.getTime() - start) / (end - start);
  return Math.max(0, Math.min(1, t));
}
