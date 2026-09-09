/**
 * THE EDITION NUMBER IS STAMPED ONCE — `03` §2.4 · 08 step 1.6.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────
 * 🔴 `editionNo` WAS RECOMPUTED ON EVERY RENDER. `app/[slug]/_components/
 * editorial/data.ts` counted the weddings in the awards cycle up to this
 * event's date, on each load — so the number printed under the words "theirs
 * forever" changed whenever somebody ELSE'S wedding landed in the same cycle
 * with an earlier date. A couple published as No. 4 and came back to No. 5, and
 * a keepsake printed on either day disagreed with the page.
 *
 * ── THE FIX, AND ITS EXACT MOMENT ────────────────────────────────────────────
 * The volume and the number are written into `event_editorial` ONCE, on the
 * FIRST transition of `status` to `'published'`, and never again. The database
 * refuses to move them afterwards (trigger `event_editorial_edition_stamped_once`)
 * — the app being right is not the same as the number being safe.
 *
 * ⚠ NOT ON `published_at`. That column is stamped the first time the story stops
 * being private, which is the first GUESTS-ONLY share — deliberately, it is the
 * "when did this stop being private" date. The edition belongs to publication,
 * so a story that sits at guests-only for a month carries no number at all, and
 * the masthead reads "Vol. I" alone (`mastheadEdition`).
 *
 * ── ⚠ IT COUNTS WEDDINGS, AND THAT IS AN OPEN OWNER QUESTION ─────────────────
 * `editionNo` counts SETNAYAN WEDDINGS in the awards cycle. For a debut, "No. 7"
 * means the seventh wedding, which is meaningless to the person reading it.
 * **What the number should count for a non-wedding story is owner question Q5
 * (`07_Open_Questions.md`), STILL OPEN as of 2026-09-09.** It is left filtering
 * weddings with the reason recorded in `WEDDING_ONLY_BY_DESIGN`
 * (`lib/editorial-event-types.test.ts`) — a filter not to flip quietly. Flipping
 * it changes the number on every already-stamped non-wedding story's future
 * siblings while leaving the stamped ones alone, so it is a decision with a
 * before and an after, not a tidy-up.
 */

/** The awards cycle opens 18 November. Vol. I = 18 Nov 2026 → 17 Nov 2027. */
const AWARDS_CUTOFF_MONTH = 11;
const AWARDS_CUTOFF_DAY = 18;

/**
 * The `YYYY-MM-DD` the awards cycle containing this date opened on.
 *
 * Pure and total; `null` for anything that is not a parseable calendar date, so
 * a caller cannot count from a window it invented.
 */
export function editionCycleStart(eventDate: string | null): string | null {
  if (!eventDate) return null;
  const [y, m, d] = eventDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  const onOrAfterCutoff =
    m > AWARDS_CUTOFF_MONTH || (m === AWARDS_CUTOFF_MONTH && d >= AWARDS_CUTOFF_DAY);
  const cycleStartYear = onOrAfterCutoff ? y : y - 1;
  return `${cycleStartYear}-11-18`;
}

/** What is written onto the row. Both halves, or neither. */
export type StampedEdition = { volume: number; no: number };

type CountingClient = {
  from: (table: string) => {
    select: (
      cols: string,
      opts: { count: 'exact'; head: true },
    ) => {
      eq: (col: string, val: string) => {
        gte: (col: string, val: string) => {
          lte: (col: string, val: string) => PromiseLike<{ count: number | null; error: unknown }>;
        };
      };
    };
  };
};

/**
 * Count this celebration's place in its awards cycle, for the stamp.
 *
 * Returns `null` — and the caller then stamps NOTHING — when the event has no
 * date, or the count is refused, or the count comes back as zero. A rejected
 * query is an ABSENCE, not a thrown error: it arrives here as `error` set and
 * `count` null, which reads exactly like "no weddings", so the two are told
 * apart rather than collapsed. **A story with no number reads "Vol. I" and is
 * honest; a story stamped "No. 1" because a query failed is a lie that can
 * never be corrected**, because the trigger will not let it move.
 */
export async function countEditionNo(
  admin: CountingClient,
  eventDate: string | null,
): Promise<number | null> {
  const cycleStart = editionCycleStart(eventDate);
  if (!cycleStart || !eventDate) return null;
  try {
    const { count, error } = await admin
      .from('events')
      .select('event_id', { count: 'exact', head: true })
      .eq('event_type', 'wedding')
      .gte('event_date', cycleStart)
      .lte('event_date', eventDate);
    if (error) return null;
    if (typeof count !== 'number' || count <= 0) return null;
    return count;
  } catch {
    return null;
  }
}

/**
 * Volume as a number, from the event's date. Clamped to ≥ 1 — the inaugural
 * edition covers anything before the first cycle's 18 Nov 2026 start.
 *
 * ⚠ THE SAME ARITHMETIC AS `story-spine.ts` `editionVolume`, AND THAT IS NOT A
 * DUPLICATE BY ACCIDENT. That one is the RENDER's volume, derived from the date
 * every time so a story that has never been published still shows "Vol. I". This
 * one produces the STAMPED volume, which is frozen at publish precisely so a
 * host who later corrects their event date cannot move a published edition. Two
 * different jobs; a shared helper would hide that they are different.
 */
export function editionVolumeToStamp(eventDate: string | null): number {
  const cycleStart = editionCycleStart(eventDate);
  if (!cycleStart) return 1;
  const year = Number(cycleStart.slice(0, 4));
  return Math.max(1, year - 2025);
}

/**
 * The whole stamp, or nothing.
 *
 * ⛔ NEVER STAMPS HALF. A volume with no number would print "Vol. II · No. null"
 * to any reader that trusted one field without the other, and the masthead's
 * own rule is that the number appears only when it is real.
 */
export async function stampForPublish(
  admin: CountingClient,
  eventDate: string | null,
): Promise<StampedEdition | null> {
  const no = await countEditionNo(admin, eventDate);
  if (no == null) return null;
  return { volume: editionVolumeToStamp(eventDate), no };
}
