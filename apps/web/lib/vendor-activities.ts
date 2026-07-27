/**
 * THE EMCEE'S ACTIVITY CATALOGUE — pure model + the bridge onto the timeline.
 *
 * Owner, 2026-07-27: "emcees will list all his activities that the hosts can
 * pick from ... so strategically plan this so it will be faster for them to
 * build a script for that day."
 *
 * THE SPEED COMES FROM THE BRIDGE, NOT A BETTER EDITOR. Building a wedding
 * timeline is slow because the couple types every moment from nothing. It gets
 * fast when the person who runs those moments for a living has already written
 * them down — with their real lengths — and the couple simply picks. So the
 * valuable function here is {@link planPicksOntoTimeline}: picked activities →
 * schedule blocks, placed after what already exists, without collisions.
 *
 * WHY A PURE MODULE. Same reason as `lib/stage-script.ts` and
 * `lib/song-desk.ts`: placement is a DECISION (where does a 15-minute segment
 * go on a day that already has blocks?), and a decision is only trustworthy if
 * a test can hold it down. No Supabase, no clock, no React.
 *
 * ── THE SPLIT THIS MODULE PROTECTS ─────────────────────────────────────────
 *
 * Owner, same session, on what survives a wedding: "stays per wedding. but his
 * questionaire can be saved as his template. to use for succeeding customers."
 * The catalogue is the emcee's craft and travels; the picks belong to one event
 * and die with it. That is why {@link VendorActivity} carries no event id and
 * {@link ActivityPick} carries no couple's words: nothing personal to one
 * wedding can ride along to the next. Enforced by the schema
 * (`vendor_activities` has no `event_id`), restated here so a later edit that
 * tries to cache a couple's answer on the catalogue row has to argue with a
 * comment first.
 */

import type { ScheduleBlockType } from '@/lib/schedule';

/** One segment in the emcee's reusable catalogue. Carries no event, ever. */
export type VendorActivity = {
  activity_id: string;
  vendor_profile_id: string;
  label: string;
  blurb: string | null;
  duration_minutes: number;
  block_type: string;
  is_offered: boolean;
  display_order: number;
};

/** One couple's pick from that catalogue, for one event. */
export type ActivityPick = {
  event_id: string;
  activity_id: string;
  /** Non-null once this pick has become a real block on the timeline. */
  scheduled_block_id: string | null;
};

/** The minimum a placed block needs — a subset of `ScheduleBlockRow`. */
export type TimelineBlock = {
  block_id: string;
  start_at: string;
  end_at: string | null;
  sort_order: number;
};

/** A block this module proposes creating. Not written here — the caller does. */
export type PlannedBlock = {
  activity_id: string;
  label: string;
  block_type: ScheduleBlockType;
  /** ISO, event-local wall clock at UTC — the same convention the schedule uses. */
  start_at: string;
  end_at: string;
  sort_order: number;
};

export type TimelinePlan = {
  /** Blocks to create, in the order they will run. */
  blocks: PlannedBlock[];
  /** Picks skipped because they are already on the timeline. */
  alreadyPlaced: string[];
  /** Picks skipped because the activity is missing or no longer offered. */
  unavailable: string[];
};

/**
 * The catalogue as a couple sees it: only what the emcee still offers, in his
 * order. A retired activity stays readable (old picks must keep resolving) but
 * never appears on the menu again.
 */
export function offeredCatalogue(
  activities: readonly VendorActivity[],
): VendorActivity[] {
  return activities
    .filter((a) => a.is_offered)
    .slice()
    .sort((a, b) =>
      a.display_order !== b.display_order
        ? a.display_order - b.display_order
        : a.label.localeCompare(b.label),
    );
}

/** Total running time of a set of activities — what the couple is committing to. */
export function totalMinutes(activities: readonly VendorActivity[]): number {
  return activities.reduce((sum, a) => sum + Math.max(0, a.duration_minutes), 0);
}

