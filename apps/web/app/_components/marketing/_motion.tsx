'use client';

/**
 * v2.1 motion primitives · ported from template components/motion.jsx.
 *
 * WHY: CLAUDE.md 2026-05-28 11th row · template uses Reveal + Blob throughout
 * homepage sections. framer-motion is NOT in apps/web/package.json (only
 * tailwindcss-animate). Ported as zero-dependency client components using
 * IntersectionObserver for scroll-reveal and absolute-positioned div for Blob.
 *
 * Reveal — fades + slides children in when they enter the viewport (once).
 * Blob — soft radial gradient backdrop accent.
 *
 * Per [[feedback_setnayan_no_dev_text_post_launch]] no engineering jargon in
 * user-facing surfaces — these are visual-only primitives.
 */

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export function Reveal({
  children,
  delay = 0,
  y = 14,
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setSeen(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: seen ? 1 : 0,
        transform: seen ? 'translateY(0)' : `translateY(${y}px)`,
        transition: `opacity .6s ease ${delay}ms, transform .7s cubic-bezier(.2,.7,.2,1) ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Blob({
  top,
  left,
  right,
  bottom,
  size = 480,
  color = 'var(--m-orange)',
  opacity = 0.1,
}: {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  size?: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top,
        left,
        right,
        bottom,
        width: size,
        height: size,
        pointerEvents: 'none',
        background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
        opacity,
        filter: 'blur(40px)',
        transform: 'translate3d(0,0,0)',
      }}
    />
  );
}
