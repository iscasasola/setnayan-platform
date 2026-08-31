/**
 * apps/web/lib/live-studio-readiness.ts
 *
 * ⭐ WAVE 9 — "READY TO BROADCAST", told truthfully.
 * Owner-confirmed 2026-07-26 · Live_Studio_Unified_Spec_2026-07-25.md § 4h.
 *
 * ── WHAT THIS IS FOR ───────────────────────────────────────────────────────
 * Wave 9 removes the couple's YouTube account from the picture: their event
 * streams on a SETNAYAN-owned pool channel. That is a real simplification and it
 * invites a specific, expensive lie — a green "Ready to broadcast" badge that
 * means "Setnayan finished its setup" while the host reads it as "press GO and
 * you are on air". A wedding is not re-runnable; a host who believed that badge
 * and had no encoder running would discover it during the ceremony.
 *
 * ── SO THE STATE IS TWO FACTS, NEVER ONE ───────────────────────────────────
 *   1. PLATFORM READINESS — everything Setnayan controls: the Google client is
 *      configured, a verified Setnayan channel is connected and healthy, and the
 *      event has camera channels. Knowable, checkable, and what `state` reports.
 *   2. THE ENCODER — NOT knowable by us and NOT ours to provide. Browsers cannot
 *      push RTMP, and the native capture app was scoped but never built (§ 4c).
 *      Something must window-capture the program pop-out and send it to YouTube;
 *      today that is the couple's own OBS.
 *
 * `encoderNotice` is therefore returned on EVERY branch, including the green one,
 * and there is no input that removes it. It is not a warning that clears — it is
 * a standing property of the product until a native capture app or a
 * WebRTC→RTMP relay exists (and the relay breaks the ₱0 marginal-cost lock, so it
 * is a separate owner decision — do NOT assume Wave 9 delivered it).
 *
 * 🚫 NOTHING HERE MAY SUGGEST A PHONE CAN STREAM TO YOUTUBE. The phones join over
 * WebRTC to the host's controller; that is the whole of what they do.
 *
 * PURE — zero runtime imports, so the reads live in
 * lib/live-studio-readiness-server.ts and a client component can import these
 * predicates without dragging DB queries into the browser bundle. Same split as
 * lib/live-studio-window.ts / -window-server.ts (Wave 7).
 */

/** One named thing that is or is not true. `ok:false` on any of these blocks. */
export type ReadinessCheck = {
  key: 'oauth_configured' | 'channel_connected' | 'channel_healthy' | 'cameras';
  label: string;
  ok: boolean;
  /** What to do about it. Present whether or not the check passes. */
  detail: string;
};

export type ReadinessFacts = {
  /** Are the Google OAuth client credentials present at all? (owner action G3) */
  oauthConfigured: boolean;
  /**
   * Is a verified Setnayan pool channel available to this event — either already
   * checked out to it, or free to claim? False = the pool is empty or exhausted.
   */
  channelAvailable: boolean;
  /** Does that channel hold a non-revoked grant? False = nobody has connected it. */
  channelConnected: boolean;
  /** Has Google started rejecting that grant's refresh token? */
  channelNeedsReauth: boolean;
  /** How many camera channels the host has set up (bound or not). */
  cameraCount: number;
  /** How many YouTube broadcasts are provisioned and not finished. */
  provisionedCount: number;
};

export type ReadinessDecision = {
  /**
   * 'ready'   — everything SETNAYAN controls is in place.
   * 'blocked' — at least one check fails; `blockers[0]` is the one to fix first.
   *
   * ⚠ 'ready' NEVER means "you are on air" or "you will be on air". See
   * `encoderNotice`, which is returned on this branch too.
   */
  state: 'ready' | 'blocked';
  headline: string;
  /** One sentence under the headline. Always concrete, never congratulatory. */
  detail: string;
  checks: ReadinessCheck[];
  /** The failing subset of `checks`, in fix order. Empty when `state === 'ready'`. */
  blockers: ReadinessCheck[];
  /** ALWAYS PRESENT, on every branch. The encoder is not a check — it is a fact. */
  encoderNotice: string;
};

