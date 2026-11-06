'use client';

import { useEffect, useRef } from 'react';
import { watchCamera, type CameraRestartReason, type StreamLike } from '@/lib/camera-comes-back';

/**
 * Keep a page's camera live — reopen it when iOS, a Duo or a window move takes
 * it away. The rules and the reasons live in `lib/camera-comes-back.ts`.
 *
 * EVERY page that calls `getUserMedia` uses this (or is exempt, by name and
 * reason, in `lib/every-camera-comes-back.test.ts`).
 *
 * The contract the page keeps:
 *   · `live` is true only while its camera is open and showing. It MUST go
 *     false while the page reopens (its shipped "starting the camera" state),
 *     which is how the watch knows the request was answered and re-arms on the
 *     new stream.
 *   · `restart` is the page's own open path with the SAME constraints: stop
 *     the old tracks, show "starting", open again. It is never a new shot.
 *   · `holdWhile` is true while a reopen would destroy work — a clip
 *     recording, a take under review, an upload. The reopen waits for it.
 */
export function useCameraThatComesBack({
  streamRef,
  live,
  restart,
  holdWhile = false,
}: {
  streamRef: { readonly current: StreamLike | null };
  live: boolean;
  restart: (reason: CameraRestartReason) => void;
  holdWhile?: boolean | (() => boolean);
}): void {
  const restartRef = useRef(restart);
  const holdRef = useRef(holdWhile);
  useEffect(() => {
    restartRef.current = restart;
    holdRef.current = holdWhile;
  });
  // Shared across every watch of this page, so the loop limit outlives the
  // re-arm each restart causes.
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    if (!live) return;
    return watchCamera({
      getStream: () => streamRef.current,
      restart: (reason) => restartRef.current(reason),
      isHeld: () => {
        const h = holdRef.current;
        return typeof h === 'function' ? h() : h;
      },
      history: historyRef.current,
    });
  }, [live, streamRef]);
}
