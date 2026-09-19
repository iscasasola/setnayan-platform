'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { QUESTION_HINT_MAX, QUESTION_PROMPT_MAX } from '@/lib/emcee-questions';

/**
 * The emcee's question set — write actions. (Register row DAY-7.)
 *
 * Same shape as `./actions.ts` (his segments): a vendor-owned reusable list,
 * plain form posts, redirect back. AUTHORISATION IS RLS'S —
 * `vendor_questions_owner_write` scopes every write to `current_vendor_ids()`;
 * a forged `question_id` belonging to another vendor matches zero rows.
 *
 * RETIRE, NEVER DELETE. A past couple's answer references the question row;
 * deleting it would cascade their answer away. So there is no delete here.
 */

const BASE = '/vendor-dashboard/activities';
const ANCHOR = '#questions';

function back(params?: { error?: string }): never {
  const qs = params?.error ? `?${new URLSearchParams({ error: params.error })}` : '?saved=1';
  redirect(`${BASE}${qs}${ANCHOR}`);
}

async function ensureProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/vendor-dashboard/activities');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, profile };
}

function readHint(formData: FormData): string | null {
  const raw = String(formData.get('hint') ?? '').trim();
  return raw ? raw.slice(0, QUESTION_HINT_MAX) : null;
}

export async function addQuestion(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  const prompt = String(formData.get('prompt') ?? '').trim();
  if (!prompt) back({ error: 'Write the question first.' });
  if (prompt.length > QUESTION_PROMPT_MAX) {
    back({ error: `That question is too long — ${QUESTION_PROMPT_MAX} characters max.` });
  }

  const { data: last } = await supabase
    .from('vendor_questions')
    .select('display_order')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((last as { display_order: number } | null)?.display_order ?? 0) + 10;

  const { error } = await supabase.from('vendor_questions').insert({
    vendor_profile_id: profile.vendor_profile_id,
    prompt,
    hint: readHint(formData),
    display_order: nextOrder,
  });
  if (error) back({ error: 'Could not save that question. Please try again.' });

  revalidatePath(BASE);
  back();
}

export async function updateQuestion(formData: FormData) {
  const { supabase } = await ensureProfile();
  const questionId = String(formData.get('question_id') ?? '');
  if (!questionId) back({ error: 'Missing question.' });

  const prompt = String(formData.get('prompt') ?? '').trim();
  if (!prompt) back({ error: 'A question cannot be blank — use “Stop asking” instead.' });

  // `.select()` so a write RLS silently matched to zero rows is not reported
  // as saved (a zero-row UPDATE is success-shaped).
  const { data, error } = await supabase
    .from('vendor_questions')
    .update({
      prompt: prompt.slice(0, QUESTION_PROMPT_MAX),
      hint: readHint(formData),
      updated_at: new Date().toISOString(),
    })
    .eq('question_id', questionId)
    .select('question_id');
  if (error || !data || data.length === 0) back({ error: 'Could not update that question.' });

  revalidatePath(BASE);
  back();
}

/** Stop asking / ask again. Soft, so past couples' answers keep resolving. */
export async function toggleQuestionAsked(formData: FormData) {
  const { supabase } = await ensureProfile();
  const questionId = String(formData.get('question_id') ?? '');
  const next = String(formData.get('is_asked') ?? '') === 'true';
  if (!questionId) back({ error: 'Missing question.' });

  const { data, error } = await supabase
    .from('vendor_questions')
    .update({ is_asked: next, updated_at: new Date().toISOString() })
    .eq('question_id', questionId)
    .select('question_id');
  if (error || !data || data.length === 0) back({ error: 'Could not change that question.' });

  revalidatePath(BASE);
  back();
}
