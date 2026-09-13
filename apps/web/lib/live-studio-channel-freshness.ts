import { CHANNEL_HEARTBEAT_MS, CHANNEL_STALE_MS } from '@/lib/live-studio-channel-cameras';

/**
 * KEEPING THE CONTROLLER'S CAMERA CARDS UP TO DATE.
 *
 * ── THE HALF OF THE HONEST STATUS THAT WAS MISSING ──────────────────────────
 * `resolveChannelStatus` (live-studio-channel-cameras.ts) already resolves a
 * channel's truth against `last_seen_at` at READ time, and the controller already
 * renders that resolved value. Both are correct. But the controller is a SERVER
 * component with no timer, no `router.refresh()` and no realtime subscription:
 * measured on 2026-09-01, the only thing that re-runs it is a host firing a server
 * action. So the honest status is computed once, at page load, and then FROZEN.
 *
 * That is why a card was seen reading "Camera connected" over a heartbeat 140
 * seconds stale. The resolver was right; the render was old. Re-fixing the
 * resolver cannot reach this — a correct answer nobody re-asks is still a stale
 * answer on screen.
 *
 * ⚠ IT LIES IN BOTH DIRECTIONS, and the second one is the more common. A host who
 * prints a join card, scans it on the camera phone and walks back to the laptop is
 * *waiting* — not clicking. Nothing fires a server action, so the card holds
 * "Waiting for a camera" over a camera that joined a minute ago. A refresh that
 * only ran during a live broadcast would leave exactly that case broken.
 */

/**
 * Is there anything on this control room whose caption can change WITHOUT the host
 * touching it?
 *
 * Precisely: a channel with a bound seat. That single condition covers both
 * directions of the lie — a bound-but-unclaimed seat is one QR scan away from
 * "Camera connected", and a claimed one is one dropped phone away from "Camera
 * dropped out". Nothing else on the surface moves on its own: the window and
 * archive strips carry their own clock (broadcast-window-strip.tsx) and re-derive
 * from data they already hold.
 *
 * So a control room with no seats bound polls NOTHING, however long it is left
 * open — and it cannot get stuck there, because binding a seat is itself a host
 * action that re-renders the page and flips this to true.
 *
 * Pure, and deliberately not a hook: the gate is the part worth testing, and a
 * decision wrapped in `useEffect` is a decision nobody can assert on.
 */
export function shouldWatchChannels(input: {
  /** One entry per channel: does it have a camera seat bound to it at all? */
  channels: readonly { hasSeat: boolean }[];
}): boolean {
  return input.channels.some((c) => c.hasSeat);
}

/**
 * How often the open control room re-asks the server.
 *
 * DERIVED, not chosen. `CHANNEL_STALE_MS` (60s) is already the window the resolver
 * waits before calling a camera dropped — sized at 3× the beat so one missed
 * heartbeat on a church's wifi never blinks a working camera to "dropped out".
 * Polling on the BEAT keeps the render from adding a second, larger delay on top
 * of a window that was already deliberately sized: the card is never more than one
 * heartbeat behind the verdict the resolver would give right now.
 *
 * Worst case a card can therefore lie for CHANNEL_STALE_MS + CHANNEL_REFRESH_MS —
 * 80 seconds — against an unbounded "forever" today. Both terms are existing
 * constants; no new number is introduced here.
 */
export const CHANNEL_REFRESH_MS = CHANNEL_HEARTBEAT_MS;

/**
 * The worst-case age of what a host is looking at, as a plain number of ms.
 *
 * Exported so a test can hold the two constants to their relationship rather than
 * to a literal — if either moves, the guarantee moves with it and stays stated.
 */
export const WORST_CASE_CARD_AGE_MS = CHANNEL_STALE_MS + CHANNEL_REFRESH_MS;
