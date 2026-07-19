'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Download, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import {
  useDemoChannel,
  untaggedReason,
  type DemoDiag,
  type DemoMessage,
  type DemoRole,
} from '@/app/_components/demo-session/use-demo-channel';
import { isFaceModelConfigured } from '@/lib/face-embed-core';
import { euclideanDistance } from '@/lib/face-match-core';
import { PAPIC_STYLES, DEFAULT_PAPIC_STYLE } from '@/lib/papic-photo-styles';
import { recordDemoShot } from '@/app/_actions/demo-session-actions';

/**
 * The phone-side half of the Papic homepage demo (owner spec, DECISION_LOG
 * 2026-07-03): scan a QR → consent → on-device face registration → SHOOT.
 *
 * PR-2 (this build) completes the loop the PR-1 scope note deferred: the
 * capture step with the server-enforced 3-shot session cap, on-device
 * friend-tagging (each phone's registration vector relays transiently over
 * the session's Realtime channel and is matched AGAINST THE FRAME ON THE
 * CAPTURING PHONE — pure client math, `face-match-core`), the live mirror to
 * the desktop pop-up, and save-to-phone in whatever style the pop-up has set.
 *
 * Privacy shape (unchanged from PR-1, now with the relay the consent screen
 * described): frames + vectors travel ONLY over the ephemeral session channel
 * and are never persisted anywhere — the server counts shots (a number) and
 * nothing else. Closing the tab forgets everything.
 */

type Step = 'consent' | 'camera' | 'registering' | 'shoot' | 'camera-error';

type DemoPhoto = {
  id: string;
  from: DemoRole;
  dataUrl: string;
  tags: DemoRole[];
  diag?: DemoDiag;
};

const SHOT_MAX_EDGE = 900;
const RELAY_BYTE_BUDGET = 200_000; // keep well under the Realtime payload limit
// Demo-only match cut. Real Papic auto-tags at 0.50 and SUGGESTS 0.50–0.60 for a
// human to confirm; the demo has no confirm step, so it tags directly at face-
// api's native 0.60 line — still ~0.19 below the validated impostor floor (0.79),
// safely inside the empty gap. Deliberately NOT face-match-core's global constant.
const DEMO_TAG_MAX_DISTANCE = 0.6;

function styleCss(styleId: string): string {
  return PAPIC_STYLES.find((s) => s.id === styleId)?.cssPreview ?? '';
}

