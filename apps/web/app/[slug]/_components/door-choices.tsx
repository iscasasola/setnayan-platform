'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { NOT_THIS_EVENTS_CODE, uploadedQrTarget } from '@/lib/uploaded-qr';
import { useLiveQrScan } from '@/lib/use-live-qr-scan';
import { UploadYourQr } from './upload-your-qr';
import { DOOR_CHOICE, DOOR_CHOICE_CLASS } from './door-choice-words';

/**
 * 🚪 THE THREE CHOICES BEHIND "OPEN YOUR INVITATION" (owner 2026-11-03, DECISION_LOG "THE GUEST DOOR IS ONE BUTTON"):
 *
 *   · **Scan QR** — the live camera (`lib/use-live-qr-scan.ts`, the camera half the Find-a-seat scanner shares);
 *   · **Upload QR** — the phone's picker, decoded on the phone (`upload-your-qr.tsx`, its two messages unchanged);
 *   · **Lost QR? Login** — the shipped sign-in, back to this event (`signIn`, with `next`).
 *
 * A code read by the camera goes where an uploaded one goes (`uploadedQrTarget`): this event's key, on THIS site, so
 * the ordinary redeem → RSVP-first flow runs. A code for another event says so and the camera keeps looking.
 * The same three, in the same words, behind a listed guest's "Not [name]? Switch account".
 */
export function DoorChoices({ slug, signIn }: { slug: string | null; signIn: string }) {
  return (
    <div className="space-y-3" data-door-choices="">
      {slug ? <ScanYourQr slug={slug} /> : null}
      {slug ? <UploadYourQr slug={slug} /> : null}
      <a
        href={signIn}
        data-door-choice="login"
        className="flex min-h-[48px] w-full items-center justify-center text-sm font-medium text-ink underline underline-offset-4"
      >
        {DOOR_CHOICE.login}
      </a>
    </div>
  );
}

function ScanYourQr({ slug }: { slug: string }) {
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

