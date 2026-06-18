'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  MAX_BESPOKE_ROUNDS_PER_EVENT,
  isBespokeStyleKey,
  type BespokeStyleKey,
} from '@/lib/bespoke-monogram-shared';
import { buildBespokePrompt } from '@/lib/bespoke-monogram-engine';
import { generateBespokeCandidates } from '@/lib/bespoke-monogram';

/**
 * Server actions for the Setnayan AI Bespoke Monogram studio
 * (`/dashboard/[eventId]/monogram` · Phase 2 of the 2026-06-11 monogram
 * overhaul — revives iteration 0037 on a native-vector pipeline).
 *
 * generateBespokeAction — brief → engineered prompt → 4 sanitized SVG
 *   candidates inserted as one ROUND in bespoke_monogram_generations.
 *   Round cap (MAX_BESPOKE_ROUNDS_PER_EVENT) bounds per-event cost.
 * applyBespokeAction — copies a candidate's SVG onto
 *   events.monogram_custom_svg (single-read render path for the landing
 *   hero) + records provenance.
 * clearBespokeAction — reverts to the typographic lockup.
 * reportBespokeAction — files a user_reports row (target_type 'ai_output')
 *   against a generated mark — Google Play GenAI policy: in-app reporting of
 *   offensive AI output. Observational only: the report lands in the
 *   /admin/user-reports queue; nothing about the studio changes.
 *
 * All access control rides RLS: the event select / generation select run on
 * the user's client (membership-scoped), inserts hit the couple-only WITH
 * CHECK, and the events update hits the couple update policy — same trust
 * model as saveMonogram. Errors surface as ?bespoke_error=… query params
 * (customer-safe messages only — the vendor is never named).
 */

function backToMaker(eventId: string, params?: Record<string, string>): never {
  const qs = params ? `?${new URLSearchParams(params)}` : '';
  // #bespoke-studio anchors the scroll back to the studio — the studio sits
  // below the full MonogramMaker, so without the fragment the post-action
  // redirect (10–30s after submit) would land the couple at the page top,
  // with the result + notice off-screen. The section carries this id.
  redirect(`/dashboard/${eventId}/monogram${qs}#bespoke-studio`);
}

export async function generateBespokeAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // COUPLE membership check BEFORE any API spend (load-bearing — the API call
  // below costs real money). The events SELECT RLS admits ANY member type
  // (guest/vendor/coordinator via current_event_ids()), and the self-join
  // path lets any authenticated user become a guest of any event, so an
  // events read is NOT proof of couple membership. Gate explicitly on
  // member_type='couple' here — otherwise a non-couple member could POST this
  // server action directly and burn Recraft generations while the couple-only
  // INSERT (which records the round for the cap) silently fails afterward,
  // leaving the cost guard permanently at round 0.
  const { data: membership } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!membership) backToMaker(eventId, { bespoke_error: 'not-found' });

  // Round cap — bounds the per-event generation cost. FAIL CLOSED: if the
  // count query errors (e.g. the table is missing on a drifted DB), treat it
  // as "cannot verify the cap" and refuse to spend, rather than defaulting to
  // 0 rounds used and generating unbounded.
  const { data: lastRound, error: capError } = await supabase
    .from('bespoke_monogram_generations')
    .select('round')
    .eq('event_id', eventId)
    .order('round', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (capError) backToMaker(eventId, { bespoke_error: 'generation' });
  const roundsUsed = lastRound?.round ?? 0;
  if (roundsUsed >= MAX_BESPOKE_ROUNDS_PER_EVENT) {
    backToMaker(eventId, { bespoke_error: 'cap' });
  }

  // Brief.
  const rawInitials = String(formData.get('initials') ?? '');
  const letters = (rawInitials.match(/\p{L}/gu) ?? [])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const initialsA = letters[0] ?? 'S';
  const initialsB = letters[1] ?? '';
  const styleRaw = String(formData.get('style_key') ?? 'crest');
  const styleKey: BespokeStyleKey = isBespokeStyleKey(styleRaw) ? styleRaw : 'crest';
  const motif = String(formData.get('motif') ?? '').slice(0, 120);
  const feedback = String(formData.get('feedback') ?? '').slice(0, 200);

  const prompt = buildBespokePrompt({ initialsA, initialsB, styleKey, motif, feedback });

  let candidates;
  try {
    candidates = await generateBespokeCandidates(prompt);
  } catch {
    backToMaker(eventId, { bespoke_error: 'generation' });
  }

  const round = roundsUsed + 1;
  const { error } = await supabase.from('bespoke_monogram_generations').insert(
    candidates.map((c) => ({
      event_id: eventId,
      created_by: user.id,
      round,
      brief: { initials: `${initialsA}${initialsB}`, style_key: styleKey, motif, feedback },
      prompt,
      svg_text: c.svg,
    })),
  );
  if (error) backToMaker(eventId, { bespoke_error: 'save' });

  revalidatePath(`/dashboard/${eventId}/monogram`);
  backToMaker(eventId, { bespoke: 'generated' });
}

