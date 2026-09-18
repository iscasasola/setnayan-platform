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
 * 🔑 THE PORT SAVED THE ACTIONS AND LOST THE CONTROL (fixed 2026-09-03). For the
 * whole of that window the public site kept RENDERING `rsvp_backdrop`
 * (`app/[slug]/_lib/loaders.ts` → `invitation-shell.tsx` → `_components/spatial-backdrop.tsx`)
 * while nothing anywhere could write it: the legacy `/site-editor` routes are
 * bare redirects now, and no panel was ever mounted here. A couple could not
 * turn their backdrop on, change it, or turn it off. `SPATIAL_THEME_KEYS` had
 * exactly two entries and neither was reachable.
 *
 * Both actions now also honour `return_to`, which they did not when ported —
 * saving used to drop the couple out of the row they were editing.
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
  redirect(resolveReturnTo(formData, `/dashboard/${eventId}/website/editor?open=backdrop`));
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
  redirect(resolveReturnTo(formData, `/dashboard/${eventId}/website/editor?open=backdrop`));
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

/**
 * Pin the site to one phase, or hand it back to the clock (DAY-33 · PH-6).
 *
 * Owner 2026-07-02: *"a manual toggle to set it automatic or manual launch,
 * whichever website they want. activating one will deactivate the other …
 * save the date, rsvp, event and editorial."* One radio group, so choosing a
 * phase IS choosing manual, and choosing Automatic clears the pin — the two
 * columns can never disagree about which is on.
 *
 * Writes `events.launch_mode` / `events.manual_phase` (migration
 * `20270426100000`, CHECK-guarded) through the couple's own session, so
 * `couple_can_update_event` is the real gate. 🔑 The update asks for its row
 * back: a refused write returns zero rows and NO error, and the editor would
 * otherwise re-render saying the pin took when it did not.
 */
export async function setLaunchPhase(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const choice = formData.get('launch_phase');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;
  const pinned =
    choice === 'save_the_date' || choice === 'rsvp' || choice === 'event' || choice === 'editorial'
      ? choice
      : null;
  if (choice !== 'auto' && !pinned) return;

  await requireHostMembership(eventId);
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from('events')
    .update(
      pinned
        ? { launch_mode: 'manual', manual_phase: pinned }
        : { launch_mode: 'auto', manual_phase: null },
    )
    .eq('event_id', eventId)
    .select('slug');
  const saved = Array.isArray(rows) && rows.length > 0;

  revalidatePath(`/dashboard/${eventId}/website/editor`);
  const slug = saved ? (rows[0]?.slug as string | null) : null;
  if (slug) revalidatePath(`/${slug}`);
  const fallback = `/dashboard/${eventId}/website/editor?open=launch-phase${saved ? '' : '&pin=refused'}`;
  redirect(saved ? resolveReturnTo(formData, fallback) : fallback);
}
