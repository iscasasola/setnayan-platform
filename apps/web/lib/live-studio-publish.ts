import type { SupabaseClient } from '@supabase/supabase-js';
import { eventSkuActive } from '@/lib/entitlements';
import { LIVE_STUDIO_SKU } from '@/lib/live-studio-control';
import {
  selectDefaultChannel,
  selectMainStageZone,
  type RoamManifest,
} from '@/lib/live-studio-roam';

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

/* ══════════════════════════════════════════════════════════════════════════════
   ⭐ WAVE 5 — THE PROGRAM OUTPUT, the third publication path
   ══════════════════════════════════════════════════════════════════════════════

   THE HOLE THIS CLOSES. Everything above gates the SETNAYAN-HOSTED guest view: a
   manifest we write, on a page we render. The program pop-out is not that. It is a
   window the host's own encoder captures and sends to their own YouTube — a pipe we
   neither own nor observe. Under "rehearse free" a host may legitimately cut between
   eight cameras on their controller; if those cuts also reached the pop-out, the host
   could point OBS at it and broadcast a full multi-camera wedding to their own
   channel without ever touching a Setnayan-hosted surface. REHEARSE-FREE WOULD MEAN
   BROADCAST-FREE VIA OBS, and the ₱2,999 product would be gone.

   THE FIX, and why it is the source and not the pixels. We cannot watermark our way
   out of this (branding is a separate, currently-contradicted owner decision — see
   the spec's § 4c) and we cannot hide it client-side (the pop-out runs in the host's
   own browser; anything the client decides, the client can undecide). So the SOURCE
   is reduced, exactly as the manifest is: an un-entitled event's program frame may
   carry ONE camera — the host's own ★ default channel — and no other. Cutting still
   works everywhere else; it simply does not move what the encoder sees.

   WHY THE PIN IGNORES THE CUT. `limitPublishedManifest` above reduces to
   `selectMainStageZone`, which honours the cut — correct there, because that path
   re-mirrors a manifest per provisioning cycle. Here the frame updates in real time,
   so honouring the cut would hand a free host a live vision mixer: one camera at a
   time, switched at will, which IS the paid product. The free pin is therefore
   CUT-BLIND (`selectDefaultChannel`) and stable for the whole broadcast. The host
   still chooses WHICH camera it is, with the free ★ control.

   WHERE IT IS ENFORCED. Twice, from the same helper, and neither point trusts the
   other — the resolveOverlays posture:
     • the CONTROLLER only ever publishes a permitted stream onto the bridge;
     • the POP-OUT independently re-resolves this decision server-side on its own
       render and refuses to paint a frame whose source is not permitted.
   The entitlement behind `owned` comes from `orders`, which a host CANNOT forge:
   `orders_insert_status_guard` / `orders_update_status_guard` (migration
   20270920010000) restrict a non-admin writer to draft/submitted/awaiting_payment/
   cancelled. That matters because `live_studio_roam_zones` UPDATE RLS is row-level
   and the anon key is public — a host can absolutely PATCH `is_featured` /
   `is_main_stage` on their own rows. They are welcome to: those columns only choose
   WHICH channel the pin lands on. The COUNT comes from the entitlement, and one is
   one however the rows are rewritten.

   ⚠ WHAT THIS IS NOT. It is not a wall against a host who rewrites their own
   browser's JavaScript, and it cannot be. Rehearse-free means every camera's media is
   delivered to that browser by design — that is the product decision, and it is what
   makes rehearsal cost ₱0. The guarantee on offer is narrower and still worth having:
   NO SHIPPED SETNAYAN CODE PATH produces a multi-cam program frame for an un-entitled
   event, and there is no setting, no column and no replayed request that makes one.
   Anything stronger would mean withholding cameras from the rehearsal, which is
   precisely what § 4d exists to stop us doing.
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * One camera channel, as the program gate needs to see it. Deliberately the minimum:
 * a slot to render, and the two flags the default-channel rule reads.
 */
export type ProgramChannel = {
  /**
   * The WebRTC slot this channel's phone publishes on (`cam{n}` —
   * lib/live-studio-channel-cameras.ts → cameraSlotForIndex). Null when no camera
   * seat is bound, which means the channel cannot reach air at all.
   */
  slot: string | null;
  /** The host's ★ default. Host-writable, and that is fine — see the header. */
  featured: boolean;
  /** The host's current cut onto Channel 1. NEVER moves the free pin. */
  mainStage: boolean;
  /** Resolved channel status (`resolveChannelStatus`), for the default-channel rule. */
  status: string;
};