/**
 * The one sentence about the encoder. Deliberately a constant so it cannot drift
 * between the controller, the admin board and the changelog.
 */
export const ENCODER_NOTICE =
  'Setnayan cannot send video to YouTube for you. Your computer must be running an encoder (OBS or similar) capturing the program output window — a web browser cannot push a livestream on its own, and the phones only feed your controller.';

/**
 * ⏳ THE LEAD-TIME NOTICE — shown BEFORE a couple pays, on the buy surface.
 *
 * WHY IT EXISTS. Setnayan is apply-then-pay with **manual** reconciliation: a human
 * checks the BDO/GCash inbox and approves the order, within a 24-hour SLA. Every
 * other SKU can absorb that latency. A wedding cannot — an unlock bought the night
 * before may still be unapproved when the ceremony starts, and an unapproved order
 * is an un-entitled event, which means ONE camera on the day they were promised
 * several. The date cannot be moved and the ceremony cannot be re-run, so the lead
 * time has to be stated where the money decision is made, not discovered afterwards.
 *
 * ⭐ THE SECOND SENTENCE IS ONLY TRUE BECAUSE OF THE 2026-07-27 ANCHOR FIX, and it is
 * what makes the advice safe to follow: the broadcast day is anchored on the first
 * ENTITLED go-live, not on the purchase, so buying early genuinely costs the couple
 * nothing. Before that fix, "buy earlier" would have been advice to burn their day
 * sooner — the two changes only work as a pair. If the anchor model is ever changed
 * back, THIS COPY BECOMES A LIE and must change with it.
 */
export const LEAD_TIME_NOTICE =
  'Buy at least 2 days before your event. We check every payment by hand — usually within 24 hours — so an unlock bought the night before may not be approved in time. Buying earlier costs you nothing: your broadcast day starts when you first go live, not when you pay.';

/** Headline used when Setnayan's side is done. Names the remaining human step. */
export const READY_HEADLINE = 'Ready to broadcast — start your encoder';
export const BLOCKED_HEADLINE = 'Not ready to broadcast yet';

/**
 * ⭐ DOES THIS EVENT HAVE A ROUTE TO AIR ON A SETNAYAN-SUPPLIED CHANNEL?
 *
 * ── THE DEFECT THIS EXISTS TO KILL (measured in production 2026-08-31) ──────
 * `goLivePanood` has preferred a POOL channel since Wave 9 — it calls
 * `resolveEventBroadcastToken` and broadcasts on Setnayan's own channel, with BYO
 * kept only as a fallback. But the BUTTON that calls it was gated on
 * `oauth_grants` filtered by `event_id` — the BYO table, and ONLY that table.
 *
 * So on the day the pool finally held a healthy grant, production read:
 *
 *   oauth_grants (BYO, per event)      1 row, 0 live   ← a revoked July grant
 *   live_studio_channel_grants (pool)  1 row, healthy  ← never consulted
 *
 * …and every host was told **"Connect your YouTube channel first"** — the exact
 * instruction Wave 9 exists to abolish — while a verified Setnayan channel sat
 * available to them and the hidden button would have worked.
 *
 * 🔑 THE MEASUREMENT NEVER REACHED THE RENDER. The pool row, the grant, the
 * verified flag and the enabled entitlement were all true and all invisible to the
 * one predicate that decides whether a host can go on air.
 *
 * ⚠ `channelNeedsReauth` is a HARD NO, not a warning: Google rejecting the refresh
 * token means there is no token to broadcast with, so offering one-tap would be a
 * button that cannot work — which is the thing `automaticGoLiveAvailable` was
 * written to prevent.
 *
 * PURE, and deliberately in this module rather than at either call site: the
 * transport button and the by-hand switch must never disagree about whether a host
 * has any way to be on air, and two copies of this boolean is exactly how they
 * would drift.
 */
