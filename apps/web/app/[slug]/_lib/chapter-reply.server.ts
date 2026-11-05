import 'server-only';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { createAdminClient } from '@/lib/supabase/admin';
import { guestListIsClosed } from '@/lib/guest-list-closed';
import { REPLY_WINDOW_EVENT_COLUMNS } from '@/lib/reply-window';
import { replyWindowOfRow } from '@/lib/reply-window.server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { chapterAnswers } from '@/lib/invitation-chapters';
import {
  markRemovalSeen,
  readGuestChapterReplies,
  readInvitationChapters,
  writeChapterReplies,
} from '@/lib/invitation-chapters.server';

/**
 * ✉ ONE CHAPTER, ON ITS OWN — the after-invites notices (owner 2026-11-01, plan §9 #7):
 *   · ADDED after this guest replied → one "Yes, I'll be there" / "I can't make it" for that chapter alone;
 *   · REMOVED after they said yes → one OK ("seen"), and the reply row is KEPT (replies are never deleted).
 *
 * Called ONLY from `submitRsvp` (app/[slug]/actions.ts), after that action proved the reply's identity — THIS guest on
 * THIS event — so this file trusts `guestId` and nothing else from the form. The chapter must be on the invitation NOW
 * (re-read), and a closed guest list or a shut reply window answers nothing (the same two doors the reply itself has).
 *
 * The guest's overall answer follows: coming to at least one of the invitation's chapters = `attending`, none =
 * `declined` — the one figure every count, gate and notice already reads.
 */
import { CHAPTER_ANSWER_FIELD, CHAPTER_ID_FIELD, CHAPTER_SEEN_FIELD } from './chapter-reply-fields';

export async function answerOneChapter(eventId: string, guestId: string, formData: FormData): Promise<void> {
  const admin = createAdminClient();
  const blockId = String(formData.get(CHAPTER_ID_FIELD) ?? '').trim();
  const { data: ev, error: evErr } = await admin
    .from('events')
    .select(`slug, guest_count_locked_at, ${REPLY_WINDOW_EVENT_COLUMNS}`)
    .eq('event_id', eventId)
    .maybeSingle();
  if (evErr) logQueryError('answerOneChapter (event)', evErr, { event_id: eventId }, 'will_throw');
  const slug = (ev as { slug?: string | null } | null)?.slug ?? null;
  if (evErr || !ev || !slug) throw new Error('Your answer was not sent. Please try again.');
  const back = (flag: 'error' | 'window') => redirect(`/${slug}?rsvp=${flag}`);

  // OK on "X is no longer on your invitation" — writes only that it was seen.
  if (String(formData.get(CHAPTER_SEEN_FIELD) ?? '') === '1') {
    if (!blockId || !(await markRemovalSeen(admin, guestId, blockId))) back('error');
    revalidatePath(`/${slug}`);
    return;
  }

  const closed = guestListIsClosed({ lockedAt: (ev as { guest_count_locked_at?: string | null }).guest_count_locked_at });
  if (closed || (await replyWindowOfRow(ev as Parameters<typeof replyWindowOfRow>[0])).state !== 'open') back('window');

  // ✉ THIS guest's invitation (owner 2026-11-02): a chapter the hosts took them off cannot be answered here either.
  const chapters = await readInvitationChapters(admin, eventId, guestId);
  if (!chapters) back('error');
  if (!chapters!.some((c) => c.block_id === blockId)) back('error');
  const attending = String(formData.get(CHAPTER_ANSWER_FIELD) ?? '') === 'yes';
  if (!(await writeChapterReplies(admin, guestId, [{ block_id: blockId, attending }]))) back('error');

  // The overall answer follows the chapters.
  const [{ data: guest, error: gErr }, replies] = await Promise.all([
    admin.from('guests').select('rsvp_status').eq('guest_id', guestId).eq('event_id', eventId).maybeSingle(),
    readGuestChapterReplies(admin, guestId),
  ]);
  if (gErr || !guest || replies === null) {
    if (gErr) logQueryError('answerOneChapter (guest)', gErr, { guest_id: guestId }, 'graceful_degrade');
    back('error');
  }
  const answers = chapterAnswers(chapters!, replies, guest!.rsvp_status as string);
  const comingToOne = [...answers.values()].some((a) => a === 'yes');
  const overall = comingToOne ? 'attending' : 'declined';
  if (guest!.rsvp_status !== overall) {
    const { error: upErr } = await admin
      .from('guests')
      .update({ rsvp_status: overall, rsvp_set_by: 'guest', rsvp_responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('guest_id', guestId)
      .eq('event_id', eventId);
    if (upErr) {
      logQueryError('answerOneChapter (overall)', upErr, { guest_id: guestId }, 'will_throw');
      back('error');
    }
  }
  revalidatePath(`/${slug}`);
  revalidatePath(`/dashboard/${eventId}/guests`);
}
