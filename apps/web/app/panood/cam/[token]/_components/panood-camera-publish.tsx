'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SIGNAL_REFUSED_NOTICE } from '@/lib/panood-signal-status';
import { Video, VideoOff, CircleAlert, Wifi } from 'lucide-react';
import {
  publishPanoodCamera,
  type CameraPublisher,
  type PeerConnectionState,
} from '@/lib/panood-webrtc';
import { getPanoodIceServers, heartbeatPanoodCamera } from '@/app/panood/actions';
import { CHANNEL_HEARTBEAT_MS, cameraSlotForIndex } from '@/lib/live-studio-channel-cameras';
import { publishGuestFanout, type GuestFanout } from '@/lib/panood-guest-webrtc';
import { GUEST_PICK_MAX_VIEWERS_PER_CAMERA } from '@/lib/live-studio-guest-pick';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';

// Live Studio · camera-operator local preview (PR5 — join + local preview only).
//
// The operator has CLAIMED the camera (POST → panood_claim_camera RPC). This
// view opens the REAR camera with getUserMedia (facingMode: environment, same
// posture as the Papic seat-capture surface) and shows a LOCAL self-preview so
// the operator can frame the shot — plus an honest status line.
//
// ⚠ NO fake streaming. The actual WebRTC publish to the multicam controller
// arrives with the media core (the engine) in a later PR; this view is the join
// + local preview ONLY, and says so plainly. We deliberately do not claim the
// feed is reaching the controller — the status reads "the operator will bring
// you live", which is the truthful day-of reality (the couple's controller goes
// live per-camera).

type Props = {
  cameraIndex: number;
  label: string | null;
  eventId: string;
  streamingEnabled: boolean;
  /**
   * This operator's OWN claim token — the one already in their address bar.
   *
   * Passing it into the client is safe here and ONLY here: it is their own
   * capability, they are looking at it, and the heartbeat RPC additionally
   * requires `claimer_user_id = auth.uid()` so it grants nothing they don't
   * already hold. It must still never appear on a HOST surface, where it would be
   * a hijack credential for somebody else's seat.
   */
  claimToken: string;
};

/**
 * The operator's camera stream — rear camera plus mic.
 *
 * WITH A GRACEFUL MIC FALLBACK. A phone with no microphone, or an operator who taps "Don't allow"
 * on the mic prompt while allowing the camera, must still get a working camera: losing the whole
 * feed over audio would be far worse than a silent one. This mirrors the homepage demo's proven
 * behaviour (`/panood/demo/[token]`), which is where these constraints come from.
 *
 * A blocked CAMERA still rejects the retry and propagates, so the caller's error state is
 * unchanged.
 */
