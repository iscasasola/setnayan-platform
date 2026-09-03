/**
 * apps/web/lib/live-studio-control.ts
 *
 * Pure helpers for the UNIFIED **Live Studio control** surface (owner 2026-07-25;
 * Live_Studio_Unified_Spec_2026-07-25.md + the refined "one shared single-screen
 * controller" design). This is the ONE controller opened by BOTH the free
 * single-camera livestreamer AND the paid multi-camera (LIVE_STUDIO) host:
 *
 *   • The free single-camera livestream is ALWAYS available (never gated).
 *   • ⭐ WAVE 3 (owner-locked 2026-07-25 · § 4d "REHEARSE FREE, PAY TO BROADCAST",
 *     SUPERSEDING the Wave 1/2 gating this file was first written under): the
 *     multi-camera controls — add-camera, rename, cut-to-CH-1, guest-pick, overlay
 *     placement — are FULLY USABLE for every host. They are rehearsal: private,
 *     unpublished, on the host's own phones. The paywall is PUBLICATION
 *     (lib/live-studio-publish.ts), not the mechanic.
 *   • What an un-entitled host sees instead of a lock is a contextual
 *     "Unlock to broadcast" nudge at the moment they engage a 2nd+ camera, plus the
 *     "Rehearse free · Unlock <price> to broadcast all your cameras" line at the
 *     go-live moment. A nudge, never a block.
 *
 * The customer-facing ROUTE is `live-studio-control` (renamed from the internal
 * `live-studio-roam` substrate — the data key / SKU wiring is unchanged; only the
 * URL moved, with a redirect from the old path so nothing 404s). These helpers are
 * PURE (no I/O) so the controller, its server actions, and the unit tests share one
 * source of truth for the route paths and the lock decision. The ONE exception is
 * `liveStudioControllerHref()` — the Wave 6 doorway router, which reads the launch
 * flag; its decision is factored out as a pure function taking the flag as an
 * argument, so the testable core stays I/O-free.
 */
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';

/** Unified customer-facing SKU that unlocks the multi-camera controller. */
export const LIVE_STUDIO_SKU = 'LIVE_STUDIO';

/**
 * The optional "Setnayan supplies the channel" upsell (owner ruling 2026-09-02).
 * STACKS on LIVE_STUDIO_SKU — it does not replace it, and owning it grants NO
 * entitlement of its own. It decides WHICH CHANNEL a broadcast goes out on,
 * nothing else: multicam entitlement, the watermark decision and the publish
 * gate all stay keyed on LIVE_STUDIO_SKU alone.
 *
 * ⚠ NEVER add this to lib/add-on-stats.ts's ADD_ON_SKU_MAP — that map also
 * drives lib/add-on-state.ts's 'launch' resolution, so doing so would let
 * buying the channel alone unlock the multicam controller.
 */
export const LIVE_STUDIO_HOSTED_CHANNEL_SKU = 'LIVE_STUDIO_HOSTED_CHANNEL';

/**
 * Internal catalog/data key for the Live Studio tile. UNCHANGED by the route
 * rename — reviews/stats/state (add-on-stats.ts, add-ons-detail.ts,
 * studio-recommendations.ts) all key off this string, so it stays stable exactly
 * the way "Live Studio Cast" keeps the internal `panood` name. Only the URL moved.
 */
export const LIVE_STUDIO_FEATURE_KEY = 'live-studio-roam';

/** New customer-facing route segment (was `live-studio-roam`). */
export const LIVE_STUDIO_CONTROL_SEGMENT = 'live-studio-control';
/** Old route segment kept only for the redirect that prevents 404s on old links. */
export const LIVE_STUDIO_LEGACY_SEGMENT = 'live-studio-roam';

/** The Live Studio detail/buy surface (the App Store page that mounts the buy drawer). */
export function liveStudioDetailPath(eventId: string): string {
  return `/dashboard/${eventId}/studio/${LIVE_STUDIO_CONTROL_SEGMENT}`;
}

