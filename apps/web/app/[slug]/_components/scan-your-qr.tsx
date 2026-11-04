'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { NOT_THIS_EVENTS_CODE, uploadedQrTarget } from '@/lib/uploaded-qr';
import { useLiveQrScan } from '@/lib/use-live-qr-scan';
import { DOOR_CHOICE, DOOR_CHOICE_CLASS } from './door-choice-words';

/**
 * 📷 "SCAN QR" — the first of the guest door's three choices (owner 2026-11-03, `door-choices.tsx`). The live camera is
 * the shared camera half (`lib/use-live-qr-scan.ts`); a code read goes where an uploaded one goes (`uploadedQrTarget`).
 * Loaded by `next/dynamic`, so its code is fetched when the door is drawn, never on the Maker's first load.
 */
export function ScanYourQr({ slug }: { slug: string }) {
  const [said, setSaid] = useState<string | null>(null);
  // Set below: the code that ends the scan releases the camera before the page moves on.
  const stopRef = useRef<() => void>(() => undefined);
  const onCode = useCallback(
    (raw: string) => {
      const target = uploadedQrTarget(raw, slug);
      if (target) {
        stopRef.current();
        window.location.assign(target);
        return;
      }
      setSaid(NOT_THIS_EVENTS_CODE);
    },
    [slug],
  );
  const { scanning, cameraError, videoRef, start, stop } = useLiveQrScan(onCode);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  return (
    <div className="space-y-2" data-door-choice="scan">
      {scanning ? (
        <>
          <video ref={videoRef} playsInline muted className="aspect-square w-full rounded-xl bg-ink/90 object-cover" />
          <button type="button" onClick={stop} className={DOOR_CHOICE_CLASS}>
            Stop
          </button>
        </>
      ) : (
        <button
          type="button"
          className={DOOR_CHOICE_CLASS}
          onClick={() => {
            setSaid(null);
            void start();
          }}
        >
          {DOOR_CHOICE.scan}
        </button>
      )}
      {said || cameraError ? (
        <p role="alert" className="text-center text-sm font-medium text-terracotta-700">
          {said ?? cameraError}
        </p>
      ) : null}
    </div>
  );
}

