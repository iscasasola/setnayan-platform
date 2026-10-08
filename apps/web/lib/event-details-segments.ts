/**
 * EVENT DETAILS — THREE SEGMENTS: EVENT · ACCESS · SETTINGS (the pure half).
 *
 * ⚖ Owner 2026-10-07, DECISION_LOG "EVENT DETAILS IS THREE SEGMENTS: EVENT ·
 * ACCESS · SETTINGS" (*"approve all"* on `EVENT_DETAILS_ARRANGE_2026-10-07_fable.md`):
 * one segmented control on top, one body, one row shape — a label, a one-line
 * summary, and ONE thing on the right: › (lives elsewhere — jump), ⌄ (unfolds
 * here) or a switch. Nothing on the page writes the Event Hub draft, so the
 * Maker's Undo · Apply are gone from it. Owner, 2026-10-08: *"why is there
 * still undo and apply?"*
 *
 * 📏 MINIMAL WORDS (owner 2026-10-07 on the More-menu pages, applied here
 * 2026-10-08): a row's summary is the event's own DATA — never a sentence
 * about the row. Help sits behind ⓘ.
 *
 * 🩺 HONEST READS. A summary is built from a `Read`: a read that FAILED says
 * so (`COULD_NOT_LOAD`), a part the couple did not share says so
 * (`HIDDEN_BY_THE_COUPLE`) — neither is ever drawn as "0" or as an empty list.
 *
 * Pure (no I/O): the page reads it, the guards read it.
 */
import { COULD_NOT_LOAD, HIDDEN_BY_THE_COUPLE } from './event-details-sheet';
import { formatCount } from './format-number';
import { formatPhp, formatPhpRounded } from './php';

/** The three segments, in the owner's order. */
export const DETAILS_SEGMENTS = [
  { key: 'event', title: 'Event' },
  { key: 'access', title: 'Access' },
  { key: 'settings', title: 'Settings' },
] as const;
export type DetailsSegmentKey = (typeof DETAILS_SEGMENTS)[number]['key'];

/** `?view=` → the segment it names; anything else is the first one. */
export function parseDetailsView(raw: unknown): DetailsSegmentKey {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return DETAILS_SEGMENTS.some((s) => s.key === v) ? (v as DetailsSegmentKey) : 'event';
}

/** The two plain headings of the Event segment. */
export const STILL_YOURS = 'Still yours to change';
export const SETTLED = 'Settled';
/** The Settled group's ONE note (behind its ⓘ) — replaces the per-row padlocks. */
export const SETTLED_NOTE = 'Held by your bookings — a booked supplier counts on these. Contact support to change one.';

/** A read, as the page holds it: measured, failed, or not this viewer's to see. */
export type Read<T> = { state: 'ok'; v: T } | { state: 'failed' } | { state: 'hidden' };

export const ok = <T,>(v: T): Read<T> => ({ state: 'ok', v });
export const FAILED: Read<never> = { state: 'failed' };
export const HIDDEN: Read<never> = { state: 'hidden' };

/** What a failed or hidden read says — the ONE place either word is chosen. */
function notOk(r: { state: 'failed' } | { state: 'hidden' }): string {
  return r.state === 'hidden' ? HIDDEN_BY_THE_COUPLE : COULD_NOT_LOAD;
}

/** First filled parts, joined; nothing filled → `empty`. */
export function line(parts: ReadonlyArray<string | null | undefined | false>, empty: string): string {
  const shown = parts.filter((p): p is string => typeof p === 'string' && p.trim() !== '');
  return shown.length === 0 ? empty : shown.join(' · ');
}

/** Guests › — "180 listed · 96 replied · 3 asking to join". */
export function guestsLine(r: Read<{ listed: number; replied: number; asking: number }>): string {
  if (r.state !== 'ok') return notOk(r);
  const { listed, replied, asking } = r.v;
  return line(
    [
      listed > 0 ? `${formatCount(listed)} listed` : null,
      replied > 0 ? `${formatCount(replied)} replied` : null,
      asking > 0 ? `${formatCount(asking)} asking to join` : null,
    ],
    'None listed yet',
  );
}

/** Money › — "₱62,000 paid · ₱84,000 to go · target ₱180,000". */
export function moneyLine(r: Read<{ paid: number; owed: number; target: number | null }>): string {
  if (r.state !== 'ok') return notOk(r);
  const { paid, owed, target } = r.v;
  return line(
    [
      `${formatPhpRounded(paid)} paid`,
      owed > 0 ? `${formatPhpRounded(owed)} to go` : null,
      target != null && target > 0 ? `target ${formatPhpRounded(target)}` : null,
    ],
    'Nothing yet',
  );
}

/** Purchases › — what was bought from Setnayan: "Pro · AI · Papic 40 of 50 · ₱2,499 paid". */
export function purchasesLine(p: {
  pro: Read<boolean>;
  ai: boolean;
  papic: Read<{ remaining: number; total: number } | null>;
  paid: Read<number>;
}): string {
  // A refused money read is the couple's choice — say it once, never as "₱0".
  if (p.paid.state === 'hidden') return HIDDEN_BY_THE_COUPLE;
  if (p.pro.state === 'failed' || p.papic.state === 'failed' || p.paid.state === 'failed') return COULD_NOT_LOAD;
  const pro = p.pro.state === 'ok' && p.pro.v;
  const papic = p.papic.state === 'ok' ? p.papic.v : null;
  const paid = p.paid.state === 'ok' ? p.paid.v : 0;
  return line(
    [
      pro ? 'Pro' : null,
      p.ai ? 'AI' : null,
      papic ? `Papic ${formatCount(papic.remaining)} of ${formatCount(papic.total)}` : null,
      paid > 0 ? `${formatPhp(paid)} paid` : null,
    ],
    'Nothing yet',
  );
}

/** Event Hub › — "Classic · Cormorant · 9 of 18 in place" (the Finish card, folded in). */
export function hubLine(h: { look: string | null; font: string | null; done: number | null; total: number | null }): string {
  return line(
    [h.look, h.font, h.done != null && h.total != null && h.total > 0 ? `${formatCount(h.done)} of ${formatCount(h.total)} in place` : null],
    'Not started',
  );
}

/** Suppliers › — "3 booked · Kuya Mike · Lumen · Casa Flora". */
export function suppliersLine(r: Read<string[]>): string {
  if (r.state !== 'ok') return notOk(r);
  return r.v.length === 0 ? 'None booked yet' : [`${formatCount(r.v.length)} booked`, ...r.v.slice(0, 3)].join(' · ');
}

/** The Access segment's badge — the people, counted from the rows; a failed read shows no number. */
export function accessBadge(rows: ReadonlyArray<unknown> | null): string | null {
  return rows && rows.length > 0 ? formatCount(rows.length) : null;
}