export function poolRouteToAir(
  facts: Pick<ReadinessFacts, 'channelAvailable' | 'channelConnected' | 'channelNeedsReauth'>,
): boolean {
  return facts.channelAvailable && facts.channelConnected && !facts.channelNeedsReauth;
}

/**
 * Resolve the readiness state. Pure and total: every branch names a real thing,
 * and no branch returns a bare boolean a caller could render as a green tick.
 *
 * Order matters — `blockers[0]` is what the UI leads with, so the checks are
 * listed in the order a human would actually fix them: platform credentials, then
 * the channel, then the host's own cameras.
 */
export function decideBroadcastReadiness(facts: ReadinessFacts): ReadinessDecision {
  const cameras = Number.isFinite(facts.cameraCount) ? Math.max(0, Math.trunc(facts.cameraCount)) : 0;
  const provisioned = Number.isFinite(facts.provisionedCount)
    ? Math.max(0, Math.trunc(facts.provisionedCount))
    : 0;

  const checks: ReadinessCheck[] = [
    {
      key: 'oauth_configured',
      label: 'Setnayan broadcasting is configured',
      ok: facts.oauthConfigured,
      detail: facts.oauthConfigured
        ? 'Setnayan can talk to YouTube.'
        : 'Setnayan has not finished its YouTube setup yet. Nothing for you to do — this is on our side.',
    },
    {
      key: 'channel_connected',
      label: 'A Setnayan channel is reserved for your event',
      // Both halves are the same user-visible fact: is there a usable channel?
      ok: facts.channelAvailable && facts.channelConnected,
      detail:
        facts.channelAvailable && facts.channelConnected
          ? 'Your event streams on a Setnayan channel. You do not need a YouTube account, and you never have to connect one.'
          : !facts.channelAvailable
            ? 'No Setnayan channel is free for your event right now. Message us and we will add one — you do not need to do anything with YouTube.'
            : 'The Setnayan channel for your event has not been connected yet. This is on our side.',
    },
    {
      key: 'channel_healthy',
      label: 'That channel’s connection is healthy',
      ok: !facts.channelNeedsReauth,
      detail: facts.channelNeedsReauth
        ? 'The Setnayan channel needs to be re-connected. This is on our side — message us if you are close to your event date.'
        : 'The connection is current.',
    },
    {
      key: 'cameras',
      label: 'You have at least one camera channel',
      ok: cameras > 0,
      detail:
        cameras > 0
          ? `${cameras} camera channel${cameras === 1 ? '' : 's'} set up${provisioned > 0 ? `, ${provisioned} prepared on YouTube` : ''}.`
          : 'Add a camera channel and join a phone to it with the QR code.',
    },
  ];

  const blockers = checks.filter((c) => !c.ok);
  const first = blockers[0];
  if (first) {
    return {
      state: 'blocked',
      headline: BLOCKED_HEADLINE,
      detail: first.detail,
      checks,
      blockers,
      encoderNotice: ENCODER_NOTICE,
    };
  }

  return {
    state: 'ready',
    headline: READY_HEADLINE,
    // Says what IS true and what is still required, in that order. It does not say
    // "you're all set" — because the one thing that actually puts pixels on YouTube
    // is not something Setnayan can see or do.
    detail:
      provisioned > 0
        ? `Your Setnayan channel is connected and ${provisioned} broadcast${provisioned === 1 ? '' : 's'} ${provisioned === 1 ? 'is' : 'are'} prepared. Nothing reaches YouTube until your encoder is running.`
        : 'Your Setnayan channel is connected. Broadcasts are prepared when you go live — and nothing reaches YouTube until your encoder is running.',
    checks,
    blockers,
    encoderNotice: ENCODER_NOTICE,
  };
}
