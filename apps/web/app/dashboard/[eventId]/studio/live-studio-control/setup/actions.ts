'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  canAddZone,
  computeNextZoneIndex,
  normalizeZoneInput,
} from '@/lib/live-studio-roam-zones';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import { eventSkuActive } from '@/lib/entitlements';
import { LIVE_STUDIO_SKU } from '@/lib/live-studio-control';
import { normalizeYouTubeWatchUrl } from '@/lib/panood-watch';

/**
 * Server actions for the Live Studio ROAM controller — the host-facing surface that
 * sets up the multiple channels (zones/cameras/venues) guests pick between.
 *
 * These are CONTROL-PLANE writes to live_studio_roam_zones only (label, venue,
 * featured, order). They do NOT touch the secret-bearing live_studio_roam_streams
 * table or the pool — YouTube broadcast provisioning is a separate, owner-OAuth-gated
 * step (lib/live-studio-roam-provision.ts). So a host can fully configure Roam and buy
 * it before any streaming credentials exist; the picker simply stays dark (empty
 * manifest) until provisioning mirrors live videoIds in.
 *
 * Auth: requireHostMembership mirrors the shipped panood/save-the-date pattern
 * (moderator OR legacy couple membership). The live_studio_roam_zones RLS
 * (couple + coordinator + admin, migration 20270919193341) is the hard backstop —
 * these actions use the user-session client so RLS applies.
 *
 * The whole surface is behind NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED; each action
 * re-checks the flag (defense-in-depth — a server action id ships in the client
 * bundle) and no-ops with a redirect back to Studio when the flag is off.
 */

const SETUP_PATH = (eventId: string) =>
  `/dashboard/${eventId}/studio/live-studio-control/setup`;

// The Live Studio detail/buy surface — where a locked (free) host is bounced if
// they somehow POST a multi-camera action without owning LIVE_STUDIO.
const DETAIL_PATH = (eventId: string) =>
  `/dashboard/${eventId}/studio/live-studio-control`;

async function requireHostMembership(eventId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: moderator } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  if (moderator) return;

  const { data: legacy } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (legacy?.member_type === 'couple' || legacy?.member_type === 'coordinator') return;

  redirect('/dashboard');
}

/**
 * The PAID gate for the multi-camera controller (unified Live Studio · 2026-07-25).
 * These control-plane writes (add/delete/feature a camera, cut/clear the Main Stage)
 * are the LOCKED half of the shared controller — only a host who owns LIVE_STUDIO may
 * run them. The UI already greys them out for a free host with an "Unlock" CTA; this
 * is the server-side backstop so the lock can't be bypassed by replaying a form post.
 * The FREE single-camera livestream (savePanoodWatchUrl / go-live) is NOT gated here.
 * A locked host is bounced to the detail/buy page rather than erroring.
 */
async function requireLiveStudioOwned(eventId: string): Promise<void> {
  const supabase = await createClient();
  const owned = await eventSkuActive(supabase, eventId, LIVE_STUDIO_SKU);
  if (!owned) redirect(DETAIL_PATH(eventId));
}

/** Add a new channel/zone. Enforces the per-event cap + label rule (pure helpers). */
export async function addRoamZone(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;
  if (!liveStudioRoamEnabled()) redirect(`/dashboard/${eventId}/studio`);

  const parsed = normalizeZoneInput({
    label: formData.get('label'),
    venueLabel: formData.get('venue_label'),
    isFeatured: formData.get('is_featured'),
  });
  if (!parsed.ok) {
    redirect(`${SETUP_PATH(eventId)}?zone_error=label`);
  }

  await requireHostMembership(eventId);
  await requireLiveStudioOwned(eventId);
  const supabase = await createClient();

  // Read current zones (for cap + next index). RLS scopes this to the host's event.
  const { data: existing } = await supabase
    .from('live_studio_roam_zones')
    .select('id, zone_index')
    .eq('event_id', eventId);
  const zones = (existing ?? []) as { id: number; zone_index: number }[];

  if (!canAddZone(zones.length)) {
    redirect(`${SETUP_PATH(eventId)}?zone_error=cap`);
  }

  const zoneIndex = computeNextZoneIndex(zones);

  // Only one featured zone at a time: if this one is featured, clear the rest first.
  if (parsed.value.isFeatured) {
    await supabase
      .from('live_studio_roam_zones')
      .update({ is_featured: false })
      .eq('event_id', eventId)
      .eq('is_featured', true);
  }

  const { error } = await supabase.from('live_studio_roam_zones').insert({
    event_id: eventId,
    zone_index: zoneIndex,
    label: parsed.value.label,
    venue_label: parsed.value.venueLabel,
    is_featured: parsed.value.isFeatured,
    sort_order: zoneIndex,
    status: 'planned',
  });
  if (error) {
    redirect(`${SETUP_PATH(eventId)}?zone_error=save`);
  }

  revalidatePath(SETUP_PATH(eventId));
  redirect(`${SETUP_PATH(eventId)}?zone_added=1`);
}

