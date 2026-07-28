'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

/**
 * The emcee's activity catalogue — write actions.
 *
 * Deliberately the same shape as `vendor-dashboard/repertoire/actions.ts`: a
 * vendor-owned reusable list, edited with plain form posts and a redirect back,
 * no client state machine. The two surfaces are siblings (a band's songs, a
 * host's segments) and a vendor who has used one should recognise the other.
 *
 * AUTHORISATION IS RLS'S, NOT THIS FILE'S. Every write goes through the
 * caller's own client, and `vendor_activities_owner_write` scopes it to
 * `current_vendor_ids()`. `ensureProfile` resolves WHICH vendor the form is
 * for; it is not the boundary, and a forged `activity_id` belonging to another
 * vendor is refused by the policy, not by a check here.
 */

const BASE = '/vendor-dashboard/activities';

function back(params?: { error?: string; saved?: boolean }): never {
  const sp = new URLSearchParams();
  if (params?.error) sp.set('error', params.error);
  else if (params?.saved) sp.set('saved', '1');
  const qs = sp.toString();
  redirect(qs ? `${BASE}?${qs}` : BASE);
}

async function ensureProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/vendor-dashboard/activities');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, profile };
}

/** Clamp to the column's CHECK so a slip becomes a corrected value, not a 23514. */
function clampMinutes(raw: FormDataEntryValue | null): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n)) return 15;
  return Math.min(480, Math.max(1, n));
}

export async function addActivity(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  const label = String(formData.get('label') ?? '').trim();
  if (!label) back({ error: 'Give the segment a name.' });
  if (label.length > 80) back({ error: 'That name is too long — 80 characters max.' });

  const blurbRaw = String(formData.get('blurb') ?? '').trim();
  const blurb = blurbRaw ? blurbRaw.slice(0, 400) : null;

  // New segments go to the end of the emcee's own order.
  const { data: last } = await supabase
    .from('vendor_activities')
    .select('display_order')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((last as { display_order: number } | null)?.display_order ?? 0) + 10;

  const { error } = await supabase.from('vendor_activities').insert({
    vendor_profile_id: profile.vendor_profile_id,
    label,
    blurb,
    duration_minutes: clampMinutes(formData.get('duration_minutes')),
    block_type: String(formData.get('block_type') ?? 'program'),
    display_order: nextOrder,
  });
  if (error) back({ error: 'Could not save that segment. Please try again.' });

  revalidatePath(BASE);
  back({ saved: true });
}

export async function updateActivity(formData: FormData) {
  const { supabase } = await ensureProfile();
  const activityId = String(formData.get('activity_id') ?? '');
  if (!activityId) back({ error: 'Missing segment.' });

  const label = String(formData.get('label') ?? '').trim();
  if (!label) back({ error: 'Give the segment a name.' });

  const blurbRaw = String(formData.get('blurb') ?? '').trim();

  // No vendor filter here on purpose: `vendor_activities_owner_write` is the
  // boundary, so another vendor's id simply matches zero rows.
  const { error } = await supabase
    .from('vendor_activities')
    .update({
      label: label.slice(0, 80),
      blurb: blurbRaw ? blurbRaw.slice(0, 400) : null,
      duration_minutes: clampMinutes(formData.get('duration_minutes')),
      block_type: String(formData.get('block_type') ?? 'program'),
      updated_at: new Date().toISOString(),
    })
    .eq('activity_id', activityId);
  if (error) back({ error: 'Could not update that segment.' });

  revalidatePath(BASE);
  back({ saved: true });
}

/**
 * Retire / un-retire. A SOFT toggle, never a delete: couples on past events
 * picked these, and `event_activity_picks` references them. Deleting would
 * cascade those picks away and rewrite history the couple can still see.
 */
export async function toggleActivityOffered(formData: FormData) {
  const { supabase } = await ensureProfile();
  const activityId = String(formData.get('activity_id') ?? '');
  const next = String(formData.get('is_offered') ?? '') === 'true';
  if (!activityId) back({ error: 'Missing segment.' });

  const { error } = await supabase
    .from('vendor_activities')
    .update({ is_offered: next, updated_at: new Date().toISOString() })
    .eq('activity_id', activityId);
  if (error) back({ error: 'Could not change that segment.' });

  revalidatePath(BASE);
  back({ saved: true });
}

/** Move one step up or down in the emcee's running order. */
export async function reorderActivity(formData: FormData) {
  const { supabase, profile } = await ensureProfile();
  const activityId = String(formData.get('activity_id') ?? '');
  const dir = String(formData.get('direction') ?? '');
  if (!activityId || (dir !== 'up' && dir !== 'down')) back({ error: 'Missing move.' });

  const { data } = await supabase
    .from('vendor_activities')
    .select('activity_id, display_order')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .order('display_order', { ascending: true });

  const rows = (data ?? []) as { activity_id: string; display_order: number }[];
  const i = rows.findIndex((r) => r.activity_id === activityId);
  if (i < 0) back();
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) back(); // already at the end — a no-op, not an error

  // Swap the two orders. Two writes, because a single statement cannot swap
  // without a temporary and this list is small by nature.
  const a = rows[i]!;
  const b = rows[j]!;
  await supabase
    .from('vendor_activities')
    .update({ display_order: b.display_order })
    .eq('activity_id', a.activity_id);
  await supabase
    .from('vendor_activities')
    .update({ display_order: a.display_order })
    .eq('activity_id', b.activity_id);

  revalidatePath(BASE);
  back({ saved: true });
}
