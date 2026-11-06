'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { hostAnswersThisScreenChanged } from '@/lib/host-answers-merge';
import { limitedHelperRefusal } from '@/lib/host-gate';

/**
 * ❓ THE COUPLE ANSWERS A SUPPLIER'S QUESTIONS — in that supplier's room in their event (owner 2026-11-04, verbatim
 * "Yes, every supplier"; DECISION_LOG "QUESTIONS FOR THE COUPLE — EVERY SUPPLIER, NOT HOSTS ONLY").
 *
 * The host's copy of this (`schedule/question-answers-actions.ts` · `saveHostAnswers`) is unchanged. Same rules:
 *   • AUTHORISATION IS RLS'S — `event_question_answers_host_write` admits the couple of this event only.
 *   • 👥 two hosts never overwrite each other — only the boxes THIS screen changed are written or cleared
 *     (`lib/host-answers-merge.ts`).
 *   • an emptied box CLEARS that answer rather than saving whitespace.
 * Plus one more: only questions that belong to THIS supplier are written from this form — a forged box id for
 * another supplier's question is dropped, not saved under the wrong name.
 *
 * 💾 A save never resets the screen: this returns a state for the form, no redirect.
 */

export type SaveAnswersState =
  | { status: 'idle' }
  | { status: 'saved' }
  | { status: 'error'; message: string };

export async function saveSupplierAnswers(
  _prev: SaveAnswersState,
  formData: FormData,
): Promise<SaveAnswersState> {
  const eventId = String(formData.get('event_id') ?? '');
  const vendorProfileId = String(formData.get('vendor_profile_id') ?? '');
  const workspacePath = String(formData.get('return_path') ?? '');
  if (!eventId || !vendorProfileId) return { status: 'error', message: 'Missing event.' };

  const refusal = await limitedHelperRefusal(eventId, 'vendors');
  if (refusal) return { status: 'error', message: refusal };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Please sign in again.' };

  const { data: own, error: ownError } = await supabase
    .from('vendor_questions')
    .select('question_id')
    .eq('vendor_profile_id', vendorProfileId);
  if (ownError) return { status: 'error', message: 'We couldn’t save your answers. Please try again.' };
  const theirs = new Set(((own ?? []) as { question_id: string }[]).map((q) => q.question_id));

  const changed = hostAnswersThisScreenChanged(formData.entries());
  const now = new Date().toISOString();
  const upserts = changed.upserts
    .filter(({ questionId }) => theirs.has(questionId))
    .map(({ questionId, answer }) => ({
      event_id: eventId,
      question_id: questionId,
      answer,
      answered_by: user.id,
      updated_at: now,
    }));
  const clears = changed.clears.filter((id) => theirs.has(id));

  if (upserts.length > 0) {
    const { data, error } = await supabase
      .from('event_question_answers')
      .upsert(upserts, { onConflict: 'event_id,question_id' })
      .select('question_id');
    // A refused write is not "saved" — count what actually landed.
    if (error || !data || data.length !== upserts.length) {
      return { status: 'error', message: 'We couldn’t save every answer. Nothing you typed was lost — please try again.' };
    }
  }
  if (clears.length > 0) {
    const { error } = await supabase
      .from('event_question_answers')
      .delete()
      .eq('event_id', eventId)
      .in('question_id', clears);
    if (error) {
      return { status: 'error', message: 'We couldn’t clear an answer. Please try again.' };
    }
  }

  if (workspacePath.startsWith(`/dashboard/${eventId}/`)) revalidatePath(workspacePath);
  return { status: 'saved' };
}
