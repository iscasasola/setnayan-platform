'use client';

import { useRouter } from 'next/navigation';
import {
  CHANNEL_REFRESH_MS,
  shouldWatchChannels,
} from '@/lib/live-studio-channel-freshness';
import { useVisibleTick } from '@/lib/use-day-of-live-refresh';

/**
 * Render-nothing companion that keeps the control room's camera cards current.
 *
 * The controller resolves each channel's honest status on the SERVER
 * (`resolveChannelStatus`) and then never re-renders on its own — see the module
 * header of lib/live-studio-channel-freshness.ts for the measurement. This calls
 * `router.refresh()` on the heartbeat while the tab is visible, so the resolved
 * status the host reads is one the server computed seconds ago rather than
 * whenever they happened to open the page.
 *
 * Silent by design and a PULL, never a push — the same posture as
 * {@link LiveRefresher}, and it reuses the same tick machinery so the two
 * surfaces cannot drift on what "visible" or "focused" means.
 *
 * ⚠ NOT gated on `isLive`. Most of the waiting a host does is BEFORE going live —
 * scan the join card, walk back to the laptop — and that is the direction of the
 * lie a live-only refresh would leave in place.
 */
export function ChannelFreshness({
  channels,
}: {
  /** One entry per channel: does it have a camera seat bound to it at all? */
  channels: readonly { hasSeat: boolean }[];
}) {
  const router = useRouter();
  useVisibleTick(() => true, () => router.refresh(), {
    intervalMs: CHANNEL_REFRESH_MS,
    // Nothing bound → nothing can change without a host action → no timer at all.
    enabled: shouldWatchChannels({ channels }),
  });
  return null;
}
