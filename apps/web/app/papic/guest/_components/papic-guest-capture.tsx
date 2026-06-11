'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Check, CircleAlert, ImageIcon, ShieldCheck } from 'lucide-react';

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
};

export function PapicGuestCapture({
  guestName,
  eventName,
  initialRemaining,
  total,
  termsAccepted,
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

  // UGC terms gate (Apple 1.2 / Google Play UGC). The guest must accept the
  // objectionable-content terms once before their first capture. If they've
  // already accepted (server-resolved), this is true and the camera shows
  // immediately.
  const [accepted, setAccepted] = useState(termsAccepted);
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

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
    if (!accepted || blocked) return;
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
  }, [accepted, blocked]);

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
      const res = await fetch('/api/papic/guest-capture', { method: 'POST', body: form });
      const json = (await res.json().catch(() => ({}))) as {
        status?: string;
        remaining?: number;
        error?: string;
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
    } catch {
      setSaveError("That shot didn't save — check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, ready, exhausted, accepted, blocked]);

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
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