export function DemoJoinFlow({
  sessionId,
  role,
  token,
}: {
  sessionId: string;
  role: DemoRole;
  token: string;
}) {
  const [step, setStep] = useState<Step>('consent');
  const [registered, setRegistered] = useState(false);
  const [photos, setPhotos] = useState<DemoPhoto[]>([]);
  const [remaining, setRemaining] = useState(3);
  const [style, setStyle] = useState<string>(DEFAULT_PAPIC_STYLE);
  const [shooting, setShooting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const myVectorRef = useRef<number[] | null>(null);
  const peerVectorsRef = useRef<Partial<Record<DemoRole, number[]>>>({});

  // `send` lands in this ref after the channel hook below — declared first so
  // the message handler (created earlier in render order) can close over it.
  const sendRef = useRef<((msg: DemoMessage) => void) | null>(null);

  const onMessage = useCallback(
    (msg: DemoMessage) => {
      if (msg.type === 'face') {
        peerVectorsRef.current[msg.role] = msg.vector;
      } else if (msg.type === 'face-request') {
        if (myVectorRef.current) {
          sendRef.current?.({ type: 'face', role, vector: myVectorRef.current });
        }
      } else if (msg.type === 'photo') {
        setPhotos((prev) =>
          prev.some((p) => p.id === msg.id)
            ? prev
            : [...prev, { id: msg.id, from: msg.from, dataUrl: msg.dataUrl, tags: msg.tags, diag: msg.diag }],
        );
        setRemaining(msg.remaining);
      } else if (msg.type === 'style') {
        setStyle(msg.style);
      }
    },
    [role],
  );

  const me = useMemo(() => ({ role, registered }), [role, registered]);
  const { presence, send } = useDemoChannel(sessionId, me, onMessage);
  sendRef.current = send;

  const otherRole: DemoRole = role === 'a' ? 'b' : 'a';
  const friendJoined = presence[otherRole].joined;

  // Self-heal the vector handshake: if my registered vector's early broadcast was
  // dropped before the peer had subscribed, re-send it (plus a face-request) the
  // moment the peer appears in presence. With send() now queuing until joined,
  // this closes the race for any subscribe/register order.
  useEffect(() => {
    if (friendJoined && myVectorRef.current) {
      send({ type: 'face', role, vector: myVectorRef.current });
      send({ type: 'face-request' });
    }
  }, [friendJoined, role, send]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const openCamera = useCallback(async (facing: 'user' | 'environment', nextStep: Step) => {
    setStep(nextStep);
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: facing === 'user' ? 640 : 1280 } },
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
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      // Best-effort: embedSingleFace no-ops (returns null) when the model
      // isn't configured or no face is found — the demo still completes, it
      // just tags less rather than blocking anyone.
      const { embedSingleFace } = await import('@/lib/face-embed');
      let res = await embedSingleFace(canvas);
      // A null despite a configured model is usually the first call racing the
      // ~13 MB model download; getFaceApi no longer caches a failed load, so one
      // retry recovers the common transient case before we give up on tagging.
      if (!res?.vector && isFaceModelConfigured()) {
        res = await embedSingleFace(canvas);
      }
      myVectorRef.current = res?.vector ?? null;
      if (res?.vector) send({ type: 'face', role, vector: res.vector });
      setRegistered(true);
      // Ask peers for anything we missed while registering, then flip to the
      // rear camera for the actual shooting round.
      send({ type: 'face-request' });
      send({ type: 'style-request' });
      await openCamera('environment', 'shoot');
    } catch {
      setRegistered(true);
      await openCamera('environment', 'shoot');
    }
  }, [openCamera, role, send]);

  const takeShot = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || shooting || remaining <= 0) return;
    setShooting(true);
    try {
      // Server-enforced cap FIRST — the frame only exists if the shot counts.
      const gate = await recordDemoShot(token);
      if (!gate.ok) {
        if (gate.reason === 'cap') setRemaining(0);
        return;
      }
      const scale = Math.min(1, SHOT_MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);

      // On-device friend-tagging: every registered vector this phone knows
      // (its own + what peers relayed) vs every face in the frame. `diag` records
      // WHY a shot missed (demo-only, no PII) so an untagged photo can say so.
      const tags: DemoRole[] = [];
      const diag: DemoDiag = {
        model: isFaceModelConfigured(),
        you: myVectorRef.current != null,
        friend: peerVectorsRef.current[otherRole] != null,
        faces: 0,
        closest: null,
      };
      try {
        const { embedFaces } = await import('@/lib/face-embed');
        const { vectors: found } = await embedFaces(canvas);
        diag.faces = found.length;
        const known: Array<[DemoRole, number[]]> = [];
        if (myVectorRef.current) known.push([role, myVectorRef.current]);
        const peer = peerVectorsRef.current[otherRole];
        if (peer) known.push([otherRole, peer]);
        for (const [who, vec] of known) {
          let best = Infinity;
          for (const f of found) best = Math.min(best, euclideanDistance(f, vec));
          if (Number.isFinite(best)) diag.closest = diag.closest == null ? best : Math.min(diag.closest, best);
          if (best <= DEMO_TAG_MAX_DISTANCE) tags.push(who);
        }
      } catch {
        /* tagging is a flourish — the shot still counts */
      }

      let dataUrl = canvas.toDataURL('image/jpeg', 0.62);
      if (dataUrl.length > RELAY_BYTE_BUDGET) {
        const small = document.createElement('canvas');
        const s2 = 640 / Math.max(canvas.width, canvas.height);
        small.width = Math.round(canvas.width * s2);
        small.height = Math.round(canvas.height * s2);
        small.getContext('2d')?.drawImage(canvas, 0, 0, small.width, small.height);
        dataUrl = small.toDataURL('image/jpeg', 0.5);
      }

      const photo: DemoPhoto = { id: crypto.randomUUID(), from: role, dataUrl, tags, diag };
      // Broadcast doesn't echo to the sender — render locally + relay to peers.
      setPhotos((prev) => [...prev, photo]);
      setRemaining(gate.remaining);
      send({ type: 'photo', ...photo, shotNumber: gate.shotNumber, remaining: gate.remaining });
    } finally {
      setShooting(false);
    }
  }, [otherRole, remaining, role, send, shooting, token]);

  const savePhoto = useCallback(
    (photo: DemoPhoto) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        // The style set on the big screen bakes into the saved file.
        ctx.filter = styleCss(style);
        ctx.drawImage(img, 0, 0);
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/jpeg', 0.9);
        a.download = `papic-demo-${style.toLowerCase()}.jpg`;
        a.click();
      };
      img.src = photo.dataUrl;
    },
    [style],
  );

  const tagLabel = useCallback(
    (t: DemoRole) => (t === role ? 'You' : 'Your friend'),
    [role],
  );

  if (step === 'consent') {
    return (
      <>
        <ShieldCheck aria-hidden className="mx-auto mt-3 h-7 w-7 text-[var(--m-mulberry)]" strokeWidth={1.75} />
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Turn your phone into a camera</h1>
        <p className="mt-2 text-sm text-[var(--m-grey,#8c8884)]">
          This is a live demo of Setnayan Papic — no sign-up, no real event.
          We&rsquo;ll ask for your camera to show live face-matching between
          your phone and your friend&rsquo;s. Nothing here is recorded: photos
          and face matching stay inside this demo session and are never saved
          anywhere — closing the tab forgets everything.
        </p>
        <button
          type="button"
          onClick={() => openCamera('user', 'camera')}
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
          onClick={() => openCamera('user', 'camera')}
          className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-[var(--m-mulberry)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Try again
        </button>
      </>
    );
  }

  if (step === 'shoot') {
    const capped = remaining <= 0;
    return (
      <>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Shoot the moment</h1>
          <span className="text-xs font-medium text-[var(--m-grey,#8c8884)]">
            {capped ? 'Demo roll used up' : `${remaining} shot${remaining === 1 ? '' : 's'} left`}
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--m-grey,#8c8884)]">
          {friendJoined
            ? 'Point it at your friend — the tag happens on its own.'
            : 'Your friend hasn’t scanned their code yet — solo shots work too.'}
        </p>
        <div className="relative mt-3 overflow-hidden rounded-xl bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} muted playsInline className="aspect-[3/4] w-full object-cover" />
        </div>
        <button
          type="button"
          onClick={takeShot}
          disabled={shooting || capped}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--m-mulberry)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {shooting ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <Camera aria-hidden className="h-4 w-4" strokeWidth={2} />
          )}
          {capped ? 'That’s the 3 demo shots' : shooting ? 'Saving the moment…' : 'Take the shot'}
        </button>
        {capped && (
          <p className="mt-2 text-xs text-[var(--m-grey,#8c8884)]">
            The real Papic is unlimited — every guest, all day, one gallery.
          </p>
        )}
        {photos.length > 0 && (
          <div className="mt-4 space-y-3 text-left">
            {photos.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-xl border border-[var(--m-line)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.dataUrl}
                  alt={p.tags.length ? `Photo of ${p.tags.map(tagLabel).join(' and ')}` : 'Demo photo'}
                  className="w-full"
                  style={{ filter: styleCss(style) }}
                />
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-[var(--m-grey,#8c8884)]">
                    {p.tags.length ? p.tags.map(tagLabel).join(' · ') : untaggedReason(p.diag)}
                    {' · '}
                    {PAPIC_STYLES.find((s) => s.id === style)?.label ?? style}
                  </span>
                  <button
                    type="button"
                    onClick={() => savePhoto(p)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--m-mulberry)]"
                  >
                    <Download aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    Save
                  </button>
                </div>
              </div>
            ))}
            <p className="text-center text-[11px] text-[var(--m-grey,#8c8884)]">
              The look is picked on the big screen — saves come out in that style.
            </p>
          </div>
        )}
      </>
    );
  }

  // 'camera' | 'registering' — the selfie registration round.
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Look at the camera</h1>
      <p className="mt-2 text-sm text-[var(--m-grey,#8c8884)]">
        We&rsquo;ll register your face for this demo session only — it&rsquo;s
        how the tagging recognizes you in your friend&rsquo;s shots, and
        it&rsquo;s never saved.
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
      {!isFaceModelConfigured() && (
        <p className="mt-3 text-[11px] text-[var(--m-grey,#8c8884)]">
          Face matching is warming up on this demo — you can still shoot.
        </p>
      )}
      <p className="mt-2 text-[11px] text-[var(--m-grey,#8c8884)]">
        {friendJoined ? 'Your friend is in!' : 'Your friend can scan the other code any time.'}
      </p>
    </>
  );
}
