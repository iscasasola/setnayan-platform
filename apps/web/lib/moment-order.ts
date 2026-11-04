/**
 * ⏭ A MOMENT "RIGHT AFTER THE ONE ABOVE" — its words and its place in the order (owner 2026-11-02, DECISION_LOG
 * "SCHEDULE FITS THE COORDINATOR'S TIMELINE AS WRITTEN: 4 ADDITIONS" (1); migration 20271302727358).
 *
 * An untimed moment is a MOMENT with `time_tba` (a chapter with `time_tba` is "Time TBA" — a different thing). Its
 * `start_at` is only an ORDER KEY: the start of the moment it follows (`follows_block_id`), moved with it by the
 * database. It is never a clock — a reader that draws it says "Right after", and a reader that cannot fences it out.
 *
 * Leaf module (no imports beyond the TBA leaf), so a client bundle that only needs the words carries nothing else.
 */
import { TIME_TBA } from './time-tba';
import { timeAsWritten } from './time-shape';

export const RIGHT_AFTER = 'Right after';
/** The longer form, where there is room to say what it is after. */
export const RIGHT_AFTER_LONG = 'Right after the one above';

type Orderable = {
  block_id: string;
  start_at: string | null;
  sort_order?: number | null;
  time_tba?: boolean | null;
  follows_block_id?: string | null;
};

/** A MOMENT with no clock of its own — "right after the one above". A chapter is never one (its TBA is "Time TBA"). */
export function isRightAfter(m: { parent_block_id?: string | null; time_tba?: boolean | null }): boolean {
  return m.time_tba === true && typeof m.parent_block_id === 'string' && m.parent_block_id.length > 0;
}

/**
 * The words in a row's clock column: "Time TBA" inside a TBA chapter, "Right after" for an untimed moment, otherwise
 * the clock `clock(start)` draws. The ONE place a moment's time becomes words for the run of show, "Your schedule" and
 * the supplier's Schedule — so the three can never disagree.
 */
export function momentClockWords(
  m: {
    parent_block_id?: string | null;
    time_tba?: boolean | null;
    start_at: string | null;
    /** 🕑 "About 3:15 PM" · "2:15/2:30 PM" (4 additions (2), lib/time-shape.ts). */
    time_shape?: string | null;
    time_or_minutes?: number | null;
  },
  chapter: { time_tba?: boolean | null } | null,
  clock: (iso: string) => string,
): string {
  if (chapter?.time_tba === true) return TIME_TBA;
  if (isRightAfter(m)) return RIGHT_AFTER;
  return m.start_at ? timeAsWritten({ ...m, start_at: m.start_at }, clock) : '—';
}

function byKey(a: Orderable, b: Orderable): number {
  const sa = a.start_at ?? '';
  const sb = b.start_at ?? '';
  if (sa !== sb) return Date.parse(sa) - Date.parse(sb) || (sa < sb ? -1 : 1);
  const oa = a.sort_order ?? 0;
  const ob = b.sort_order ?? 0;
  if (oa !== ob) return oa - ob;
  // An untimed moment sharing its anchor's key sits after the timed ones at that key.
  const ta = a.time_tba === true ? 1 : 0;
  const tb = b.time_tba === true ? 1 : 0;
  if (ta !== tb) return ta - tb;
  return a.block_id < b.block_id ? -1 : a.block_id > b.block_id ? 1 : 0;
}

/**
 * Moments in the order the day runs: by time, and every untimed moment DIRECTLY after the moment it follows (a chain —
 * C after B after A — stays together). A follower whose anchor is not in the list (deleted, or not shown to this
 * reader) keeps its place by its order key. Never drops a row; a cycle cannot loop.
 */
export function inRunOrder<T extends Orderable>(moments: readonly T[]): T[] {
  const ids = new Set(moments.map((m) => m.block_id));
  const followers = new Map<string, T[]>();
  const roots: T[] = [];
  for (const m of moments) {
    const anchor = m.time_tba === true ? m.follows_block_id ?? null : null;
    if (anchor && anchor !== m.block_id && ids.has(anchor)) {
      const list = followers.get(anchor) ?? [];
      list.push(m);
      followers.set(anchor, list);
    } else {
      roots.push(m);
    }
  }
  for (const list of followers.values()) list.sort(byKey);
  const out: T[] = [];
  const seen = new Set<string>();
  const visit = (m: T) => {
    if (seen.has(m.block_id)) return;
    seen.add(m.block_id);
    out.push(m);
    for (const f of followers.get(m.block_id) ?? []) visit(f);
  };
  for (const r of [...roots].sort(byKey)) visit(r);
  // Only a cycle (A after B after A) is left — kept, by key, so nothing disappears.
  for (const m of [...moments].sort(byKey)) visit(m);
  return out;
}

/** Each moment's position in `inRunOrder` — for a reader that sorts its own lines and needs the run as a tiebreak. */
export function runRank<T extends Orderable>(moments: readonly T[]): Map<string, number> {
  return new Map(inRunOrder(moments).map((m, i) => [m.block_id, i]));
}

/**
 * The moment an untimed moment goes right after, when it is made "right after" from a list: the one directly above it
 * in run order (excluding itself); null when it is the first.
 */
export function momentAbove<T extends Orderable>(moments: readonly T[], blockId: string | null): T | null {
  const all = inRunOrder(moments);
  if (!blockId) return all.at(-1) ?? null;
  const at = all.findIndex((m) => m.block_id === blockId);
  if (at === -1) return all.at(-1) ?? null; // not in the list yet (a new moment): after the last one
  if (at === 0) return null;
  return all[at - 1] ?? null;
}
