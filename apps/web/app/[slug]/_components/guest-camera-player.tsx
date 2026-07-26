'use client';

/**
 * GuestCameraPlayer — a wedding guest watching ONE side camera peer-to-peer
 * (Live Studio Wave 10, 2026-07-26).
 *
 * Mounts only after the guest explicitly taps a camera pill. On mount it asks the
 * server for a session + ICE (`startGuestPickSession`), then opens a direct WebRTC
 * connection to that operator's phone.
 *
 * ⭐ NEVER A BROKEN PLAYER. Every failure mode — camera full, refused, unreachable,
 * flag off, entitlement withdrawn — resolves to the SAME honest outcome: say what
 * happened in one plain sentence and hand the guest back to the director's cut,
 * which is on YouTube and has no viewer limit. `onFallback` is how the picker is
 * told to do that. There is no spinner-forever state and no black rectangle.
 */

import { useEffect, useRef, useState } from 'react';
import { Users, VideoOff } from 'lucide-react';

import { startGuestPickSession } from '@/app/panood/guest-pick-actions';
import { watchGuestCamera, type GuestCameraWatcher } from '@/lib/panood-guest-webrtc';
import { GUEST_PICK_MAX_VIEWERS_PER_CAMERA } from '@/lib/live-studio-guest-pick';
import type { PeerConnectionState } from '@/lib/panood-webrtc';

type Status = 'connecting' | 'live' | 'full' | 'unavailable';

export function GuestCameraPlayer({
  eventId,
  slot,
  label,
  onFallback,
}: {
  eventId: string;
  slot: string;
  label: string;
  /** Put the guest back on the director's cut, with a reason to show them. */
  onFallback: (reason: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const watcherRef = useRef<GuestCameraWatcher | null>(null);
  const [status, setStatus] = useState<Status>('connecting');

  useEffect(() => {
    let cancelled = false;
    // A fresh identity per mount. Random, ephemeral, and carries nothing about the
    // guest — it exists only so the phone can tell its viewers apart.
    const viewerId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `v${Math.random().toString(36).slice(2)}${Date.now()}`;

    void (async () => {
      const session = await startGuestPickSession(eventId).catch(() => null);
      if (cancelled) return;
      if (!session?.ok) {
        // Flag off, guest-pick switched off, not entitled, or no session could be
        // minted. All of them mean the same thing to a guest.
        setStatus('unavailable');
        onFallback('That camera isn’t available right now — showing the main stream.');
        return;
      }

      watcherRef.current = watchGuestCamera({
        eventId,
        slot,
        viewerId,
        iceServers: session.iceServers.length > 0 ? session.iceServers : undefined,
        onTrack: (stream) => {
          if (cancelled) return;
          const el = videoRef.current;
          if (!el) return;
          el.srcObject = stream;
          void el.play().catch(() => {});
        },
        onState: (s: PeerConnectionState) => {
          if (cancelled) return;
          if (s === 'connected') setStatus('live');
          else if (s === 'failed') {
            setStatus('unavailable');
            onFallback(`Couldn’t reach ${label} — showing the main stream.`);
          }
        },
        onFull: () => {
          if (cancelled) return;
          setStatus('full');
          onFallback(`${label} is full right now — showing the main stream.`);
        },
      });
    })();

    return () => {
      cancelled = true;
      watcherRef.current?.close();
      watcherRef.current = null;
    };
  }, [eventId, slot, label, onFallback]);

  return (
    <div className="relative aspect-video w-full bg-black">
      <video
        ref={videoRef}
        playsInline
        autoPlay
        // Autoplay with sound is blocked on mobile without a gesture; a muted start
        // guarantees a picture, and the control bar lets the guest unmute.
        muted
        controls
        className="absolute inset-0 h-full w-full object-contain"
      />

      {status === 'connecting' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <span
            aria-hidden
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-terracotta"
          />
          <p className="text-sm text-cream/75">Connecting to {label}…</p>
          <p className="max-w-xs text-xs text-cream/50">
            This camera streams straight from the phone holding it.
          </p>
        </div>
      ) : null}

      {status === 'full' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <Users aria-hidden className="h-7 w-7 text-cream/60" strokeWidth={1.5} />
          <p className="text-sm font-medium text-cream">{label} is full</p>
          <p className="max-w-xs text-xs text-cream/60">
            Up to {GUEST_PICK_MAX_VIEWERS_PER_CAMERA} guests can watch a side camera at
            once. Taking you back to the main stream — it has no limit.
          </p>
        </div>
      ) : null}

      {status === 'unavailable' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <VideoOff aria-hidden className="h-7 w-7 text-cream/60" strokeWidth={1.5} />
          <p className="text-sm font-medium text-cream">{label} isn’t reachable</p>
          <p className="max-w-xs text-xs text-cream/60">
            Showing the main stream instead.
          </p>
        </div>
      ) : null}
    </div>
  );
}
