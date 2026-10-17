import type { RunOfShowBlock, RunState } from './run-of-show';
import { rowGuestsMaySee } from './schedule';

/**
 * run-of-show-live.ts — THE GUESTS' LIVE HEADER APPLIES THE CHANGE IT WAS SENT (2026-10-18, live-day polling).
 *
 * 🧯 THE HERD. Every guest's phone subscribes to `postgres_changes` on `event_schedule_blocks`, and every change used
 * to be answered with a re-read of the whole timeline (`fetchRunOfShowBlocks`). One "Done — start Dinner" by the
 * coordinator writes two rows (the block that ends, the block that starts), so 200 guests made 400 database reads in
 * the same half second — on every advance, all day.
 *
 * The change already carries the row. So a guest's header patches its own list from the payload and reads NOTHING:
 *   · INSERT / UPDATE — the row is shown when it passes the guests' fence (`rowGuestsMaySee`, the SAME three conditions
 *     `onlyWhatGuestsMaySee` asks of a query), and taken off the list when it no longer does;
 *   · DELETE — the line leaves the list (the payload's `old` carries the id).
 * 🔒 Whenever the payload cannot settle it — a fence column missing, no id, no label or start — this returns `null` and
 *    the caller RE-READS through the fence (spaced out — `herdDelay`), exactly as before. Unknown is never "show it".
 *
 * Hosts, suppliers and the coordinator keep re-reading on every change: there are a handful of them, and their
 * timelines are not fenced the same way.
 */

export type BlockChange = {
  eventType?: string;
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
};

const RUN_STATES: readonly RunState[] = ['upcoming', 'live', 'done'];

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

/** The new list for a guest's header, or `null` when the payload cannot settle it (re-read through the fence). */
export function applyGuestBlockChange(blocks: readonly RunOfShowBlock[], change: BlockChange): RunOfShowBlock[] | null {
  const kind = change.eventType;
  if (kind === 'DELETE') {
    const id = str(change.old?.block_id);
    if (!id) return null;
    return blocks.filter((b) => b.block_id !== id);
  }
  if (kind !== 'INSERT' && kind !== 'UPDATE') return null;
  const row = change.new ?? null;
  const id = str(row?.block_id);
  if (!row || !id) return null;
  const fence = rowGuestsMaySee(row);
  if (fence === 'unknown') return null;
  if (fence === 'no') return blocks.filter((b) => b.block_id !== id);

  const label = str(row.label);
  const startAt = str(row.start_at);
  if (!label || !startAt) return null;
  const state = str(row.run_state);
  const next: RunOfShowBlock = {
    block_id: id,
    label,
    start_at: startAt,
    end_at: str(row.end_at),
    location: str(row.location),
    run_state: state && (RUN_STATES as readonly string[]).includes(state) ? (state as RunState) : 'upcoming',
    actual_start_at: str(row.actual_start_at),
    block_type: str(row.block_type) ?? '',
    is_public: true,
  };
  // The common change — an advance — keeps the line where it was (ties keep the read's sort_order).
  const at = blocks.findIndex((b) => b.block_id === id);
  if (at >= 0 && blocks[at]!.start_at === startAt) return blocks.map((b, i) => (i === at ? next : b));
  const others = blocks.filter((b) => b.block_id !== id);
  // Otherwise by start time — the order the fenced read returns (start_at, then sort_order).
  return [...others, next].sort((a, b) => (a.start_at < b.start_at ? -1 : a.start_at > b.start_at ? 1 : 0));
}
