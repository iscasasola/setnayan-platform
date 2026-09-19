'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cleanAnswer } from '@/lib/emcee-questions';

/**
 * The couple answers their host's questions. (DAY-7.)
 *
 * AUTHORISATION IS RLS'S. `event_question_answers_host_write` scopes every
 * write to `current_couple_event_ids()` — the couple, never an invited guest.
 * Someone else's `eventId` matches zero rows; this file does not re-check it.
 *
 * One form saves every answer at once, because a couple fills these in one
 * sitting. An emptied box CLEARS that answer rather than saving whitespace.
 */

function back(eventId: string, flag: 'saved' | 'error'): never {
  redirect(`/dashboard/${eventId}/schedule?host_answers=${flag}#host-questions`);
}

export async function saveHostAnswers(formData: FormData) {
  const eventId = String(formData.get('event_id') ?? '');
  if (!eventId) redirect('/dashboard');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const upserts: Array<{
    event_id: string;
    question_id: string;
    answer: string;
    answered_by: string;
    updated_at: string;
  }> = [];
  const clears: string[] = [];
  const now = new Date().toISOString();

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('answer:')) continue;
    const questionId = key.slice('answer:'.length);
    if (!questionId) continue;
    const answer = cleanAnswer(value);
    if (answer === null) clears.push(questionId);
    else
      upserts.push({
        event_id: eventId,
        question_id: questionId,
        answer,
        answered_by: user.id,
        updated_at: now,
      });
  }

  if (upserts.length > 0) {
    const { data, error } = await supabase
      .from('event_question_answers')
      .upsert(upserts, { onConflict: 'event_id,question_id' })
      .select('question_id');
    // A refused write is not "saved" — count what actually landed.
    if (error || !data || data.length !== upserts.length) back(eventId, 'error');
  }
  if (clears.length > 0) {
    const { error } = await supabase
      .from('event_question_answers')
      .delete()
      .eq('event_id', eventId)
      .in('question_id', clears);
    if (error) back(eventId, 'error');
  }

  revalidatePath(`/dashboard/${eventId}/schedule`);
  back(eventId, 'saved');
}