/** `block_type` is TEXT in both tables; narrow it, defaulting to 'program'. */
function asBlockType(raw: string): ScheduleBlockType {
  const known: ScheduleBlockType[] = [
    'pre_ceremony', 'ceremony', 'cocktails', 'reception', 'dinner',
    'program', 'dancing', 'send_off', 'after_party', 'custom',
  ];
  return (known as readonly string[]).includes(raw)
    ? (raw as ScheduleBlockType)
    : 'program';
}

/** Latest end (or start) across the existing timeline — where we append from. */
function timelineTail(blocks: readonly TimelineBlock[]): { at: number; sort: number } | null {
  let at = Number.NEGATIVE_INFINITY;
  let sort = 0;
  for (const b of blocks) {
    const end = Date.parse(b.end_at ?? b.start_at);
    if (!Number.isNaN(end) && end > at) at = end;
    if (b.sort_order > sort) sort = b.sort_order;
  }
  return at === Number.NEGATIVE_INFINITY ? null : { at, sort };
}

/**
 * THE BRIDGE. Turn the couple's picks into blocks to append to their timeline.
 *
 * Placement rule, and why it is APPEND rather than insert: the couple's own
 * timeline is authored, and a template load already refuses to touch a
 * non-empty schedule (`loadScheduleTemplate`) for exactly this reason — a tool
 * that reflows someone's hand-built day is a tool they stop trusting. So picked
 * activities land in a run AFTER everything already scheduled, back-to-back in
 * catalogue order, and the couple drags them where they belong. Nothing
 * existing moves, nothing overlaps.
 *
 * IDEMPOTENT. A pick already carrying a `scheduled_block_id` is reported in
 * `alreadyPlaced` and never planned twice, so running this after adding one
 * more activity plans only the new one.
 *
 * `fallbackStart` is used only when the timeline is empty — there is no
 * previous block to append to. Pass the event's start; the caller has it.
 */
export function planPicksOntoTimeline(input: {
  picks: readonly ActivityPick[];
  catalogue: readonly VendorActivity[];
  timeline: readonly TimelineBlock[];
  /** ISO. Only consulted when `timeline` is empty. */
  fallbackStart: string;
}): TimelinePlan {
  const byId = new Map(input.catalogue.map((a) => [a.activity_id, a]));
  const alreadyPlaced: string[] = [];
  const unavailable: string[] = [];
  const queue: VendorActivity[] = [];

  for (const pick of input.picks) {
    if (pick.scheduled_block_id) {
      alreadyPlaced.push(pick.activity_id);
      continue;
    }
    const activity = byId.get(pick.activity_id);
    // Missing (deleted) or retired → skipped and NAMED, never silently dropped.
    if (!activity || !activity.is_offered) {
      unavailable.push(pick.activity_id);
      continue;
    }
    queue.push(activity);
  }

  // Run them in the emcee's own order — it is his professional judgement about
  // what follows what, and it is the only ordering signal we have.
  queue.sort((a, b) =>
    a.display_order !== b.display_order
      ? a.display_order - b.display_order
      : a.label.localeCompare(b.label),
  );

  const tail = timelineTail(input.timeline);
  const startMs = tail ? tail.at : Date.parse(input.fallbackStart);
  let cursor = Number.isNaN(startMs) ? Date.parse(input.fallbackStart) : startMs;
  let sort = tail ? tail.sort : 0;

  const blocks: PlannedBlock[] = [];
  for (const a of queue) {
    // A malformed fallback would poison every timestamp; refuse rather than
    // emit Invalid Date strings the schedule would store.
    if (Number.isNaN(cursor)) break;
    const minutes = Math.max(1, a.duration_minutes);
    const end = cursor + minutes * 60_000;
    sort += 10; // gap-10, the same idiom `buildTemplateInsertRows` uses
    blocks.push({
      activity_id: a.activity_id,
      label: a.label,
      block_type: asBlockType(a.block_type),
      start_at: new Date(cursor).toISOString(),
      end_at: new Date(end).toISOString(),
      sort_order: sort,
    });
    cursor = end;
  }

  return { blocks, alreadyPlaced, unavailable };
}
