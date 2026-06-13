'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server actions for the zone-walkthrough manager (seat-finding PR 6).
 *
 * The walkthrough is COORDINATOR LABOR, never a Setnayan SKU, and MUST stay
 * delegatable to a no-coordinator couple's DIY helper — so every action is
 * writable by the couple OR a seat_plan='edit' delegate. RLS is the real
 * backstop (event_walkthrough_zones + event_tables both carry couple +
 * moderator policies); `authorize` just turns a denial into a clean error and
 * gates the page render.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authorize(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<void> {
  if (!UUID_RE.test(eventId)) throw new Error('Invalid event.');
  const { data: couple } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (couple) return;
  // Coordinator / DIY delegate with seat-plan edit rights.
  const { data: level } = await supabase.rpc('moderator_area_level', {
    p_event_id: eventId,
    p_area: 'seat_plan',
  });
  if (level === 'edit') return;
  throw new Error('You do not have permission to edit this seating plan.');
}

/** Couple OR seat_plan-edit delegate? Used by the page to render-vs-redirect. */
export async function canManageWalkthrough(eventId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = await createClient();
  try {
    await authorize(supabase, eventId, user.id);
    return true;
  } catch {
    return false;
  }
}

function revalidate(eventId: string): void {
  revalidatePath(`/dashboard/${eventId}/seating/walkthrough`);
}

export async function createWalkthroughZone(eventId: string, label: string): Promise<void> {
  const clean = label.trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!clean) throw new Error('Give the zone a name.');
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in to continue.');
  const supabase = await createClient();
  await authorize(supabase, eventId, user.id);

  // Append after the current last zone.
  const { data: last } = await supabase
    .from('event_walkthrough_zones')
    .select('sort_order')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? -1) + 1;

  const { error } = await supabase
    .from('event_walkthrough_zones')
    .insert({ event_id: eventId, label: clean, sort_order: sortOrder });
  if (error) throw new Error(error.message);
  revalidate(eventId);
}

export async function renameWalkthroughZone(
  eventId: string,
  zoneId: string,
  label: string,
): Promise<void> {
  const clean = label.trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!clean) throw new Error('Give the zone a name.');
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in to continue.');
  const supabase = await createClient();
  await authorize(supabase, eventId, user.id);
  const { error } = await supabase
    .from('event_walkthrough_zones')
    .update({ label: clean, updated_at: new Date().toISOString() })
    .eq('zone_id', zoneId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
  revalidate(eventId);
}

export async function deleteWalkthroughZone(eventId: string, zoneId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in to continue.');
  const supabase = await createClient();
  await authorize(supabase, eventId, user.id);
  // Tables FK is ON DELETE SET NULL, so dropping a zone just un-tags its tables.
  const { error } = await supabase
    .from('event_walkthrough_zones')
    .delete()
    .eq('zone_id', zoneId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
  revalidate(eventId);
}

/** Set the EXACT set of tables in this zone (a table belongs to ≤1 zone). */
export async function setWalkthroughZoneTables(
  eventId: string,
  zoneId: string,
  tableIds: string[],
): Promise<void> {
  const ids = Array.from(new Set(tableIds)).filter((id) => UUID_RE.test(id));
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in to continue.');
  const supabase = await createClient();
  await authorize(supabase, eventId, user.id);

  // Clear tables currently in this zone that are no longer selected. Read the
  // current set BEFORE writing so the diff is consistent; both writes use
  // parameterized `.in(...)` (no interpolated filter string — injection-safe).
  const { data: current } = await supabase
    .from('event_tables')
    .select('table_id')
    .eq('event_id', eventId)
    .eq('walkthrough_zone_id', zoneId);
  const toClear = (current ?? [])
    .map((r) => r.table_id as string)
    .filter((id) => !ids.includes(id));

  if (toClear.length > 0) {
    const { error } = await supabase
      .from('event_tables')
      .update({ walkthrough_zone_id: null })
      .eq('event_id', eventId)
      .in('table_id', toClear);
    if (error) throw new Error(error.message);
  }
  if (ids.length > 0) {
    // Assign selected (steals from any other zone — a table has one location).
    const { error } = await supabase
      .from('event_tables')
      .update({ walkthrough_zone_id: zoneId })
      .eq('event_id', eventId)
      .in('table_id', ids);
    if (error) throw new Error(error.message);
  }
  revalidate(eventId);
}

function mimeFromRef(ref: string): string {
  const l = ref.toLowerCase();
  if (l.endsWith('.webm')) return 'video/webm';
  if (l.endsWith('.mov') || l.endsWith('.quicktime')) return 'video/quicktime';
  return 'video/mp4';
}

export async function saveWalkthroughZoneVideo(
  eventId: string,
  zoneId: string,
  r2Ref: string,
): Promise<void> {
  if (!r2Ref.startsWith('r2://')) throw new Error('Upload did not complete — try again.');
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in to continue.');
  const supabase = await createClient();
  await authorize(supabase, eventId, user.id);
  const { error } = await supabase
    .from('event_walkthrough_zones')
    .update({
      video_r2_key: r2Ref,
      video_mime_type: mimeFromRef(r2Ref),
      uploaded_by_user_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('zone_id', zoneId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
  revalidate(eventId);
}

export async function removeWalkthroughZoneVideo(eventId: string, zoneId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in to continue.');
  const supabase = await createClient();
  await authorize(supabase, eventId, user.id);
  // No clip ⇒ nothing to show; un-publish too (the finder also guards on key).
  const { error } = await supabase
    .from('event_walkthrough_zones')
    .update({
      video_r2_key: null,
      video_mime_type: null,
      duration_seconds: null,
      poster_r2_key: null,
      published_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('zone_id', zoneId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
  revalidate(eventId);
}

export async function setWalkthroughZonePublished(
  eventId: string,
  zoneId: string,
  published: boolean,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in to continue.');
  const supabase = await createClient();
  await authorize(supabase, eventId, user.id);

  if (published) {
    const { data: zone } = await supabase
      .from('event_walkthrough_zones')
      .select('video_r2_key')
      .eq('zone_id', zoneId)
      .eq('event_id', eventId)
      .maybeSingle();
    if (!zone?.video_r2_key) throw new Error('Record a clip before showing it to guests.');
  }

  const { error } = await supabase
    .from('event_walkthrough_zones')
    .update({
      published_at: published ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('zone_id', zoneId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
  revalidate(eventId);
}
