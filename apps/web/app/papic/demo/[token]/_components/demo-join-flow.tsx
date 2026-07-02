'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { useDemoChannel } from '@/app/_components/demo-session/use-demo-channel';
import { isFaceModelConfigured } from '@/lib/face-embed-core';

/**
 * The phone-side half of the Papic homepage demo (owner spec, DECISION_LOG
 * 2026-07-03): scan a QR → consent → camera → on-device face registration.
 *
 * PR-1 SCOPE NOTE: this ends at "face registered" — it does not yet shoot
 * photos, apply a theme, or detect the other phone's face in a shot. That's
 * the deliberately separate PR-2 (capture + theme + live cross-phone
 * matching + save-to-phone + the 3-shot cap). Nothing here writes a photo or
 * a face descriptor anywhere: the descriptor lives only in this tab's memory
 * for the rest of the session, and only a `registered: true` boolean (no
 * biometric data) is published to the other phone via Realtime presence.
 */

type Step = 'consent' | 'camera' | 'registering' | 'done' | 'camera-error';

export function DemoJoinFlow({ sessionId, role }: { sessionId: string; role: 'a' | 'b' }) {
  const [step, setStep] = useState<Step>('consent');
  const [registered, setRegistered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const presence = useDemoChannel(sessionId, { role, registered });
  const otherRole = role === 'a' ? 'b' : 'a';
  const friendJoined = presence[otherRole].joined;

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const openCamera = useCallback(async () => {
    setStep('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setStep('camera-error');
    }
  }, []);

  const registerFace = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    setStep('registering');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      // Best-effort: embedSingleFace no-ops (returns null) when the model
      // isn't configured or no face is found — the demo still completes, it
      // just skips the "detected!" flourish rather than blocking anyone.
      const { embedSingleFace } = await import('@/lib/face-embed');
      await embedSingleFace(canvas); // descriptor stays local; never sent anywhere in this PR
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setRegistered(true);
      setStep('done');
    } catch {
      setRegistered(true);
      setStep('done');
    }
  }, []);

  if (step === 'consent') {
    return (
      <>
        <ShieldCheck aria-hidden className="mx-auto mt-3 h-7 w-7 text-[var(--m-mulberry)]" strokeWidth={1.75} />
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Turn your phone into a camera</h1>
        <p className="mt-2 text-sm text-[var(--m-grey,#8c8884)]">
          This is a live demo of Setnayan Papic — no sign-up, no real event.
          We&rsquo;ll ask for your camera to show live face-matching between
          your phone and your friend&rsquo;s. Nothing here is recorded: no
          photo, no face data, ever leaves this demo or gets saved anywhere.
        </p>
        <button
          type="button"
          onClick={openCamera}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--m-mulberry)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          <Camera aria-hidden className="h-4 w-4" strokeWidth={2} />
          Allow camera &amp; continue
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
          onClick={openCamera}
          className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-[var(--m-mulberry)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Try again
        </button>
      </>
    );
  }

  if (step === 'done') {
    return (
      <>
        <Sparkles aria-hidden className="mx-auto mt-3 h-7 w-7 text-[var(--m-mulberry)]" strokeWidth={1.75} />
        <h1 className="mt-3 text-xl font-semibold tracking-tight">You&rsquo;re in ✓</h1>
        <p className="mt-2 text-sm text-[var(--m-grey,#8c8884)]">
          {isFaceModelConfigured()
            ? 'Face registered on this phone.'
            : "You're connected — face matching is warming up on this demo."}{' '}
          {friendJoined
            ? 'Your friend is in too!'
            : "Waiting on your friend's phone to scan the other code…"}
        </p>
        <p className="mt-4 rounded-md bg-[var(--m-paper)] px-3 py-2.5 text-xs text-[var(--m-grey,#8c8884)]">
          The live camera + friend-tagging round of this demo is rolling out
          next — head back to your laptop to watch both phones show up.
        </p>
      </>
    );
  }

  // 'camera' | 'registering'
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Look at the camera</h1>
      <p className="mt-2 text-sm text-[var(--m-grey,#8c8884)]">
        We&rsquo;ll register your face on this phone only — nothing leaves
        this screen.
      </p>
      <div className="relative mt-4 overflow-hidden rounded-xl bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} muted playsInline className="aspect-square w-full scale-x-[-1] object-cover" />
      </div>
      <button
        type="button"
        onClick={registerFace}
        disabled={step === 'registering'}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--m-mulberry)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {step === 'registering' ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
        ) : (
          <Camera aria-hidden className="h-4 w-4" strokeWidth={2} />
        )}
        {step === 'registering' ? 'Registering…' : 'Register my face'}
      </button>
    </>
  );
}
