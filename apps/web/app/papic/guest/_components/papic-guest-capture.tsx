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
  ScanLine,
  Users,
} from 'lucide-react';
import { DayOfFaceEnroll } from '@/app/[slug]/_components/day-of-face-enroll';
import { makeQrDetector } from '@/lib/qr-scan';

const TAG_CAP = 10; // max tags per photo (corpus hard cap · mirrored server-side)

/** Friendly, guest-facing copy for a tag failure. The camera never breaks on a
 *  tag miss — these just steer the next scan. */
function tagErrorMessage(error: string): string {
  switch (error) {
    case 'unrecognized':
      return 'That’s not a guest or table QR — point at a place card or table sign.';
    case 'guest_not_found':
      return 'That guest QR isn’t from this wedding.';
    case 'table_not_found':
      return 'That table sign isn’t from this wedding.';
    case 'cap_reached':
      return `This photo already has ${TAG_CAP} tags — that’s the max.`;
    case 'not_your_photo':
      return 'You can only tag your own photos.';
    case 'unavailable':
      return 'Tagging isn’t available right now — your photo still saved.';
    default:
      return 'Couldn’t tag that — try again.';
  }
}

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
  // Kwento (0012): after a shot, the guest can tell the couple the story behind
  // it — the warmest moment to ask. Anchored on the capture just made.
  //
  // Two-step voice-depth flow:
  //   flash  — bottom one-liner (≤50 chars), 5-second auto-dismiss, no consent
  //             checkbox (covered by the Papic session consent).
  //   story  — the existing full textarea (≤280 chars) with consent checkbox,
  //             offered after Flash sends OR after it times out/is dismissed.
  const [kwentoCaptureId, setKwentoCaptureId] = useState<string | null>(null);
  const [kwentoFlashText, setKwentoFlashText] = useState('');
  const [kwentoStoryText, setKwentoStoryText] = useState('');
  const [kwentoConsent, setKwentoConsent] = useState(false);
  const [kwentoPhase, setKwentoPhase] = useState<
    'idle' | 'flash' | 'flash_sending' | 'story' | 'story_sending' | 'sent' | 'held'
  >('idle');
  const [kwentoError, setKwentoError] = useState<string | null>(null);
  const [flashCountdown, setFlashCountdown] = useState(5);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  // Scan-to-tag (QR fallback) — after a shot, the guest can scan a place-card or
  // table QR to mark who's in it, so it lands in that guest's "Photos of you".
  // Mirrors the seat camera, on the same rear stream.
  const [lastCaptureId, setLastCaptureId] = useState<string | null>(null);
  const [tagging, setTagging] = useState(false);
  const [tagCount, setTagCount] = useState(0);
  const [taggedNames, setTaggedNames] = useState<string[]>([]);
  const [tagNotice, setTagNotice] = useState<string | null>(null);
  const tagBusyRef = useRef(false);
  const lastScanRef = useRef<string>('');

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
        setKwentoFlashText('');
        setKwentoStoryText('');
        setKwentoConsent(false);
        // Open the Flash prompt immediately.
        setKwentoPhase('flash');
        setFlashCountdown(5);
        setKwentoError(null);
        setSentMessageId(null);
        setDeletePhase('idle');
        // Arm scan-to-tag for the shot just saved (fresh tag state per photo).
        setLastCaptureId(json.captureId);
        setTagging(false);
        setTagCount(0);
        setTaggedNames([]);
        setTagNotice(null);
        lastScanRef.current = '';
      }
    } catch {
      setSaveError("That shot didn't save — check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, ready, exhausted, accepted, blocked]);

  // ---- scan-to-tag ---------------------------------------------------------

  const startTagging = useCallback(() => {
    if (!lastCaptureId) return;
    lastScanRef.current = '';
    tagBusyRef.current = false;
    setTagNotice(null);
    setTagging(true);
  }, [lastCaptureId]);

  const stopTagging = useCallback(() => setTagging(false), []);

  // Act on one decoded QR: POST it to the guest-tag route (which classifies it
  // as a guest or table code, confirms the capture is ours, and writes the tag
  // within this event). The camera keeps running regardless — a miss only
  // steers the next scan.
  const handleScan = useCallback(
    async (raw: string) => {
      if (!lastCaptureId) return;
      let r: Record<string, unknown>;
      try {
        const res = await fetch('/api/papic/guest-tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ captureId: lastCaptureId, scanned: raw }),
        });
        r = (await res.json().catch(() => ({ ok: false, error: 'tag_failed' }))) as Record<
          string,
          unknown
        >;
      } catch {
        r = { ok: false, error: 'tag_failed' };
      }

      if (!r.ok) {
        setTagNotice(tagErrorMessage(String(r.error ?? 'tag_failed')));
        // Retry a transient error by clearing the debounce so a held code
        // self-heals; deterministic outcomes stay debounced.
        if (r.error === 'tag_failed') lastScanRef.current = '';
        return;
      }

      if (typeof navigator !== 'undefined') navigator.vibrate?.(60);
      setTagCount(Number(r.tag_count ?? 0));
      const names = Array.isArray(r.names) ? (r.names as string[]) : [];
      const added = Number(r.added ?? 0);
      if (added > 0) {
        setTaggedNames((prev) => Array.from(new Set([...prev, ...names])));
      }
      if (r.kind === 'table') {
        const label = typeof r.table_label === 'string' ? r.table_label : 'that table';
        if (added === 0 && Number(r.total_at_table ?? 0) === 0) {
          setTagNotice(`No one’s seated at ${label} yet.`);
        } else if (r.truncated) {
          setTagNotice(`${label}: added ${added}, but this photo hit the ${TAG_CAP}-tag limit.`);
        } else if (added === 0) {
          setTagNotice(`Everyone at ${label} is already tagged.`);
        } else {
          setTagNotice(null);
        }
      } else {
        setTagNotice(r.already ? `${names[0] ?? 'They’re'} already tagged.` : null);
      }
    },
    [lastCaptureId],
  );

  // Decode loop — runs only while the tag sheet is open, on the EXISTING rear
  // stream. Serial + debounced on the raw payload so a held code fires once.
  useEffect(() => {
    if (!tagging) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    void (async () => {
      const detect = await makeQrDetector();
      if (!active) return;
      const loop = async () => {
        if (!active) return;
        const video = videoRef.current;
        if (video && !tagBusyRef.current) {
          const raw = await detect(video).catch(() => null);
          if (active && raw && raw !== lastScanRef.current) {
            lastScanRef.current = raw;
            tagBusyRef.current = true;
            try {
              await handleScan(raw);
            } finally {
              tagBusyRef.current = false;
            }
          }
        }
        if (active) timer = setTimeout(loop, 200);
      };
      void loop();
    })();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [tagging, handleScan]);

  // ---- Kwento Flash countdown timer ----------------------------------------

  // Starts when Flash phase opens; clears on send, dismiss, or unmount.
  useEffect(() => {
    if (kwentoPhase !== 'flash') {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
      return;
    }
    setFlashCountdown(5);
    flashIntervalRef.current = setInterval(
      () => setFlashCountdown((c) => Math.max(0, c - 1)),
      1000,
    );
    // Auto-dismiss to Story after 5 seconds.
    flashTimerRef.current = setTimeout(() => {
      setKwentoPhase((p) => (p === 'flash' ? 'story' : p));
    }, 5000);
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
    };
  }, [kwentoPhase]);

  // ---- send helpers ---------------------------------------------------------

  const dismissFlash = useCallback(() => {
    if (kwentoPhase !== 'flash') return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
    setKwentoPhase('story');
  }, [kwentoPhase]);

  const sendFlash = async () => {
    if (!kwentoCaptureId || kwentoPhase === 'flash_sending') return;
    const text = kwentoFlashText.trim();
    if (text.length < 1) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
    setKwentoPhase('flash_sending');
    setKwentoError(null);
    try {
      const res = await fetch('/api/papic/kwento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captureId: kwentoCaptureId,
          body: text,
          voiceDepth: 'flash',
          // Flash consent is covered by the Papic session claim.
          consent: true,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        state?: string;
        error?: string;
        messageId?: string;
      };
      if (res.ok && json.ok) {
        setSentMessageId(json.messageId ?? null);
        setDeletePhase('idle');
        // Flash sent → immediately offer Story ("Tell them more?").
        setKwentoPhase('story');
        return;
      }
      setKwentoPhase('flash');
      setKwentoError(
        json.error === 'keep_it_sweet'
          ? "Let's keep it sweet 💛 — try rephrasing."
          : json.error === 'limit_reached'
            ? "You've shared your 10 kwentos for this celebration — salamat!"
            : json.error === 'too_fast'
              ? 'One kwento at a time — give it a few seconds.'
              : "That didn't send — try again.",
      );
    } catch {
      setKwentoPhase('flash');
      setKwentoError('No signal — try again in a moment.');
    }
  };

  const sendStory = async () => {
    if (!kwentoCaptureId || kwentoPhase === 'story_sending') return;
    const text = kwentoStoryText.trim();
    if (text.length < 1 || !kwentoConsent) return;
    setKwentoPhase('story_sending');
    setKwentoError(null);
    try {
      const res = await fetch('/api/papic/kwento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captureId: kwentoCaptureId,
          body: text,
          voiceDepth: 'story',
          consent: true,
        }),
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
      setKwentoPhase('story');
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
      setKwentoPhase('story');
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

  // Hoist before JSX to avoid TS2367: kwentoPhase === 'flash' narrows the type
  // inside the flash JSX block, making === 'flash_sending' always-false there.
  const isFlashSending = kwentoPhase === 'flash_sending';
  const isStorySending = kwentoPhase === 'story_sending';

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
            disabled={busy || !ready || exhausted || tagging}
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

        {/* Scan-to-tag — the QR fallback so this shot reaches the right guest's
            "Photos of you." Offered after a capture; opens a scanner on the live
            rear stream. Tagging is optional — the photo already landed. */}
        {lastCaptureId && !tagging ? (
          <button
            type="button"
            onClick={startTagging}
            className="mx-auto flex items-center justify-center gap-2 rounded-full bg-cream/10 px-4 py-2 text-sm font-medium text-cream transition hover:bg-cream/20"
          >
            <ScanLine aria-hidden className="h-4 w-4" strokeWidth={2} />
            Tag who&rsquo;s in it
          </button>
        ) : null}

        {tagging ? (
          <div className="rounded-xl border border-cream/15 bg-cream/5 p-3">
            <div className="flex items-center justify-between">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-cream/90">
                <ScanLine aria-hidden className="h-4 w-4 text-cream" strokeWidth={2} />
                Point at a place card or table sign
              </p>
              <span className="font-mono text-[11px] text-cream/55">{tagCount}/{TAG_CAP}</span>
            </div>
            {taggedNames.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Tagged guests">
                {taggedNames.map((n) => (
                  <li
                    key={n}
                    className="inline-flex items-center gap-1 rounded-full bg-cream/10 px-2.5 py-1 text-xs text-cream"
                  >
                    <Users aria-hidden className="h-3 w-3" strokeWidth={2} />
                    {n}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-cream/55">
                Hold a guest&rsquo;s QR or a table sign in the frame — no tap needed.
              </p>
            )}
            {tagNotice ? <p className="mt-2 text-xs text-cream/80">{tagNotice}</p> : null}
            <button
              type="button"
              onClick={stopTagging}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-cream/15 px-4 py-2 text-sm font-medium text-cream hover:bg-cream/25"
            >
              <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
              Done tagging
            </button>
          </div>
        ) : null}

        {/* ── Flash prompt — bottom one-liner, auto-dismisses in 5 s ──────── */}
        {kwentoCaptureId && kwentoPhase === 'flash' ? (
          <div className="rounded-xl border border-cream/20 bg-cream/8 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-cream/90">
                <span className="mr-1">⚡</span> One line. What just happened?
              </p>
              <span className="shrink-0 rounded-full bg-cream/15 px-2 py-0.5 font-mono text-[11px] text-cream/60">
                {flashCountdown}s
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={kwentoFlashText}
                onChange={(e) => setKwentoFlashText(e.target.value.slice(0, 50))}
                placeholder="Hindi mapigil ang tawa…"
                className="flex-1 rounded-md border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-cream/40 focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => void sendFlash()}
                disabled={isFlashSending || kwentoFlashText.trim().length === 0}
                className="shrink-0 rounded-md bg-mulberry px-3 py-2 text-sm font-medium text-cream disabled:opacity-40"
              >
                {isFlashSending ? (
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
                ) : (
                  '↑'
                )}
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[10px] text-cream/35">{kwentoFlashText.length}/50</span>
              <button
                type="button"
                onClick={dismissFlash}
                className="text-[11px] text-cream/40 underline underline-offset-2 hover:text-cream/70"
              >
                Skip
              </button>
            </div>
            {kwentoError ? (
              <p className="mt-1 text-xs text-terracotta">{kwentoError}</p>
            ) : null}
          </div>
        ) : null}

        {/* ── Story offer — appears after Flash sends or is dismissed ──────── */}
        {kwentoCaptureId && kwentoPhase === 'story' ? (
          <div className="rounded-xl border border-cream/15 bg-cream/5 p-3">
            <p className="text-sm font-medium text-cream/90">
              ✍️ Tell them more? {sentMessageId ? '(Optional — Flash already sent 💛)' : 'Ano\'ng nangyari dito?'}
            </p>
            <textarea
              value={kwentoStoryText}
              onChange={(e) => setKwentoStoryText(e.target.value.slice(0, 280))}
              rows={2}
              placeholder="Right after the first dance — hindi mapigil ang tawa…"
              className="mt-2 w-full resize-none rounded-md border border-cream/15 bg-ink/40 px-3 py-2 text-sm text-cream placeholder:text-cream/30 focus:border-cream/40 focus:outline-none"
            />
            <div className="mt-1 text-right text-[11px] text-cream/40">{kwentoStoryText.length}/280</div>
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
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void sendStory()}
                disabled={isStorySending || kwentoStoryText.trim().length === 0 || !kwentoConsent}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-50"
              >
                {isStorySending ? (
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
                ) : null}
                Send to the couple 💌
              </button>
              {sentMessageId ? (
                <button
                  type="button"
                  onClick={() => setKwentoPhase('sent')}
                  className="rounded-md border border-cream/15 px-3 py-2 text-sm text-cream/60 hover:text-cream"
                >
                  Done
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setKwentoPhase('idle')}
                  className="rounded-md border border-cream/15 px-3 py-2 text-sm text-cream/60 hover:text-cream"
                >
                  Skip
                </button>
              )}
            </div>
            {kwentoError ? (
              <p className="mt-2 text-xs text-terracotta">{kwentoError}</p>
            ) : null}
          </div>
        ) : null}

        {/* ── Confirmation / delete ─────────────────────────────────────────── */}
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
