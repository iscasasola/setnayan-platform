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
 *      push RTMP, and no capture app has been built. ⚠ THE SCOPE IS **B4** in
 *      `Live_Studio_Cast_and_Roam_2026-07-23.md`, NOT § 4c — § 4c of the unified
 *      spec is "WAVE 1 + 2 SHIPPED" and scopes no capture app at all. And B4 is a
 *      PHONE app (one RTMP stream per kit-phone camera, for ROAM); the desktop
 *      encoder that would close THIS gap pushes one composited stream for CAST.
 *      Different products — building either leaves the other unbuilt.
 *      Something must window-capture the program pop-out and send it to YouTube;
 *      today that is the couple's own OBS.
 *
 * `encoderNotice` is therefore returned on EVERY branch, including the green one,
 * and there is no input that removes it. It is not a warning that clears — it is
 * a standing property of the product until a native capture app or a
 * WebRTC→RTMP relay exists (a TRANSCODING relay breaks the ₱0 marginal-cost lock —
 * a remux-only one is far cheaper, so the categorical version of that claim is too
 * strong; see `Live_Studio_Encoder_Scope_2026-09-03.md` § 4B — either way it
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
/**
 * ⏳ THE OTHER LEAD TIME — YOUTUBE'S, AND IT IS NOT OURS TO WAIVE.
 *
 * A couple streams to THEIR OWN channel (the BYO path: they create the broadcast,
 * we composite the cameras and they paste the watch link back). That channel has to
 * be live-enabled BEFORE the day, and YouTube's first-time activation takes about
 * 24 hours — a wait no amount of Setnayan readiness can shorten. Discovered on the
 * wedding morning it is unrecoverable, and the date does not move.
 *
 * So it belongs on the BUY surface, beside LEAD_TIME_NOTICE, not in a help page the
 * buyer reaches afterwards. Two different clocks owned by two different parties:
 * ours is manual payment reconciliation, theirs is Google's activation queue. They
 * run in PARALLEL — a couple can activate YouTube while payment is pending — which
 * is why this is a second sentence rather than 24 hours added to the first.
 *
 * ⚠ THE 50-SUBSCRIBER SENTENCE IS LEAD-BEARING, NOT TRIVIA. A couple who searches
 * this will find "you need 50 subscribers to go live" everywhere, conclude they are
 * ineligible, and not buy. That threshold is MOBILE-APP streaming only; encoder
 * streaming from a computer — which is the only path Live Studio uses, since OBS
 * window-captures the program output — carries no subscriber requirement at all.
 * Pre-empting the wrong conclusion is the whole reason the clause is here.
 */
export const YOUTUBE_READY_NOTICE =
  'Before you buy, check that your own YouTube channel can already go live — YouTube takes about 24 hours to switch this on the first time, and it cannot be rushed on the day. Open youtube.com/features and look for Live streaming: Enabled. If you read that you need 50 subscribers, that rule is only for going live from the phone app — streaming from a computer, which is what Live Studio does, has no subscriber requirement.';

/**
 * 💻 WHAT THE BUYER MUST OWN — a laptop — SAID BEFORE THE MONEY MOVES.
 *
 * `ENCODER_NOTICE` below has always been honest about this, and it is returned on EVERY
 * readiness branch including the green one. But readiness is a POST-PURCHASE surface. The
 * buy sheet carried the payment lead time and YouTube's activation wait and said nothing
 * about needing a computer at all.
 *
 * 🔑 AND THIS IS THE ONE THAT CANNOT BE RECOVERED FROM. A couple who meets the YouTube
 * 24-hour wait too late can still wait; a couple who meets the payment SLA too late can
 * still be approved early next time. A couple with no laptop on the wedding morning has NO
 * BROADCAST, and nothing fixes it — not money, not support, not a later date.
 *
 * Deliberately NOT the same string as ENCODER_NOTICE, and the difference is the question
 * each answers. Before paying: "what do I need to own?" After paying: "what do I do with
 * it?" Collapsing them would make one of the two surfaces answer a question nobody asked
 * there. ⚠ THEY MUST STILL AGREE ON THE FACT — if the encoder ever stops being required
 * (a native Setnayan encoder, a server relay), BOTH move in the same commit or the product
 * tells two stories.
 *
 * Names OBS because that is what is true today. If the desktop app ever encodes
 * (`Live_Studio_Encoder_Scope_2026-09-03.md` Path A), this sentence changes with it —
 * the laptop stays required either way; only the software named changes.
 */
export const ENCODER_BUY_NOTICE =
  'You will need a Windows or Mac laptop at your celebration, running free streaming software (OBS) alongside the control room — a phone or tablet on its own cannot send the broadcast to YouTube, and neither can a web browser. Your phones are the cameras; the laptop is what sends the picture out.';

export const LEAD_TIME_NOTICE =
  'Buy at least 2 days before your event. We check every payment by hand — usually within 24 hours — so an unlock bought the night before may not be approved in time. Buying earlier costs you nothing: your broadcast day starts when you first go live, not when you pay.';

/**
 * 🎵 THE FOURTH PRE-PURCHASE FACT — and the only one that fails DURING the ceremony.
 *
 * VERIFIED AGAINST YOUTUBE'S OWN DOCUMENTATION 2026-09-02
 * (support.google.com/youtube/answer/3367684). YouTube runs Content ID against a
 * LIVE stream in real time. On a match it replaces the broadcast with a placeholder
 * image and warns the host to stop; if the content keeps playing the stream is
 * "temporarily interrupted or terminated".
 *
 * 🔑 WHY THIS IS NOT A FOURTH COPY OF THE OTHER THREE. Payment lead time, YouTube's
 * 24-hour activation and the laptop all fail BEFORE the day — late, but survivable,
 * and a couple who meets them late can still act. This one fails at the processional
 * or the first dance, in front of everyone watching from abroad, and there is no
 * recovering the moment. A Filipino wedding plays licensed music continuously, so
 * this is the DEFAULT path, not an edge case.
 *
 * ⚠ THE LICENSED-MUSIC CLAUSE IS THE LOAD-BEARING HALF, and it is the half every
 * other product's copy omits. YouTube's own wording: unless the rights holder has
 * added that channel to their Content ID allowlist, "your live stream can be
 * interrupted even if you've licensed the third-party content". No couple will be on
 * a rights holder's allowlist. A notice that only says "don't use copyrighted music"
 * is the version a couple who paid for a licence reads and correctly ignores — and
 * they are exactly the couple this exists to protect.
 *
 * ⚠ WRITTEN AS A PRECAUTION, NOT A DISCLAIMER. The couple CAN act on this: they
 * choose the processional music. Copy that reads as legal cover teaches nobody
 * anything, so this names the alternative (live musicians, royalty-free tracks) in
 * the same breath as the risk. It also scopes the advice to what the BROADCAST
 * carries — the reception playlist after the stream ends is nobody's problem.
 *
 * The last sentence is a SEPARATE failure with a separate timing: Content ID also
 * runs over the archived video, so a stream that survived the day can still have its
 * recording claimed or muted afterwards — which matters because "keep the recording"
 * is a promise the /panood page makes.
 */
export const MUSIC_RIGHTS_NOTICE =
  'YouTube listens to your broadcast as it goes out, and a match on commercial music can put a still image over your stream or cut it off mid-ceremony — during the processional or the first dance, with no way to rewind the moment. This happens even with music you have PAID to license, because the only exemption is an allowlist the rights holder controls and no couple is on one. So choose the sound the stream will carry with that in mind: live musicians, or royalty-free tracks, for the processional, the first dance and anything else that airs. Your reception playlist after the broadcast ends is unaffected. And even when a stream survives the day, the saved recording can still be claimed or muted afterwards.';

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
