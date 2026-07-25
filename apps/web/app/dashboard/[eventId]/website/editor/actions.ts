'use server';

/**
 * Unified Website Editor — server actions (PR-2).
 *
 * Home for the settings that had NO other editor and would otherwise have died
 * with the legacy `/site-editor` route: the RSVP spatial backdrop. Ported
 * verbatim (same columns, same validation) from
 * `app/site-editor/[eventId]/actions.ts`, with the gate swapped to the canonical
 * `lib/host-gate` helper (PR #3642) and revalidation to `lib/revalidate-site`.
 *
 * Everything ELSE the editor writes stays where it already lives — the rail's
 * panels call the existing per-feature actions under `website/*//*actions.ts`.
 * This file exists for the orphan settings only; do not grow it into a second
 * write layer.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireHostMembership } from '@/lib/host-gate';
import { isSpatialThemeKey } from '@/lib/spatial-backdrop';
import { resolveReturnTo } from '@/lib/editor-return';

/** Set the RSVP-phase spatial backdrop (theme + intensity). */
export async function saveRsvpBackdrop(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const themeRaw = formData.get('theme');
  const intensityRaw = formData.get('intensity');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;
  if (!isSpatialThemeKey(themeRaw)) return;
  const intensity =
    intensityRaw === 'subtle' || intensityRaw === 'lavish' ? intensityRaw : 'standard';

  await requireHostMembership(eventId);
  const supabase = await createClient();

  await supabase
    .from('events')
    .update({ rsvp_backdrop: { theme: themeRaw, intensity } })
    .eq('event_id', eventId);

  revalidatePath(`/dashboard/${eventId}/website/editor`);
  revalidatePath('/[slug]', 'page');
}

/** Turn the spatial backdrop off (null the column). */
export async function clearRsvpBackdrop(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;

  await requireHostMembership(eventId);
  const supabase = await createClient();

  await supabase.from('events').update({ rsvp_backdrop: null }).eq('event_id', eventId);

  revalidatePath(`/dashboard/${eventId}/website/editor`);
  revalidatePath('/[slug]', 'page');
}

/**
 * Toggle open browsing (`events.website_open_browse`) — the couple's master
 * switch for the five-tab browse-everything site (owner 2026-07-25: the editor
 * row must flip it inline, not pop to another screen). Host-gated like the
 * backdrop actions above; honors `return_to` so the editor keeps its place.
 */
export async function setOpenBrowse(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const openRaw = formData.get('open_browse');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  if (openRaw !== '0' && openRaw !== '1') return;
  const eventId = eventIdRaw;

  await requireHostMembership(eventId);
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .update({ website_open_browse: openRaw === '1' })
    .eq('event_id', eventId)
    .select('slug')
    .maybeSingle();

  revalidatePath(`/dashboard/${eventId}/website/editor`);
  if (event?.slug) revalidatePath(`/${event.slug}`);
  redirect(resolveReturnTo(formData, `/dashboard/${eventId}/website/editor?open=open-browse`));
}
