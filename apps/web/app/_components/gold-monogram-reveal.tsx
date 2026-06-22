'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import {
  DEFAULT_GOLD_DIALS,
  type GoldRevealDials,
  type GoldBuildUp,
  type GoldMove,
  type GoldAccent,
} from '@/lib/std-reveal-effects';

/**
 * GoldMonogramReveal — the couple's mark in flowing GOLD as a Save-the-Date
 * opening (and a reusable monogram moment), composed from three independent
 * DIALS (owner 2026-06-22):
 *   buildUp — how it FORMS:  trace (each element inks itself) · assemble (each
 *             flies in) · grow (blooms) · float-land (drifts down)
 *   move    — its 3D CHARACTER: turn (medallion) · hover (ambient) · swing
 *             (pendulum) · pop (punch toward viewer)
 *   accent  — the FLOURISH: shimmer · sparkle · ember-rise · foil-flash ·
 *             light-rays · engrave
 *
 * COLLISION-PROOFING: each dial owns ONE node so two animations never touch the
 * same property — `.grk-move` owns the move transform; `.grk-build` owns the
 * mark-level build-up (grow/float) OR is neutral while the PER-ELEMENT build-ups
 * (trace/assemble) animate the `.grk-el` glyph children; accents are separate
 * overlay/masked layers that touch no mark transform. `.grk-persp` (perspective)
 * is NEVER animated.
 *
 * MARK TIERS: a couple WITHOUT an uploaded/Cipher SVG renders as inline per-glyph
 * gold <text> — so trace/assemble/sparkle are TRUE per-element. A dense uploaded
 * SVG renders as the masked gold SILHOUETTE (the universal floor); its per-element
 * dials gracefully fall back to whole-mark (trace→wipe, assemble→grow, sparkle→
 * around). (Real per-letter trace in the couple's chosen lockup FONT is a PR3
 * fidelity follow-up — today lettered marks trace in an elegant serif.)
 *
 * Pure CSS/SVG — no WebGL, no animation runtime — main bundle, drops anywhere.
 * Honors prefers-reduced-motion (static gold mark, still resolves onDone).
 *
 * GESTURE HANDOFF (STD opening): TAP-triggered — the tap dispatches
 * 'std-go-fullscreen' SYNCHRONOUSLY (inside the gesture) so the film keeps its
 * iOS Fullscreen + audio user-activation, then the reveal plays and onDone()
 * fires → the overlay's 'std-reveal-done'. Autoplay (chooser preview) has no
 * gesture + no dispatch.
 */

const GOLD_BG =
  'linear-gradient(135deg, #6f5320 0%, #a88340 26%, #e4c77e 50%, #f6e6ad 56%, #a88340 74%, #6f5320 100%)';
const GOLD_A = '#A88340';
const GOLD_MID = '#E4C77E';

// Per-build-up + per-move entrance durations (ms). settleMs = max(build, move) +
// buffer → onDone fires when the entrance settles; ambient hover keeps running.
const BUILD_MS: Record<GoldBuildUp, number> = { trace: 1450, assemble: 1150, grow: 800, 'float-land': 1050 };
const MOVE_MS: Record<GoldMove, number> = { turn: 1350, swing: 1250, pop: 800, hover: 700 };

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Split the monogram into addressable glyphs: "M & J" → ["M","&","J"]; "MJ" → ["M","J"]. */
function splitGlyphs(s: string): string[] {
  const t = (s || '').trim();
  const spaced = t.split(/\s+/).filter(Boolean);
  const g = spaced.length >= 2 ? spaced : (t || '·').split('');
  return g.slice(0, 5);
}

/** A mark-only SVG (no plate) for the masked accents (shimmer/engrave/foil) and
 *  for the bespoke silhouette base. Uses the couple's SVG when present, else the
 *  initials laid out the same way the inline glyphs are. */
