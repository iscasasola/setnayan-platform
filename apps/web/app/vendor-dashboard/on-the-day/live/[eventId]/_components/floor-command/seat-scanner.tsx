'use client';

/**
 * FIND-MY-SEAT — scan a guest's card, get their table.
 *
 * Reuses the shipped scanner machinery rather than adding any: `makeQrDetector`
 * (lib/qr-scan.ts — native BarcodeDetector, falling back to jsqr) and
 * `parsePapicTagScan` via `classifyScan`. The camera lifecycle copies
 * `patiktok/_components/tag-sheet.tsx`, the only scanner in the app that
 * already handles BOTH guest cards and table signs plus the iOS
 * one-camera-at-a-time contract: acquire the stream BEFORE flipping `scanning`
 * true (the <video> is not mounted yet), and always release it on unmount.
 *
 * ALL authorisation is server-side in `coordinator_seat_by_guest_qr` — booked +
 * coordinator tile + the host having SHARED the seat plan + a PUBLISHED plan.
 * This component only asks. It never learns a name: the answer is one table
 * label, and nothing else crosses the wire.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Loader2, MapPin, ScanLine } from 'lucide-react';

import { classifyScan, resolveSeatScan, type SeatScanOutcome } from '@/lib/floor-command';
import { floorSeatByQr } from './actions';

export function SeatScanner({ eventId }: { eventId: string }) {
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SeatScanOutcome | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectRef = useRef<((v: HTMLVideoElement) => Promise<string | null>) | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<string>('');

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  // Releasing the camera on unmount is not optional on iOS — a stream left
  // running blocks every other capture surface in the app.
  useEffect(() => stop, [stop]);

  const handle = useCallback(
    async (raw: string) => {
      const scan = classifyScan(raw);
      if (scan.kind === 'unreadable') return; // keep looking; not every frame is a code
      stop();
      setBusy(true);
      setLookupError(null);
      try {
        if (scan.kind === 'table') {
          setOutcome(resolveSeatScan(scan, null));
          return;
        }
        const res = await floorSeatByQr(eventId, scan.token);
        if (!res.ok) {
          setLookupError(res.error);
          setOutcome(null);
          return;
        }
        setOutcome(
          resolveSeatScan(scan, { found: res.found, tableLabel: res.tableLabel }),
        );
      } finally {
        setBusy(false);
      }
    },
    [eventId, stop],
  );

  const start = useCallback(async () => {
    setCameraError(null);
    setLookupError(null);
    setOutcome(null);
    try {
      // Stream first — the <video> does not exist until `scanning` is true.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      detectRef.current = detectRef.current ?? (await (await import('@/lib/qr-scan')).makeQrDetector());
      setScanning(true);
    } catch {
      setCameraError('No camera access. Check the browser’s permission for this site.');
    }
  }, []);

  // Attach the stream and run the decode loop once the video is mounted.
  useEffect(() => {
    if (!scanning) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    const detect = detectRef.current;
    if (!video || !stream || !detect) return;

    video.srcObject = stream;
    void video.play().catch(() => undefined);

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const raw = await detect(video);
        if (raw && raw !== lastRef.current) {
          lastRef.current = raw;
          await handle(raw);
          return;
        }
      } catch {
        // A single bad frame is not a failure — keep scanning.
      }
      rafRef.current = requestAnimationFrame(() => void tick());
    };
    void tick();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [scanning, handle]);

  return (
    <section className="space-y-3">
      <h4 className="flex items-center gap-1.5 text-sm font-medium text-ink">
        <ScanLine aria-hidden className="h-4 w-4 shrink-0 text-gild" strokeWidth={1.75} />
        Find a guest’s seat
      </h4>

      {scanning ? (
        <div className="space-y-2">
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-[4/3] w-full rounded-xl bg-ink/90 object-cover"
          />
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink/80 transition hover:border-terracotta"
          >
            <CameraOff aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Stop
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void start()}
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-ink/15 bg-white px-4 py-3 text-sm font-medium text-ink transition hover:border-terracotta disabled:opacity-40"
        >
          {busy ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
          ) : (
            <Camera aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          )}
          Scan a guest’s card
        </button>
      )}

      {cameraError ? (
        <p role="alert" className="rounded-lg bg-warn-600/10 px-3 py-2 text-sm text-warn-600">
          {cameraError}
        </p>
      ) : null}
      {lookupError ? (
        <p role="alert" className="rounded-lg bg-warn-600/10 px-3 py-2 text-sm text-warn-600">
          {lookupError}
        </p>
      ) : null}

      {outcome ? <Answer outcome={outcome} /> : null}
    </section>
  );
}

/**
 * The five answers, each pointing at the person who can fix it. "Not on this
 * event" and "no seat yet" look similar and are not: one is the couple's
 * problem, the other the seating plan's.
 */
function Answer({ outcome }: { outcome: SeatScanOutcome }) {
  if (outcome.kind === 'seated') {
    return (
      <p
        aria-live="polite"
        className="flex items-center gap-2 rounded-xl border border-success-400/40 bg-success-500/5 px-3 py-3"
      >
        <MapPin aria-hidden className="h-5 w-5 shrink-0 text-success-700" strokeWidth={1.75} />
        <span>
          <span className="block text-xs uppercase tracking-[0.15em] text-ink/50">Seated at</span>
          <span className="block text-lg font-semibold text-ink">{outcome.tableLabel}</span>
        </span>
      </p>
    );
  }

  const copy: Record<Exclude<SeatScanOutcome['kind'], 'seated'>, string> = {
    unseated: 'They’re on the guest list but haven’t been given a table yet — the couple’s seating plan is where that gets fixed.',
    not_this_event: 'That card isn’t for this event. Worth checking with the couple.',
    table_sign: 'That’s a table sign, not a guest card. Scan the card the guest is carrying.',
    unreadable: 'Couldn’t read that code.',
  };

  return (
    <p aria-live="polite" className="rounded-xl border border-ink/15 bg-white px-3 py-3 text-sm text-ink/70">
      {copy[outcome.kind]}
    </p>
  );
}
