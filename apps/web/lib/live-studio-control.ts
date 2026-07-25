/**
 * apps/web/lib/live-studio-control.ts
 *
 * Pure helpers for the UNIFIED **Live Studio control** surface (owner 2026-07-25;
 * Live_Studio_Unified_Spec_2026-07-25.md + the refined "one shared single-screen
 * controller" design). This is the ONE controller opened by BOTH the free
 * single-camera livestreamer AND the paid multi-camera (LIVE_STUDIO) host:
 *
 *   • The free single-camera livestream is ALWAYS available (never gated).
 *   • The multi-camera extras — camera strip, add-camera-via-QR, cut-to-Main-Stage,
 *     guest-pick — are ALWAYS VISIBLE on the controller but LOCKED for a host who
 *     has not purchased LIVE_STUDIO, shown greyed/disabled with an inline
 *     "Unlock · <price>" call-to-action that routes to the LIVE_STUDIO buy.
 *     Purchasing unlocks them in place.
 *
 * The customer-facing ROUTE is `live-studio-control` (renamed from the internal
 * `live-studio-roam` substrate — the data key / SKU wiring is unchanged; only the
 * URL moved, with a redirect from the old path so nothing 404s). These helpers are
 * PURE (no I/O) so the controller, its server actions, and the unit tests share one
 * source of truth for the route paths and the lock decision.
 */

/** Unified customer-facing SKU that unlocks the multi-camera controller. */
export const LIVE_STUDIO_SKU = 'LIVE_STUDIO';

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

/** The unified controller (the single-screen operating surface). */
export function liveStudioControlPath(eventId: string): string {
  return `/dashboard/${eventId}/studio/${LIVE_STUDIO_CONTROL_SEGMENT}/setup`;
}

/**
 * The multi-camera lock decision for the controller. `owned` is the resolved
 * LIVE_STUDIO entitlement (eventSkuActive). `priceLabel` is the live catalog
 * price string (formatV2Sku → formatPhp), or null on a catalog miss.
 *
 *   • multiCamUnlocked — render the camera strip / cut / guest-pick as LIVE
 *     controls when true; greyed/disabled with the unlock CTA when false.
 *   • unlockCtaLabel   — the inline CTA text ("Unlock · ₱2,999"); falls back to a
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
   ONE source of truth for the numbering + the free/paid gate. The security-
   relevant field is `cuttable`: it is the ONLY thing the page may key a cut
   control off, and it is false for every tile a free host sees.
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
 * The free tier's one usable camera channel: the host's OWN phone / encoder, the
 * always-free single-camera livestream. It has no `live_studio_roam_zones` row
 * (a free host cannot create one — the server actions are ownership-gated), so it
 * is a STATUS tile, not a control: it is already what Channel 1 carries, there is
 * nothing to cut to.
 */
export const FREE_CAMERA_NAME = 'Your camera';

/**
 * What a free host sees in the locked slots when they have no cameras configured
 * (the normal free case). A dimmed, non-interactive preview of what the unlock
 * buys — the same "lock in place, sell in context" shape the pre-Wave-1 controller
 * already shipped, now wearing channel numbers.
 */
export const LOCKED_PLACEHOLDER_NAMES = [
  'Ceremony',
  'Reception floor',
  'Photo booth',
] as const;

/** The zone shape the controller reads (a subset of live_studio_roam_zones). */
export type ControlZone = {
  id: number;
  zone_index: number;
  label: string;
  venue_label: string | null;
  is_featured: boolean;
  is_main_stage: boolean;
};

export type ChannelTileKind = 'zone' | 'free' | 'placeholder';

export type ChannelTile = {
  /** Stable React key. */
  key: string;
  /** User-facing channel number (CH 2+). */
  channel: number;
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
  /** Behind the LIVE_STUDIO unlock — renders dimmed + 🔒, never a control. */
  locked: boolean;
  /**
   * The tile renders a real one-tap cut control. THE gate: false for every tile a
   * free host sees, false for the free base camera (already on Channel 1), false
   * for placeholders. The server action carries the same ownership backstop.
   */
  cuttable: boolean;
  /** DB id for the cut / rename / set-default forms. Null when there is no row. */
  zoneId: number | null;
  kind: ChannelTileKind;
};

/**
 * Build the camera-channel grid for the approved single-screen controller.
 *
 *   • UNLOCKED (owns LIVE_STUDIO) — every configured camera is a live channel:
 *     CH `zone_index + 1`, host-named, one-tap cuttable, ★ on the default.
 *   • LOCKED (free) — the host keeps ONE usable channel (CH 2 = their own camera,
 *     the free single-camera livestream) and sees the rest of the grid in place,
 *     locked. Nothing in that grid is cuttable, so the UI cannot even offer the
 *     action the server would reject.
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

  if (multiCamUnlocked) {
    return zones.map((z) => ({
      key: `zone-${z.id}`,
      channel: channelForZoneIndex(z.zone_index),
      name: z.label,
      venue: z.venue_label,
      featured: z.is_featured,
      onProgram: z.is_main_stage,
      tally: z.is_main_stage && isLive,
      locked: false,
      cuttable: true,
      zoneId: z.id,
      kind: 'zone' as const,
    }));
  }

  // ── FREE. CH 2 is the host's own camera — usable, free, already on Channel 1.
  const tiles: ChannelTile[] = [
    {
      key: 'free-camera',
      channel: FIRST_CAMERA_CHANNEL,
      name: FREE_CAMERA_NAME,
      venue: null,
      featured: true,
      onProgram: true,
      tally: isLive,
      locked: false,
      cuttable: false,
      zoneId: null,
      kind: 'free',
    },
  ];

  // Everything after CH 2 is locked. A free host normally has no zones at all
  // (creating one is ownership-gated), so we show the placeholder preview; a host
  // whose entitlement lapsed keeps seeing their real camera names, locked. Either
  // way these sit AFTER the free channel, so nothing collides with CH 2.
  const lockedSource: ReadonlyArray<{ key: string; name: string; venue: string | null; zoneId: number | null; kind: ChannelTileKind }> =
    zones.length > 0
      ? zones.map((z) => ({
          key: `zone-${z.id}`,
          name: z.label,
          venue: z.venue_label,
          zoneId: z.id,
          kind: 'zone' as const,
        }))
      : LOCKED_PLACEHOLDER_NAMES.map((name, i) => ({
          key: `placeholder-${i}`,
          name,
          venue: null,
          zoneId: null,
          kind: 'placeholder' as const,
        }));

  lockedSource.forEach((row, i) => {
    tiles.push({
      key: row.key,
      channel: FIRST_CAMERA_CHANNEL + 1 + i,
      name: row.name,
      venue: row.venue,
      featured: false,
      onProgram: false,
      tally: false,
      locked: true,
      cuttable: false,
      zoneId: row.zoneId,
      kind: row.kind,
    });
  });

  return tiles;
}
