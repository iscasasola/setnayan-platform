'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sanitizeWaxSealConfig } from '@/lib/wax-seal/types';

/**
 * Server actions for the Candle Stamp Maker (0024 §3 · PR2 ·
 * /dashboard/[eventId]/studio/save-the-date/stamp).
 *
 * saveWaxSeal — validates the client's minted recipe (sanitizeWaxSealConfig:
 *   clamps numerics, whitelists enums, validates the colour hex) and writes
 *   events.wax_seal_config. The recipe is deterministic data only — the monogram
 *   die + wax colour are read live at render, so nothing is baked.
 * clearWaxSeal — removes the minted seal (the reveal falls back to a default
 *   levers seal seeded by public_id).
 *
 * AuthZ matches the sibling monogram actions: an events-read alone admits any
 * member type (the SELECT RLS uses current_event_ids()), so we gate on an
 * explicit couple membership, THEN write through the couple's authenticated
 * client (couple_can_update_event is the DB-level enforcement). No external
 * APIs, no spend — deterministic + local.
 */

function backToMaker(eventId: string, params?: Record<string, string>): never {
  const qs = params ? `?${new URLSearchParams(params)}` : '';
  redirect(`/dashboard/${eventId}/studio/save-the-date/stamp${qs}#wax-maker`);
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
  if (!membership) backToMaker(eventId, { wax_error: 'not-found' });
  return supabase;
}

export async function saveWaxSeal(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get('config') ?? ''));
  } catch {
    backToMaker(eventId, { wax_error: 'invalid' });
  }
  const config = sanitizeWaxSealConfig(parsed);
  if (!config) backToMaker(eventId, { wax_error: 'invalid' });

  const { error } = await supabase
    .from('events')
    .update({ wax_seal_config: config })
    .eq('event_id', eventId);
  if (error) backToMaker(eventId, { wax_error: 'save' });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/studio/save-the-date`);
  revalidatePath(`/dashboard/${eventId}/studio/save-the-date/stamp`);
  backToMaker(eventId, { wax: 'saved' });
}

export async function clearWaxSeal(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  const { error } = await supabase
    .from('events')
    .update({ wax_seal_config: null })
    .eq('event_id', eventId);
  if (error) backToMaker(eventId, { wax_error: 'save' });

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/studio/save-the-date`);
  revalidatePath(`/dashboard/${eventId}/studio/save-the-date/stamp`);
  backToMaker(eventId, { wax: 'cleared' });
}
