'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  canAddZone,
  computeNextZoneIndex,
  normalizeZoneInput,
  normalizeZoneLabel,
  normalizeVenueLabel,
} from '@/lib/live-studio-roam-zones';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import { eventSkuActive } from '@/lib/entitlements';
import { LIVE_STUDIO_SKU, channelForZoneIndex } from '@/lib/live-studio-control';
import {
  LOWER_THIRD_SUBTITLE_MAX,
  LOWER_THIRD_TITLE_MAX,
  highlightOffsetSeconds,
  normalizeHighlightLabel,
  normalizeLowerThirdLine,
  normalizeMonogramPosition,
  normalizeQrPosition,
  saveOverlaySettings,
} from '@/lib/live-studio-overlays';
import { getActivePanoodBroadcast } from '@/lib/panood-broadcast';
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
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ⭐ WAVE 3 — THE PAYWALL MOVED (owner-locked 2026-07-25 · § 4d, SUPERSEDING the
 * Wave 1/2 gating that most of this file was written under).
 *
 * These actions are now HOST-GATED ONLY. Adding a camera, naming it, cutting
 * between channels on CH 1, placing the monogram / lower third and setting
 * guest-pick are all REHEARSAL: they write control-plane rows that no guest can
 * see, on the host's own phones, at their own rehearsal. Charging ₱2,999 before
 * they have ever felt that was the defect § 4d exists to fix.
 *
 * The paywall now sits at PUBLICATION — lib/live-studio-publish.ts, enforced in
 * mirrorRoamManifest (the only writer of the guest-visible multi-channel manifest)
 * and re-enforced on every public read in app/[slug]/_lib/loaders.ts. Nothing in
 * this file can publish anything, which is exactly why nothing in this file needs
 * an entitlement gate.
 *
 * The two exceptions, and they are principled: ⚡ markHighlight / deleteHighlight
 * keep requireLiveStudioOwned. A "moment" is an offset into a REAL broadcast, not a
 * rehearsal artifact, and Wave 2 shipped it as part of the paid unlock (§ 4b) —
 * § 4d moved the multi-cam gate, it did not make the paid extras free.
 * ══════════════════════════════════════════════════════════════════════════════
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
 * The PAID gate — now used ONLY by the ⚡ highlight-moment actions.
 *
 * ⚠ WAVE 3 (§ 4d): this must NOT be re-added to the rehearsal / configuration
 * actions. It used to guard add / rename / delete / feature / cut / clear / overlay
 * / guest-pick, and moving it off those is the entire point of "rehearse free, pay
 * to broadcast". The publication paywall lives in lib/live-studio-publish.ts. If a
 * future action can make something GUEST-VISIBLE, gate it there — not here.
 *
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
 * RENAME a channel in place — the ✎ on each camera tile (approved single-screen
 * controller, Wave 1). Channel names are the HOST'S OWN (owner 2026-07-25): the
 * text under each tile is theirs, and they must be able to fix it on the day
 * without leaving the one screen. Reuses the same pure normalizers as the add
 * form (one validation source of truth) and the same host + ownership gates as
 * every other control-plane write, so a free host cannot rename anything.
 */