/* ══════════════════════════════════════════════════════════════════════════════
   ⭐ WAVE 8 · THE CONTROLLER LIVES OUTSIDE /dashboard
   (owner-locked 2026-07-25 · § 4g: "scroll free controller. nothing under and
   above it.")

   The controller has to render with NO masthead above and NO bottom nav below.
   In the App Router an ancestor layout cannot be opted out of — a page under
   `/dashboard/[eventId]/…` always renders inside `[eventId]/layout.tsx`, which
   mounts the SidebarShell top bar, the CustomerBottomNav, the nav FAB and the
   section sub-nav. There is no per-route escape from a parent layout.

   Covering that chrome from inside the tree is not an option either, and this is
   not a guess: `/panood/program/[eventId]`'s own header records that it used to
   sit under /dashboard and render a `fixed inset-0` layer, and that the layer
   rendered NOTHING — the shell's `<main>` carries `.sn-vt-page`
   (`view-transition-name`), which establishes containment and therefore becomes
   the containing block for fixed descendants, so `inset-0` resolved against a
   zero-height box.

   So the controller follows the SAME escape the program pop-out already uses: a
   TOP-LEVEL route under `/panood`, which inherits only the root layout — no
   sidebar, no top bar, no bottom nav, no view transitions, nothing to escape
   from. `panood` is already a reserved top-level slug (lib/reserved-slugs.ts),
   already the namespace for the camera-join (`/panood/cam/[token]`) and the
   program output (`/panood/program/[eventId]`), so this adds no new namespace
   and can never shadow a vendor or event slug.

   ⚠ The route loses the dashboard layout's membership check by moving, and does
   NOT lose authorization: the page has always done its own, stricter gate
   (`isLiveStudioSetupHost`, the same predicate its server actions use) — exactly
   as `/panood/program/[eventId]` does.

   The OLD path stays as a permanent redirect (see the `setup/page.tsx` stub) so
   no bookmark, email or stale link 404s — the same courtesy the
   `live-studio-roam` → `live-studio-control` rename shipped with.
   ══════════════════════════════════════════════════════════════════════════════ */

/** The unified controller (the single-screen operating surface). Chrome-less. */
export function liveStudioControlPath(eventId: string): string {
  return `/panood/control/${eventId}`;
}

/**
 * Where the controller USED to live. Kept only so the old URL can redirect
 * instead of 404ing; never link to it.
 */
export function liveStudioControlLegacyPath(eventId: string): string {
  return `/dashboard/${eventId}/studio/${LIVE_STUDIO_CONTROL_SEGMENT}/setup`;
}

/* ══════════════════════════════════════════════════════════════════════════════
   WAVE 6 · ONE CONTROLLER — the single flag-aware router
   (owner 2026-07-25 · Live_Studio_Unified_Spec_2026-07-25 §§ 4b–4d.)

   TWO control rooms exist in the tree:

     • LEGACY — /dashboard/[id]/studio/panood/broadcast. Live today, and what the
       Cast SKU (PANOOD_SYSTEM) currently sells. Reached from six doorways across
       the dashboard: the Studio hub tile, its setup relay, the camera-seat page,
       the Launch checklist, the Galleries hub, and the direct URL.
     • UNIFIED — /dashboard/[id]/studio/live-studio-control/setup. The owner's
       chosen main controller, dark behind NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED.

   Consolidation has to be ATOMIC, because a half-switched state is the failure
   mode that matters: a doorway still pointing at a room that now redirects, or a
   host mid-show landing on the wrong screen. So EVERY doorway resolves its href
   through the ONE function below rather than carrying its own ternary — flip the
   flag and all six move together, in the same request, with no deploy.

   ⚠ DO NOT hardcode either path in a link. Add doorways here, not there. The
   legacy route ALSO redirects here when the flag is on (its page.tsx), so even a
   bookmark or a stale email lands on the unified controller.
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * The LEGACY Cast control room. Still the real, working room while the flag is
 * off — it is not dead code and must not be deleted until the cutover is verified.
 */
export function panoodBroadcastPath(eventId: string): string {
  return `/dashboard/${eventId}/studio/panood/broadcast`;
}

/**
 * PURE core of the router — which control room is THE control room, given the
 * unified-Live-Studio flag. Separated from the env read so the decision is
 * exhaustively unit-testable without touching process.env.
 */
export function liveStudioControllerHrefFor(
  eventId: string,
  unifiedEnabled: boolean,
): string {
  return unifiedEnabled ? liveStudioControlPath(eventId) : panoodBroadcastPath(eventId);
}

