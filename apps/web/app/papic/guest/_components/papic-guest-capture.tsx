'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Loader2,
  Check,
  CircleAlert,
  ImageIcon,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { DayOfFaceEnroll } from '@/app/[slug]/_components/day-of-face-enroll';

// Papic · guest capture (client)
//
// Mirrors the seat-capture surface (apps/web/app/papic/seat/[token]/_components/
// papic-seat-capture.tsx) but for the PAPIC_GUEST per-guest camera. Rear camera
// (getUserMedia facingMode: environment) → freeze to a canvas → JPEG → POST the
// bytes as multipart to /api/papic/guest-capture, which validates the guest-
// session cookie, PUTs to R2 server-side, and records the capture through the
// quota-enforcing papic_record_guest_capture RPC. The response carries the
// authoritative `remaining` credit count, so the client never owns the cap —
// it just reflects what the server returns. Photos only; 5-second clips are a
// documented follow-up (the media bucket's MIME allow-list is image-only).

type Props = {
  guestName: string;
  eventName: string;
  initialRemaining: number;
  total: number;
  /** Has this guest already accepted the one-time UGC terms of use? */
  termsAccepted: boolean;
  /** True when the guest has no active face enrollment — shows the in-camera
   *  "add your face" fallback prompt so their candid shots auto-find them. */
  needsFaceEnroll?: boolean;
};

