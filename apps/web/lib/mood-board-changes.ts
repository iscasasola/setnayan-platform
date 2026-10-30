/**
 * apps/web/lib/mood-board-changes.ts — the words and the shape of Home's Mood Board asks.
 *
 * Owner, verbatim, 2026-10-30 (DECISION_LOG "MOOD BOARD CHANGES: SUPPLIERS ASK, COORDINATORS APPLY, THE OWNERS HAVE 24
 * HOURS TO UNDO"): *"Suppliers need approval and coordinators auto apply and owners of the events has 24 hrs to undo
 * that change"* · *"So the changes made will show on home and the hosts need to approve it. Coordinators can also
 * approve the changes made by suppliers?"* → *"Yes we want that"*.
 *
 *   · TO APPROVE — a booked supplier's suggested photo (Keep · Decline), for whoever may change the board (the hosts,
 *     and a coordinator / helper / supplier the hosts set to Mood Board Edit).
 *   · CHANGED — the last 24 hours of changes by someone who is not an owner, each with its Undo while it lasts; the
 *     owners' alone.
 *
 * Both come from ONE read, `public.mood_board_home_asks` (migration 20271299051148). Pure: `readMoodBoardHomeAsks`
 * parses what the database answered and refuses a shape it does not recognise, so a unit test drives every branch.
 */

import { formatCount } from './format-number';

export type MoodBoardChangeKindWord = 'upload' | 'replace' | 'move' | 'remove' | 'keep' | 'change';

export type HomeSuggestion = {
  suggestionId: string;
  partLabel: string;
  shopLabel: string;
  imageUrl: string | null;
  at: string;
};

export type HomeChange = {
  changeId: string;
  actorLabel: string;
  kind: MoodBoardChangeKindWord;
  partLabel: string;
  shopLabel: string | null;
  at: string;
  undoUntil: string;
};

export type MoodBoardHomeAsks = { suggestions: HomeSuggestion[]; changes: HomeChange[] };

/** Why an Undo did not happen — each said in words, never a silent nothing. */
export type MoodBoardUndoStatus = 'moved_on' | 'expired' | 'already' | 'empty' | 'not_yours' | 'error';

export function moodBoardUndoWords(status: MoodBoardUndoStatus): string {
  switch (status) {
    case 'moved_on':
      return 'This part changed again since — undo the later change first.';
    case 'expired':
      return 'The 24 hours to undo this have passed, so the change stands.';
    case 'already':
      return 'This change was already undone.';
    case 'empty':
      return 'Nothing on the Mood Board changed, so there is nothing to undo.';
    case 'not_yours':
      return 'Only the owners of the event can undo a change.';
    default:
      return 'We couldn’t undo that just now — please try again.';
  }
}

/** "Coordinator Styled by Bea changed the Mood Board · Stage" — the notice's own title, so Home and the bell agree. */
export function changeTitle(c: Pick<HomeChange, 'actorLabel' | 'partLabel'>): string {
  return `${c.actorLabel} changed the Mood Board · ${c.partLabel}`;
}

/** What they did, in a few words. */
export function changeWhat(c: Pick<HomeChange, 'kind' | 'shopLabel'>): string {
  switch (c.kind) {
    case 'upload':
      return 'Added a photo';
    case 'replace':
      return 'Replaced a photo';
    case 'move':
      return 'Moved a photo';
    case 'remove':
      return 'Removed a photo';
    case 'keep':
      return `Kept a photo from ${c.shopLabel?.trim() || 'a supplier'}`;
    default:
      return 'Changed the photos';
  }
}

/** "23 h left to undo" · "40 min left to undo" · null once the window has closed. */
export function undoLeft(undoUntil: string, now: Date = new Date()): string | null {
  const ms = Date.parse(undoUntil) - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const min = Math.ceil(ms / 60_000);
  if (min < 60) return `${min} min left to undo`;
  return `${Math.floor(min / 60)} h left to undo`;
}

/** The Today line for the suggestions waiting. */
export function suggestionsTodayWords(s: readonly HomeSuggestion[]): string {
  if (s.length === 1) return `${s[0]!.shopLabel} suggested a photo · ${s[0]!.partLabel}`;
  return `${formatCount(s.length)} supplier photos to approve`;
}

/** The Today line for the changes that can still be undone. */
export function changesTodayWords(c: readonly HomeChange[]): string {
  if (c.length === 1) return changeTitle(c[0]!);
  return `${formatCount(c.length)} Mood Board changes by others`;
}

const KINDS: ReadonlySet<string> = new Set(['upload', 'replace', 'move', 'remove', 'keep', 'change']);
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/**
 * The database's answer, checked. `null` = a shape this code does not recognise — the caller says "couldn't check",
 * never "nothing to approve".
 */
export function readMoodBoardHomeAsks(data: unknown): MoodBoardHomeAsks | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { suggestions?: unknown; changes?: unknown };
  if (!Array.isArray(d.suggestions) || !Array.isArray(d.changes)) return null;
  const suggestions: HomeSuggestion[] = [];
  for (const raw of d.suggestions) {
    const r = raw as Record<string, unknown>;
    if (!str(r.suggestion_id) || !str(r.part_label) || !str(r.shop_label) || !str(r.at)) return null;
    suggestions.push({
      suggestionId: r.suggestion_id,
      partLabel: r.part_label,
      shopLabel: r.shop_label,
      imageUrl: str(r.image_url) ? r.image_url : null,
      at: r.at,
    });
  }
  const changes: HomeChange[] = [];
  for (const raw of d.changes) {
    const r = raw as Record<string, unknown>;
    if (!str(r.change_id) || !str(r.actor_label) || !str(r.kind) || !KINDS.has(r.kind) || !str(r.part_label) || !str(r.at) || !str(r.undo_until)) {
      return null;
    }
    changes.push({
      changeId: r.change_id,
      actorLabel: r.actor_label,
      kind: r.kind as MoodBoardChangeKindWord,
      partLabel: r.part_label,
      shopLabel: str(r.shop_label) ? r.shop_label : null,
      at: r.at,
      undoUntil: r.undo_until,
    });
  }
  return { suggestions, changes };
}
