import type { SupabaseClient } from '@supabase/supabase-js';
import { eventSkuActive } from '@/lib/entitlements';

/**
 * apps/web/lib/pabati.ts
 *
 * Backend helpers for PABATI — the guest video-greeting collector. Up to 300
 * guests-or-the-couple record a short (≤5s) video greeting that lands in a
 * shared, couple-reviewed gallery on the event's Setnayan landing page.
 *
 * This is FOUNDATION ONLY (schema + backend). The collector UI, the landing-
 * page surface, and the recap/day-of wiring ship in a later "surfaces" PR. The
 * v2 catalog deliberately keeps PABATI='not_built' until then so a couple can't
 * buy a feature with no surface.
 *
 * Mirrors the Papic guest-camera shape (lib/papic-guest.ts):
 *   • eventPabatiActive()  — the bundle-aware, admin-approved FEATURE GATE,
 *     delegating to eventSkuActive('PABATI') (refund-aware + graceful-degrade +
 *     counts a MEDIA_PACK bundle that includes PABATI).
 *   • fetchPabatiQuota()   — the read side that drives the "N greetings left"
 *     display, counting pabati_clips for the event against the 300 cap. The
 *     AUTHORITATIVE enforcement is the SECURITY DEFINER RPC pabati_record_clip
 *     (which re-counts under an advisory lock in the same transaction as the
 *     insert); this read is advisory only.
 *
 * Corpus hard locks this file participates in:
 *   • MAX 300 CLIPS/EVENT — PABATI_CLIP_CAP below; the RPC is the real gate.
 *   • 5-SECOND CLIP CAP — enforced in the RPC (LEAST(ms,5000)) + the route.
 *   • NSFW SCREEN on by default, cannot disable — screenPabatiClipPoster()
 *     drives it app-side over the shared moderation_state column.
 *
 * Graceful-degrade on a missing/legacy table (42P01 undefined_table · 42703
 * undefined_column) so a pre-migration database surfaces the upgrade / empty
 * state rather than crashing — matches the papic-guest.ts pattern.
 */

export const PABATI_SERVICE_KEY = 'PABATI';

/**
 * Max video greetings per event. Corpus hard lock: "max 300 clips/event."
 * The authoritative enforcement is the DB RPC pabati_record_clip (advisory-
 * locked count); this constant only drives the client-facing display.
 */
export const PABATI_CLIP_CAP = 300;

/**
 * Is PABATI ACTIVE (admin-approved) for this event? The handshake FEATURE GATE
 * — the collector unlocks only after the Setnayan team verifies the payment
 * (owner 2026-06-18). Bundle-aware (a MEDIA_PACK that includes PABATI counts).
 * Refund-aware + graceful-degrade via eventSkuActive(). The future buy surface
 * should pair this with the (pending-counting) eventOwnsSku for double-buy
 * prevention, exactly like Papic Guest.
 */
export async function eventPabatiActive(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  return eventSkuActive(supabase, eventId, PABATI_SERVICE_KEY);
}

// ─────────────────────────────────────────────────────────────────────────
// Quota — count an event's clips + derive greetings remaining. Mirrors
// papic-guest.ts fetchGuestQuota, but keyed by EVENT (the 300 cap is per-event,
// not per-guest). `supabase` here is an admin client (the guest prompt is a
// public surface with no RLS session). Graceful-degrade to a full-quota shape
// (used=0) on a missing/legacy table so the first clip can still be attempted —
// the RPC is the real gate.
// ─────────────────────────────────────────────────────────────────────────

export type PabatiQuota = {
  /** How many greetings the event started with (300). */
  total: number;
  /** How many clips the event has already recorded. */
  used: number;
  /** total − used, floored at 0. */
  remaining: number;
};

export async function fetchPabatiQuota(
  supabase: SupabaseClient,
  eventId: string,
): Promise<PabatiQuota> {
  const { count, error } = await supabase
    .from('pabati_clips')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  if (error) {
    // Pre-migration table (42P01) / missing column (42703) or any read error →
    // assume nothing used yet. The RPC enforces the real cap; this read only
    // drives the display.
    return { total: PABATI_CLIP_CAP, used: 0, remaining: PABATI_CLIP_CAP };
  }

  const used = count ?? 0;
  return {
    total: PABATI_CLIP_CAP,
    used,
    remaining: Math.max(0, PABATI_CLIP_CAP - used),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// NSFW screening for a video greeting (corpus lock: on by default, cannot
// disable). The shared Papic nsfw engine (lib/nsfw-screen.ts) is IMAGE-ONLY —
// it screens a clip by its POSTER FRAME (nsfwjs can't read video, and the
// lambda has no ffmpeg). Pabati clips screen the same way: the collector UI
// extracts a poster JPEG at capture time and posts it alongside the clip.
//
// This helper classifies that poster's bytes with the shared classifier and
// persists the verdict on pabati_clips.moderation_state, ONLY over a row still
// 'unscreened' (never clobbers a couple override). FAIL-OPEN: any error (no
// poster, classifier hiccup, missing row) leaves the row 'unscreened' — every
// guest-facing surface (shipped later) excludes clips that aren't 'clean'-or-
// 'unscreened' the same structural way Papic does, so a posterless clip never
// projects on the wall.
//
// WHY not screen the video bytes directly — nsfwjs is image-only; without a
// poster there is nothing to classify until a native/ffmpeg frame-extract
// pipeline exists (V1.x). Mirrors screenCapture()'s posterless-clip skip.
// ─────────────────────────────────────────────────────────────────────────

export async function screenPabatiClipPoster(opts: {
  clipR2Ref: string;
  posterBytes?: Uint8Array;
}): Promise<void> {
  try {
    if (!opts.posterBytes || opts.posterBytes.byteLength === 0) {
      // No poster → leave 'unscreened' (guest surfaces exclude non-'clean'
      // clips structurally). Nothing to classify until a frame-extract exists.
      return;
    }
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const { classifyImageBytes, decideNsfw } = await import('@/lib/nsfw-screen');
    const admin = createAdminClient();

    // Only screen a row that still needs it — never clobber a couple override.
    const { data: row, error: rowError } = await admin
      .from('pabati_clips')
      .select('clip_id, moderation_state')
      .eq('r2_object_key', opts.clipR2Ref)
      .maybeSingle();
    if (rowError || !row) return;
    if ((row as { moderation_state?: string }).moderation_state !== 'unscreened') return;

    const scores = await classifyImageBytes(opts.posterBytes);
    const decision = decideNsfw(scores);

    await admin
      .from('pabati_clips')
      .update({ moderation_state: decision })
      .eq('r2_object_key', opts.clipR2Ref)
      .eq('moderation_state', 'unscreened');
  } catch (err) {
    // FAIL-OPEN — row stays 'unscreened'; a clip is never lost to a classifier
    // hiccup. One warn for diagnosis.
    console.warn(
      `[pabati] poster screen skipped (fail-open, row stays unscreened): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
