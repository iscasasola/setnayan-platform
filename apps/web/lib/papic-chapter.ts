/**
 * 📷 PAPIC BY CHAPTER — the pure half (owner 2026-11-01, DECISION_LOG "THE PAPIC CARD ON HOME SHOOTS INTO A CHAPTER" ·
 * "A CHAPTER'S PHOTOS: WHO + WHEN" · "PAPIC BY CHAPTER MOVES UP"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md §3, §4).
 *
 *   · WHICH chapter Papic shoots into: the one the host PICKED on the Home card, else the one happening NOW (the latest
 *     to open, when several run at once). A picked chapter that has ended stops holding; the one happening now takes over.
 *   · WHEN: its window — the database works it out (`papic_event_chapters`, migration 20271300249267) from the chapter's
 *     own start → end (the end of its day when it has none) and the host's Start now. Here it is only compared with now.
 *   · WHO may shoot into it: its photo rule (People in this chapter · Only people tagged · Everybody) — ENFORCED in the
 *     database (`papic_chapter_capture_refusal`, asked by both capture lanes before a credit moves, and again by the
 *     link's trigger). Nothing here decides who may shoot; it only says it.
 *   · WHAT A CAPTURE DOES (`papicChapterCaptureDecision`): into the chapter when the database says yes; otherwise the
 *     shot is NEVER lost when the camera was open anyway — it lands event-wide (Unsorted), exactly as before chapters —
 *     and is refused only when the chapter was the camera's only way in (a meeting before the day).
 *
 * Counts and Add more stay event-wide on the card; the chapter adds one line, "This chapter: N photos".
 * Nothing here reads the database or knows a screen.
 */

import type { PhotoWho } from './schedule-chapters';
import { PHOTO_WHO_WORDS, isPhotoWho } from './schedule-chapters';

/** A chapter as Papic sees it — one row of `papic_event_chapters`. Times are REAL instants (ISO); `startAt` is the wall clock. */
export type PapicChapter = {
  blockId: string;
  label: string;
  /** The chapter's own start as stored (the venue's wall clock in a UTC column) — null: Time TBA. */
  startAt: string | null;
  photoWho: PhotoWho;
  /** Real instant the window opens (its start, or Start now) — null: it has no time and nobody started it. */
  opensAt: string | null;
  closesAt: string | null;
  openedEarlyAt: string | null;
  picked: boolean;
  /** Captures shot into it. */
  captures: number;
};

export type PapicChapterState = 'not_open_yet' | 'open' | 'closed';

/** The dropdown's key for "no chapter" — Papic shoots into the whole event, as before chapters. */
export const PAPIC_WHOLE_EVENT = 'whole';
export const PAPIC_WHOLE_EVENT_WORDS = 'Whole event';
export const PAPIC_SHOOTS_INTO = 'Shooting into';

/** Why a capture cannot go into a chapter — the database's words (`papic_chapter_capture_refusal`). */
export const PAPIC_CHAPTER_REFUSALS = ['not_a_chapter', 'chapter_not_open', 'chapter_closed', 'not_in_chapter'] as const;
export type PapicChapterRefusal = (typeof PAPIC_CHAPTER_REFUSALS)[number];
/** The refusal could not be asked (a failed read) — never treated as a yes. */
export const PAPIC_CHAPTER_UNREAD = 'chapter_unread';

export function isPapicChapterRefusal(v: unknown): v is PapicChapterRefusal {
  return typeof v === 'string' && (PAPIC_CHAPTER_REFUSALS as readonly string[]).includes(v);
}

/** What a camera says when a shot is refused for its chapter. */
export const PAPIC_CHAPTER_REFUSAL_WORDS: Readonly<Record<PapicChapterRefusal | typeof PAPIC_CHAPTER_UNREAD, string>> = {
  not_a_chapter: 'That chapter is gone. Close the camera and open it again.',
  chapter_not_open: 'This chapter hasn’t started yet.',
  chapter_closed: 'This chapter has ended.',
  not_in_chapter: 'Only the people in this chapter can shoot into it.',
  chapter_unread: 'We couldn’t check this chapter just now. Your shot is kept and will try again.',
};

function ms(iso: string | null): number {
  return iso ? Date.parse(iso) : NaN;
}

/** Where a chapter's window stands at `nowMs` (a real instant). No window (Time TBA, not started) = not open yet. */
export function papicChapterState(c: Pick<PapicChapter, 'opensAt' | 'closesAt'>, nowMs: number): PapicChapterState {
  const o = ms(c.opensAt);
  const e = ms(c.closesAt);
  if (!Number.isFinite(o) || nowMs < o) return 'not_open_yet';
  if (Number.isFinite(e) && nowMs > e) return 'closed';
  return 'open';
}

/**
 * The chapter Papic shoots into at `nowMs`: the host's pick while it has not ended, else the one happening now (the
 * latest to open; on a tie the first in the list). Null: the whole event, as before chapters.
 */
export function papicChapterTarget(
  chapters: readonly PapicChapter[],
  nowMs: number,
): { chapter: PapicChapter; why: 'picked' | 'now' } | null {
  const picked = chapters.find((c) => c.picked);
  if (picked && papicChapterState(picked, nowMs) !== 'closed') return { chapter: picked, why: 'picked' };
  let best: PapicChapter | null = null;
  for (const c of chapters) {
    if (papicChapterState(c, nowMs) !== 'open') continue;
    if (!best || ms(c.opensAt) > ms(best.opensAt)) best = c;
  }
  return best ? { chapter: best, why: 'now' } : null;
}

