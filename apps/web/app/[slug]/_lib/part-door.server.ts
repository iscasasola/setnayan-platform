import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { guestRead } from '@/lib/guest-read';
import { getLifecyclePhase, isWebsitePhasesEnabled, manualLaunchPhase, type LifecyclePhase } from '@/lib/invitation-widgets';
import { PART_SHOW_KEY, type FixedPart } from '@/lib/stage-scenes';
import { partsHiddenOn } from '@/lib/what-guests-see';
import { solemnAdjustedPhase } from './event-words';

/**
 * 👁 A PART'S OWN PAGE, WHEN THE COUPLE HID THE PART ON THIS STAGE ("What guests see", pass 2).
 *
 * The event's page withholds a hidden part at the source (`site-body.tsx` `partsOff`), so its door is not drawn. A
 * guest can still hold the address — an old message, a bookmark. This answers the one question each such page asks
 * before it draws: **which parts did the couple hide for the stage the event is at?** Each page then takes the SAME exit
 * it already takes when the part is off for the whole event (gifts off → not found; seats not shown yet → the page's
 * own "not yet" state). Nothing new is said to a guest.
 *
 * 🔑 THE SAME ONE READING as the page (`partOnStage`, lib/what-guests-see.ts) over the PUBLISHED hero row — a draft
 * never reaches a guest, and this reads no draft.
 *
 * 🔑 THE STAGE IS THE EVENT'S, NOT A PREVIEW'S: the couple's pin, else the venue's clock, then the solemn adjustment —
 * `app/[slug]/page.tsx`'s composition without the host's `?phase=` (a sub-page carries no such address).
 *
 * ⚡ ONE SMALL READ IN THE COMMON CASE: the hero row is read first, and an event that never stored a choice for this
 * part returns "nothing hidden" before anything else is asked.
 *
 * 🔴 A FAILED READ THROWS — through the guest side's ONE read (`guestRead`, lib/guest-read.ts: retried through a blip,
 * then the guest boundary's "This invitation didn't load. … Your link is fine"). "Could not read the couple's choice"
 * is neither "hidden" nor "shown": answering either would draw a part the couple hid, or close a page they did not close.
 */
export async function hiddenPartDoors(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  /** A page that already resolved its own stage (the Day hub, a host's rehearsal of it) says so; otherwise the event's. */
  at?: LifecyclePhase,
): Promise<ReadonlySet<FixedPart>> {
  const hero = (await guestRead('part door (hero row)', () =>
    admin
      .from('invitation_widgets')
      .select('config_json')
      .eq('event_id', eventId)
      .eq('widget_type', 'hero')
      .maybeSingle(),
  )) as { config_json?: unknown } | null;
  const config = (hero?.config_json ?? null) as Record<string, unknown> | null;
  const stored = config?.[PART_SHOW_KEY] as Record<string, unknown> | undefined;
  if (!stored || typeof stored !== 'object' || Object.keys(stored).length === 0) return NO_PART;
  const widgets = [{ widget_type: 'hero', config_json: config }];
  const profile = await resolveProfileByEvent(eventId);
  const phasesEnabled = isWebsitePhasesEnabled() || surfaceEnabled(profile, 'website');
  if (at) return partsHiddenOn(widgets, at, phasesEnabled);

  const facts = await guestRead('part door (event)', () =>
    admin
      .from('events')
      .select('event_date, event_end_date, venue_latitude, venue_longitude, launch_mode, manual_phase, std_invitation_launch_date')
      .eq('event_id', eventId)
      .maybeSingle(),
  );
  if (!facts) return NO_PART;
  const e = facts as {
    event_date: string | null;
    event_end_date: string | null;
    venue_latitude: number | null;
    venue_longitude: number | null;
    launch_mode: string | null;
    manual_phase: string | null;
    std_invitation_launch_date: string | null;
  };
  const stage = solemnAdjustedPhase(
    manualLaunchPhase(e.launch_mode, e.manual_phase) ??
      getLifecyclePhase(e.event_date, eventTimezoneFromCoords(e.venue_latitude, e.venue_longitude), e.event_end_date ?? null, undefined, e.std_invitation_launch_date ?? null),
    profile.terminology.register === 'solemn',
  );
  return partsHiddenOn(widgets, stage, phasesEnabled);
}

const NO_PART: ReadonlySet<FixedPart> = new Set();

/** ONE part's door — `hiddenPartDoors` asked about a single part. */
export async function partDoorHidden(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  part: FixedPart,
): Promise<boolean> {
  return (await hiddenPartDoors(admin, eventId)).has(part);
}
