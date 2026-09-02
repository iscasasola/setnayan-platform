/**
 * apps/web/lib/live-studio-pool-only.ts
 *
 * ⭐ POOL-ONLY — the switch that removes Google OAuth verification entirely.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS, and why it is a compliance boundary rather than a preference
 * ══════════════════════════════════════════════════════════════════════════════
 * Google exempts an app from verification — brand verification, sensitive-scope
 * review, the "unverified app" warning screen, the 100-user cap — when its OAuth
 * consent screen audience is **Internal**. Internal means one thing precisely:
 * **only members of your own Google Cloud Organization may authorise.** Anyone
 * outside it is refused by Google with `org_internal`.
 *
 * Live Studio can satisfy that, because under the owner-locked pool model
 * (DECISION_LOG 2026-07-26) the broadcast runs on a SETNAYAN-owned channel and
 * only Setnayan's own admin account ever grants consent.
 *
 * 🔑 THE WHOLE EXEMPTION HANGS ON ONE FACT: that **no couple ever reaches the
 * consent screen.** The BYO path — `/api/oauth/youtube/start`, where a couple
 * connects their OWN YouTube channel — puts a `@gmail.com` user in front of it.
 * That single door is the difference between "no verification, ever" and "brand
 * verification + sensitive-scope review, with a demo video, on every branding
 * change, forever". `auth/youtube` is a SENSITIVE scope, so the External path is
 * the full pipeline, not a formality.
 *
 * So this flag is not a feature toggle. It is the boundary the exemption rests on.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🚨 SEQUENCING — DO NOT FLIP THIS ON BEFORE THE POOL CAN ACTUALLY BROADCAST
 * ══════════════════════════════════════════════════════════════════════════════
 * As of 2026-07-27 production holds **0 pool channels and 0 platform grants**, and
 * the only YouTube grant that has ever existed is revoked. BYO is therefore the
 * only path that has EVER run. Turning this on before a verified Setnayan channel
 * is connected would leave Live Studio with **no route to air at all** — it would
 * close the only working door in the name of closing the door.
 *
 * Flip it ON only once ALL of these are true:
 *   1. a Setnayan YouTube channel exists, is phone-verified, and has live
 *      streaming enabled (owner gate G1 — includes YouTube's 24-hour wait);
 *   2. that channel is registered and connected at /admin/live-studio-channels,
 *      so `live_studio_roam_channel_pool` and `live_studio_channel_grants` both
 *      hold a row;
 *   3. the OAuth client in use belongs to a project whose Audience is Internal.
 *
 * Default OFF, so an unset environment behaves exactly as it does today.
 *
 * ⚠ EXISTING GRANTS ARE DELIBERATELY NOT BROKEN. This closes the door to NEW
 * consents; it does not revoke consents already given. `goLivePanood` keeps its
 * BYO fallback, so a couple who connected before the flip keeps working — the same
 * grandfathering shape the Cast SKU retirement used (#3716: hide the buy, honour
 * the order). In practice prod has no active grant to grandfather, but stranding a
 * host mid-planning is not a thing to leave to chance.
 *
 * ⚠ WHAT THIS COSTS THE COUPLE, stated plainly because it is a real trade: on a
 * Setnayan channel they are not the channel owner, so they cannot download the
 * recording from YouTube Studio. That is the open pool-side file-handoff question
 * (spec § 4k) and it becomes more pressing the moment this flips, not less.
 */

import { envFlagEnabled } from '@/lib/env-flag';

/**
 * Is Live Studio restricted to Setnayan-owned channels — i.e. may a couple still
 * connect their own YouTube channel?
 *
 * ON ⇒ the BYO connect door is closed, no non-org user can reach Google's
 * consent screen, and the Internal-audience verification exemption holds.
 */
export function liveStudioPoolOnly(): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_LIVE_STUDIO_POOL_ONLY);
}

/**
 * What a couple who OWNS the hosted-channel add-on (LIVE_STUDIO_HOSTED_CHANNEL —
 * owner ruling 2026-09-02) is told when they reach the BYO connect door after it
 * closed.
 *
 * Deliberately NOT an error. Nothing has gone wrong and there is nothing for them
 * to fix or retry — Setnayan supplies the channel now, which is less work for them,
 * not more. It also never says "contact support", because there is no support
 * action either; the capability is simply on our side.
 *
 * ⚠ ONLY TRUE FOR ADD-ON OWNERS. Pool-only closes the BYO door for every host —
 * the couple's own YouTube link is the DEFAULT, and Setnayan supplying the
 * channel is an optional extra — so this exact sentence rendered for a host who
 * never bought the add-on both lies about who holds the channel and talks them
 * out of the paste-link box that is their actual route to air. See
 * POOL_ONLY_DEFAULT_NOTICE and poolOnlyConnectNotice() below.
 */
export const POOL_ONLY_CONNECT_NOTICE =
  'Setnayan now provides the YouTube channel for your live broadcast, so there is nothing for you to connect. Set up your cameras and press Go live when you are ready.';

/**
 * What every OTHER host is told at the same door — the default tier, which is
 * most hosts. Pool-only still closes OAuth for them (no couple may ever reach
 * Google's consent screen — see the module docblock above), but nobody supplies
 * their channel for them, so "nothing to connect" cannot be the whole sentence:
 * it has to point at the paste-link box sitting on the same screen, which is
 * where their broadcast actually reaches guests.
 */
export const POOL_ONLY_DEFAULT_NOTICE =
  'There is nothing to connect here — start your own broadcast on YouTube (or OBS), then paste the watch link below so guests can watch. Rather have Setnayan run the channel for you? Add the hosted channel option.';

/**
 * THE ONE PLACE that decides which of the two notices a host sees, given
 * whether their event owns the hosted-channel add-on. Every pool-only connect
 * surface must call this rather than branching on the entitlement itself and
 * picking a notice inline — that is exactly how the two copies would drift, or
 * how a surface could end up showing the add-on sentence to a default host.
 */
export function poolOnlyConnectNotice(ownsHostedChannel: boolean): string {
  return ownsHostedChannel ? POOL_ONLY_CONNECT_NOTICE : POOL_ONLY_DEFAULT_NOTICE;
}