/** A row of `papic_event_chapters` (PostgREST sends strings; a driver may hand a Date). */
export function papicChaptersFromRows(rows: readonly Record<string, unknown>[]): PapicChapter[] {
  const iso = (v: unknown): string | null =>
    v instanceof Date ? (Number.isFinite(v.getTime()) ? v.toISOString() : null) : typeof v === 'string' && v.length > 0 ? v : null;
  return rows
    .filter((r) => typeof r.block_id === 'string')
    .map((r) => ({
      blockId: r.block_id as string,
      label: String(r.label ?? '').trim() || 'Untitled chapter',
      startAt: iso(r.start_at),
      photoWho: isPhotoWho(r.photo_who) ? r.photo_who : 'chapter',
      opensAt: iso(r.opens_at),
      closesAt: iso(r.closes_at),
      openedEarlyAt: iso(r.opened_early_at),
      picked: r.picked === true,
      captures: typeof r.captures === 'number' ? r.captures : Number(r.captures ?? 0) || 0,
    }));
}

const TZ = 'Asia/Manila';

/** "2 PM" · "2:30 PM" on the venue's clock, from a REAL instant. */
export function papicClock(iso: string | null, tz = TZ): string {
  const t = ms(iso);
  if (!Number.isFinite(t)) return '';
  const parts = new Intl.DateTimeFormat('en-PH', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(new Date(t));
  const h = parts.find((p) => p.type === 'hour')?.value ?? '';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const ap = (parts.find((p) => p.type === 'dayPeriod')?.value ?? '').toUpperCase().replace(/\./g, '');
  return `${h}${m === '00' ? '' : `:${m}`} ${ap}`.trim();
}

function papicDay(iso: string | null, tz = TZ): string {
  const t = ms(iso);
  if (!Number.isFinite(t)) return '';
  return new Intl.DateTimeFormat('en-PH', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(t));
}

function sameDay(a: number, b: number, tz = TZ): boolean {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(new Date(a)) === f.format(new Date(b));
}

/** The chapter's line on the card: "On now · until 4 PM" · "Starts 2 PM" · "Starts Tue, Nov 10, 2 PM" · "Ended 4 PM" · "No time yet". */
export function papicChapterWindowWords(c: Pick<PapicChapter, 'opensAt' | 'closesAt'>, nowMs: number, tz = TZ): string {
  const state = papicChapterState(c, nowMs);
  if (state === 'open') return c.closesAt ? `On now · until ${papicClock(c.closesAt, tz)}` : 'On now';
  if (state === 'closed') return `Ended ${papicClock(c.closesAt, tz)}`;
  if (!c.opensAt) return 'No time yet';
  return sameDay(ms(c.opensAt), nowMs, tz) ? `Starts ${papicClock(c.opensAt, tz)}` : `Starts ${papicDay(c.opensAt, tz)}, ${papicClock(c.opensAt, tz)}`;
}

/** The dropdown's line for one chapter: "Meeting with caterer · 2 PM". */
export function papicChapterOptionWords(c: Pick<PapicChapter, 'label' | 'opensAt'>, tz = TZ): string {
  return c.opensAt ? `${c.label} · ${papicClock(c.opensAt, tz)}` : c.label;
}

/** The ruling's one line, event-wide counts unchanged: "This chapter: 12 photos" (1 photo). */
export function papicChapterCountWords(n: number): string {
  return `This chapter: ${n} ${n === 1 ? 'photo' : 'photos'}`;
}

/** Who may shoot, in the chapter's own words (the ⓘ). */
export function papicChapterWhoWords(who: PhotoWho): string {
  if (who === 'everybody') return 'Everybody on your guest list can shoot into it.';
  if (who === 'tagged') return 'Only the people named on it, one by one, can shoot into it — and you.';
  return `${PHOTO_WHO_WORDS.chapter} can shoot into it — the people, groups and roles on its moments, its suppliers, and you.`;
}

/** Start now is offered while a chapter has not opened yet. */
export function papicChapterCanStartNow(c: Pick<PapicChapter, 'opensAt' | 'closesAt'>, nowMs: number): boolean {
  return papicChapterState(c, nowMs) === 'not_open_yet';
}

/**
 * 📷 WHAT ONE CAPTURE DOES — the only place both lanes decide it.
 *   chapterId  — the chapter the camera showed (null: none — exactly as before chapters)
 *   verdict    — the database's answer for this person at the shutter: null = may shoot in, else why not (or unread)
 *   laneOpen   — whether the camera was open anyway (the event day, Let everybody shoot now, a seat's own window)
 *
 *   into      — link the capture to the chapter
 *   unsorted  — record it event-wide (no chapter) — the camera was open anyway, so the shot is never lost
 *   refuse    — the chapter was the only way in, and it said no: refuse with its reason
 *   lane      — no chapter: the lane's own gate decides, unchanged
 */
export type PapicChapterCaptureDecision =
  | { kind: 'into'; blockId: string }
  | { kind: 'unsorted' }
  | { kind: 'refuse'; error: PapicChapterRefusal | typeof PAPIC_CHAPTER_UNREAD }
  | { kind: 'lane' };

export function papicChapterCaptureDecision(input: {
  chapterId: string | null;
  verdict: PapicChapterRefusal | typeof PAPIC_CHAPTER_UNREAD | null;
  laneOpen: boolean;
}): PapicChapterCaptureDecision {
  if (!input.chapterId) return { kind: 'lane' };
  if (input.verdict === null) return { kind: 'into', blockId: input.chapterId };
  if (input.laneOpen) return { kind: 'unsorted' };
  return { kind: 'refuse', error: input.verdict };
}

/** A chapter id as a camera sends it — a uuid, or nothing. */
export function readChapterId(v: unknown): string | null {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim()) ? v.trim().toLowerCase() : null;
}
