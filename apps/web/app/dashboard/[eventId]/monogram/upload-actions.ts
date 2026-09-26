'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isMarkInkMode, writeMarkInkMode, type MarkInkMode } from '@/lib/monogram-ink';

/**
 * Server actions for "upload your own mark" (owner 2026-07-17 — overriding the
 * benchmark council's §9 upload deferral).
 *
 * SAVING an upload lives in commit-actions.ts (commitMonogram) — the page's
 *   two bottom buttons are the only save, for either side of the toggle.
 * clearUploadedMarkAction — removes the upload; the studio/auto mark resumes.
 *
 * AuthZ mirrors studio-actions.ts: couple-membership check, RLS-scoped writes.
 */

function backToMaker(eventId: string, params?: Record<string, string>): never {
  const qs = params ? `?${new URLSearchParams(params)}` : '';
  redirect(`/dashboard/${eventId}/monogram${qs}#upload-mark`);
}

async function requireCouple(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: membership } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!membership) backToMaker(eventId, { studio_error: 'not-found' });
  return supabase;
}

export async function clearUploadedMarkAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  const { data: cleared, error } = await supabase
    .from('events')
    .update({ monogram_uploaded_svg: null })
    .eq('event_id', eventId)
    .select('event_id');
  if (error || !cleared || cleared.length === 0) backToMaker(eventId, { upload_error: 'save' });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  backToMaker(eventId, { studio: 'upload-cleared' });
}

/**
 * setUploadedMarkInkAction — change WHOSE COLOURS the live uploaded mark wears,
 * without re-uploading it.
 *
 * The compare screen writes this. It re-stamps `data-ink` on the stored SVG and
 * nothing else: the original colours stay in the bytes, so a couple can flip
 * between their designer's palette and their mood board as many times as they
 * like. That reversibility is the reason the policy is a stamp rather than a
 * destructive recolour at save time.
 *
 * No-upload case: there is nothing to stamp (the studio mark carries its own
 * colours, chosen in the studio), so this returns the couple to the maker with
 * the same not-found notice the other actions use rather than writing a policy
 * onto a mark that cannot honour it.
 */
async function setUploadedMarkInkAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  const inkRaw = String(formData.get('ink_mode') ?? '');
  if (!isMarkInkMode(inkRaw)) backToMaker(eventId, { upload_error: 'invalid' });

  const { data: event } = await supabase
    .from('events')
    .select('monogram_uploaded_svg')
    .eq('event_id', eventId)
    .maybeSingle();

  const current = typeof event?.monogram_uploaded_svg === 'string' ? event.monogram_uploaded_svg : '';
  if (!current) backToMaker(eventId, { upload_error: 'not-found' });

  const { data: updated, error } = await supabase
    .from('events')
    .update({ monogram_uploaded_svg: writeMarkInkMode(current, inkRaw as MarkInkMode) })
    .eq('event_id', eventId)
    .select('event_id');
  if (error || !updated || updated.length === 0) backToMaker(eventId, { upload_error: 'save' });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/monogram`);
  backToMaker(eventId, { studio: 'ink-saved' });
}
