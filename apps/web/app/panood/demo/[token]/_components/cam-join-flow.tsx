'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { actionButtonClass } from '@/components/action-button-class';
import { routes } from '@/lib/routes';
import { Radio, RotateCcw, Video, WifiOff } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { claimPanoodDemoCamera, getDemoIceServers } from '@/app/_actions/demo-session-actions';
import { publishDemoCamera, type CameraPublisher, type CamSlot, type PeerConnectionState } from '@/lib/demo-webrtc';
import { useCameraThatComesBack } from '@/lib/use-camera-that-comes-back';

/**
 * The phone-side half of the Live Studio homepage demo (owner spec,
 * DECISION_LOG 2026-07-03): scan the ONE QR → allow camera → this phone
 * becomes a live camera in the desktop control room. LIVE STREAM ONLY —
 * nothing is recorded or stored anywhere; the video flows peer-to-peer to
 * the control room and dies when either side closes (see lib/demo-webrtc.ts).
 *
 * The camera slot (1 or 2) is claimed AFTER the camera is granted, so a scan
 * that bails at the permission prompt doesn't burn a slot. The claimed slot
 * is stashed in sessionStorage so a reload of this tab resumes as the same
 * camera instead of eating the second slot.
 *
 * Audio: we capture the mic too (with echo/noise/gain processing) so the
 * control room can actually monitor sound — a livestream with no audio isn't
 * a livestream. But audio is best-effort: a phone with no mic, or a visitor
 * who allows the camera and blocks the mic, falls back to a silent camera so
 * the video demo NEVER breaks over audio. The control room keeps its program
 * monitor muted until a click (see panood-demo-overlay.tsx), so a laptop +
 * phone in the same room don't howl with feedback the moment they connect.
 */

type Step = 'intro' | 'starting' | 'live' | 'full' | 'expired' | 'camera-error' | 'net-error';

const SLOT_LABEL: Record<CamSlot, string> = { a: 'Camera 1', b: 'Camera 2' };

/**
 * Rear camera (a phone pointed at the scene; browsers fall back to whatever
 * camera exists, e.g. a laptop webcam) + processed mic. If the mic is missing
 * or blocked but the camera is fine, retry video-only rather than failing the
 * whole demo — audio is a bonus, video is the point.
 */
