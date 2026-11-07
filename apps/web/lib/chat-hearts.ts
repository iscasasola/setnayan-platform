/**
 * ♥ MESSAGE HEARTS — the model (THE ONE BUILD, 8 Nov 2026; owner v111 "tap = heart"; spec
 * plans/supplier_one_build_2026-11-08 B1 step 7 + §3b).
 *
 * One row per (message, person) in `public.chat_message_hearts` (migration 20271325581544): `hearted` true/false, never
 * deleted, so every change is an INSERT or UPDATE the stream hears on its EXISTING `chat-${threadId}` channel. The
 * write goes through the browser client under that table's RLS (own row only, on a message the caller can read, never
 * across a block) — no server action, no new route. PURE — no I/O here; the stream does the read, the write and the
 * subscription.
 *
 * 🚫 A heart is a heart. Nothing here turns a message into a decision (owner removed "bubble → decision", 8 Nov).
 */

/** messageId → the set of user ids whose heart is ON. */
export type HeartsByMessage = ReadonlyMap<string, ReadonlySet<string>>;

export type HeartRow = { message_id: string; user_id: string; hearted: boolean };

/** The columns the stream reads and hears — the row's identity and its flag. */
export const HEART_SELECT = 'message_id, user_id, hearted' as const;

/** Build the map from rows (only `hearted` rows count). */
export function heartsFrom(rows: readonly HeartRow[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r || !r.hearted || typeof r.message_id !== 'string' || typeof r.user_id !== 'string') continue;
    const set = out.get(r.message_id) ?? new Set<string>();
    set.add(r.user_id);
    out.set(r.message_id, set);
  }
  return out;
}

/** Apply one row (an optimistic toggle, or a realtime INSERT/UPDATE) — returns a NEW map; the input is untouched. */
export function applyHeart(map: HeartsByMessage, row: HeartRow): Map<string, Set<string>> {
  const next = new Map<string, Set<string>>();
  for (const [k, v] of map) next.set(k, new Set(v));
  const set = next.get(row.message_id) ?? new Set<string>();
  if (row.hearted) set.add(row.user_id);
  else set.delete(row.user_id);
  if (set.size > 0) next.set(row.message_id, set);
  else next.delete(row.message_id);
  return next;
}

/** What the chip under a bubble says: nothing at 0, "♥" at 1, "♥ N" from 2 (v111: count shown from two). */
export function heartChip(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count >= 2 ? `♥ ${count}` : '♥';
}

/**
 * Does a tap on this element mean "heart the bubble"? Never when it lands on something that does its own thing inside
 * the bubble — a link, a button, a form field, a media player, or the quote card's controls.
 */
export function tapMeansHeart(target: { closest?: (sel: string) => unknown } | null | undefined): boolean {
  if (!target || typeof target.closest !== 'function') return false;
  return !target.closest('a, button, input, textarea, select, label, video, audio, summary, [data-no-heart]');
}
