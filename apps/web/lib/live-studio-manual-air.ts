/**
 * IS THIS EVENT ON AIR — and since when?
 *
 * There are two ways an event can be broadcasting, and until now the control room
 * only knew about one of them.
 *
 *   • AUTOMATIC — Setnayan's one-tap go-live creates a YouTube broadcast and writes
 *     a `panood_broadcasts` row. `getActivePanoodBroadcast` finds it.
 *   • BY HAND — the host starts the stream themselves and pastes the watch link
 *     (YouTube or Facebook Live). Those routes write only
 *     `events.panood_watch_url[_facebook]`, which nothing about "on air" ever read,
 *     so the controller's red tally and its PAID ⚡ Moment button both stayed dark
 *     for a host who was, in fact, live.
 *
 * `events.panood_manual_on_air_at` is the by-hand trace, and THIS MODULE is the one
 * place the two are fused. That is the shape deliberately, and it is the same lesson
 * `guestWallMirrorActive()` records: asking the same question on three surfaces is
 * three chances to forget, and the next surface makes four.
 *
 * ⚠ THE START INSTANT IS NOT DECORATION. `isLive` feeds the paid multi-cam window's
 * never-interrupt rule, which is BOUNDED by when the broadcast started — a broadcast
 * already running when a purchased day lapsed finishes clean; one begun afterwards
 * does not. `decideBroadcastWindow` treats `isLive` WITHOUT a start as protected (a
 * deliberate fail-open so an unreadable clock never cuts a live ceremony to one
 * camera), which is right for a real broadcast row and wrong for a self-set flag.
 * So this resolver never returns `isLive` without also returning `startedAt`, and
 * callers hand BOTH to the window. Returning them as one value is what keeps the
 * pair from drifting apart at a call site.
 */

/** Which route put this event on air. `null` when it is off air. */
export type LiveAirSource = 'broadcast' | 'manual';

export type LiveAirState = {
  /** On air by EITHER route. Drives the red tally and the paid Moment button. */
  isLive: boolean;
  /**
   * When the CURRENT run began, ISO. Null only when off air, or when an automatic
   * broadcast row carries no usable timestamp at all — which stays protected, as it
   * does today.
   */
  startedAt: string | null;
  source: LiveAirSource | null;
};

const OFF_AIR: LiveAirState = { isLive: false, startedAt: null, source: null };

/**
 * Fuse the automatic and by-hand routes into one answer.
 *
 * A REAL BROADCAST WINS. If YouTube has an active broadcast for this event, its own
 * timestamps are the authority even when a stale manual flag is also set — the
 * broadcast row is the thing actually carrying video, and preferring a host's
 * self-declared instant over it could only ever move the never-interrupt bound
 * EARLIER, which is the direction that gives away multi-cam.
 *
 * Pure and total: every input combination returns a nameable state, so no surface
 * has to guess what a missing field meant.
 */
export function resolveLiveAir(input: {
  /** An active (non-complete) panood_broadcasts row exists. */
  hasActiveBroadcast: boolean;
  /** That row's went_live_at ?? scheduled_start_at. */
  broadcastStartedAt?: string | null;
  /** events.panood_manual_on_air_at — the by-hand trace. */
  manualOnAirAt?: string | null;
}): LiveAirState {
  if (input.hasActiveBroadcast) {
    return {
      isLive: true,
      startedAt: input.broadcastStartedAt ?? null,
      source: 'broadcast',
    };
  }

  const manual = normalizeInstant(input.manualOnAirAt);
  if (manual) return { isLive: true, startedAt: manual, source: 'manual' };

  return OFF_AIR;
}

/**
 * An unparseable stored instant is treated as OFF AIR, not as "on air with an
 * unknown start".
 *
 * This is the one place the fail-open direction is deliberately reversed, and the
 * reason is money: "on air with no start" is exactly the state
 * `decideBroadcastWindow` protects, so letting a junk value reach it would convert a
 * corrupt string into free multi-cam. Losing a red light on a garbled value is a
 * cosmetic failure; the other direction is a billing one. The automatic route keeps
 * its existing fail-open because a broadcast row means real video is flowing.
 */
function normalizeInstant(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = new Date(raw);
  return Number.isNaN(t.getTime()) ? null : raw;
}

/**
 * Can the host use Setnayan's ONE-TAP go-live right now?
 *
 * It needs Setnayan's YouTube app review to have cleared with Google (a
 * platform-level fact, the same for every host) AND this event to have a connected
 * channel. Neither is true in production today, which is why the by-hand route is
 * the only one that works.
 *
 * Exported and used by the transport button, which decides whether to render
 * "Go live" or the plain-English reason it cannot.
 *
 * ⚠ It deliberately no longer decides whether the by-hand switch appears. It did,
 * and that coupling was the bug: it withdrew the fallback at the exact moment a host
 * connected a channel — which is when Go live can still refuse and the fallback is
 * most needed. `shouldOfferManualAir` now asks the only question that matters there,
 * which is whether a broadcast is actually running. Being AVAILABLE and being ON AIR
 * are different facts; one predicate answering both is how they got conflated.
 */
export function automaticGoLiveAvailable(input: {
  /** Setnayan's YouTube app review has cleared (platform-level, not per host). */
  oauthReady: boolean;
  /** This event has a live YouTube OAuth grant. */
  connected: boolean;
}): boolean {
  return input.oauthReady && input.connected;
}

/**
 * Should the by-hand on-air switch be offered at all?
 *
 * Hidden in exactly ONE situation: an automatic broadcast is genuinely running. Then
 * the red light is already lit by the real thing and a second on-air control would
 * be two answers to one question.
 *
 * Offered otherwise, and the reasons are cumulative:
 *
 *   • the one-tap route is UNAVAILABLE (Setnayan's YouTube app review has not
 *     cleared, or this host has not connected a channel) — by-hand is then the only
 *     way to be on air at all;
 *   • ⚠ the channel IS connected but nothing is broadcasting. The first cut of this
 *     hid the switch the moment a channel existed, which is precisely the wrong
 *     moment: a host connects, presses Go live, YouTube refuses (live streaming not
 *     enabled yet, a quota, a strike) — and the fallback that would still light
 *     their control room has just been taken away BECAUSE they connected.
 *     Connecting is not broadcasting;
 *   • the manual flag is ALREADY SET. A host who switches on and later connects
 *     YouTube would otherwise watch the control that turns it off disappear while
 *     the red light stayed on forever. Whenever the state exists, so does its handle.
 *
 * All three collapse into one predicate — is a real broadcast running? — so the
 * inputs the first cut consulted (`automaticAvailable`, the stored instant) are gone
 * rather than left as parameters nothing reads. A tautology in a boolean is how a
 * clause stops meaning anything while still looking considered.
 */
export function shouldOfferManualAir(input: {
  /**
   * An automatic (panood_broadcasts) broadcast is on air RIGHT NOW — the ONLY thing
   * that withdraws this switch.
   */
  broadcastLive: boolean;
}): boolean {
  return !input.broadcastLive;
}
