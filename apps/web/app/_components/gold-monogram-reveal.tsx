'use client';

import React, { useEffect, useId, useRef, useState } from 'react';

/**
 * GoldMonogramReveal — a Save-the-Date opening (and reusable monogram moment):
 * the couple's mark rendered in flowing GOLD, turning into view like a medallion
 * (CSS-3D rotateY) with a bright specular highlight that sweeps across exactly as
 * it faces front — "catches the light" (owner 2026-06-22, picked the "Turn" style).
 *
 * ONE render path for every mark type: a gold-gradient layer MASKED to the mark's
 * own shape. The mask source is the couple's uploaded/Cipher SVG when present
 * (markSvg), else a tiny generated initials SVG — so bespoke crests, and lettered
 * couples, both come out as a clean gold mark. The glint is a second masked layer
 * (the proven foil sweep from bespoke-monogram-motion) timed to peak face-on.
 *
 * Pure CSS/SVG — no WebGL, no animation runtime — so it stays in the main bundle
 * and drops onto any surface. Honors prefers-reduced-motion (static gold mark, no
 * turn/sweep, still resolves onDone so the film never hangs).
 *
 * GESTURE HANDOFF (STD opening): the reveal is TAP-triggered. The tap dispatches
 * 'std-go-fullscreen' SYNCHRONOUSLY (inside the gesture) so the content film's
 * iOS Fullscreen + audio unlock keep their user-activation, then the turn plays
 * and onDone() fires → the overlay turns that into 'std-reveal-done'. In autoplay
 * mode (the dashboard chooser preview) there's no gesture + no dispatch.
 */

const GOLD_BG =
  'linear-gradient(135deg, #6f5320 0%, #a88340 26%, #e4c77e 50%, #f6e6ad 56%, #a88340 74%, #6f5320 100%)';
const GLINT_BG =
  'linear-gradient(100deg, transparent 38%, rgba(255,247,224,0.95) 50%, transparent 62%)';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** A mark-only SVG of the couple's initials (no plate) — used as the gold mask
 *  when there's no uploaded/Cipher SVG. Wide viewBox + contain mask = it fits. */
function initialsSvg(text: string): string {
  const t = escapeXml((text || '·').trim() || '·');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 180">` +
    `<text x="180" y="132" text-anchor="middle" font-family="Georgia,'Times New Roman',ui-serif,serif" ` +
    `font-style="italic" font-weight="600" font-size="118" fill="#000">${t}</text></svg>`
  );
}

