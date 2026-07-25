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
import { createClient } from '@/lib/supabase/server';
import { requireHostMembership } from '@/lib/host-gate';
import { isSpatialThemeKey } from '@/lib/spatial-backdrop';

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
