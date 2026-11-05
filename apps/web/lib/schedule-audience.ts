/**
 * lib/schedule-audience.ts — WHO A SCHEDULE MOMENT IS FOR (Studio › Schedule ›
 * For ▾; owner 2026-10-06 DECISION_LOG "STUDIO › SCHEDULE AND LOVE STORY", made
 * real 2026-10-07 "THE MISSING FIELDS ARE APPROVED").
 *
 * Everyone · Entourage · Sponsors · Family · Suppliers. A moment for a role
 * (*"2:00 PM Entourage photos"*) is shown only to that role — it IS their
 * **Arrive by** on Invitation › Me — and the guests' schedule on the page shows
 * only the Everyone moments.
 *
 * STORED in `event_schedule_blocks.audience` (migration 20271265788160): NULL is
 * Everyone — today's behaviour for every moment ever made — and the word
 * 'everyone' is never written. Pure: no I/O, no React.
 */

export const SCHEDULE_AUDIENCES = ['everyone', 'entourage', 'sponsors', 'family', 'suppliers'] as const;
export type ScheduleAudience = (typeof SCHEDULE_AUDIENCES)[number];

/** The four that are stored (the CHECK's vocabulary); Everyone is the absence. */
export const STORED_SCHEDULE_AUDIENCES = ['entourage', 'sponsors', 'family', 'suppliers'] as const satisfies readonly ScheduleAudience[];

export const SCHEDULE_AUDIENCE_LABEL: Readonly<Record<ScheduleAudience, string>> = {
  everyone: 'Everyone',
  entourage: 'Entourage',
  sponsors: 'Sponsors',
  family: 'Family',
  suppliers: 'Suppliers',
};

/** The For ▾ dropdown's rows, in the owner's order. */
export const SCHEDULE_AUDIENCE_OPTIONS = SCHEDULE_AUDIENCES.map((key) => ({ key, label: SCHEDULE_AUDIENCE_LABEL[key] }));

export function isScheduleAudience(v: unknown): v is ScheduleAudience {
  return typeof v === 'string' && (SCHEDULE_AUDIENCES as readonly string[]).includes(v);
}

/** A stored value → the audience. NULL, absent or anything unknown reads as Everyone (never guessed narrower). */
export function readScheduleAudience(raw: unknown): ScheduleAudience {
  return typeof raw === 'string' && (STORED_SCHEDULE_AUDIENCES as readonly string[]).includes(raw)
    ? (raw as ScheduleAudience)
    : 'everyone';
}

/** The audience → what the column holds: Everyone is NULL. Unknown → undefined (refused, nothing written). */
export function scheduleAudienceForWrite(raw: unknown): string | null | undefined {
  if (!isScheduleAudience(raw)) return undefined;
  return raw === 'everyone' ? null : raw;
}

/** Is this moment on the guests' own schedule (an Everyone moment)? */
export function isForEveryone(block: { audience?: string | null }): boolean {
  return readScheduleAudience(block.audience ?? null) === 'everyone';
}

/**
 * 🔒 ON THE GUESTS' SCHEDULE — a moment every guest may be shown: public, for
 * Everyone, and released (not a coordinator's unreleased prep). The in-memory
 * twin of the guests' fence — the database's anonymous read
 * (`event_schedule_blocks_public_read`, migration 20271267138064) asks the same
 * three things: `is_public = TRUE AND visibility <> 'coordinator_only' AND
 * audience IS NULL`. For a reader that already holds the rows (the printed
 * Details card's programme), so DB, pages and prints say one thing.
 *
 * Strict where the database is strict: only a NULL audience is Everyone here
 * (the CHECK allows nothing else, and an unknown word is never read as wider).
 * A row read without `visibility` is not staged — the column has a default.
 */
export function isOnTheGuestsSchedule(block: {
  is_public?: boolean | null;
  audience?: string | null;
  visibility?: string | null;
}): boolean {
  return block.is_public === true && (block.audience ?? null) === null && block.visibility !== 'coordinator_only';
}

/** The guests' schedule: only the Everyone moments. */
export function momentsForEveryone<T extends { audience?: string | null }>(blocks: readonly T[]): T[] {
  return blocks.filter(isForEveryone);
}

/**
 * ⏰ ARRIVE BY — the moments a role is asked to be at, in the caller's order
 * (Invitation › Me reads this for the guest's role; PR 6 of the Stages | Studio
 * plan). Never Everyone: those are the schedule every guest already sees.
 */
export function momentsForAudience<T extends { audience?: string | null }>(
  blocks: readonly T[],
  audience: Exclude<ScheduleAudience, 'everyone'>,
): T[] {
  return blocks.filter((b) => readScheduleAudience(b.audience ?? null) === audience);
}