export async function applyBespokeAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  const generationId = String(formData.get('generation_id') ?? '').trim();
  if (!eventId || !generationId) throw new Error('Missing ids');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS-scoped fetch — also pins the candidate to THIS event.
  const { data: generation } = await supabase
    .from('bespoke_monogram_generations')
    .select('generation_id, event_id, svg_text')
    .eq('generation_id', generationId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (!generation) backToMaker(eventId, { bespoke_error: 'not-found' });

  const { error } = await supabase
    .from('events')
    .update({
      monogram_custom_svg: generation.svg_text,
      monogram_custom_generation_id: generation.generation_id,
      // A bespoke mark supersedes any vector-studio composition — drop its
      // re-editable source so one source owns the mark.
      monogram_studio_config: null,
    })
    .eq('event_id', eventId);
  if (error) backToMaker(eventId, { bespoke_error: 'save' });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  backToMaker(eventId, { bespoke: 'applied' });
}

export async function clearBespokeAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('events')
    .update({
      monogram_custom_svg: null,
      monogram_custom_generation_id: null,
    })
    .eq('event_id', eventId);
  if (error) backToMaker(eventId, { bespoke_error: 'save' });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  backToMaker(eventId, { bespoke: 'cleared' });
}

// user_reports.reason enum (20261108000000) — the studio's picker offers the
// subset that makes sense for AI output, but any valid enum value is accepted.
const REPORT_REASONS = new Set([
  'nudity_sexual',
  'violence',
  'hate_harassment',
  'spam',
  'not_my_event',
  'other',
]);

export async function reportBespokeAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  const generationId = String(formData.get('generation_id') ?? '').trim();
  if (!eventId || !generationId) throw new Error('Missing ids');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const reasonRaw = String(formData.get('reason') ?? '').trim();
  const reason = REPORT_REASONS.has(reasonRaw) ? reasonRaw : 'other';
  const userDetails = String(formData.get('details') ?? '').trim().slice(0, 500);

  // RLS-scoped fetch (couple-only SELECT policy) — proves the caller is a
  // couple member of THIS event AND pins the reported mark to it. Also pulls
  // the brief so the admin queue gets actionable context without having to
  // join the generations table.
  const { data: generation } = await supabase
    .from('bespoke_monogram_generations')
    .select('generation_id, round, brief')
    .eq('generation_id', generationId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (!generation) backToMaker(eventId, { bespoke_error: 'not-found' });

  let briefNote = '';
  try {
    briefNote = ` · brief: ${JSON.stringify(generation.brief ?? {})}`.slice(0, 400);
  } catch {
    // Context only — never block the report on it.
  }
  const details =
    `[Setnayan AI monogram · round ${generation.round}${briefNote}]` +
    (userDetails ? ` ${userDetails}` : '');

  // INSERT on the user's RLS-scoped client — the user_reports reporter policy
  // (reporter_user_id = auth.uid()) is the enforcement, not the admin client.
  const { error } = await supabase.from('user_reports').insert({
    reporter_user_id: user.id,
    event_id: eventId,
    target_type: 'ai_output',
    target_id: generation.generation_id,
    reason,
    details,
  });
  if (error) backToMaker(eventId, { bespoke_error: 'report-failed' });

  backToMaker(eventId, { bespoke: 'reported' });
}
