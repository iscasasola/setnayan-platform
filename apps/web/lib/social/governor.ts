/**
 * apps/web/lib/social/governor.ts
 *
 * The posting clock of the social auto-publish pipeline. Pure functions, no I/O, no env.
 *
 * Owner, 28 Nov 2026 (specs DECISION_LOG "FACEBOOK POSTING IS AUTOMATIC, IN THREE DAILY SLOTS" ·
 * "WHAT EACH FACEBOOK SLOT CARRIES" · "THE FACEBOOK DAILY CAP COUNTS THE PLANNED POSTS TOO"):
 *
 *   • 08:00 Manila  `morning`   inspirational · problem-solving · what Setnayan is (the planned library)
 *   • 14:00 Manila  `afternoon` last-minute posts (recognitions, new shops, events done, Sunday totals)
 *                               and every post that fits neither 08:00 nor 20:00: every site auto-post lands here
 *   • 20:00 Manila  `evening`   commentable, viral-ready (the planned library)
 *   • 12:00 Manila  `holiday`   the holiday greeting, an EXTRA post, only on a day a planned holiday row names
 *
 * This SUPERSEDES the 27 Nov 12–1 PM / 7–9 PM windows and the weekend 10 AM window.
 *
 * The daily cap is the slots themselves: ONE post per slot instant, planned or automatic. A post that finds its
 * slot taken queues for the next free slot of its kind. Nothing is ever posted outside a slot: a slot is open from
 * its instant for `SLOT_OPEN_MS`, and the first flush inside that hour publishes it. The flush is opened on time by
 * `.github/workflows/social-slots.yml` → `/api/cron/social-flush` (a run plus a retry inside every slot) and also
 * rides page traffic through `after()`. A slot that still closes unposted is re-slotted, never posted late
 * (`slotVerdict`).
 *
 * TIMEZONE NOTE: the Philippines has no DST and PHT is pinned at UTC+08:00, so a fixed +08:00 offset is correct
 * year-round. If PH ever reintroduced DST (last seen 1990) this file is the single place to revisit.
 */

export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok';

/** The four posting slots. `holiday` opens only for a planned holiday row. */
export type SocialSlot = 'morning' | 'afternoon' | 'evening' | 'holiday';

/** Manila wall-clock hour of each slot. */
export const SLOT_HOUR: Readonly<Record<SocialSlot, number>> = {
  morning: 8,
  holiday: 12,
  afternoon: 14,
  evening: 20,
};

/** The three slots every day carries, in time order (the holiday extra is opt-in per row). */
export const DAILY_SLOTS: readonly SocialSlot[] = ['morning', 'afternoon', 'evening'];

/** Every slot site auto-posts (milestones, new shops, badges, recaps, teasers, live updates) use. */
export const AUTO_POST_SLOT = 'afternoon' as const satisfies SocialSlot;

/** How long a slot stays open for dispatch after its instant: the first flush inside this hour posts it. */
export const SLOT_OPEN_MS = 60 * 60 * 1000;

/** The 14:00 live composer looks for real news from 12:00 Manila until its slot closes. */
export const LIVE_COMPOSE_FROM_HOUR = 12;

/** How far ahead `nextFreeSlot` looks for a free slot. */
const SCAN_DAYS = 800;

/** Fixed PHT offset (see the timezone note above). */
const PH_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isSocialSlot(value: unknown): value is SocialSlot {
  return value === 'morning' || value === 'afternoon' || value === 'evening' || value === 'holiday';
}

