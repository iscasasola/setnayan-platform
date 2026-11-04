'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCameraThatComesBack } from '@/lib/use-camera-that-comes-back';

/** The one line a scanner says when the browser refuses the camera. */
export const NO_CAMERA_ACCESS = 'No camera access. Check the browser’s permission for this site.';

/**
 * 📷 ONE LIVE QR SCAN — the camera half every "scan a code" button shares.
 *
 * EXTRACTED (2026-11-03, owner: the guest door's "Scan QR") from the Find-a-seat
 * scanner (`floor-command/seat-scanner.tsx`), whose lifecycle already copied
 * `patiktok/_components/tag-sheet.tsx` — so the guest door does not grow a third copy:
 *
 *   · the detector is `makeQrDetector` (lib/qr-scan.ts — native BarcodeDetector,
 *     else jsqr), loaded on the first press;
 *   · the stream is acquired BEFORE `scanning` flips true (the <video> is not
 *     mounted until then), and released on unmount — iOS allows one camera at a
 *     time, and a stream left running blocks every other capture in the app;
 *   · the camera comes back when iOS or a Duo takes it (`useCameraThatComesBack`).
 *
 * `onCode` is called once per DIFFERENT code in view. It decides: call `stop()`
 * when the code is the one it wanted; return to keep looking.
 */
export function useLiveQrScan(onCode: (raw: string) => void | Promise<void>) {
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectRef = useRef<((v: HTMLVideoElement) => Promise<string | null>) | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<string>('');
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    setCameraError(null);
    lastRef.current = '';
    try {
      // Stream first — the <video> does not exist until `scanning` is true.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      detectRef.current = detectRef.current ?? (await (await import('@/lib/qr-scan')).makeQrDetector());
      setScanning(true);
    } catch {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraError(NO_CAMERA_ACCESS);
    }
  }, []);

  // THE CAMERA COMES BACK (Duo + iPad audit 2026-10-19, W4): reopen through the
  // same start path (same rear camera) instead of leaving a frozen viewfinder.
  useCameraThatComesBack({
    streamRef,
    live: scanning,
    restart: () => {
      stop();
      void start();
    },
  });

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
          await onCodeRef.current(raw);
        }
      } catch {
        // A single bad frame is not a failure — keep scanning.
      }
      if (!cancelled) rafRef.current = requestAnimationFrame(() => void tick());
    };
    void tick();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [scanning]);

  return { scanning, cameraError, videoRef, start, stop };
}
