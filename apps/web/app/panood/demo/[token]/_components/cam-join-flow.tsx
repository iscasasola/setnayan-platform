'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Radio, Video, WifiOff } from 'lucide-react';
import { claimPanoodDemoCamera } from '@/app/_actions/demo-session-actions';
import { publishDemoCamera, type CameraPublisher, type CamSlot, type PeerConnectionState } from '@/lib/demo-webrtc';

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
 */

type Step = 'intro' | 'starting' | 'live' | 'full' | 'expired' | 'camera-error' | 'net-error';

const SLOT_LABEL: Record<CamSlot, string> = { a: 'Camera 1', b: 'Camera 2' };

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
      stream = await navigator.mediaDevices.getUserMedia({
        // Rear camera where there is one (a phone pointed at the scene) —
        // browsers fall back to whatever camera exists (e.g. a laptop webcam).
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false, // video-only demo: no mic prompt, no feedback loop
      });
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

    publisherRef.current?.close();
    publisherRef.current = publishDemoCamera({
      sessionId,
      slot: claimedSlot,
      stream,
      onState: setPeerState,
    });
    setStep('live');
  }, [sessionId, token]);

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
        <p className="mt-2 text-sm text-[var(--m-grey,#8c8884)]">
          This is a live demo of the Setnayan Live Studio control room — no
          sign-up, no real event. Your phone streams straight to the control
          room on your computer. <strong>Live camera — nothing recorded:</strong>{' '}
          no video is saved anywhere, ever.
        </p>
        <button
          type="button"
          onClick={goLive}
          disabled={step === 'starting'}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--m-mulberry)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {step === 'starting' ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <Video aria-hidden className="h-4 w-4" strokeWidth={2} />
          )}
          {step === 'starting' ? 'Starting camera…' : 'Allow camera & go live'}
        </button>
      </>
    );
  }

  if (step === 'camera-error') {
    return (
      <>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Camera access needed</h1>
        <p className="mt-2 text-sm text-[var(--m-grey,#8c8884)]">
          Your browser blocked camera access. Check your site permissions and
          try again.
        </p>
        <button
          type="button"
          onClick={goLive}
          className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-[var(--m-mulberry)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Try again
        </button>
      </>
    );
  }

  if (step === 'full') {
    return (
      <>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Both cameras are taken</h1>
        <p className="mt-2 text-sm text-[var(--m-grey,#8c8884)]">
          This demo session already has its two cameras. Open a fresh demo from
          the Live Studio tile on the homepage to start your own.
        </p>
      </>
    );
  }

  if (step === 'expired') {
    return (
      <>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">This demo link expired</h1>
        <p className="mt-2 text-sm text-[var(--m-grey,#8c8884)]">
          Demo codes are fresh every time — open a new one from the Live Studio
          tile on the Setnayan homepage.
        </p>
      </>
    );
  }

  if (step === 'net-error') {
    return (
      <>
        <WifiOff aria-hidden className="mx-auto mt-3 h-7 w-7 text-[var(--m-mulberry)]" strokeWidth={1.75} />
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Couldn&rsquo;t reach the demo</h1>
        <p className="mt-2 text-sm text-[var(--m-grey,#8c8884)]">
          Something got in the way of joining. Check your connection and try
          again.
        </p>
        <button
          type="button"
          onClick={goLive}
          className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-[var(--m-mulberry)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Try again
        </button>
      </>
    );
  }

  // step === 'live'
  return (
    <>
      <div className="flex items-center justify-center gap-2">
        <Radio
          aria-hidden
          className={`h-5 w-5 ${peerState === 'connected' ? 'text-[#3f6b3f]' : 'text-[var(--m-grey,#8c8884)]'}`}
          strokeWidth={2}
        />
        <h1 className="text-xl font-semibold tracking-tight">
          You&rsquo;re {slot ? SLOT_LABEL[slot] : 'a camera'}
        </h1>
      </div>
      <p className="mt-2 text-sm text-[var(--m-grey,#8c8884)]">
        {peerState === 'connected'
          ? 'Connected — you’re live in the control room. Point your phone at anything.'
          : peerState === 'failed'
            ? 'Video couldn’t connect on this network — phone and computer on the same Wi-Fi usually does it.'
            : 'Connecting to the control room…'}
      </p>
      <div className="relative mt-4 overflow-hidden rounded-xl bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
        <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium tracking-wide text-white">
          {peerState === 'connected' ? '● LIVE' : 'PREVIEW'}
        </span>
      </div>
      <p className="mt-4 rounded-md bg-[var(--m-paper)] px-3 py-2.5 text-xs text-[var(--m-grey,#8c8884)]">
        Live camera — nothing recorded. Close this page and the feed is gone.
      </p>
    </>
  );
}
