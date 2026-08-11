import 'server-only';

/**
 * lib/thank-you-video.ts — the Thank-You Video render PLAN.
 *
 * ─── WHAT THIS CLOSES ──────────────────────────────────────────────────────
 * `PAPIC_ADDON_THANK_YOU` has been on sale at ₱2,499 with **nothing anywhere
 * producing it**: no screen, no maker, no render step. A couple could pay and
 * receive nothing. Owner ruled "BUILD IT" 2026-08-10.
 *
 * ─── 🔑 THE RAILS ARE THE BROWSER. THE SERVER PATH IS THE PHANTOM. ─────────
 * Established 2026-08-11 before a line was written, because getting this
 * backwards would have shipped a feature that queues forever:
 *   • ✅ REAL — `lib/reel-render.ts`, 1,214 lines, client-side WebCodecs with a
 *     MediaRecorder fallback, already shared by THREE surfaces (Patiktok booth,
 *     Guest Stories, the creator teaser). Owner-locked 2026-06-18: "CLIENT-SIDE,
 *     ₱0 server compute … there is NO server ffmpeg/Remotion."
 *   • ❌ PHANTOM — the server queue. `render_jobs` and `patiktok_render_jobs`
 *     are EMPTY in prod (a third, `led_background_renders`, was DROPPED with
 *     the LED wall backdrop on 2026-08-11 — that feature was the one which
 *     never got a browser renderer either, so the owner removed it rather than
 *     stand up a render farm for it); no worker exists anywhere
 *     in this repo; `lib/render/recap-ffmpeg.ts` is a pure argv builder naming
 *     an "Oracle Always-Free" box that is not in this codebase; and the one file
 *     that looked like a worker was DELETED 2026-08-09 for faking completion.
 * So this module assembles a plan and the browser does the encoding, exactly
 * like `buildChapterTeaserPlan` — which this is a deliberate sibling of.
 *
 * ─── PRIVACY: WHY `fetchTeaserFrames` AND NOT THE COUPLE'S GALLERY ─────────
 * A thank-you film is sent to the people who came. It is an OUTBOUND SHARE, so
 * it takes the PUBLIC-safe read, not the couple's private one:
 *   • SEAT captures — moderation-withheld and couple-hidden frames excluded.
 *   • GUEST captures — the DOUBLE consent gate: the guest opted in to public use
 *     AND the couple approved it for showcase. An unconsented guest shot can
 *     never reach this film.
 *   • Every url is a geo-STRIPPED display derivative, never the geo-bearing
 *     original (RA 10173 · "geo is stripped on outbound shares"). A frame with
 *     no such derivative is SKIPPED rather than falling back.
 * 🔑 Using `fetchPapicGallery` here would have been the natural-looking choice
 *    and would have put unconsented guests' faces into a film sent to a hundred
 *    people. The couple owning the SKU does not make a guest's photo shareable.
 *
 * MUSIC is owned-catalogue only (`pickOwnedReelMusic` → `reel_music_tracks`,
 * active and non-premium). There is no BYO-audio path in this render: the only
 * audio source is that one server read, so no third-party track can reach it.
 * Null → the film renders silent rather than failing.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTeaserFrames, type TeaserFrame } from './papic-gallery';
import { pickOwnedReelMusic } from './guest-stories';
import {
  THANK_YOU_MAX_PHOTOS,
  THANK_YOU_TARGET_SEC,
  planFromFrames,
  type ThankYouPlan,
  type ThankYouPlanPhoto,
} from './thank-you-video-shared';

export {
  THANK_YOU_FOOTER,
  THANK_YOU_MAX_PHOTOS,
  THANK_YOU_MIN_PHOTOS,
  THANK_YOU_PALETTE,
  THANK_YOU_TARGET_SEC,
} from './thank-you-video-shared';
export type { ThankYouPlan, ThankYouPlanPhoto } from './thank-you-video-shared';

/**
 * Assemble the Thank-You Video plan for an event.
 *
 * ⚠ THE CALLER OWNS THE ENTITLEMENT CHECK. This builder deliberately does not
 * ask whether the SKU is owned — it is a data assembler, and folding a paywall
 * into it would put the money decision somewhere nobody looks for it. The page
 * gates on `eventSkuActive(…, 'PAPIC_ADDON_THANK_YOU')` before calling.
 *
 * Runs under the CALLER'S RLS-bound client, same discipline as the teaser: a
 * foreign event id simply returns no rows rather than another couple's photos.
 *
 * Never throws — any read trouble degrades to `canRender:false` with a sentence
 * a person can act on, because a maker that explodes is worse than one that
 * says "not yet, here's why".
 */
export async function buildThankYouVideoPlan(
  supabase: SupabaseClient,
  eventId: string,
): Promise<ThankYouPlan> {
  const base = {
    photos: [] as ThankYouPlanPhoto[],
    availableCount: 0,
    musicUrl: null,
    beatGrid: null,
    musicLabel: null,
    targetSec: THANK_YOU_TARGET_SEC,
  };

  if (!eventId) {
    return { ...base, canRender: false, reason: 'No event to build a thank-you film from.' };
  }

  // Over-fetch deliberately: `fetchTeaserFrames` applies the consent gates, so
  // the count AFTER filtering is the only honest number to show a couple. Asking
  // for exactly THANK_YOU_MAX_PHOTOS would make "you have 20" indistinguishable
  // from "you have 200 and we took 20".
  let frames: TeaserFrame[];
  try {
    frames = await fetchTeaserFrames(supabase, eventId, THANK_YOU_MAX_PHOTOS * 3);
  } catch {
    frames = [];
  }

  // The RULE lives in the client-safe module and is unit-tested there. This
  // module stays a reader: consent filtering (fetchTeaserFrames) + music.
  const decided = planFromFrames(frames.map((f) => ({ clipId: f.id, url: f.url })));

  if (!decided.canRender) {
    return {
      ...base,
      availableCount: decided.availableCount,
      canRender: false,
      reason: decided.reason,
    };
  }

  const music = await pickOwnedReelMusic();

  return {
    canRender: true,
    reason: null,
    photos: decided.photos,
    availableCount: decided.availableCount,
    musicUrl: music?.url ?? null,
    beatGrid: music?.beatGrid ?? null,
    musicLabel: music?.displayName ?? null,
    targetSec: THANK_YOU_TARGET_SEC,
  };
}