async function getCameraStream(): Promise<MediaStream> {
  // Rear camera (corpus: Papic/Live Studio capture is rear-only). `ideal` so a single-camera
  // device still gets a stream instead of an OverconstrainedError. 1080p @ 30fps target for the
  // Live Studio livestream (owner 2026-07-14) — sharper than the browser default for a broadcast;
  // `ideal`+`max` caps at 1080p (never 4K, too heavy to encode/relay) and degrades gracefully on
  // weaker cameras. WebRTC still adapts down on poor networks.
  const video: MediaTrackConstraints = {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920, max: 1920 },
    height: { ideal: 1080, max: 1080 },
    frameRate: { ideal: 30, max: 30 },
  };
  try {
    return await navigator.mediaDevices.getUserMedia({
      // MIC ON. A wedding broadcast without vows is not a broadcast.
      //
      // This used to be `audio: false`, so the real product captured a SILENT picture while the
      // homepage demo had always captured the mic. The demo was better than the product, and it
      // proves audio rides this transport fine — the publisher simply never asked for it.
      //
      // Echo cancellation and noise suppression matter in a church with a PA; auto-gain keeps a
      // distant vow audible without the operator riding a fader they do not have.
      video,
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    const name = (err as { name?: string } | null)?.name;
    if (name === 'NotFoundError' || name === 'NotAllowedError' || name === 'OverconstrainedError') {
      return await navigator.mediaDevices.getUserMedia({ video });
    }
    throw err;
  }
}

export function PanoodCameraPublish({
  cameraIndex,
  label,
  eventId,
  streamingEnabled,
  claimToken,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const publisherRef = useRef<CameraPublisher | null>(null);
  const guestFanoutRef = useRef<GuestFanout | null>(null);
  const [state, setState] = useState<'starting' | 'live' | 'denied' | 'error'>(
    'starting',
  );
  const [link, setLink] = useState<PeerConnectionState | null>(null);
  const [signalRefused, setSignalRefused] = useState(false);
  /** How many wedding guests are currently watching THIS camera (Wave 10). */
  const [guestViewers, setGuestViewers] = useState(0);

  const stop = useCallback(() => {
    publisherRef.current?.close();
    publisherRef.current = null;
    // Wave 10 — tear the guest fan-out down BEFORE the tracks stop, and never let a
    // fault in it prevent the host publisher/tracks from being released.
    try {
      guestFanoutRef.current?.close();
    } catch {
      /* the guest path must never block teardown of the director's-cut path */
    }
    guestFanoutRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setState('starting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('error');
        return;
      }
      const stream = await getCameraStream();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setState('live');
      // Real streaming (owner-gated): publish this camera to the couple's control
      // room over WebRTC — P2P, STUN-only, nothing stored. When the flag is OFF
      // this is skipped and the view stays local-preview-only (the honest default).
      if (streamingEnabled) {
        // Fetch ICE servers (STUN + a minted TURN relay when configured) so a
        // phone on mobile data / an isolated venue Wi-Fi can still reach the
        // control room. Falls back to the transport's STUN-only default on error.
        const { iceServers } = await getPanoodIceServers(eventId).catch(() => ({
          iceServers: undefined as RTCIceServer[] | undefined,
        }));
        publisherRef.current?.close();
        publisherRef.current = publishPanoodCamera({
          eventId,
          slot: cameraSlotForIndex(cameraIndex),
          stream,
          onState: setLink,
          // ⭐ A REFUSED CHANNEL SAYS SO. Without this the operator reads
          // "connecting to the controller…" forever and cannot tell a refusal from
          // a slow network — which is the whole reason this bug cost an hour.
          onSignalRefused: () => setSignalRefused(true),
          iceServers,
        });

        // ── WAVE 10 · GUEST-PICK FAN-OUT ──────────────────────────────────────
        //
        // Serve the SAME local stream to a capped number of wedding guests, over a
        // SEPARATE Realtime topic (`panood-guest:{eventId}`) with its own peer
        // connections. Guests never touch `panood-rtc:` — on that channel an answer
        // would take the camera away from the couple's controller.
        //
        // ⚠ STRICTLY SECOND, AND STRICTLY OPTIONAL. It is started AFTER the host
        // publisher above and wrapped in its own try/catch, so no failure in the
        // guest path can prevent — or undo — the camera reaching the controller.
        // The director's cut is the product; this is a bonus on top of it.
        if (liveStudioRoamEnabled()) {
          try {
            guestFanoutRef.current?.close();
            guestFanoutRef.current = publishGuestFanout({
              eventId,
              slot: cameraSlotForIndex(cameraIndex),
              stream,
              iceServers,
              onViewers: setGuestViewers,
            });
          } catch {
            guestFanoutRef.current = null; // silent: the operator's job is unaffected
          }
        }
      }
    } catch (err) {
      const name = (err as { name?: string } | null)?.name;
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error');
    }
  }, [streamingEnabled, eventId, cameraIndex]);

  useEffect(() => {
    void start();
    return () => stop();
  }, [start, stop]);

  // ── THE LIVENESS BEAT (Wave 4) ────────────────────────────────────────────
  //
  // This is what makes the host's controller tell the truth. Until it existed,
  // `live_studio_roam_zones.status` never left 'planned', so every channel on the
  // controller read "Waiting for a camera" forever — including the ones somebody
  // was standing there holding.
  //
  // BEATS ONLY WHILE THE CAMERA IS GENUINELY OPEN (`state === 'live'`), which is
  // the precise claim the host's caption makes. A phone whose camera was denied,
  // failed, or is still starting does NOT beat, so the channel keeps saying
  // "Waiting for a camera" — which is exactly what is happening.
  //
  // A HIDDEN TAB DOES NOT BEAT EITHER. On iOS Safari a backgrounded page stops
  // delivering frames, so an operator who switches to Messages is, for the host's
  // purposes, gone. Letting the beat continue would keep a green "Camera
  // connected" over a black feed — the single worst lie this screen could tell.
  // The 60s staleness window (3 beats) absorbs a quick app-switch without
  // flapping.
  useEffect(() => {
    if (state !== 'live') return;
    let cancelled = false;

    const beat = () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      void heartbeatPanoodCamera(claimToken);
    };

    beat(); // don't make the host wait 20s for the first one
    const timer = setInterval(beat, CHANNEL_HEARTBEAT_MS);
    // Coming back from a background tab should re-light the channel immediately
    // rather than at the next tick.
    const onVisible = () => {
      if (typeof document !== 'undefined' && !document.hidden) beat();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [state, claimToken]);

  const camLabel = label?.trim() || `Camera ${cameraIndex}`;

  return (
    <main className="flex min-h-screen flex-col bg-ink text-cream">
      {/* Honest header — who you are, what's happening. */}
      <header className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cream/55">
            Live Studio · live camera
          </p>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight">{camLabel}</h1>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            state === 'live'
              ? 'bg-emerald-500/15 text-emerald-300'
              : 'bg-cream/10 text-cream/60'
          }`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${
              state === 'live' ? 'animate-pulse bg-emerald-400' : 'bg-cream/40'
            }`}
          />
          {state === 'live' ? 'Connected' : state === 'starting' ? 'Starting…' : 'No camera'}
        </span>
      </header>

      {/* Local preview surface. */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 h-full w-full object-cover"
        />

        {state === 'starting' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-cream/70">
            <Video aria-hidden className="h-8 w-8 animate-pulse" strokeWidth={1.5} />
            <p className="text-sm">Opening your camera…</p>
          </div>
        ) : null}

        {state === 'denied' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <VideoOff aria-hidden className="h-8 w-8 text-terracotta" strokeWidth={1.5} />
            <p className="text-sm font-medium">Camera access is blocked</p>
            <p className="max-w-xs text-xs text-cream/60">
              Allow camera access in your browser settings, then tap retry.
            </p>
            <button
              type="button"
              onClick={() => void start()}
              className="mt-1 inline-flex items-center gap-2 rounded-md bg-cream px-4 py-2 text-sm font-medium text-ink"
            >
              <Video aria-hidden className="h-4 w-4" strokeWidth={2} />
              Retry camera
            </button>
          </div>
        ) : null}

        {state === 'error' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <CircleAlert aria-hidden className="h-8 w-8 text-terracotta" strokeWidth={1.5} />
            <p className="text-sm font-medium">Couldn&rsquo;t open the camera</p>
            <p className="max-w-xs text-xs text-cream/60">
              This device may not have a usable camera, or another app is using it.
            </p>
            <button
              type="button"
              onClick={() => void start()}
              className="mt-1 inline-flex items-center gap-2 rounded-md bg-cream px-4 py-2 text-sm font-medium text-ink"
            >
              <Video aria-hidden className="h-4 w-4" strokeWidth={2} />
              Try again
            </button>
          </div>
        ) : null}
      </div>

      {/* The truthful status — join + local preview only; the controller brings
          this feed live. NO claim that bytes are streaming yet. */}
      <footer className="px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
        <div className="flex items-start gap-2.5 rounded-xl border border-cream/10 bg-cream/[0.04] px-3.5 py-3">
          <Wifi aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-cream/55" strokeWidth={1.75} />
          <p className="text-xs leading-relaxed text-cream/70">
            You&rsquo;re <span className="font-medium text-cream">{camLabel}</span> ·{' '}
            {streamingEnabled
              ? link === 'connected'
                ? "live to the controller — the operator picks when you're on screen."
                : link === 'failed'
                  ? "couldn't reach the controller on this network — try the same Wi-Fi as the operator."
                  : signalRefused
                    ? SIGNAL_REFUSED_NOTICE
                    : 'connecting to the controller…'
              : 'connected · the operator will bring you live from the controller.'}{' '}
            Keep this screen open and your camera pointed where you want.
          </p>
        </div>

        {/* Wave 10 — honest feedback that guests are watching THIS phone, and that the
            number has a ceiling. Shown only once somebody actually is: a permanent
            "0 watching" would just be noise for an operator with a job to do. */}
        {guestViewers > 0 ? (
          <p className="mt-2 px-1 text-[11px] text-cream/55">
            {guestViewers} of {GUEST_PICK_MAX_VIEWERS_PER_CAMERA} guests watching your
            camera.
          </p>
        ) : null}
      </footer>
    </main>
  );
}
