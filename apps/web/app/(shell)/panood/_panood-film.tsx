'use client';

/**
 * The product film — a silent loop of the Live Studio control room, mirroring
 * `app/(shell)/papic/_papic-film.tsx`'s shape and rule: not a mock-up, a
 * recording of the same control panel `panood-demo-overlay.tsx` renders live
 * (status strip, CH 1 · CONTROLLED SCREEN monitor, the terracotta transport,
 * the two-camera switcher), so it can never drift from the product. It is
 * LANDSCAPE (16:9), not the Papic phone shape — the control room is a monitor,
 * not a handheld camera.
 *
 * ⚠ SAME AUTOPLAY-REFUSED FALLBACK AS PAPIC. A bare `<video autoPlay muted
 * loop playsInline>` that a browser refuses becomes a dead still with no
 * control on it. `play()` is called by hand so its rejection is observable,
 * and a refused play falls back to the browser's own controls instead of
 * leaving a frozen frame nobody can start.
 *
 * ⚠ EMPTY-STATE DISCIPLINE: the asset is the owner's to record, not fabricated
 * here. Until `/add-ons/demo/panood.mp4` is committed, the `<video>` 404s and
 * `onError` flips `missing`, which renders NOTHING — no broken box, no dead
 * poster — rather than lock in a placeholder as if it were the product.
 */

import { useEffect, useRef, useState } from 'react';

export function PanoodFilm() {
  const ref = useRef<HTMLVideoElement>(null);
  const [needsControls, setNeedsControls] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let cancelled = false;
    void v
      .play()
      .then(() => {
        if (!cancelled) setNeedsControls(false);
      })
      .catch(() => {
        if (!cancelled) setNeedsControls(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (missing) return null;

  return (
    <div className="aspect-video w-[220px] flex-none overflow-hidden rounded-2xl border border-[var(--m-line)] sm:w-[280px]">
      <video
        ref={ref}
        src="/add-ons/demo/panood.mp4"
        poster="/add-ons/demo/panood.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        controls={needsControls}
        onError={() => setMissing(true)}
        aria-label="The Live Studio control room, live"
        className="h-full w-full object-cover"
      />
    </div>
  );
}