/** The PH calendar day (YYYY-MM-DD) an instant falls on. */
export function phDayKey(instant: Date): string {
  return new Date(instant.getTime() + PH_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

/** Sunday, for a PH calendar day key — the day of the weekly totals. */
export function isPhSunday(dayKey: string): boolean {
  return new Date(`${dayKey}T00:00:00Z`).getUTCDay() === 0;
}

/** The PH day key `days` after `dayKey` (negative goes back). */
export function addPhDays(dayKey: string, days: number): string {
  return new Date(new Date(`${dayKey}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** The UTC instant of a slot on a PH calendar day. */
export function slotInstant(dayKey: string, slot: SocialSlot): Date {
  return new Date(`${dayKey}T${String(SLOT_HOUR[slot]).padStart(2, '0')}:00:00+08:00`);
}

/**
 * Which slot an instant is EXACTLY (to the second), or null. 12:00 counts as a slot only for a row that says it is
 * the holiday extra (`allowHoliday`), so a stray noon time never becomes a fourth daily post.
 */
export function slotAt(instant: Date, allowHoliday = false): SocialSlot | null {
  const ms = instant.getTime();
  if (Number.isNaN(ms)) return null;
  const day = phDayKey(instant);
  for (const slot of DAILY_SLOTS) if (slotInstant(day, slot).getTime() === ms) return slot;
  if (allowHoliday && slotInstant(day, 'holiday').getTime() === ms) return 'holiday';
  return null;
}

/** True while `now` is inside the open hour of the slot that starts at `slotStart`. */
export function isSlotOpen(slotStart: Date, now: Date): boolean {
  const start = slotStart.getTime();
  return now.getTime() >= start && now.getTime() < start + SLOT_OPEN_MS;
}

/** The instant (ms) a slot is taken at. Takes Dates or ISO strings; bad values are ignored. */
function takenSet(taken: ReadonlyArray<Date | string | null | undefined>): Set<number> {
  const out = new Set<number>();
  for (const t of taken) {
    if (!t) continue;
    const ms = (t instanceof Date ? t : new Date(t)).getTime();
    if (!Number.isNaN(ms)) out.add(ms);
  }
  return out;
}

/**
 * The earliest `slot` instant that is still open or ahead at `from` (its hour has not closed) and that no post
 * holds yet. One post per slot instant is the whole daily cap: the planned library counts, because its rows sit in
 * `taken` like any other. A live update that finds today's 14:00 taken lands on the next free 14:00.
 *
 * `holiday` is never handed out here: the holiday extra exists only as a planned row with its own date.
 */
export function nextFreeSlot(
  slot: Exclude<SocialSlot, 'holiday'>,
  taken: ReadonlyArray<Date | string | null | undefined>,
  from: Date,
): Date {
  const held = takenSet(taken);
  const firstDay = phDayKey(from);
  // An 800-day scan guard: the planned library holds a morning and an evening every day through 2027, so a missed
  // planned morning may have to walk past the whole plan before it finds a free morning.
  for (let offset = 0; offset < SCAN_DAYS; offset += 1) {
    const candidate = slotInstant(addPhDays(firstDay, offset), slot);
    if (candidate.getTime() + SLOT_OPEN_MS <= from.getTime()) continue; // this slot has closed
    if (!held.has(candidate.getTime())) return candidate;
  }
  return slotInstant(addPhDays(firstDay, SCAN_DAYS), slot);
}

/**
 * Kept for the admin announcement and every older caller: the next free slot for a site post is the next free
 * 14:00 (`AUTO_POST_SLOT`). The platform argument stays for the call shape; every platform shares one clock now,
 * because one row goes to every enabled platform at once.
 */
export function nextAvailableSlot(_platform: SocialPlatform, takenSlots: ReadonlyArray<Date | string>, now: Date): Date {
  return nextFreeSlot('afternoon', takenSlots, now);
}

/** What the dispatcher may do with one due row. */
export type SlotVerdict =
  /** Inside its slot's open hour: publish now. */
  | 'publish'
  /** Its slot is still ahead: wait. */
  | 'wait'
  /** Its slot closed with nothing posted, or it sits at a time that is not a slot: find it a new slot. */
  | 'reslot'
  /** A holiday greeting whose 12:00 closed unposted: it is date-bound, so it is never posted late. */
  | 'expire';

/**
 * The slot rule for one queued row. `slot` is the row's own slot column: `holiday` lets a 12:00 instant count,
 * anything else must sit on 08:00 / 14:00 / 20:00 exactly. A row with no `scheduled_for` waits for the governor.
 *
 * A missed post is re-slotted, never lost (controller 2026-11-28): a site auto-post to the next free 14:00, a
 * planned library post to the next free slot OF ITS OWN KIND (a missed 08:00 to the next free 08:00) — the flush
 * logs it and records it on the row. Only a holiday greeting expires: it is written for its date.
 */
export function slotVerdict(
  row: { scheduled_for: string | null; slot: string | null; source_type?: string | null },
  now: Date,
): SlotVerdict {
  if (!row.scheduled_for) return 'wait';
  const at = new Date(row.scheduled_for);
  const isHoliday = row.slot === 'holiday';
  const slot = slotAt(at, isHoliday);
  if (!slot) return 'reslot';
  if (isSlotOpen(at, now)) return 'publish';
  if (at.getTime() > now.getTime()) return 'wait';
  return isHoliday ? 'expire' : 'reslot';
}

/** Order of right to a contested slot: the plan first, then the live update, then every other auto-post. */
function claimRank(sourceType: string): number {
  if (sourceType === 'library') return 0;
  if (sourceType === 'live_update') return 1;
  return 2;
}

/**
 * Two queued rows on one slot instant (the planned library imported onto a 14:00 an auto-post already took, say):
 * the planned post keeps it and the others are bumped to find a new slot. Returns the post_ids to bump. Rows that
 * have already gone out (`publishing` / `published`) always keep their slot.
 */
export function slotClashLosers(
  rows: ReadonlyArray<{
    post_id: string;
    source_type: string;
    status: string;
    scheduled_for: string | null;
    created_at: string;
  }>,
): string[] {
  const bySlot = new Map<number, typeof rows[number][]>();
  for (const row of rows) {
    if (!row.scheduled_for) continue;
    const ms = new Date(row.scheduled_for).getTime();
    if (Number.isNaN(ms)) continue;
    const list = bySlot.get(ms) ?? [];
    list.push(row);
    bySlot.set(ms, list);
  }
  const losers: string[] = [];
  for (const list of bySlot.values()) {
    if (list.length < 2) continue;
    const sent = list.some((r) => r.status === 'publishing' || r.status === 'published');
    const ranked = [...list].sort(
      (a, b) =>
        Number(b.status !== 'scheduled') - Number(a.status !== 'scheduled') ||
        claimRank(a.source_type) - claimRank(b.source_type) ||
        a.created_at.localeCompare(b.created_at),
    );
    for (const row of ranked.slice(sent ? 0 : 1)) {
      if (row.status === 'scheduled') losers.push(row.post_id);
    }
  }
  return losers;
}

/**
 * The admin's "Post now": the daily slot open at `now` if no post holds it, else the next free 14:00. "Now" never
 * means outside a slot (owner, 28 Nov 2026).
 */
export function postNowSlot(taken: ReadonlyArray<Date | string | null | undefined>, now: Date): { at: Date; slot: SocialSlot } {
  const held = takenSet(taken);
  const day = phDayKey(now);
  for (const slot of DAILY_SLOTS) {
    const at = slotInstant(day, slot);
    if (isSlotOpen(at, now) && !held.has(at.getTime())) return { at, slot };
  }
  return { at: nextFreeSlot('afternoon', taken, now), slot: 'afternoon' };
}

/**
 * Which daily slot a row re-slots into: a planned library post keeps its own kind (morning / afternoon / evening);
 * every other post, and any row whose slot is unknown, takes the 14:00.
 */
export function reslotKind(row: { source_type: string | null; slot: string | null }): Exclude<SocialSlot, 'holiday'> {
  if (row.source_type === 'library' && (row.slot === 'morning' || row.slot === 'afternoon' || row.slot === 'evening')) {
    return row.slot;
  }
  return AUTO_POST_SLOT;
}
