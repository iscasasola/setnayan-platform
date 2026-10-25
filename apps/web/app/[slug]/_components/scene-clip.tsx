'use client';

import { useEffect, useRef, useState } from 'react';
import { HUB_VEIL_RELEASED_EVENT } from '@/lib/hub-veil';

/**
 * A CLIP IN A SCENE — short ones loop, longer ones wait for a tap.
 *
 * Owner, 2026-09-24 (DECISION_LOG): *"yes, short clips loop and longer videos
 * tap to play"* ⇒ short clips autoplay MUTED, loop, inline, no controls; longer
 * videos show a still with ▶ and play WITH SOUND on a tap; both play only while
 * on screen; reduced-motion guests see the still. A guest whose phone asks to
 * save data (`navigator.connection.saveData`) also keeps the still — a loop is
 * decoration, never worth their data. A loop also rests while the tab is in
 * the background. For tap-to-play the couple
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
  className = 'hub-tpl-media',
  poster = null,
  revealOnPlay = false,
  firstFrame = false,
  position = null,
}: {
  src: string;
  /** The clip's still — its first frame before it plays, and under reduced motion. */
  poster?: string | null;
  play: 'loop' | 'tap';
  open: 'fullscreen' | 'inplace';
  /** What the ▶ button says to a screen reader. */
  label: string;
  /**
   * The video's class — a template slot's picture (the default), or a scene
   * BACKGROUND's layer (`hub-canvas-media`, `hub-canvas-frame.tsx`): the same
   * loop, cover-fitted by the frame's own rule.
   */
  className?: string;
  /**
   * 🖼 THE STILL STAYS UNTIL THE CLIP IS MOVING — the video is invisible until
   * its first `playing` event, so whatever the caller drew BEHIND it (the Main
   * background's still) is what a guest sees first, and what they keep seeing
   * if the clip never plays: reduced motion, Save-Data, iOS Low Power Mode
   * refusing autoplay (which would otherwise paint its own ▶ over the page), a
   * dead link. No guest-side control is ever shown.
   */
  revealOnPlay?: boolean;
  /**
   * 🎞 THE CLIP'S OWN FIRST FRAME IS THE STILL — the Cover Scene's clip (owner 2026-10-19, verbatim: *"shouldn't before
   * the reveal, it should be the first frame of the video?"*). The video is drawn from the start, with NO `poster`
   * (a stored poster is a separately grabbed JPEG — cale-ice's is all black), asking for its first frame
   * (`#t=0.001`, which is also what makes Safari paint it before a play) — so behind the veil the guest sees frame 0
   * and the unveil starts the film from exactly that frame, with no jump.
   * ▶ AND A REFUSED PLAY IS NEVER A DEAD STILL: when the browser refuses `play()` (`NotAllowedError` — iOS Low Power
   * Mode, a "never auto-play" site setting), a ▶ shows on the frame and the guest's next tap anywhere plays it.
   * Reduced motion and Save-Data keep the frame and show no ▶ (the guest asked for stillness).
   */
  firstFrame?: boolean;
  /** 🎯 Where the film is held when it is cropped (`mainGroundPosition` — the Main background's Focus). Null = its centre. */
  position?: string | null;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [moving, setMoving] = useState(false);
  /** The browser refused to play it (never the veil's own hold, which is an `AbortError`). */
  const [refused, setRefused] = useState(false);

  // LOOP: play only while on screen and while the tab is in front; never under
  // reduced motion, never when the guest asked their phone to save data.
  useEffect(() => {
    const v = ref.current;
    if (!v || play !== 'loop') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (reduce?.matches || saveData || typeof IntersectionObserver === 'undefined') {
      v.pause();
      return;
    }
    let onScreen = false;
    const sync = () => {
      if (onScreen && document.visibilityState !== 'hidden')
        void v.play().then(
          () => setRefused(false),
          (e: unknown) => {
            if (firstFrame && (e as { name?: string } | null)?.name === 'NotAllowedError') setRefused(true);
          },
        );
      else v.pause();
    };
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        if (!e) return;
        onScreen = e.isIntersecting;
        sync();
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    document.addEventListener('visibilitychange', sync);
    /* 👆 The unveil lets the page go INSIDE the guest's tap (`lib/hub-veil.ts`, the event is dispatched synchronously
       from that pointerup) — asked again there, so the play carries the tap's credit. */
    if (firstFrame) window.addEventListener(HUB_VEIL_RELEASED_EVENT, sync);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      if (firstFrame) window.removeEventListener(HUB_VEIL_RELEASED_EVENT, sync);
    };
  }, [play, firstFrame]);

  /* ▶ Refused: every tap anywhere asks again (a tap is a gesture every browser honours) until one plays — not `once`,
     so a tap that was itself refused (the unveil's own, in a browser that refuses even then) leaves the ▶ working. */
  useEffect(() => {
    if (!refused) return;
    const v = ref.current;
    if (!v) return;
    const tapToPlay = () => {
      void v.play().then(() => setRefused(false), () => undefined);
    };
    document.addEventListener('pointerup', tapToPlay, { capture: true });
    return () => document.removeEventListener('pointerup', tapToPlay, { capture: true });
  }, [refused]);

  if (play === 'loop' && firstFrame) {
    return (
      <>
        <video
          ref={ref}
          className={className}
          src={`${src}#t=0.001`}
          data-first-frame=""
          onPlaying={() => setRefused(false)}
          {...(position && position !== 'center' ? { style: { objectPosition: position } } : {})}
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
          tabIndex={-1}
        />
        {refused ? (
          <span
            data-clip-refused=""
            aria-hidden
            className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)] left-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-[18px] leading-none text-white"
          >
            ▶
          </span>
        ) : null}
      </>
    );
  }

  if (play === 'loop') {
    return (
      <video
        ref={ref}
        className={className}
        src={src}
        {...(poster ? { poster } : {})}
        {...(revealOnPlay ? { onPlaying: () => setMoving(true) } : {})}
        {...(revealOnPlay || (position && position !== 'center')
          ? { style: { ...(revealOnPlay ? { opacity: moving ? 1 : 0 } : {}), ...(position && position !== 'center' ? { objectPosition: position } : {}) } }
          : {})}
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
      <video ref={ref} className={className} src={`${src}#t=0.1`} playsInline preload="metadata" />
      {started ? null : (
        <button type="button" className="hub-tpl-play" onClick={start} aria-label={label}>
          <span aria-hidden>▶</span>
        </button>
      )}
    </>
  );
}
