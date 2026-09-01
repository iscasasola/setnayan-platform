import type { SupabaseClient } from '@supabase/supabase-js';
// WAVE 7 · the entitlement resolution moved here: `resolveBroadcastWindow` answers
// ownership AND whether the purchased event-day is running, from one place. This
// file no longer reads `eventSkuActive` / `LIVE_STUDIO_SKU` directly — going through
// the window is what stops a second, time-blind rule existing beside the first.
import { resolveBroadcastWindow } from '@/lib/live-studio-window-server';

/**
 * ⚠ THE RULES THEMSELVES ARE NOT IN THIS FILE — `decidePublish`,
 * `limitPublishedManifest`, `decideProgramAir` and `programSourceAllowed` live
 * in `./live-studio-publish-pure`, because the pop-out and the bridge that
 * re-resolve them are `'use client'` and this module reaches the service-role
 * client through `resolveBroadcastWindow`. Re-exported below, so every existing
 * `@/lib/live-studio-publish` import keeps resolving.
 */
export * from '@/lib/live-studio-publish-pure';

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
 * and was asked for ₱3,000 for an experience they had never felt — for a day that
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
 * There are exactly THREE ways live video reaches an audience, and this module
 * stands on all three:
 *
 *   1. `events.live_studio_roam_manifest` — the multi-channel picker manifest. Its
 *      ONLY writer is mirrorRoamManifest() (lib/live-studio-roam-provision.ts), which
 *      now calls this gate before it writes. That is the choke point: a free host
 *      cannot get a second entry into that column by any route, because no other
 *      route writes it.
 *   2. `events.panood_watch_url` — the single-camera embed. ONE url = ONE channel =
 *      free, and deliberately untouched here.
 *   3. ⭐ THE PROGRAM OUTPUT — `/panood/program/[eventId]`, the chrome-less pop-out
 *      the host's own encoder (OBS) window-captures and streams to their own
 *      YouTube. Setnayan does not own that pipe and cannot reduce a manifest on it,
 *      so `decideProgramAir` below reduces the SOURCE instead: an un-entitled event's
 *      program frame carries exactly ONE camera. Added Wave 5 — see its own header.
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
 * reason a ₱3,000 multi-cam broadcast goes out for free.
 */

/**
 * ⭐ THE ONE ANSWER to "may this host broadcast multi-cam right now?"
 *
 * WAVE 7 (owner-locked 2026-07-25 · § 4f ②): holding the SKU is no longer the whole
 * question. ₱3,000 buys ONE EVENT-DAY, so this delegates to
 * `resolveBroadcastWindow` (lib/live-studio-window-server.ts), which answers ownership AND
 * whether the purchased day is currently running.
 *
 * DELIBERATELY DELEGATED RATHER THAN DUPLICATED. Every publication path already
 * funnels through this function — the manifest write gate (mirrorRoamManifest), the
 * public read gate (app/[slug]/_lib/loaders.ts), and Wave 5's program output — so
 * putting the window HERE gives the whole product one rule. A second time check
 * bolted onto one of those call sites would be a rule that can disagree with this
 * one, and the way it would disagree is a paying couple losing cameras mid-ceremony
 * on one surface while keeping them on another.
 *
 * ⚠ THE WINDOW NEVER INTERRUPTS. `resolveBroadcastWindow` reads whether a broadcast
 * is on air and keeps multi-cam ON for one that started inside the window, so a
 * lapse cannot strip the public manifest out from under watching guests mid-wedding.
 * It bites at the NEXT go-live. That is why the never-interrupt rule lives in the
 * shared resolver and not in a caller.
 *
 * FAIL-CLOSED, unchanged: any throw, transport error or missing table resolves to
 * `false`, and `false` means "publish one channel, not many".
 *
 * Pass a SERVICE-ROLE / admin client on public + provisioning surfaces — `orders`
 * RLS is purchaser-scoped, so a session client on the public wedding page would read
 * "not owned" for a host who genuinely paid. (That direction is safe rather than
 * exploitable, but it would wrongly strip a paying couple's multi-cam mid-wedding.)
 * Wave 7 makes that guidance sharper, not softer: the broadcast-DAY count is read
 * from the same purchaser-scoped `orders` table.
 */
export async function canPublishMultiCam(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  if (!eventId) return false;
  try {
    // Not named `window` — shadowing the global in a module that is bundled for both
    // sides is a smell nobody should have to think about twice.
    const decision = await resolveBroadcastWindow(supabase, eventId);
    return decision.multiCam;
  } catch {
    return false;
  }
}
