import type { SupabaseClient } from '@supabase/supabase-js';
import { eventSkuActive } from '@/lib/entitlements';
import { LIVE_STUDIO_SKU } from '@/lib/live-studio-control';
import { selectMainStageZone, type RoamManifest } from '@/lib/live-studio-roam';

/**
 * apps/web/lib/live-studio-publish.ts
 *
 * ⭐ THE LIVE STUDIO PAYWALL — "REHEARSE FREE, PAY TO BROADCAST"
 * (owner-locked 2026-07-25 · Live_Studio_Unified_Spec_2026-07-25.md § 4d, which
 * SUPERSEDES the Wave 1/2 gating.)
 *
 * ── WHAT MOVED, AND WHY ────────────────────────────────────────────────────────
 * Waves 1–2 put the paywall on the MECHANIC: `requireLiveStudioOwned` sat on the
 * cut / channel-config / overlay-config actions, so a free host saw padlocked tiles
 * and was asked for ₱2,999 for an experience they had never felt — for a day that
 * cannot be redone. The owner moved it to where the value actually is:
 *
 *   FREE  · private rehearsal, unlimited — add cameras, name them, tap-cut between
 *           them on CH 1, place the monogram / lower third, set guest-pick. Nothing
 *           is published, so no guest can watch.
 *   FREE  · broadcasting ONE camera (unchanged; the live /pricing page promises
 *           "Single-camera livestream" free and that claim must not break).
 *   PAID  · broadcasting MULTI-CAM — more than one channel visible to guests, live
 *           switching of a published stream, guest-pick on a published stream, and
 *           the paid overlays on air.
 *
 * PUBLICATION IS THE PAYWALL. It cannot be gamed into a free wedding: no
 * publication means no viewers, and a wedding broadcast with no viewers is not a
 * wedding broadcast.
 *
 * ── WHERE THE GATE PHYSICALLY SITS ─────────────────────────────────────────────
 * There are exactly TWO columns that make live video guest-visible, and this module
 * stands on both:
 *
 *   1. `events.live_studio_roam_manifest` — the multi-channel picker manifest. Its
 *      ONLY writer is mirrorRoamManifest() (lib/live-studio-roam-provision.ts), which
 *      now calls this gate before it writes. That is the choke point: a free host
 *      cannot get a second entry into that column by any route, because no other
 *      route writes it.
 *   2. `events.panood_watch_url` — the single-camera embed. ONE url = ONE channel =
 *      free, and deliberately untouched here.
 *
 * ── WHY THE READ GATE IS LOAD-BEARING, NOT BELT-AND-BRACES ─────────────────────
 * The public read re-applies the same reduction on every render
 * (app/[slug]/_lib/loaders.ts), for TWO reasons, and the second one is the sharp one:
 *
 *   (a) Settings persist while permission does not. An entitlement that lapses, is
 *       refunded or is revoked after the mirror ran would otherwise leave a fully
 *       published multi-cam stream up until something happened to rewrite the column.
 *   (b) `events` UPDATE RLS is ROW-level, not column-level (couple_can_update_event,
 *       migration 20260512000000): a couple may update ANY column of their own event
 *       row. The Supabase anon key is public by design, so a determined host could
 *       PATCH `live_studio_roam_manifest` straight through PostgREST, bypassing every
 *       server action and this module's write gate. THE READ GATE IS WHAT MAKES THAT
 *       POINTLESS — whatever the column contains, an un-entitled event is served ONE
 *       channel. Do not remove it as "redundant"; without it the write gate is a
 *       front door with the back door open. (Column-level privileges on `events`
 *       would be the belt to this brace, and are not in scope here.)
 *
 * Two independent enforcement points, the same pure helper — the resolveOverlays
 * posture: re-ask permission at the point of render, never trust a stored decision.
 *
 * FAIL-CLOSED. Every entitlement lookup here resolves to `false` on any error, and
 * `false` means "publish one channel, not many". A database blip must never be the
 * reason a ₱2,999 multi-cam broadcast goes out for free.
 */

/**
 * How many channels a host may publish to guests without the unlock. ONE — the
 * always-free single-camera livestream. This is the whole numeric content of the
 * paywall; everything else in this module is plumbing around it.
 */
export const FREE_PUBLISHED_CHANNEL_LIMIT = 1;

export type PublishDecision = {
  /** May this publish proceed as requested? */
  allowed: boolean;
  /** How many channels the caller asked to publish. */
  requested: number;
  /** How many it is actually permitted to publish. */
  permitted: number;
  /**
   * Why it was refused — `null` when allowed. Only one reason exists on purpose:
   * the single-camera path is never refused, so there is nothing else to say.
   */
  reason: 'multi_cam_locked' | null;
};

/**
 * The one decision, pure and unit-tested: may this event publish `channelCount`
 * channels to guests?
 *
 * Publishing ZERO or ONE channel is always allowed — that is the free livestream,
 * and a host taking their stream down must never be blocked by a paywall. Two or
 * more requires the unlock.
 */
export function decidePublish(input: { owned: boolean; channelCount: number }): PublishDecision {
  const requested = Number.isFinite(input.channelCount) ? Math.max(0, Math.trunc(input.channelCount)) : 0;
  if (input.owned) {
    return { allowed: true, requested, permitted: requested, reason: null };
  }
  const permitted = Math.min(requested, FREE_PUBLISHED_CHANNEL_LIMIT);
  return {
    allowed: requested <= FREE_PUBLISHED_CHANNEL_LIMIT,
    requested,
    permitted,
    reason: requested <= FREE_PUBLISHED_CHANNEL_LIMIT ? null : 'multi_cam_locked',
  };
}

/**
 * Reduce a manifest to what this host is PERMITTED to publish.
 *
 * Owned → untouched. Not owned → at most the single channel Channel 1 is carrying
 * (selectMainStageZone: the explicit cut, else the featured/default, else the first
 * live one), so the free tier still gets a real, working one-camera stream rather
 * than a punished empty page.
 *
 * Deliberately the SAME selection function applyGuestPick uses, so "which one
 * channel survives" has one answer across the codebase, and reduction is by
 * OMISSION: the other channels' `videoId`s are never serialised into the page, which
 * is the only form of enforcement that survives someone reading the page source.
 * Pure — shared by the write gate and the read gate.
 */
export function limitPublishedManifest(manifest: RoamManifest, owned: boolean): RoamManifest {
  if (owned) return manifest;
  if (manifest.length <= FREE_PUBLISHED_CHANNEL_LIMIT) return manifest;
  const onAir = selectMainStageZone(manifest);
  return onAir ? [onAir] : [];
}

/**
 * Resolve the LIVE_STUDIO entitlement for a publish decision. FAIL-CLOSED: any
 * throw, any transport error, any missing table resolves to `false`.
 *
 * Pass a SERVICE-ROLE / admin client on public + provisioning surfaces — `orders`
 * RLS is purchaser-scoped, so a session client on the public wedding page would read
 * "not owned" for a host who genuinely paid. (That direction is safe rather than
 * exploitable, but it would wrongly strip a paying couple's multi-cam mid-wedding.)
 */
export async function canPublishMultiCam(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  if (!eventId) return false;
  try {
    return await eventSkuActive(supabase, eventId, LIVE_STUDIO_SKU);
  } catch {
    return false;
  }
}
