'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { watchPanoodCameras, type PeerConnectionState } from '@/lib/panood-webrtc';
import { getPanoodIceServers } from '@/app/panood/actions';

/**
 * apps/web/.../live-studio-control/setup/_components/camera-feeds.tsx
 *
 * ⭐ WAVE 4 — the unified controller's VIDEO RECEIVER.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * `lib/panood-webrtc.ts` has had a working viewer half (`watchPanoodCameras`)
 * since the Live Studio transport shipped, but its ONLY caller was the LEGACY
 * control room (`/studio/panood/broadcast`). The unified Wave 1–3 controller is a
 * pure server component, so a phone that joined a Live Studio channel published
 * into a room with nobody in it: the host could cut CH 4 onto Channel 1 and see a
 * placeholder, forever.
 *
 * This is the missing listener, and it is the SAME transport — no parallel
 * pipeline, no second protocol, no new signaling topic.
 *
 * ── ONE VIEWER, SHARED ─────────────────────────────────────────────────────
 * The transport is ONE PUBLISHER → ONE VIEWER PER SLOT: whoever answers a phone's
 * offer owns that stream. Two components each calling `watchPanoodCameras` would
 * therefore fight — the second answer replaces the first peer and the first
 * component's picture goes black. So the viewer is opened EXACTLY ONCE here and
 * shared through context; `ChannelVideo` subscribes, it never connects.
 *
 * The same constraint is why the OBS program pop-out reaches through
 * `window.opener` instead of connecting itself (lib/panood-program-bridge.ts).
 *
 * ⚠ COROLLARY, worth knowing before opening two tabs: this controller and the
 * legacy control room are two viewers on one event. Whichever answered last holds
 * the cameras. Don't run both during a real event.
 *
 * ── NOTHING IS FAKED ───────────────────────────────────────────────────────
 * When `streamingEnabled` is false (the prod default —
 * NEXT_PUBLIC_PANOOD_STREAMING_ENABLED, the couple's-unrepeatable-day gate) no
 * peer connection is opened at all and every slot reports `null`. `ChannelVideo`
 * then renders nothing and the honest server-rendered placeholder underneath shows
 * through. There is no dummy frame, no test pattern, and no state that claims a
 * camera is connected when it isn't.
 *
 * ── NOT A PUBLISH PATH ─────────────────────────────────────────────────────
 * This is the HOST'S monitor. Guests never reach it: the signaling topic is a
 * PRIVATE Realtime channel whose RLS predicate (`panood_rtc_can_access`, migration
 * 20270829134804) admits only a control-room member or a claimed camera operator.
 * Nothing here writes `events.live_studio_roam_manifest`, which is the one column
 * that makes video guest-visible and where the ₱2,999 publication paywall sits
 * (lib/live-studio-publish.ts). Watching your own cameras is rehearsal, and
 * rehearsal is free (§ 4d).
 */

export type CameraFeed = {
  /** The live MediaStream, or null when this camera isn't delivering one. */
  stream: MediaStream | null;
  /** The peer's real connection state, or null when streaming is off entirely. */
  state: PeerConnectionState | null;
};

const EMPTY_FEED: CameraFeed = { stream: null, state: null };

type FeedMap = Record<string, CameraFeed>;

const CameraFeedsContext = createContext<FeedMap>({});

/**
 * Subscribe to one camera slot (`cam{index}` — see `cameraSlotForIndex`).
 *
 * Returns the empty feed outside a provider rather than throwing: the controller
 * renders every tile through the same component, and a missing provider must
 * degrade to "no picture", never to a crashed operating surface mid-show.
 */
export function useCameraFeed(slot: string | null): CameraFeed {
  const feeds = useContext(CameraFeedsContext);
  if (!slot) return EMPTY_FEED;
  return feeds[slot] ?? EMPTY_FEED;
}

export function CameraFeedsProvider({
  eventId,
  streamingEnabled,
  children,
}: {
  eventId: string;
  /**
   * NEXT_PUBLIC_PANOOD_STREAMING_ENABLED, resolved server-side and handed down —
   * the same flag the joining phone reads, so the two halves of the transport can
   * never disagree about whether media is flowing.
   */
  streamingEnabled: boolean;
  children: React.ReactNode;
}) {
  const [feeds, setFeeds] = useState<FeedMap>({});

  /**
   * Forget a camera's picture.
   *
   * Two independent signals demand this, and the legacy control room learned both
   * the hard way: a peer can fail, AND a phone can end/mute its track while the
   * RTCPeerConnection still reports 'connected' (app backgrounded, camera released,
   * operator navigated away). Without dropping the stream the tile keeps its last
   * decoded frame — a still photograph presented as a live camera.
   */
  const dropSlot = useCallback((slot: string) => {
    setFeeds((prev) => {
      const current = prev[slot];
      if (current && current.stream === null && current.state === 'failed') return prev;
      return { ...prev, [slot]: { stream: null, state: 'failed' } };
    });
  }, []);

  const dropRef = useRef(dropSlot);
  dropRef.current = dropSlot;

  useEffect(() => {
    if (!streamingEnabled) return;
    let viewer: ReturnType<typeof watchPanoodCameras> | null = null;
    let cancelled = false;

    // ICE first, so this viewer and the operator phones meet on the SAME relay.
    // A phone on mobile data behind CGNAT cannot be reached by STUN alone, and
    // that is the normal case at a venue — falls back to STUN-only on error, which
    // still connects on most networks.
    void getPanoodIceServers(eventId)
      .catch(() => ({ iceServers: undefined as RTCIceServer[] | undefined }))
      .then(({ iceServers }) => {
        if (cancelled) return;
        viewer = watchPanoodCameras({
          eventId,
          iceServers,
          onTrack: (slot, stream) => {
            setFeeds((prev) =>
              prev[slot]?.stream === stream
                ? prev
                : { ...prev, [slot]: { stream, state: 'connected' } },
            );
            for (const track of stream.getTracks()) {
              track.onended = () => dropRef.current(slot);
              track.onmute = () => dropRef.current(slot);
            }
          },
          onSlotState: (slot, state) => {
            if (state === 'failed') {
              dropRef.current(slot);
              return;
            }
            setFeeds((prev) =>
              prev[slot]?.state === state
                ? prev
                : { ...prev, [slot]: { stream: prev[slot]?.stream ?? null, state } },
            );
          },
        });
      });

    return () => {
      cancelled = true;
      viewer?.close();
    };
  }, [eventId, streamingEnabled]);

  const value = useMemo(() => feeds, [feeds]);

  return <CameraFeedsContext.Provider value={value}>{children}</CameraFeedsContext.Provider>;
}

/**
 * A channel's live picture — nothing more.
 *
 * Renders ONLY when there is a real MediaStream. No stream → renders nothing, so
 * the server-rendered honest placeholder underneath ("Waiting for a camera" and
 * friends) is what the host sees. That ordering is the whole design: the truthful
 * state is the default and the video is what covers it, never the reverse.
 *
 * `muted` is mandatory, not a preference. A monitor grid with eight cameras would
 * otherwise mix eight copies of the room's audio into howling feedback with the PA
 * — and autoplay is blocked for unmuted media anyway. Audio rides the transport
 * for the broadcast's benefit; this surface is a picture monitor.
 */
export function ChannelVideo({ slot, className }: { slot: string | null; className?: string }) {
  const { stream } = useCameraFeed(slot);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) void el.play().catch(() => {});
  }, [stream]);

  if (!stream) return null;

  return (
    <video
      ref={ref}
      playsInline
      muted
      autoPlay
      className={className ?? 'absolute inset-0 h-full w-full object-cover'}
    />
  );
}