/**
 * THE control-room href every doorway links to. Flag ON → the unified controller;
 * flag OFF → the legacy Cast control room, byte-identical to today.
 */
export function liveStudioControllerHref(eventId: string): string {
  return liveStudioControllerHrefFor(eventId, liveStudioRoamEnabled());
}

/**
 * The multi-camera BROADCAST entitlement for the controller. `owned` is the resolved
 * LIVE_STUDIO entitlement (eventSkuActive). `priceLabel` is the live catalog
 * price string (formatV2Sku → formatPhp), or null on a catalog miss.
 *
 *   • multiCamUnlocked — WAVE 3: this no longer decides whether the controls
 *     RENDER (they always do — rehearsal is free). It decides whether the host may
 *     BROADCAST more than one camera, i.e. whether the unlock affordances show.
 *   • unlockCtaLabel   — the inline CTA text ("Unlock · " plus the live catalog price); falls back to a
 *     bare "Unlock" when the catalog price is unavailable (never a hardcoded
 *     number — the owner rule is prices come from the admin catalog).
 */
export type ControlLockState = {
  multiCamUnlocked: boolean;
  unlockCtaLabel: string;
};

export function liveStudioControlLock(
  owned: boolean,
  priceLabel: string | null,
): ControlLockState {
  return {
    multiCamUnlocked: owned,
    unlockCtaLabel: priceLabel ? `Unlock · ${priceLabel}` : 'Unlock',
  };
}

/* ══════════════════════════════════════════════════════════════════════════════
   WAVE 3 · the unlock COPY — one source of truth for the broadcast boundary
   (owner-locked 2026-07-25 · § 4d + the owner's copy correction).

   ⚠ COPY LOCK: "Unlock to BROADCAST", never "Unlock to use". Under rehearse-free
   the host genuinely CAN use these cameras — that is the entire product decision —
   so "unlock to use" would be a lie told while they are using it. The honest
   boundary is broadcasting, and the words have to say so.
   ══════════════════════════════════════════════════════════════════════════════ */

/** The contextual chip shown on a 2nd+ camera the moment the host engages it. */
export const UNLOCK_TO_BROADCAST_LABEL = 'Unlock to broadcast';

/**
 * The go-live-moment line. Price comes from the live catalog (never hardcoded);
 * a catalog miss degrades to the price-less sentence rather than inventing a number.
 */
export function rehearseFreeNotice(priceLabel: string | null): string {
  return priceLabel
    ? `Rehearse free · Unlock ${priceLabel} to broadcast all your cameras`
    : 'Rehearse free · Unlock to broadcast all your cameras';
}

/**
 * Does the go-live moment carry the unlock line? Only when there is genuinely
 * something the host cannot broadcast: an un-entitled host with MORE THAN ONE
 * camera configured. With one camera there is nothing to sell — that stream is
 * free, and saying otherwise would be a fake paywall over a free feature.
 */
export function showRehearsalUnlockNotice(input: {
  owned: boolean;
  configuredChannels: number;
}): boolean {
  return !input.owned && input.configuredChannels > 1;
}

/* ══════════════════════════════════════════════════════════════════════════════
   WAVE 1 — the approved single-screen controller layout
   (owner approved the prototype 2026-07-25; Live_Studio_Unified_Spec_2026-07-25
   § 4b LAYOUT BUILD PLAN. Design reference: the `live-studio-control.html`
   prototype.)

   CHANNEL VOCABULARY (owner-locked, § 2): **Channel 1 is the CONTROLLED SCREEN**
   — the program itself, the thing the audience watches; it carries the
   controller. **Every camera is its own numbered channel** (CH 2, CH 3 …) wearing
   the HOST'S OWN name, and tapping one puts it on Channel 1. "Main Stage" is a
   camera NAME, never the program. Internal code/columns keep their existing
   names (`is_main_stage`, `live_studio_roam_zones`) — only the words the host
   reads change.

   These helpers are PURE so the page, the server actions and the unit tests share
   ONE source of truth for the numbering + the unlock affordances.

   ⚠ WAVE 3 CORRECTION (owner-locked 2026-07-25 · § 4d + "but they can still see
   it"): `cuttable` used to be the security-relevant field — false for every tile a
   free host saw. IT IS NO LONGER A PAYWALL. Cutting is rehearsal and is free for
   everyone; the paywall is publication (lib/live-studio-publish.ts). Nothing in
   this module gates money any more, and nothing here should be made to again — a
   second gate that can disagree with the publish gate is worse than no gate.

   The dimmed/greyscale tile with a 🔒 "Unlock to use" badge over it is likewise
   GONE. Seeing the cameras actually working IS the conversion mechanism; hiding or
   dimming them recreates the exact defect Wave 3 exists to fix — asking real money for
   an experience the couple has never felt, for a day that cannot be redone.
   ══════════════════════════════════════════════════════════════════════════════ */