export type ProgramAirDecision = {
  /** Does this event hold the multi-cam unlock? Server-resolved, never client-set. */
  owned: boolean;
  /**
   * Is the gate actually restricting anything? False for an entitled host, whose
   * program output is unrestricted — so a paid broadcast can never be blocked by a
   * mismatch between this decision and whatever a control room chooses to send.
   */
  enforced: boolean;
  /**
   * Slots the program output may carry. Entitled → every bound slot. Free → the
   * pinned slot alone (or nothing, when no camera has joined).
   */
  permittedSlots: string[];
  /** The one slot a free host airs, independent of their cut. Null when entitled. */
  pinnedSlot: string | null;
  /** What the host has cut onto Channel 1, bound or not. */
  requestedSlot: string | null;
  /** What actually goes out. */
  airSlot: string | null;
  /** Why the cut is not what airs — null when it is (or when entitled). */
  withheld: 'multi_cam_locked' | null;
  /** The underlying count decision. Same helper the manifest gate uses. */
  publish: PublishDecision;
};

/**
 * May this event's program output carry the host's cut — and if not, what does it
 * carry instead?
 *
 * Pure and total: every branch returns a real, nameable state. There is no branch
 * that returns "black frame", because a black frame going out live is indistinguishable
 * from a bug and a couple would not know which of the two they were looking at.
 */
export function decideProgramAir(input: {
  owned: boolean;
  channels: readonly ProgramChannel[];
}): ProgramAirDecision {
  const { owned } = input;
  // Only a channel with a bound camera can reach air; a named-but-empty channel is
  // not a source, so it must not count toward the paywall's channel count either.
  const bound = input.channels.filter((c): c is ProgramChannel & { slot: string } =>
    Boolean(c.slot),
  );
  const publish = decidePublish({ owned, channelCount: bound.length });
  // The host's cut, as a CHANNEL rather than a slot: a channel can be on Channel 1
  // with no phone joined to it yet, and "Channel 1 is carrying something" is a
  // different fact from "there is a picture".
  const cut = input.channels.find((c) => c.mainStage) ?? null;
  const requestedSlot = cut?.slot ?? null;

  if (owned) {
    return {
      owned,
      enforced: false,
      permittedSlots: bound.map((c) => c.slot),
      pinnedSlot: null,
      requestedSlot,
      airSlot: requestedSlot,
      withheld: null,
      publish,
    };
  }

  // CUT-BLIND on purpose — see the header. This is the same default-channel rule the
  // public picker lands on, so "the free camera" has one meaning platform-wide.
  const pinned = selectDefaultChannel(bound);
  const pinnedSlot = pinned?.slot ?? null;
  return {
    owned,
    enforced: true,
    permittedSlots: pinnedSlot ? [pinnedSlot] : [],
    pinnedSlot,
    requestedSlot,
    // NOTHING CUT → NOTHING ON AIR, for a free host as much as a paid one. The pin
    // decides WHICH camera goes out, never WHETHER one does: a controller reading
    // "Nothing on Channel 1 yet" while the encoder quietly sends a camera is the same
    // class of silent mismatch this whole gate exists to avoid. (Deliberately stricter
    // than limitPublishedManifest, which falls back to the default with no cut — that
    // path serialises a manifest for guests, this one is a live frame beside a
    // controller the host is watching, and it may only ever air LESS.)
    airSlot: cut ? pinnedSlot : null,
    // Withheld = the host put something on Channel 1 and it is not what is going out.
    // Compared by CHANNEL, so cutting a camera-less channel while the pinned one airs
    // is reported too. A host whose cut already IS the pinned channel is broadcasting
    // exactly what they asked for, and telling them otherwise would sell nothing.
    withheld: cut && pinnedSlot && cut.slot !== pinnedSlot ? 'multi_cam_locked' : null,
    publish,
  };
}

/**
 * The client-side half of the same decision: may the program surface paint THIS
 * frame's source?
 *
 * Shared so the controller (choosing what to publish) and the pop-out (choosing what
 * to paint) apply one predicate. Unrestricted for an entitled host by construction —
 * `enforced` is false and this returns true for everything.
 */
export function programSourceAllowed(
  air: Pick<ProgramAirDecision, 'enforced' | 'permittedSlots'>,
  source: string | null,
): boolean {
  if (!air.enforced) return true;
  if (!source) return true; // nothing cut up: the honest no-signal state, not a leak
  return air.permittedSlots.includes(source);
}