async function captureCameraStream(): Promise<MediaStream> {
  const video: MediaTrackConstraints = {
    facingMode: 'environment',
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };
  try {
    return await navigator.mediaDevices.getUserMedia({
      video,
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    // A blocked/absent mic (or over-constrained audio) shouldn't sink the
    // camera demo. A blocked *camera* will also reject this retry — that
    // rethrows and the caller shows the camera-error step, same as before.
    const name = (err as { name?: string } | null)?.name;
    if (name === 'NotFoundError' || name === 'NotAllowedError' || name === 'OverconstrainedError') {
      return await navigator.mediaDevices.getUserMedia({ video });
    }
    throw err;
  }
}

export function CamJoinFlow({ token, sessionId }: { token: string; sessionId: string }) {
  const [step, setStep] = useState<Step>('intro');
  const [slot, setSlot] = useState<CamSlot | null>(null);
  const [peerState, setPeerState] = useState<PeerConnectionState>('waiting');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const publisherRef = useRef<CameraPublisher | null>(null);

  useEffect(() => {
    return () => {
      publisherRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const goLive = useCallback(async () => {
    setStep('starting');

    let stream: MediaStream;
    try {
      stream = await captureCameraStream();
    } catch {
      setStep('camera-error');
      return;
    }
    streamRef.current = stream;

    // Claim a slot only now that a camera actually exists. sessionStorage lets
    // a reloaded tab resume as the same camera instead of burning slot 2.
    const storageKey = `panood-demo-slot:${sessionId}`;
    let claimedSlot = (sessionStorage.getItem(storageKey) as CamSlot | null) ?? null;
    if (!claimedSlot) {
      try {
        const claim = await claimPanoodDemoCamera(token);
        if (!claim.ok) {
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          setStep(claim.reason === 'full' ? 'full' : 'expired');
          return;
        }
        claimedSlot = claim.slot;
        sessionStorage.setItem(storageKey, claimedSlot);
      } catch {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setStep('net-error');
        return;
      }
    }
    setSlot(claimedSlot);

    // Fetch ICE servers (STUN + a minted TURN relay when configured) so phones
    // on mobile data / client-isolated venue Wi-Fi can still connect. Falls
    // back to the transport's STUN-only default if the action fails.
    const { iceServers } = await getDemoIceServers(sessionId).catch(() => ({
      iceServers: undefined as RTCIceServer[] | undefined,
    }));

    publisherRef.current?.close();
    publisherRef.current = publishDemoCamera({
      sessionId,
      slot: claimedSlot,
      stream,
      onState: setPeerState,
      iceServers,
    });
    setStep('live');
  }, [sessionId, token]);

  // THE CAMERA COMES BACK (Duo + iPad audit 2026-10-19, W4): when iOS, a Duo or
  // a dead track takes the camera, go live again through goLive — the same
  // rear camera, the slot already in sessionStorage (no second claim), a fresh
  // publisher — behind the shipped "Starting camera…" state.
  useCameraThatComesBack({
    streamRef,
    live: step === 'live',
    restart: () => {
      publisherRef.current?.close();
      publisherRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      void goLive();
    },
  });

  // The preview <video> mounts with the 'live' step — attach the stream then.
  useEffect(() => {
    if (step === 'live' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [step]);

  if (step === 'intro' || step === 'starting') {
    return (
      <>
        <Video aria-hidden className="mx-auto mt-3 h-7 w-7 text-[var(--m-mulberry)]" strokeWidth={1.75} />
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Become a live camera</h1>
        <p className="mt-2 text-sm text-[var(--m-slate-2)]">
          This is a live demo of the Setnayan Live Watch control room — no
          sign-up, no real event. Your phone&rsquo;s camera and sound stream
          straight to the control room on your computer.{' '}
          <strong>Live only — nothing recorded:</strong> no video or audio is
          saved anywhere, ever.
        </p>
        <ActionButton
          tone="brand"
          main
          icon={Video}
          label="Allow camera + mic & go live"
          busy={step === 'starting' ? 'Starting camera…' : null}
          onClick={goLive}
          className="mt-5 w-full"
        />
      </>
    );
  }

  if (step === 'camera-error') {
    return (
      <>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Camera access needed</h1>
        <p className="mt-2 text-sm text-[var(--m-slate-2)]">
          Your browser blocked camera access. Check your site permissions and
          try again.
        </p>
        <ActionButton tone="brand" main icon={RotateCcw} label="Try again" onClick={goLive} className="mt-5 w-full" />
      </>
    );
  }

  if (step === 'full') {
    return (
      <>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Both cameras are taken</h1>
        <p className="mt-2 text-sm text-[var(--m-slate-2)]">
          This demo already has its two cameras. Open Live Watch to start your own.
        </p>
        <OpenLiveWatch />
      </>
    );
  }

  if (step === 'expired') {
    return (
      <>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">This demo link expired</h1>
        <p className="mt-2 text-sm text-[var(--m-slate-2)]">
          Demo codes are fresh every time. Open Live Watch for a new one.
        </p>
        <OpenLiveWatch />
      </>
    );
  }

  if (step === 'net-error') {
    return (
      <>
        <WifiOff aria-hidden className="mx-auto mt-3 h-7 w-7 text-[var(--m-mulberry)]" strokeWidth={1.75} />
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Couldn&rsquo;t reach the demo</h1>
        <p className="mt-2 text-sm text-[var(--m-slate-2)]">
          Something got in the way of joining. Check your connection and try
          again.
        </p>
        <ActionButton tone="brand" main icon={RotateCcw} label="Try again" onClick={goLive} className="mt-5 w-full" />
      </>
    );
  }

  // step === 'live'
  return (
    <>
      <div className="flex items-center justify-center gap-2">
        <Radio
          aria-hidden
          className={`h-5 w-5 ${peerState === 'connected' ? 'text-success-700' : 'text-[var(--m-slate-2)]'}`}
          strokeWidth={2}
        />
        <h1 className="text-xl font-semibold tracking-tight">
          You&rsquo;re {slot ? SLOT_LABEL[slot] : 'a camera'}
        </h1>
      </div>
      <p className="mt-2 text-sm text-[var(--m-slate-2)]">
        {peerState === 'connected'
          ? 'Connected — you’re live in the control room. Point your phone at anything.'
          : peerState === 'failed'
            ? 'Video couldn’t connect on this network. Switching your phone to mobile data (or a different Wi-Fi) usually fixes it.'
            : 'Connecting to the control room…'}
      </p>
      <div className="relative mt-4 overflow-hidden rounded-xl bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
        <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium tracking-wide text-white">
          {peerState === 'connected' ? '● LIVE' : 'PREVIEW'}
        </span>
      </div>
      <p className="mt-4 rounded-md bg-[var(--m-paper)] px-3 py-2.5 text-xs text-[var(--m-slate-2)]">
        Live camera — nothing recorded. Close this page and the feed is gone.
      </p>
    </>
  );
}

/** The one way on from a full or expired demo: the Live Watch page, where a fresh demo opens (final check A1-032). */
function OpenLiveWatch() {
  return (
    <Link href={routes.liveWatch()} className={`mt-5 ${actionButtonClass('brand', { main: true })}`}>
      <Radio aria-hidden strokeWidth={1.9} />
      <span className="lbl">Open Live Watch</span>
    </Link>
  );
}
