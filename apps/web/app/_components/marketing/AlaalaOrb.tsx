'use client';

/**
 * AlaalaOrb — circular-masked orb that crossfades Papic clips (≤5 s each)
 * inside a warm-glowing sphere.
 *
 * Cold-start: when `clips` is empty (no consented Papic clips exist yet),
 * the orb shows an animated CSS gradient — a living, warm sphere with a slow
 * gold shimmer. Drop real ≤5s clips into public/alaala/ and add them to
 * DEFAULT_CLIPS (or pass via the `clips` prop) to activate video playback.
 *
 * Motion: cursor parallax on desktop (tracks the nearest <section> ancestor);
 * gyro tilt on iOS (DeviceOrientationEvent). Both are gated on
 * prefers-reduced-motion and disabled when the media query fires.
 *
 * Size: controlled entirely by className (e.g. "w-[340px] h-[340px]").
 * The internal layers are percentage-based so they adapt to any container.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// Populate this array (or pass the clips prop) once real Papic clips exist.
// Each entry is a root-relative path, e.g. '/alaala/clip-01.mp4'.
const DEFAULT_CLIPS: string[] = [];

type Props = {
  clips?: string[];
  className?: string;
};

export function AlaalaOrb({ clips = DEFAULT_CLIPS, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [reduced, setReduced] = useState(false);
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const [active, setActive] = useState(0);
  const [fading, setFading] = useState(false);

  // Live-track prefers-reduced-motion (respects OS setting changes mid-session)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const h = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  // Cursor parallax — measures the nearest <section> ancestor for the centre
  useEffect(() => {
    if (reduced) return;
    const section = containerRef.current?.closest('section');
    if (!section) return;
    const onMove = (e: MouseEvent) => {
      const r = section.getBoundingClientRect();
      setTiltX((e.clientX - r.left - r.width / 2) / (r.width / 2));
      setTiltY((e.clientY - r.top - r.height / 2) / (r.height / 2));
    };
    const onLeave = () => { setTiltX(0); setTiltY(0); };
    section.addEventListener('mousemove', onMove);
    section.addEventListener('mouseleave', onLeave);
    return () => {
      section.removeEventListener('mousemove', onMove);
      section.removeEventListener('mouseleave', onLeave);
    };
  }, [reduced]);

  // Gyro tilt for iOS — beta is front/back, gamma is left/right
  useEffect(() => {
    if (reduced) return;
    const h = (e: DeviceOrientationEvent) => {
      if (e.gamma === null) return;
      setTiltX(Math.min(1, Math.max(-1, (e.gamma ?? 0) / 25)));
      setTiltY(Math.min(1, Math.max(-1, ((e.beta ?? 45) - 45) / 25)));
    };
    window.addEventListener('deviceorientation', h);
    return () => window.removeEventListener('deviceorientation', h);
  }, [reduced]);

  // Advance to next clip with a crossfade
  const advance = useCallback(() => {
    if (clips.length < 2) return;
    setFading(true);
    setTimeout(() => {
      setActive((i) => (i + 1) % clips.length);
      setFading(false);
    }, 700);
  }, [clips.length]);

  // Imperatively control playback when active clip changes
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === active) {
        v.currentTime = 0;
        v.play().catch(() => {}); // silently swallow autoplay-policy errors
      } else {
        v.pause();
        v.currentTime = 0;
      }
    });
  }, [active]);

  const offsetX = reduced ? 0 : tiltX * 14;
  const offsetY = reduced ? 0 : tiltY * 10;

  return (
    // Size is caller-controlled via className; internals use percentage-based layout
    <div ref={containerRef} className={`alaala-orb-root ${className}`} aria-hidden>
      {/* Motion wrapper — glow + body travel together under parallax/gyro */}
      <div
        className="alaala-orb-motion"
        style={{
          transform: `translate(${offsetX}px, ${offsetY}px)`,
          transition: reduced ? 'none' : 'transform 0.32s ease-out',
          willChange: reduced ? 'auto' : 'transform',
        }}
      >
        {/* Ambient glow — warm gold halo that bleeds outside the orb edge */}
        <div className="alaala-orb-glow" />

        {/* Orb body — circular clip-path for video; CSS layers stack inside */}
        <div className="alaala-orb-body">
          {/* CSS gradient — always visible as the orb skin; cold-start state */}
          <div className="alaala-orb-gradient" />

          {/* Conic shimmer — slow gold sweep that reads as internal light */}
          <div className="alaala-orb-shimmer" />

          {/* Video clips — crossfade on onEnded, play imperatively */}
          {clips.map((src, i) => (
            <video
              key={src}
              ref={(el) => { videoRefs.current[i] = el; }}
              src={src}
              muted
              playsInline
              onEnded={advance}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: i === active ? (fading ? 0 : 1) : 0,
                transition: 'opacity 0.7s ease',
                pointerEvents: 'none',
              }}
            />
          ))}

          {/* Glass specular — top-left sphere refraction to sell the 3D illusion */}
          <div className="alaala-orb-glass" />

          {/* Inner edge vignette — darkens the rim to deepen the sphere shape */}
          <div className="alaala-orb-vignette" />
        </div>
      </div>
    </div>
  );
}