export function PapicGuestCapture({
  guestName,
  eventName,
  initialRemaining,
  total,
  termsAccepted,
  needsFaceEnroll = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  // Kwento (0012): after a shot, the guest can tell the couple the story
  // behind it — the warmest moment to ask. Anchored on the capture just made.
  const [kwentoCaptureId, setKwentoCaptureId] = useState<string | null>(null);
  const [kwentoText, setKwentoText] = useState('');
  const [kwentoConsent, setKwentoConsent] = useState(false);
  const [kwentoPhase, setKwentoPhase] = useState<'idle' | 'sending' | 'sent' | 'held'>('idle');
  const [kwentoError, setKwentoError] = useState<string | null>(null);
  // The just-sent message, so the guest can change their mind and delete it.
  // The 24h window + ownership are enforced server-side by the delete RPC.
  const [sentMessageId, setSentMessageId] = useState<string | null>(null);
  const [deletePhase, setDeletePhase] = useState<'idle' | 'deleting' | 'deleted'>('idle');

  // UGC terms gate (Apple 1.2 / Google Play UGC). The guest must accept the
  // objectionable-content terms once before their first capture. If they've
  // already accepted (server-resolved), this is true and the camera shows
  // immediately.
  const [accepted, setAccepted] = useState(termsAccepted);
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // In-camera "add your face" fallback (the straight-to-shooting guest who
  // skipped the RSVP selfie). enrolling swaps the rear capture stream for the
  // front-camera enroll panel; enrolled hides the prompt afterward.
  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);

  const exhausted = remaining <= 0;

  const acceptTerms = useCallback(async () => {
    if (acceptBusy || !agreeChecked) return;
    setAcceptBusy(true);
    setAcceptError(null);
    try {
      const res = await fetch('/api/papic/accept-terms', { method: 'POST' });
      if (!res.ok) throw new Error('accept');
      setAccepted(true);
    } catch {
      setAcceptError('Could not save that — check your signal and try again.');
    } finally {
      setAcceptBusy(false);
    }
  }, [acceptBusy, agreeChecked]);

  useEffect(() => {
    // Don't request the camera until the guest has accepted the UGC terms and
    // isn't blocked — no point prompting for camera access behind the gate.
    // Also release it while enrolling: the front-camera selfie panel owns the
    // camera then (most phones allow only one active stream), and this effect's
    // cleanup re-acquires the rear stream when enrolling flips back off.
    if (!accepted || blocked || enrolling) return;
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        setCamError(true);
      }
    }
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [accepted, blocked, enrolling]);

  const capture = useCallback(async () => {
    if (busy || !ready || exhausted || !accepted || blocked) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    setBusy(true);
    setSaveError(null);

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setBusy(false);
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    );
    if (!blob) {
      setBusy(false);
      setSaveError('Could not grab that frame — try again.');
      return;
    }

    try {
      const form = new FormData();
      form.append('file', blob, `papic-${Date.now()}.jpg`);
      // FACE auto-tag: detect faces + compute their 128-d descriptors ON-DEVICE
      // (lazy-imported face-api.js) from the frame we just froze, and send ONLY
      // the tiny vectors — the face IMAGE never leaves the phone. The server
      // matcher tags whoever's enrolled; QR scan stays the manual fallback.
      // Dormant until a model is hosted (NEXT_PUBLIC_FACE_MODEL_URL) → []; the
      // 'saved' feedback never waits on it failing.
      try {
        const { embedFaces } = await import('@/lib/face-embed');
        const vectors = await embedFaces(canvas);
        if (vectors.length > 0) form.append('face_vectors', JSON.stringify(vectors));
      } catch {
        // best-effort — a face-tag miss never affects the saved photo
      }
      const res = await fetch('/api/papic/guest-capture', { method: 'POST', body: form });
      const json = (await res.json().catch(() => ({}))) as {
        status?: string;
        remaining?: number;
        error?: string;
        captureId?: string | null;
      };

      if (res.status === 409 || json.status === 'quota_exhausted') {
        setRemaining(0);
        setSaveError(null);
        return;
      }
      // UGC moderation gates enforced server-side in the capture RPC.
      if (json.status === 'blocked') {
        setBlocked(true);
        setSaveError(null);
        return;
      }
      if (json.status === 'terms_required') {
        setAccepted(false);
        setSaveError(null);
        return;
      }
      if (!res.ok || json.status !== 'ok') {
        throw new Error(json.error ?? 'record');
      }

      setRemaining(typeof json.remaining === 'number' ? json.remaining : (r) => Math.max(0, r - 1));
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 900);
      if (json.captureId) {
        setKwentoCaptureId(json.captureId);
        setKwentoText('');
        setKwentoPhase('idle');
        setKwentoError(null);
      }
    } catch {
      setSaveError("That shot didn't save — check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, ready, exhausted, accepted, blocked]);

  const sendKwento = async () => {
    if (!kwentoCaptureId || kwentoPhase === 'sending') return;
    const text = kwentoText.trim();
    if (text.length < 1 || !kwentoConsent) return;
    setKwentoPhase('sending');
    setKwentoError(null);
    try {
      const res = await fetch('/api/papic/kwento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captureId: kwentoCaptureId, body: text, consent: true }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        state?: string;
        error?: string;
        messageId?: string;
      };
      if (res.ok && json.ok) {
        setKwentoPhase(json.state === 'flagged' ? 'held' : 'sent');
        setSentMessageId(json.messageId ?? null);
        setDeletePhase('idle');
        return;
      }
      setKwentoPhase('idle');
      setKwentoError(
        json.error === 'keep_it_sweet'
          ? "Let's keep it sweet 💛 — try rephrasing that one."
          : json.error === 'limit_reached'
            ? "You've shared your 10 kwentos for this celebration — salamat!"
            : json.error === 'too_fast'
              ? 'One kwento at a time — give it a few seconds.'
              : "That didn't send — try again.",
      );
    } catch {
      setKwentoPhase('idle');
      setKwentoError('No signal — try again in a moment.');
    }
  };

  const deleteKwento = async () => {
    if (!sentMessageId || deletePhase === 'deleting') return;
    setDeletePhase('deleting');
    try {
      const res = await fetch('/api/papic/kwento/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: sentMessageId }),
      });
      setDeletePhase(res.ok ? 'deleted' : 'idle');
    } catch {
      setDeletePhase('idle');
    }
  };

  if (blocked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-12 text-ink">
        <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-7 text-center shadow-sm">
          <CircleAlert aria-hidden className="mx-auto h-7 w-7 text-terracotta" strokeWidth={1.75} />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">Camera unavailable</h1>
          <p className="mt-2 text-sm text-ink/65">
            The couple has turned off your guest camera for this wedding. If you
            think this is a mistake, reach out to the couple directly.
          </p>
        </div>
      </main>
    );
  }

  // UGC terms-of-use gate — shown once, before the first capture. Defines what
  // counts as objectionable content and requires explicit acceptance (Apple
  // 1.2 / Google Play UGC EULA requirement).
  if (!accepted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-10 text-ink">
        <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-7 shadow-sm">
          <ShieldCheck aria-hidden className="h-7 w-7 text-mulberry" strokeWidth={1.75} />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">
            Before you start shooting, {guestName}
          </h1>
          <p className="mt-2 text-sm text-ink/70">
            Your photos go straight into {eventName}&rsquo;s gallery and may be
            seen by other guests and the couple. By using this camera you agree
            to our{' '}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-mulberry underline underline-offset-2"
            >
              Terms of Use
            </a>{' '}
            and to keep your shots free of objectionable content.
          </p>
          <ul className="mt-4 space-y-1.5 text-sm text-ink/65">
            <li>· No nudity, sexual, or explicit content.</li>
            <li>· No violence, hate, or harassment of any guest.</li>
            <li>· Only candid moments from this celebration.</li>
          </ul>
          <p className="mt-3 text-xs text-ink/55">
            The couple can hide any photo, report it to Setnayan, and block your
            camera. Reported content is reviewed by our team.
          </p>

          <label className="mt-5 flex items-start gap-3 rounded-xl border border-ink/10 bg-cream px-4 py-3 text-sm text-ink/80">
            <input
              type="checkbox"
              checked={agreeChecked}
              onChange={(e) => setAgreeChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-mulberry"
            />
            <span>I agree to the Terms of Use and will only share appropriate photos.</span>
          </label>

          {acceptError && (
            <p role="alert" className="mt-3 text-center text-xs text-terracotta">
              {acceptError}
            </p>
          )}

          <button
            type="button"
            onClick={acceptTerms}
            disabled={!agreeChecked || acceptBusy}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-40"
          >
            {acceptBusy ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : (
              <Camera aria-hidden className="h-4 w-4" strokeWidth={2} />
            )}
            Agree &amp; open my camera
          </button>
        </div>
      </main>
    );
  }

  if (camError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-12 text-ink">
        <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-7 text-center shadow-sm">
          <CircleAlert aria-hidden className="mx-auto h-7 w-7 text-terracotta" strokeWidth={1.75} />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">We need your camera</h1>
          <p className="mt-2 text-sm text-ink/65">
            Allow camera access for Setnayan in your browser, then reload this
            page to start shooting.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center justify-center rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600"
          >
            Reload &amp; try again
          </button>
        </div>
      </main>
    );
  }

  // Face enroll panel — the front-camera selfie owns the camera while this is
  // up (the rear capture stream was released by the effect above).
  if (enrolling) {
    return (
      <main className="flex min-h-screen flex-col bg-ink px-4 py-8 text-cream">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cream/70">
          Papic · candid camera
        </p>
        <div className="mx-auto mt-6 w-full max-w-md">
          <DayOfFaceEnroll
            context="guest_camera"
            onDone={() => {
              setEnrolled(true);
              setEnrolling(false);
            }}
            onSkip={() => setEnrolling(false)}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-ink text-cream">
      <header className="flex items-center justify-between px-4 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cream/70">
          Papic · candid camera
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 text-xs font-medium text-cream">
          <ImageIcon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {remaining} left
        </span>
      </header>

      {/* In-camera "add your face" fallback — catches the guest who jumped
          straight to shooting without enrolling on their landing page. Opens the
          front-camera selfie panel; dismissible. QR scan is the fallback either way. */}
      {needsFaceEnroll && !enrolled && !promptDismissed ? (
        <div className="mx-3 mb-1 flex items-center gap-2 rounded-xl bg-cream/10 px-3 py-2 text-xs text-cream/90">
          <Sparkles aria-hidden className="h-4 w-4 shrink-0 text-cream" strokeWidth={1.75} />
          <button
            type="button"
            onClick={() => setEnrolling(true)}
            className="flex-1 text-left font-medium underline-offset-2 hover:underline"
          >
            Add your face so your photos find you
          </button>
          <button
            type="button"
            onClick={() => setPromptDismissed(true)}
            aria-label="Dismiss"
            className="shrink-0 rounded-full p-1 text-cream/60 hover:text-cream"
          >
            <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      ) : null}

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
        />
        {!ready && !exhausted && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/80">
            <Loader2 aria-hidden className="h-6 w-6 animate-spin text-cream/70" strokeWidth={2} />
          </div>
        )}
        {justSaved && (
          <div className="absolute inset-0 flex items-center justify-center bg-cream/15">
            <span className="inline-flex items-center gap-2 rounded-full bg-ink/70 px-4 py-2 text-sm font-medium text-cream">
              <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} /> Saved
            </span>
          </div>
        )}
        {exhausted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/85 px-6 text-center">
            <Check aria-hidden className="h-8 w-8 text-cream" strokeWidth={2} />
            <p className="text-base font-semibold">That&rsquo;s all {total} photos, {guestName}!</p>
            <p className="text-sm text-cream/70">
              Thank you for helping capture {eventName}. The couple will treasure these.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 pb-8 pt-4">
        {saveError && <p className="text-center text-xs text-cream/80">{saveError}</p>}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={capture}
            disabled={busy || !ready || exhausted}
            aria-label="Take a photo"
            className="flex items-center justify-center rounded-full border-4 border-cream/80 bg-cream/10 transition active:scale-95 disabled:opacity-40"
            style={{ height: '4.5rem', width: '4.5rem' }}
          >
            {busy ? (
              <Loader2 aria-hidden className="h-7 w-7 animate-spin text-cream" strokeWidth={2} />
            ) : (
              <Camera aria-hidden className="h-7 w-7 text-cream" strokeWidth={1.75} />
            )}
          </button>
        </div>
        <p className="text-center text-xs text-cream/60">
          {exhausted
            ? 'Your camera is all used up — enjoy the celebration.'
            : 'Every photo lands in the couple’s gallery in real time.'}
        </p>

        {kwentoCaptureId && kwentoPhase !== 'sent' && kwentoPhase !== 'held' ? (
          <div className="rounded-xl border border-cream/15 bg-cream/5 p-3">
            <p className="text-sm font-medium text-cream/90">
              ✍️ Ano&rsquo;ng nangyari dito? Tell {eventName} the story.
            </p>
            <textarea
              value={kwentoText}
              onChange={(e) => setKwentoText(e.target.value.slice(0, 280))}
              rows={2}
              placeholder="Right after the first dance — hindi mapigil ang tawa…"
              className="mt-2 w-full resize-none rounded-md border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-cream/40 focus:outline-none"
            />
            <div className="mt-1 text-right text-[11px] text-cream/40">{kwentoText.length}/280</div>
            <label className="mt-1 flex items-start gap-2 text-xs text-cream/70">
              <input
                type="checkbox"
                checked={kwentoConsent}
                onChange={(e) => setKwentoConsent(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-mulberry"
              />
              <span>
                I&rsquo;m okay for the couple &amp; guests to see my name + message, and to
                use it in their wedding video. 💛
              </span>
            </label>
            <button
              type="button"
              onClick={() => void sendKwento()}
              disabled={kwentoPhase === 'sending' || kwentoText.trim().length === 0 || !kwentoConsent}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-50"
            >
              {kwentoPhase === 'sending' ? (
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
              ) : null}
              Send to the couple 💌
            </button>
            {kwentoError ? (
              <p className="mt-2 text-xs text-terracotta">{kwentoError}</p>
            ) : null}
          </div>
        ) : null}
        {kwentoPhase === 'sent' || kwentoPhase === 'held' ? (
          <div className="space-y-1 text-center">
            <p className="text-xs text-cream/80">
              {kwentoPhase === 'sent'
                ? 'Naipadala na! 💛 Salamat — your story is on its way to the couple.'
                : 'Sent — held for the couple to review first. 💛'}
            </p>
            {sentMessageId && deletePhase !== 'deleted' ? (
              <button
                type="button"
                onClick={() => void deleteKwento()}
                disabled={deletePhase === 'deleting'}
                className="text-[11px] text-cream/50 underline underline-offset-2 hover:text-cream/80 disabled:opacity-50"
              >
                {deletePhase === 'deleting' ? 'Removing…' : 'Changed your mind? Delete this story'}
              </button>
            ) : null}
            {deletePhase === 'deleted' ? (
              <p className="text-[11px] text-cream/50">Deleted — it won&rsquo;t be shared.</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
