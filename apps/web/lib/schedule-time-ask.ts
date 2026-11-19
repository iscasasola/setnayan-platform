/**
 * schedule-time-ask.ts — 🗓 THE TIME-CHANGE CARD, BOTH WAYS (Unichat part F, owner 2026-11-20; drawing
 * `build-sessions/UNICHAT-LIVE-2026-11-19.html`, card type `time`).
 *
 * ONE FACT, ONE HOME: an ask is the shipped `event_schedule_suggestions` row — a supplier's request (`to_host`) or a
 * host's / coordinator's ask of a supplier (`to_supplier`, `lib/schedule-ask.ts`). Nothing new is stored. When such an
 * ask is written and WAITS, one Setnayan line goes into the (event × shop) conversation; the stream draws it as the
 * time-change card and the card reads the row's own state back (`findTimeAsk`) — so Approve · Decline · Accept · Take
 * back in the chat are the same doors the Schedule pages press, and an answer given on either shows on both.
 *
 * The lines (exact words — `timeAskFromLine` reads them back, never guessed):
 *   · "Time change asked · Sound check · 3:30 PM → 3:00 PM"        a supplier asks to move its moment
 *   · "New moment asked · Crew call · 12:00 PM"                     a supplier asks to add one
 *   · "Host asks a new time · Detail shots · 10:00 AM → 9:30 AM"    the host or coordinator asks the supplier
 * And the quiet line of a backstage moment that went straight in (20 Nov ruling) — a plain line, no card:
 *   · "Lumina set Crew call for 12:00 PM"
 * 🔒 lib/schedule-time-ask.test.ts
 */
import { clockWords } from './schedule-chapters';

import { TIME_ASK_HEADS as HEADS, timeAskFromLine, type TimeAskBy, type TimeAskLine } from './chat-card-lines';

// The reader lives with the stream's other line readers (`lib/chat-card-lines.ts` — no imports, so the stream can ask
// "is this a card?" for free); the writer and the row matching live here.
export { timeAskFromLine, type TimeAskBy, type TimeAskLine };

/** A label as it rides a line: one line, no arrow (the arrow is the line's own separator). */
function lineLabel(label: string | null | undefined): string {
  return (label ?? '').replace(/\s+/g, ' ').replace(/→/g, '-').trim().slice(0, 120) || 'a moment';
}

/** The line an ask posts, or null when it names no new time (words only — nothing for a time card to show). */
export function timeAskLine(args: { by: TimeAskBy; add?: boolean; label: string | null; fromIso?: string | null; toIso: string | null }): string | null {
  const to = clockWords(args.toIso);
  if (!to) return null;
  const label = lineLabel(args.label);
  if (args.by === 'supplier' && args.add) return `${HEADS.add} · ${label} · ${to}`;
  const from = clockWords(args.fromIso ?? null);
  const head = args.by === 'host' ? HEADS.host : HEADS.move;
  return from && from !== to ? `${head} · ${label} · ${from} → ${to}` : `${head} · ${label} · ${to}`;
}

/** "Lumina set Crew call for 12:00 PM" — the quiet line for a backstage moment that applied at once. */
export function backstageSetLine(args: { shop: string; label: string | null; toIso: string | null }): string | null {
  const to = clockWords(args.toIso);
  if (!to) return null;
  return `${args.shop.trim() || 'The supplier'} set ${lineLabel(args.label)} for ${to}`;
}

/* ── The row behind a line ───────────────────────────────────────────────────────────────────────────────────────── */

// The ask card's own narrow read — NOT the table's canonical column list (other reads of event_schedule_suggestions stay as they are).
export const TIME_ASK_CARD_READ = 'suggestion_id, event_id, block_id, kind, direction, status, proposed_label, proposed_start_at, created_at';

export type TimeAskRow = {
  suggestion_id: string;
  event_id: string;
  block_id: string | null;
  kind: string;
  direction?: string | null;
  status: string;
  proposed_label: string | null;
  proposed_start_at: string | null;
  created_at: string;
};

/** How long after its row a line may be written and still be that row's line (the insert, the settle, the post). */
export const TIME_ASK_LINE_SLACK_MS = 120_000;

/**
 * The request a line speaks for, among the (event × shop) requests: the same direction, the same new clock, written no
 * more than two minutes before the line — the latest such. No match is null: the card then says the ask is gone,
 * never the state of some other request.
 */
export function findTimeAsk<T extends TimeAskRow>(rows: readonly T[], line: TimeAskLine, lineAt: string): T | null {
  const at = Date.parse(lineAt);
  if (!Number.isFinite(at)) return null;
  const wanted = line.by === 'host' ? 'to_supplier' : 'to_host';
  const fits = rows.filter((r) => {
    const dir = r.direction === 'to_supplier' ? 'to_supplier' : 'to_host';
    if (dir !== wanted) return false;
    if (line.by === 'supplier' && (line.add ? r.kind !== 'new' : r.kind !== 'adjust')) return false;
    if (line.by === 'host' && r.kind !== 'adjust') return false;
    if (clockWords(r.proposed_start_at) !== line.to) return false;
    const made = Date.parse(r.created_at);
    return Number.isFinite(made) && made <= at + 5_000 && at - made <= TIME_ASK_LINE_SLACK_MS;
  });
  fits.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return fits[0] ?? null;
}

/** Whose press the open ask waits for, and what the viewer may do with it. */
export type TimeAskTurn = 'approve' | 'accept' | 'take_back' | 'waiting';

export function timeAskTurn(line: Pick<TimeAskLine, 'by'>, viewer: 'vendor' | 'couple'): TimeAskTurn {
  if (line.by === 'supplier') return viewer === 'couple' ? 'approve' : 'take_back';
  return viewer === 'vendor' ? 'accept' : 'waiting';
}

/** The answered ask, in the drawing's words ("✓ Sound check → 3:00 PM" · "… · declined" · "… · taken back"). */
export function timeAskSettledWords(line: TimeAskLine, status: string): string | null {
  const what = line.add ? `New · ${line.label} ${line.to}` : `${line.label} → ${line.to}`;
  if (status === 'accepted') return `✓ ${what}`;
  if (status === 'declined') return `${what} · declined`;
  if (status === 'withdrawn') return `${what} · taken back`;
  if (status === 'answered_by_host') return `${what} · answered`;
  return null;
}
