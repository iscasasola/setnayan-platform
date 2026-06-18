'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { REVEAL_TEMPLATE_IDS, type RevealTemplateId } from '@/lib/reveal-config';
import { STD_THEME_IDS } from '@/lib/std-themes';

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

/**
 * saveAllStdContent — single-shot save for the live builder (2026-06-18).
 * Persists the couple's theme choice + optional invitation launch date in one
 * write. Returns { ok: boolean } — no redirect, so the builder can stay put
 * and show an inline success state (the one-Render-button UX).
 */
export async function saveAllStdContent(
  eventId: string,
  data: { theme?: string; launchDate?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  if (!eventId) return { ok: false, error: 'missing-event' };
  const supabase = await requireCouple(eventId);

  const theme =
    data.theme && (STD_THEME_IDS as readonly string[]).includes(data.theme)
      ? data.theme
      : null;

  const rawDate = data.launchDate?.trim() ?? null;
  const launchDate =
    rawDate === '' || rawDate === null
      ? null
      : /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
        ? rawDate
        : undefined; // invalid date → skip
  if (launchDate === undefined) return { ok: false, error: 'bad-date' };

  const patch: Record<string, unknown> = {};
  if (theme !== null) patch.std_theme = theme;
  patch.std_invitation_launch_date = launchDate;

  const { error } = await supabase.from('events').update(patch).eq('event_id', eventId);
  if (error) return { ok: false, error: 'db-error' };

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

  // Writes to the STD-specific snapshot columns (std_film_*), NOT the live
  // event columns (event_date / venue_name / etc.). This decouples the film
  // content from subsequent event edits — the snapshot is the source of truth
  // for the film once finalized. See migration 20270122000000.
  const updates: Record<string, unknown> = {};

  const rawDate = String(formData.get('film_date') ?? '').trim();
  if (rawDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      redirect(`/dashboard/${eventId}/add-ons/save-the-date?std_error=bad-date#content`);
    }
    updates.std_film_date = rawDate;
  }

  const venueName = String(formData.get('film_venue_name') ?? '').trim();
  if (venueName) updates.std_film_venue_name = venueName;

  const venueCity = String(formData.get('film_venue_city') ?? '').trim();
  if (venueCity) updates.std_film_venue_city = venueCity;

  const filmStory = String(formData.get('film_story') ?? '').trim();
  if (filmStory) updates.std_film_story = filmStory;

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

export async function saveSoundtrack(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  const musicRef = String(formData.get('music_r2_ref') ?? '').trim();
  if (!musicRef) {
    redirect(`/dashboard/${eventId}/add-ons/save-the-date`);
  }

  const { error } = await supabase
    .from('events')
    .update({
      site_bg_music_r2_key: musicRef,
      site_bg_music_source: 'upload',
      site_bg_music_enabled: true,
    })
    .eq('event_id', eventId);
  if (error) {
    redirect(`/dashboard/${eventId}/add-ons/save-the-date?std_error=save#content`);
  }

  revalidate(eventId);
  redirect(`/dashboard/${eventId}/add-ons/save-the-date?std=saved#content`);
}
