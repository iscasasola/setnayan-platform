import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from './supabase/error-detect';
import {
  PAPIC_CHAPTER_UNREAD,
  isPapicChapterRefusal,
  papicChapterTarget,
  papicChaptersFromRows,
  type PapicChapter,
  type PapicChapterRefusal,
} from './papic-chapter';

/**
 * 📷 PAPIC BY CHAPTER — the server half (migration 20271300249267; the pure half is lib/papic-chapter.ts).
 *
 *   readPapicChapters      — the event's chapters as Papic sees them, ONE call (`papic_event_chapters`). On the caller's
 *                            own client for the Home card (RLS: the couple), on the admin client for a camera page.
 *   papicChapterRefusal    — the database's one answer: may THIS person shoot into THIS chapter at THIS instant?
 *   linkCaptureToChapter   — the capture → chapter row; the table's trigger asks the same refusal again.
 *   papicCameraChapter     — the chapter a camera shows: the target, only when this person may shoot into it now.
 *
 * 🛑 HONEST (CLAUDE.md "a failure that renders identically to success or to emptiness"): a failed read is `{ ok: false }`
 * — never `[]`, which would draw "Whole event" over a real meeting — and a refusal that could not be asked is
 * `chapter_unread`, never a yes.
 */

type Read<T> = { ok: true; value: T } | { ok: false };

export async function readPapicChapters(client: SupabaseClient, eventId: string): Promise<Read<PapicChapter[]>> {
  const { data, error } = await client.rpc('papic_event_chapters', { p_event_id: eventId });
  if (error || !Array.isArray(data)) {
    if (error) logQueryError('readPapicChapters', error, { event_id: eventId }, 'graceful_degrade');
    return { ok: false };
  }
  return { ok: true, value: papicChaptersFromRows(data as Record<string, unknown>[]) };
}

/** May this person shoot into this chapter at this instant? null = yes. Asked BEFORE a credit moves. */
export async function papicChapterRefusal(
  admin: SupabaseClient,
  q: { blockId: string; eventId: string; guestId?: string | null; userId?: string | null; atMs: number },
): Promise<PapicChapterRefusal | typeof PAPIC_CHAPTER_UNREAD | null> {
  const { data, error } = await admin.rpc('papic_chapter_capture_refusal', {
    p_block_id: q.blockId,
    p_event_id: q.eventId,
    p_guest_id: q.guestId ?? null,
    p_user_id: q.userId ?? null,
    p_at: new Date(q.atMs).toISOString(),
  });
  if (error) {
    logQueryError('papicChapterRefusal', error, { event_id: q.eventId, block_id: q.blockId }, 'graceful_degrade');
    return PAPIC_CHAPTER_UNREAD;
  }
  if (data === null || data === undefined) return null;
  return isPapicChapterRefusal(data) ? data : PAPIC_CHAPTER_UNREAD;
}

/** The capture → chapter link. The trigger re-checks the window and the person; a refusal there is logged, never thrown. */
export async function linkCaptureToChapter(
  admin: SupabaseClient,
  blockId: string,
  capture: { guestCaptureId: string } | { seatPhotoId: string },
): Promise<boolean> {
  const row: { block_id: string; guest_capture_id: string | null; seat_photo_id: string | null } =
    'guestCaptureId' in capture
      ? { block_id: blockId, guest_capture_id: capture.guestCaptureId, seat_photo_id: null }
      : { block_id: blockId, guest_capture_id: null, seat_photo_id: capture.seatPhotoId };
  const { error } = await admin.from('papic_chapter_captures').insert(row);
  // 23505: this capture is already in this chapter (a replayed record) — that is the outcome we wanted.
  if (error && error.code !== '23505') {
    logQueryError('linkCaptureToChapter', error, { block_id: blockId }, 'graceful_degrade');
    return false;
  }
  return true;
}

/**
 * The chapter a camera shows this person, now: the event's target chapter, ONLY when the database says they may shoot
 * into it at this instant. null = the whole event (as before chapters) — also when the chapters could not be read: the
 * camera then works exactly as it always did.
 */
export async function papicCameraChapter(
  admin: SupabaseClient,
  q: { eventId: string; guestId?: string | null; userId?: string | null; nowMs?: number },
): Promise<{ blockId: string; label: string } | null> {
  const nowMs = q.nowMs ?? Date.now();
  const read = await readPapicChapters(admin, q.eventId);
  if (!read.ok) return null;
  const target = papicChapterTarget(read.value, nowMs);
  if (!target) return null;
  const verdict = await papicChapterRefusal(admin, {
    blockId: target.chapter.blockId,
    eventId: q.eventId,
    guestId: q.guestId,
    userId: q.userId,
    atMs: nowMs,
  });
  return verdict === null ? { blockId: target.chapter.blockId, label: target.chapter.label } : null;
}
