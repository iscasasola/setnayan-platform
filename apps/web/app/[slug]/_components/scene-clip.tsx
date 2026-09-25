'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A CLIP IN A SCENE — short ones loop, longer ones wait for a tap.
 *
 * Owner, 2026-09-24 (DECISION_LOG): *"yes, short clips loop and longer videos
 * tap to play"* ⇒ short clips autoplay MUTED, loop, inline, no controls; longer
 * videos show a still with ▶ and play WITH SOUND on a tap; both play only while
 * on screen; reduced-motion guests see the still. For tap-to-play the couple
 * picks Full screen (the default — guests are on phones, a long video wants
 * sound and the whole screen) or In place.
 *
 * 🔑 THE DEFAULT IS LOOP, and an uploaded clip is ≤ 15 s by the media rules
 * (Phase 4 refuses longer), so every own clip is a snippet unless the couple
 * chose "Tap to play" for it.
 *
 * ⛔ NO SOUND WITHOUT A TAP. A loop is muted and has no controls; only the
 * guest's own tap ever unmutes anything.
 */
export function SceneClip({
  src,
  play,
  open,
  label,
}: {
  src: string;
  play: 'loop' | 'tap';
  open: 'fullscreen' | 'inplace';
  /** What the ▶ button says to a screen reader. */
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  // LOOP: play only while on screen, never under reduced motion.
  useEffect(() => {
    const v = ref.current;
    if (!v || play !== 'loop') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (reduce?.matches || typeof IntersectionObserver === 'undefined') {
      v.pause();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        if (!e) return;
        if (e.isIntersecting) void v.play().catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [play]);

  if (play === 'loop') {
    return (
      <video
        ref={ref}
        className="hub-tpl-media"
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
        tabIndex={-1}
      />
    );
  }

  const start = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    v.controls = true;
    setStarted(true);
    void v.play().catch(() => undefined);
    if (open === 'fullscreen') {
      const el = v as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
      if (typeof v.requestFullscreen === 'function') void v.requestFullscreen().catch(() => undefined);
      else el.webkitEnterFullscreen?.();
    }
  };

  return (
    <>
      {/* `#t=0.1` asks for the first frame as the still — no poster file needed. */}
      <video ref={ref} className="hub-tpl-media" src={`${src}#t=0.1`} playsInline preload="metadata" />
      {started ? null : (
        <button type="button" className="hub-tpl-play" onClick={start} aria-label={label}>
          <span aria-hidden>▶</span>
        </button>
      )}
    </>
  );
}
