'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Check, CircleAlert, PackageCheck, Undo2 } from 'lucide-react';
import { parseGuestQrPayload } from '@/lib/checkin';
import { confirmDelivery, undoDelivery } from '../../actions';

// Vendor delivery scan desk (owner 2026-06-28). OPERATIONAL ONLY: scan a guest's
// QR → confirm the service was delivered to them. The vendor sees a running
// count + a per-scan result, never a guest name or roster (no PII). Reuses the
// jsQR loop from the check-in / souvenir desks; all auth + guest resolution
// happens in the SECURITY DEFINER confirm_guest_delivery RPC.

export function DeliveryDesk({
  eventVendorId,
  initialTotal,
}: {
  eventVendorId: string;
  initialTotal: number;
}) {
  const [total, setTotal] = useState(initialTotal);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<
    { kind: 'ok' | 'dupe' | 'err'; text: string } | null
  >(null);
  const [lastToken, setLastToken] = useState<string | null>(null);

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const jsqrRef = useRef<typeof import('jsqr').default | null>(null);
  const rafRef = useRef<number>(0);
  const lastDecodeRef = useRef(0);
  const lastHitRef = useRef<string | null>(null);

  const stopScanner = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const onToken = useCallback(
    async (token: string) => {
      if (lastHitRef.current === token || busy) return;
      lastHitRef.current = token;
      setBusy(true);
      setFlash(null);
      try {
        const res = await confirmDelivery(eventVendorId, token, 'qr_scan');
        if (res.ok) {
          setTotal(res.total);
          setLastToken(token);
          if (typeof navigator !== 'undefined') navigator.vibrate?.(80);
          setFlash(
            res.result === 'already'
              ? { kind: 'dupe', text: 'Already given to this guest.' }
              : { kind: 'ok', text: 'Delivered ✓' },
          );
        } else {
          setFlash({ kind: 'err', text: res.error });
        }
      } finally {
        setBusy(false);
        // Allow re-scanning a different code immediately; same code debounced.
        window.setTimeout(() => {
          lastHitRef.current = null;
        }, 1200);
      }
    },
    [eventVendorId, busy],
  );

  const startScanner = useCallback(async () => {
    setCameraError(null);
    setFlash(null);
    try {
      const [{ default: jsQR }, stream] = await Promise.all([
        import('jsqr'),
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } },
          audio: false,
        }),
      ]);
      jsqrRef.current = jsQR;
      streamRef.current = stream;
      setScanning(true);
    } catch {
      stopScanner();
      setCameraError('Camera unavailable — check permissions and try again.');
    }
  }, [stopScanner]);

  useEffect(() => {
    if (!scanning) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    const jsQR = jsqrRef.current;
    if (!video || !stream || !jsQR) return;

    let active = true;
    video.srcObject = stream;
    void video.play().catch(() => {});

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = (now: number) => {
      if (!active || !streamRef.current) return;
      if (now - lastDecodeRef.current > 200 && ctx && video.readyState >= 2) {
        lastDecodeRef.current = now;
        const scale = Math.min(1, 640 / (video.videoWidth || 640));
        canvas.width = Math.round((video.videoWidth || 640) * scale);
        canvas.height = Math.round((video.videoHeight || 480) * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code?.data) {
          const token = parseGuestQrPayload(code.data);
          if (token) void onToken(token);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [scanning, onToken]);

  useEffect(() => stopScanner, [stopScanner]);

  const doUndoLast = useCallback(async () => {
    if (!lastToken) return;
    setBusy(true);
    try {
      const res = await undoDelivery(eventVendorId, lastToken);
      if (res.ok) {
        setTotal(res.total);
        setLastToken(null);
        setFlash({ kind: 'dupe', text: 'Last delivery undone.' });
      } else {
        setFlash({ kind: 'err', text: res.error });
      }
    } finally {
      setBusy(false);
    }
  }, [eventVendorId, lastToken]);

  return (
    <div className="space-y-5">
      {/* Running count — the whole operational signal. No names, no roster. */}
      <div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-cream px-5 py-4">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-ink">
          <PackageCheck aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Delivered
        </p>
        <p className="font-mono text-2xl font-semibold tabular-nums text-ink">{total}</p>
      </div>

      <section aria-label="QR scanner" className="overflow-hidden rounded-2xl border border-ink/10">
        {scanning ? (
          <div className="relative bg-ink">
            <video
              ref={videoRef}
              playsInline
              muted
              className="mx-auto block max-h-[52vh] w-full object-cover"
            />
            <button
              type="button"
              onClick={stopScanner}
              className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-cream/95 px-4 py-2 text-sm font-medium text-ink shadow-lg"
            >
              <CameraOff className="h-4 w-4" strokeWidth={1.75} /> Stop scanning
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startScanner}
            className="flex w-full items-center justify-center gap-2 bg-mulberry px-4 py-5 text-base font-semibold text-cream transition hover:bg-mulberry-600"
          >
            <Camera className="h-5 w-5" strokeWidth={1.75} /> Scan a guest QR
          </button>
        )}
        {cameraError ? (
          <p className="bg-terracotta/10 px-4 py-2 text-xs text-terracotta-700">{cameraError}</p>
        ) : null}
      </section>

      {flash ? (
        <p
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm ${
            flash.kind === 'ok'
              ? 'bg-success-50 text-success-800'
              : flash.kind === 'dupe'
                ? 'bg-ink/5 text-ink/70'
                : 'bg-terracotta/10 text-terracotta-700'
          }`}
        >
          {flash.kind === 'ok' ? (
            <Check className="h-4 w-4" strokeWidth={2.5} />
          ) : flash.kind === 'err' ? (
            <CircleAlert className="h-4 w-4" strokeWidth={2} />
          ) : null}
          {flash.text}
        </p>
      ) : null}

      {lastToken ? (
        <button
          type="button"
          disabled={busy}
          onClick={doUndoLast}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/55 hover:text-ink/80 disabled:opacity-50"
        >
          <Undo2 className="h-3.5 w-3.5" strokeWidth={2} /> Undo last scan
        </button>
      ) : null}
    </div>
  );
}
