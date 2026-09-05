/**
 * lib/live-watch-state.ts — what a GUEST should see about the broadcast, as
 * opposed to what the host's control room sees (lib/live-studio-ingest-health.ts,
 * an operator surface with YouTube quota behind it).
 *
 * W1: the story page's watch-live-block.tsx used to render `watchLive.watchUrl`
 * as a static `<a href>` with no client re-resolution. A reconnect that has to
 * create a new YouTube broadcast (`bindYoutubeBroadcast` on the SAME stream —
 * see app/api/live-studio/encoder/broadcast-ended/route.ts) mints a NEW video
 * id, and every guest already on the page is left holding the dead one.
 *
 * PURE — same split as lib/live-studio-ingest-health.ts / -server.ts: the
 * decision is unit-testable with no database, no YouTube call, and no React.
 * The public GET /api/live/[slug]/watch route is the I/O half.
 *
 * ⚠ NO YOUTUBE QUOTA HERE ON PURPOSE. This feeds a route guests poll every
 * 30s, potentially hundreds of them per event, cached 15s at the edge. The
 * host's ingest-health poller already reserves half the daily YouTube quota
 * for ONE poller per event (150s interval) — see that module's budget. This
 * decider therefore uses ONLY what the story page already reads
 * (lib/watch-live-links.ts's `readEventWatchUrls` + `resolveWatchLinks`) plus
 * the existing `panood_broadcasts.status` column (lib/panood-broadcast.ts),
 * never a fresh call to YouTube.
 */

export type GuestWatchState = 'live' | 'reconnecting' | 'ended' | 'not_yet';

/** The same reduction watch-live-links.ts hands the story page. */
export type GuestWatchLive = {
  embedUrl: string | null;
  watchUrl: string | null;
  facebookUrl: string | null;
} | null;

export type GuestWatchStatusInput = {
  /** `resolveWatchLinks(readEventWatchUrls(...))` — null when neither door resolves. */
  watchLive: GuestWatchLive;
  /**
   * `panood_broadcasts.status` of the MOST RECENT row for this event (any
   * status, not just the active one) — `null` when no Setnayan-provisioned
   * broadcast has ever been created (a by-hand host who pastes their own
   * link, or an event that hasn't gone live yet).
   */
  latestBroadcastStatus: 'ready' | 'testing' | 'live' | 'complete' | 'errored' | null;
};

/**
 * Decide the guest-facing watch state. Pure and total: every input
 * combination returns a nameable state.
 *
 * A resolvable link ALWAYS wins — this is byte-for-byte the existing render
 * gate (loaders.ts: "a set watch URL means on air right now"), so a by-hand
 * host's freshly re-pasted link reads as 'live' with zero broadcast-row
 * history, exactly like today.
 *
 * Absent a link, `latestBroadcastStatus` distinguishes three "no video right
 * now" reasons a guest actually needs told apart:
 *   · null              → 'not_yet'      — nothing has ever gone out.
 *   · 'complete'         → 'ended'        — the most recent broadcast finished.
 *   · ready/testing/live/errored → 'reconnecting' — a broadcast's lifecycle is
 *     still OPEN (not yet closed out) but no link resolves this instant: the
 *     gap between S7 reporting a dropped stream and the rebind finishing.
 *     `errored` is this decider's main signal for that gap — see
 *     markPanoodBroadcastReconnecting in lib/panood-broadcast.ts, the only
 *     writer of that status.
 *
 * GUARD: 'complete' must NEVER fall into the 'reconnecting' branch — a
 * finished broadcast is not "about to come back", and telling a guest it is
 * would be worse than saying nothing.
 */
export function decideGuestWatchState(input: GuestWatchStatusInput): GuestWatchState {
  if (input.watchLive) return 'live';
  if (input.latestBroadcastStatus === null) return 'not_yet';
  if (input.latestBroadcastStatus === 'complete') return 'ended';
  return 'reconnecting';
}