export function GoldMonogramReveal({
  markSvg = null,
  monogram,
  onDone,
  autoplay = false,
  loop = false,
  className,
}: {
  /** Couple's uploaded/Cipher SVG mark (gold-masked when present). */
  markSvg?: string | null;
  /** Initials fallback, e.g. "A & J" — rendered in gold when there's no markSvg. */
  monogram: string;
  /** Fires when the turn + glint settle (the STD overlay → 'std-reveal-done'). */
  onDone?: () => void;
  /** Play on mount with no gesture (chooser preview). Default false = tap-triggered. */
  autoplay?: boolean;
  /** Repeat the turn forever (ambient/preview). Default false = once → settle. */
  loop?: boolean;
  className?: string;
}) {
  const sc = `gmr-${useId().replace(/[:]/g, '')}`;
  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(markSvg ?? initialsSvg(monogram))}`;
  const [revealing, setRevealing] = useState(autoplay);
  const reduced = useRef(false);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone?.();
  };

  useEffect(() => {
    reduced.current =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Autoplay with reduced motion (or a non-looping autoplay) still resolves so
    // callers gating on completion never hang.
    if (autoplay) {
      if (reduced.current) finish();
      else if (!loop) window.setTimeout(finish, 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTap = () => {
    if (revealing) return;
    // CRITICAL: synchronous, inside the gesture — gives the film its iOS
    // Fullscreen + audio user-activation (the rigid stage fires onOpened off a
    // RAF tick, too late for activation). The veil does the same.
    try {
      window.dispatchEvent(new Event('std-go-fullscreen'));
    } catch {
      /* noop */
    }
    setRevealing(true);
    if (reduced.current) finish();
    else window.setTimeout(finish, 2000);
  };

  const idle = !autoplay && !revealing;
  const animate = revealing && !reduced.current;

  const css = `
    .${sc} { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      background: radial-gradient(120% 90% at 50% 32%, #2b2638 0%, #14111c 58%, #0a0810 100%);
      cursor: ${idle ? 'pointer' : 'default'}; -webkit-tap-highlight-color: transparent; }
    .${sc} .gmr-key { position:absolute; top:-32%; left:50%; width:62%; height:84%; transform:translateX(-50%);
      background: radial-gradient(50% 50% at 50% 50%, rgba(255,240,205,.18), transparent 70%); pointer-events:none; }
    .${sc} .gmr-perspective { perspective: 1100px; }
    .${sc} .gmr-mark { position:relative; width:min(46vmin,300px); aspect-ratio:1/1; transform-style:preserve-3d;
      backface-visibility:hidden; will-change:transform; transform: rotateY(0deg); }
    .${sc} .gmr-layer { position:absolute; inset:0;
      -webkit-mask-image:url("${dataUri}"); mask-image:url("${dataUri}");
      -webkit-mask-size:contain; mask-size:contain; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat;
      -webkit-mask-position:center; mask-position:center; }
    .${sc} .gmr-gold { background-image:${GOLD_BG}; }
    .${sc} .gmr-glint { background-image:${GLINT_BG}; background-size:260% 100%; background-position:130% 0; opacity:0; }
    .${sc} .gmr-prompt { position:absolute; bottom:11%; left:0; right:0; text-align:center;
      font-family:ui-sans-serif,system-ui,sans-serif; font-size:13px; letter-spacing:.28em; text-transform:uppercase;
      color:rgba(255,246,222,.72); animation: gmrPulse 2.4s ease-in-out infinite; }
    ${
      idle
        ? `.${sc} .gmr-mark { transform: rotateY(-104deg) scale(.84); opacity:.22; }`
        : ''
    }
    ${
      animate
        ? `.${sc} .gmr-mark { animation: ${sc}Turn 1.35s cubic-bezier(.16,1,.3,1) ${loop ? 'infinite' : 'both'}; }
           .${sc} .gmr-glint { animation: ${sc}Glint 1.35s ease-in-out ${loop ? 'infinite' : 'both'}; }`
        : ''
    }
    @keyframes ${sc}Turn {
      0% { transform: rotateY(-110deg) scale(.82); }
      62% { transform: rotateY(8deg) scale(1.02); }
      80% { transform: rotateY(-3deg) scale(1); }
      100% { transform: rotateY(0deg) scale(1); }
    }
    @keyframes ${sc}Glint {
      0%,40% { background-position:130% 0; opacity:0; }
      55% { opacity:1; }
      62% { background-position:50% 0; }
      82% { opacity:.85; }
      100% { background-position:-130% 0; opacity:0; }
    }
    @keyframes gmrPulse { 0%,100%{opacity:.4} 50%{opacity:.85} }
    @media (prefers-reduced-motion: reduce) {
      .${sc} .gmr-mark { animation:none !important; transform:rotateY(0deg) scale(1) !important; opacity:1 !important; }
      .${sc} .gmr-glint { display:none; }
      .${sc} .gmr-prompt { animation:none; }
    }
  `;

  return (
    <div
      className={`${sc}${className ? ' ' + className : ''}`}
      onPointerDown={idle ? onTap : undefined}
      role={idle ? 'button' : undefined}
      tabIndex={idle ? 0 : undefined}
      aria-label={idle ? 'Open your Save the Date' : undefined}
      onKeyDown={idle ? (e) => { if (e.key === 'Enter' || e.key === ' ') onTap(); } : undefined}
    >
      <span aria-hidden className="gmr-key" />
      <div className="gmr-perspective">
        <div aria-hidden className="gmr-mark">
          <div className="gmr-layer gmr-gold" />
          <div className="gmr-layer gmr-glint" />
        </div>
      </div>
      {idle ? <p className="gmr-prompt">Tap to open</p> : null}
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </div>
  );
}
