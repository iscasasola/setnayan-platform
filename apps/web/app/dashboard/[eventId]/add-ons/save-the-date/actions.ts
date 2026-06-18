'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { REVEAL_TEMPLATE_IDS, type RevealTemplateId } from '@/lib/reveal-config';

/**
 * Server actions for the Save-the-Date builder (0024 PR4 · P4).
 *
 * chooseRevealTemplate — persists the couple's chosen opening reveal
 *   (events.std_reveal_template). The live page (RevealOverlay) now prefers this
 *   over the admin house default. Validated against the 5 REVEAL_TEMPLATE_IDS.
 *   Called programmatically from the chooser (useTransition) → returns a result
 *   instead of redirecting, so the preview stays put.
 * saveInvitationLaunchDate — persists when the full invitation goes live
 *   (events.std_invitation_launch_date), driving the film's closing beat + the
 *   second add-to-calendar VEVENT (P3). A plain form action → redirects back.
 *
 * AuthZ mirrors the sibling wax-seal actions: gate on an explicit couple
 * membership, then write through the couple's authenticated client
 * (couple_can_update_event is the DB-level enforcement).
 */

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
  if (!membership) {
    redirect(`/dashboard/${eventId}/add-ons/save-the-date?std_error=not-found`);
  }
  return supabase;
}

function revalidate(eventId: string) {
  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/add-ons/save-the-date`);
}

function isRevealTemplateId(v: string): v is RevealTemplateId {
  return (REVEAL_TEMPLATE_IDS as readonly string[]).includes(v);
}

export async function chooseRevealTemplate(
  eventId: string,
  templateId: string,
): Promise<{ ok: boolean }> {
  if (!eventId || !isRevealTemplateId(templateId)) return { ok: false };
  const supabase = await requireCouple(eventId);
  const { error } = await supabase
    .from('events')
    .update({ std_reveal_template: templateId })
    .eq('event_id', eventId);
  if (error) return { ok: false };
  revalidate(eventId);
  return { ok: true };
}

export async function saveInvitationLaunchDate(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  const raw = String(formData.get('launch_date') ?? '').trim();
  // Empty clears the date; otherwise require a YYYY-MM-DD calendar date.
  const value = raw === '' ? null : raw;
  if (value !== null && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    redirect(`/dashboard/${eventId}/add-ons/save-the-date?std_error=bad-date#touches`);
  }

  const { error } = await supabase
    .from('events')
    .update({ std_invitation_launch_date: value })
    .eq('event_id', eventId);
  if (error) {
    redirect(`/dashboard/${eventId}/add-ons/save-the-date?std_error=save#touches`);
  }

  revalidate(eventId);
  redirect(`/dashboard/${eventId}/add-ons/save-the-date?std=saved#touches`);
}

export async function saveStdContent(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  const updates: Record<string, unknown> = {};

  const rawDate = String(formData.get('event_date') ?? '').trim();
  if (rawDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      redirect(`/dashboard/${eventId}/add-ons/save-the-date?std_error=bad-date#content`);
    }
    updates.event_date = rawDate;
  }

  const venueName = String(formData.get('venue_name') ?? '').trim();
  if (venueName) updates.venue_name = venueName;

  const venueAddress = String(formData.get('venue_address') ?? '').trim();
  if (venueAddress) updates.venue_address = venueAddress;

  const loveStory = String(formData.get('love_story') ?? '').trim();
  if (loveStory) updates.love_story = loveStory;

  if (Object.keys(updates).length === 0) {
    redirect(`/dashboard/${eventId}/add-ons/save-the-date`);
  }

  const { error } = await supabase
    .from('events')
    .update(updates)
    .eq('event_id', eventId);
  if (error) {
    redirect(`/dashboard/${eventId}/add-ons/save-the-date?std_error=save#content`);
  }

  revalidate(eventId);
  redirect(`/dashboard/${eventId}/add-ons/save-the-date?std=saved#content`);
}
