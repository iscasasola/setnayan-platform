'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  planPicksOntoTimeline,
  type ActivityPick,
  type TimelineBlock,
  type VendorActivity,
} from '@/lib/vendor-activities';

/**
 * The couple's side of the emcee's catalogue: pick segments, then drop the
 * picks onto the timeline.
 *
 * AUTHORISATION IS RLS'S. Every statement here runs under the caller's own
 * client. `event_activity_picks_host_write` scopes picks to
 * `current_event_ids()`, and the schedule insert is bounded by the couple's own
 * `event_schedule_blocks` write policy. Passing someone else's `eventId`
 * matches zero rows rather than being caught by a check in this file.
 *
 * THE PLACEMENT DECISION IS NOT HERE. `planPicksOntoTimeline` (pure, 16 tests)
 * decides what goes where; this file does the I/O and writes what it is handed.
 */

function scheduleHref(eventId: string): string {
  return `/dashboard/${eventId}/schedule`;
}

async function client() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return supabase;
}

/** Tick / untick one segment. Untick refuses once it is on the timeline — the
 *  couple deletes the block itself, so we never silently remove a moment they
 *  may have already retimed. */
export async function toggleActivityPick(formData: FormData) {
  const eventId = String(formData.get('event_id') ?? '');
  const activityId = String(formData.get('activity_id') ?? '');
  const picked = String(formData.get('picked') ?? '') === 'true';
  if (!eventId || !activityId) redirect('/dashboard');

  const supabase = await client();

  if (picked) {
    await supabase
      .from('event_activity_picks')
      .upsert(
        { event_id: eventId, activity_id: activityId },
        { onConflict: 'event_id,activity_id', ignoreDuplicates: true },
      );
  } else {
    // Only remove a pick that has NOT been placed. A placed one is a real block
    // the couple may have moved or renamed; unpicking must not reach into their
    // timeline behind their back.
    await supabase
      .from('event_activity_picks')
      .delete()
      .eq('event_id', eventId)
      .eq('activity_id', activityId)
      .is('scheduled_block_id', null);
  }

  revalidatePath(scheduleHref(eventId));
  redirect(`${scheduleHref(eventId)}#emcee-picks`);
}

/**
 * THE BRIDGE. Turn every unplaced pick into a real schedule block.
 *
 * Appends after the whole existing timeline (see `planPicksOntoTimeline` for
 * why append and never reflow), then stamps each pick with the block it became
 * so a second run is a no-op rather than a duplicate.
 */
export async function applyActivityPicks(formData: FormData) {
  const eventId = String(formData.get('event_id') ?? '');
  if (!eventId) redirect('/dashboard');
  const supabase = await client();

  const [picksRes, blocksRes, eventRes] = await Promise.all([
    supabase
      .from('event_activity_picks')
      .select('event_id, activity_id, scheduled_block_id')
      .eq('event_id', eventId),
    supabase
      .from('event_schedule_blocks')
      .select('block_id, start_at, end_at, sort_order')
      .eq('event_id', eventId),
    supabase.from('events').select('event_date').eq('event_id', eventId).maybeSingle(),
  ]);

  const picks = (picksRes.data ?? []) as ActivityPick[];
  const timeline = (blocksRes.data ?? []) as TimelineBlock[];
  const unplaced = picks.filter((p) => !p.scheduled_block_id).map((p) => p.activity_id);
  if (unplaced.length === 0) {
    redirect(`${scheduleHref(eventId)}#emcee-picks`);
  }

  // Only the activities actually picked — the catalogue read is scoped to them.
  const { data: actData } = await supabase
    .from('vendor_activities')
    .select(
      'activity_id, vendor_profile_id, label, blurb, duration_minutes, block_type, is_offered, display_order',
    )
    .in('activity_id', unplaced);
  const catalogue = (actData ?? []) as VendorActivity[];

  // An empty timeline has nothing to append to, so fall back to the event date
  // at a sane evening hour — the schedule stores naive event-local wall clock.
  const eventDate = (eventRes.data as { event_date: string | null } | null)?.event_date ?? null;
  const fallbackStart = eventDate ? `${eventDate}T18:00:00Z` : new Date().toISOString();

  const plan = planPicksOntoTimeline({ picks, catalogue, timeline, fallbackStart });
  if (plan.blocks.length === 0) {
    redirect(`${scheduleHref(eventId)}#emcee-picks`);
  }

  // Insert the blocks, then stamp each pick with the block it became. Not a
  // transaction — PostgREST has no multi-statement one here — so the stamp is
  // per-row and a partial failure leaves the rest correctly linked rather than
  // orphaning everything.
  for (const b of plan.blocks) {
    const { data: inserted, error } = await supabase
      .from('event_schedule_blocks')
      .insert({
        event_id: eventId,
        label: b.label,
        block_type: b.block_type,
        start_at: b.start_at,
        end_at: b.end_at,
        sort_order: b.sort_order,
        is_public: true,
      })
      .select('block_id')
      .maybeSingle();
    if (error || !inserted) continue;

    await supabase
      .from('event_activity_picks')
      .update({ scheduled_block_id: (inserted as { block_id: string }).block_id })
      .eq('event_id', eventId)
      .eq('activity_id', b.activity_id);
  }

  revalidatePath(scheduleHref(eventId), 'layout');
  redirect(`${scheduleHref(eventId)}#emcee-picks`);
}