/** Delete a channel/zone by id (event-scoped; RLS backstops cross-event tampering). */
export async function deleteRoamZone(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const zoneIdRaw = formData.get('zone_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;
  if (!liveStudioRoamEnabled()) redirect(`/dashboard/${eventId}/studio`);
  const zoneId = typeof zoneIdRaw === 'string' ? Number(zoneIdRaw) : NaN;
  if (!Number.isFinite(zoneId)) redirect(SETUP_PATH(eventId));

  await requireHostMembership(eventId);
  await requireLiveStudioOwned(eventId);
  const supabase = await createClient();
  await supabase
    .from('live_studio_roam_zones')
    .delete()
    .eq('event_id', eventId)
    .eq('id', zoneId);

  revalidatePath(SETUP_PATH(eventId));
  redirect(`${SETUP_PATH(eventId)}?zone_deleted=1`);
}

/**
 * CUT one camera to the directed **Main Stage** (unified Live Studio · 2026-07-25).
 * The switching half of the unified controller: one tap re-points the Main Stage
 * output at this zone. At most one zone per event is on Main Stage, so this clears
 * any prior cut first (two writes; the viewer's selectMainStageZone tolerates
 * zero-or-one main-stage and falls back to featured). Switching only — NO
 * server-side compositing. Control-plane write to live_studio_roam_zones only.
 */
export async function cutToMainStage(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const zoneIdRaw = formData.get('zone_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;
  if (!liveStudioRoamEnabled()) redirect(`/dashboard/${eventId}/studio`);
  const zoneId = typeof zoneIdRaw === 'string' ? Number(zoneIdRaw) : NaN;
  if (!Number.isFinite(zoneId)) redirect(SETUP_PATH(eventId));

  await requireHostMembership(eventId);
  await requireLiveStudioOwned(eventId);
  const supabase = await createClient();
  // Clear the current cut, then set the chosen one. Two writes (Supabase JS has no
  // multi-statement txn); a transient partial state degrades to "no cut → featured"
  // rather than error (selectMainStageZone).
  await supabase
    .from('live_studio_roam_zones')
    .update({ is_main_stage: false })
    .eq('event_id', eventId)
    .eq('is_main_stage', true);
  await supabase
    .from('live_studio_roam_zones')
    .update({ is_main_stage: true })
    .eq('event_id', eventId)
    .eq('id', zoneId);

  revalidatePath(SETUP_PATH(eventId));
  redirect(`${SETUP_PATH(eventId)}?main_stage_cut=1`);
}

/** Deactivate the Main Stage — clears any current cut (no camera on air). */
export async function clearMainStage(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;
  if (!liveStudioRoamEnabled()) redirect(`/dashboard/${eventId}/studio`);

  await requireHostMembership(eventId);
  await requireLiveStudioOwned(eventId);
  const supabase = await createClient();
  await supabase
    .from('live_studio_roam_zones')
    .update({ is_main_stage: false })
    .eq('event_id', eventId)
    .eq('is_main_stage', true);

  revalidatePath(SETUP_PATH(eventId));
  redirect(`${SETUP_PATH(eventId)}?main_stage_cleared=1`);
}

/** Mark one zone as the featured (default) camera — clears any prior featured. */
export async function setFeaturedRoamZone(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const zoneIdRaw = formData.get('zone_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;
  if (!liveStudioRoamEnabled()) redirect(`/dashboard/${eventId}/studio`);
  const zoneId = typeof zoneIdRaw === 'string' ? Number(zoneIdRaw) : NaN;
  if (!Number.isFinite(zoneId)) redirect(SETUP_PATH(eventId));

  await requireHostMembership(eventId);
  await requireLiveStudioOwned(eventId);
  const supabase = await createClient();
  // Clear existing featured, then set the chosen one. Two writes (Supabase JS has
  // no multi-statement txn); the picker's selectFeaturedZone tolerates zero-or-one
  // featured, so a transient partial state degrades to "first live" rather than error.
  await supabase
    .from('live_studio_roam_zones')
    .update({ is_featured: false })
    .eq('event_id', eventId)
    .eq('is_featured', true);
  await supabase
    .from('live_studio_roam_zones')
    .update({ is_featured: true })
    .eq('event_id', eventId)
    .eq('id', zoneId);

  revalidatePath(SETUP_PATH(eventId));
  redirect(`${SETUP_PATH(eventId)}?featured_set=1`);
}

/* -------------------------------------------------------------------------- */
/*  FREE single-camera livestream — watch link (NOT LIVE_STUDIO-gated)         */
/* -------------------------------------------------------------------------- */
//
// The unified controller hosts the free single-camera livestream too. These two
// actions mirror the panood/setup watch-url actions (same DB column, same
// normalizer) but redirect back to THIS controller so the single-screen flow
// never bounces to the old panood route. They are host-gated only — the free
// single-cam livestream is available to every host, so there is NO
// requireLiveStudioOwned() here (that gate is for the multi-camera extras above).

/** Save the couple's YouTube watch link (free single-cam). Host-gated, not paid. */
export async function saveControlWatchUrl(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const urlRaw = formData.get('watch_url');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;
  if (!liveStudioRoamEnabled()) redirect(`/dashboard/${eventId}/studio`);
  if (typeof urlRaw !== 'string') return;

  const normalized = normalizeYouTubeWatchUrl(urlRaw);
  if (!normalized) {
    redirect(`${SETUP_PATH(eventId)}?watch_url_error=1`);
  }

  await requireHostMembership(eventId);
  const supabase = await createClient();
  await supabase.from('events').update({ panood_watch_url: normalized }).eq('event_id', eventId);

  revalidatePath(SETUP_PATH(eventId));
  revalidatePath('/[slug]', 'page');
  redirect(`${SETUP_PATH(eventId)}?watch_url_saved=1`);
}

/** Clear the saved watch link (free single-cam). Host-gated, not paid. */
export async function clearControlWatchUrl(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;
  if (!liveStudioRoamEnabled()) redirect(`/dashboard/${eventId}/studio`);

  await requireHostMembership(eventId);
  const supabase = await createClient();
  await supabase.from('events').update({ panood_watch_url: null }).eq('event_id', eventId);

  revalidatePath(SETUP_PATH(eventId));
  revalidatePath('/[slug]', 'page');
  redirect(SETUP_PATH(eventId));
}
