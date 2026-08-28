'use client';

/**
 * The product film — a 12-second silent loop of the Papic camera.
 *
 * ⚠ WHY THIS IS A CLIENT COMPONENT FOR A VIDEO THAT JUST LOOPS.
 * A bare `<video autoPlay muted loop playsInline>` is correct until a browser
 * refuses the autoplay — and then it is a still frame with NO CONTROL ON IT,
 * which is a dead element on the only piece of motion this page has. Measured
 * in a real browser here: the element loaded (`readyState` 4) and stayed
 * `paused`, and calling `play()` by hand started it immediately. So the file is
 * fine and the policy is the variable, which is exactly the case that must not
 * be left to luck.
 *
 * Same lesson as the samahan day-viewer: a refused play falls back rather than
 * dying. There, an unmuted clip fell back to muted; here it is already muted,
 * so the fallback is to hand the viewer the browser's own controls.
 *
 * The film is ambient and silent by design — it is a demonstration, not
 * something anyone came to watch — so controls stay HIDDEN while it is playing
 * and appear only if it is not.
 */

import { useEffect, useRef, useState } from 'react';

export function PapicFilm() {
  const ref = useRef<HTMLVideoElement>(null);
  const [needsControls, setNeedsControls] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let cancelled = false;
    // `play()` returns a promise that REJECTS when the policy refuses. A bare
    // call would swallow that and leave a still frame nobody can start.
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

  return (
    <div className="aspect-[460/972] w-[150px] flex-none overflow-hidden rounded-2xl border border-[var(--m-line)] sm:w-[180px]">
      <video
        ref={ref}
        src="/add-ons/demo/papic.mp4"
        poster="/add-ons/demo/papic.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        controls={needsControls}
        aria-label="The Papic camera, running"
        className="h-full w-full object-cover"
      />
    </div>
  );
}