/** Channel 1 = the controlled screen (the program). Never a camera. */
export const PROGRAM_CHANNEL = 1;

/** The fixed label worn by the monitor, per the approved design. */
export const PROGRAM_CHANNEL_LABEL = `CH ${PROGRAM_CHANNEL} · Controlled screen`;

/** Camera channels start at CH 2 — CH 1 is the controlled screen itself. */
export const FIRST_CAMERA_CHANNEL = PROGRAM_CHANNEL + 1;

/**
 * The channel number a configured camera wears.
 *
 * Derived from the zone's own `zone_index` (+1 for the controlled screen) rather
 * than its position in the list, so a host's channel numbers are STABLE: deleting
 * CH 3 mid-celebration must not silently renumber CH 4 → CH 3 under the operator's
 * thumb. A gap in the sequence is the honest read of "that camera was removed".
 */
export function channelForZoneIndex(zoneIndex: number): number {
  return zoneIndex + PROGRAM_CHANNEL;
}

/** `CH 4 · Garden Aisle` — the one place channel captions are composed. */
export function formatChannel(channel: number, label: string): string {
  return `CH ${channel} · ${label}`;
}

/**
 * The host's OWN phone / encoder — the always-free single-camera livestream. It has
 * no `live_studio_roam_zones` row, so it is a STATUS tile, not a control: it is
 * already what Channel 1 carries, there is nothing to cut to. Shown only when the
 * host has configured no camera channels yet, so it can never collide with a real
 * CH 2.
 */
export const FREE_CAMERA_NAME = 'Your camera';

/** The zone shape the controller reads (a subset of live_studio_roam_zones). */
export type ControlZone = {
  id: number;
  zone_index: number;
  label: string;
  venue_label: string | null;
  is_featured: boolean;
  is_main_stage: boolean;
  /**
   * The zone's REAL lifecycle state (live_studio_roam_zones.status). Surfaced so the
   * tile can state the truth about whether a phone has joined instead of drawing a
   * padlock over nothing. Optional: a pre-migration read simply has no status.
   */
  status?: string | null;
};

export type ChannelTileKind = 'zone' | 'free';

export type ChannelTile = {
  /** Stable React key. */
  key: string;
  /** User-facing channel number (CH 2+). */
  channel: number;
  /**
   * Position among the host's CONFIGURED camera channels, 0-based. Ordinal 0 is the
   * one camera a free host may broadcast; 1+ are the "2nd and succeeding" cameras
   * the unlock is about. Deliberately ordinal, not channel number: a host who
   * deletes CH 2 and keeps CH 3 has ONE camera, and that camera is free to
   * broadcast — keying the boundary off `channel > 2` would wrongly nudge them.
   * The free own-camera tile is -1 (it is not a configured channel).
   */
  ordinal: number;
  /** The host's own name for this channel. */
  name: string;
  /** The host's optional venue grouping, rendered under the name. */
  venue: string | null;
  /** ★ — the default view the guest picker opens on. */
  featured: boolean;
  /** This channel is what Channel 1 is currently carrying. */
  onProgram: boolean;
  /**
   * RED TALLY. Red means ON AIR and nothing else is red — so it needs BOTH facts:
   * this channel is on Channel 1 *and* the broadcast is actually live. A red
   * "ON AIR" badge on an off-air controller would be a lie about the one signal
   * an operator must be able to trust at a glance.
   */
  tally: boolean;
  /**
   * The tile renders a real one-tap cut control. TRUE for every configured channel
   * regardless of entitlement — cutting is rehearsal (§ 4d). False only for the
   * free own-camera status tile, which is already on Channel 1.
   *
   * ⚠ This is NOT a paywall field any more. See the section header.
   */
  cuttable: boolean;
  /**
   * Show the contextual "Unlock to broadcast" nudge on this tile.
   *
   * Fires when an un-entitled host has ENGAGED a 2nd+ camera — i.e. put it on
   * Channel 1. Not a padlock sitting there from page load: it lands at the moment
   * they feel the value, which is the whole point. It is a LABEL, never a block —
   * the cut it appears next to has already succeeded.
   */
  nudgeUnlock: boolean;
  /**
   * The zone's real lifecycle status, passed through for the honest "has a phone
   * actually joined?" caption. Null for the free own-camera tile.
   */
  status: string | null;
  /** DB id for the cut / rename / set-default forms. Null when there is no row. */
  zoneId: number | null;
  kind: ChannelTileKind;
};