function maskSvg(markSvg: string | null, glyphs: string[]): string {
  if (markSvg) return markSvg;
  const W = Math.max(1, glyphs.length) * 100;
  const cells = glyphs
    .map((ch, i) => `<text x="${(i + 0.5) * 100}" y="128" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-style="italic" font-weight="600" font-size="110" fill="#000">${escapeXml(ch)}</text>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 180">${cells}</svg>`;
}

export function GoldMonogramReveal({
  markSvg = null,
  monogram,
  dials,
  onDone,
  autoplay = false,
  loop = false,
  className,
}: {
  /** Couple's uploaded/Cipher SVG mark (gold SILHOUETTE when present). */
  markSvg?: string | null;
  /** Initials, e.g. "A & J" — rendered as inline per-glyph gold text when no markSvg. */
  monogram: string;
  /** The 3 composition dials. Omitted → premium defaults (trace · turn · shimmer). */
  dials?: GoldRevealDials | null;
  /** Fires when the entrance (build-up + move) settles → the overlay's 'std-reveal-done'. */
  onDone?: () => void;
  /** Play on mount with no gesture (chooser preview). Default false = tap-triggered. */
  autoplay?: boolean;
  /** Loop the entrance forever (ambient/preview). Default false = once → settle. */
  loop?: boolean;
  className?: string;
}) {
  const sc = `grk-${useId().replace(/[:]/g, '')}`;
  const d = dials ?? DEFAULT_GOLD_DIALS;
  const { buildUp, move, accent } = d;
  const bespoke = Boolean(markSvg && markSvg.trim());
  const glyphs = bespoke ? [] : splitGlyphs(monogram);
  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(maskSvg(markSvg, glyphs))}`;
  // Per-element build-ups only apply when the mark decomposes (inline glyphs);
  // on a bespoke silhouette they relocate to a whole-mark fallback on .grk-build.
  const perElement = !bespoke && (buildUp === 'trace' || buildUp === 'assemble');

  const [revealing, setRevealing] = useState(autoplay);
  const reduced = useRef(false);
  const doneRef = useRef(false);
  // settleMs = when the ENTRANCE finishes (→ onDone → the film). For per-element
  // trace/assemble the last glyph starts late (staggered), so cover that tail or
  // the film starts before the final letters finish inking.
  const staggerMs = buildUp === 'trace' ? 340 : 220;
  const buildEnd = perElement
    ? Math.round(BUILD_MS[buildUp] * (buildUp === 'trace' ? 0.66 : 0.8)) +
      Math.max(0, glyphs.length - 1) * staggerMs
    : BUILD_MS[buildUp];
  const settleMs = Math.max(buildEnd, MOVE_MS[move]) + 150;

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
    if (autoplay) {
      if (reduced.current) finish();
      else if (!loop) window.setTimeout(finish, settleMs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTap = () => {
    if (revealing) return;
    try {
      window.dispatchEvent(new Event('std-go-fullscreen'));
    } catch {
      /* noop */
    }
    setRevealing(true);
    if (reduced.current) finish();
    else window.setTimeout(finish, settleMs);
  };

  const idle = !autoplay && !revealing;
  const animate = revealing && !reduced.current;
  const fill = loop ? 'infinite' : 'both';
  // SHIMMER = the GOLD ITSELF catches the light (the gradient's bright band sweeps
  // through the mark — owner 2026-06-22 "the shimmer on the exact logo", the first
  // sample's look), NOT a white band over a mask. Applied to the mark's own fill:
  // an animated SVG gradient (inline glyphs) / a swept background-position
  // (silhouette). The masked overlays are reserved for the distinct light EVENTS
  // (foil-flash press · engrave rake).
  const goldShimmer = accent === 'shimmer';

  // ── MOVE keyframes (own .grk-move transform) ───────────────────────────────
  const MOVE_KF: Record<GoldMove, string> = {
    turn: `@keyframes ${sc}-mv {0%{transform:rotateY(-110deg) scale(.82)}62%{transform:rotateY(8deg) scale(1.02)}80%{transform:rotateY(-3deg) scale(1)}100%{transform:rotateY(0) scale(1)}}`,
    swing: `@keyframes ${sc}-mv {0%{transform:rotateZ(-26deg)}32%{transform:rotateZ(17deg)}54%{transform:rotateZ(-9deg)}74%{transform:rotateZ(4deg)}100%{transform:rotateZ(0)}}`,
    pop: `@keyframes ${sc}-mv {0%{transform:translateZ(-150px) scale(.4);opacity:0}55%{transform:translateZ(60px) scale(1.12);opacity:1}72%{transform:translateZ(0) scale(1)}100%{transform:translateZ(0) scale(1)}}`,
    hover: `@keyframes ${sc}-mv {0%{transform:translateY(0) rotateX(0) rotateY(-6deg)}50%{transform:translateY(-9px) rotateX(7deg) rotateY(6deg)}100%{transform:translateY(0) rotateX(0) rotateY(-6deg)}}`,
  };
  // hover is ambient: loops continuously, started after the build-up settles.
  const moveRule =
    move === 'hover'
      ? `.${sc} .grk-move{animation:${sc}-mv 3.4s ease-in-out ${BUILD_MS[buildUp]}ms infinite}`
      : `.${sc} .grk-move{animation:${sc}-mv ${MOVE_MS[move]}ms cubic-bezier(.16,1,.3,1) ${fill}}`;
  const swingOrigin = move === 'swing' ? `.${sc} .grk-move{transform-origin:50% 6%}` : '';

  // ── BUILD-UP keyframes ──────────────────────────────────────────────────────
  // grow/float on .grk-build; trace/assemble on .grk-el (per glyph) when inline,
  // else a whole-mark fallback on .grk-build.
  let buildRule = '';
  if (buildUp === 'grow') {
    buildRule = `@keyframes ${sc}-bu{0%{transform:scale(0);opacity:0}60%{transform:scale(1.06);opacity:1}80%{transform:scale(1)}100%{transform:scale(1);opacity:1}}
      .${sc} .grk-build{animation:${sc}-bu ${BUILD_MS.grow}ms cubic-bezier(.2,1.3,.4,1) ${fill}}`;
  } else if (buildUp === 'float-land') {
    buildRule = `@keyframes ${sc}-bu{0%{transform:translateY(-46px);opacity:0}46%{opacity:1}68%{transform:translateY(7px)}84%{transform:translateY(0)}100%{transform:translateY(0);opacity:1}}
      .${sc} .grk-build{animation:${sc}-bu ${BUILD_MS['float-land']}ms cubic-bezier(.3,1,.4,1) ${fill}}`;
  } else if (perElement && buildUp === 'trace') {
    buildRule = `@keyframes ${sc}-tr{0%{stroke-dashoffset:360;fill-opacity:0}28%{stroke-dashoffset:0}40%{fill-opacity:1}100%{stroke-dashoffset:0;fill-opacity:1}}
      .${sc} .grk-el{fill:url(#${sc}-g);fill-opacity:0;stroke:url(#${sc}-g);stroke-width:1.4;stroke-dasharray:360;stroke-dashoffset:360;animation:${sc}-tr ${Math.round(BUILD_MS.trace * 0.66)}ms ease-in-out calc(var(--i,0)*0.34s) ${fill}}`;
  } else if (perElement && buildUp === 'assemble') {
    buildRule = `@keyframes ${sc}-as{0%{opacity:0;transform:translateY(40px) scale(.5)}55%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:1;transform:translateY(0) scale(1)}}
      .${sc} .grk-el{fill:url(#${sc}-g);opacity:0;transform-box:fill-box;transform-origin:center;animation:${sc}-as ${Math.round(BUILD_MS.assemble * 0.8)}ms cubic-bezier(.2,1.1,.3,1) calc(var(--i,0)*0.22s) ${fill}}`;
  } else {
    // bespoke + trace → left→right wipe; bespoke + assemble → grow. (.grk-build)
    if (buildUp === 'trace') {
      buildRule = `@keyframes ${sc}-bu{0%{clip-path:inset(0 100% 0 0);opacity:.15}42%{clip-path:inset(0 0 0 0);opacity:1}100%{clip-path:inset(0 0 0 0);opacity:1}}
        .${sc} .grk-build{animation:${sc}-bu ${BUILD_MS.trace}ms ease-in-out ${fill}}`;
    } else {
      buildRule = `@keyframes ${sc}-bu{0%{transform:scale(.4);opacity:0;filter:blur(4px)}60%{opacity:1;filter:blur(0)}100%{transform:scale(1);opacity:1}}
        .${sc} .grk-build{animation:${sc}-bu ${BUILD_MS.assemble}ms cubic-bezier(.2,1.2,.4,1) ${fill}}`;
    }
  }

  // ── ACCENT (overlay/masked layers; never touch the mark transform) ──────────
  const maskCss = `-webkit-mask-image:url("${dataUri}");mask-image:url("${dataUri}");-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center`;
  let accentRule = '';
  let accentNode: React.ReactNode = null;
  let behindNode: React.ReactNode = null;
  if (accent === 'foil-flash' || accent === 'engrave') {
    if (accent === 'foil-flash') {
      accentRule = `.${sc} .grk-over{${maskCss};background:rgba(255,247,222,.95);opacity:0;animation:${sc}-ac ${settleMs}ms ease-out ${fill}}
        @keyframes ${sc}-ac{0%,60%{opacity:0}72%{opacity:.95}88%{opacity:0}100%{opacity:0}}`;
    } else {
      accentRule = `.${sc} .grk-over{${maskCss};background-image:linear-gradient(180deg,transparent 42%,rgba(255,243,200,.8) 50%,transparent 58%);background-size:100% 240%;background-position:0 -130%;opacity:.0;animation:${sc}-ac 3.6s ease-in-out ${BUILD_MS[buildUp]}ms infinite}
        @keyframes ${sc}-ac{0%{background-position:0 130%;opacity:0}30%{opacity:.9}70%{background-position:0 -130%;opacity:.9}100%{background-position:0 -130%;opacity:0}}`;
    }
    accentNode = <span aria-hidden className="grk-over" />;
  } else if (accent === 'sparkle') {
    const pts = bespoke
      ? [{ x: 30, y: 50 }, { x: 70, y: 50 }, { x: 50, y: 28 }, { x: 50, y: 72 }]
      : glyphs.map((_, i) => ({ x: ((i + 0.5) / Math.max(1, glyphs.length)) * 100, y: 50 }));
    accentRule = `.${sc} .grk-sp{position:absolute;width:9px;height:9px;border-radius:50%;background:radial-gradient(circle,#fff6d2,rgba(255,230,170,.25) 60%,transparent 70%);opacity:0;animation:${sc}-ac 1.9s ease-in-out ${BUILD_MS[buildUp]}ms infinite}
      @keyframes ${sc}-ac{0%,100%{opacity:0;transform:scale(.3)}50%{opacity:1;transform:scale(1)}}`;
    accentNode = (
      <>
        {pts.map((p, i) => (
          <span
            key={i}
            aria-hidden
            className="grk-sp"
            style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${BUILD_MS[buildUp] + i * 420}ms` }}
          />
        ))}
      </>
    );
  } else if (accent === 'ember-rise') {
    accentRule = `.${sc} .grk-em{position:absolute;bottom:40%;width:6px;height:6px;border-radius:50%;background:radial-gradient(circle,#fbe9b0,rgba(233,207,126,.3) 60%,transparent);opacity:0;animation:${sc}-ac 2.4s ease-out ${BUILD_MS[buildUp]}ms infinite}
      @keyframes ${sc}-ac{0%{opacity:0;transform:translateY(0) scale(.6)}20%{opacity:1}100%{opacity:0;transform:translateY(-70px) scale(.3)}}`;
    accentNode = (
      <>
        {[38, 50, 58, 46, 64].map((x, i) => (
          <span key={i} aria-hidden className="grk-em" style={{ left: `${x}%`, animationDelay: `${BUILD_MS[buildUp] + i * 380}ms` }} />
        ))}
      </>
    );
  } else if (accent === 'light-rays') {
    accentRule = `.${sc} .grk-rays{position:absolute;width:150%;aspect-ratio:1/1;pointer-events:none;
      background:repeating-conic-gradient(from 0deg at 50% 50%, rgba(233,207,126,.45) 0deg 5deg, transparent 5deg 20deg);
      -webkit-mask:radial-gradient(circle,#000 16%,transparent 60%);mask:radial-gradient(circle,#000 16%,transparent 60%);
      opacity:0;animation:${sc}-ac 3.4s ease-in-out ${BUILD_MS[buildUp]}ms infinite}
      @keyframes ${sc}-ac{0%{opacity:0;transform:rotate(0) scale(.7)}40%{opacity:.5}100%{opacity:0;transform:rotate(26deg) scale(1.08)}}`;
    behindNode = <span aria-hidden className="grk-rays" />;
  }

  const idleRule = idle
    ? bespoke
      ? `.${sc} .grk-move{transform:rotateY(-104deg) scale(.84);opacity:.22}`
      : `.${sc} .grk-build{opacity:.25}`
    : '';

  // SHIMMER on a bespoke SILHOUETTE: sweep the gold background-position so the
  // GOLD_BG bright band travels through the mark (the inline-glyph tier shimmers
  // via the animated SVG gradient below instead). Continuous, like the first sample.
  const shimmerRule =
    goldShimmer && animate && bespoke
      ? `.${sc} .grk-sil{background-size:300% 100%;animation:${sc}-shim 3.4s ease-in-out infinite}
         @keyframes ${sc}-shim{0%{background-position:0% 0}50%{background-position:100% 0}100%{background-position:0% 0}}`
      : '';

  const css = `
    .${sc}{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
      background:radial-gradient(120% 90% at 50% 32%,#2b2638 0%,#14111c 58%,#0a0810 100%);
      cursor:${idle ? 'pointer' : 'default'};-webkit-tap-highlight-color:transparent}
    .${sc} .grk-key{position:absolute;top:-32%;left:50%;width:62%;height:84%;transform:translateX(-50%);
      background:radial-gradient(50% 50% at 50% 50%,rgba(255,240,205,.18),transparent 70%);pointer-events:none}
    .${sc} .grk-persp{position:relative;perspective:1100px;display:flex;align-items:center;justify-content:center}
    .${sc} .grk-move{position:relative;width:min(46vmin,300px);height:min(46vmin,300px);display:flex;align-items:center;justify-content:center;transform-style:preserve-3d;backface-visibility:hidden;will-change:transform}
    .${sc} .grk-build{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;will-change:transform,opacity}
    .${sc} .grk-mk{width:100%;height:100%;object-fit:contain;display:block}
    .${sc} .grk-sil{position:absolute;inset:0;background-image:${GOLD_BG};${maskCss}}
    .${sc} .grk-over{position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen}
    .${sc} .grk-sp,.${sc} .grk-em{pointer-events:none;mix-blend-mode:screen}
    .${sc} .grk-behind{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
    .${sc} .grk-prompt{position:absolute;bottom:11%;left:0;right:0;text-align:center;font-family:ui-sans-serif,system-ui,sans-serif;font-size:13px;letter-spacing:.28em;text-transform:uppercase;color:rgba(255,246,222,.72);animation:${sc}-pulse 2.4s ease-in-out infinite}
    @keyframes ${sc}-pulse{0%,100%{opacity:.4}50%{opacity:.85}}
    ${idleRule}
    ${animate ? `${MOVE_KF[move]} ${moveRule} ${swingOrigin} ${buildRule} ${accentRule} ${shimmerRule}` : ''}
    @media (prefers-reduced-motion: reduce){
      .${sc} .grk-move,.${sc} .grk-build,.${sc} .grk-el{animation:none!important;transform:none!important;opacity:1!important}
      .${sc} .grk-el{stroke-dashoffset:0!important;fill-opacity:1!important}
      .${sc} .grk-over,.${sc} .grk-sp,.${sc} .grk-em,.${sc} .grk-rays{display:none!important}
      .${sc} .grk-prompt{animation:none}
    }
  `;

  const W = Math.max(1, glyphs.length) * 100;

  return (
    <div
      className={`${sc}${className ? ' ' + className : ''}`}
      onPointerDown={idle ? onTap : undefined}
      role={idle ? 'button' : undefined}
      tabIndex={idle ? 0 : undefined}
      aria-label={idle ? 'Open your Save the Date' : undefined}
      onKeyDown={idle ? (e) => { if (e.key === 'Enter' || e.key === ' ') onTap(); } : undefined}
    >
      <span aria-hidden className="grk-key" />
      <div className="grk-persp">
        <div aria-hidden className="grk-move">
          <div className="grk-build">
            {behindNode ? <span className="grk-behind">{behindNode}</span> : null}
            {bespoke ? (
              <span className="grk-sil" />
            ) : (
              <svg className="grk-mk" viewBox={`0 0 ${W} 180`} aria-hidden="true">
                <defs>
                  <linearGradient id={`${sc}-g`} x1="0" y1="0" x2="1" y2="0">
                    {goldShimmer ? (
                      <>
                        <stop offset="0" stopColor="#7a5d22" />
                        <stop offset="0.42" stopColor={GOLD_A} />
                        <stop offset="0.5" stopColor="#fff6d4" />
                        <stop offset="0.58" stopColor={GOLD_A} />
                        <stop offset="1" stopColor="#7a5d22" />
                        {animate ? (
                          <animateTransform
                            attributeName="gradientTransform"
                            type="translate"
                            values="-1 0;1 0;-1 0"
                            dur="3.4s"
                            repeatCount="indefinite"
                          />
                        ) : null}
                      </>
                    ) : (
                      <>
                        <stop offset="0" stopColor={GOLD_A} />
                        <stop offset="0.5" stopColor={GOLD_MID} />
                        <stop offset="1" stopColor={GOLD_A} />
                      </>
                    )}
                  </linearGradient>
                </defs>
                {glyphs.map((ch, i) => (
                  <text
                    key={i}
                    className="grk-el"
                    style={{ '--i': i } as React.CSSProperties}
                    x={(i + 0.5) * 100}
                    y={128}
                    textAnchor="middle"
                    fontFamily="Georgia,'Times New Roman',serif"
                    fontStyle="italic"
                    fontWeight={600}
                    fontSize={110}
                    fill={`url(#${sc}-g)`}
                  >
                    {ch}
                  </text>
                ))}
              </svg>
            )}
            {accentNode}
          </div>
        </div>
      </div>
      {idle ? <p className="grk-prompt">Tap to open</p> : null}
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </div>
  );
}