export async function renameRoamZone(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const zoneIdRaw = formData.get('zone_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;
  if (!liveStudioRoamEnabled()) redirect(`/dashboard/${eventId}/studio`);
  const zoneId = typeof zoneIdRaw === 'string' ? Number(zoneIdRaw) : NaN;
  if (!Number.isFinite(zoneId)) redirect(SETUP_PATH(eventId));

  const label = normalizeZoneLabel(formData.get('label'));
  if (!label) {
    redirect(`${SETUP_PATH(eventId)}?zone_error=label`);
  }
  // Venue is optional: an empty field clears the grouping (normalize → null).
  const venueLabel = normalizeVenueLabel(formData.get('venue_label'));

  await requireHostMembership(eventId);
  const supabase = await createClient();
  const { error } = await supabase
    .from('live_studio_roam_zones')
    .update({ label, venue_label: venueLabel })
    .eq('event_id', eventId)
    .eq('id', zoneId);
  if (error) {
    redirect(`${SETUP_PATH(eventId)}?zone_error=save`);
  }

  revalidatePath(SETUP_PATH(eventId));
  redirect(`${SETUP_PATH(eventId)}?zone_renamed=1`);
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

/* ══════════════════════════════════════════════════════════════════════════════
   WAVE 2 — the ₱0 broadcast extras (owner-locked 2026-07-25 · § 4b)
   WAVE 3 — their gating RELOCATED (owner-locked 2026-07-25 · § 4d)

   GATING as it stands now:
     • Ⓜ monogram · ▬ lower third → host-gated ONLY. PLACING them is rehearsal
       (§ 4d lists "place/configure the monogram + lower third" as free); PUTTING
       THEM ON AIR is still paid, and that is enforced where it belongs —
       resolveOverlays() re-asks the entitlement on the program surface every
       render, so a free host's configured monogram simply is not drawn on air.
     • ⬛ event QR                 → host-gated ONLY (FREE, owner-locked § 4b)
     • guest-pick                 → host-gated ONLY. Setting the switch is
       rehearsal; it only MEANS anything against a published multi-channel
       manifest, and the publish gate already reduces a free event to one channel
       (lib/live-studio-publish.ts), so the switch is inert without the unlock
       rather than blocked before it.
     • ⚡ highlights               → requireLiveStudioOwned (PAID). A moment is an
       offset into a real broadcast, not a rehearsal artifact.

   The free tier's "POWERED BY SETNAYAN" lower third STILL has no action at all — it
   is derived from the entitlement in resolveOverlays(), never stored, so there is no
   request a free host could replay to remove it and no column to tamper with. That
   property is why letting a free host write `lower_third_*` is safe: their own text
   is stored and previewed, and the free branch of the resolver never consults it.
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * Ⓜ monogram overlay — on/off + which corner. FREE TO PLACE (§ 4d rehearsal);
 * only drawn ON AIR for a host who owns LIVE_STUDIO (resolveOverlays).
 */
export async function setMonogramOverlay(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;
  if (!liveStudioRoamEnabled()) redirect(`/dashboard/${eventId}/studio`);

  // `enabled` is the desired NEXT state, posted by the toggle; `position` is
  // optional so the corner picker can move the bug without touching on/off.
  const enabledRaw = formData.get('enabled');
  const positionRaw = formData.get('position');

  await requireHostMembership(eventId);
  const supabase = await createClient();

  const patch: Parameters<typeof saveOverlaySettings>[2] = {};
  if (typeof enabledRaw === 'string') patch.monogram_enabled = enabledRaw === 'true';
  if (typeof positionRaw === 'string') patch.monogram_position = normalizeMonogramPosition(positionRaw);
  if (Object.keys(patch).length === 0) redirect(SETUP_PATH(eventId));

  const ok = await saveOverlaySettings(supabase, eventId, patch);
  if (!ok) redirect(`${SETUP_PATH(eventId)}?overlay_error=save`);

  revalidatePath(SETUP_PATH(eventId));
  redirect(`${SETUP_PATH(eventId)}?overlay_saved=monogram`);
}

/**
 * ▬ Lower third — on/off + the host's own two lines. FREE TO WRITE (§ 4d
 * rehearsal); only drawn ON AIR for a host who owns LIVE_STUDIO.
 *
 * A free host who types their own bar still broadcasts "POWERED BY SETNAYAN": the
 * free branch of resolveOverlays never reads these columns. Storing their text is
 * therefore not a hole — it is the rehearsal they are entitled to, and the thing
 * they buy is putting it on air.
 *
 * Text is normalized + length-capped by the shared pure helpers, so the bar cannot
 * be made to overflow the frame from the form.
 */
export async function setLowerThird(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;
  if (!liveStudioRoamEnabled()) redirect(`/dashboard/${eventId}/studio`);

  const enabledRaw = formData.get('enabled');
  const hasText = formData.has('title') || formData.has('subtitle');

  await requireHostMembership(eventId);
  const supabase = await createClient();

  const patch: Parameters<typeof saveOverlaySettings>[2] = {};
  if (typeof enabledRaw === 'string') patch.lower_third_enabled = enabledRaw === 'true';
  if (hasText) {
    patch.lower_third_title = normalizeLowerThirdLine(formData.get('title'), LOWER_THIRD_TITLE_MAX);
    patch.lower_third_subtitle = normalizeLowerThirdLine(
      formData.get('subtitle'),
      LOWER_THIRD_SUBTITLE_MAX,
    );
  }
  if (Object.keys(patch).length === 0) redirect(SETUP_PATH(eventId));

  const ok = await saveOverlaySettings(supabase, eventId, patch);
  if (!ok) redirect(`${SETUP_PATH(eventId)}?overlay_error=save`);

  revalidatePath(SETUP_PATH(eventId));
  redirect(`${SETUP_PATH(eventId)}?overlay_saved=lower_third`);
}

/**
 * ⬛ Event-QR overlay — on/off + which corner. **FREE (owner-locked 2026-07-25.)**
 *
 * Host-gated only: there is deliberately NO requireLiveStudioOwned here. A
 * scan-to-join code on the broadcast pulls that wedding's guests into Setnayan, so
 * gating it would be charging for our own distribution.
 */
export async function setEventQrOverlay(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;
  if (!liveStudioRoamEnabled()) redirect(`/dashboard/${eventId}/studio`);

  const enabledRaw = formData.get('enabled');
  const positionRaw = formData.get('position');

  await requireHostMembership(eventId);
  const supabase = await createClient();

  const patch: Parameters<typeof saveOverlaySettings>[2] = {};
  if (typeof enabledRaw === 'string') patch.event_qr_enabled = enabledRaw === 'true';
  if (typeof positionRaw === 'string') patch.event_qr_position = normalizeQrPosition(positionRaw);
  if (Object.keys(patch).length === 0) redirect(SETUP_PATH(eventId));

  const ok = await saveOverlaySettings(supabase, eventId, patch);
  if (!ok) redirect(`${SETUP_PATH(eventId)}?overlay_error=save`);

  revalidatePath(SETUP_PATH(eventId));
  redirect(`${SETUP_PATH(eventId)}?overlay_saved=event_qr`);
}

/**
 * GUEST-PICK — the real, optional switch (owner-locked "make it optional").
 * HOST-GATED, free to set (§ 4d lists "set guest-pick" as rehearsal).
 *
 * The public page honors it by OMISSION (lib/live-studio-roam.ts → applyGuestPick),
 * so flipping this off actually removes the other channels' video ids from what the
 * viewer is sent — it is not a hidden picker.
 *
 * Free to SET, inert without the unlock: the publish gate reduces a free event's
 * manifest to the single on-air channel BEFORE applyGuestPick runs, so "guests may
 * pick" has nothing to pick between. That composition is why this needed no
 * entitlement gate of its own — one enforcement point, not two that can disagree.
 */
export async function setGuestPick(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const enabledRaw = formData.get('enabled');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;
  if (!liveStudioRoamEnabled()) redirect(`/dashboard/${eventId}/studio`);
  if (typeof enabledRaw !== 'string') redirect(SETUP_PATH(eventId));

  await requireHostMembership(eventId);
  const supabase = await createClient();

  const { error } = await supabase
    .from('events')
    .update({ live_studio_guest_pick_enabled: enabledRaw === 'true' })
    .eq('event_id', eventId);
  if (error) redirect(`${SETUP_PATH(eventId)}?overlay_error=save`);

  revalidatePath(SETUP_PATH(eventId));
  // The public event page reads this column — re-render it so the change is live.
  revalidatePath('/[slug]', 'page');
  redirect(`${SETUP_PATH(eventId)}?guest_pick=${enabledRaw === 'true' ? 'on' : 'off'}`);
}

/**
 * ⚡ Mark a highlight MOMENT. PAID, and only while a broadcast is actually on air.
 *
 * Pure metadata: one row carrying when it happened, how far into the broadcast, and
 * a SNAPSHOT of which channel was on Channel 1. No video is read, cut, re-encoded or
 * stored — which is exactly why this is real today and costs ₱0.
 *
 * The off-air rejection is not defensive noise: an offset is measured from
 * `went_live_at`, so a moment marked off air could never become a chapter. Refusing
 * beats persisting a row that can only ever be a lie.
 */
export async function markHighlight(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;
  if (!liveStudioRoamEnabled()) redirect(`/dashboard/${eventId}/studio`);

  await requireHostMembership(eventId);
  await requireLiveStudioOwned(eventId);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Server-resolved liveness — never trust a posted "isLive".
  let broadcast: Awaited<ReturnType<typeof getActivePanoodBroadcast>> = null;
  try {
    broadcast = await getActivePanoodBroadcast(eventId);
  } catch {
    broadcast = null;
  }
  if (!broadcast) redirect(`${SETUP_PATH(eventId)}?highlight_error=offair`);

  // Snapshot the on-air channel in the host's own words. Denormalized on purpose:
  // renaming or deleting the camera later must not rewrite what happened.
  const { data: onAir } = await supabase
    .from('live_studio_roam_zones')
    .select('zone_index, label')
    .eq('event_id', eventId)
    .eq('is_main_stage', true)
    .maybeSingle();
  const zone = (onAir ?? null) as { zone_index: number; label: string } | null;

  const markedAt = new Date();
  const { error } = await supabase.from('live_studio_highlights').insert({
    event_id: eventId,
    marked_at: markedAt.toISOString(),
    offset_seconds: highlightOffsetSeconds(markedAt, broadcast.went_live_at ?? null),
    channel: zone ? channelForZoneIndex(zone.zone_index) : null,
    channel_label: zone?.label ?? null,
    label: normalizeHighlightLabel(formData.get('label')),
    created_by: user?.id ?? null,
  });
  if (error) redirect(`${SETUP_PATH(eventId)}?highlight_error=save`);

  revalidatePath(SETUP_PATH(eventId));
  redirect(`${SETUP_PATH(eventId)}?highlight=marked`);
}

/** Remove a mis-tapped moment. PAID (same gate as marking one). */
export async function deleteHighlight(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  const idRaw = formData.get('highlight_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) return;
  const eventId = eventIdRaw;
  if (!liveStudioRoamEnabled()) redirect(`/dashboard/${eventId}/studio`);
  const highlightId = typeof idRaw === 'string' ? Number(idRaw) : NaN;
  if (!Number.isFinite(highlightId)) redirect(SETUP_PATH(eventId));

  await requireHostMembership(eventId);
  await requireLiveStudioOwned(eventId);
  const supabase = await createClient();
  await supabase
    .from('live_studio_highlights')
    .delete()
    .eq('event_id', eventId)
    .eq('id', highlightId);

  revalidatePath(SETUP_PATH(eventId));
  redirect(`${SETUP_PATH(eventId)}?highlight=removed`);
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