/**
 * Build the camera-channel grid for the approved single-screen controller.
 *
 * WAVE 3: ONE code path for both tiers. Every configured camera is a real, fully
 * visible, cuttable channel — CH `zone_index + 1`, host-named, ★ on the default —
 * because rehearsing with them is free. An un-entitled host's tiles differ from a
 * paid host's in exactly one way: `nudgeUnlock` turns on when they put a 2nd+
 * camera on Channel 1. No dimming, no padlock, no hidden tiles.
 *
 * When the host has configured nothing yet, the grid shows their OWN camera (the
 * free single-cam path) so it is never empty and never a fake preview of cameras
 * that do not exist.
 *
 * `isLive` is the real broadcast state (an active YouTube broadcast), NOT a cut —
 * it is what turns the tally red.
 */
export function buildChannelTiles(input: {
  zones: readonly ControlZone[];
  multiCamUnlocked: boolean;
  isLive: boolean;
}): ChannelTile[] {
  const { zones, multiCamUnlocked, isLive } = input;

  if (zones.length === 0) {
    // Nothing configured: CH 2 is the host's own camera — what Channel 1 already
    // carries. True for a free host and a paid one alike.
    return [
      {
        key: 'free-camera',
        channel: FIRST_CAMERA_CHANNEL,
        ordinal: -1,
        name: FREE_CAMERA_NAME,
        venue: null,
        featured: true,
        onProgram: true,
        tally: isLive,
        cuttable: false,
        nudgeUnlock: false,
        status: null,
        zoneId: null,
        kind: 'free',
      },
    ];
  }

  return zones.map((z, i) => ({
    key: `zone-${z.id}`,
    channel: channelForZoneIndex(z.zone_index),
    ordinal: i,
    name: z.label,
    venue: z.venue_label,
    featured: z.is_featured,
    onProgram: z.is_main_stage,
    tally: z.is_main_stage && isLive,
    cuttable: true,
    // The nudge needs all three: no unlock, a 2nd+ camera, and the host actually
    // working with it right now.
    nudgeUnlock: !multiCamUnlocked && i > 0 && z.is_main_stage,
    status: z.status ?? null,
    zoneId: z.id,
    kind: 'zone' as const,
  }));
}

/**
 * The honest one-line answer to "is there a camera on this channel yet?".
 *
 * ⚠ THERE IS NO THUMBNAIL SOURCE TODAY, and this function is where that fact is
 * told rather than papered over. `live_studio_roam_zones.status` is the only join
 * signal that exists, nothing writes it past the `'planned'` default (no QR-join
 * path binds a phone to a ROAM zone yet — `camera_operator_id` has zero writers),
 * and there is no frame to show. So a channel reports what is actually known:
 * configured. Faking a video thumbnail — or claiming "3 cameras are here" when the
 * database cannot say that — would be the same dishonesty as the padlock, pointed
 * the other way.
 */
export function channelReadyCaption(status: string | null): string {
  switch (status) {
    case 'live':
      return 'Camera connected';
    case 'offline':
      return 'Camera dropped out';
    case 'disabled':
      return 'Turned off';
    default:
      // 'planned' (the insert default) and anything unrecognised.
      return 'Waiting for a camera';
  }
}
